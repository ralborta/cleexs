/**
 * Helper compartido para extraer emails de un dominio via Firecrawl.
 * Usa /v2/scrape (sincronico) que devuelve markdown/html/links en la misma llamada.
 *
 * IMPORTANTE: No uses /v2/extract para esto: es async y requiere polling del
 * jobId. Si llamas POST y lees la respuesta directo, recibis el jobId pero
 * Firecrawl igual cobra creditos por el trabajo que dispara en background.
 */

// Rutas candidatas para buscar contactos. Ordenadas por probabilidad de tener emails.
const CANDIDATE_PATHS = [
  '',
  '/contact',
  '/contacto',
  '/contactos',
  '/contact-us',
  '/contactanos',
  '/about',
  '/about-us',
  '/nosotros',
  '/soporte',
  '/support',
  '/ayuda',
  '/help',
  '/prensa',
  '/press',
  '/media',
  '/inversores',
  '/investors',
  '/ir',
  '/legal',
  '/privacy',
  '/privacidad',
] as const;

// Regex robusto para emails. Case-insensitive.
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// Regex para extraer emails de href="mailto:..." en el HTML crudo.
// Captura incluso emails ofuscados con entidades HTML (&#x40; etc) si Firecrawl los normaliza.
const MAILTO_HREF_REGEX = /href\s*=\s*["']?mailto:([^"'?\s>]+)/gi;

// Regex para detectar emails "ofuscados" con (at)/(dot) comunes en sitios anti-spam.
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

export interface FirecrawlEmailsResult {
  emails: string[];
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
  if (ASSET_SUFFIXES.some((suffix) => email.endsWith(suffix))) return false;
  // Descartamos emails con caracteres que suelen ser basura de parseo.
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) return false;
  return true;
}

function collectFromText(text: string, target: Set<string>): number {
  let matchCount = 0;
  const matches = text.match(EMAIL_REGEX) || [];
  for (const raw of matches) {
    const email = raw.toLowerCase().trim();
    if (!isValidEmail(email)) continue;
    target.add(email);
    matchCount += 1;
  }
  // Emails ofuscados con (at)/(dot).
  let m: RegExpExecArray | null;
  OBFUSCATED_REGEX.lastIndex = 0;
  while ((m = OBFUSCATED_REGEX.exec(text)) !== null) {
    const email = `${m[1]}@${m[2]}.${m[3]}`.toLowerCase();
    if (isValidEmail(email)) {
      target.add(email);
      matchCount += 1;
    }
  }
  return matchCount;
}

function collectFromHrefs(html: string, target: Set<string>): number {
  let matchCount = 0;
  let m: RegExpExecArray | null;
  MAILTO_HREF_REGEX.lastIndex = 0;
  while ((m = MAILTO_HREF_REGEX.exec(html)) !== null) {
    const email = decodeURIComponent(m[1] || '').toLowerCase().trim();
    if (isValidEmail(email)) {
      target.add(email);
      matchCount += 1;
    }
  }
  return matchCount;
}

function collectFromLinks(links: string[], target: Set<string>): number {
  let matchCount = 0;
  for (const link of links) {
    if (!link) continue;
    const lower = link.toLowerCase();
    if (!lower.startsWith('mailto:')) continue;
    const raw = lower.replace(/^mailto:/, '').split('?')[0].trim();
    if (isValidEmail(raw)) {
      target.add(raw);
      matchCount += 1;
    }
  }
  return matchCount;
}

/**
 * Recorre varias rutas del dominio y junta todos los emails visibles.
 * Busca en: markdown plano, href="mailto:..." del HTML, array de links
 * devuelto por Firecrawl, y patrones ofuscados (at)/(dot).
 */
export async function scrapeEmailsForDomain(
  domain: string,
  apiKey: string,
  opts: { timeoutMs?: number } = {}
): Promise<FirecrawlEmailsResult> {
  const timeout = opts.timeoutMs ?? 20_000;
  const found = new Set<string>();
  const attempts: FirecrawlEmailsResult['attempts'] = [];
  let firstError: string | undefined;

  for (const path of CANDIDATE_PATHS) {
    const url = `https://${domain}${path}`;
    const attempt: FirecrawlEmailsResult['attempts'][number] = { url, ok: false };
    try {
      const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url,
          // Pedimos markdown + html + links. Los mailto suelen venir en <a href="mailto:...">
          // y en el array de links, que el markdown no preserva.
          formats: ['markdown', 'html', 'links'],
          onlyMainContent: false,
          timeout,
        }),
      });
      attempt.status = response.status;
      if (!response.ok) {
        attempt.error = `HTTP ${response.status}`;
        if (!firstError) firstError = attempt.error;
        attempts.push(attempt);
        continue;
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
      const markdown = payload?.data?.markdown || '';
      const html = payload?.data?.html || payload?.data?.rawHtml || '';
      const links = payload?.data?.links || [];
      attempt.markdownLength = markdown.length;
      attempt.htmlLength = html.length;
      attempt.linksCount = links.length;

      const textMatches = collectFromText(markdown, found);
      const linkMatches = collectFromLinks(links, found);
      const mailtoMatches = collectFromHrefs(html, found);
      attempt.matches = textMatches;
      attempt.linkMatches = linkMatches;
      attempt.mailtoMatches = mailtoMatches;
      attempt.ok = true;
    } catch (err) {
      attempt.error = err instanceof Error ? err.message : String(err);
      if (!firstError) firstError = attempt.error;
    }
    attempts.push(attempt);
  }

  return {
    emails: Array.from(found),
    attempts,
    error: found.size === 0 ? firstError : undefined,
  };
}
