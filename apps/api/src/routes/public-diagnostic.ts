import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { isEmailConfigured, isEmailDisabled, sendDiagnosticLink } from '../lib/email';
import { executeRun } from '../lib/run-executor';
import { determineIndustry, getTop5Competitors } from '../lib/diagnostic-ai';
import { getIntentionForIndustry, buildDiagnosticPrompts } from '../lib/diagnostic-prompts';
import { buildRunContext, generateDiagnosticAnalysis } from '../lib/diagnostic-analysis';

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
  // Turnstile deshabilitado (URLs dinámicas de Vercel). Reactivar cuando haya dominio estable.

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

        // 3b. Intención automática (Urgencia vs Consideración) según industria
        const intention = getIntentionForIndustry(industry);
        const diagnosticPrompts = buildDiagnosticPrompts(
          trimmedBrand,
          industry,
          competitors,
          intention
        );

        // 3c. Crear versión de prompts dinámica para este diagnóstico
        const promptVersion = await prisma.promptVersion.create({
          data: {
            tenantId: rootTenant.id,
            name: `DIAG_${diagnostic.id}`,
            active: false, // Solo para este diagnóstico, no interfiere con runs del admin
          },
        });
        for (const p of diagnosticPrompts) {
          await prisma.prompt.create({
            data: {
              promptVersionId: promptVersion.id,
              name: p.name,
              promptText: p.promptText,
              active: true,
            },
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

        await executeRun(run.id, { promptVersionId: promptVersion.id });

        let analysisJson: object | null = null;
        try {
          const fullRun = await prisma.run.findUnique({
            where: { id: run.id },
            include: {
              promptResults: {
                include: { prompt: { select: { promptText: true } } },
                orderBy: { createdAt: 'asc' },
              },
              brand: { include: { competitors: true } },
            },
          });
          const priaReport = await prisma.pRIAReport.findFirst({
            where: { runId: run.id },
            orderBy: { createdAt: 'desc' },
          });
          if (fullRun && priaReport) {
            const ctx = buildRunContext({
              run: fullRun,
              priaReport,
              industry: industry || diagnostic.industry || 'General',
            });
            const analysis = await generateDiagnosticAnalysis(ctx);
            if (analysis) analysisJson = analysis;
          }
        } catch (analysisErr) {
          fastify.log.warn({ err: analysisErr, diagnosticId: diagnostic.id }, 'Análisis IA no generado');
        }

        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: {
            status: 'completed',
            ...(analysisJson != null ? { analysisJson: analysisJson as object } : {}),
          },
        });

        const current = await prisma.publicDiagnostic.findUnique({
          where: { id: diagnostic.id },
        });
        if (current?.email) {
          const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          try {
            if (!isEmailDisabled() && isEmailConfigured()) {
              await sendDiagnosticLink(
                current.email,
                diagnostic.id,
                baseUrl,
                analysisJson ? (analysisJson as import('../lib/email').DiagnosticAnalysisForEmail) : null
              );
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
          const analysis =
            diagnostic.analysisJson && typeof diagnostic.analysisJson === 'object' && !Array.isArray(diagnostic.analysisJson)
              ? (diagnostic.analysisJson as import('../lib/email').DiagnosticAnalysisForEmail)
              : null;
          await sendDiagnosticLink(email, id, baseUrl, analysis);
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
        brandId: string;
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

    // 11 pasos fijos del análisis (todos deben cumplirse en el proceso)
    const DIAGNOSTIC_STEP_LABELS = [
      'Verificando acceso de IA al sitio',
      'Analizando orden para IA',
      'Midiendo claridad de respuesta',
      'Evaluando autoridad real',
      'Chequeando idioma para IA',
      'Revisando actualización de info',
      'Detectando confianza real',
      'Testeando carga y funcionamiento',
      'Rastreando menciones externas',
      'Midiendo intención cubierta',
      'Evaluando comprensión por IA',
    ];

    let steps: Array<{ id: string; label: string; completed: boolean }>;
    let progressPercent: number;

    if (diagnostic.runId && (diagnostic.status === 'running' || diagnostic.status === 'completed')) {
      const run = await prisma.run.findUnique({
        where: { id: diagnostic.runId },
        include: {
          promptResults: { select: { promptId: true }, orderBy: { createdAt: 'asc' } },
          priaReports: { take: 1, orderBy: { createdAt: 'desc' } },
          brand: { select: { name: true } },
        },
      });
      const completedCount = run?.promptResults.length ?? 0;
      const preCompleted = (!!diagnostic.industry ? 1 : 0) + (!!diagnostic.runId ? 1 : 0);
      const analysisStepsCount = DIAGNOSTIC_STEP_LABELS.length - 2;

      steps = DIAGNOSTIC_STEP_LABELS.map((label, idx) => {
        let completed: boolean;
        if (idx < 2) {
          completed = idx === 0 ? !!diagnostic.industry : !!diagnostic.runId;
        } else {
          completed = completedCount > idx - 2;
        }
        return { id: `step-${idx + 1}`, label, completed };
      });
      progressPercent = Math.round(
        ((preCompleted + Math.min(completedCount, analysisStepsCount)) / DIAGNOSTIC_STEP_LABELS.length) * 100
      );
      base.steps = steps;
      base.progressPercent = progressPercent;

      if (run && diagnostic.status === 'completed' && run.priaReports[0]) {
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
            brandId: fullRun.brand.id,
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
      const preCompleted = (!!diagnostic.industry ? 1 : 0) + (!!diagnostic.runId ? 1 : 0);
      steps = DIAGNOSTIC_STEP_LABELS.map((label, idx) => ({
        id: `step-${idx + 1}`,
        label,
        completed: idx < 2 && (idx === 0 ? !!diagnostic.industry : !!diagnostic.runId),
      }));
      progressPercent = Math.round((preCompleted / DIAGNOSTIC_STEP_LABELS.length) * 100);
      base.steps = steps;
      base.progressPercent = progressPercent;
    }

    return base;
  });
};

export default publicDiagnosticRoutes;
