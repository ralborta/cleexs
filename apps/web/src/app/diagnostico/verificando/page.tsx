'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import { getOrCreateCleexsVisitorId } from '@/lib/cleexs-visitor-id';
import {
  exitPublicFunnelToMarketingSite,
  usePublicFunnelBackToMarketing,
  useTrapBrowserBack,
} from '@/lib/public-funnel-exit';
import { CLEEXS_FOUNDER_PHOTO_URL, CLEEXS_MARKETING_URL, CLEEXS_ONBOARDING_YOUTUBE_VIDEO_ID } from '@/lib/site';
import { buildOnboardingWhatsAppHref, onboardingWhatsAppDisplayName } from '@/lib/onboarding-whatsapp';
import { ArrowLeft, Boxes, Loader2, Lock, Mail, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  LegalAcceptanceModal,
  type LegalSectionId,
} from '@/components/legal/legal-acceptance-modal';
import { useSmoothProgress } from '@/lib/use-smooth-progress';
import { cn } from '@/lib/utils';
import { OnboardingWizard } from '@/components/diagnostico/onboarding-wizard';
import { defaultLanguageForCountry } from '@/components/diagnostico/onboarding-country-language-fields';
import type { SetupStep } from '@/components/diagnostico/onboarding-setup-wizard';
import { OnboardingPreviewIntro } from '@/components/diagnostico/onboarding-preview/onboarding-preview-intro';
import { OnboardingPreviewHuman } from '@/components/diagnostico/onboarding-preview/onboarding-preview-human';
import { OnboardingPreviewCafecito } from '@/components/diagnostico/onboarding-preview/onboarding-preview-cafecito';
import { OnboardingMobileProgressHeader } from '@/components/diagnostico/onboarding-preview/onboarding-mobile-progress-header';
import { ONBOARDING_STEP_LABELS } from './diagnostic-onboarding';
import { lastStepForAbandon, trackOnboarding } from './onboarding-analytics';
import { AnalysisStepsGrid, type AnalysisStepItem } from './analysis-steps-grid';
import { OnboardingEmailCountdown } from '@/components/diagnostico/onboarding-email-countdown';
import { DiagnosticReportErrorPanel } from '@/components/diagnostico/diagnostic-report-error-panel';
import { diagnosticReportErrorDetail } from '@/lib/diagnostic-report-error';

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

  // En free el texto IA puede llegar unos segundos después; el reporte hace poll.
  if (diagnostic.analysisJson == null) {
    return diagnostic.tier !== 'gold';
  }

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
  const prefilledEmailParam = (searchParams.get('email') ?? '').trim();
  const [diagnostic, setDiagnostic] = useState<Awaited<ReturnType<typeof publicDiagnosticApi.get>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [pollRetryToken, setPollRetryToken] = useState(0);
  const pollFailCountRef = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const runningStartElapsedRef = useRef<number | null>(null);

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
  /** Setup público (awaiting_user): 1 humano → 2 país → 3 rubro → 4 motores → 5 competidores → 6 email */
  const [publicSetupStep, setPublicSetupStep] = useState<SetupStep>(1);
  const [setupCountry, setSetupCountry] = useState('');
  const [setupIndustry, setSetupIndustry] = useState('');
  const [setupLanguage, setSetupLanguage] = useState('');
  const [setupFirstName, setSetupFirstName] = useState('');
  const [setupLastName, setSetupLastName] = useState('');
  const [setupHowFound, setSetupHowFound] = useState('');
  const [setupEngines, setSetupEngines] = useState<string[]>([]);
  const humanVerifiedAtRef = useRef<string | null>(null);
  const [introContinued, setIntroContinued] = useState(false);
  /** Timestamp cuando el backend entra en detecting_competitors (para timeout de UI). */
  const [competitorDetectSince, setCompetitorDetectSince] = useState<number | null>(null);
  const [, setCompetitorDetectTick] = useState(0);
  const [contextLoading, setContextLoading] = useState(false);
  /** True una vez que el usuario confirmó país+rubro (gatilla la detección/progreso). */
  const contextConfirmedRef = useRef(false);
  /** Modal legacy (running sin email): 1 captcha → 2 email */
  const [legacyPublicStep, setLegacyPublicStep] = useState<1 | 2>(1);
  const setupWizardInitRef = useRef<string | null>(null);
  /** True si el usuario editó alguna URL de competidor (no pisar con polls del borrador). */
  const competitorUrlsTouchedRef = useRef(false);
  /** Evita pisar URLs si el usuario ya editó; guardamos JSON de sugeridos para detectar cambios reales del servidor. */
  const lastHydratedSuggestedJsonRef = useRef('');
  /** Nodo al final de `document.body` para que los modales queden por encima del resto del DOM. */
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [legalModalSection, setLegalModalSection] = useState<LegalSectionId | null>(null);
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

  const reportGenerationFailed =
    Boolean(error) || String(diagnostic?.status ?? '').trim().toLowerCase() === 'failed';
  /** Solo en pantalla de error: atrás del navegador → cleexs.net (no `/diagnostico/crear`). */
  usePublicFunnelBackToMarketing(reportGenerationFailed || !diagnosticId);

  const [handoff, setHandoff] = useState<'no' | 'leaving'>('no');
  const [visibleStepCards, setVisibleStepCards] = useState(3);
  /** Avance "fake" del checklist izquierdo durante el setup (uno por uno), independiente del proceso real. */
  const [fakeBackdropStep, setFakeBackdropStep] = useState(0);

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
  const diagnosticEmailTrimmed = diagnostic?.email?.trim() ?? '';
  const hasServerEmailAfterStart = isRunning && Boolean(diagnosticEmailTrimmed);
  const needsLegacyEmailCaptchaModal =
    isRunning && !diagnosticEmailTrimmed && !captchaVerified;
  // El progreso de la izquierda "arranca" recién cuando el usuario confirma país+rubro
  // (captchaVerified) o el análisis ya está corriendo. Antes, invita a confirmar a la derecha.
  const displayCaptchaVerified = captchaVerified || hasServerEmailAfterStart;
  const setupLeftProgress = displayCaptchaVerified || introContinued;
  const backdropStep = Math.min(fakeBackdropStep, ONBOARDING_STEP_LABELS.length - 1);
  // Avance "fake" continuo: corre desde que se confirma país+rubro y NO se reinicia al pasar
  // del onboarding al análisis real; solo se apaga al completarse o fallar.
  const usingFakeProgress =
    setupLeftProgress &&
    normalizedDiagnosticStatus !== 'completed' &&
    normalizedDiagnosticStatus !== 'failed';
  const fakeBarPct = Math.round((backdropStep / ONBOARDING_STEP_LABELS.length) * 100);
  const showFakeSteps = usingFakeProgress && !isRunning;
  const displayActiveIndex = showFakeSteps ? backdropStep : activeIndex;
  const displayCardLabel = showFakeSteps
    ? ANALYSIS_STEP_CARD_LABELS[backdropStep] ?? ''
    : ANALYSIS_STEP_CARD_LABELS[activeIndex] ?? currentLabel;
  const displayCompletedCount = showFakeSteps ? backdropStep : completedCount;

  useEffect(() => {
    if (isRunning && runningStartElapsedRef.current == null) {
      runningStartElapsedRef.current = elapsedSeconds;
    }
    if (!isRunning) runningStartElapsedRef.current = null;
  }, [isRunning, elapsedSeconds]);

  const runningElapsed =
    runningStartElapsedRef.current != null
      ? Math.max(0, elapsedSeconds - runningStartElapsedRef.current)
      : 0;

  const progressTarget = useMemo(() => {
    if (!setupLeftProgress) return 0;
    if (normalizedDiagnosticStatus === 'completed') {
      if (diagnostic && isReportReadyForRedirect(diagnostic)) return 100;
      return 96;
    }
    if (normalizedDiagnosticStatus === 'failed') return 0;

    if (isRunning) {
      if (isFinalizing) return finalizingWave;
      const api = Math.min(progress, 100);
      const fromApi = api <= 18 ? 55 : 55 + ((api - 18) / 82) * 41;
      const fromTime = Math.min(94, 55 + Math.floor(runningElapsed / 4));
      return Math.max(fromApi, fromTime);
    }

    if (usingFakeProgress) return fakeBarPct;

    return Math.min(progress, 100);
  }, [
    setupLeftProgress,
    normalizedDiagnosticStatus,
    isRunning,
    isFinalizing,
    finalizingWave,
    progress,
    runningElapsed,
    usingFakeProgress,
    fakeBarPct,
    diagnostic,
  ]);

  const smoothProgressEnabled =
    setupLeftProgress && normalizedDiagnosticStatus !== 'failed' && handoff === 'no';
  const displayBarPct = useSmoothProgress(progressTarget, smoothProgressEnabled);
  const showLegacyEmail =
    analysisRunningPhase &&
    captchaVerified &&
    !!diagnostic &&
    !diagnosticEmailTrimmed &&
    progress >= 50;

  const setupDataReady = normalizedDiagnosticStatus === 'awaiting_user';

  const showEmailCountdown = useMemo(() => {
    if (handoff !== 'no') return false;
    if (diagnosticEmailTrimmed) return false;
    if (startAnalysisLoading || emailLoading) return false;
    if (isPreRunBackdrop && setupDataReady && publicSetupStep === 6) return true;
    if (needsLegacyEmailCaptchaModal && legacyPublicStep === 2) return true;
    if (showLegacyEmail && !emailSent) return true;
    return false;
  }, [
    handoff,
    diagnosticEmailTrimmed,
    startAnalysisLoading,
    emailLoading,
    isPreRunBackdrop,
    setupDataReady,
    publicSetupStep,
    needsLegacyEmailCaptchaModal,
    legacyPublicStep,
    showLegacyEmail,
    emailSent,
  ]);

  const handleEmailCountdownExpire = useCallback(() => {
    if (diagnosticId) trackOnboarding('onboarding_email_countdown_expired', { diagnosticId });
    exitPublicFunnelToMarketingSite();
  }, [diagnosticId]);

  const handleLegacyOverlayBack = useCallback(() => {
    if (legacyPublicStep === 2) setLegacyPublicStep(1);
  }, [legacyPublicStep]);

  useTrapBrowserBack(needsLegacyEmailCaptchaModal, handleLegacyOverlayBack);

  const activeStepForCards = useMemo(() => {
    if (showFakeSteps) return Math.min(backdropStep, ANALYSIS_STEP_CARD_LABELS.length - 1);
    const firstPending = stepsList.findIndex((s) => !s.completed);
    if (firstPending >= 0) return firstPending;
    if (normalizedDiagnosticStatus === 'running') return ANALYSIS_STEP_CARD_LABELS.length - 1;
    return Math.max(activeIndex, 0);
  }, [stepsList, normalizedDiagnosticStatus, activeIndex, showFakeSteps, backdropStep]);

  // Solo saltar el captcha del onboarding clásico cuando el análisis ya arrancó CON email
  // (flujo nuevo POST /start). Si está `running` sin email, el usuario debe ver el modal.
  useEffect(() => {
    const em = diagnostic?.email?.trim();
    if (diagnostic?.status !== 'running' || !em) return;
    setCaptchaVerified(true);
  }, [diagnostic?.status, diagnostic?.email]);

  useEffect(() => {
    setupWizardInitRef.current = null;
    competitorUrlsTouchedRef.current = false;
    lastHydratedSuggestedJsonRef.current = '';
    setLegacySetupHumanOk(false);
    setPublicSetupStep(1);
    setLegacyPublicStep(1);
    setSetupCountry('');
    setSetupIndustry('');
    setSetupLanguage('');
    setSetupFirstName('');
    setSetupLastName('');
    setSetupHowFound('');
    setSetupEngines([]);
    humanVerifiedAtRef.current = null;
    setIntroContinued(false);
    contextConfirmedRef.current = false;
    runningStartElapsedRef.current = null;
  }, [diagnosticId]);

  // Hidrata país/rubro sugeridos cuando llegan del backend (si el usuario aún no tocó).
  useEffect(() => {
    const draft = diagnostic?.setupDraft;
    if (!draft) return;
    if (contextConfirmedRef.current) return;
    setSetupCountry(
      (prev) => prev || draft.confirmedCountry || draft.suggestedCountry || draft.marketCountry || ''
    );
    setSetupIndustry((prev) => prev || draft.confirmedIndustry || draft.suggestedIndustry || '');
    setSetupLanguage((prev) => prev || draft.selectedLanguage || '');
    setSetupFirstName((prev) => prev || draft.firstName || '');
    setSetupLastName((prev) => prev || draft.lastName || '');
    setSetupHowFound((prev) => prev || draft.howFoundUs || '');
    if (draft.humanVerifiedAt && !humanVerifiedAtRef.current) {
      humanVerifiedAtRef.current = draft.humanVerifiedAt;
    }
  }, [diagnostic?.setupDraft]);

  useEffect(() => {
    if (normalizedDiagnosticStatus === 'detecting_competitors') {
      lastHydratedSuggestedJsonRef.current = '';
    }
  }, [normalizedDiagnosticStatus]);

  useEffect(() => {
    if (normalizedDiagnosticStatus !== 'awaiting_user') return;
    const d = diagnostic;
    if (!d?.id) return;
    if (setupWizardInitRef.current === d.id) return;
    setupWizardInitRef.current = d.id;
    if (!contextConfirmedRef.current) setPublicSetupStep(1);
    setSetupHumanOk(false);
    setSetupEmail(d.email?.trim() || prefilledEmailParam || '');
    setStartAnalysisError(null);
    const draft = d.setupDraft;
    const hydratedCountry =
      draft?.confirmedCountry || draft?.suggestedCountry || draft?.marketCountry || '';
    setSetupCountry((prev) => prev || hydratedCountry);
    setSetupIndustry((prev) => prev || draft?.confirmedIndustry || draft?.suggestedIndustry || '');
    setSetupLanguage(
      (prev) =>
        prev ||
        draft?.selectedLanguage ||
        (hydratedCountry ? defaultLanguageForCountry(hydratedCountry) : '')
    );
    setSetupFirstName((prev) => prev || draft?.firstName || '');
    setSetupLastName((prev) => prev || draft?.lastName || '');
    setSetupHowFound((prev) => prev || draft?.howFoundUs || '');
    if (draft?.humanVerifiedAt) humanVerifiedAtRef.current = draft.humanVerifiedAt;
    if (draft?.selectedEngines?.length) {
      setSetupEngines(draft.selectedEngines.filter(Boolean));
    }
    // Las URLs de competidores las hidrata el efecto que sigue el setupDraft (evita quedar en blanco si el primer poll llega sin borrador).
  }, [normalizedDiagnosticStatus, diagnostic?.id, diagnostic?.setupDraft, diagnostic?.email, prefilledEmailParam]);

  useEffect(() => {
    if (normalizedDiagnosticStatus !== 'awaiting_user') return;
    if (!diagnostic?.id) return;
    const draftUrls = fiveUrlsFromDraft(diagnostic.setupDraft);
    if (!draftUrls.some((u) => u.trim())) return;
    if (competitorUrlsTouchedRef.current) return;
    const suggestedJson = JSON.stringify(diagnostic.setupDraft?.suggestedCompetitorUrls ?? []);
    const uiEmpty = !competitorUrls.some((u) => u.trim());
    if (!uiEmpty && suggestedJson === lastHydratedSuggestedJsonRef.current) return;
    lastHydratedSuggestedJsonRef.current = suggestedJson;
    setCompetitorUrls(draftUrls);
  }, [normalizedDiagnosticStatus, diagnostic?.id, diagnostic?.setupDraft, competitorUrls, publicSetupStep]);

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
    pollFailCountRef.current = 0;
    const poll = async () => {
      try {
        const data = await publicDiagnosticApi.get(id, tierQParam === 'gold' ? 'gold' : undefined);
        pollFailCountRef.current = 0;
        setError(null);
        setDiagnostic(data);
        if (isReportReadyForRedirect(data)) {
          waitingCompletedSinceRef.current = null;
          return true;
        }
        if (data.status === 'completed' && data.runResult) {
          if (!waitingCompletedSinceRef.current) {
            waitingCompletedSinceRef.current = Date.now();
          }
          const waitedMs = Date.now() - waitingCompletedSinceRef.current;
          if (waitedMs >= 60_000) {
            return true;
          }
        } else {
          waitingCompletedSinceRef.current = null;
        }
        if (data.status === 'failed') return false;
      } catch (err) {
        pollFailCountRef.current += 1;
        if (pollFailCountRef.current >= 3) {
          setError(err instanceof Error ? err.message : 'Error al cargar el diagnóstico');
          return false;
        }
        return true;
      }
      return true;
    };
    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled) return;
      const keep = await poll();
      if (!keep) clearInterval(interval);
    }, 3000);
    poll();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [diagnosticId, tierQParam, pollRetryToken]);

  useEffect(() => {
    const h = () => {
      if (!diagnosticId || handoff === 'leaving') return;
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

  // Avance fake del checklist izquierdo durante el setup: uno por uno, por tiempo,
  // independiente del proceso real. Arranca al confirmar país+rubro (displayCaptchaVerified)
  // y se frena antes del último paso (~73%) hasta que arranque el análisis real.
  useEffect(() => {
    if (!usingFakeProgress) {
      if (normalizedDiagnosticStatus === 'completed' || normalizedDiagnosticStatus === 'failed') return;
      setFakeBackdropStep(0);
      return;
    }
    const maxStep =
      normalizedDiagnosticStatus === 'running'
        ? ONBOARDING_STEP_LABELS.length - 1
        : ONBOARDING_STEP_LABELS.length - 3;
    setFakeBackdropStep((s) => (s > 0 ? s : 1));
    const id = setInterval(() => {
      setFakeBackdropStep((s) => Math.min(maxStep, s + 1));
    }, 3500);
    return () => clearInterval(id);
  }, [usingFakeProgress, normalizedDiagnosticStatus]);

  useEffect(() => {
    const targetVisible = Math.min(ANALYSIS_STEP_CARD_LABELS.length, Math.max(3, activeStepForCards + 2));
    if (visibleStepCards >= targetVisible) return;
    const t = setTimeout(() => setVisibleStepCards((n) => Math.min(targetVisible, n + 1)), 120);
    return () => clearTimeout(t);
  }, [activeStepForCards, visibleStepCards]);

  const handleSetupCountry = useCallback((v: string) => {
    setSetupCountry(v);
    setSetupLanguage(defaultLanguageForCountry(v));
  }, []);

  // Confirma país + rubro → arranca detección/progreso y avanza al paso de motores.
  const handleConfirmContext = useCallback(async () => {
    if (!diagnosticId) return;
    const c = setupCountry.trim();
    const ind = setupIndustry.trim();
    if (!c || !ind) {
      setStartAnalysisError('Confirmá país y rubro para continuar.');
      return;
    }
    setStartAnalysisError(null);
    setContextLoading(true);
    try {
      contextConfirmedRef.current = true;
      setCaptchaVerified(true);
      await publicDiagnosticApi.confirmContext(diagnosticId, {
        country: c,
        industry: ind,
        engines: setupEngines,
        ...(setupLanguage.trim() ? { language: setupLanguage.trim() } : {}),
      });
      trackOnboarding('onboarding_context_confirmed', { diagnosticId });
      setPublicSetupStep(4);
    } catch (err) {
      setStartAnalysisError(err instanceof Error ? err.message : 'No se pudo confirmar el contexto.');
    } finally {
      setContextLoading(false);
    }
  }, [diagnosticId, setupCountry, setupIndustry, setupEngines, setupLanguage]);

  const handleToggleEngine = useCallback((id: string) => {
    setSetupEngines((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  }, []);

  const handleIntroContinue = useCallback(() => {
    setIntroContinued(true);
    if (diagnosticId) trackOnboarding('onboarding_intro_completed', { diagnosticId });
  }, [diagnosticId]);

  const handleNewFlowBack = useCallback(() => {
    setStartAnalysisError(null);
    if (publicSetupStep === 1) {
      setIntroContinued(false);
      return;
    }
    setPublicSetupStep((publicSetupStep - 1) as SetupStep);
  }, [publicSetupStep]);

  const handleCompetitorChange = useCallback(
    (idx: number, nextVal: string) => {
      const hydrated = fiveUrlsFromDraft(diagnostic?.setupDraft ?? null);
      const wasHydratedEmpty = !hydrated.some((u) => u.trim());
      if (!wasHydratedEmpty && nextVal !== (hydrated[idx] ?? '')) {
        competitorUrlsTouchedRef.current = true;
      } else if (wasHydratedEmpty && nextVal.trim()) {
        competitorUrlsTouchedRef.current = true;
      }
      setCompetitorUrls((prev) => {
        const next = [...prev];
        next[idx] = nextVal;
        return next;
      });
    },
    [diagnostic?.setupDraft]
  );

  const handleCompetitorRemove = useCallback((idx: number) => {
    competitorUrlsTouchedRef.current = true;
    setCompetitorUrls((prev) => {
      const next = [...prev];
      next[idx] = '';
      return next;
    });
  }, []);

  const handleRestoreSuggested = useCallback(() => {
    competitorUrlsTouchedRef.current = false;
    const next = fiveUrlsFromDraft(diagnostic?.setupDraft ?? null);
    lastHydratedSuggestedJsonRef.current = JSON.stringify(
      diagnostic?.setupDraft?.suggestedCompetitorUrls ?? []
    );
    setCompetitorUrls(next);
  }, [diagnostic?.setupDraft]);

  const handleLegacyStep1Next = useCallback(() => {
    if (!legacySetupHumanOk) return;
    if (diagnosticId) trackOnboarding('onboarding_captcha_completed', { diagnosticId });
    setLegacyPublicStep(2);
  }, [legacySetupHumanOk, diagnosticId]);

  const handleSetupStartAnalysis = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!diagnosticId || !diagnostic) return;
    setStartAnalysisError(null);
    const trimmed = competitorUrls.map((u) => u.trim());
    const filledCompetitorUrls = trimmed.filter(Boolean);
    if (filledCompetitorUrls.length < 1) {
      setStartAnalysisError('Agregá al menos una URL de competidor válida.');
      return;
    }
    if (filledCompetitorUrls.length > 5) {
      setStartAnalysisError('Como máximo 5 URLs de competidores.');
      return;
    }
    if (!setupHumanOk) {
      setStartAnalysisError('Marcá la casilla para confirmar que sos humano.');
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
      const enginesPayload =
        setupEngines.length > 0
          ? setupEngines.includes('chatgpt')
            ? setupEngines
            : ['chatgpt', ...setupEngines]
          : ['chatgpt'];
      const legalAcceptedAt = new Date().toISOString();
      const humanVerifiedAt = humanVerifiedAtRef.current || legalAcceptedAt;
      await publicDiagnosticApi.start(
        diagnosticId,
        {
          email: em,
          competitorUrls: filledCompetitorUrls,
          ...(typeof diagnostic.setupDraft?.useSerp === 'boolean'
            ? { useSerp: diagnostic.setupDraft.useSerp }
            : {}),
          ...(setupCountry.trim() ? { country: setupCountry.trim() } : {}),
          ...(setupIndustry.trim() ? { industry: setupIndustry.trim() } : {}),
          ...(setupLanguage.trim() ? { language: setupLanguage.trim() } : {}),
          ...(setupFirstName.trim() ? { firstName: setupFirstName.trim() } : {}),
          ...(setupLastName.trim() ? { lastName: setupLastName.trim() } : {}),
          ...(setupHowFound.trim() ? { howFoundUs: setupHowFound.trim() } : {}),
          humanVerifiedAt,
          legalAcceptedAt,
          engines: enginesPayload,
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

  const handleRetryReport = useCallback(async () => {
    if (!diagnosticId) {
      exitPublicFunnelToMarketingSite();
      return;
    }
    setRetryLoading(true);
    setError(null);
    pollFailCountRef.current = 0;
    try {
      let current = diagnostic;
      if (!current) {
        current = await publicDiagnosticApi.get(diagnosticId, tierQParam === 'gold' ? 'gold' : undefined);
        setDiagnostic(current);
      }

      const status = String(current.status ?? '').trim().toLowerCase();
      if (status === 'failed') {
        const draft = current.setupDraft;
        const em = setupEmail.trim() || current.email?.trim() || '';
        const urlsFromUi = competitorUrls.map((u) => u.trim()).filter(Boolean);
        const urls =
          urlsFromUi.length > 0
            ? urlsFromUi
            : (draft?.confirmedCompetitorUrls ?? draft?.suggestedCompetitorUrls ?? []).filter(Boolean);

        if (em.includes('@') && urls.length >= 1) {
          const vid = getOrCreateCleexsVisitorId();
          await publicDiagnosticApi.start(
            diagnosticId,
            {
              email: em,
              competitorUrls: urls,
              ...(typeof draft?.useSerp === 'boolean' ? { useSerp: draft.useSerp } : {}),
              ...(setupCountry.trim() || draft?.confirmedCountry
                ? { country: setupCountry.trim() || draft?.confirmedCountry }
                : {}),
              ...(setupIndustry.trim() || draft?.confirmedIndustry
                ? { industry: setupIndustry.trim() || draft?.confirmedIndustry }
                : {}),
              ...(setupLanguage.trim() || draft?.selectedLanguage
                ? { language: setupLanguage.trim() || draft?.selectedLanguage }
                : {}),
              ...(setupFirstName.trim() || draft?.firstName
                ? { firstName: setupFirstName.trim() || draft?.firstName }
                : {}),
              ...(setupLastName.trim() || draft?.lastName
                ? { lastName: setupLastName.trim() || draft?.lastName }
                : {}),
              ...(setupHowFound.trim() || draft?.howFoundUs
                ? { howFoundUs: setupHowFound.trim() || draft?.howFoundUs }
                : {}),
              ...(draft?.humanVerifiedAt || humanVerifiedAtRef.current
                ? { humanVerifiedAt: humanVerifiedAtRef.current || draft?.humanVerifiedAt }
                : {}),
              ...(draft?.legalAcceptedAt ? { legalAcceptedAt: draft.legalAcceptedAt } : {}),
              ...(setupEngines.length
                ? { engines: setupEngines }
                : draft?.selectedEngines?.length
                  ? { engines: draft.selectedEngines }
                  : {}),
            },
            { visitorId: vid }
          );
          setCaptchaVerified(true);
          setPublicSetupStep(6);
          const refreshed = await publicDiagnosticApi.get(
            diagnosticId,
            tierQParam === 'gold' ? 'gold' : undefined
          );
          setDiagnostic(refreshed);
          trackOnboarding('onboarding_report_retry', { diagnosticId, mode: 'restart_pipeline' });
          setPollRetryToken((t) => t + 1);
          return;
        }

        setPublicSetupStep(6);
        if (em) setSetupEmail(em);
        if (urls.length) {
          const padded = [...urls];
          while (padded.length < 5) padded.push('');
          setCompetitorUrls(padded.slice(0, 5));
        }
        trackOnboarding('onboarding_report_retry', { diagnosticId, mode: 'wizard_email' });
        setPollRetryToken((t) => t + 1);
        return;
      }

      trackOnboarding('onboarding_report_retry', { diagnosticId, mode: 'poll' });
      setPollRetryToken((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el diagnóstico');
    } finally {
      setRetryLoading(false);
    }
  }, [
    diagnosticId,
    diagnostic,
    tierQParam,
    setupEmail,
    competitorUrls,
    setupCountry,
    setupIndustry,
    setupLanguage,
    setupFirstName,
    setupLastName,
    setupHowFound,
    setupEngines,
  ]);

  const handleWizardNext = () => {
    setStartAnalysisError(null);
    switch (publicSetupStep) {
      case 1:
        if (!setupHumanOk) return;
        if (!humanVerifiedAtRef.current) humanVerifiedAtRef.current = new Date().toISOString();
        if (diagnosticId) trackOnboarding('onboarding_captcha_completed', { diagnosticId });
        setPublicSetupStep(2);
        return;
      case 2:
        if (!setupCountry.trim()) return;
        setPublicSetupStep(3);
        return;
      case 3:
        void handleConfirmContext();
        return;
      case 4:
        if (setupEngines.length < 1) {
          setStartAnalysisError('Elegí al menos un motor de IA.');
          return;
        }
        setPublicSetupStep(5);
        return;
      case 5: {
        const filled = competitorUrls.map((u) => u.trim()).filter(Boolean).length;
        if (filled < 1) {
          setStartAnalysisError('Agregá al menos una URL de competidor.');
          return;
        }
        setPublicSetupStep(6);
        return;
      }
      case 6:
        void handleSetupStartAnalysis();
        return;
    }
  };

  useEffect(() => {
    if (normalizedDiagnosticStatus === 'detecting_competitors') {
      setCompetitorDetectSince((prev) => prev ?? Date.now());
    } else {
      setCompetitorDetectSince(null);
    }
  }, [normalizedDiagnosticStatus]);

  useEffect(() => {
    if (normalizedDiagnosticStatus !== 'detecting_competitors') return;
    const id = window.setInterval(() => setCompetitorDetectTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, [normalizedDiagnosticStatus]);

  useEffect(() => {
    if (analysisRunningPhase) setIntroContinued(true);
  }, [analysisRunningPhase]);

  useEffect(() => {
    if (publicSetupStep > 1) setIntroContinued(true);
  }, [diagnosticId, publicSetupStep]);

  const handleOpenReport = useCallback(() => {
    if (!diagnosticId) return;
    setHandoff('leaving');
    trackOnboarding('onboarding_report_opened', { diagnosticId });
    const tierQ = diagnostic?.tier === 'gold' ? '&tier=gold' : '';
    router.push(`/ver-resultado/v2?diagnosticId=${diagnosticId}${tierQ}`);
  }, [diagnosticId, diagnostic?.tier, router]);

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
    if (showFakeSteps) {
      const isCompleted = i < backdropStep;
      const isActive = i === backdropStep;
      const state: AnalysisStepItem['state'] = isCompleted ? 'completed' : isActive ? 'active' : 'pending';
      return {
        id: i + 1,
        label,
        state,
        visible: i <= backdropStep,
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
      <DiagnosticReportErrorPanel
        detail="No encontramos el identificador del diagnóstico."
        onRetry={exitPublicFunnelToMarketingSite}
        onBack={exitPublicFunnelToMarketingSite}
      />
    );
  }

  if (!diagnostic && !reportGenerationFailed) {
    return (
      <main className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center gap-3 bg-slate-50 px-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" aria-hidden />
        <p className="text-sm text-slate-600">Cargando diagnóstico…</p>
      </main>
    );
  }

  if (reportGenerationFailed) {
    return (
      <DiagnosticReportErrorPanel
        detail={diagnosticReportErrorDetail(error)}
        loading={retryLoading}
        onRetry={handleRetryReport}
        onBack={exitPublicFunnelToMarketingSite}
      />
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

  const trimmedSetupCompetitorUrls = competitorUrls.map((u) => u.trim());
  const filledSetupCompetitorCount = trimmedSetupCompetitorUrls.filter(Boolean).length;
  const suggestedFromServer = diagnostic.setupDraft?.suggestedCompetitorUrls ?? [];
  const suggestedCompetitorCount = suggestedFromServer.filter((u) => u.trim()).length;
  const competitorDetectTimedOut =
    normalizedDiagnosticStatus === 'detecting_competitors' &&
    competitorDetectSince != null &&
    Date.now() - competitorDetectSince > 60_000;
  const competitorsDetecting =
    normalizedDiagnosticStatus === 'detecting_competitors' && !competitorDetectTimedOut;
  const competitorsDetectEmpty =
    !competitorsDetecting &&
    publicSetupStep >= 5 &&
    filledSetupCompetitorCount < 1 &&
    suggestedCompetitorCount < 1;
  const setupShowProcessing = !setupDataReady && !captchaVerified;
  const reportReady = isReportReadyForRedirect(diagnostic);
  const reportFinalizing =
    !reportReady &&
    (normalizedDiagnosticStatus === 'completed' || waitingFinalReady || isFinalizing);
  const cafecitoReportProgress = reportReady
    ? 100
    : reportFinalizing
      ? Math.min(97, Math.max(92, Math.round(displayBarPct)))
      : Math.min(98, Math.round(displayBarPct));
  const showCafecito = analysisRunningPhase;
  const waUserName = onboardingWhatsAppDisplayName(setupEmail || diagnosticEmailTrimmed);
  const whatsappHref = buildOnboardingWhatsAppHref(waUserName, domainShort);
  const reportHref = `/ver-resultado/v2?diagnosticId=${diagnosticId}${diagnostic.tier === 'gold' ? '&tier=gold' : ''}`;

  if (handoff === 'leaving') {
    return (
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary-600" />
          <p className="mt-4 text-sm text-slate-600">Abriendo tu informe…</p>
        </div>
      </main>
    );
  }

  const onboardingFlow = showCafecito ? (
    <OnboardingPreviewCafecito
      userName={waUserName}
      domain={domainShort}
      brandLabel={brandLabel ?? undefined}
      founderPhotoUrl={CLEEXS_FOUNDER_PHOTO_URL}
      youtubeVideoId={CLEEXS_ONBOARDING_YOUTUBE_VIDEO_ID}
      whatsappHref={whatsappHref}
      reportReady={reportReady}
      reportFinalizing={reportFinalizing}
      reportProgress={cafecitoReportProgress}
      reportHref={reportHref}
      onReportClick={handleOpenReport}
    />
  ) : isPreRunBackdrop && !introContinued ? (
    <OnboardingPreviewIntro
      brandLabel={brandLabel ?? ''}
      domain={domainShort}
      founderPhotoUrl={CLEEXS_FOUNDER_PHOTO_URL}
      processing={setupShowProcessing}
      ready={!setupShowProcessing && setupDataReady}
      onContinue={handleIntroContinue}
    />
  ) : isPreRunBackdrop && publicSetupStep === 1 ? (
    <OnboardingPreviewHuman
      humanOk={setupHumanOk}
      onHumanOk={setSetupHumanOk}
      onBack={handleNewFlowBack}
      onContinue={handleWizardNext}
      onOpenLegal={setLegalModalSection}
    />
  ) : isPreRunBackdrop ? (
    <OnboardingWizard
      step={publicSetupStep - 1}
      country={setupCountry}
      onCountry={handleSetupCountry}
      industry={setupIndustry}
      onIndustry={setSetupIndustry}
      language={setupLanguage}
      onLanguage={setSetupLanguage}
      firstName={setupFirstName}
      onFirstName={setSetupFirstName}
      lastName={setupLastName}
      onLastName={setSetupLastName}
      howFound={setupHowFound}
      onHowFound={setSetupHowFound}
      engines={setupEngines}
      onToggleEngine={handleToggleEngine}
      competitorUrls={competitorUrls}
      onCompetitorChange={handleCompetitorChange}
      onCompetitorRemove={handleCompetitorRemove}
      onRestoreSuggested={handleRestoreSuggested}
      competitorsLoading={competitorsDetecting}
      competitorsDetectEmpty={competitorsDetectEmpty}
      suggestedCompetitorCount={suggestedCompetitorCount}
      filledCompetitorCount={filledSetupCompetitorCount}
      email={setupEmail}
      onEmail={setSetupEmail}
      onBack={handleNewFlowBack}
      onNext={handleWizardNext}
      nextLoading={contextLoading || startAnalysisLoading}
      error={startAnalysisError}
      onOpenLegal={setLegalModalSection}
      showEmailCountdown={showEmailCountdown}
      diagnosticId={diagnosticId ?? undefined}
      onEmailCountdownExpire={handleEmailCountdownExpire}
    />
  ) : null;

  return (
    <main className="relative flex min-h-[calc(100vh-72px)] flex-col bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col min-h-0 lg:max-w-5xl">
        {/* Chrome móvil */}
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3 lg:hidden">
          <a
            href={CLEEXS_MARKETING_URL}
            className="inline-flex shrink-0 rounded-lg transition hover:opacity-90"
            aria-label="Cleexs"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CleexsMark.svg" alt="" className="h-8 w-8" />
          </a>
          <p className="min-w-0 truncate text-right text-[11px] font-medium text-slate-500">
            {brandLabel ? `Análisis · ${brandLabel}` : 'Análisis en curso'}
          </p>
        </div>

        <div className="mb-4 shrink-0 lg:hidden">
          <OnboardingMobileProgressHeader
            analysisRunning={setupLeftProgress}
            progressPct={setupLeftProgress ? displayBarPct : 0}
            elapsedSeconds={elapsedSeconds}
            brandLabel={brandLabel ?? ''}
          />
        </div>

        {/* Chrome desktop */}
        <div className="mb-4 hidden shrink-0 sm:mb-5 lg:block">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary-600">Análisis en curso</p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">
                {brandLabel ? `Construyendo tu análisis de ${brandLabel}` : 'Construyendo tu análisis'}
              </h1>
            </div>
            <a
              href={CLEEXS_MARKETING_URL}
              className="shrink-0 rounded-lg transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
              aria-label="Volver a cleexs.net"
            >
              <img
                src="/CleexsLogo.png"
                alt="Cleexs"
                className="h-14 w-auto object-contain sm:h-16"
              />
            </a>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr,1.15fr] lg:gap-8">
          <div
            className={cn(
              'hidden min-h-0 min-w-0 flex-col lg:flex',
              !setupLeftProgress && isPreRunBackdrop && 'pointer-events-none select-none opacity-[0.72]'
            )}
          >
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-1.5 w-full overflow-hidden bg-slate-100">
                <div
                  className="h-full bg-primary-600 transition-all duration-700 ease-out"
                  style={{ width: `${setupLeftProgress ? displayBarPct : 0}%` }}
                />
              </div>
              <div className="p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Construyendo tu Cleexs Score: {displayCompletedCount}/{ONBOARDING_STEP_LABELS.length} completado
                </p>
                {setupLeftProgress ? (
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
                          ? 'Score base listo. Terminando un motor adicional del plan premium…'
                          : 'Score listo. Cerrando el informe (texto IA)…'}
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
                          {Math.round(setupLeftProgress ? displayBarPct : 0)}% · {formatElapsed(elapsedSeconds)}
                        </span>
                      </div>
                    </div>
                    {isRunning && displayBarPct >= 85 && elapsedSeconds >= 90 && !isFinalizing && (
                      <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                        Cerrando las consultas con ChatGPT. Suele tardar 1–2 minutos; en algunos sitios puede llegar a
                        5.
                      </p>
                    )}
                    {isRunning && elapsedSeconds >= 360 && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                        Tarda más de lo usual. Si no avanzá, podés crear un diagnóstico más tarde.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">
                    Tocá <span className="font-semibold">Continuar</span> en la intro para arrancar el análisis
                    {brandLabel ? ` de ${brandLabel}` : ''}.
                  </p>
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
                    {Math.round(setupLeftProgress ? displayBarPct : 0)}%
                  </span>
                  <span className="text-slate-500">{formatElapsed(elapsedSeconds)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex min-h-0 min-w-0 flex-col">
            <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:pb-0">
              {onboardingFlow}
            </div>
          </div>
        </div>

        <p className="mt-3 shrink-0 text-center text-[10px] leading-relaxed text-slate-400 lg:hidden">
          El análisis suele tardar 30–90 s. Podés dejar esta pantalla abierta.
        </p>
        <p className="mt-4 hidden shrink-0 text-center text-xs text-slate-500 lg:block">
          El análisis suele tardar entre 30 y 90 segundos. Podés dejarlo abierto: el progreso sigue y te llevamos al
          informe.
        </p>
      </div>

      <LegalAcceptanceModal
        open={legalModalSection !== null}
        section={legalModalSection ?? 'terminos-de-servicio'}
        onClose={() => setLegalModalSection(null)}
      />

      {portalRoot &&
        needsLegacyEmailCaptchaModal &&
        createPortal(
        <div
          className="pointer-events-auto fixed inset-0 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-sm sm:items-center"
          style={{ zIndex: 2147483000 }}
        >
          {legacyPublicStep === 1 ? (
            <form
              className="my-auto w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl sm:p-8"
              role="dialog"
              aria-modal
              aria-labelledby="legacy-setup-title"
              onSubmit={(e) => {
                e.preventDefault();
                handleLegacyStep1Next();
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.repeat) return;
                if (e.nativeEvent.isComposing) return;
                const el = e.target as HTMLElement;
                if (el.closest('a[href]')) return;
                const btn = el.closest('button');
                if (btn?.getAttribute('type') === 'button') return;
                if (btn?.getAttribute('type') === 'submit') return;
                if (!legacySetupHumanOk) return;
                e.preventDefault();
                handleLegacyStep1Next();
              }}
            >
              <div className="flex flex-col items-center text-center">
                <Lock className="h-10 w-10 text-slate-400" strokeWidth={1.25} aria-hidden />
                <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Paso 1 de 2</p>
                <h1 id="legacy-setup-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  Confirmá que sos humano y seguimos
                </h1>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
                  Necesitamos tu correo para enviarte el informe. Primero confirmá que sos una persona.
                </p>
              </div>
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-100 px-4 py-4 sm:px-5">
                <label className="flex w-full cursor-pointer items-center gap-3 text-left">
                  <input
                    type="checkbox"
                    checked={legacySetupHumanOk}
                    onChange={(e) => setLegacySetupHumanOk(e.target.checked)}
                    className="h-[18px] w-[18px] shrink-0 rounded border-slate-400 text-violet-600 focus:ring-2 focus:ring-violet-500"
                  />
                  <span className="text-sm font-medium text-slate-800">Soy Humano</span>
                </label>
              </div>
              <div className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1 rounded-xl text-slate-500"
                  disabled
                  aria-disabled
                  title="Completá este paso para continuar"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Atrás
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8"
                  disabled={!legacySetupHumanOk}
                >
                  Continuar
                </Button>
              </div>
            </form>
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
              {showEmailCountdown ? (
                <OnboardingEmailCountdown
                  active
                  variant="inline"
                  diagnosticId={diagnosticId ?? undefined}
                  onExpire={handleEmailCountdownExpire}
                  className="mt-5"
                />
              ) : null}
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
                <button
                  type="button"
                  className="text-violet-600 underline hover:text-violet-700"
                  onClick={() => setLegalModalSection('terminos-de-servicio')}
                >
                  Términos
                </button>{' '}
                y la{' '}
                <button
                  type="button"
                  className="text-violet-600 underline hover:text-violet-700"
                  onClick={() => setLegalModalSection('politica-de-privacidad')}
                >
                  Privacidad
                </button>
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
