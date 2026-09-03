/** Informe diagnóstico v2.25 (preview CRO → prod). Tres CTAs hacia /plan-conquistar. */
export const INFORME_DIAGNOSTICO_V225_UNLOCK_LINKS = [
  {
    key: 'ver_resultado_v2_transition_banner',
    label: 'Informe v2.25 · Banner "Ver Plan Conquistar"',
    order: 1,
  },
  {
    key: 'ver_resultado_v2_cta_plan_accion',
    label: 'Informe v2.25 · Botón "Ver plan de acción"',
    order: 2,
  },
  {
    key: 'ver_resultado_v2_engine_paywall',
    label: 'Informe v2.25 · Modal motor bloqueado',
    order: 3,
  },
] as const;

/** Botones/enlaces hacia Plan Conquistar — orden fijo para el reporte en admin. */
export const PLAN_CONQUISTAR_UNLOCK_LINKS = [
  ...INFORME_DIAGNOSTICO_V225_UNLOCK_LINKS,
  {
    key: 'plan_conquistar_landing_cta',
    label: 'Landing Plan Conquistar · Botón principal',
    order: 4,
  },
  {
    key: 'onboarding_countdown_plan_conquistar',
    label: 'Onboarding · Barra email · Plan Conquistar',
    order: 5,
  },
] as const;

export type PlanConquistarUnlockKey = (typeof PLAN_CONQUISTAR_UNLOCK_LINKS)[number]['key'];

const PLAN_CONQUISTAR_KEY_SET = new Set<string>(
  PLAN_CONQUISTAR_UNLOCK_LINKS.map((l) => l.key)
);

/** Incluye CTAs legacy del upsell / checkout que también llevan al plan. */
export function isPlanConquistarUnlockKey(unlockKey: string): boolean {
  const key = unlockKey.trim();
  if (!key) return false;
  if (PLAN_CONQUISTAR_KEY_SET.has(key)) return true;
  if (key.startsWith('ver_resultado_v2_')) return true;
  if (key.startsWith('desbloqueo_')) return true;
  if (key === 'checkout_plan_conquistar') return true;
  if (key.startsWith('checkout_') && key.includes('plan')) return true;
  return false;
}

export function planConquistarUnlockLabel(unlockKey: string, fallbackLabel?: string): string {
  const known = PLAN_CONQUISTAR_UNLOCK_LINKS.find((l) => l.key === unlockKey);
  if (known) return known.label;
  if (fallbackLabel?.trim()) return fallbackLabel.trim();
  return unlockKey;
}
