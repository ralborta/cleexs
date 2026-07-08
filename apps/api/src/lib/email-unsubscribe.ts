import { prisma } from './prisma';

/** Lista legacy (baja total). Se migra a preferencias granulares al leer. */
export const MARKETING_EMAIL_UNSUBSCRIBE_KEY = 'email.marketing_unsubscribed';

export const MARKETING_EMAIL_PREFERENCES_KEY = 'email.marketing_preferences';

export type EmailMarketingCategory = 'content' | 'monthlyScore';

export type EmailUnsubscribePreferences = {
  contentUnsubscribed: boolean;
  monthlyScoreUnsubscribed: boolean;
};

type PreferencesStore = Record<string, EmailUnsubscribePreferences>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseLegacyUnsubscribedList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string' && v.includes('@'))
    .map((v) => normalizeEmail(v));
}

function emptyPreferences(): EmailUnsubscribePreferences {
  return { contentUnsubscribed: false, monthlyScoreUnsubscribed: false };
}

function parsePreferencesStore(value: unknown): PreferencesStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: PreferencesStore = {};
  for (const [rawEmail, rawPrefs] of Object.entries(value as Record<string, unknown>)) {
    if (!rawEmail.includes('@') || !rawPrefs || typeof rawPrefs !== 'object' || Array.isArray(rawPrefs)) continue;
    const p = rawPrefs as Record<string, unknown>;
    out[normalizeEmail(rawEmail)] = {
      contentUnsubscribed: p.contentUnsubscribed === true,
      monthlyScoreUnsubscribed: p.monthlyScoreUnsubscribed === true,
    };
  }
  return out;
}

async function loadLegacyUnsubscribedSet(): Promise<Set<string>> {
  const row = await prisma.appSetting.findUnique({ where: { key: MARKETING_EMAIL_UNSUBSCRIBE_KEY } });
  return new Set(parseLegacyUnsubscribedList(row?.value));
}

async function loadPreferencesStore(): Promise<PreferencesStore> {
  const row = await prisma.appSetting.findUnique({ where: { key: MARKETING_EMAIL_PREFERENCES_KEY } });
  return parsePreferencesStore(row?.value);
}

async function savePreferencesStore(store: PreferencesStore): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: MARKETING_EMAIL_PREFERENCES_KEY },
    create: { key: MARKETING_EMAIL_PREFERENCES_KEY, value: store },
    update: { value: store },
  });
}

/** Preferencias efectivas (incluye migración desde lista legacy). */
export async function getEmailUnsubscribePreferences(email: string): Promise<EmailUnsubscribePreferences> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) return emptyPreferences();

  const store = await loadPreferencesStore();
  if (store[normalized]) return { ...store[normalized] };

  const legacy = await loadLegacyUnsubscribedSet();
  if (legacy.has(normalized)) {
    return { contentUnsubscribed: true, monthlyScoreUnsubscribed: true };
  }

  return emptyPreferences();
}

export async function hasStoredEmailUnsubscribePreferences(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) return false;
  const store = await loadPreferencesStore();
  if (store[normalized]) return true;
  const legacy = await loadLegacyUnsubscribedSet();
  return legacy.has(normalized);
}

export function defaultLeaveFlagsForUnsubscribeSource(from?: string): {
  leaveContent: boolean;
  leaveMonthlyScore: boolean;
} {
  if (from === 'monthly_score') {
    return { leaveContent: false, leaveMonthlyScore: true };
  }
  return { leaveContent: true, leaveMonthlyScore: false };
}

export async function resolveUnsubscribeFormState(
  email: string,
  from?: string
): Promise<{
  leaveContent: boolean;
  leaveMonthlyScore: boolean;
  preferences: EmailUnsubscribePreferences;
}> {
  const normalized = normalizeEmail(email);
  const store = await loadPreferencesStore();
  const legacy = await loadLegacyUnsubscribedSet();
  const hasStored = Boolean(store[normalized]) || legacy.has(normalized);

  if (hasStored) {
    const preferences = await getEmailUnsubscribePreferences(normalized);
    return { ...preferencesToLeaveFlags(preferences), preferences };
  }

  const defaults = defaultLeaveFlagsForUnsubscribeSource(from);
  return {
    leaveContent: defaults.leaveContent,
    leaveMonthlyScore: defaults.leaveMonthlyScore,
    preferences: {
      contentUnsubscribed: defaults.leaveContent,
      monthlyScoreUnsubscribed: defaults.leaveMonthlyScore,
    },
  };
}

