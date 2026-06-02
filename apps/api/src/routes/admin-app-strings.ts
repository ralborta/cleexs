/**
 * Mini-CMS interno de textos editables (`app_strings`).
 *
 * Endpoints:
 *   GET    /api/admin/strings                  — lista todos los overrides
 *   PUT    /api/admin/strings/:key             — upsert (crea o pisa) un override
 *   DELETE /api/admin/strings/:key             — borra el override y vuelve al default del código
 *   GET    /api/public/strings?locale=es       — endpoint público para el frontend (sin auth, cache 60s)
 *
 * Auth admin: header `x-admin-secret: $ADMIN_API_SECRET` (mismo patrón que admin-entitlements).
 */

import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function requireAdminSecret(request: FastifyRequest): boolean {
  const secret = process.env.ADMIN_API_SECRET?.trim();
  if (!secret) return false;
  const h = request.headers['x-admin-secret'];
  return typeof h === 'string' && h === secret;
}

function adminAuthGuard(request: FastifyRequest, reply: any): boolean {
  if (requireAdminSecret(request)) return true;
  reply.code(process.env.ADMIN_API_SECRET ? 401 : 503).send({
    error: process.env.ADMIN_API_SECRET
      ? 'No autorizado'
      : 'ADMIN_API_SECRET no configurado en el servidor',
  });
  return false;
}

const upsertSchema = z.object({
  value: z.string().min(0).max(8000),
  locale: z.enum(SUPPORTED_LOCALES).default('es'),
  notes: z.string().max(1000).optional().nullable(),
  updatedBy: z.string().max(120).optional().nullable(),
});

const listQuerySchema = z.object({
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  search: z.string().trim().max(120).optional(),
});

const adminAppStringsRoutes: FastifyPluginAsync = async (fastify) => {
  // ---------------------------------------------------------------
  // GET /api/admin/strings — lista (admin)
  // ---------------------------------------------------------------
  fastify.get<{ Querystring: z.infer<typeof listQuerySchema> }>('/strings', async (request, reply) => {
    if (!adminAuthGuard(request, reply)) return;
    const parsed = listQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'query_invalida' });
    }

    const where: any = {};
    if (parsed.data.locale) where.locale = parsed.data.locale;
    if (parsed.data.search) {
      where.OR = [
        { key: { contains: parsed.data.search, mode: 'insensitive' } },
        { value: { contains: parsed.data.search, mode: 'insensitive' } },
      ];
    }

    const rows = await prisma.appString.findMany({
      where,
      orderBy: [{ key: 'asc' }, { locale: 'asc' }],
      take: 500,
    });
    return { items: rows, total: rows.length };
  });

  // ---------------------------------------------------------------
  // PUT /api/admin/strings/:key — upsert (admin)
  // ---------------------------------------------------------------
  fastify.put<{ Params: { key: string }; Body: z.infer<typeof upsertSchema> }>(
    '/strings/:key',
    async (request, reply) => {
      if (!adminAuthGuard(request, reply)) return;

      const rawKey = (request.params.key || '').trim();
      if (!rawKey || rawKey.length > 200 || !/^[a-z0-9._:-]+$/i.test(rawKey)) {
        return reply.code(400).send({
          error: 'key_invalida',
          message: 'La key debe tener solo letras, números, ".", "_", ":" o "-".',
        });
      }

      const parsed = upsertSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'payload_invalido', issues: parsed.error.issues });
      }

      const row = await prisma.appString.upsert({
        where: { key_locale: { key: rawKey, locale: parsed.data.locale } },
        create: {
          key: rawKey,
          locale: parsed.data.locale,
          value: parsed.data.value,
          notes: parsed.data.notes ?? null,
          updatedBy: parsed.data.updatedBy ?? null,
        },
        update: {
          value: parsed.data.value,
          notes: parsed.data.notes ?? null,
          updatedBy: parsed.data.updatedBy ?? null,
        },
      });

      return { ok: true, item: row };
    }
  );

  // ---------------------------------------------------------------
  // DELETE /api/admin/strings/:key — borra (admin) y vuelve al default del código
  // ---------------------------------------------------------------
  fastify.delete<{ Params: { key: string }; Querystring: { locale?: SupportedLocale } }>(
    '/strings/:key',
    async (request, reply) => {
      if (!adminAuthGuard(request, reply)) return;
      const key = (request.params.key || '').trim();
      const locale = (request.query.locale || 'es') as SupportedLocale;
      try {
        await prisma.appString.delete({
          where: { key_locale: { key, locale } },
        });
        return { ok: true };
      } catch (err: any) {
        if (err?.code === 'P2025') {
          return { ok: true, alreadyEmpty: true };
        }
        throw err;
      }
    }
  );
};

// Endpoint público (sin auth) para el helper t() del frontend.
// Lo registramos por separado porque va con otro prefix.
export const publicAppStringsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: { locale?: string } }>('/strings', async (request, reply) => {
    const locale = (request.query.locale || 'es').toLowerCase();
    if (!SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
      return reply.code(400).send({ error: 'locale_no_soportado' });
    }
    const rows = await prisma.appString.findMany({
      where: { locale },
      select: { key: true, value: true },
    });
    const dict: Record<string, string> = {};
    for (const r of rows) dict[r.key] = r.value;

    // Cache navegador 60s, CDN 60s, stale-while-revalidate 5 min.
    reply.header('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
    return { locale, strings: dict, count: rows.length };
  });
};

export default adminAppStringsRoutes;
