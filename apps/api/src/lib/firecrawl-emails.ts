/**
 * Helper compartido para extraer emails de un dominio via Firecrawl.
 *
 * Estrategia en dos pasos (docs oficiales Firecrawl v2):
 * 1) POST /v2/map  -> descubre URLs REALES del sitio (1 credito total).
 *    Con `search: 'contact'` los devuelve ordenados por relevancia.
 * 2) POST /v2/scrape (sincronico) sobre las URLs mas probables y extraemos
 *    emails de markdown + HTML (href="mailto:...") + array de links.
 *
 * IMPORTANTE: NO uses /v2/extract para esto. Es asincrono y requiere polling
 * del jobId. Si haces POST y lees la respuesta directo, recibis el jobId pero
 * Firecrawl igual cobra creditos por el trabajo que queda corriendo solo.
 */

// Patron para rankear URLs candidatas. Mas rutas = mas cobertura. Case-insensitive.
const RELEVANT_URL_REGEX =
  /(contact|contacto|contactanos|kontakt|press|prensa|media|about|nosotros|quienes|soporte|support|ayuda|help|inversor|investor|legal|privacidad|privacy|denuncia|prensa|corporativo)/i;

// Fallback para dominios en los que /v2/map no devuelve nada util.
const FALLBACK_PATHS = [
  '',
  '/contact',
  '/contacto',
  '/contactanos',
  '/about',
  '/nosotros',
  '/prensa',
  '/press',
] as const;

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAILTO_HREF_REGEX = /href\s*=\s*["']?mailto:([^"'?\s>]+)/gi;
const OBFUSCATED_REGEX =
  /([A-Z0-9._%+-]+)\s*(?:\(at\)|\[at\]|\{at\}|\s+at\s+)\s*([A-Z0-9.-]+)\s*(?:\(dot\)|\[dot\]|\{dot\}|\s+dot\s+)\s*([A-Z]{2,})/gi;

const GENERIC_LOCALS = new Set([
  'example',
  'sentry',
  'noreply',
  'no-reply',
  'do-not-reply',
  'donotreply',
  'postmaster',
  'mailer-daemon',
  'abuse',
  'webmaster',
  'hostmaster',
]);

const ASSET_SUFFIXES = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico', '.bmp'];

const MAX_PAGES_TO_SCRAPE = 8;
const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v2';

export interface FirecrawlEmailsResult {
  emails: string[];
  map: {
    ok: boolean;
    totalLinks: number;
    relevantLinks: number;
    error?: string;
    urlsScraped: string[];
  };
  attempts: Array<{
    url: string;
    ok: boolean;
    status?: number;
    error?: string;
    markdownLength?: number;
    htmlLength?: number;
    linksCount?: number;
    matches?: number;
    mailtoMatches?: number;
    linkMatches?: number;
  }>;
  error?: string;
}

function isValidEmail(email: string): boolean {
  if (!email || email.length > 200) return false;
  const [local] = email.split('@');
  if (!local) return false;
  if (GENERIC_LOCALS.has(local)) return false;
  if (ASSET_SUFFIXES.some((s) => email.endsWith(s))) return false;
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) return false;
  return true;
}

function collectFromText(text: string, target: Set<string>): number {
  let count = 0;
  const matches = text.match(EMAIL_REGEX) || [];
  for (const raw of matches) {
    const email = raw.toLowerCase().trim();
    if (isValidEmail(email) && !target.has(email)) {
      target.add(email);
      count += 1;
    }
  }
  OBFUSCATED_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = OBFUSCATED_REGEX.exec(text)) !== null) {
    const email = `${m[1]}@${m[2]}.${m[3]}`.toLowerCase();
    if (isValidEmail(email) && !target.has(email)) {
      target.add(email);
      count += 1;
    }
  }
  return count;
}

function collectFromHrefs(html: string, target: Set<string>): number {
  let count = 0;
  MAILTO_HREF_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MAILTO_HREF_REGEX.exec(html)) !== null) {
    const email = decodeURIComponent(m[1] || '').toLowerCase().trim();
    if (isValidEmail(email) && !target.has(email)) {
      target.add(email);
      count += 1;
    }
  }
  return count;
}

function collectFromLinks(links: string[], target: Set<string>): number {
  let count = 0;
  for (const link of links) {
    if (!link) continue;
    const lower = link.toLowerCase();
    if (!lower.startsWith('mailto:')) continue;
    const raw = lower.replace(/^mailto:/, '').split('?')[0].trim();
    if (isValidEmail(raw) && !target.has(raw)) {
      target.add(raw);
      count += 1;
    }
  }
  return count;
}

