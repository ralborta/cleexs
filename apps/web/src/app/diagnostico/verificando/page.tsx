'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import { getOrCreateCleexsVisitorId } from '@/lib/cleexs-visitor-id';
import { ArrowLeft, Boxes, Globe, Loader2, Lock, Mail, Pencil, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OnboardingRightStage } from '@/components/diagnostico/onboarding-right-stage';
import { ONBOARDING_STEP_LABELS, saveOnboardingSnapshot, type SitePreviewContext } from './diagnostic-onboarding';
import { lastStepForAbandon, trackOnboarding } from './onboarding-analytics';
import { OnboardingMomentStack, type MomentKind } from './onboarding-moments';
import { AnalysisStepsGrid, type AnalysisStepItem } from './analysis-steps-grid';

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
const ANALYSIS_STEP_CARD_LABELS = [
  'Verificando acceso de IA al sitio',
  'Analizando orden para IA',
  'Midiendo claridad de respuesta',
  'Evaluando autoridad real',
  'Chequeando idioma para IA',
  'Revisando actualización de info',
  'Detectando confianza real',
  'Testeando carga y funcionamiento',
  'Rastreando menciones externas',
  'Midiendo intención cubierta',
  'Evaluando comprensión por IA',
] as const;

type OverlayMoment = Extract<MomentKind, { type: 'quiz1' } | { type: 'quiz2' } | { type: 'insight' } | { type: 'social' } | { type: 'social2' } | { type: 'prediction' }> | { type: 'idle' };

function isBlockingOverlay(m: OverlayMoment): m is Extract<OverlayMoment, { type: Exclude<OverlayMoment['type'], 'idle'> }> {
  return m.type !== 'idle';
}

