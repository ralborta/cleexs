import type { FastifyPluginAsync } from 'fastify';
import { buildWhatsAppMonitorStatus, fetchBaileysWhatsappQr } from '../lib/baileys-monitor';

const adminMonitorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/internal/monitor/status', async () => buildWhatsAppMonitorStatus());

  fastify.get('/internal/monitor/whatsapp/qr', async () => fetchBaileysWhatsappQr());
};

export default adminMonitorRoutes;
