/**
 * Datos de demo Empliados para las pantallas de Email (mismo layout/código que admin,
 * sin los datos reales de Cleexs).
 */

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EMPLIADOS_CAMPAIGNS = [
  {
    id: 'emp-seq-d0',
    slug: 'empliados-post-demo-d0',
    weekIndex: 0,
    scoreBucket: 'all',
    title: 'Día 0 — Gracias por la demo',
    description: 'Qué hace cada Empliado en tu operación (reclamos, seguimiento, coordinación).',
    espTemplateId: null,
    subject: 'Gracias por la demo · qué hace cada Empliado en tu operación',
    body: null,
    preheader: 'Tu oficina virtual de logística, paso a paso',
    templateVariant: 'letter',
    active: true,
    priority: 10,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  },
  {
    id: 'emp-seq-d2',
    slug: 'empliados-post-demo-d2',
    weekIndex: 0,
    scoreBucket: 'all',
    title: 'Día 2 — Caso reclamos 24/7',
    description: 'Menos llamados a la oficina con el Agente de Reclamos.',
    espTemplateId: null,
    subject: 'Caso reclamos 24/7 · menos llamados a la oficina',
    body: null,
    preheader: 'Cómo un cliente bajó el teléfono un 40%',
    templateVariant: 'letter',
    active: true,
    priority: 20,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  },
  {
    id: 'emp-seq-d5',
    slug: 'empliados-post-demo-d5',
    weekIndex: 0,
    scoreBucket: 'all',
    title: 'Día 5 — Link de referidos',
    description: 'Programa de referidos Empliados para operadores.',
    espTemplateId: null,
    subject: 'Tu link de referidos Empliados',
    body: null,
    preheader: 'Compartí y sumá crédito en agentes',
    templateVariant: 'letter',
    active: true,
    priority: 30,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  },
  {
    id: 'emp-seq-d12',
    slug: 'empliados-post-demo-d12',
    weekIndex: 0,
    scoreBucket: 'all',
    title: 'Día 12 — 2º agente',
    description: 'Activar Agente de Seguimiento de viajes.',
    espTemplateId: null,
    subject: 'Activá el 2º agente · seguimiento de viajes',
    body: null,
    preheader: 'Tu flota visible 24/7',
    templateVariant: 'editorial',
    active: false,
    priority: 40,
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-09-10T12:00:00.000Z',
  },
];

const EMPLIADOS_LOGS = [
  {
    id: 'log-1',
    recipientEmail: 'ops@transporteandino.com',
    campaignSlug: 'empliados-post-demo-d0',
    scoreBucket: 'mid',
    cleexsScore: 54,
    status: 'sent',
    createdAt: '2026-09-16T14:20:00.000Z',
    externalId: 're_emp_001',
  },
  {
    id: 'log-2',
    recipientEmail: 'ceo@rutasur.com.ar',
    campaignSlug: 'empliados-post-demo-d2',
    scoreBucket: 'high',
    cleexsScore: 71,
    status: 'sent',
    createdAt: '2026-09-15T11:05:00.000Z',
    externalId: 're_emp_002',
  },
  {
    id: 'log-3',
    recipientEmail: 'logistica@distribuidorapampa.com',
    campaignSlug: 'empliados-post-demo-d5',
    scoreBucket: 'low',
    cleexsScore: 38,
    status: 'failed',
    createdAt: '2026-09-14T09:40:00.000Z',
    externalId: null,
  },
];

const EMPLIADOS_BATCHES = {
  batches: [
    {
      campaignSlug: 'empliados-post-demo-d0',
      firstSendAt: '2026-08-20T10:00:00.000Z',
      lastSendAt: '2026-09-17T15:00:00.000Z',
      totals: { total: 186, sent: 178, failed: 8, skipped: 0, pending: 0 },
      resend: {
        withExternalId: 178,
        delivered: 162,
        opened: 74,
        clicked: 19,
        bounced: 6,
        complained: 0,
        failed: 2,
        noEventsYet: 8,
      },
      mode: 'post_demo',
      variant: 'letter',
    },
    {
      campaignSlug: 'empliados-post-demo-d2',
      firstSendAt: '2026-08-22T10:00:00.000Z',
      lastSendAt: '2026-09-16T12:00:00.000Z',
      totals: { total: 142, sent: 138, failed: 4, skipped: 0, pending: 0 },
      resend: {
        withExternalId: 138,
        delivered: 130,
        opened: 51,
        clicked: 11,
        bounced: 3,
        complained: 0,
        failed: 1,
        noEventsYet: 5,
      },
      mode: 'post_demo',
      variant: 'letter',
    },
  ],
};

