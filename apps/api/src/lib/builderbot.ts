/**
 * Envío de mensajes WhatsApp vía Baileys self-hosted o BuilderBot Cloud API v2.
 */

import { logOutgoingWhatsApp } from './whatsapp-message-log';

const BUILDERBOT_BASE_URL =
  (process.env.BUILDERBOT_BASE_URL || 'https://app.builderbot.cloud').replace(/\/$/, '');

const BAILEYS_BOT_URL = (process.env.BAILEYS_BOT_URL || '').trim().replace(/\/$/, '');

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
  if (BAILEYS_BOT_URL) return true;
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

async function sendViaBaileysBot(options: SendWhatsAppOptions): Promise<unknown> {
  const phone = formatBuilderBotRecipient(options.number);
  const res = await fetch(`${BAILEYS_BOT_URL}/v1/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: phone,
      message: options.message || ' ',
      urlMedia: options.mediaUrl ?? null,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const raw = await res.text().catch(() => '');
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    data = { error: raw.slice(0, 200) };
  }

  if (!res.ok) {
    throw new Error(String(data.error || `Bot Baileys respondió ${res.status}`));
  }
  return data;
}

export async function sendWhatsAppMessage(options: SendWhatsAppOptions): Promise<unknown> {
  const { number, message, mediaUrl, checkIfExists = false, logSource = 'api_send', diagnosticId = null } = options;
  const recipient = formatBuilderBotRecipient(number);
  if (!recipient) {
    throw new Error('WhatsApp: número o JID de destino vacío');
  }

  const logger = { error: (obj: unknown, _msg?: string) => console.error('WA log', obj) };

  if (BAILEYS_BOT_URL) {
    try {
      const json = await sendViaBaileysBot(options);
      void logOutgoingWhatsApp(logger, {
        chatId: recipient,
        message,
        source: logSource,
        mediaUrl: mediaUrl ?? null,
        status: 'sent',
        diagnosticId,
      });
      return json;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      void logOutgoingWhatsApp(logger, {
        chatId: recipient,
        message,
        source: logSource,
        mediaUrl: mediaUrl ?? null,
        status: 'failed',
        errorMessage: errMsg,
        diagnosticId,
      });
      throw err;
    }
  }

  const BOT_ID = (process.env.BUILDERBOT_BOT_ID || '').trim();
  const API_KEY = (process.env.BUILDERBOT_API_KEY || '').trim();

  if (!BOT_ID || !API_KEY) {
    throw new Error('WhatsApp: definí BAILEYS_BOT_URL o BUILDERBOT_BOT_ID + BUILDERBOT_API_KEY');
  }

  const url = `${BUILDERBOT_BASE_URL}/api/v2/${BOT_ID}/messages`;
  const body: Record<string, unknown> = {
    messages: { content: message, ...(mediaUrl ? { mediaUrl } : {}) },
    number: recipient,
    checkIfExists,
  };

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
