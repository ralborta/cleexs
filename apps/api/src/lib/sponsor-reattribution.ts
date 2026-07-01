import { prisma } from './prisma';
import { isShareFollowupRefCode } from './backfill-referral-campaigns';

export const SPONSOR_REFS = ['tipito', 'herederos', 'eldo'] as const;
export type SponsorRef = (typeof SPONSOR_REFS)[number];

/** Pesos por chats únicos WA (últimas 3 semanas), suma 1000. */
export const SPONSOR_WEIGHTS: Record<SponsorRef, number> = {
  tipito: 603,
  herederos: 340,
  eldo: 57,
};

export const SPONSOR_NAMES: Record<SponsorRef, string> = {
  tipito: 'Tipito Enojado',
  herederos: 'Herederos de Alberdi',
  eldo: 'Eldo Larcito',
};

const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;
const NOISE_REFS = ['getplika-com', 'doble-comando-com-ar', 'barquieririgoyen-es', 'youtube_tv'];

function digitsOf(input: string): string {
  return `${input || ''}`.replace(/\D/g, '');
}

function parseRefFromWaMessage(message: string): SponsorRef | null {
  const match = message.match(/\bref:\s*([a-z0-9_-]+)/i);
  const ref = match?.[1]?.trim().toLowerCase();
  if (ref && SPONSOR_REFS.includes(ref as SponsorRef)) return ref as SponsorRef;
  return null;
}

export async function buildWaPhoneToSponsorRefMap(since: Date): Promise<Map<string, SponsorRef>> {
  const messages = await prisma.whatsAppMessage.findMany({
    where: {
      direction: 'inbound',
      createdAt: { gte: since },
      message: { contains: 'ref:', mode: 'insensitive' },
    },
    orderBy: { createdAt: 'asc' },
    select: { chatId: true, phoneDigits: true, message: true },
  });

  const map = new Map<string, SponsorRef>();
  for (const m of messages) {
    const ref = parseRefFromWaMessage(m.message);
    if (!ref) continue;
    for (const key of [m.phoneDigits, digitsOf(m.chatId), m.chatId].filter(Boolean) as string[]) {
      if (!map.has(key)) map.set(key, ref);
    }
  }
  return map;
}

export function resolveSponsorRefFromPhone(
  waPhone: string | null | undefined,
  phoneToRef: Map<string, SponsorRef>
): SponsorRef | null {
  const digits = digitsOf(waPhone || '');
  if (!digits) return null;
  for (const [key, ref] of phoneToRef) {
    const kd = digitsOf(key);
    if (!kd) continue;
    if (digits === kd || digits.endsWith(kd) || kd.endsWith(digits)) return ref;
  }
  return null;
}

/** Primer ref de auspiciador en pageview 30 min antes del diagnóstico. */
export async function resolveRefFromPageview(
  diagnosticId: string,
  createdAt: Date
): Promise<SponsorRef | null> {
  const since = new Date(createdAt.getTime() - 30 * 60 * 1000);
  const pageview = await prisma.pageView.findFirst({
    where: {
      path: '/diagnostico/crear',
      createdAt: { gte: since, lte: createdAt },
      refCode: { in: [...SPONSOR_REFS] },
    },
    orderBy: { createdAt: 'desc' },
    select: { refCode: true },
  });
  const ref = pageview?.refCode?.trim().toLowerCase();
  if (ref && SPONSOR_REFS.includes(ref as SponsorRef)) return ref as SponsorRef;
  return null;
}

export function assignProportionalRef(index: number, total: number): SponsorRef {
  if (total <= 0) return 'tipito';
  const t = (index + 1) / total;
  const tipitoEnd = SPONSOR_WEIGHTS.tipito / 1000;
  const herederosEnd = (SPONSOR_WEIGHTS.tipito + SPONSOR_WEIGHTS.herederos) / 1000;
  if (t <= tipitoEnd) return 'tipito';
  if (t <= herederosEnd) return 'herederos';
  return 'eldo';
}

