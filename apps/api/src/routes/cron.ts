import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const RUN_SCHEDULE_VALUES = ['semanal', 'quincenal', 'mensual'] as const;

/** Normaliza un header a string (Fastify/Node pueden devolver string | string[]) */
function headerString(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Rutas para n8n (corridas programadas). Protegidas por CRON_SECRET.
 * GET /api/cron/scheduled-runs?frequency=semanal
 * Devuelve marcas con runSchedule = frequency y el periodo sugerido (periodStart, periodEnd).
 */
function checkCronSecret(request: { headers: { [k: string]: string | string[] | undefined } }, reply: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    reply.code(500).send({ error: 'CRON_SECRET no configurado' });
    return false;
  }
  const raw = request.headers['x-cron-secret'] ?? request.headers.authorization;
  const auth = headerString(raw);
  const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '').trim() : undefined;
  if (token !== secret) {
    reply.code(401).send({ error: 'No autorizado' });
    return false;
  }
  return true;
}

function getPeriodForFrequency(frequency: 'semanal' | 'quincenal' | 'mensual'): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setHours(23, 59, 59, 999);

  let periodStart: Date;
  switch (frequency) {
    case 'semanal': {
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);
      periodStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'quincenal': {
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 15);
      periodStart.setHours(0, 0, 0, 0);
      break;
    }
    case 'mensual': {
      periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1, 0, 0, 0, 0);
      periodStart.setMonth(periodStart.getMonth() - 1);
      break;
    }
    default:
      periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);
      periodStart.setHours(0, 0, 0, 0);
  }

  return { periodStart, periodEnd };
}

const cronRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/cron/scheduled-runs?frequency=semanal
  fastify.get<{
    Querystring: { frequency: string };
  }>('/scheduled-runs', async (request, reply) => {
    if (!checkCronSecret(request, reply)) return;

    const schema = z.object({
      frequency: z.enum(RUN_SCHEDULE_VALUES),
    });
    const parsed = schema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'frequency debe ser semanal, quincenal o mensual' });
    }

    const { frequency } = parsed.data;
    const { periodStart, periodEnd } = getPeriodForFrequency(frequency);

    const brands = await prisma.brand.findMany({
      where: { runSchedule: frequency },
      select: {
        id: true,
        tenantId: true,
        name: true,
      },
    });

    const items = brands.map((b) => ({
      brandId: b.id,
      tenantId: b.tenantId,
      brandName: b.name,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    }));

    return { items, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() };
  });
};

export default cronRoutes;