const FREE_SEQUENCE = {
  ok: true,
  config: {
    active: true,
    timezone: 'America/Argentina/Buenos_Aires',
    fromName: 'Empliados',
    replyTo: 'hola@empliados.net',
  },
  steps: [
    {
      id: 'fs-1',
      sortOrder: 1,
      delayDaysAfterPrevious: 0,
      title: 'Bienvenida post-demo',
      subject: 'Gracias por la demo · qué hace cada Empliado',
      preheader: 'Tu oficina virtual de logística',
      body: 'Hola {{nombre}},\n\nGracias por la demo. Acá te dejo cómo cada Empliado (reclamos, seguimiento, coordinación) entra en tu operación.\n\nEquipo Empliados',
      templateVariant: 'letter',
      active: true,
    },
    {
      id: 'fs-2',
      sortOrder: 2,
      delayDaysAfterPrevious: 2,
      title: 'Caso reclamos',
      subject: 'Caso reclamos 24/7 · menos llamados a la oficina',
      preheader: 'Operadores que ya lo usan',
      body: 'Te comparto un caso de flota en CABA que bajó el teléfono un 40% con el Agente de Reclamos.\n\n¿Agendamos 15 min?',
      templateVariant: 'letter',
      active: true,
    },
    {
      id: 'fs-3',
      sortOrder: 3,
      delayDaysAfterPrevious: 3,
      title: 'Referidos',
      subject: 'Tu link de referidos Empliados',
      preheader: 'Sumá crédito en agentes',
      body: 'Si conocés otro operador con +25 viajes/día, compartí tu link y sumás crédito para activar el 2º agente.',
      templateVariant: 'letter',
      active: true,
    },
  ],
  suggestedDefaults: [],
  insightCatalog: [],
};

function pathnameOf(input: string): { path: string; search: string } {
  const u = input.startsWith('http') ? new URL(input) : new URL(input, 'http://local');
  return { path: u.pathname, search: u.search };
}

