import { prisma } from './prisma';

/**
 * Genera tenant_path basado en parent y tenant_code
 */
export function generateTenantPath(parentPath: string | null, tenantCode: string): string {
  if (!parentPath || parentPath === '000') {
    return `000/${tenantCode}`;
  }
  return `${parentPath}/${tenantCode}`;
}

/**
 * Obtiene todos los tenants hijos de un tenant (incluyendo descendientes)
 */
export async function getTenantDescendants(tenantId: string): Promise<string[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantPath: true },
  });

  if (!tenant) return [];

  const descendants = await prisma.tenant.findMany({
    where: {
      tenantPath: {
        startsWith: `${tenant.tenantPath}/`,
      },
    },
    select: { id: true },
  });

  return [tenantId, ...descendants.map((t) => t.id)];
}

/**
 * Calcula consumo mensual de runs para un tenant (incluyendo hijos si es AGENCY)
 */
export async function getMonthlyRunConsumption(
  tenantId: string,
  year: number,
  month: number
): Promise<number> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { tenantType: true },
  });

  if (!tenant) return 0;

  // Si es AGENCY, contar runs de todos los descendientes
  const tenantIds =
    tenant.tenantType === 'AGENCY' ? await getTenantDescendants(tenantId) : [tenantId];

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const count = await prisma.run.count({
    where: {
      tenantId: { in: tenantIds },
      periodStart: { gte: startDate },
      periodEnd: { lte: endDate },
    },
  });

  return count;
}

/**
 * Valida si un tenant puede crear un nuevo run según su plan
 */
export async function canCreateRun(tenantId: string): Promise<{ allowed: boolean; reason?: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });

  if (!tenant || tenant.status !== 'active') {
    return { allowed: false, reason: 'Tenant no activo' };
  }

  const now = new Date();
  const consumption = await getMonthlyRunConsumption(
    tenantId,
    now.getFullYear(),
    now.getMonth() + 1
  );

  if (consumption >= tenant.plan.runsPerMonth) {
    return {
      allowed: false,
      reason: `Límite de runs mensuales alcanzado (${tenant.plan.runsPerMonth})`,
    };
  }

  return { allowed: true };
}
