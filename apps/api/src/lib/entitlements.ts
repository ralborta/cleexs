import {
  EntitlementAction,
  Prisma,
  ProfileClaimStatus,
  UsageActorType,
  type PrismaClient,
} from '@prisma/client';

/** Clave interna estable (API / reglas). No usar “premium” como etiqueta comercial. */
export type PlanKey = 'anonymous' | 'free' | 'crecimiento' | 'enterprise' | 'admin';

export type EntitlementActor = {
  tenantId?: string;
  userId?: string;
  anonymousId?: string;
};

export type EntitlementCheckInput = {
  actor: EntitlementActor;
  action: EntitlementAction;
  brandId?: string;
  profileSlug?: string;
  dedupeKey?: string;
  /**
   * Acota el conteo de uso a un dominio/marca puntual (se compara contra `metaJson.domain`).
   * Pensado para `score_generate` anónimo: cada dominio nuevo arranca su propio cupo,
   * así una marca nueva nunca se bloquea por haber analizado otras marcas antes.
   */
  domainScope?: string;
};

export type EntitlementCheckResult = {
  allowed: boolean;
  code: string;
  reason?: string;
  /** Igual que `planKey` (compatibilidad con respuestas JSON existentes). */
  plan: PlanKey;
  planKey: PlanKey;
  /** Nombre comercial para UI: Siempre gratis, Crecimiento, Enterprise, etc. */
  planDisplay: string;
  usage: number;
  limit: number | null;
};

type PlanLimits = {
  scoreViewMonthly: number | null;
  /** Cupo mensual para generar análisis (público/portal). Si no se define, se usa `scoreViewMonthly`. */
  scoreGenerateMonthly?: number | null;
  deepReportsMonthly: number | null;
  maxBrands: number | null;
};

function monthlyUsageLimit(limits: PlanLimits, action: EntitlementAction): number | null {
  if (action === EntitlementAction.report_deep_generate) return limits.deepReportsMonthly;
  if (action === EntitlementAction.score_generate) {
    const g = limits.scoreGenerateMonthly;
    if (g !== undefined && g !== null) return g;
  }
  return limits.scoreViewMonthly;
}

const PLAN_LIMITS: Record<Exclude<PlanKey, 'admin'>, PlanLimits> = {
  anonymous: {
    scoreViewMonthly: 1,
    scoreGenerateMonthly: 3,
    deepReportsMonthly: 0,
    maxBrands: 0,
  },
  free: {
    scoreViewMonthly: 15,
    deepReportsMonthly: 1,
    maxBrands: 1,
  },
  crecimiento: {
    scoreViewMonthly: null,
    deepReportsMonthly: 10,
    maxBrands: null,
  },
  enterprise: {
    scoreViewMonthly: null,
    deepReportsMonthly: null,
    maxBrands: null,
  },
};

export function planDisplayName(key: PlanKey): string {
  switch (key) {
    case 'anonymous':
      return 'Visitante';
    case 'free':
      return 'Siempre gratis';
    case 'crecimiento':
      return 'Crecimiento';
    case 'enterprise':
      return 'Enterprise';
    case 'admin':
      return 'Administración';
    default:
      return 'Siempre gratis';
  }
}

function wrapResult(partial: Omit<EntitlementCheckResult, 'plan' | 'planKey' | 'planDisplay'> & { planKey: PlanKey }) {
  const { planKey, ...rest } = partial;
  return {
    ...rest,
    planKey,
    plan: planKey,
    planDisplay: planDisplayName(planKey),
  } satisfies EntitlementCheckResult;
}

function getCurrentPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

/** Mapea nombre de plan en DB u override a clave interna. */
export function resolvePlanKeyFromName(name?: string | null): PlanKey {
  const value = (name || '').toLowerCase().trim();
  if (!value) return 'free';
  if (value.includes('enterprise')) return 'enterprise';
  if (
    value.includes('crecimiento') ||
    value.includes('growth') ||
    value.includes('premium') ||
    value.includes('pro')
  ) {
    return 'crecimiento';
  }
  if (value.includes('siempre') || value.includes('gratis') || value.includes('free') || value.includes('basic')) {
    return 'free';
  }
  return 'free';
}

async function isAdminGodMode(prisma: PrismaClient, actor: EntitlementActor): Promise<boolean> {
  if (!actor.userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    include: { tenant: { select: { tenantCode: true } } },
  });
  if (!user) return false;

  const adminEmails = (process.env.ADMIN_FULL_ACCESS_EMAILS || 'admin@cleexs.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const emailIsAdmin = adminEmails.includes(user.email.toLowerCase());
  const rootOwner = user.role === 'owner' && user.tenant?.tenantCode === '000';
  return emailIsAdmin || rootOwner;
}

