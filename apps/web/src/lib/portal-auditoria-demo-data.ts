/**
 * Datos demo Empliados para Auditoría Agéntica (mismo layout/código que admin,
 * sin ops live de Cleexs).
 */

import type { AgenticAuditResult } from '@/components/agentic-audit/audit-report';
import type { AuditDetail, AuditRow } from '@/components/auditoria/auditoria-agentica-dashboard';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const RESULT_ANDINO: AgenticAuditResult = {
  targetUrl: 'https://www.transporteandino.com',
  finalUrl: 'https://www.transporteandino.com/',
  fetchedAt: '2026-09-14T15:20:00.000Z',
  overallScore: 68,
  grade: 'C',
  categories: [
    {
      id: 'crawl',
      label: 'Acceso de agentes',
      weight: 0.3,
      score: 78,
      checks: [
        {
          id: 'robots-gptbot',
          label: 'robots.txt · GPTBot',
          status: 'pass',
          score: 100,
          summary: 'GPTBot permitido.',
        },
        {
          id: 'robots-claude',
          label: 'robots.txt · ClaudeBot',
          status: 'warn',
          score: 60,
          summary: 'ClaudeBot no mencionado; se asume allow por defecto.',
        },
        {
          id: 'sitemap',
          label: 'sitemap.xml',
          status: 'pass',
          score: 90,
          summary: 'Sitemap presente con 42 URLs.',
        },
      ],
    },
    {
      id: 'structure',
      label: 'Estructura semántica',
      weight: 0.35,
      score: 55,
      checks: [
        {
          id: 'schema',
          label: 'Schema Organization / SoftwareApplication',
          status: 'fail',
          score: 20,
          summary: 'Falta JSON-LD de Organization y servicio logístico.',
          detail: 'Agregar Organization + Service con áreaServed Argentina.',
        },
        {
          id: 'headings',
          label: 'Jerarquía H1–H3',
          status: 'pass',
          score: 85,
          summary: 'Un H1 claro en home; secciones bien marcadas.',
        },
        {
          id: 'faq',
          label: 'FAQ indexables',
          status: 'warn',
          score: 50,
          summary: 'Hay FAQ en HTML pero sin FAQPage schema.',
        },
      ],
    },
    {
      id: 'content',
      label: 'Contenido citable',
      weight: 0.35,
      score: 72,
      checks: [
        {
          id: 'answers',
          label: 'Respuestas directas',
          status: 'pass',
          score: 80,
          summary: 'Párrafos cortos que un agente puede citar.',
        },
        {
          id: 'contact',
          label: 'Datos de contacto claros',
          status: 'pass',
          score: 90,
          summary: 'Teléfono y WhatsApp visibles en footer.',
        },
        {
          id: 'canonical',
          label: 'Canonicals',
          status: 'warn',
          score: 55,
          summary: 'Algunas landings sin canonical.',
        },
      ],
    },
  ],
  recommendations: [
    {
      priority: 'alta',
      category: 'Estructura',
      title: 'Agregar JSON-LD Organization + Service',
      detail: 'Sin schema, los agentes no asocian marca ↔ flota/reclamos con confianza.',
    },
    {
      priority: 'media',
      category: 'Acceso',
      title: 'Declarar ClaudeBot y PerplexityBot en robots.txt',
      detail: 'Explicitá allow para los crawlers de agentes que usás en demos.',
    },
    {
      priority: 'baja',
      category: 'Contenido',
      title: 'Marcar FAQ con FAQPage',
      detail: 'Mejora citas en Perplexity y Gemini sobre tiempos de entrega.',
    },
  ],
  meta: {
    psiUsed: false,
    durationMs: 42000,
    warnings: [],
    toolsSource: 'empliados-demo',
  },
};

const RESULT_RUTA: AgenticAuditResult = {
  ...RESULT_ANDINO,
  targetUrl: 'https://rutasur.com.ar',
  finalUrl: 'https://rutasur.com.ar/',
  fetchedAt: '2026-09-10T11:00:00.000Z',
  overallScore: 81,
  grade: 'B',
  categories: RESULT_ANDINO.categories.map((cat) =>
    cat.id === 'structure' ? { ...cat, score: 78, checks: cat.checks.map((c) => (c.id === 'schema' ? { ...c, status: 'pass' as const, score: 85, summary: 'Organization + LocalBusiness presentes.' } : c)) } : cat
  ),
  recommendations: [
    {
      priority: 'media',
      category: 'Contenido',
      title: 'Expandir página de agentes / SOL',
      detail: 'Más copy citable sobre seguimiento de viajes 24/7.',
    },
  ],
};

