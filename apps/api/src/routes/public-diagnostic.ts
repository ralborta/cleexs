import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { isEmailConfigured, isEmailDisabled, sendDiagnosticLink } from '../lib/email';
import { executeRun } from '../lib/run-executor';
import { determineIndustry, getTop5Competitors } from '../lib/diagnostic-ai';

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50);
}

const publicDiagnosticRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/public/diagnostic — marca (obligatoria) + url (opcional). IA determina industria y 5 competidores antes del run.
  fastify.post<{
    Body: { brandName: string; url?: string };
  }>('/diagnostic', async (request, reply) => {
    try {
      const schema = z.object({
        brandName: z.string().min(1).max(200),
        url: z.union([z.string().max(500), z.undefined()]).optional(),
      });
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.errors.map((e) => e.message).join(', ') || 'Datos inválidos.',
        });
      }
      const { brandName, url } = parsed.data;
      const trimmedBrand = brandName.trim();

      let domain: string;
      if (url && typeof url === 'string' && url.trim()) {
        domain = normalizeDomain(url.trim());
        const existing = await prisma.publicDiagnostic.findUnique({ where: { domain } });
        if (existing) {
          return reply.code(409).send({
            error: 'Esta URL o dominio ya tiene un diagnóstico. Iniciá sesión para verlo o contactanos.',
            code: 'DOMAIN_ALREADY_USED',
          });
        }
      } else {
        domain = `brand-${slugify(trimmedBrand)}-${Date.now().toString(36)}`;
      }

      if (!process.env.OPENAI_API_KEY) {
        return reply.code(503).send({
          error: 'El servicio de análisis no está disponible. Intentá más tarde.',
        });
      }

      const rootTenant = await prisma.tenant.findFirst({
        where: { tenantCode: '000' },
      });
      if (!rootTenant) {
        fastify.log.error('Tenant root (000) no encontrado. Ejecutá prisma db seed.');
        return reply.code(500).send({
          error: 'Configuración del sistema incompleta. Verificá que se haya ejecutado el seed de la base de datos.',
        });
      }

      const diagnostic = await prisma.publicDiagnostic.create({
        data: {
          brandName: trimmedBrand,
          domain,
          status: 'running',
        },
      });

      setImmediate(async () => {
      try {
        // 1. IA determina industria (antes del run)
        const { industry } = await determineIndustry(trimmedBrand, url?.trim());
        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: { industry },
        });

        // 2. IA elige 5 competidores
        const { competitors } = await getTop5Competitors(trimmedBrand, industry);

        // 3. Crear Brand con industria y competidores
        const brand = await prisma.brand.create({
          data: {
            tenantId: rootTenant.id,
            name: trimmedBrand,
            domain: url?.trim() ? normalizeDomain(url.trim()) : null,
            industry,
          },
        });

        for (const name of competitors) {
          await prisma.competitor.create({
            data: { brandId: brand.id, name: name.trim() || 'Competidor' },
          });
        }

        // 4. Crear Run y ejecutar
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

        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: { runId: run.id },
        });

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
        fastify.log.error({ err, diagnosticId: diagnostic.id }, 'Error en diagnóstico');
        await prisma.publicDiagnostic
          .update({ where: { id: diagnostic.id }, data: { status: 'failed' } })
          .catch(() => {});
      }
    });

      return reply.code(201).send({ diagnosticId: diagnostic.id });
    } catch (err) {
      fastify.log.error({ err, body: request.body }, 'Error POST /diagnostic');
      const message = err instanceof Error ? err.message : 'Error interno';
      const isPrisma = message.includes('column') || message.includes('does not exist') || message.includes('Unknown');
      return reply.code(500).send({
        error: isPrisma
          ? 'Error de base de datos. Ejecutá en Railway: railway run npx prisma migrate deploy'
          : 'Error interno al crear el diagnóstico. Intentá de nuevo.',
      });
    }
  });

  // PATCH /api/public/diagnostic/:id — guarda email (al final del flujo)
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
        if (!isEmailDisabled() && isEmailConfigured()) {
          await sendDiagnosticLink(email, id, baseUrl);
          emailSent = true;
        } else {
          emailSent = false;
        }
      } catch (err) {
        emailSent = false;
        fastify.log.error({ err, diagnosticId: id, email }, 'Error al enviar email');
      }
    }

    return reply.code(200).send({ ok: true, emailSent });
  });

  // GET /api/public/diagnostic/:id — estado, steps (industria, competidores, prompts) y resultado con Cleexs Score
  fastify.get<{ Params: { id: string } }>('/diagnostic/:id', async (request, reply) => {
    const diagnostic = await prisma.publicDiagnostic.findUnique({
      where: { id: request.params.id },
    });
    if (!diagnostic) {
      return reply.code(404).send({ error: 'Diagnóstico no encontrado' });
    }

    const base: {
      id: string;
      domain: string;
      brandName: string;
      industry?: string | null;
      status: string;
      runId?: string | null;
      steps?: Array<{ id: string; label: string; completed: boolean }>;
      progressPercent?: number;
      runResult?: {
        brandName: string;
        cleexsScore: number;
        competitors: string[];
        brandAliases: string[];
        promptResults: Array<{
          category: string;
          score: number;
          promptText?: string;
          responseText?: string;
          top3Json?: Array<{ position: number; name: string; type: string; reason?: string }>;
          flags?: Record<string, boolean>;
        }>;
      };
    } = {
      id: diagnostic.id,
      domain: diagnostic.domain,
      brandName: diagnostic.brandName,
      industry: diagnostic.industry,
      status: diagnostic.status,
      runId: diagnostic.runId,
    };

    // Steps: Determinando industria, Seleccionando competidores, + prompts del run
    const preSteps: Array<{ id: string; label: string; completed: boolean }> = [
      { id: 'industry', label: 'Determinando tipo de industria', completed: !!diagnostic.industry },
      { id: 'competitors', label: 'Seleccionando 5 competidores', completed: !!diagnostic.runId },
    ];

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
          const promptSteps = prompts.map((p) => ({
            id: p.id,
            label: p.name || p.promptText.slice(0, 50) + (p.promptText.length > 50 ? '…' : '') || 'Análisis',
            completed: resultPromptIds.has(p.id),
          }));
          base.steps = [...preSteps, ...promptSteps];
          base.progressPercent =
            prompts.length > 0
              ? Math.round(
                  ((preSteps.filter((s) => s.completed).length + run.promptResults.length) /
                    (preSteps.length + prompts.length)) *
                    100
                )
              : preSteps.filter((s) => s.completed).length * 50;
        } else {
          base.steps = preSteps;
          base.progressPercent = preSteps.filter((s) => s.completed).length * 50;
        }
        if (diagnostic.status === 'completed' && run.priaReports[0]) {
          const fullRun = await prisma.run.findUnique({
            where: { id: diagnostic.runId },
            include: {
              promptResults: {
                include: {
                  prompt: { include: { category: true } },
                },
                orderBy: { createdAt: 'asc' },
              },
              brand: {
                include: { competitors: true, aliases: true },
              },
            },
          });
          if (fullRun) {
            const cleexsScore = run.priaReports[0].priaTotal;
            base.runResult = {
              brandName: fullRun.brand.name,
              cleexsScore,
              competitors: fullRun.brand.competitors.map((c) => c.name),
              brandAliases: fullRun.brand.aliases.map((a) => a.alias),
              promptResults: fullRun.promptResults.map((pr) => ({
                category: pr.prompt?.category?.name ?? 'General',
                score: pr.score,
                promptText: pr.prompt?.promptText ?? '',
                responseText: pr.responseText,
                top3Json: pr.top3Json as Array<{ position: number; name: string; type: string; reason?: string }>,
                flags: (pr.flags as Record<string, boolean>) ?? {},
              })),
            };
          }
        }
      } else {
        base.steps = preSteps;
        base.progressPercent = preSteps.filter((s) => s.completed).length * 50;
      }
    } else {
      base.steps = preSteps;
      base.progressPercent = preSteps.filter((s) => s.completed).length * 50;
    }

    return base;
  });
};

export default publicDiagnosticRoutes;
