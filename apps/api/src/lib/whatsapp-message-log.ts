import { prisma } from './prisma';

/**
 * Captura persistente de mensajes de WhatsApp.
 * No revienta el flujo si falla: si DB no esta lista, loguea y sigue.
 */

function digitsOf(chatId: string): string | null {
  const d = `${chatId || ''}`.replace(/\D/g, '');
  return d ? d : null;
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
  const message = `${params.message || ''}`.trim();
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
    source?: 'flow_reply' | 'api_send' | 'webhook_score' | 'api_error';
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