let DEMO_ITEMS: AuditDetail[] = [
  {
    id: 'aud-emp-1',
    slug: 'transporte-andino-2026',
    targetUrl: 'https://www.transporteandino.com',
    siteLabel: 'Transporte Andino',
    clientEmail: 'ops@transporteandino.com',
    status: 'completed',
    overallScore: 68,
    paidAt: '2026-09-12T18:00:00.000Z',
    deliveredAt: '2026-09-14T16:00:00.000Z',
    createdAt: '2026-09-12T17:30:00.000Z',
    updatedAt: '2026-09-14T15:20:00.000Z',
    resultJson: RESULT_ANDINO,
    error: null,
    notes: 'Demo post-piloto reclamos',
  },
  {
    id: 'aud-emp-2',
    slug: 'ruta-sur-2026',
    targetUrl: 'https://rutasur.com.ar',
    siteLabel: 'Ruta Sur',
    clientEmail: 'ceo@rutasur.com.ar',
    status: 'completed',
    overallScore: 81,
    paidAt: '2026-09-08T12:00:00.000Z',
    deliveredAt: null,
    createdAt: '2026-09-08T11:40:00.000Z',
    updatedAt: '2026-09-10T11:00:00.000Z',
    resultJson: RESULT_RUTA,
    error: null,
    notes: null,
  },
  {
    id: 'aud-emp-3',
    slug: 'distribuidora-pampa-pendiente',
    targetUrl: 'https://distribuidorapampa.com',
    siteLabel: 'Distribuidora Pampa',
    clientEmail: 'logistica@distribuidorapampa.com',
    status: 'running',
    overallScore: null,
    paidAt: null,
    deliveredAt: null,
    createdAt: '2026-09-17T20:00:00.000Z',
    updatedAt: '2026-09-17T20:05:00.000Z',
    resultJson: null,
    error: null,
    notes: 'En cola demo',
  },
];

function toRow(item: AuditDetail): AuditRow {
  const { resultJson: _r, error: _e, notes: _n, ...row } = item;
  return row;
}

function pathnameOf(input: string): string {
  const u = input.startsWith('http') ? new URL(input) : new URL(input, 'http://local');
  return u.pathname;
}

/** Fetch demo: mismos paths que admin-ui/agentic-audits. */
export function createPortalAuditoriaDemoFetch() {
  return async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const raw = String(input);
    const method = (init?.method || 'GET').toUpperCase();
    let url = raw;
    if (url.startsWith('/api/admin-ui/agentic-audits')) {
      url = url.replace('/api/admin-ui/agentic-audits', '/api/borrador/portal-auditoria');
    }
    const path = pathnameOf(url);
    const rest = path.replace(/^\/api\/borrador\/portal-auditoria\/?/, '');
    const parts = rest ? rest.split('/') : [];
    const id = parts[0] || null;
    const action = parts[1] || null;

    if (!id && method === 'GET') {
      return json({ items: DEMO_ITEMS.map(toRow) });
    }

    if (!id && method === 'POST') {
      let body: { targetUrl?: string; siteLabel?: string | null; clientEmail?: string | null; notes?: string | null } = {};
      try {
        body = JSON.parse(String(init?.body || '{}'));
      } catch {
        /* ignore */
      }
      const now = new Date().toISOString();
      const newId = `aud-emp-${Date.now()}`;
      const slug = `demo-${Date.now()}`;
      const item: AuditDetail = {
        id: newId,
        slug,
        targetUrl: body.targetUrl || 'https://ejemplo.com',
        siteLabel: body.siteLabel || 'Nuevo sitio (demo)',
        clientEmail: body.clientEmail || null,
        status: 'completed',
        overallScore: 74,
        paidAt: null,
        deliveredAt: null,
        createdAt: now,
        updatedAt: now,
        resultJson: {
          ...RESULT_ANDINO,
          targetUrl: body.targetUrl || RESULT_ANDINO.targetUrl,
          overallScore: 74,
          grade: 'C',
          fetchedAt: now,
        },
        error: null,
        notes: body.notes || 'Creada en portal demo',
      };
      DEMO_ITEMS = [item, ...DEMO_ITEMS];
      return json({ item }, 201);
    }

    const found = DEMO_ITEMS.find((i) => i.id === id);
    if (!found) return json({ error: 'No encontrada' }, 404);

    if (action === 'run' && method === 'POST') {
      found.status = 'completed';
      found.overallScore = found.overallScore ?? 70;
      found.resultJson = found.resultJson ?? RESULT_ANDINO;
      found.updatedAt = new Date().toISOString();
      return json({ ok: true, item: found });
    }

    if (method === 'GET') {
      // Simula que “running” termina al abrir detalle (demo).
      if (found.status === 'running' || found.status === 'pending') {
        found.status = 'completed';
        found.overallScore = 62;
        found.resultJson = RESULT_ANDINO;
        found.updatedAt = new Date().toISOString();
      }
      return json({ item: found });
    }

    if (method === 'PATCH') {
      let body: { paid?: boolean; delivered?: boolean } = {};
      try {
        body = JSON.parse(String(init?.body || '{}'));
      } catch {
        /* ignore */
      }
      if (typeof body.paid === 'boolean') {
        found.paidAt = body.paid ? new Date().toISOString() : null;
      }
      if (typeof body.delivered === 'boolean') {
        found.deliveredAt = body.delivered ? new Date().toISOString() : null;
      }
      found.updatedAt = new Date().toISOString();
      return json({ item: found });
    }

    if (method === 'DELETE') {
      DEMO_ITEMS = DEMO_ITEMS.filter((i) => i.id !== id);
      return json({ ok: true });
    }

    return json({ error: `Demo sin ruta: ${path}` }, 404);
  };
}