function fiveUrlsFromDraft(draft: PublicDiagnostic['setupDraft']): string[] {
  const raw = draft?.suggestedCompetitorUrls ?? [];
  const out = raw.map((u) => String(u).trim());
  while (out.length < 5) out.push('');
  return out.slice(0, 5);
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

  const [setupHumanOk, setSetupHumanOk] = useState(false);
  const [setupEmail, setSetupEmail] = useState('');
  const [competitorUrls, setCompetitorUrls] = useState<string[]>(['', '', '', '', '']);
  const [legacySetupHumanOk, setLegacySetupHumanOk] = useState(false);
  const [startAnalysisLoading, setStartAnalysisLoading] = useState(false);
  const [startAnalysisError, setStartAnalysisError] = useState<string | null>(null);
  /** Setup público (awaiting_user): 1 captcha → 2 email → 3 competidores */
  const [publicSetupStep, setPublicSetupStep] = useState<1 | 2 | 3>(1);
  /** Modal legacy (running sin email): 1 captcha → 2 email */
  const [legacyPublicStep, setLegacyPublicStep] = useState<1 | 2>(1);
  const setupWizardInitRef = useRef<string | null>(null);
  /** Nodo al final de `document.body` para que los modales queden por encima del resto del DOM. */
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const [heroIdx, setHeroIdx] = useState(0);
  useLayoutEffect(() => {
    const el = document.createElement('div');
    el.setAttribute('data-cleexs-diagnostico-portal', 'true');
    document.body.appendChild(el);
    setPortalRoot(el);
    return () => {
      el.remove();
      setPortalRoot(null);
    };
  }, []);
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
  const [visibleStepCards, setVisibleStepCards] = useState(3);
  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  const started = useRef(false);
  const abandonedTracked = useRef(false);
  const waitingCompletedSinceRef = useRef<number | null>(null);

  const stepsList = diagnostic?.steps ?? [];
  const normalizedDiagnosticStatus = String(diagnostic?.status ?? '').trim().toLowerCase();
  const isPreRunBackdrop =
    normalizedDiagnosticStatus === 'awaiting_user' ||
    normalizedDiagnosticStatus === 'detecting_competitors';
  const analysisRunningPhase =
    normalizedDiagnosticStatus === 'running' ||
    normalizedDiagnosticStatus === 'completed' ||
    normalizedDiagnosticStatus === 'failed';

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
  const currentCardLabel = ANALYSIS_STEP_CARD_LABELS[activeIndex] ?? currentLabel;
  const progress = diagnostic?.progressPercent ?? 0;
  const brandLabel = diagnostic?.brandName ?? null;
  const domain = diagnostic?.domain ?? '';
  const domainShort = (domain || '').replace(/^https?:\/\//, '');
  const isRunning = normalizedDiagnosticStatus === 'running';
  const allStepsDone = stepsList.length > 0 && stepsList.every((s) => s.completed);
  const isFinalizing = isRunning && allStepsDone;
  const finalizingWave = 92 + ((elapsedSeconds % 7) / 6) * 6;
  const barPct = isFinalizing ? finalizingWave : Math.min(progress, 100);
  const displayActiveIndex = isPreRunBackdrop ? Math.min(10, ONBOARDING_STEP_LABELS.length - 1) : activeIndex;
  const displayCardLabel =
    isPreRunBackdrop
      ? ANALYSIS_STEP_CARD_LABELS[Math.min(10, ANALYSIS_STEP_CARD_LABELS.length - 1)] ?? ''
      : ANALYSIS_STEP_CARD_LABELS[activeIndex] ?? currentLabel;
  const displayCompletedCount = isPreRunBackdrop ? ONBOARDING_STEP_LABELS.length : completedCount;
  const displayBarPct = isPreRunBackdrop ? 91 : barPct;
  const diagnosticEmailTrimmed = diagnostic?.email?.trim() ?? '';
  const hasServerEmailAfterStart = isRunning && Boolean(diagnosticEmailTrimmed);
  const needsLegacyEmailCaptchaModal =
    isRunning && !diagnosticEmailTrimmed && !captchaVerified;
  const displayCaptchaVerified =
    captchaVerified || isPreRunBackdrop || hasServerEmailAfterStart;
  const ctx: SitePreviewContext = useMemo(
    () => ({
      brandName: brandLabel,
      domain: domain || '',
    }),
    [brandLabel, domain]
  );
  const showLegacyEmail =
    analysisRunningPhase &&
    captchaVerified &&
    !!diagnostic &&
    !diagnosticEmailTrimmed &&
    progress >= 50;

  const activeStepForCards = useMemo(() => {
    if (isPreRunBackdrop) return Math.min(10, ANALYSIS_STEP_CARD_LABELS.length - 1);
    const firstPending = stepsList.findIndex((s) => !s.completed);
    if (firstPending >= 0) return firstPending;
    if (normalizedDiagnosticStatus === 'running') return ANALYSIS_STEP_CARD_LABELS.length - 1;
    return Math.max(activeIndex, 0);
  }, [stepsList, normalizedDiagnosticStatus, activeIndex, isPreRunBackdrop]);

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

  // Solo saltar el captcha del onboarding clásico cuando el análisis ya arrancó CON email
  // (flujo nuevo POST /start). Si está `running` sin email, el usuario debe ver el modal.
  useEffect(() => {
    const em = diagnostic?.email?.trim();
    if (diagnostic?.status !== 'running' || !em) return;
    setCaptchaVerified(true);
  }, [diagnostic?.status, diagnostic?.email]);

  useEffect(() => {
    setupWizardInitRef.current = null;
    setLegacySetupHumanOk(false);
    setPublicSetupStep(1);
    setLegacyPublicStep(1);
  }, [diagnosticId]);

  useEffect(() => {
    if (normalizedDiagnosticStatus !== 'awaiting_user') return;
    const d = diagnostic;
    if (!d?.id) return;
    if (setupWizardInitRef.current === d.id) return;
    setupWizardInitRef.current = d.id;
    setPublicSetupStep(1);
    setSetupHumanOk(false);
    setSetupEmail('');
    setCompetitorUrls(fiveUrlsFromDraft(d.setupDraft));
    setStartAnalysisError(null);
    // Solo al entrar en awaiting_user para este id; no incluir setupDraft en deps para no pisar URLs en cada poll.
  }, [normalizedDiagnosticStatus, diagnostic?.id]);

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
          waitingCompletedSinceRef.current = null;
          setHandoff('preview');
          return false;
        }
        if (data.status === 'completed' && data.runResult) {
          if (!waitingCompletedSinceRef.current) {
            waitingCompletedSinceRef.current = Date.now();
          }
          const waitedMs = Date.now() - waitingCompletedSinceRef.current;
          if (waitedMs >= 60_000) {
            setHandoff('preview');
            return false;
          }
        } else {
          waitingCompletedSinceRef.current = null;
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
    if (!analysisRunningPhase) return;
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
  }, [
    analysisRunningPhase,
    captchaVerified,
    activeIndex,
    pipeline,
    overlay,
    diagnostic?.status,
    ctx,
    handoff,
    diagnosticId,
  ]);

  useEffect(() => {
    const targetVisible = Math.min(ANALYSIS_STEP_CARD_LABELS.length, Math.max(3, activeStepForCards + 2));
    if (visibleStepCards >= targetVisible) return;
    const t = setTimeout(() => setVisibleStepCards((n) => Math.min(targetVisible, n + 1)), 120);
    return () => clearTimeout(t);
  }, [activeStepForCards, visibleStepCards]);

  const handlePublicSetupStep1Next = useCallback(() => {
    if (!setupHumanOk) return;
    if (diagnosticId) trackOnboarding('onboarding_captcha_completed', { diagnosticId });
    setStartAnalysisError(null);
    setPublicSetupStep(2);
  }, [setupHumanOk, diagnosticId]);

  const handlePublicSetupStep2Next = useCallback(() => {
    const em = setupEmail.trim();
    if (!em.includes('@')) {
      setStartAnalysisError('Ingresá un correo válido.');
      return;
    }
    setStartAnalysisError(null);
    setPublicSetupStep(3);
  }, [setupEmail]);

  const handleLegacyStep1Next = useCallback(() => {
    if (!legacySetupHumanOk) return;
    if (diagnosticId) trackOnboarding('onboarding_captcha_completed', { diagnosticId });
    setLegacyPublicStep(2);
  }, [legacySetupHumanOk, diagnosticId]);

  const handleSetupStartAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosticId || !diagnostic) return;
    setStartAnalysisError(null);
    const trimmed = competitorUrls.map((u) => u.trim());
    if (trimmed.some((u) => !u)) {
      setStartAnalysisError('Completá las 5 URLs de competidores.');
      return;
    }
    if (!setupHumanOk) {
      setStartAnalysisError('Confirmá que no sos un robot.');
      return;
    }
    const em = setupEmail.trim();
    if (!em.includes('@')) {
      setStartAnalysisError('Ingresá un correo válido.');
      return;
    }
    setStartAnalysisLoading(true);
    try {
      const vid = getOrCreateCleexsVisitorId();
      await publicDiagnosticApi.start(
        diagnosticId,
        {
          email: em,
          competitorUrls: trimmed,
          ...(typeof diagnostic.setupDraft?.useSerp === 'boolean'
            ? { useSerp: diagnostic.setupDraft.useSerp }
            : {}),
        },
        { visitorId: vid }
      );
      trackOnboarding('onboarding_setup_completed', { diagnosticId });
      setCaptchaVerified(true);
      const data = await publicDiagnosticApi.get(diagnosticId, tierQParam === 'gold' ? 'gold' : undefined);
      setDiagnostic(data);
    } catch (err) {
      setStartAnalysisError(err instanceof Error ? err.message : 'No se pudo iniciar el análisis.');
    } finally {
      setStartAnalysisLoading(false);
    }
  };

  const handleLegacySetupSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosticId) return;
    if (!legacySetupHumanOk) return;
    if (!email.trim().includes('@')) return;
    setEmailLoading(true);
    setEmailErrorCode(undefined);
    try {
      const res = await publicDiagnosticApi.setEmail(diagnosticId, email.trim());
      setEmailSent(true);
      setCaptchaVerified(true);
      trackOnboarding('onboarding_captcha_completed', { diagnosticId });
      trackOnboarding('onboarding_email_submitted', { diagnosticId, emailSent: String(!!res.emailSent) });
      if (res.emailSent === false) {
        setEmailSendFailed(true);
        if (res.emailError) setEmailErrorCode(res.emailError);
        trackOnboarding('onboarding_email_failed', { diagnosticId, code: res.emailError ?? 'unknown' });
      }
      const data = await publicDiagnosticApi.get(diagnosticId, tierQParam === 'gold' ? 'gold' : undefined);
      setDiagnostic(data);
    } catch {
      setEmailSendFailed(true);
      trackOnboarding('onboarding_email_failed', { diagnosticId, code: 'throw' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!diagnosticId || !email.trim()) return;
    if (!captchaVerified) return;
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
  const analysisSteps: AnalysisStepItem[] = ANALYSIS_STEP_CARD_LABELS.map((label, i) => {
    if (isPreRunBackdrop) {
      const isCompleted = i < 10;
      const isActive = i === 10;
      const state: AnalysisStepItem['state'] = isCompleted ? 'completed' : isActive ? 'active' : 'pending';
      return {
        id: i + 1,
        label,
        state,
        visible: i < ANALYSIS_STEP_CARD_LABELS.length,
      };
    }
    const completedFromApi = stepsList[i]?.completed === true;
    const isCompleted =
      completedFromApi || (i < activeStepForCards && diagnostic?.status !== 'failed');
    const isActive = !isCompleted && i === activeStepForCards && diagnostic?.status !== 'failed';
    const state: AnalysisStepItem['state'] = isCompleted ? 'completed' : isActive ? 'active' : 'pending';
    return {
      id: i + 1,
      label,
      state,
      visible: i < visibleStepCards,
    };
  });

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

  if (!diagnostic) {
    return (
      <main className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center gap-3 bg-slate-50 px-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" aria-hidden />
        <p className="text-sm text-slate-600">Cargando diagnóstico…</p>
      </main>
    );
  }

  const statusLowerEarly = String(diagnostic.status ?? '').trim().toLowerCase();
  if (statusLowerEarly === 'failed' && !diagnostic.runId) {
    return (
      <main className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center bg-slate-50 px-6 py-10">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-6 text-center shadow-sm">
          <p className="text-lg font-bold text-amber-950">No pudimos preparar el diagnóstico</p>
          <p className="mt-3 text-sm leading-relaxed text-amber-900/95">
            Para abrir las pantallas de verificación necesitamos detectar al menos{' '}
            <strong>tres competidores</strong> automáticamente. Después vos completás la lista hasta{' '}
            <strong>cinco URLs</strong> antes de iniciar el análisis. Acá no alcanzamos el mínimo de sugerencias.
          </p>
          <p className="mt-2 text-sm text-amber-900/85">Probá con otra URL, otra marca o más tarde.</p>
          <Button asChild className="mt-6 rounded-xl">
            <Link href="/diagnostico/crear">Volver al diagnóstico</Link>
          </Button>
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

  const trimmedSetupCompetitorUrls = competitorUrls.map((u) => u.trim());
  const canFinalizePublicSetup =
    setupHumanOk &&
    setupEmail.trim().includes('@') &&
    trimmedSetupCompetitorUrls.length === 5 &&
    trimmedSetupCompetitorUrls.every(Boolean);

  return (
    <main className="relative flex min-h-[calc(100vh-72px)] flex-col bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div
        className={cn(
          'mx-auto flex w-full max-w-5xl flex-1 flex-col min-h-0',
          isPreRunBackdrop && 'pointer-events-none select-none'
        )}
      >
        <div className="mb-4 shrink-0 sm:mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">Análisis en curso</p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">
                {brandLabel ? `Construyendo tu análisis de ${brandLabel}` : 'Construyendo tu análisis'}
              </h1>
            </div>
            <img
              src="/CleexsLogo.png"
              alt="Cleexs"
              className="h-14 w-auto shrink-0 object-contain sm:h-16"
            />
          </div>
        </div>

        <div
          className={cn(
            'grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr,1.15fr] lg:gap-8',
            isPreRunBackdrop && 'pointer-events-none'
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-1.5 w-full overflow-hidden bg-slate-100">
                <div
                  className="h-full bg-primary-600 transition-all duration-700 ease-out"
                  style={{ width: `${displayCaptchaVerified ? displayBarPct : 0}%` }}
                />
              </div>
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Construyendo tu Cleexs Score: {displayCompletedCount}/{ONBOARDING_STEP_LABELS.length} completado
                </p>
                {displayCaptchaVerified ? (
                  <>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold leading-snug text-slate-900">
                          Paso {displayActiveIndex + 1} de 11
                        </p>
                        <p className="mt-1.5 min-h-[2.75rem] text-sm text-slate-600">{displayCardLabel}</p>
                      </div>
                      <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 text-blue-600 shadow-inner">
                        <Boxes className="h-6 w-6" />
                      </span>
                    </div>
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
                    <div className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>
                          {isRunning || isPreRunBackdrop
                            ? isFinalizing
                              ? 'Preparando informe'
                              : 'En proceso'
                            : 'Preparando…'}
                        </span>
                        <span className="font-semibold text-slate-700">
                          {Math.round(displayCaptchaVerified ? displayBarPct : 0)}% · {formatElapsed(elapsedSeconds)}
                        </span>
                      </div>
                    </div>
                    {isRunning && elapsedSeconds >= 360 && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        Tarda más de lo usual. Si no avanzá, podés crear un diagnóstico más tarde.
                      </p>
                    )}
                  </>
                ) : needsLegacyEmailCaptchaModal ? (
                  <p className="mt-2 text-sm text-slate-600">
                    Completá verificación y correo en el formulario que aparece sobre esta pantalla (centro).
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">Confirmá que sos humano en la ventana a la derecha. Ahí
                    arranca el análisis visual y el progreso.</p>
                )}
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <AnalysisStepsGrid steps={analysisSteps} />
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                    En proceso
                  </span>
                  <span className="font-semibold text-slate-700">
                    {Math.round(displayCaptchaVerified ? displayBarPct : 0)}%
                  </span>
                  <span className="text-slate-500">{formatElapsed(elapsedSeconds)}</span>
                </div>
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
                stepIndex={displayActiveIndex}
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
                />
              )}

              {captchaVerified && showLegacyEmail && !emailSent && (
                <div className="overflow-hidden rounded-xl border border-violet-200/90 bg-violet-50/60 p-4 shadow-sm ring-1 ring-violet-200/30">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-violet-200/80">
                      <Mail className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-violet-900">Desbloqueá el envío a tu mail</p>
                      <p className="mt-0.5 text-xs text-violet-800/90">
                        Recibí un aviso y el resumen de tu análisis cuando cierre. Sin spam.
                      </p>
                    </div>
                  </div>
                  <form onSubmit={handleEmailSubmit} className="mt-2 flex flex-col gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-sm"
                      placeholder="correo@empresa.com"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={emailLoading || !email.trim()}
                      className="h-10 w-full rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-md shadow-violet-600/20 hover:from-violet-700 hover:to-indigo-700"
                    >
                      {emailLoading ? 'Guardando…' : 'Enviar'}
                    </Button>
                  </form>
                </div>
              )}

              {captchaVerified && showLegacyEmail && emailSent && (
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

              {captchaVerified && !showLegacyEmail && !emailSent && progress >= 45 && analysisRunningPhase && (
                <p className="text-center text-[10px] text-slate-500">El correo se habilita al 60% del progreso.</p>
              )}
            </div>
          </div>
        </div>

        <p className="mt-4 shrink-0 text-center text-xs text-slate-500">
          El análisis suele tardar entre 30 y 90 segundos. Podés dejarlo abierto: el progreso sigue y te llevamos al
          informe.
        </p>
      </div>

      {portalRoot &&
        normalizedDiagnosticStatus === 'awaiting_user' &&
        createPortal(
        <div
          className="pointer-events-auto fixed inset-0 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-md sm:items-center"
          style={{ zIndex: 2147483000 }}
        >
          <div
            className="relative my-auto w-full max-w-xl rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal
            aria-labelledby="setup-modal-title"
          >
            <button
              type="button"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              onClick={() => router.push('/diagnostico/crear')}
              aria-label="Cerrar y volver al inicio del diagnóstico"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>

            <div className="mb-6 flex gap-2 pr-10" aria-hidden>
              {([1, 2, 3] as const).map((s) => (
                <div
                  key={s}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    publicSetupStep >= s ? 'bg-violet-600' : 'bg-slate-200'
                  )}
                />
              ))}
            </div>

            <div className="flex items-start gap-3 pr-10">
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
                  publicSetupStep === 2
                    ? 'bg-violet-600 text-white ring-violet-700/30'
                    : 'bg-violet-100 text-violet-700 ring-violet-200/60'
                )}
              >
                {publicSetupStep === 1 ? (
                  <Lock className="h-6 w-6" aria-hidden />
                ) : publicSetupStep === 2 ? (
                  <Mail className="h-6 w-6" aria-hidden />
                ) : (
                  <Globe className="h-6 w-6" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                  Paso {publicSetupStep} de 3
                </p>
                <h1 id="setup-modal-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  {publicSetupStep === 1 && 'Confirmá que sos humano y empezamos'}
                  {publicSetupStep === 2 && 'Desbloqueá el envío a tu mail'}
                  {publicSetupStep === 3 && 'Competidores'}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {publicSetupStep === 1 &&
                    'Con un click activamos el análisis en vivo de tu sitio. Después vas a ver el progreso paso a paso hasta tu Cleexs Score.'}
                  {publicSetupStep === 2 &&
                    'Escribí el correo donde querés recibir el aviso cuando el análisis cierre.'}
                  {publicSetupStep === 3 &&
                    'Te sugerimos competidores de tu sector (a veces 3 o 4). Completá o editá hasta cinco URLs válidas; las que falten las cargás vos antes de guardar.'}
                </p>
              </div>
            </div>

            {publicSetupStep === 1 && (
              <section className="mt-8 border-t border-slate-100 pt-8">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <label className="flex cursor-pointer flex-wrap items-center justify-between gap-4">
                    <span className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={setupHumanOk}
                        onChange={(e) => setSetupHumanOk(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-400 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-sm font-medium text-slate-800">No soy un robot</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
                      <span className="h-3.5 w-3.5 rounded-full bg-[#4285F4]" />
                      <span className="h-3.5 w-3.5 rounded-full bg-[#34A853]" />
                      <span className="h-3.5 w-3.5 rounded-full bg-[#FBBC05]" />
                    </span>
                  </label>
                </div>
                <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
                  Al continuar aceptás los{' '}
                  <a href="/terminos" className="text-violet-600 underline hover:text-violet-700">
                    Términos
                  </a>{' '}
                  y la{' '}
                  <a href="/privacidad" className="text-violet-600 underline hover:text-violet-700">
                    Privacidad
                  </a>
                  .
                </p>
                <div className="mt-8 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => router.push('/diagnostico/crear')}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6"
                    disabled={!setupHumanOk}
                    onClick={handlePublicSetupStep1Next}
                  >
                    Continuar
                  </Button>
                </div>
              </section>
            )}

            {publicSetupStep === 2 && (
              <section className="mt-8 border-t border-slate-100 pt-8">
                <div className="rounded-2xl border border-violet-200/90 bg-gradient-to-b from-violet-50/95 via-white to-white p-5 shadow-sm ring-1 ring-violet-100/80">
                  <input
                    type="email"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    className="w-full rounded-xl border border-violet-200/90 bg-white py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-violet-500/15 focus:border-violet-400 focus:ring-2"
                    placeholder="correo@empresa.com"
                    autoComplete="email"
                  />
                </div>
                {startAnalysisError && publicSetupStep === 2 && (
                  <p className="mt-3 text-sm text-red-600" role="alert">
                    {startAnalysisError}
                  </p>
                )}
                <div className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1 rounded-xl text-slate-700"
                    onClick={() => {
                      setStartAnalysisError(null);
                      setPublicSetupStep(1);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Atrás
                  </Button>
                  <Button
                    type="button"
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6"
                    onClick={handlePublicSetupStep2Next}
                  >
                    Continuar
                  </Button>
                </div>
              </section>
            )}

            {publicSetupStep === 3 && (
              <form onSubmit={handleSetupStartAnalysis}>
                <section className="mt-8 border-t border-slate-100 pt-8">
                  <div className="mt-4 space-y-2.5">
                    {competitorUrls.map((val, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 px-2 py-1.5 sm:gap-3"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold tabular-nums text-slate-500 ring-1 ring-slate-200/80">
                          {idx + 1}
                        </span>
                        <Globe className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" aria-hidden />
                        <input
                          type="text"
                          inputMode="url"
                          id={`comp-url-${idx}`}
                          value={val}
                          onChange={(e) => {
                            const next = [...competitorUrls];
                            next[idx] = e.target.value;
                            setCompetitorUrls(next);
                          }}
                          className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0"
                          placeholder="https://competidor.com"
                        />
                        <button
                          type="button"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-violet-600 transition hover:bg-violet-50"
                          aria-label={`Editar URL ${idx + 1}`}
                          onClick={() => {
                            document.getElementById(`comp-url-${idx}`)?.focus();
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...competitorUrls];
                            next[idx] = '';
                            setCompetitorUrls(next);
                          }}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50"
                          aria-label={`Quitar competidor ${idx + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setCompetitorUrls(fiveUrlsFromDraft(diagnostic.setupDraft));
                      }}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700"
                    >
                      <Plus className="h-4 w-4" />
                      Restaurar sugeridos
                    </button>
                  </div>
                </section>

                {startAnalysisError && (
                  <p className="mt-4 text-sm text-red-600" role="alert">
                    {startAnalysisError}
                  </p>
                )}

                <div className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-6">
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-1 rounded-xl text-slate-700"
                    onClick={() => {
                      setStartAnalysisError(null);
                      setPublicSetupStep(2);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Atrás
                  </Button>
                  <Button
                    type="submit"
                    disabled={!canFinalizePublicSetup || startAnalysisLoading}
                    className="h-11 gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 text-sm font-semibold text-white shadow-md shadow-violet-600/25 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40"
                  >
                    <Save className="h-4 w-4" />
                    {startAnalysisLoading ? 'Guardando…' : 'Guardar'}
                  </Button>
                </div>

                <p className="mt-6 text-center text-[11px] text-slate-500">
                  Al guardar aceptás los{' '}
                  <a href="/terminos" className="text-violet-600 underline hover:text-violet-700">
                    Términos
                  </a>{' '}
                  y la{' '}
                  <a href="/privacidad" className="text-violet-600 underline hover:text-violet-700">
                    Privacidad
                  </a>
                  .
                </p>
              </form>
            )}
          </div>
        </div>,
        portalRoot
        )}

      {portalRoot &&
        normalizedDiagnosticStatus === 'detecting_competitors' &&
        createPortal(
        <div
          className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-md"
          style={{ zIndex: 2147483000 }}
        >
          <div className="flex max-w-sm flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" aria-hidden />
            <p className="mt-4 text-center text-lg font-semibold text-slate-900">Detectando competidores</p>
            <p className="mt-2 text-center text-sm text-slate-600">
              Buscamos competidores de tu sector (mínimo unas pocas sugerencias). Después podés completar la lista
              hasta cinco en el siguiente paso. Suele tardar unos segundos.
            </p>
          </div>
        </div>,
        portalRoot
        )}

      {portalRoot &&
        needsLegacyEmailCaptchaModal &&
        createPortal(
        <div
          className="pointer-events-auto fixed inset-0 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-sm sm:items-center"
          style={{ zIndex: 2147483000 }}
        >
          {legacyPublicStep === 1 ? (
            <div
              className="my-auto w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl sm:p-8"
              role="dialog"
              aria-modal
              aria-labelledby="legacy-setup-title"
            >
              <div className="flex flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200/80">
                  <Lock className="h-6 w-6" aria-hidden />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-violet-600">Paso 1 de 2</p>
                <h1 id="legacy-setup-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Confirmá que sos humano y seguimos
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Necesitamos tu correo para enviarte el informe. Primero confirmá que sos una persona.
                </p>
              </div>
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <label className="flex cursor-pointer flex-wrap items-center justify-between gap-4">
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={legacySetupHumanOk}
                      onChange={(e) => setLegacySetupHumanOk(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-400 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-sm font-medium text-slate-800">No soy un robot</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5" aria-hidden>
                    <span className="h-3.5 w-3.5 rounded-full bg-[#4285F4]" />
                    <span className="h-3.5 w-3.5 rounded-full bg-[#34A853]" />
                    <span className="h-3.5 w-3.5 rounded-full bg-[#FBBC05]" />
                  </span>
                </label>
              </div>
              <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
                Al continuar aceptás los{' '}
                <a href="/terminos" className="text-violet-600 underline hover:text-violet-700">
                  Términos
                </a>{' '}
                y la{' '}
                <a href="/privacidad" className="text-violet-600 underline hover:text-violet-700">
                  Privacidad
                </a>
                .
              </p>
              <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                <Button
                  type="button"
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8"
                  disabled={!legacySetupHumanOk}
                  onClick={handleLegacyStep1Next}
                >
                  Continuar
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleLegacySetupSave}
              className="my-auto w-full max-w-xl rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl sm:p-8"
              role="dialog"
              aria-modal
              aria-labelledby="legacy-email-title"
            >
              <div className="flex flex-col items-center text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-white shadow-md shadow-violet-600/25">
                  <Mail className="h-5 w-5" aria-hidden />
                </span>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-violet-600">Paso 2 de 2</p>
                <h1 id="legacy-email-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Desbloqueá el envío a tu mail
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Recibí un aviso y el resumen de tu análisis cuando cierre. Sin spam.
                </p>
              </div>
              <div className="mt-6 rounded-2xl border border-violet-200/90 bg-gradient-to-b from-violet-50/95 via-white to-white p-5 shadow-sm ring-1 ring-violet-100/80">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-violet-200/90 bg-white py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-violet-500/15 focus:border-violet-400 focus:ring-2"
                  placeholder="correo@empresa.com"
                  autoComplete="email"
                />
              </div>
              <div className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1 rounded-xl"
                  onClick={() => setLegacyPublicStep(1)}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Atrás
                </Button>
                <Button
                  type="submit"
                  disabled={emailLoading || !legacySetupHumanOk || !email.trim().includes('@')}
                  className="h-11 gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 text-sm font-semibold text-white shadow-md shadow-violet-600/25 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40"
                >
                  <Save className="h-4 w-4" />
                  {emailLoading ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
              <p className="mt-6 text-center text-[11px] text-slate-500">
                Al guardar aceptás los{' '}
                <a href="/terminos" className="text-violet-600 underline hover:text-violet-700">
                  Términos
                </a>{' '}
                y la{' '}
                <a href="/privacidad" className="text-violet-600 underline hover:text-violet-700">
                  Privacidad
                </a>
                .
              </p>
            </form>
          )}
        </div>,
        portalRoot
      )}
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