export async function resolvePlanKey(prisma: PrismaClient, actor: EntitlementActor): Promise<PlanKey> {
  if (!actor.tenantId && !actor.userId) return 'anonymous';
  let tenantId = actor.tenantId;
  let planName: string | null | undefined;

  if (actor.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: actor.tenantId },
      include: { plan: true },
    });
    tenantId = tenant?.id;
    planName = tenant?.plan?.name;
  } else if (actor.userId) {
    const user = await prisma.user.findUnique({
      where: { id: actor.userId },
      include: { tenant: { include: { plan: true } } },
    });
    tenantId = user?.tenant?.id;
    planName = user?.tenant?.plan?.name;
  }

  if (!tenantId) return 'free';

  const now = new Date();
  const scopeFilters: Prisma.EntitlementOverrideWhereInput[] = [{ tenantId }];
  if (actor.userId) scopeFilters.push({ userId: actor.userId });
  const override = await prisma.entitlementOverride.findFirst({
    where: {
      active: true,
      OR: scopeFilters,
      startsAt: { lte: now },
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (override) return resolvePlanKeyFromName(override.grantPlan);
  return resolvePlanKeyFromName(planName);
}

async function countUsageForAction(
  prisma: PrismaClient,
  actor: EntitlementActor,
  action: EntitlementAction,
  periodStart: Date,
  periodEnd: Date,
  domainScope?: string
) {
  const where: Prisma.UsageLedgerWhereInput = {
    action,
    periodStart,
    periodEnd,
  };

  if (actor.userId) where.userId = actor.userId;
  else if (actor.tenantId) where.tenantId = actor.tenantId;
  else where.anonymousId = actor.anonymousId || 'anonymous';

  // Cupo por dominio: solo cuenta usos del mismo dominio (marca nueva = contador 0).
  const scope = domainScope?.trim().toLowerCase();
  if (scope) {
    where.metaJson = { path: ['domain'], equals: scope } as Prisma.UsageLedgerWhereInput['metaJson'];
  }

  const aggregate = await prisma.usageLedger.aggregate({
    where,
    _sum: { quantity: true },
  });
  return aggregate._sum.quantity ?? 0;
}

/** Cuenta perfiles distintos vistos (mismo slug no suma de nuevo). */
async function countDistinctScoreViews(
  prisma: PrismaClient,
  actor: EntitlementActor,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const where: Prisma.UsageLedgerWhereInput = {
    action: EntitlementAction.score_view,
    periodStart,
    periodEnd,
    profileSlug: { not: null },
  };
  if (actor.userId) where.userId = actor.userId;
  else if (actor.tenantId) where.tenantId = actor.tenantId;
  else if (actor.anonymousId) where.anonymousId = actor.anonymousId;
  else return 0;

  const rows = await prisma.usageLedger.findMany({
    where,
    distinct: ['profileSlug'],
    select: { profileSlug: true },
  });
  return rows.length;
}

async function canViewDeepReport(
  prisma: PrismaClient,
  actor: EntitlementActor,
  brandId?: string
): Promise<boolean> {
  if (!actor.tenantId || !brandId) return false;
  const directOwnership = await prisma.brand.count({
    where: { id: brandId, tenantId: actor.tenantId },
  });
  if (directOwnership > 0) return true;

  const delegated = await prisma.tenantBrandAccess.count({
    where: { tenantId: actor.tenantId, brandId },
  });
  return delegated > 0;
}

export async function checkEntitlement(
  prisma: PrismaClient,
  input: EntitlementCheckInput
): Promise<EntitlementCheckResult> {
  const adminBypass = await isAdminGodMode(prisma, input.actor);
  if (adminBypass) {
    return wrapResult({
      allowed: true,
      code: 'admin_override',
      reason: undefined,
      planKey: 'admin',
      usage: 0,
      limit: null,
    });
  }

  const planKey = await resolvePlanKey(prisma, input.actor);
  const limits = PLAN_LIMITS[planKey as Exclude<PlanKey, 'admin'>];
  const { start, end } = getCurrentPeriod();

  if (input.action === EntitlementAction.report_deep_view) {
    const allowed = await canViewDeepReport(prisma, input.actor, input.brandId);
    return wrapResult({
      allowed,
      code: allowed ? 'ok' : 'brand_access_required',
      reason: allowed ? undefined : 'No tenes permisos para ver el reporte profundo de esta marca',
      planKey,
      usage: 0,
      limit: null,
    });
  }

  if (input.action === EntitlementAction.profile_claim) {
    if (!input.actor.userId || !input.actor.tenantId) {
      return wrapResult({
        allowed: false,
        code: 'login_required',
        reason: 'Debes iniciar sesion para reclamar un perfil',
        planKey,
        usage: 0,
        limit: limits.maxBrands,
      });
    }
    if (limits.maxBrands == null) {
      return wrapResult({ allowed: true, code: 'ok', planKey, usage: 0, limit: limits.maxBrands });
    }

    const approvedClaims = await prisma.profileClaim.count({
      where: {
        tenantId: input.actor.tenantId,
        status: ProfileClaimStatus.approved,
      },
    });
    return wrapResult({
      allowed: approvedClaims < limits.maxBrands,
      code: approvedClaims < limits.maxBrands ? 'ok' : 'claim_limit_reached',
      reason:
        approvedClaims < limits.maxBrands
          ? undefined
          : 'Alcanzaste el limite de perfiles reclamables para tu plan',
      planKey,
      usage: approvedClaims,
      limit: limits.maxBrands,
    });
  }

  if (input.action === EntitlementAction.report_deep_generate) {
    if (!input.actor.tenantId || !input.actor.userId) {
      return wrapResult({
        allowed: false,
        code: 'login_required',
        reason: 'Debes iniciar sesion para generar un reporte profundo',
        planKey,
        usage: 0,
        limit: limits.deepReportsMonthly,
      });
    }

    if (input.brandId && limits.maxBrands === 1) {
      const accesses = await prisma.tenantBrandAccess.findMany({
        where: { tenantId: input.actor.tenantId },
        orderBy: { createdAt: 'asc' },
      });
      if (accesses.length > 0 && !accesses.some((a) => a.brandId === input.brandId)) {
        return wrapResult({
          allowed: false,
          code: 'brand_scope_limited',
          reason: 'Tu plan actual permite reportes profundos de una sola marca',
          planKey,
          usage: accesses.length,
          limit: limits.maxBrands,
        });
      }
    }
  }

  if (
    input.action === EntitlementAction.score_view &&
    !input.actor.userId &&
    !input.actor.tenantId &&
    !input.actor.anonymousId
  ) {
    return wrapResult({
      allowed: false,
      code: 'anonymous_id_required',
      reason: 'Falta identificador anonimo para controlar el limite',
      planKey,
      usage: 0,
      limit: limits.scoreViewMonthly,
    });
  }

  const usage =
    input.action === EntitlementAction.score_view
      ? await countDistinctScoreViews(prisma, input.actor, start, end)
      : await countUsageForAction(prisma, input.actor, input.action, start, end, input.domainScope);

  const limit = monthlyUsageLimit(limits, input.action);

  if (limit == null) return wrapResult({ allowed: true, code: 'ok', planKey, usage, limit });
  if (usage >= limit) {
    const reason =
      planKey === 'anonymous'
        ? 'Ya alcanzaste el límite de diagnósticos públicos gratuitos con este navegador este mes (sin cuenta). Podés volver a intentar el mes que viene o crear una cuenta en Cleexs para más cupo.'
        : 'Alcanzaste el limite mensual de tu plan';
    return wrapResult({
      allowed: false,
      code: 'limit_reached',
      reason,
      planKey,
      usage,
      limit,
    });
  }
  return wrapResult({ allowed: true, code: 'ok', planKey, usage, limit });
}

export async function consumeEntitlement(
  prisma: PrismaClient,
  input: EntitlementCheckInput & { quantity?: number; metaJson?: Prisma.InputJsonValue }
) {
  const { start, end } = getCurrentPeriod();
  const actorType = input.actor.userId || input.actor.tenantId ? UsageActorType.user : UsageActorType.anonymous;

  const createData: Prisma.UsageLedgerCreateInput = {
    action: input.action,
    actorType,
    anonymousId: input.actor.anonymousId,
    user: input.actor.userId ? { connect: { id: input.actor.userId } } : undefined,
    tenant: input.actor.tenantId ? { connect: { id: input.actor.tenantId } } : undefined,
    brand: input.brandId ? { connect: { id: input.brandId } } : undefined,
    profileSlug: input.profileSlug,
    periodStart: start,
    periodEnd: end,
    quantity: input.quantity ?? 1,
    dedupeKey: input.dedupeKey,
    metaJson: input.metaJson,
  };

  if (input.dedupeKey) {
    const existing = await prisma.usageLedger.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true },
    });
    if (existing) return existing;
  }

  return prisma.usageLedger.create({ data: createData });
}
