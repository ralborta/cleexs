import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { sendDiagnosticLink } from '../lib/email';

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
  // POST /api/public/diagnostic — inicia diagnóstico (una medición por dominio)
  fastify.post<{
    Body: { url: string };
  }>('/diagnostic', async (request, reply) => {
    const schema = z.object({ url: z.string().min(1).max(500) });
    const { url } = schema.parse(request.body);
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

    const diagnostic = await prisma.publicDiagnostic.create({
      data: { domain, status: 'pending' },
    });

    // Simular medición en background (luego integrar con Run real)
    setImmediate(async () => {
      try {
        await prisma.publicDiagnostic.update({
          where: { id: diagnostic.id },
          data: { status: 'running' },
        });
        // Por ahora: esperar unos segundos y marcar completado (placeholder)
        await new Promise((r) => setTimeout(r, 8000));
        const current = await prisma.publicDiagnostic.findUnique({
          where: { id: diagnostic.id },
        });
        if (current && current.status === 'running') {
          const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          await prisma.publicDiagnostic.update({
            where: { id: diagnostic.id },
            data: { status: 'completed' },
          });
          if (current.email) {
            await sendDiagnosticLink(current.email, diagnostic.id, baseUrl);
            fastify.log.info({ diagnosticId: diagnostic.id, email: current.email }, 'Email enviado');
          }
        }
      } catch (err) {
        fastify.log.error(err);
        await prisma.publicDiagnostic
          .update({ where: { id: diagnostic.id }, data: { status: 'failed' } })
          .catch(() => {});
      }
    });

    return reply.code(201).send({ diagnosticId: diagnostic.id });
  });

  // PATCH /api/public/diagnostic/:id — guarda email (desde pantalla "Estamos verificando")
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

    // Si ya estaba completado (usuario tardó en poner email), enviar link ahora
    if (diagnostic.status === 'completed') {
      const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      sendDiagnosticLink(email, id, baseUrl).catch((err) => fastify.log.error(err));
    }

    return reply.code(200).send({ ok: true });
  });

  // GET /api/public/diagnostic/:id — estado y datos para /ver-resultado
  fastify.get<{ Params: { id: string } }>('/diagnostic/:id', async (request, reply) => {
    const diagnostic = await prisma.publicDiagnostic.findUnique({
      where: { id: request.params.id },
    });
    if (!diagnostic) {
      return reply.code(404).send({ error: 'Diagnóstico no encontrado' });
    }
    return {
      id: diagnostic.id,
      domain: diagnostic.domain,
      status: diagnostic.status,
      runId: diagnostic.runId,
    };
  });
};

export default publicDiagnosticRoutes;
