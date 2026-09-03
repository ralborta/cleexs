import { CleexsEmailSendStatus } from '@prisma/client';
import { Resend } from 'resend';
import {
  buildTransactionalFromAddress,
  buildTransactionalReplyTo,
  isEmailConfigured,
  isEmailDisabled,
  sendSmtpMail,
} from './email';
import { prisma } from './prisma';

export const ADMIN_EMAIL_TEST_SLUG = 'admin-send-test';

function formatResendError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Envío de prueba desde admin: usa Resend REST si hay RESEND_API_KEY; si no, SMTP (p. ej. smtp.resend.com).
 * Registra fila en cleexs_internal_email_send_logs (sent / failed).
 */
export async function sendAdminTestEmail(toRaw: string): Promise<{
  provider: 'resend' | 'smtp';
  logId: string;
  externalId?: string | null;
}> {
  const to = toRaw.trim().toLowerCase();

  if (isEmailDisabled()) {
    throw Object.assign(new Error('Envíos deshabilitados (DISABLE_EMAILS).'), { statusCode: 400 });
  }

  const subject = 'Cleexs · prueba de envío (admin interno)';
  const html =
    '<p>Este es un correo de prueba desde el panel admin interno de Cleexs.</p>' +
    '<p>Si lo recibiste, el canal de envío está operativo.</p>';
  const text =
    'Este es un correo de prueba desde el panel admin interno de Cleexs. Si lo recibiste, el canal de envío está operativo.';

  const apiKey = process.env.RESEND_API_KEY?.trim();
  let provider: 'resend' | 'smtp';
  let externalId: string | null = null;

  try {
    if (apiKey) {
      provider = 'resend';
      const resend = new Resend(apiKey);
      const from = buildTransactionalFromAddress();
      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        html,
        text,
        replyTo: buildTransactionalReplyTo(),
      });
      if (error) throw new Error(formatResendError(error));
      externalId = data?.id ?? null;
    } else if (isEmailConfigured()) {
      provider = 'smtp';
      const info = await sendSmtpMail({ to, subject, html, text });
      externalId = info.messageId ?? null;
    } else {
      throw Object.assign(new Error('Sin canal de envío: configurá RESEND_API_KEY o SMTP completo.'), { statusCode: 503 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode =
      e && typeof e === 'object' && 'statusCode' in e ? Number((e as { statusCode: unknown }).statusCode) || 502 : 502;
    await prisma.cleexsInternalEmailSendLog.create({
      data: {
        recipientEmail: to,
        campaignSlug: ADMIN_EMAIL_TEST_SLUG,
        status: CleexsEmailSendStatus.failed,
        errorMessage: msg.slice(0, 8000),
        mergeSummary: { attemptedProvider: apiKey ? 'resend' : 'smtp' },
      },
    });
    throw Object.assign(new Error(msg), { statusCode });
  }

  try {
    const row = await prisma.cleexsInternalEmailSendLog.create({
      data: {
        recipientEmail: to,
        campaignSlug: ADMIN_EMAIL_TEST_SLUG,
        status: CleexsEmailSendStatus.sent,
        externalId,
        mergeSummary: { provider },
      },
    });
    return { provider, logId: row.id, externalId };
  } catch (logErr) {
    const logMsg = logErr instanceof Error ? logErr.message : String(logErr);
    throw Object.assign(new Error(`Correo enviado pero falló el registro en BD: ${logMsg}`), { statusCode: 500 });
  }
}
