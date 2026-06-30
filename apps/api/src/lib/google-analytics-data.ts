/**
 * Cliente mínimo de Google Analytics Data API (GA4) y Admin API (listar propiedades).
 *
 * Sin SDK: fetch + access_token Bearer.
 *
 * Endpoints usados:
 *   - GET  https://analyticsadmin.googleapis.com/v1beta/accountSummaries
 *   - POST https://analyticsdata.googleapis.com/v1beta/{property}:runReport
 */

export type GA4PropertySummary = {
  accountId: string;
  accountName: string;
  propertyId: string;   // "properties/123456"
  propertyName: string; // ej "Cleexs Web"
  displayName: string;  // accountName · propertyName
};

export type AITrafficRow = {
  date: string;       // YYYY-MM-DD
  aiSource: string;   // chatgpt | perplexity | gemini | claude | copilot | you | otros_ia
  sourceRaw: string;  // valor original de GA4 (sessionSource)
  landingPage: string | null;
  sessions: number;
  totalUsers: number;
  newUsers: number;
  conversions: number;
  engagedSessions: number;
  bounceRate: number | null;
};

/**
 * Mapeo de dominios/hostnames conocidos de IAs a una key normalizada.
 * Si en el futuro aparece una nueva IA, agregar acá.
 */
const AI_SOURCE_MAP: Array<{ key: string; matches: RegExp[] }> = [
  {
    key: 'chatgpt',
    matches: [/(^|\.)chat\.openai\.com$/i, /(^|\.)chatgpt\.com$/i],
  },
  {
    key: 'perplexity',
    matches: [/(^|\.)perplexity\.ai$/i],
  },
  {
    key: 'gemini',
    matches: [/(^|\.)gemini\.google\.com$/i, /(^|\.)bard\.google\.com$/i],
  },
  {
    key: 'claude',
    matches: [/(^|\.)claude\.ai$/i, /(^|\.)anthropic\.com$/i],
  },
  {
    key: 'copilot',
    matches: [/(^|\.)copilot\.microsoft\.com$/i, /(^|\.)bing\.com$/i],
  },
  {
    key: 'you',
    matches: [/(^|\.)you\.com$/i],
  },
];

export function normalizeAISource(rawSource: string): string {
  const s = (rawSource || '').toLowerCase().trim();
  if (!s) return 'otros_ia';
  for (const { key, matches } of AI_SOURCE_MAP) {
    if (matches.some((rx) => rx.test(s))) return key;
  }
  return 'otros_ia';
}

/** Listado de fuentes que enviamos como filtro a GA4 (matches por igualdad/inicio). */
export const AI_SOURCE_FILTER_VALUES = [
  'chat.openai.com',
  'chatgpt.com',
  'perplexity.ai',
  'gemini.google.com',
  'bard.google.com',
  'claude.ai',
  'anthropic.com',
  'copilot.microsoft.com',
  'you.com',
];

/** Lista las propiedades GA4 a las que tiene acceso el usuario autenticado. */
export async function listGA4Properties(accessToken: string): Promise<GA4PropertySummary[]> {
  const url = new URL('https://analyticsadmin.googleapis.com/v1beta/accountSummaries');
  url.searchParams.set('pageSize', '200');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GA4 listAccounts falló (${res.status}): ${txt}`);
  }

  type ApiResp = {
    accountSummaries?: Array<{
      account?: string;
      displayName?: string;
      propertySummaries?: Array<{
        property?: string;
        displayName?: string;
      }>;
    }>;
  };
  const data = (await res.json()) as ApiResp;
  const out: GA4PropertySummary[] = [];

  for (const acc of data.accountSummaries || []) {
    const accountId = (acc.account || '').replace(/^accounts\//, '');
    const accountName = acc.displayName || '(cuenta sin nombre)';
    for (const prop of acc.propertySummaries || []) {
      if (!prop.property) continue;
      out.push({
        accountId,
        accountName,
        propertyId: prop.property,
        propertyName: prop.displayName || '(propiedad sin nombre)',
        displayName: `${accountName} · ${prop.displayName || prop.property}`,
      });
    }
  }
  return out;
}

/**
 * Ejecuta runReport contra GA4 y devuelve filas agrupadas por (fecha + fuente IA + landing).
 * Filtra solo sessionSource matcheando dominios conocidos de IAs.
 */
export async function runAITrafficReport(input: {
  accessToken: string;
  propertyId: string; // "properties/123456"
  startDate?: string; // default: 30daysAgo
  endDate?: string;   // default: yesterday
}): Promise<AITrafficRow[]> {
  const { accessToken, propertyId } = input;
  const startDate = input.startDate || '30daysAgo';
  const endDate = input.endDate || 'yesterday';

  const body = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'date' },
      { name: 'sessionSource' },
      { name: 'landingPagePlusQueryString' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'conversions' },
      { name: 'engagedSessions' },
      { name: 'bounceRate' },
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'sessionSource',
        inListFilter: {
          values: AI_SOURCE_FILTER_VALUES,
          caseSensitive: false,
        },
      },
    },
    limit: '10000',
  };

  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GA4 runReport falló (${res.status}): ${txt}`);
  }

  type ApiResp = {
    rows?: Array<{
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }>;
  };
  const data = (await res.json()) as ApiResp;
  const out: AITrafficRow[] = [];

  for (const row of data.rows || []) {
    const dims = row.dimensionValues || [];
    const mets = row.metricValues || [];

    const dateRaw = dims[0]?.value || '';     // YYYYMMDD
    const sourceRaw = dims[1]?.value || '';
    const landing = dims[2]?.value || null;

    const date =
      dateRaw.length === 8
        ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
        : dateRaw;

    out.push({
      date,
      aiSource: normalizeAISource(sourceRaw),
      sourceRaw,
      landingPage: landing,
      sessions: numFrom(mets[0]?.value),
      totalUsers: numFrom(mets[1]?.value),
      newUsers: numFrom(mets[2]?.value),
      conversions: numFrom(mets[3]?.value),
      engagedSessions: numFrom(mets[4]?.value),
      bounceRate: floatFrom(mets[5]?.value),
    });
  }
  return out;
}

function numFrom(v?: string): number {
  if (!v) return 0;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
function floatFrom(v?: string): number | null {
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}
