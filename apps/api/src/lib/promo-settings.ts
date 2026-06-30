import { prisma } from './prisma';

/**
 * Feature flags / promociones controladas desde el admin, persistidas en `app_settings`.
 * Hoy solo maneja el upsell "Plan Conquistar" en la página de resultados, pero el
 * formato (clave/valor JSON) permite agregar más toggles sin migraciones nuevas.
 */

export const PLAN_CONQUISTAR_UPSELL_KEY = 'promo.plan_conquistar_upsell';

export type PlanConquistarUpsellConfig = {
  enabled: boolean;
  /** ISO date-time o null. Si está seteado, la promo solo se muestra desde esta fecha. */
  startsAt: string | null;
  /** ISO date-time o null. Si está seteado, la promo se apaga sola después de esta fecha. */
  endsAt: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
};

const DEFAULT_CONFIG: PlanConquistarUpsellConfig = {
  enabled: false,
  startsAt: null,
  endsAt: null,
};

function coerceDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseConfig(value: unknown): PlanConquistarUpsellConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_CONFIG };
  const raw = value as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    startsAt: coerceDate(raw.startsAt),
    endsAt: coerceDate(raw.endsAt),
  };
}

export async function getPlanConquistarUpsellConfig(): Promise<PlanConquistarUpsellConfig> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: PLAN_CONQUISTAR_UPSELL_KEY } });
    if (!row) return { ...DEFAULT_CONFIG };
    return {
      ...parseConfig(row.value),
      updatedBy: row.updatedBy ?? null,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    };
  } catch {
    // Si la tabla no existe aún (deploy en curso) o falla la lectura, la promo queda apagada.
    return { ...DEFAULT_CONFIG };
  }
}

export async function setPlanConquistarUpsellConfig(
  input: { enabled: boolean; startsAt?: string | null; endsAt?: string | null },
  updatedBy?: string | null
): Promise<PlanConquistarUpsellConfig> {
  const next: PlanConquistarUpsellConfig = {
    enabled: input.enabled === true,
    startsAt: coerceDate(input.startsAt),
    endsAt: coerceDate(input.endsAt),
  };
  const row = await prisma.appSetting.upsert({
    where: { key: PLAN_CONQUISTAR_UPSELL_KEY },
    create: { key: PLAN_CONQUISTAR_UPSELL_KEY, value: next, updatedBy: updatedBy ?? null },
    update: { value: next, updatedBy: updatedBy ?? null },
  });
  return {
    ...parseConfig(row.value),
    updatedBy: row.updatedBy ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

/** True si la promo está encendida y dentro de la ventana de fechas (si la hubiera). */
export function isPlanConquistarUpsellActive(
  config: PlanConquistarUpsellConfig,
  now: Date = new Date()
): boolean {
  if (!config.enabled) return false;
  if (config.startsAt && now < new Date(config.startsAt)) return false;
  if (config.endsAt && now > new Date(config.endsAt)) return false;
  return true;
}
