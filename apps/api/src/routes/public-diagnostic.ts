import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { isEmailConfigured, isEmailDisabled, sendDiagnosticLink } from '../lib/email';
import { executeRun } from '../lib/run-executor';

function normalizeDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.toLowerCase();
    const parts = host.split('.');
    if (parts.length >= 2) {
      const base = parts.slice(-2).join('.');
      return base.replace(/^www\./, '');
    }
    return host.replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^www\./, '').split('/')[0] || url;
  }
}

const publicDiagnosticRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/public/diagnostic — inicia diagnóstico con marca + URL, crea Run automático
  fastify.post<{
    Body: { brandName: string; url: string };
  }>('/diagnostic', async (request, reply) => {
    const schema = z.object({
      brandName: z.string().min(1).max(200),
      url: z.string().min(1).max(500),
    });
    const { brandName, url } = schema.parse(request.body);
    const domain = normalizeDomain(url);

    const existing = await prisma.publicDiagnostic.findUnique({
      where: { domain },
    });
    if (existing) {
      return reply.code(409).send({
        error: 'Esta URL o dominio ya tiene un diagnóstico. Iniciá sesión para verlo o contactanos.',
        code: 'DOMAIN_ALREADY_USED',
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return reply.code(503).send({
        error: 'El servicio de análisis no está disponible. Intentá más tarde.',
      });
    }

    const rootTenant = await prisma.tenant.findFirst({
      where: { tenantCode: '000' },
      include: { plan: true },
    });
    if (!rootTenant) {
      return reply.code(500).send({ error: 'Configuración del sistema incompleta.' });
    }

    const brand = await prisma.brand.create({
      data: {
        tenantId: rootTenant.id,
        name: brandName.trim(),
        domain,
      },
    });

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const run = await prisma.run.create({
      data: {
        tenantId: rootTenant.id,
        brandId: brand.id,
        periodStart,
        periodEnd,
        runType: 'diagnostic',
        status: 'pending',
      },
    });

    const diagnostic = await prisma.publicDiagnostic.create({
      data: {
        brandName: brandName.trim(),
        domain,
        runId: run.id,
        status: 'running',
      },
    });

    setImmediate(async () => {
      try {
        await executeRun(run.id);
        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: { status: 'completed' },
        });
        const current = await prisma.publicDiagnostic.findUnique({
          where: { id: diagnostic.id },
        });
        if (current?.email) {
          const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          try {
            if (!isEmailDisabled() && isEmailConfigured()) {
              await sendDiagnosticLink(current.email, diagnostic.id, baseUrl);
              fastify.log.info({ diagnosticId: diagnostic.id, email: current.email }, 'Email enviado');
            }
          } catch (mailErr) {
            fastify.log.error({ err: mailErr, diagnosticId: diagnostic.id }, 'Error al enviar email');
          }
        }
      } catch (err) {
        fastify.log.error({ err, diagnosticId: diagnostic.id, runId: run.id }, 'Error ejecutando run');
        await prisma.publicDiagnostic
          .update({ where: { id: diagnostic.id }, data: { status: 'failed' } })
          .catch(() => {});
        await prisma.run.update({ where: { id: run.id }, data: { status: 'failed' } }).catch(() => {});
      }
    });

    return reply.code(201).send({ diagnosticId: diagnostic.id });
  });

  // PATCH /api/public/diagnostic/:id — guarda email (al final del flujo, para enviar resultado)
  fastify.patch<{
    Params: { id: string };
    Body: { email: string };
  }>('/diagnostic/:id', async (request, reply) => {
    const schema = z.object({ email: z.string().email() });
    const { id } = request.params;
    const { email } = schema.parse(request.body);

    const diagnostic = await prisma.publicDiagnostic.findUnique({ where: { id } });
    if (!diagnostic) {
      return reply.code(404).send({ error: 'Diagnóstico no encontrado' });
    }

    await prisma.publicDiagnostic.update({
      where: { id },
      data: { email },
    });

    let emailSent: boolean | null = null;
    if (diagnostic.status === 'completed') {
      const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      try {
        if (isEmailDisabled()) {
          emailSent = false;
        } else if (!isEmailConfigured()) {
          emailSent = false;
        } else {
          await sendDiagnosticLink(email, id, baseUrl);
          emailSent = true;
        }
      } catch (err) {
        emailSent = false;
        fastify.log.error({ err, diagnosticId: id, email }, 'Error al enviar email');
      }
    }

    return reply.code(200).send({ ok: true, emailSent });
  });

  // GET /api/public/diagnostic/:id — estado, steps para progression y datos para /ver-resultado
  fastify.get<{ Params: { id: string } }>('/diagnostic/:id', async (request, reply) => {
    const diagnostic = await prisma.publicDiagnostic.findUnique({
      where: { id: request.params.id },
    });
    if (!diagnostic) {
      return reply.code(404).send({ error: 'Diagnóstico no encontrado' });
    }

    const base: { id: string; domain: string; brandName?: string | null; status: string; runId?: string | null; steps?: Array<{ id: string; label: string; completed: boolean }>; progressPercent?: number } = {
      id: diagnostic.id,
      domain: diagnostic.domain,
      brandName: diagnostic.brandName,
      status: diagnostic.status,
      runId: diagnostic.runId,
    };

    if (diagnostic.runId && (diagnostic.status === 'running' || diagnostic.status === 'completed')) {
      const run = await prisma.run.findUnique({
        where: { id: diagnostic.runId },
        include: {
          promptResults: {
            select: { promptId: true, score: true },
            orderBy: { createdAt: 'asc' },
          },
          priaReports: { take: 1, orderBy: { createdAt: 'desc' } },
          brand: { select: { name: true } },
        },
      });
      if (run) {
        let prompts: Array<{ id: string; name: string | null; promptText: string; category: { name: string } | null }> = [];
        const promptVersion = await prisma.promptVersion.findFirst({
          where: { tenantId: run.tenantId, active: true },
          orderBy: { createdAt: 'desc' },
        });
        if (promptVersion) {
          prompts = await prisma.prompt.findMany({
            where: { promptVersionId: promptVersion.id, active: true },
            orderBy: { createdAt: 'asc' },
            include: { category: true },
          });
          const resultPromptIds = new Set(run.promptResults.map((r) => r.promptId));
          base.steps = prompts.map((p) => ({
            id: p.id,
            label: p.name || p.promptText.slice(0, 50) + (p.promptText.length > 50 ? '…' : '') || 'Análisis',
            completed: resultPromptIds.has(p.id),
          }));
          base.progressPercent =
            prompts.length > 0 ? Math.round((run.promptResults.length / prompts.length) * 100) : 0;
        }
        if (diagnostic.status === 'completed' && run.priaReports[0]) {
          (base as Record<string, unknown>).runResult = {
            brandName: run.brand.name,
            priaTotal: run.priaReports[0].priaTotal,
            priaByCategory: run.priaReports[0].priaByCategoryJson as Record<string, number>,
            promptResults: run.promptResults.map((pr) => {
              const prompt = prompts.find((p) => p.id === pr.promptId);
              return {
                category: prompt?.category?.name ?? 'General',
                score: pr.score,
              };
            }),
          };
        }
      }
    }

    return base;
  });
};

export default publicDiagnosticRoutes;
