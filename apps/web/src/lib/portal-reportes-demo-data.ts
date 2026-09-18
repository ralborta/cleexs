/**
 * Datos demo Empliados para Reportes (mismo shape que admin / internalReportsApi).
 */

import type {
  AcquisitionDiagnosticRow,
  AcquisitionDiagnosticSearchResult,
  AcquisitionReport,
  EmailOutreachReport,
  OnboardingProfileReport,
  ReportWindowDays,
} from '@/lib/api';

const AS_OF = '2026-09-17T15:00:00.000Z';

const DEMO_DIAGNOSTICS: AcquisitionDiagnosticRow[] = [
  {
    id: 'diag-andino-001',
    createdAt: '2026-09-16T14:20:00.000Z',
    brandName: 'Transporte Andino',
    domain: 'transporteandino.com',
    email: 'ops@transporteandino.com',
    status: 'completed',
    tier: 'gold',
    refCode: 'emp-wa-andino',
    referrerName: 'WhatsApp Empliados',
    utmSource: 'whatsapp',
    sourceChannel: 'whatsapp',
  },
  {
    id: 'diag-ruta-002',
    createdAt: '2026-09-15T11:05:00.000Z',
    brandName: 'Ruta Sur',
    domain: 'rutasur.com.ar',
    email: 'ceo@rutasur.com.ar',
    status: 'completed',
    tier: 'freemium',
    refCode: 'emp-web-rutasur',
    referrerName: 'Web Empliados',
    utmSource: 'linkedin',
    sourceChannel: 'web',
  },
  {
    id: 'diag-pampa-003',
    createdAt: '2026-09-14T09:40:00.000Z',
    brandName: 'Distribuidora Pampa',
    domain: 'distribuidorapampa.com',
    email: 'logistica@distribuidorapampa.com',
    status: 'completed',
    tier: 'freemium',
    refCode: 'emp-ref-pampa',
    referrerName: 'Referido operador',
    utmSource: null,
    sourceChannel: 'web',
  },
  {
    id: 'diag-cuyo-004',
    createdAt: '2026-09-12T16:10:00.000Z',
    brandName: 'Logística Cuyo Express',
    domain: 'cuyoexpress.com.ar',
    email: 'hola@cuyoexpress.com.ar',
    status: 'running',
    tier: null,
    refCode: 'emp-wa-andino',
    referrerName: 'WhatsApp Empliados',
    utmSource: 'whatsapp',
    sourceChannel: 'whatsapp',
  },
  {
    id: 'diag-norte-005',
    createdAt: '2026-09-10T08:30:00.000Z',
    brandName: 'Flota Norte SA',
    domain: 'flotanorte.com',
    email: null,
    status: 'awaiting_user',
    tier: null,
    refCode: null,
    referrerName: null,
    utmSource: 'google',
    sourceChannel: 'web',
  },
  {
    id: 'diag-delta-006',
    createdAt: '2026-09-08T13:00:00.000Z',
    brandName: 'Delta Cargo',
    domain: 'deltacargo.com.ar',
    email: 'ops@deltacargo.com.ar',
    status: 'completed',
    tier: 'gold',
    refCode: 'emp-web-rutasur',
    referrerName: 'Web Empliados',
    utmSource: 'newsletter',
    sourceChannel: 'web',
  },
  {
    id: 'diag-patagonia-007',
    createdAt: '2026-09-05T10:15:00.000Z',
    brandName: 'Patagonia Fletes',
    domain: 'patagoniafletes.com',
    email: 'contacto@patagoniafletes.com',
    status: 'completed',
    tier: 'freemium',
    refCode: 'emp-ref-pampa',
    referrerName: 'Referido operador',
    utmSource: null,
    sourceChannel: 'web',
  },
  {
    id: 'diag-metro-008',
    createdAt: '2026-09-02T17:45:00.000Z',
    brandName: 'Metro Envíos BA',
    domain: 'metroenvios.ba',
    email: 'admin@metroenvios.ba',
    status: 'failed',
    tier: null,
    refCode: 'emp-wa-andino',
    referrerName: 'WhatsApp Empliados',
    utmSource: 'whatsapp',
    sourceChannel: 'whatsapp',
  },
];

function daysAgoIso(daysAgo: number, hour = 12): string {
  const d = new Date('2026-09-17T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function buildDailySeries(windowDays: ReportWindowDays) {
  const series: Array<{ date: string; created: number; completed: number; withEmail: number }> = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = daysAgoIso(i).slice(0, 10);
    const created = 2 + ((windowDays - i) % 5);
    const completed = Math.max(0, created - ((i + 1) % 3));
    const withEmail = Math.max(0, completed - (i % 2));
    series.push({ date, created, completed, withEmail });
  }
  return series;
}

