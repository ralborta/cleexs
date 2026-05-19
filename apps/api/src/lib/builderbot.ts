/**
 * Envío de mensajes WhatsApp vía BuilderBot Cloud API v2 (mismo patrón que Mis Reclamos).
 */

const BUILDERBOT_BASE_URL =
  (process.env.BUILDERBOT_BASE_URL || 'https://app.builderbot.cloud').replace(/\/$/, '');

export interface SendWhatsAppOptions {
  number: string;
  message: string;
  mediaUrl?: string;
  checkIfExists?: boolean;
}

export function isBuilderBotSendConfigured(): boolean {
  const botId = (process.env.BUILDERBOT_BOT_ID || '').trim();
  const apiKey = (process.env.BUILDERBOT_API_KEY || '').trim();
  return Boolean(botId && apiKey);
}

export async function sendWhatsAppMessage(options: SendWhatsAppOptions): Promise<unknown> {
  const { number, message, mediaUrl, checkIfExists = false } = options;
  const BOT_ID = (process.env.BUILDERBOT_BOT_ID || '').trim();
  const API_KEY = (process.env.BUILDERBOT_API_KEY || '').trim();

  if (!BOT_ID || !API_KEY) {
    throw new Error('BuilderBot: definí BUILDERBOT_BOT_ID y BUILDERBOT_API_KEY');
  }

  const url = `${BUILDERBOT_BASE_URL}/api/v2/${BOT_ID}/messages`;
  const body: Record<string, unknown> = {
    messages: { content: message, ...(mediaUrl ? { mediaUrl } : {}) },
    number: `${number}`.replace(/\D/g, ''),
    checkIfExists,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-builderbot': API_KEY,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`BuilderBot send failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}
