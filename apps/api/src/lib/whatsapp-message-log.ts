import { prisma } from './prisma';

/**
 * Captura persistente de mensajes de WhatsApp.
 * No revienta el flujo si falla: si DB no esta lista, loguea y sigue.
 */

function digitsOf(chatId: string): string | null {
  const d = `${chatId || ''}`.replace(/\D/g, '');
  return d ? d : null;
}

/**
 * BuilderBot a veces envía el texto envuelto en llaves ("{Hola}") por cómo
 * resuelve las variables del flujo. Limpiamos un único par de llaves externas
 * sin tocar el contenido legítimo (JSON real u objetos quedan intactos).
 */
export function sanitizeWaInboundText(raw: string): string {
  let text = `${raw || ''}`.trim();
  const looksLikeJson = /^\{\s*"/.test(text) || /^\{\s*\w+\s*:/.test(text);
  if (!looksLikeJson) {
    while (text.length >= 2 && text.startsWith('{') && text.endsWith('}')) {
      const inner = text.slice(1, -1).trim();
      if (!inner || inner.includes('{') || inner.includes('}')) break;
      text = inner;
    }
  }
  return text;
}

export type WaLogger = {
  error: (obj: unknown, msg?: string) => void;
};

export async function logIncomingWhatsApp(
  log: WaLogger,
  params: {
    chatId: string;
    message: string;
    source?: 'flow' | 'builderbot_inbound';
    mediaUrl?: string | null;
    diagnosticId?: string | null;
  }
): Promise<void> {
  const chatId = `${params.chatId || ''}`.trim();
  const message = sanitizeWaInboundText(params.message);
  if (!chatId || !message) return;

  try {
    await prisma.whatsAppMessage.create({
      data: {
        chatId,
        phoneDigits: digitsOf(chatId),
        direction: 'inbound',
        message: message.slice(0, 8000),
        mediaUrl: params.mediaUrl ?? null,
        status: 'received',
        source: params.source ?? null,
        diagnosticId: params.diagnosticId ?? null,
      },
    });
  } catch (err) {
    log.error({ err }, 'WA log: no se pudo persistir mensaje entrante');
  }
}

export async function logOutgoingWhatsApp(
  log: WaLogger,
  params: {
    chatId: string;
    message: string;
    source?: 'flow_reply' | 'api_send' | 'webhook_score' | 'api_error' | 'bot_reply';
    mediaUrl?: string | null;
    status?: 'sent' | 'failed';
    externalId?: string | null;
    errorMessage?: string | null;
    diagnosticId?: string | null;
  }
): Promise<void> {
  const chatId = `${params.chatId || ''}`.trim();
  const message = `${params.message || ''}`.trim();
  if (!chatId || !message) return;

  try {
    await prisma.whatsAppMessage.create({
      data: {
        chatId,
        phoneDigits: digitsOf(chatId),
        direction: 'outbound',
        message: message.slice(0, 8000),
        mediaUrl: params.mediaUrl ?? null,
        status: params.status ?? 'sent',
        source: params.source ?? null,
        externalId: params.externalId ?? null,
        errorMessage: params.errorMessage ? params.errorMessage.slice(0, 4000) : null,
        diagnosticId: params.diagnosticId ?? null,
      },
    });
  } catch (err) {
    log.error({ err }, 'WA log: no se pudo persistir mensaje saliente');
  }
}
