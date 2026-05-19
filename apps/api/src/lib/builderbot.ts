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

/** Número E.164 o JID (@lid / @s.whatsapp.net) tal como BuilderBot espera. */
export function formatBuilderBotRecipient(raw: string): string {
  const s = `${raw || ''}`.trim();
  if (!s) return '';
  if (s.includes('@')) return s;
  const digits = s.replace(/\D/g, '');
  return digits || s;
}

export async function sendWhatsAppMessage(options: SendWhatsAppOptions): Promise<unknown> {
  const { number, message, mediaUrl, checkIfExists = false } = options;
  const BOT_ID = (process.env.BUILDERBOT_BOT_ID || '').trim();
  const API_KEY = (process.env.BUILDERBOT_API_KEY || '').trim();

  if (!BOT_ID || !API_KEY) {
    throw new Error('BuilderBot: definí BUILDERBOT_BOT_ID y BUILDERBOT_API_KEY');
  }

  const recipient = formatBuilderBotRecipient(number);
  if (!recipient) {
    throw new Error('BuilderBot: número o JID de destino vacío');
  }

  const url = `${BUILDERBOT_BASE_URL}/api/v2/${BOT_ID}/messages`;
  const body: Record<string, unknown> = {
    messages: { content: message, ...(mediaUrl ? { mediaUrl } : {}) },
    number: recipient,
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
