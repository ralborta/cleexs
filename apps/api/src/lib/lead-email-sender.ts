import { Resend } from 'resend';
import type { LeadContact, LeadEmail, LeadSource } from '@prisma/client';
import { buildTransactionalFromAddress, isEmailConfigured, isEmailDisabled, sendSmtpMail } from './email';
import { prisma } from './prisma';

type LeadEmailWithRelations = LeadEmail & {
  leadContact: LeadContact;
  leadSource: LeadSource;
};

export type LeadEmailSendMode = 'shadow' | 'real';

export type LeadEmailSendResult = {
  mode: LeadEmailSendMode;
  provider: 'resend' | 'smtp';
  to: string;
  originalTo: string;
  externalId?: string | null;
};

const BLOCKED_LOCAL_PARTS = new Set([
  'abuse',
  'admin',
  'billing',
  'compliance',
  'contact',
  'help',
  'info',
  'legal',
  'no-reply',
  'noreply',
  'postmaster',
  'privacy',
  'soporte',
  'support',
  'ventas',
  'webmaster',
]);

function cleanEmail(email: string): string {
  return email.trim().toLowerCase();
}

function localPart(email: string): string {
  return cleanEmail(email).split('@')[0] || '';
}

function domainOf(email: string): string {
  return cleanEmail(email).split('@')[1] || '';
}

function getOutreachFromAddress(): string {
  const fromEmail = process.env.OUTREACH_FROM_EMAIL?.trim();
  const fromName = process.env.OUTREACH_FROM_NAME?.trim() || 'Cleexs';
  if (fromEmail) return `"${fromName}" <${fromEmail}>`;
  return buildTransactionalFromAddress();
}

function getReplyTo(): string | undefined {
  return process.env.OUTREACH_REPLY_TO?.trim() || process.env.SMTP_FROM_EMAIL?.trim() || undefined;
}

function domainVerified(): boolean {
  return process.env.OUTREACH_DOMAIN_VERIFIED === 'true';
}

function dailyLimit(): number {
  const parsed = Number(process.env.OUTREACH_DAILY_LIMIT || 20);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(500, Math.floor(parsed)) : 20;
}

function defaultShadowTo(): string | undefined {
  return process.env.OUTREACH_SHADOW_TO?.trim() || getReplyTo();
}

function assertSendableContact(contact: LeadContact, mode: LeadEmailSendMode) {
  const email = cleanEmail(contact.email);
  if (!email.includes('@')) {
    throw Object.assign(new Error('Contacto sin email válido.'), { statusCode: 400 });
  }

  const local = localPart(email);
  if (mode === 'real' && BLOCKED_LOCAL_PARTS.has(local)) {
    throw Object.assign(new Error(`Email excluido para cold outreach: ${email}`), { statusCode: 409, code: 'excluded_recipient' });
  }
}