/**
 * Paso 1: /v2/map -> lista de URLs reales del dominio, ordenadas por relevancia
 * cuando pasamos `search`. 1 credito por llamada (vs 1 credito por /scrape).
 */
async function mapDomain(
  domain: string,
  apiKey: string
): Promise<{ links: Array<{ url: string; title?: string }>; error?: string }> {
  try {
    const response = await fetch(`${FIRECRAWL_BASE}/map`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: `https://${domain}`,
        search: 'contact',
        limit: 200,
        includeSubdomains: true,
        ignoreQueryParameters: true,
      }),
    });
    if (!response.ok) {
      return { links: [], error: `map HTTP ${response.status}` };
    }
    const payload = (await response.json()) as {
      success?: boolean;
      links?: Array<{ url: string; title?: string; description?: string }>;
    };
    return { links: payload?.links || [] };
  } catch (err) {
    return { links: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Paso 2: /v2/scrape de UNA url. Formatos: markdown + html + links.
 */
async function scrapeUrl(
  url: string,
  apiKey: string,
  timeout: number
): Promise<{
  markdown: string;
  html: string;
  links: string[];
  status: number;
  error?: string;
}> {
  try {
    const response = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false,
        timeout,
      }),
    });
    const status = response.status;
    if (!response.ok) {
      return { markdown: '', html: '', links: [], status, error: `HTTP ${status}` };
    }
    const payload = (await response.json()) as {
      success?: boolean;
      data?: {
        markdown?: string;
        html?: string;
        rawHtml?: string;
        links?: string[];
      };
    };
    return {
      markdown: payload?.data?.markdown || '',
      html: payload?.data?.html || payload?.data?.rawHtml || '',
      links: payload?.data?.links || [],
      status,
    };
  } catch (err) {
    return {
      markdown: '',
      html: '',
      links: [],
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function scrapeEmailsForDomain(
  domain: string,
  apiKey: string,
  opts: { timeoutMs?: number } = {}
): Promise<FirecrawlEmailsResult> {
  const timeout = opts.timeoutMs ?? 20_000;
  const found = new Set<string>();
  const attempts: FirecrawlEmailsResult['attempts'] = [];

  // 1) MAP: obtenemos URLs reales del sitio ordenadas por relevancia para 'contact'.
  const mapResult = await mapDomain(domain, apiKey);
  const allLinks = mapResult.links;

  // Filtramos los que tengan palabras clave relevantes para contactos.
  // Priorizamos tambien URLs cortas (menos probable que sean articulos de blog).
  const relevantUrls = allLinks
    .map((l) => l.url)
    .filter((u) => typeof u === 'string' && u.startsWith('http'))
    .filter((u) => RELEVANT_URL_REGEX.test(u))
    .sort((a, b) => a.length - b.length);

  // Si no hay URLs relevantes o el map fallo, caemos a rutas "adivinadas".
  const urlsToScrape: string[] =
    relevantUrls.length > 0
      ? [`https://${domain}`, ...relevantUrls].slice(0, MAX_PAGES_TO_SCRAPE)
      : FALLBACK_PATHS.map((p) => `https://${domain}${p}`).slice(0, MAX_PAGES_TO_SCRAPE);

  // Deduplicar.
  const uniqueUrls = Array.from(new Set(urlsToScrape));

  let firstError: string | undefined = mapResult.error;

  // 2) SCRAPE: cada URL, juntando emails de texto, mailto y array de links.
  for (const url of uniqueUrls) {
    const result = await scrapeUrl(url, apiKey, timeout);
    const attempt: FirecrawlEmailsResult['attempts'][number] = {
      url,
      ok: false,
      status: result.status,
    };
    if (result.error) {
      attempt.error = result.error;
      if (!firstError) firstError = result.error;
      attempts.push(attempt);
      continue;
    }
    attempt.markdownLength = result.markdown.length;
    attempt.htmlLength = result.html.length;
    attempt.linksCount = result.links.length;
    attempt.matches = collectFromText(result.markdown, found);
    attempt.linkMatches = collectFromLinks(result.links, found);
    attempt.mailtoMatches = collectFromHrefs(result.html, found);
    attempt.ok = true;
    attempts.push(attempt);
  }

  return {
    emails: Array.from(found),
    map: {
      ok: !mapResult.error,
      totalLinks: allLinks.length,
      relevantLinks: relevantUrls.length,
      error: mapResult.error,
      urlsScraped: uniqueUrls,
    },
    attempts,
    error: found.size === 0 ? firstError : undefined,
  };
}
