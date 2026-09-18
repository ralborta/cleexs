/**
 * Datos demo Empliados para Gráfico (mismo shape que Metrics de conversion).
 */

import type {
  ConversionLoadArgs,
  EmailLead,
  EmailLeadsResponse,
  LandingKey,
  Metrics,
  UnlockClicksResponse,
} from '@/components/conversion/conversion-metrics-dashboard';

function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : null;
}

function scaleForLanding(landing: string): number {
  if (landing === 'home') return 0.55;
  if (landing === 'meta-v1') return 0.35;
  return 1;
}

function scaleCount(n: number, factor: number): number {
  return Math.max(0, Math.round(n * factor));
}

const PORTAL_LANDING_META: Record<
  LandingKey,
  { key: LandingKey; label: string; sub: string }
> = {
  all: { key: 'all', label: 'Todas', sub: 'Home + canales' },
  home: { key: 'home', label: 'Home', sub: 'empliados.net/' },
  'meta-v1': { key: 'meta-v1', label: 'Demo', sub: 'Demo · WhatsApp' },
};

const DEMO_EMAIL_LEADS: EmailLead[] = [
  {
    id: 'emp-lead-andino',
    email: 'ops@transporteandino.com',
    brandName: 'Transporte Andino',
    domain: 'transporteandino.com',
    industry: 'logística',
    sourceChannel: 'whatsapp',
    refCode: 'emp-wa-andino',
    utmSource: 'whatsapp',
    utmMedium: 'chat',
    utmCampaign: 'demo-agentes',
    tier: 'gold',
    status: 'completed',
    shareSlug: null,
    createdAt: '2026-09-16T14:20:00.000Z',
  },
  {
    id: 'emp-lead-ruta',
    email: 'ceo@rutasur.com.ar',
    brandName: 'Ruta Sur',
    domain: 'rutasur.com.ar',
    industry: 'transporte',
    sourceChannel: 'web',
    refCode: 'emp-web-rutasur',
    utmSource: 'linkedin',
    utmMedium: 'social',
    utmCampaign: null,
    tier: 'freemium',
    status: 'completed',
    shareSlug: null,
    createdAt: '2026-09-15T11:05:00.000Z',
  },
  {
    id: 'emp-lead-pampa',
    email: 'logistica@distribuidorapampa.com',
    brandName: 'Distribuidora Pampa',
    domain: 'distribuidorapampa.com',
    industry: 'distribución',
    sourceChannel: 'web',
    refCode: 'emp-ref-pampa',
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    tier: 'freemium',
    status: 'completed',
    shareSlug: null,
    createdAt: '2026-09-14T09:40:00.000Z',
  },
  {
    id: 'emp-lead-cuyo',
    email: 'hola@cuyoexpress.com.ar',
    brandName: 'Logística Cuyo Express',
    domain: 'cuyoexpress.com.ar',
    industry: 'logística',
    sourceChannel: 'whatsapp',
    refCode: 'emp-wa-andino',
    utmSource: 'whatsapp',
    utmMedium: 'chat',
    utmCampaign: 'demo-agentes',
    tier: null,
    status: 'running',
    shareSlug: null,
    createdAt: '2026-09-12T16:10:00.000Z',
  },
  {
    id: 'emp-lead-norte',
    email: 'flota@flotanorte.com',
    brandName: 'Flota Norte SA',
    domain: 'flotanorte.com',
    industry: 'flotas',
    sourceChannel: 'web',
    refCode: null,
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'agentes-logistica',
    tier: null,
    status: 'awaiting_user',
    shareSlug: null,
    createdAt: '2026-09-10T08:30:00.000Z',
  },
];