async function assertRealSendAllowed(email: string) {
  if (!domainVerified()) {
    throw Object.assign(
      new Error('Dominio de outreach no verificado. Usá shadow send o configurá OUTREACH_DOMAIN_VERIFIED=true.'),
      { statusCode: 409, code: 'outreach_domain_not_verified' }
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = await prisma.leadEmail.count({
    where: {
      status: { in: ['sent', 'delivered'] },
      sentAt: { gte: startOfDay },
    },
  });
  if (sentToday >= dailyLimit()) {
    throw Object.assign(new Error(`Límite diario de outreach alcanzado (${dailyLimit()}).`), {
      statusCode: 429,
      code: 'outreach_daily_limit_reached',
    });
  }

  const recipientDomain = domainOf(email);
  if (recipientDomain) {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const recent = await prisma.leadEmail.findFirst({
      where: {
        status: { in: ['sent', 'delivered'] },
        sentAt: { gte: since },
        leadContact: {
          email: { endsWith: `@${recipientDomain}` },
        },
      },
      select: { id: true },
    });
    if (recent) {
      throw Object.assign(new Error(`Ya hubo un envío reciente a ${recipientDomain}.`), {
        statusCode: 429,
        code: 'outreach_domain_weekly_limit_reached',
      });
    }
  }
}

function shadowSubject(originalTo: string, subject: string): string {
  return `[SHADOW para ${originalTo}] ${subject}`.slice(0, 180);
}

function buildTextBody(email: LeadEmailWithRelations, mode: LeadEmailSendMode, originalTo: string): string {
  const prefix =
    mode === 'shadow'
      ? [
          'SHADOW SEND - NO SE ENVIO AL COMPETIDOR',
          `Destinatario original: ${originalTo}`,
          `Competidor: ${email.leadSource.competitorName}`,
          '',
          '--- EMAIL ORIGINAL ---',
          '',
        ].join('\n')
      : '';
  return `${prefix}${email.body}`;
}

async function sendViaResend(args: {
  email: LeadEmailWithRelations;
  to: string;
  originalTo: string;
  mode: LeadEmailSendMode;
  subject: string;
  body: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY no configurado.');
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: getOutreachFromAddress(),
    to: [args.to],
    subject: args.subject,
    text: args.body,
    replyTo: getReplyTo(),
    headers: {
      'X-Cleexs-Lead-Email-Id': args.email.id,
      'X-Cleexs-Outreach-Mode': args.mode,
      'X-Cleexs-Original-To': args.originalTo,
    },
  });
  if (error) {
    const msg = error && typeof error === 'object' && 'message' in error ? String(error.message) : JSON.stringify(error);
    throw new Error(msg);
  }
  return data?.id ?? null;
}

async function sendViaSmtp(args: {
  email: LeadEmailWithRelations;
  to: string;
  originalTo: string;
  mode: LeadEmailSendMode;
  subject: string;
  body: string;
}) {
  const info = await sendSmtpMail({
    to: args.to,
    subject: args.subject,
    text: args.body,
    replyTo: getReplyTo(),
    headers: {
      'X-Cleexs-Lead-Email-Id': args.email.id,
      'X-Cleexs-Outreach-Mode': args.mode,
      'X-Cleexs-Original-To': args.originalTo,
    },
  });
  return info.messageId ?? null;
}

export async function sendLeadEmail(args: {
  leadEmailId: string;
  mode: LeadEmailSendMode;
  shadowTo?: string;
  subject?: string;
  body?: string;
}): Promise<LeadEmailSendResult> {
  if (isEmailDisabled()) {
    throw Object.assign(new Error('Envíos deshabilitados (DISABLE_EMAILS).'), { statusCode: 400 });
  }

  const email = await prisma.leadEmail.findUnique({
    where: { id: args.leadEmailId },
    include: {
      leadContact: true,
      leadSource: true,
    },
  });
  if (!email) throw Object.assign(new Error('Email de outreach no encontrado.'), { statusCode: 404 });

  assertSendableContact(email.leadContact, args.mode);
  const originalTo = cleanEmail(email.leadContact.email);
  if (args.mode === 'real') await assertRealSendAllowed(originalTo);

  const to = args.mode === 'shadow' ? cleanEmail(args.shadowTo || defaultShadowTo() || '') : originalTo;
  if (!to || !to.includes('@')) {
    throw Object.assign(new Error('OUTREACH_SHADOW_TO u OUTREACH_REPLY_TO requerido para shadow send.'), {
      statusCode: 400,
      code: 'shadow_to_required',
    });
  }

  const baseSubject = (args.subject ?? email.subject).trim();
  const baseBody = (args.body ?? email.body).trim();
  if (!baseSubject || !baseBody) {
    throw Object.assign(new Error('Asunto y cuerpo son requeridos.'), { statusCode: 400 });
  }

  const subject = args.mode === 'shadow' ? shadowSubject(originalTo, baseSubject) : baseSubject;
  const body = buildTextBody({ ...email, subject: baseSubject, body: baseBody }, args.mode, originalTo);

  await prisma.leadEmail.update({
    where: { id: email.id },
    data: {
      subject: baseSubject,
      body: baseBody,
      status: 'queued',
      metaJson: {
        ...(email.metaJson && typeof email.metaJson === 'object' && !Array.isArray(email.metaJson) ? email.metaJson : {}),
        mode: args.mode,
        originalTo,
        effectiveTo: to,
        queuedAt: new Date().toISOString(),
      },
    },
  });

  let provider: LeadEmailSendResult['provider'];
  let externalId: string | null = null;
  try {
    if (process.env.RESEND_API_KEY?.trim()) {
      provider = 'resend';
      externalId = await sendViaResend({ email, to, originalTo, mode: args.mode, subject, body });
    } else if (isEmailConfigured()) {
      provider = 'smtp';
      externalId = await sendViaSmtp({ email, to, originalTo, mode: args.mode, subject, body });
    } else {
      throw Object.assign(new Error('Sin canal de envío: configurá RESEND_API_KEY o SMTP completo.'), { statusCode: 503 });
    }
  } catch (error) {
    await prisma.leadEmail.update({
      where: { id: email.id },
      data: {
        status: 'failed',
        provider: process.env.RESEND_API_KEY?.trim() ? 'resend' : 'smtp',
        metaJson: {
          ...(email.metaJson && typeof email.metaJson === 'object' && !Array.isArray(email.metaJson) ? email.metaJson : {}),
          mode: args.mode,
          originalTo,
          effectiveTo: to,
          error: error instanceof Error ? error.message : String(error),
          failedAt: new Date().toISOString(),
        },
      },
    });
    throw error;
  }

  await prisma.leadEmail.update({
    where: { id: email.id },
    data: {
      provider,
      status: 'sent',
      sentAt: new Date(),
      metaJson: {
        ...(email.metaJson && typeof email.metaJson === 'object' && !Array.isArray(email.metaJson) ? email.metaJson : {}),
        mode: args.mode,
        originalTo,
        effectiveTo: to,
        externalId,
        replyTo: getReplyTo() ?? null,
      },
    },
  });

  if (args.mode === 'real') {
    await prisma.leadContact.update({
      where: { id: email.leadContactId },
      data: { status: 'sent' },
    });
  }

  return { mode: args.mode, provider, to, originalTo, externalId };
}

export async function updateLeadEmailFromResendEvent(emailId: string, eventType: string) {
  const candidates = await prisma.leadEmail.findMany({
    where: { provider: 'resend' },
    orderBy: { updatedAt: 'desc' },
    take: 250,
  });
  const leadEmail = candidates.find((row) => {
    const meta = row.metaJson;
    return Boolean(meta && typeof meta === 'object' && !Array.isArray(meta) && (meta as { externalId?: unknown }).externalId === emailId);
  });
  if (!leadEmail) return null;

  const statusByEvent: Record<string, string | undefined> = {
    'email.delivered': 'delivered',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.delivery_delayed': 'delivery_delayed',
    'email.failed': 'failed',
  };
  const nextStatus = statusByEvent[eventType];
  if (!nextStatus) return leadEmail;

  return prisma.leadEmail.update({
    where: { id: leadEmail.id },
    data: {
      status: nextStatus,
      metaJson: {
        ...(leadEmail.metaJson && typeof leadEmail.metaJson === 'object' && !Array.isArray(leadEmail.metaJson) ? leadEmail.metaJson : {}),
        lastResendEvent: eventType,
        lastResendEventAt: new Date().toISOString(),
      },
    },
  });
}