/** Fetch demo: mismos paths que admin-ui/email, respuestas Empliados. */
export function createPortalEmailDemoFetch() {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const raw = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    let url = raw;
    if (url.startsWith('/api/admin-ui/email/')) {
      url = url.replace('/api/admin-ui/email/', '/api/borrador/portal-email/');
    } else if (url.startsWith('/api/admin-ui/monthly-score-emails/')) {
      url = url.replace('/api/admin-ui/monthly-score-emails/', '/api/borrador/portal-email/monthly-score-emails/');
    }
    const { path } = pathnameOf(url);
    const key = path.replace(/^\/api\/borrador\/portal-email\//, '');

    // Mutaciones: OK stub (layout editable sin tocar Cleexs).
    if (method !== 'GET' && method !== 'HEAD') {
      if (key.startsWith('free-sequence-preview')) {
        return json({ ...FREE_SEQUENCE, message: 'Guardado (demo Empliados)' });
      }
      return json({ ok: true, dryRun: true, message: 'Acción demo · sin envío real' });
    }

    if (key === 'stats') {
      return json({
        windowDays: 30,
        campaignsConfigured: EMPLIADOS_CAMPAIGNS.length,
        logsAllTime: 412,
        byStatusLast30Days: { sent: 318, failed: 14, skipped: 6 },
        resendWebhook: {
          available: true,
          windowDays: 30,
          secretConfigured: true,
          ingestUrl: '/api/webhooks/resend',
          ingestAbsoluteUrl: null,
          eventsTotalLastWindow: 520,
          eventsByTypeLastWindow: {
            'email.sent': 318,
            'email.opened': 128,
            'email.clicked': 34,
            'email.bounced': 12,
          },
          uniqueEmailsByStageLastWindow: {
            sent: 186,
            delivered: 170,
            opened: 74,
            clicked: 19,
            bounced: 12,
            failed: 4,
          },
          note: 'Demo portal Empliados · métricas ilustrativas post-demo.',
        },
      });
    }

    if (key === 'campaigns') return json(EMPLIADOS_CAMPAIGNS);
    if (key.startsWith('logs')) return json(EMPLIADOS_LOGS);
    if (key === 'batches' || key.startsWith('batches?')) return json(EMPLIADOS_BATCHES);
    if (key.startsWith('batches/')) {
      const slug = decodeURIComponent(key.slice('batches/'.length).split('?')[0] || '');
      const batch = EMPLIADOS_BATCHES.batches.find((b) => b.campaignSlug === slug) || EMPLIADOS_BATCHES.batches[0];
      return json({
        batch,
        recipients: EMPLIADOS_LOGS.filter((l) => l.campaignSlug === batch?.campaignSlug).map((l) => ({
          ...l,
          recipientEmail: l.recipientEmail,
        })),
      });
    }

    if (key.startsWith('analytics/recipients')) {
      return json({
        ok: true,
        items: EMPLIADOS_LOGS.map((l) => ({
          id: l.id,
          recipientEmail: l.recipientEmail,
          campaignSlug: l.campaignSlug,
          variant: 'letter',
          cleexsScore: l.cleexsScore,
          sentAt: l.createdAt,
          delivered: l.status === 'sent',
          opened: l.status === 'sent',
          clicked: l.id === 'log-1',
          clicksBreakdown: {
            plans: l.id === 'log-1',
            diagnostic: false,
            report: false,
            share: false,
            other: false,
          },
          purchased: l.id === 'log-2',
          purchaseTemplate: l.id === 'log-2' ? 'sol-completo' : null,
        })),
      });
    }
    if (key.startsWith('analytics')) {
      return json({
        ok: true,
        range: { from: '2026-08-20', to: '2026-09-17' },
        funnel: {
          sent: { count: 318, pct: null },
          delivered: { count: 290, pct: 91 },
          opened: { count: 128, pct: 40 },
          clicks: {
            count: 34,
            pct: 27,
            breakdown: {
              plans: { count: 12, pct: 35 },
              diagnostic: { count: 8, pct: 24 },
              report: { count: 6, pct: 18 },
              share: { count: 4, pct: 12 },
              other: { count: 4, pct: 12 },
            },
          },
          purchased: { count: 7, pct: 21 },
        },
        byCampaign: EMPLIADOS_BATCHES.batches.map((b) => ({
          campaignSlug: b.campaignSlug,
          variant: b.variant,
          label: b.campaignSlug,
          kind: 'scheduled' as const,
          sent: b.totals.sent,
          opened: b.resend.opened,
          clicksTotal: b.resend.clicked,
          clicksBreakdown: {
            plans: Math.max(1, Math.round(b.resend.clicked * 0.4)),
            diagnostic: Math.max(0, Math.round(b.resend.clicked * 0.25)),
            report: Math.max(0, Math.round(b.resend.clicked * 0.15)),
            share: Math.max(0, Math.round(b.resend.clicked * 0.1)),
            other: Math.max(0, Math.round(b.resend.clicked * 0.1)),
          },
          purchased: 2,
          delivered: b.resend.delivered,
        })),
        integrations: {
          resendWebhookSecretConfigured: true,
          note: 'Demo portal Empliados · métricas ilustrativas post-demo.',
          scope: 'empliados-demo',
          resendEventsLast7Days: {
            'email.sent': 86,
            'email.opened': 34,
            'email.clicked': 9,
            'email.bounced': 2,
          },
        },
      });
    }

    if (key === 'free-sequence-preview') return json(FREE_SEQUENCE);
    if (key === 'templates/preview' || key.startsWith('templates/preview')) {
      return json({
        ok: true,
        variant: 'letter',
        subject: 'Gracias por la demo · Empliados',
        html: '<div style="font-family:sans-serif;padding:24px"><h1>Empliados</h1><p>Vista previa carta · agentes IA logística.</p></div>',
        text: 'Empliados — vista previa carta',
        assets: { logoUrl: '/CleexsLogo.png', heroImageUrl: null, founderPhotoUrl: null },
        sampleScore: 54,
        sampleDomain: 'empliados.net',
        sampleBrandName: 'Empliados',
        newDiagnosticUrl: 'https://app.cleexs.net/diagnostico/crear',
        plansUrl: 'https://app.cleexs.net/planes',
      });
    }

    return json({ error: `Demo sin ruta: ${key}` }, 404);
  };
}