export type ReattributionPlanRow = {
  diagnosticId: string;
  createdAt: Date;
  source: 'whatsapp_message' | 'pageview' | 'proportional_web';
  fromRef: string | null;
  toRef: SponsorRef;
  hasEmail: boolean;
};

export type ReattributionSummary = {
  since: string;
  planned: number;
  bySource: Record<string, number>;
  byTargetRef: Record<string, number>;
  uniqueEmailsByTargetRef: Record<string, number>;
  sample: ReattributionPlanRow[];
};

function isNullOrNoiseRef(refCode: string | null | undefined): boolean {
  const ref = (refCode || '').trim().toLowerCase();
  if (!ref) return true;
  if (NOISE_REFS.includes(ref)) return true;
  if (isShareFollowupRefCode(ref)) return true;
  return false;
}

export async function planSponsorReattribution(options?: {
  since?: Date;
  sampleSize?: number;
}): Promise<{ rows: ReattributionPlanRow[]; summary: ReattributionSummary }> {
  const since = options?.since ?? new Date(Date.now() - THREE_WEEKS_MS);
  const phoneToRef = await buildWaPhoneToSponsorRefMap(since);

  const diagnostics = await prisma.publicDiagnostic.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      createdAt: true,
      refCode: true,
      waPhone: true,
      sourceChannel: true,
      email: true,
    },
  });

  const rows: ReattributionPlanRow[] = [];
  const webProportionalCandidates: typeof diagnostics = [];

  for (const d of diagnostics) {
    if (!isNullOrNoiseRef(d.refCode)) continue;

    const isWa = d.sourceChannel === 'whatsapp_yt' || Boolean(d.waPhone?.trim());
    if (isWa) {
      const waRef =
        resolveSponsorRefFromPhone(d.waPhone, phoneToRef) ??
        (d.waPhone ? await resolveWhatsAppSponsorRefFromHistory(d.waPhone) : null);
      if (waRef) {
        rows.push({
          diagnosticId: d.id,
          createdAt: d.createdAt,
          source: 'whatsapp_message',
          fromRef: d.refCode,
          toRef: waRef,
          hasEmail: Boolean(
            d.email?.trim() && !d.email.toLowerCase().endsWith('@whatsapp.cleexs.net')
          ),
        });
      }
      continue;
    }

    webProportionalCandidates.push(d);
  }

  // Pageview recovery for web candidates
  const afterPageview: typeof diagnostics = [];
  for (const d of webProportionalCandidates) {
    const pvRef = await resolveRefFromPageview(d.id, d.createdAt);
    if (pvRef) {
      rows.push({
        diagnosticId: d.id,
        createdAt: d.createdAt,
        source: 'pageview',
        fromRef: d.refCode,
        toRef: pvRef,
        hasEmail: Boolean(d.email?.trim() && !d.email.toLowerCase().endsWith('@whatsapp.cleexs.net')),
      });
    } else {
      afterPageview.push(d);
    }
  }

  const n = afterPageview.length;
  afterPageview.forEach((d, index) => {
    rows.push({
      diagnosticId: d.id,
      createdAt: d.createdAt,
      source: 'proportional_web',
      fromRef: d.refCode,
      toRef: assignProportionalRef(index, n),
      hasEmail: Boolean(d.email?.trim() && !d.email.toLowerCase().endsWith('@whatsapp.cleexs.net')),
    });
  });

  const bySource: Record<string, number> = {};
  const byTargetRef: Record<string, number> = {};
  const uniqueEmailsByTargetRef: Record<string, Set<string>> = {
    tipito: new Set(),
    herederos: new Set(),
    eldo: new Set(),
  };

  for (const row of rows) {
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    byTargetRef[row.toRef] = (byTargetRef[row.toRef] ?? 0) + 1;
  }

  // Count unique emails from planned assignments
  const diagIds = rows.map((r) => r.diagnosticId);
  const diagsWithEmail = await prisma.publicDiagnostic.findMany({
    where: { id: { in: diagIds }, email: { not: null } },
    select: { id: true, email: true },
  });
  const emailById = new Map(diagsWithEmail.map((d) => [d.id, d.email!.trim().toLowerCase()]));
  const uniqueEmailsByTargetRefFlat: Record<string, number> = { tipito: 0, herederos: 0, eldo: 0 };

  for (const row of rows) {
    const email = emailById.get(row.diagnosticId);
    if (!email || email.endsWith('@whatsapp.cleexs.net')) continue;
    uniqueEmailsByTargetRef[row.toRef].add(email);
  }
  for (const ref of SPONSOR_REFS) {
    uniqueEmailsByTargetRefFlat[ref] = uniqueEmailsByTargetRef[ref].size;
  }

  const summary: ReattributionSummary = {
    since: since.toISOString().slice(0, 10),
    planned: rows.length,
    bySource,
    byTargetRef,
    uniqueEmailsByTargetRef: uniqueEmailsByTargetRefFlat,
    sample: rows.slice(0, options?.sampleSize ?? 15),
  };

  return { rows, summary };
}

