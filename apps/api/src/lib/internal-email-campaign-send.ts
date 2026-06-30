import { CleexsEmailSendStatus, type CleexsInternalEmailCampaign } from '@prisma/client';
import { Resend } from 'resend';
import {
  buildTransactionalFromAddress,
  isEmailConfigured,
  isEmailDisabled,
  sendSmtpMail,
} from './email';
import { prisma } from './prisma';
import { buildWeeklySequenceHtmlEmail } from './weekly-sequence-default-email';

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
 * Envío de prueba de una fila de campaña interna.
 * - Si hay RESEND_API_KEY y `espTemplateId`, usa plantilla de Resend (variables WEEK, TITLE, PREHEADER, SLUG).
 * - Si no, usa la plantilla HTML incluida en Cleexs (misma semántica que la secuencia).
 */
export async function sendInternalCampaignTestEmail(
  toRaw: string,
  campaign: CleexsInternalEmailCampaign
): Promise<{ provider: 'resend_template' | 'resend_inline' | 'smtp'; logId: string; externalId?: string | null }> {
  const to = toRaw.trim().toLowerCase();

  if (isEmailDisabled()) {
    throw Object.assign(new Error('Envíos deshabilitados (DISABLE_EMAILS).'), { statusCode: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const espId = campaign.espTemplateId?.trim();
  const from = buildTransactionalFromAddress();
  // buildWeeklySequenceHtmlEmail ya respeta los campos editados
  // (subject, body, preheader). Si estan vacios cae al template generico.
  const { subject, html, text } = buildWeeklySequenceHtmlEmail(campaign);

  let provider: 'resend_template' | 'resend_inline' | 'smtp';
  let externalId: string | null = null;

  try {
    if (apiKey && espId) {
      provider = 'resend_template';
      const resend = new Resend(apiKey);
      const preheader = (((campaign.preheader || '').trim()) || ((campaign.description || '').trim())).slice(0, 500);
      const editedBody = (campaign.body || '').trim();
      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        template: {
          id: espId,
          variables: {
            WEEK: String(campaign.weekIndex),
            TITLE: campaign.title.slice(0, 500),
            PREHEADER: preheader,
            SLUG: campaign.slug.slice(0, 200),
            SUBJECT: subject.slice(0, 300),
            BODY: editedBody.slice(0, 20000),
          },
        },
      });
      if (error) throw new Error(formatResendError(error));
      externalId = data?.id ?? null;
    } else if (apiKey) {
      provider = 'resend_inline';
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from,
        to: [to],
        subject,
        html,
        text,
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
        campaignSlug: campaign.slug,
        status: CleexsEmailSendStatus.failed,
        errorMessage: msg.slice(0, 8000),
        mergeSummary: {
          mode: apiKey && espId ? 'resend_template' : apiKey ? 'resend_inline' : 'smtp',
          campaignId: campaign.id,
          attempted: true,
        },
      },
    });
    throw Object.assign(new Error(msg), { statusCode });
  }

  try {
    const row = await prisma.cleexsInternalEmailSendLog.create({
      data: {
        recipientEmail: to,
        campaignSlug: campaign.slug,
        status: CleexsEmailSendStatus.sent,
        externalId,
        mergeSummary: {
          provider,
          campaignId: campaign.id,
          espTemplateId: espId || null,
        },
      },
    });
    return { provider, logId: row.id, externalId };
  } catch (logErr) {
    const logMsg = logErr instanceof Error ? logErr.message : String(logErr);
    throw Object.assign(new Error(`Correo enviado pero falló el registro en BD: ${logMsg}`), { statusCode: 500 });
  }
}