export function preferencesToLeaveFlags(prefs: EmailUnsubscribePreferences): {
  leaveContent: boolean;
  leaveMonthlyScore: boolean;
} {
  return {
    leaveContent: prefs.contentUnsubscribed,
    leaveMonthlyScore: prefs.monthlyScoreUnsubscribed,
  };
}

export async function isEmailUnsubscribedFromCategory(
  email: string,
  category: EmailMarketingCategory
): Promise<boolean> {
  const prefs = await getEmailUnsubscribePreferences(email);
  return category === 'content' ? prefs.contentUnsubscribed : prefs.monthlyScoreUnsubscribed;
}

/** @deprecated Usar isEmailUnsubscribedFromCategory. True si está dado de baja de todo el marketing. */
export async function isEmailUnsubscribed(email: string): Promise<boolean> {
  const prefs = await getEmailUnsubscribePreferences(email);
  return prefs.contentUnsubscribed && prefs.monthlyScoreUnsubscribed;
}

export async function listUnsubscribedEmails(): Promise<string[]> {
  const store = await loadPreferencesStore();
  const legacy = await loadLegacyUnsubscribedSet();
  const emails = new Set<string>([...legacy, ...Object.keys(store)]);
  return [...emails].filter((e) => {
    const p = store[e] ?? (legacy.has(e) ? { contentUnsubscribed: true, monthlyScoreUnsubscribed: true } : emptyPreferences());
    return p.contentUnsubscribed || p.monthlyScoreUnsubscribed;
  });
}

export async function updateEmailUnsubscribePreferences(
  email: string,
  input: { leaveContent: boolean; leaveMonthlyScore: boolean }
): Promise<{
  email: string;
  preferences: EmailUnsubscribePreferences;
  changed: boolean;
}> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes('@')) {
    throw Object.assign(new Error('Email inválido'), { statusCode: 400 });
  }

  const store = await loadPreferencesStore();
  const previous = await getEmailUnsubscribePreferences(normalized);
  const next: EmailUnsubscribePreferences = {
    contentUnsubscribed: input.leaveContent,
    monthlyScoreUnsubscribed: input.leaveMonthlyScore,
  };

  const changed =
    previous.contentUnsubscribed !== next.contentUnsubscribed ||
    previous.monthlyScoreUnsubscribed !== next.monthlyScoreUnsubscribed;

  store[normalized] = next;
  await savePreferencesStore(store);

  // Mantener lista legacy en sync: ambas categorías off → en lista; si no → sacar
  const legacy = await loadLegacyUnsubscribedSet();
  const fullyUnsubscribed = next.contentUnsubscribed && next.monthlyScoreUnsubscribed;
  if (fullyUnsubscribed) {
    legacy.add(normalized);
  } else {
    legacy.delete(normalized);
  }
  await prisma.appSetting.upsert({
    where: { key: MARKETING_EMAIL_UNSUBSCRIBE_KEY },
    create: { key: MARKETING_EMAIL_UNSUBSCRIBE_KEY, value: [...legacy] },
    update: { value: [...legacy] },
  });

  return { email: normalized, preferences: next, changed };
}

/** Baja total (compatibilidad con clientes viejos). */
export async function unsubscribeMarketingEmail(email: string): Promise<{ email: string; already: boolean }> {
  const normalized = normalizeEmail(email);
  const previous = await getEmailUnsubscribePreferences(normalized);
  const already = previous.contentUnsubscribed && previous.monthlyScoreUnsubscribed;
  await updateEmailUnsubscribePreferences(normalized, { leaveContent: true, leaveMonthlyScore: true });
  return { email: normalized, already };
}