export async function applySponsorReattribution(options?: {
  since?: Date;
}): Promise<ReattributionSummary & { updated: number }> {
  const { rows, summary } = await planSponsorReattribution(options);

  let updated = 0;
  const idsByKey = new Map<string, string[]>();
  for (const row of rows) {
    const medium = row.source === 'whatsapp_message' ? 'whatsapp' : 'youtube';
    const key = `${row.toRef}:${medium}`;
    const list = idsByKey.get(key) ?? [];
    list.push(row.diagnosticId);
    idsByKey.set(key, list);
  }

  for (const [key, ids] of idsByKey) {
    const [ref, medium] = key.split(':') as [SponsorRef, string];
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const result = await prisma.publicDiagnostic.updateMany({
        where: { id: { in: chunk } },
        data: {
          refCode: ref,
          utmSource: 'auspiciador',
          utmMedium: medium,
          utmCampaign: ref,
        },
      });
      updated += result.count;
    }
  }

  // Campañas oficiales
  for (const ref of SPONSOR_REFS) {
    await prisma.referralCampaign.upsert({
      where: { refCode: ref },
      create: {
        refCode: ref,
        name: SPONSOR_NAMES[ref],
        utmSource: 'auspiciador',
        utmMedium: 'youtube',
        utmCampaign: ref,
        notes: 'Auspiciador YouTube (QR WhatsApp / web)',
        active: true,
      },
      update: {
        name: SPONSOR_NAMES[ref],
        active: true,
        utmSource: 'auspiciador',
        utmMedium: 'youtube',
        utmCampaign: ref,
      },
    });
  }

  // Desactivar ruido
  await prisma.referralCampaign.updateMany({
    where: { refCode: { in: NOISE_REFS.filter((r) => r !== 'youtube_tv') } },
    data: { active: false, notes: 'Desactivado: ref de dominio/share, no auspiciador' },
  });

  await prisma.referralCampaign.updateMany({
    where: { refCode: 'youtube_tv' },
    data: { active: false, notes: 'Reemplazado por tipito / herederos / eldo' },
  });

  return { ...summary, updated };
}

/** Para tráfico nuevo: ref del primer mensaje WA del mismo teléfono (7 días). */
export async function resolveWhatsAppSponsorRefFromHistory(
  waPhone: string,
  sinceDays = 7
): Promise<SponsorRef | null> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const digits = digitsOf(waPhone);
  if (!digits) return null;

  const messages = await prisma.whatsAppMessage.findMany({
    where: {
      direction: 'inbound',
      createdAt: { gte: since },
      OR: [{ phoneDigits: { contains: digits.slice(-8) } }, { chatId: { contains: digits.slice(-8) } }],
      message: { contains: 'ref:', mode: 'insensitive' },
    },
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: { message: true, phoneDigits: true, chatId: true },
  });

  for (const m of messages) {
    const md = digitsOf(m.phoneDigits || m.chatId);
    if (md && !(digits.endsWith(md) || md.endsWith(digits) || digits === md)) continue;
    const ref = parseRefFromWaMessage(m.message);
    if (ref) return ref;
  }
  return null;
}
