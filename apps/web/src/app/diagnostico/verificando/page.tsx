'use client';

import { useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useEffect, useRef, useState } from 'react';
import { publicDiagnosticApi } from '@/lib/api';
import { Check, Mail, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

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

function VerificandoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
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
  /** Al entrar a la página el usuario debe verificar antes de usar el correo. */
  const [captchaPopupOpen, setCaptchaPopupOpen] = useState(true);
  const emailFormRef = useRef<HTMLFormElement>(null);

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
        const data = await publicDiagnosticApi.get(id);
        setDiagnostic(data);
        if (data.status === 'completed') {
          const tierQ = data.tier === 'gold' ? '&tier=gold' : '';
          router.replace(`/ver-resultado?diagnosticId=${id}${tierQ}`);
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
      const keepPolling = await poll();
      if (!keepPolling) clearInterval(interval);
    }, 1500);
    poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [diagnosticId, router]);

  async function handleEmailSubmit(e: React.FormEvent) {
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
      if (res.emailSent === false) {
        setEmailSendFailed(true);
        if (res.emailError) setEmailErrorCode(res.emailError);
      }
    } catch {
      setEmailSendFailed(true);
    } finally {
      setEmailLoading(false);
    }
  }

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

  const steps = diagnostic?.steps ?? [];
  const progress = diagnostic?.progressPercent ?? 0;
  const brandLabel = diagnostic?.brandName ?? null;
  const isRunning = diagnostic?.status === 'running';
  const allStepsCompleted = steps.length > 0 && steps.every((step) => step.completed);
  const isFinalizingReport = isRunning && allStepsCompleted;
  const finalizingWave = 92 + ((elapsedSeconds % 7) / 6) * 6; // 92 → 98 para indicar actividad
  const visibleBottomProgress = isFinalizingReport ? finalizingWave : Math.min(progress, 100);

  return (
    <main className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50 px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col min-h-0">
        {/* Page header */}
        <div className="mb-6 shrink-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 mb-1">Análisis en curso</p>
          <h1 className="text-xl font-bold text-slate-900">
            {brandLabel ? brandLabel : 'Procesando diagnóstico…'}
          </h1>
        </div>

        {/* Dos columnas: pasos arriba/izquierda; correo centrado en el espacio restante (horizontal y vertical) */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8 xl:gap-10">
          {/* Izquierda: lista de pasos (ancho acotado al contenido) */}
          <div className="w-full shrink-0 lg:max-w-[min(100%,18.5rem)] xl:max-w-[20rem] lg:self-start lg:pr-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden w-full">
              <div className="h-0.5 w-full bg-slate-100">
                <div
                  className="h-full bg-primary-600 transition-all duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="p-4 space-y-3">
                <ul className="space-y-0.5">
                  {steps.length > 0 ? (
                    steps.map((step, idx) => {
                      const isActive = !step.completed && steps.findIndex((s) => !s.completed) === idx;
                      return (
                        <li
                          key={step.id}
                          className={`flex items-center gap-2.5 rounded-lg px-2 py-2 transition-all duration-200 ${
                            step.completed
                              ? 'bg-primary-50/60'
                              : isActive
                                ? 'bg-primary-50 border border-primary-100'
                                : ''
                          }`}
                        >
                          <div className="shrink-0 flex h-7 w-7 items-center justify-center">
                            {step.completed ? (
                              <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center">
                                <Check className="h-3.5 w-3.5 text-white stroke-[2.5]" />
                              </div>
                            ) : isActive ? (
                              <div className="h-7 w-7 rounded-full border-2 border-primary-600 bg-white flex items-center justify-center">
                                <PulsingDots />
                              </div>
                            ) : (
                              <div className="h-7 w-7 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center">
                                <span className="text-xs font-medium text-slate-400">{idx + 1}</span>
                              </div>
                            )}
                          </div>
                          <span className={`text-sm leading-snug ${
                            step.completed
                              ? 'text-slate-400 line-through'
                              : isActive
                                ? 'font-semibold text-slate-900'
                                : 'text-slate-400'
                          }`}>
                            {step.label}
                          </span>
                        </li>
                      );
                    })
                  ) : (
                    <li className="flex items-center gap-2.5 rounded-lg px-2 py-2 bg-primary-50 border border-primary-100">
                      <div className="h-7 w-7 rounded-full border-2 border-primary-600 bg-white flex items-center justify-center shrink-0">
                        <PulsingDots />
                      </div>
                      <span className="text-sm font-semibold text-slate-900">Iniciando análisis…</span>
                    </li>
                  )}
                </ul>

                <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    {isRunning ? 'En proceso' : diagnostic?.status === 'completed' ? 'Completado' : 'Preparando'}
                  </span>
                  <div className="flex items-center gap-3">
                    {steps.length > 0 && <span className="font-semibold text-slate-600">{progress}%</span>}
                    <span>{formatElapsed(elapsedSeconds)}</span>
                  </div>
                </div>

                {isRunning && elapsedSeconds >= 360 && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                    Está tardando más de lo habitual. Si el progreso no avanza, intentá crear un nuevo diagnóstico más tarde.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Derecha: correo centrado en el eje vertical y horizontal del área disponible */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl py-4 lg:py-0 lg:pl-8 lg:border-l lg:border-slate-200/80">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 bg-center bg-no-repeat opacity-80"
              style={{
                backgroundImage: "url('/verificando-hero.png')",
                backgroundSize: '70% auto',
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-white/35 via-white/15 to-white/35"
            />
            <div className="relative z-10 w-full max-w-sm">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
                {emailSent ? (
                  emailSendFailed ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-900">Email registrado</p>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        <p>Guardamos tu email pero no pudimos enviar el correo ahora. Cuando el análisis esté listo te lo enviamos.</p>
                        {emailErrorCode === 'provider_rejected' && (
                          <p className="mt-1">
                            Verificá tu dominio en{' '}
                            <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">resend.com/domains</a>.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center flex-1 gap-2 py-4">
                      <div className="h-10 w-10 rounded-full bg-green-50 border border-green-100 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-green-600" />
                      </div>
                      <p className="text-sm font-semibold text-slate-900">¡Listo!</p>
                      <p className="text-xs text-slate-500 max-w-[180px]">
                        Te enviamos el resultado cuando esté listo. Revisá tu bandeja de entrada.
                      </p>
                    </div>
                  )
                ) : (
                  <Fragment>
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-slate-900 mb-0.5">Recibí tu reporte</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Ingresá tu correo y te lo enviamos cuando el análisis esté listo.
                      </p>
                    </div>
                    {!captchaVerified && !captchaPopupOpen && (
                      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                        <p className="font-medium">Verificación pendiente</p>
                        <p className="mt-0.5 text-amber-800/90">
                          Completá la verificación para habilitar el envío por correo.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full border-amber-300 bg-white text-amber-950 hover:bg-amber-50"
                          onClick={() => setCaptchaPopupOpen(true)}
                        >
                          Abrir verificación
                        </Button>
                      </div>
                    )}
                    <form ref={emailFormRef} onSubmit={handleEmailSubmit} className="flex flex-col gap-3 flex-1">
                      <input
                        type="email"
                        placeholder="tu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={emailLoading || !captchaVerified}
                      />
                      <Button
                        type="submit"
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm"
                        disabled={emailLoading || !email.trim() || !captchaVerified}
                      >
                        {emailLoading ? 'Enviando…' : (
                          <Fragment>
                            <Mail className="mr-2 h-3.5 w-3.5" />
                            Enviar reporte
                          </Fragment>
                        )}
                      </Button>
                      <p className="text-xs text-slate-400">
                        Podés enviarlo ahora o esperar al resultado final.
                      </p>
                    </form>
                  </Fragment>
                )}
              </div>

              {captchaPopupOpen && (
                <div
                  className="absolute inset-x-0 -top-8 z-20 px-2"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="captcha-title"
                >
                  <div
                    className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
                  >
                    <div className="flex flex-col items-center text-center">
                      <Lock className="h-8 w-8 text-[#BBBBBB] mb-4" aria-hidden />
                      <h3 id="captcha-title" className="text-2xl font-bold text-[#333333] mb-2">
                        Desbloqueá tu informe gratuito
                      </h3>
                      <p className="text-[15px] text-[#666666] leading-snug mb-6 max-w-sm">
                        Mirá cómo tu marca se posiciona en IA y recibí el resultado por correo.
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#DDDDDD] bg-[#FAFAFA] px-4 py-3 flex items-center justify-between gap-4">
                      <label className="flex cursor-pointer items-center gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={captchaVerified}
                          onChange={(e) => {
                            if (!e.target.checked) return;
                            setCaptchaVerified(true);
                            setCaptchaPopupOpen(false);
                          }}
                          className="h-5 w-5 rounded border-2 border-[#CCCCCC] bg-white text-[#333333] focus:ring-2 focus:ring-[#999999] focus:ring-offset-0"
                          disabled={emailLoading}
                        />
                        <span className="text-base text-[#333333] font-normal">No soy un robot</span>
                      </label>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-sm font-bold text-[#666666]">CAPTCHA</span>
                        <span className="text-xs text-[#999999]">Verificar - Email</span>
                      </div>
                    </div>
                    <p className="mt-5 text-center text-[12px] leading-relaxed text-[#444444] px-1">
                      Al continuar confirmás que entendés y aceptás los{' '}
                      <a href="/terminos" className="underline text-[#333333] hover:text-black">Términos de Servicio</a>
                      {' '}y consentís al uso de tu información según nuestra{' '}
                      <a href="/privacidad" className="underline text-[#333333] hover:text-black">Política de Privacidad</a>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="mt-6 shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {isFinalizingReport ? 'Armando reporte final' : 'Progreso general'}
            </p>
            <span className="text-xs font-semibold text-slate-700">
              {isFinalizingReport ? `${Math.round(visibleBottomProgress)}%` : `${Math.min(progress, 100)}%`}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isFinalizingReport ? 'bg-gradient-to-r from-primary-500 via-primary-400 to-primary-600 animate-pulse' : 'bg-primary-600'
              }`}
              style={{ width: `${visibleBottomProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {isFinalizingReport
              ? 'Los checks terminaron; estamos consolidando y preparando la vista final.'
              : 'Avance visible del diagnóstico en tiempo real.'}
          </p>
        </div>

        <p className="mt-6 shrink-0 text-center text-xs text-slate-400">
          El análisis puede demorar entre 30 y 90 segundos.
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
