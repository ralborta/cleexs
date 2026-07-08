import { prisma } from './prisma';

export const MARKETING_EMAIL_UNSUBSCRIBE_KEY = 'email.marketing_unsubscribed';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseUnsubscribedList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.includes('@'))
    .map((v) => normalizeEmail(v));
}

export async function listUnsubscribedEmails(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: MARKETING_EMAIL_UNSUBSCRIBE_KEY } });
  return parseUnsubscribedList(row?.value);
}

export async function isEmailUnsubscribed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) return false;
  const list = await listUnsubscribedEmails();
  return list.includes(normalized);
}

export async function unsubscribeMarketingEmail(email: string): Promise<{ email: string; already: boolean }> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) {
    throw Object.assign(new Error('Email inválido'), { statusCode: 400 });
  }

  const row = await prisma.appSetting.findUnique({ where: { key: MARKETING_EMAIL_UNSUBSCRIBE_KEY } });
  const current = parseUnsubscribedList(row?.value);
  if (current.includes(normalized)) {
    return { email: normalized, already: true };
  }

  const next = [...current, normalized];
  await prisma.appSetting.upsert({
    where: { key: MARKETING_EMAIL_UNSUBSCRIBE_KEY },
    create: { key: MARKETING_EMAIL_UNSUBSCRIBE_KEY, value: next },
    update: { value: next },
  });

  return { email: normalized, already: false };
}