function scaleForWindow(windowDays: ReportWindowDays, base30: number): number {
  if (windowDays === 7) return Math.max(1, Math.round(base30 * 0.28));
  if (windowDays === 90) return Math.round(base30 * 2.6);
  return base30;
}

function buildAcquisition(windowDays: ReportWindowDays): AcquisitionReport {
  const diagnosticsInWindow = scaleForWindow(windowDays, 86);
  const completedInWindow = scaleForWindow(windowDays, 54);
  const withEmailInWindow = scaleForWindow(windowDays, 41);
  const goldInWindow = scaleForWindow(windowDays, 12);

  return {
    windowDays,
    asOf: AS_OF,
    totals: {
      diagnosticsInWindow,
      diagnosticsAllTime: 412,
      completedInWindow,
      withEmailInWindow,
      goldInWindow,
      completionRate: completedInWindow / Math.max(1, diagnosticsInWindow),
      emailCaptureRate: withEmailInWindow / Math.max(1, diagnosticsInWindow),
      goldUpgradeRate: goldInWindow / Math.max(1, diagnosticsInWindow),
    },
    dailySeries: buildDailySeries(windowDays),
    channels: [
      { channel: 'web', count: scaleForWindow(windowDays, 48), share: 0.56 },
      { channel: 'whatsapp', count: scaleForWindow(windowDays, 28), share: 0.33 },
      { channel: 'referido', count: scaleForWindow(windowDays, 10), share: 0.11 },
    ],
    topReferrers: [
      {
        refCode: 'emp-wa-andino',
        name: 'WhatsApp Empliados',
        registered: true,
        active: true,
        isSponsor: true,
        category: 'sponsor',
        visits: scaleForWindow(windowDays, 34),
        completed: scaleForWindow(windowDays, 22),
        capturedEmails: scaleForWindow(windowDays, 18),
        completionRate: 0.65,
        latestAt: '2026-09-16T14:20:00.000Z',
      },
      {
        refCode: 'emp-web-rutasur',
        name: 'Web Empliados',
        registered: true,
        active: true,
        isSponsor: false,
        category: 'registered',
        visits: scaleForWindow(windowDays, 21),
        completed: scaleForWindow(windowDays, 14),
        capturedEmails: scaleForWindow(windowDays, 11),
        completionRate: 0.67,
        latestAt: '2026-09-15T11:05:00.000Z',
      },
      {
        refCode: 'emp-ref-pampa',
        name: 'Referido operador',
        registered: true,
        active: true,
        isSponsor: false,
        category: 'registered',
        visits: scaleForWindow(windowDays, 12),
        completed: scaleForWindow(windowDays, 8),
        capturedEmails: scaleForWindow(windowDays, 7),
        completionRate: 0.67,
        latestAt: '2026-09-14T09:40:00.000Z',
      },
    ],
    sponsorBreakdown: [
      {
        refCode: 'emp-wa-andino',
        name: 'WhatsApp Empliados',
        web: { diagnostics: scaleForWindow(windowDays, 8), withEmail: scaleForWindow(windowDays, 5) },
        whatsapp: {
          diagnostics: scaleForWindow(windowDays, 26),
          withEmail: scaleForWindow(windowDays, 13),
        },
        total: {
          diagnostics: scaleForWindow(windowDays, 34),
          withEmail: scaleForWindow(windowDays, 18),
        },
      },
    ],
    topUtmSources: [
      { source: 'whatsapp', count: scaleForWindow(windowDays, 28) },
      { source: 'linkedin', count: scaleForWindow(windowDays, 16) },
      { source: 'google', count: scaleForWindow(windowDays, 11) },
      { source: 'newsletter', count: scaleForWindow(windowDays, 7) },
    ],
    latestDiagnostics: DEMO_DIAGNOSTICS.slice(0, 25),
  };
}