/** Metrics demo Empliados (operadores logísticos). */
export function buildPortalGraficoMetrics(args: ConversionLoadArgs): Metrics {
  const landing = (args.landing || 'all') as LandingKey;
  const factor = scaleForLanding(landing);

  const homeVisitors = scaleCount(1280, factor);
  const pageViews = scaleCount(2140, factor);
  const urlSubmitted = scaleCount(186, factor);
  const emailLeft = scaleCount(94, factor);
  const shared = scaleCount(41, factor);
  const referred = scaleCount(67, factor);
  const unlockClicks = scaleCount(52, factor);
  const purchased = scaleCount(12, factor);
  const checkoutAttempts = scaleCount(5, factor);

  const emailsSent = scaleCount(420, factor);
  const domainsContacted = scaleCount(180, factor);
  const domainsReturned = scaleCount(28, factor);

  return {
    range: { from: args.from, to: args.to },
    landing: PORTAL_LANDING_META[landing] ?? PORTAL_LANDING_META.all,
    funnel: {
      homeVisitors: {
        count: homeVisitors,
        pageViews,
        source: 'demo-empliados',
      },
      urlSubmitted: {
        count: urlSubmitted,
        pct: pct(urlSubmitted, homeVisitors),
      },
      emailLeft: {
        count: emailLeft,
        pct: pct(emailLeft, urlSubmitted),
        pctOfVisitors: pct(emailLeft, homeVisitors),
      },
      shared: {
        count: shared,
        pct: pct(shared, urlSubmitted),
        byChannel: [
          { channel: 'whatsapp', count: scaleCount(22, factor) },
          { channel: 'email', count: scaleCount(9, factor) },
          { channel: 'linkedin', count: scaleCount(7, factor) },
          { channel: 'copy', count: scaleCount(3, factor) },
        ],
      },
      referred: {
        count: referred,
        pct: pct(referred, homeVisitors),
        byCode: [
          {
            refCode: 'emp-wa-andino',
            name: 'WhatsApp Empliados',
            count: scaleCount(28, factor),
            registered: true,
          },
          {
            refCode: 'emp-web-rutasur',
            name: 'Ruta Sur',
            count: scaleCount(18, factor),
            registered: true,
          },
          {
            refCode: 'emp-ref-pampa',
            name: 'Distribuidora Pampa',
            count: scaleCount(12, factor),
            registered: true,
            isSponsor: true,
          },
          {
            refCode: 'emp-partner-cuyo',
            name: 'Logística Cuyo Express',
            count: scaleCount(9, factor),
            registered: false,
          },
        ],
      },
      unlockClicks: {
        count: unlockClicks,
        pct: pct(unlockClicks, emailLeft),
      },
      purchased: {
        count: purchased,
        pct: pct(purchased, urlSubmitted),
        checkoutAttempts,
        bySource: [
          { source: 'WhatsApp', count: scaleCount(5, factor), usd: scaleCount(2400, factor) },
          { source: 'Web / demo', count: scaleCount(4, factor), usd: scaleCount(1800, factor) },
          { source: 'Referido', count: scaleCount(3, factor), usd: scaleCount(1350, factor) },
        ],
      },
    },
    outreach: {
      emailsSent,
      domainsContacted,
      domainsReturned,
      returnPct: pct(domainsReturned, domainsContacted),
    },
    emailsByReferrer: [
      {
        refCode: 'emp-wa-andino',
        name: 'WhatsApp Empliados',
        uniqueEmails: scaleCount(34, factor),
        diagnosticsWithEmail: scaleCount(34, factor),
        registered: true,
      },
      {
        refCode: 'emp-web-rutasur',
        name: 'Ruta Sur',
        uniqueEmails: scaleCount(21, factor),
        diagnosticsWithEmail: scaleCount(19, factor),
        registered: true,
      },
      {
        refCode: 'emp-ref-pampa',
        name: 'Distribuidora Pampa',
        uniqueEmails: scaleCount(15, factor),
        diagnosticsWithEmail: scaleCount(14, factor),
        registered: true,
        isSponsor: true,
      },
      {
        refCode: 'emp-partner-cuyo',
        name: 'Logística Cuyo Express',
        uniqueEmails: scaleCount(8, factor),
        diagnosticsWithEmail: scaleCount(7, factor),
        registered: false,
      },
      {
        refCode: '__sin_referidor__',
        name: 'Sin referidor',
        uniqueEmails: scaleCount(16, factor),
        diagnosticsWithEmail: scaleCount(12, factor),
        registered: false,
      },
    ],
    sponsorBreakdown: [
      {
        refCode: 'emp-ref-pampa',
        name: 'Distribuidora Pampa',
        web: { diagnostics: scaleCount(11, factor), withEmail: scaleCount(9, factor) },
        whatsapp: { diagnostics: scaleCount(6, factor), withEmail: scaleCount(5, factor) },
        total: { diagnostics: scaleCount(17, factor), withEmail: scaleCount(14, factor) },
      },
      {
        refCode: 'emp-partner-andino',
        name: 'Transporte Andino',
        web: { diagnostics: scaleCount(8, factor), withEmail: scaleCount(7, factor) },
        whatsapp: { diagnostics: scaleCount(14, factor), withEmail: scaleCount(12, factor) },
        total: { diagnostics: scaleCount(22, factor), withEmail: scaleCount(19, factor) },
      },
      {
        refCode: 'emp-partner-norte',
        name: 'Flota Norte SA',
        web: { diagnostics: scaleCount(5, factor), withEmail: scaleCount(3, factor) },
        whatsapp: { diagnostics: scaleCount(4, factor), withEmail: scaleCount(3, factor) },
        total: { diagnostics: scaleCount(9, factor), withEmail: scaleCount(6, factor) },
      },
    ],
  };
}

export function loadPortalGraficoMetrics(args: ConversionLoadArgs): Promise<Metrics> {
  return Promise.resolve(buildPortalGraficoMetrics(args));
}

export function loadPortalGraficoEmailLeads(args: ConversionLoadArgs): Promise<EmailLeadsResponse> {
  void args;
  return Promise.resolve({
    ok: true,
    total: DEMO_EMAIL_LEADS.length,
    items: DEMO_EMAIL_LEADS,
  });
}

export function loadPortalGraficoUnlockClicks(
  _args: ConversionLoadArgs,
): Promise<UnlockClicksResponse> {
  return Promise.resolve({
    ok: true,
    total: 0,
    totalClicks: 0,
    uniqueVisitors: 0,
    uniqueDomains: 0,
    links: [],
    domains: [],
    clientClicks: [],
    items: [],
  });
}
