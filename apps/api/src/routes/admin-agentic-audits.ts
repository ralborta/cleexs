/**
 * J101 — Auditoría Agéntica (producto standalone de venta única).
 *
 * Endpoints admin (header `x-admin-secret: $ADMIN_API_SECRET`):
 *   GET    /api/admin/agentic-audits          — lista
 *   POST   /api/admin/agentic-audits          — crea + corre el análisis
 *   GET    /api/admin/agentic-audits/:id      — detalle
 *   POST   /api/admin/agentic-audits/:id/run  — re-corre el análisis
 *   PATCH  /api/admin/agentic-audits/:id       — marca pagada / entregada / notas
 *   DELETE /api/admin/agentic-audits/:id       — elimina
 *
 * Endpoint público (sin auth) para el link que se le pasa al cliente:
 *   GET    /api/public/agentic-audit/:slug
 */

import type { FastifyRequest } from 'fastify';
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { runAgenticAudit } from '../lib/agentic-audit';

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

function makeSlug(label: string): string {
  const base = (label || 'auditoria')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'auditoria';
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${rand}`;
}

function hostnameLabel(url: string): string {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const createSchema = z.object({
  targetUrl: z.string().trim().min(3).max(500),
  siteLabel: z.string().trim().max(160).optional().nullable(),
  brandId: z.string().trim().max(80).optional().nullable(),
  clientEmail: z.string().trim().email().max(160).optional().or(z.literal('')).nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  createdBy: z.string().trim().max(120).optional().nullable(),
});

const patchSchema = z.object({
  paid: z.boolean().optional(),
  delivered: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  siteLabel: z.string().trim().max(160).optional().nullable(),
  clientEmail: z.string().trim().email().max(160).optional().or(z.literal('')).nullable(),
});

/** Corre la auditoría y persiste el resultado (no lanza: deja status failed). */
async function runAndPersist(id: string, targetUrl: string): Promise<void> {
  await prisma.agenticAudit.update({ where: { id }, data: { status: 'running', error: null } });
  try {
    const result = await runAgenticAudit(targetUrl);
    await prisma.agenticAudit.update({
      where: { id },
      data: {
        status: 'completed',
        overallScore: result.overallScore,
        resultJson: result as unknown as object,
        error: null,
      },
    });
  } catch (err) {
    await prisma.agenticAudit.update({
      where: { id },
      data: { status: 'failed', error: err instanceof Error ? err.message : 'Error desconocido' },
    });
  }
}

const adminAgenticAuditsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET lista
  fastify.get('/agentic-audits', async (request, reply) => {
    if (!adminAuthGuard(request, reply)) return;
    const rows = await prisma.agenticAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        slug: true,
        targetUrl: true,
        siteLabel: true,
        clientEmail: true,
        status: true,
        overallScore: true,
        paidAt: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { items: rows, total: rows.length };
  });

  // POST crea + corre
  fastify.post<{ Body: z.infer<typeof createSchema> }>('/agentic-audits', async (request, reply) => {
    if (!adminAuthGuard(request, reply)) return;
    const parsed = createSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'payload_invalido', issues: parsed.error.issues });
    }
    const { targetUrl, brandId, notes, createdBy } = parsed.data;
    const siteLabel = parsed.data.siteLabel?.trim() || hostnameLabel(targetUrl);
    const clientEmail = parsed.data.clientEmail?.trim() || null;

    const row = await prisma.agenticAudit.create({
      data: {
        slug: makeSlug(siteLabel),
        targetUrl: targetUrl.trim(),
        siteLabel,
        brandId: brandId?.trim() || null,
        clientEmail,
        notes: notes?.trim() || null,
        createdBy: createdBy?.trim() || null,
        status: 'pending',
      },
    });

    // Corre en background; el cliente puede pollear el detalle.
    void runAndPersist(row.id, row.targetUrl);

    return reply.code(201).send({ ok: true, item: row });
  });

  // GET detalle
  fastify.get<{ Params: { id: string } }>('/agentic-audits/:id', async (request, reply) => {
    if (!adminAuthGuard(request, reply)) return;
    const row = await prisma.agenticAudit.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.code(404).send({ error: 'no_encontrada' });
    return { item: row };
  });

  // POST re-corre
  fastify.post<{ Params: { id: string } }>('/agentic-audits/:id/run', async (request, reply) => {
    if (!adminAuthGuard(request, reply)) return;
    const row = await prisma.agenticAudit.findUnique({ where: { id: request.params.id } });
    if (!row) return reply.code(404).send({ error: 'no_encontrada' });
    void runAndPersist(row.id, row.targetUrl);
    return { ok: true, status: 'running' };
  });

  // PATCH marca pagada / entregada / notas
  fastify.patch<{ Params: { id: string }; Body: z.infer<typeof patchSchema> }>(
    '/agentic-audits/:id',
    async (request, reply) => {
      if (!adminAuthGuard(request, reply)) return;
      const parsed = patchSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({ error: 'payload_invalido', issues: parsed.error.issues });
      }
      const data: Record<string, unknown> = {};
      if (parsed.data.paid !== undefined) data.paidAt = parsed.data.paid ? new Date() : null;
      if (parsed.data.delivered !== undefined) data.deliveredAt = parsed.data.delivered ? new Date() : null;
      if (parsed.data.notes !== undefined) data.notes = parsed.data.notes?.trim() || null;
      if (parsed.data.siteLabel !== undefined) data.siteLabel = parsed.data.siteLabel?.trim() || null;
      if (parsed.data.clientEmail !== undefined) data.clientEmail = parsed.data.clientEmail?.trim() || null;

      try {
        const row = await prisma.agenticAudit.update({ where: { id: request.params.id }, data });
        return { ok: true, item: row };
      } catch (err: any) {
        if (err?.code === 'P2025') return reply.code(404).send({ error: 'no_encontrada' });
        throw err;
      }
    },
  );

  // DELETE
  fastify.delete<{ Params: { id: string } }>('/agentic-audits/:id', async (request, reply) => {
    if (!adminAuthGuard(request, reply)) return;
    try {
      await prisma.agenticAudit.delete({ where: { id: request.params.id } });
      return { ok: true };
    } catch (err: any) {
      if (err?.code === 'P2025') return { ok: true, alreadyGone: true };
      throw err;
    }
  });
};

// Endpoint público (sin auth) para el informe que ve el cliente.
export const publicAgenticAuditRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { slug: string } }>('/agentic-audit/:slug', async (request, reply) => {
    const slug = (request.params.slug || '').trim();
    if (!slug) return reply.code(400).send({ error: 'slug_invalido' });
    const row = await prisma.agenticAudit.findUnique({ where: { slug } });
    if (!row) return reply.code(404).send({ error: 'no_encontrada' });

    reply.header('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=120');
    return {
      slug: row.slug,
      siteLabel: row.siteLabel,
      targetUrl: row.targetUrl,
      status: row.status,
      overallScore: row.overallScore,
      result: row.resultJson,
      generatedAt: row.updatedAt,
    };
  });
};

export default adminAgenticAuditsRoutes;