function buildOnboarding(
  windowDays: ReportWindowDays,
  country?: string
): OnboardingProfileReport {
  const allRows: OnboardingProfileReport['rows'] = [
    {
      id: 'diag-andino-001',
      createdAt: '2026-09-16T14:20:00.000Z',
      brandName: 'Transporte Andino',
      domain: 'transporteandino.com',
      email: 'ops@transporteandino.com',
      status: 'completed',
      country: 'Argentina',
      firstName: 'Martín',
      lastName: 'Rivas',
      displayName: 'Martín Rivas',
      howFoundUs: 'whatsapp',
      howFoundLabel: 'WhatsApp / referido',
      hasCountry: true,
      hasName: true,
      hasHowFound: true,
    },
    {
      id: 'diag-ruta-002',
      createdAt: '2026-09-15T11:05:00.000Z',
      brandName: 'Ruta Sur',
      domain: 'rutasur.com.ar',
      email: 'ceo@rutasur.com.ar',
      status: 'completed',
      country: 'Argentina',
      firstName: 'Lucía',
      lastName: 'Ferreyra',
      displayName: 'Lucía Ferreyra',
      howFoundUs: 'linkedin',
      howFoundLabel: 'LinkedIn',
      hasCountry: true,
      hasName: true,
      hasHowFound: true,
    },
    {
      id: 'diag-pampa-003',
      createdAt: '2026-09-14T09:40:00.000Z',
      brandName: 'Distribuidora Pampa',
      domain: 'distribuidorapampa.com',
      email: 'logistica@distribuidorapampa.com',
      status: 'completed',
      country: 'Argentina',
      firstName: 'Diego',
      lastName: 'Paz',
      displayName: 'Diego Paz',
      howFoundUs: 'referido',
      howFoundLabel: 'Otro operador',
      hasCountry: true,
      hasName: true,
      hasHowFound: true,
    },
    {
      id: 'diag-delta-006',
      createdAt: '2026-09-08T13:00:00.000Z',
      brandName: 'Delta Cargo',
      domain: 'deltacargo.com.ar',
      email: 'ops@deltacargo.com.ar',
      status: 'completed',
      country: 'Uruguay',
      firstName: 'Ana',
      lastName: 'Suárez',
      displayName: 'Ana Suárez',
      howFoundUs: 'newsletter',
      howFoundLabel: 'Newsletter Empliados',
      hasCountry: true,
      hasName: true,
      hasHowFound: true,
    },
    {
      id: 'diag-patagonia-007',
      createdAt: '2026-09-05T10:15:00.000Z',
      brandName: 'Patagonia Fletes',
      domain: 'patagoniafletes.com',
      email: 'contacto@patagoniafletes.com',
      status: 'completed',
      country: 'Chile',
      firstName: null,
      lastName: null,
      displayName: null,
      howFoundUs: 'google',
      howFoundLabel: 'Búsqueda Google',
      hasCountry: true,
      hasName: false,
      hasHowFound: true,
    },
    {
      id: 'diag-cuyo-004',
      createdAt: '2026-09-12T16:10:00.000Z',
      brandName: 'Logística Cuyo Express',
      domain: 'cuyoexpress.com.ar',
      email: 'hola@cuyoexpress.com.ar',
      status: 'running',
      country: 'Argentina',
      firstName: 'Pablo',
      lastName: null,
      displayName: 'Pablo',
      howFoundUs: 'whatsapp',
      howFoundLabel: 'WhatsApp / referido',
      hasCountry: true,
      hasName: true,
      hasHowFound: true,
    },
  ];

  const selectedCountry = country?.trim() || null;
  const rows = selectedCountry
    ? allRows.filter((r) => (r.country || '').toLowerCase() === selectedCountry.toLowerCase())
    : allRows;

  const diagnosticsInWindow = scaleForWindow(windowDays, 86);
  const withProfileData = rows.length;
  const withCountry = rows.filter((r) => r.hasCountry).length;
  const withName = rows.filter((r) => r.hasName).length;
  const withHowFound = rows.filter((r) => r.hasHowFound).length;

  const howFoundBreakdown = [
    { code: 'whatsapp', label: 'WhatsApp / referido', count: 2, share: 0.33 },
    { code: 'linkedin', label: 'LinkedIn', count: 1, share: 0.17 },
    { code: 'referido', label: 'Otro operador', count: 1, share: 0.17 },
    { code: 'newsletter', label: 'Newsletter Empliados', count: 1, share: 0.17 },
    { code: 'google', label: 'Búsqueda Google', count: 1, share: 0.17 },
  ];

  const countryCounts = new Map<string, number>();
  for (const r of allRows) {
    if (!r.country) continue;
    countryCounts.set(r.country, (countryCounts.get(r.country) || 0) + 1);
  }

  return {
    windowDays,
    asOf: AS_OF,
    selectedCountry,
    availableCountries: Array.from(countryCounts.entries())
      .map(([c, count]) => ({ country: c, count }))
      .sort((a, b) => b.count - a.count),
    totals: {
      diagnosticsInWindow,
      withProfileData,
      withCountry,
      withName,
      withHowFound,
      duplicateDomainsSkipped: 3,
      profileRate: withProfileData / Math.max(1, diagnosticsInWindow),
      countryRate: withCountry / Math.max(1, diagnosticsInWindow),
      nameRate: withName / Math.max(1, diagnosticsInWindow),
      howFoundRate: withHowFound / Math.max(1, diagnosticsInWindow),
    },
    howFoundBreakdown,
    rows,
  };
}

