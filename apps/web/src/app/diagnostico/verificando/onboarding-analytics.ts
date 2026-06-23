/**
 * Tracking mínimo del funnel de diagnóstico público. En producción, enlazar a gtag / plataforma.
 * Eventos: ver lista en diagnostic-onboarding o docs internos.
 */
export type OnboardingAnalyticName =
  | 'onboarding_started'
  | 'onboarding_captcha_completed'
  | 'onboarding_context_confirmed'
  | 'onboarding_setup_completed'
  | 'onboarding_quiz_answered'
  | 'onboarding_score_predicted'
  | 'onboarding_unlock_viewed'
  | 'onboarding_email_submitted'
  | 'onboarding_email_failed'
  | 'onboarding_email_countdown_expired'
  | 'onboarding_preview_viewed'
  | 'onboarding_report_opened'
  | 'onboarding_abandon'
  | 'onboarding_social_shown'
  | 'onboarding_insight_shown';


export function trackOnboarding(
  name: OnboardingAnalyticName,
  payload?: Record<string, string | number | boolean | null | undefined>
) {
  if (typeof window === 'undefined') return;
  const detail = { name, ...payload, ts: Date.now() };
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[onboarding]', detail);
  }
  try {
    window.dispatchEvent(new CustomEvent('cleexs:onboarding', { detail }));
  } catch {
    // ignore
  }
  // Hook futuro: window.gtag?.('event', name, payload);
}

export function lastStepForAbandon(payload: { diagnosticId: string; phase: string; stepIndex: number }) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `cleexs_onboarding_${payload.diagnosticId}_last`,
      JSON.stringify({ ...payload, t: Date.now() })
    );
  } catch {
    // ignore
  }
}
