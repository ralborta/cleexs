/**
 * Envío de mensajes WhatsApp vía BuilderBot Cloud API v2 (mismo patrón que Mis Reclamos).
 */

import { logOutgoingWhatsApp } from './whatsapp-message-log';

const BUILDERBOT_BASE_URL =
  (process.env.BUILDERBOT_BASE_URL || 'https://app.builderbot.cloud').replace(/\/$/, '');

export interface SendWhatsAppOptions {
  number: string;
  message: string;
  mediaUrl?: string;
  checkIfExists?: boolean;
  /** Origen para el log de auditoria en whatsapp_messages. */
  logSource?: 'api_send' | 'webhook_score' | 'flow_reply' | 'api_error';
  /** ID del diagnostico publico relacionado (si aplica). */
  diagnosticId?: string | null;
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
  const { number, message, mediaUrl, checkIfExists = false, logSource = 'api_send', diagnosticId = null } = options;
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

  const logger = { error: (obj: unknown, _msg?: string) => console.error('WA log', obj) };

  try {
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
      const errMsg = `BuilderBot send failed (${res.status}): ${detail.slice(0, 200)}`;
      // Persistimos el saliente como fallido para que quede en el log de admin.
      void logOutgoingWhatsApp(logger, {
        chatId: recipient,
        message,
        source: logSource,
        mediaUrl: mediaUrl ?? null,
        status: 'failed',
        errorMessage: errMsg,
        diagnosticId,
      });
      throw new Error(errMsg);
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string; messageId?: string };
    const externalId = json.id || json.messageId || null;

    void logOutgoingWhatsApp(logger, {
      chatId: recipient,
      message,
      source: logSource,
      mediaUrl: mediaUrl ?? null,
      status: 'sent',
      externalId,
      diagnosticId,
    });

    return json;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('BuilderBot send failed')) {
      throw err;
    }
    const message2 = err instanceof Error ? err.message : String(err);
    void logOutgoingWhatsApp(logger, {
      chatId: recipient,
      message,
      source: logSource,
      mediaUrl: mediaUrl ?? null,
      status: 'failed',
      errorMessage: message2,
      diagnosticId,
    });
    throw err;
  }
}