function buildEmailOutreach(windowDays: ReportWindowDays): EmailOutreachReport {
  const weeklySent = scaleForWindow(windowDays, 318);
  const outreachSent = scaleForWindow(windowDays, 94);
  const delivered = Math.round(outreachSent * 0.91);
  const opened = Math.round(outreachSent * 0.38);
  const clicked = Math.round(outreachSent * 0.11);
  const bounced = Math.round(outreachSent * 0.04);

  const dailySeries = Array.from({ length: windowDays }, (_, idx) => {
    const i = windowDays - 1 - idx;
    return {
      date: daysAgoIso(i).slice(0, 10),
      sends: 4 + ((windowDays - i) % 7),
    };
  });

  return {
    windowDays,
    asOf: AS_OF,
    weekly: {
      campaignsConfigured: 4,
      totals: {
        sent: weeklySent,
        failed: scaleForWindow(windowDays, 14),
        skipped: scaleForWindow(windowDays, 6),
        pending: scaleForWindow(windowDays, 3),
      },
      eventsByType: {
        'email.sent': weeklySent,
        'email.delivered': Math.round(weeklySent * 0.92),
        'email.opened': scaleForWindow(windowDays, 128),
        'email.clicked': scaleForWindow(windowDays, 34),
        'email.bounced': scaleForWindow(windowDays, 12),
      },
      dailySeries,
    },
    outreach: {
      contactsAllTime: 286,
      totals: {
        sent: outreachSent,
        delivered,
        opened,
        clicked,
        bounced,
        complained: scaleForWindow(windowDays, 1),
        failed: scaleForWindow(windowDays, 4),
        delivery_delayed: scaleForWindow(windowDays, 2),
        shadow: scaleForWindow(windowDays, 18),
        real: Math.max(0, outreachSent - scaleForWindow(windowDays, 18)),
        drafts: scaleForWindow(windowDays, 7),
      },
      rates: {
        deliveryRate: delivered / Math.max(1, outreachSent),
        openRate: opened / Math.max(1, delivered),
        bounceRate: bounced / Math.max(1, outreachSent),
      },
      topDomains: [
        {
          domain: 'beetrack.com',
          sent: scaleForWindow(windowDays, 22),
          opened: scaleForWindow(windowDays, 9),
          clicked: scaleForWindow(windowDays, 3),
          openRate: 0.41,
          clickRate: 0.14,
        },
        {
          domain: 'enviame.io',
          sent: scaleForWindow(windowDays, 18),
          opened: scaleForWindow(windowDays, 7),
          clicked: scaleForWindow(windowDays, 2),
          openRate: 0.39,
          clickRate: 0.11,
        },
        {
          domain: 'melonn.com',
          sent: scaleForWindow(windowDays, 14),
          opened: scaleForWindow(windowDays, 4),
          clicked: scaleForWindow(windowDays, 1),
          openRate: 0.29,
          clickRate: 0.07,
        },
      ],
      dailySeries: dailySeries.map((row) => ({
        date: row.date,
        sends: Math.max(1, Math.round(row.sends * 0.35)),
      })),
    },
    integrations: {
      resendWebhookSecretConfigured: true,
      outreachDomainVerified: true,
    },
  };
}

function searchDiagnosticsDemo(params: {
  q: string;
  limit?: number;
  completedOnly?: boolean;
}): AcquisitionDiagnosticSearchResult {
  const q = params.q.trim().toLowerCase();
  const limit = params.limit ?? 100;
  let rows = DEMO_DIAGNOSTICS.filter((row) => {
    const hay = `${row.brandName} ${row.domain} ${row.email || ''}`.toLowerCase();
    return hay.includes(q);
  });
  if (params.completedOnly) {
    rows = rows.filter((r) => r.status === 'completed');
  }
  const totalMatching = rows.length;
  const sliced = rows.slice(0, limit);
  return {
    ok: true,
    query: params.q.trim(),
    completedOnly: Boolean(params.completedOnly),
    limit,
    totalMatching,
    returned: sliced.length,
    truncated: totalMatching > sliced.length,
    rows: sliced,
  };
}

export function createPortalReportesLoaders() {
  return {
    acquisition: async (windowDays: ReportWindowDays) => buildAcquisition(windowDays),
    onboardingProfile: async (windowDays: ReportWindowDays, country?: string) =>
      buildOnboarding(windowDays, country),
    emailOutreach: async (windowDays: ReportWindowDays) => buildEmailOutreach(windowDays),
    searchDiagnostics: async (params: {
      q: string;
      limit?: number;
      completedOnly?: boolean;
    }) => searchDiagnosticsDemo(params),
  };
}
