'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { publicDiagnosticApi } from '@/lib/api';
import { Loader2, Lock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OnboardingRightStage } from '@/components/diagnostico/onboarding-right-stage';
import { ONBOARDING_STEP_LABELS, saveOnboardingSnapshot, type SitePreviewContext } from './diagnostic-onboarding';
import { lastStepForAbandon, trackOnboarding } from './onboarding-analytics';
import { OnboardingMomentStack, type MomentKind } from './onboarding-moments';

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function PulsingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-primary-600 animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-primary-600 animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-primary-600 animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

const HERO = ['/verificando-hero.png', '/verificando-hero-2.png'] as const;

type OverlayMoment = Extract<MomentKind, { type: 'quiz1' } | { type: 'quiz2' } | { type: 'insight' } | { type: 'social' } | { type: 'social2' } | { type: 'prediction' }> | { type: 'idle' };

function isBlockingOverlay(m: OverlayMoment): m is Extract<OverlayMoment, { type: Exclude<OverlayMoment['type'], 'idle'> }> {
  return m.type !== 'idle';
}

function isReportReadyForRedirect(
  diagnostic: Awaited<ReturnType<typeof publicDiagnosticApi.get>>
): boolean {
  if (diagnostic.status !== 'completed') return false;
  if (!diagnostic.runResult) return false;
  if (!diagnostic.showFullReport) return true;

  // Esperamos a que exista consolidado técnico (analysisJson) para no abrir un reporte incompleto.
  if (diagnostic.analysisJson == null) return false;

  // Si hubo segundo modelo, esperamos su run o un fallo explícito.
  if (!diagnostic.runGeminiId) return true;
  if (diagnostic.runResultGemini) return true;
  return diagnostic.geminiRunStatus === 'failed';
}

function VerificandoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const tierQParam = searchParams.get('tier');
  const [diagnostic, setDiagnostic] = useState<Awaited<ReturnType<typeof publicDiagnosticApi.get>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [emailErrorCode, setEmailErrorCode] = useState<'provider_rejected' | 'send_failed' | undefined>();
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaPopupOpen, setCaptchaPopupOpen] = useState(true);

  const [heroIdx, setHeroIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setHeroIdx((i) => (i + 1) % HERO.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const [handoff, setHandoff] = useState<'no' | 'preview' | 'leaving'>('no');
  const [pipeline, setPipeline] = useState(0);
  const [overlay, setOverlay] = useState<OverlayMoment>({ type: 'idle' });
  const [visualBoost, setVisualBoost] = useState(0);
  const [emailSectionVisible, setEmailSectionVisible] = useState(false);
  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  const started = useRef(false);
  const abandonedTracked = useRef(false);

  const stepsList = diagnostic?.steps ?? [];
  const activeIndex = useMemo(() => {
    if (stepsList.length === 0) return 0;
    const i = stepsList.findIndex((s) => !s.completed);
    return i < 0 ? ONBOARDING_STEP_LABELS.length - 1 : i;
  }, [stepsList]);
  const completedCount = useMemo(
    () => (stepsList.length ? stepsList.filter((s) => s.completed).length : 0),
    [stepsList]
  );
  const currentLabel = ONBOARDING_STEP_LABELS[activeIndex] ?? 'Conectando…';
  const progress = diagnostic?.progressPercent ?? 0;
  const brandLabel = diagnostic?.brandName ?? null;
  const domain = diagnostic?.domain ?? '';
  const industry = diagnostic?.industry ?? null;
  const isRunning = diagnostic?.status === 'running';
  const allStepsDone = stepsList.length > 0 && stepsList.every((s) => s.completed);
  const isFinalizing = isRunning && allStepsDone;
  const finalizingWave = 92 + ((elapsedSeconds % 7) / 6) * 6;
  const barPct = isFinalizing ? finalizingWave : Math.min(progress, 100);
  const ctx: SitePreviewContext = useMemo(
    () => ({
      brandName: brandLabel,
      domain: domain || '',
      industry,
    }),
    [brandLabel, domain, industry]
  );
  const domainShort = (domain || '').replace(/^https?:\/\//, '');

  const advancePipeline = useCallback((next: number) => {
    setPipeline(next);
    setOverlay({ type: 'idle' });
  }, []);

  const onQuiz1 = useCallback(
    (v: string) => {
      if (!diagnosticId) return;
      saveOnboardingSnapshot(diagnosticId, { quiz1: v });
      trackOnboarding('onboarding_quiz_answered', { q: 'chatgpt_treatment', v });
      setVisualBoost((b) => b + 1);
      advancePipeline(1);
    },
    [diagnosticId, advancePipeline]
  );
  const onQuiz2 = useCallback(
    (v: string) => {
      if (!diagnosticId) return;
      saveOnboardingSnapshot(diagnosticId, { quiz2: v });
      trackOnboarding('onboarding_quiz_answered', { q: 'competitors', v });
      setVisualBoost((b) => b + 1);
      advancePipeline(4);
    },
    [diagnosticId, advancePipeline]
  );
  const onPredict = useCallback(
    (r: string) => {
      if (!diagnosticId) return;
      saveOnboardingSnapshot(diagnosticId, { predictedRange: r });
      trackOnboarding('onboarding_score_predicted', { range: r });
      setVisualBoost((b) => b + 1);
      advancePipeline(6);
    },
    [diagnosticId, advancePipeline]
  );
  const onInsightClose = useCallback(() => {
    const o = overlayRef.current;
    if (o.type !== 'insight') {
      setOverlay({ type: 'idle' });
      return;
    }
    if (o.stepIndex === 2) advancePipeline(2);
    else if (o.stepIndex === 5) advancePipeline(5);
    else if (o.stepIndex === 8) advancePipeline(7);
  }, [advancePipeline]);
  const onSocialClose = useCallback(() => {
    const o = overlayRef.current;
    if (o.type === 'social') {
      trackOnboarding('onboarding_social_shown', { n: '1' });
      advancePipeline(3);
    } else if (o.type === 'social2') {
      trackOnboarding('onboarding_social_shown', { n: '2' });
      advancePipeline(8);
    } else {
      setOverlay({ type: 'idle' });
    }
  }, [advancePipeline]);

  useEffect(() => {
    if (!diagnosticId) return;
    if (started.current) return;
    started.current = true;
    trackOnboarding('onboarding_started', { diagnosticId });
  }, [diagnosticId]);

  useEffect(() => {
    if (!diagnosticId) return;
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [diagnosticId]);

  useEffect(() => {
    if (!diagnosticId) return;
    const id = diagnosticId;
    const poll = async () => {
      try {
        const data = await publicDiagnosticApi.get(id, tierQParam === 'gold' ? 'gold' : undefined);
        setDiagnostic(data);
        if (isReportReadyForRedirect(data)) {
          setHandoff('preview');
          return false;
        }
        if (data.status === 'failed') return false;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar el diagnóstico');
        return false;
      }
      return true;
    };
    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      const keep = await poll();
      if (!keep) clearInterval(interval);
    }, 1500);
    poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [diagnosticId, tierQParam]);

  useEffect(() => {
    if (handoff !== 'preview' || !diagnosticId) return;
    setOverlay({ type: 'idle' });
    trackOnboarding('onboarding_preview_viewed', { diagnosticId });
    const t = setTimeout(() => {
      setHandoff('leaving');
      const tierQ = diagnostic?.tier === 'gold' ? '&tier=gold' : '';
      trackOnboarding('onboarding_report_opened', { diagnosticId });
      router.replace(`/ver-resultado?diagnosticId=${diagnosticId}${tierQ}`);
    }, 3000);
    return () => clearTimeout(t);
  }, [handoff, diagnosticId, router, diagnostic?.tier]);

  useEffect(() => {
    const h = () => {
      if (!diagnosticId || handoff === 'leaving' || handoff === 'preview') return;
      if (document.visibilityState === 'hidden' && !abandonedTracked.current) {
        abandonedTracked.current = true;
        const steps = diagnostic?.steps ?? [];
        const idx = steps.findIndex((s) => !s.completed);
        lastStepForAbandon({
          diagnosticId,
          phase: 'onboarding',
          stepIndex: idx < 0 ? 10 : idx,
        });
        trackOnboarding('onboarding_abandon', { diagnosticId });
      }
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [diagnosticId, diagnostic?.steps, handoff]);

  useEffect(() => {
    if (!captchaVerified) return;
    if (progress >= 60 && !emailSectionVisible && !emailSent) {
      setEmailSectionVisible(true);
      if (diagnosticId) trackOnboarding('onboarding_unlock_viewed', { diagnosticId });
    }
  }, [captchaVerified, progress, emailSectionVisible, emailSent, diagnosticId]);

  useEffect(() => {
    if (!captchaVerified) return;
    if (diagnostic?.status === 'completed' || handoff !== 'no') return;
    if (isBlockingOverlay(overlay)) return;

    if (pipeline === 0 && activeIndex >= 1) {
      setOverlay({ type: 'quiz1' });
    } else if (pipeline === 1 && activeIndex >= 2) {
      if (diagnosticId) trackOnboarding('onboarding_insight_shown', { step: '2' });
      setOverlay({ type: 'insight', stepIndex: 2, ctx });
    } else if (pipeline === 2) {
      setOverlay({ type: 'social' });
    } else if (pipeline === 3 && activeIndex >= 4) {
      setOverlay({ type: 'quiz2' });
    } else if (pipeline === 4 && activeIndex >= 5) {
      if (diagnosticId) trackOnboarding('onboarding_insight_shown', { step: '5' });
      setOverlay({ type: 'insight', stepIndex: 5, ctx });
    } else if (pipeline === 5 && activeIndex >= 7) {
      setOverlay({ type: 'prediction' });
    } else if (pipeline === 6 && activeIndex >= 8) {
      if (diagnosticId) trackOnboarding('onboarding_insight_shown', { step: '8' });
      setOverlay({ type: 'insight', stepIndex: 8, ctx });
    } else if (pipeline === 7) {
      setOverlay({ type: 'social2' });
    }
  }, [captchaVerified, activeIndex, pipeline, overlay, diagnostic?.status, ctx, handoff, diagnosticId]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosticId || !email.trim()) return;
    if (!captchaVerified) {
      setCaptchaPopupOpen(true);
      return;
    }
    setEmailLoading(true);
    setEmailErrorCode(undefined);
    try {
      const res = await publicDiagnosticApi.setEmail(diagnosticId, email.trim());
      setEmailSent(true);
      trackOnboarding('onboarding_email_submitted', { diagnosticId, emailSent: String(!!res.emailSent) });
      if (res.emailSent === false) {
        setEmailSendFailed(true);
        if (res.emailError) setEmailErrorCode(res.emailError);
        trackOnboarding('onboarding_email_failed', { diagnosticId, code: res.emailError ?? 'unknown' });
      }
    } catch {
      setEmailSendFailed(true);
      trackOnboarding('onboarding_email_failed', { diagnosticId, code: 'throw' });
    } finally {
      setEmailLoading(false);
    }
  };

  const waitingSecondModel =
    diagnostic?.status === 'completed' &&
    !!diagnostic.showFullReport &&
    !!diagnostic.runGeminiId &&
    !diagnostic.runResultGemini &&
    diagnostic.geminiRunStatus !== 'failed';
  const waitingConsolidation =
    diagnostic?.status === 'completed' &&
    !!diagnostic.showFullReport &&
    diagnostic.analysisJson == null;
  const waitingFinalReady = waitingSecondModel || waitingConsolidation;

  if (!diagnosticId) {
    return (
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Faltan datos del diagnóstico.</p>
          <Link href="/diagnostico/crear">
            <Button variant="outline" size="sm">Volver al diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-[calc(100vh-72px)] flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="text-sm text-destructive">{error}</p>
          <Link href="/diagnostico/crear">
            <Button variant="outline" size="sm">Volver al diagnóstico</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (handoff === 'preview' || handoff === 'leaving') {
    return (
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
            {handoff === 'leaving' ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            ) : (
              <Sparkles className="h-6 w-6 text-primary-600" />
            )}
          </div>
          <p className="text-lg font-bold text-slate-900">Tu informe está listo</p>
          <p className="mt-2 text-sm text-slate-600">
            {brandLabel
              ? `Abrimos el análisis completo de ${brandLabel}: score, intención y posición frente a la competencia.`
              : 'Abrimos el análisis con tu score y comparativa con la competencia.'}
          </p>
          {handoff === 'leaving' && <p className="mt-4 text-xs text-slate-500">Redirigiendo…</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col min-h-0">
        <div className="mb-4 shrink-0 sm:mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">Análisis en curso</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            {brandLabel ? `Construyendo tu análisis de ${brandLabel}` : 'Construyendo tu análisis'}
          </h1>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr,1.15fr] lg:gap-8">
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-1.5 w-full overflow-hidden bg-slate-100">
                <div
                  className="h-full bg-primary-600 transition-all duration-700 ease-out"
                  style={{ width: `${captchaVerified ? barPct : 0}%` }}
                />
              </div>
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Construyendo tu Cleexs Score: {completedCount}/{ONBOARDING_STEP_LABELS.length} completado
                </p>
                {captchaVerified ? (
                  <>
                    <p className="mt-2 text-sm font-bold leading-snug text-slate-900">Paso {activeIndex + 1} de 11</p>
                    <p className="mt-1.5 min-h-[2.75rem] text-sm text-slate-600">{currentLabel}</p>
                    {isRunning && allStepsDone && (
                      <p className="mt-2 text-xs text-primary-800">
                        {isFinalizing
                          ? 'Checks listos. Consolidando tu Cleexs Score y el informe final…'
                          : ''}
                      </p>
                    )}
                    {waitingFinalReady && (
                      <p className="mt-2 rounded-lg border border-primary-200 bg-primary-50 p-2 text-xs text-primary-800">
                        {waitingSecondModel
                          ? 'Score base listo. Terminando el segundo modelo (Gemini) para habilitar consolidado…'
                          : 'Score base listo. Cerrando consolidado técnico del informe…'}
                      </p>
                    )}
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {ONBOARDING_STEP_LABELS.map((_, i) => {
                        const done = stepsList[i]?.completed === true;
                        const isActive = i === activeIndex && !done;
                        return (
                          <li
                            key={i}
                            className={cn(
                              'h-1.5 w-6 rounded-full',
                              done ? 'bg-primary-500' : isActive ? 'bg-primary-200' : 'bg-slate-100'
                            )}
                            title={`Paso ${i + 1}`}
                          />
                        );
                      })}
                    </ul>
                    <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <span>
                        {isRunning ? (isFinalizing ? 'Preparando informe' : 'En curso') : 'Preparando…'}
                        {' · '}
                        {formatElapsed(elapsedSeconds)}
                      </span>
                    </div>
                    {isRunning && elapsedSeconds >= 360 && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        Tarda más de lo usual. Si no avanzá, podés crear un diagnóstico más tarde.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Confirmá que sos humano en la ventana a la derecha. Ahí
                    arranca el análisis visual y el progreso.</p>
                )}
              </div>
            </div>
          </div>

          <div className="relative flex min-h-0 min-w-0 flex-col">
            {HERO.map((src, i) => (
              <div
                key={src}
                aria-hidden
                className={cn(
                  'pointer-events-none absolute inset-0 z-0 bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out',
                  heroIdx === i ? 'opacity-25' : 'opacity-0'
                )}
                style={{ backgroundImage: `url('${src}')`, backgroundSize: '60% auto' }}
              />
            ))}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white/55 via-white/20 to-white/50"
            />

            <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3">
              <OnboardingRightStage
                stepIndex={activeIndex}
                brandName={brandLabel}
                domainShort={domainShort}
                pulseKey={visualBoost}
                className="shrink-0"
              />
              {captchaVerified && isBlockingOverlay(overlay) && (
                <OnboardingMomentStack
                  className="flex-1"
                  moment={overlay as MomentKind}
                  onClose={overlay.type === 'insight' ? onInsightClose : onSocialClose}
                  onQuiz1={onQuiz1}
                  onQuiz2={onQuiz2}
                  onPredict={onPredict}
                  industry={industry}
                />
              )}

              {captchaVerified && emailSectionVisible && !emailSent && (
                <div className="overflow-hidden rounded-xl border border-violet-200/90 bg-violet-50/60 p-4 shadow-sm ring-1 ring-violet-200/30">
                  <p className="text-sm font-bold text-violet-900">Desbloqueá el envío a tu mail</p>
                  <p className="mt-0.5 text-xs text-violet-800/90">
                    Recibí un aviso y el resumen de tu análisis cuando cierre. Sin spam.
                  </p>
                  <form onSubmit={handleEmailSubmit} className="mt-2 flex flex-col gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-sm"
                      placeholder="correo@empresa.com"
                    />
                    <Button type="submit" size="sm" disabled={emailLoading || !email.trim()} className="w-full">
                      {emailLoading ? 'Guardando…' : 'Enviar'}
                    </Button>
                  </form>
                </div>
              )}

              {captchaVerified && emailSectionVisible && emailSent && (
                <div className="rounded-xl border border-slate-200 bg-white p-3 text-center text-sm text-slate-600">
                  {emailSendFailed ? (
                    <p className="text-xs text-amber-800">
                      Guardamos tu email. Si no te llega el aviso, revisá spam o escribinos.
                      {emailErrorCode === 'provider_rejected' && (
                        <span>
                          {' '}
                          <a href="https://resend.com/domains" className="underline" target="_blank" rel="noreferrer">
                            Verificar dominio
                          </a>
                        </span>
                      )}
                    </p>
                  ) : (
                    <p>Email guardado. Te avisamos cuando cierre el análisis.</p>
                  )}
                </div>
              )}

              {captchaVerified && !emailSectionVisible && !emailSent && progress >= 45 && (
                <p className="text-center text-[10px] text-slate-500">El correo se habilita al 60% del progreso.</p>
              )}
            </div>
          </div>
        </div>

        {captchaPopupOpen && !captchaVerified && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center">
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
              role="dialog"
              aria-modal
              aria-labelledby="captcha-title"
            >
              <div className="text-center">
                <Lock className="mx-auto mb-3 h-7 w-7 text-slate-300" />
                <h2 id="captcha-title" className="text-lg font-bold text-slate-900">
                  Confirmá que sos humano y empezamos
                </h2>
                <p className="mt-1.5 text-sm text-slate-600">
                  Con un click activamos el análisis en vivo de tu sitio. Después vas a ver el progreso paso a paso
                  hasta tu Cleexs Score.
                </p>
              </div>
              <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  checked={captchaVerified}
                  onChange={(e) => {
                    if (!e.target.checked) return;
                    setCaptchaVerified(true);
                    setCaptchaPopupOpen(false);
                    if (diagnosticId) {
                      trackOnboarding('onboarding_captcha_completed', { diagnosticId });
                    }
                  }}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-slate-800">No soy un robot</span>
              </label>
              <p className="mt-3 text-center text-[11px] text-slate-500">
                Acepto{' '}
                <a href="/terminos" className="underline">Términos</a> y{' '}
                <a href="/privacidad" className="underline">Privacidad</a>.
              </p>
            </div>
          </div>
        )}

        <p className="mt-4 shrink-0 text-center text-xs text-slate-500">
          El análisis suele tardar entre 30 y 90 segundos. Podés dejarlo abierto: el progreso sigue y te llevamos al
          informe.
        </p>
      </div>
    </main>
  );
}

export default function VerificandoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-72px)] flex items-center justify-center">
          <PulsingDots />
        </main>
      }
    >
      <VerificandoContent />
    </Suspense>
  );
}
