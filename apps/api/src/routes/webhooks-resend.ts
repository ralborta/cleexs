import type { FastifyRequest } from 'fastify';
import type { FastifyPluginAsync } from 'fastify';
import { Webhook } from 'svix';
import { prisma } from '../lib/prisma';
import { updateLeadEmailFromResendEvent } from '../lib/lead-email-sender';

type ResendWebhookBody = {
  type: string;
  created_at: string;
  data?: {
    email_id?: string;
    to?: string[];
    broadcast_id?: string;
    subject?: string;
    tags?: Record<string, unknown>;
  };
};

function header(request: FastifyRequest, name: string): string | undefined {
  const h = request.headers[name.toLowerCase()];
  return typeof h === 'string' ? h : undefined;
}

const webhooksResendRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/webhooks/resend',
    {
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
      if (!secret) {
        return reply.code(503).send({ error: 'RESEND_WEBHOOK_SECRET no configurado en la API' });
      }

      const rawBody = typeof (request as FastifyRequest & { rawBody?: string }).rawBody === 'string'
        ? (request as FastifyRequest & { rawBody: string }).rawBody
        : undefined;

      if (!rawBody) {
        return reply.code(400).send({ error: 'Cuerpo raw requerido (config rawBody)' });
      }

      const svixId = header(request, 'svix-id');
      const svixTimestamp = header(request, 'svix-timestamp');
      const svixSignature = header(request, 'svix-signature');

      if (!svixId || !svixTimestamp || !svixSignature) {
        return reply.code(400).send({ error: 'Faltan cabeceras Svix (svix-id, svix-timestamp, svix-signature)' });
      }

      let evt: ResendWebhookBody;
      try {
        evt = new Webhook(secret).verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as ResendWebhookBody;
      } catch (e) {
        fastify.log.warn({ err: e }, 'Resend webhook verify failed');
        return reply.code(401).send({ error: 'Firma inválida' });
      }

      const eventType = evt.type || 'unknown';
      const data = evt.data ?? {};
      const emailId = typeof data.email_id === 'string' ? data.email_id : null;
      const to0 = Array.isArray(data.to) && typeof data.to[0] === 'string' ? data.to[0].toLowerCase() : null;

      let occurredAt: Date | null = null;
      try {
        if (evt.created_at) occurredAt = new Date(evt.created_at);
      } catch {
        occurredAt = null;
      }
      const occurredAtFinal = occurredAt ?? new Date();

      try {
        await prisma.cleexsResendWebhookEvent.create({
          data: {
            svixId,
            eventType,
            emailId,
            recipientEmail: to0,
            occurredAt: occurredAtFinal,
            payload: evt as object,
          },
        });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code === 'P2002') {
          return reply.code(200).send({ ok: true, duplicate: true });
        }
        throw e;
      }

      if (emailId) {
        try {
          await updateLeadEmailFromResendEvent(emailId, eventType);
        } catch (e) {
          fastify.log.warn({ err: e, emailId, eventType }, 'No se pudo actualizar LeadEmail desde webhook Resend');
        }
      }

      return reply.code(200).send({ ok: true });
    },
  );
};

export default webhooksResendRoutes;
