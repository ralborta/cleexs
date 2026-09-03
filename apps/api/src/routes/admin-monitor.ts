import type { FastifyPluginAsync } from 'fastify';
import { buildWhatsAppMonitorStatus, fetchBaileysWhatsappQr } from '../lib/baileys-monitor';
import { setWhatsAppBlacklist } from '../lib/builderbot';

const adminMonitorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/internal/monitor/status', async () => buildWhatsAppMonitorStatus());

  fastify.get('/internal/monitor/whatsapp/qr', async () => fetchBaileysWhatsappQr());

  /** Bloquear / desbloquear número (mismo contrato BBC / Andreu). */
  fastify.post<{
    Body: { number?: string; intent?: string };
  }>('/internal/monitor/whatsapp/blacklist', async (request, reply) => {
    const number = `${request.body?.number || ''}`.trim();
    const intentRaw = `${request.body?.intent || ''}`.trim().toLowerCase();
    const intent = intentRaw === 'remove' || intentRaw === 'unblock' ? 'remove' : intentRaw === 'add' || intentRaw === 'block' ? 'add' : null;

    if (!number || !intent) {
      return reply.code(400).send({
        ok: false,
        error: 'Enviá number e intent ("add" | "remove")',
      });
    }

    try {
      const result = await setWhatsAppBlacklist(number, intent);
      return { ...result, message: intent === 'add' ? 'Número bloqueado (bot no responde)' : 'Número desbloqueado' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error blacklist';
      return reply.code(502).send({ ok: false, error: msg });
    }
  });
};

export default adminMonitorRoutes;
