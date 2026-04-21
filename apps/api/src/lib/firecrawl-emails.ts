/**
 * Helper compartido para extraer emails de un dominio via Firecrawl.
 * Usa /v2/scrape (sincronico) que devuelve markdown en la misma llamada.
 *
 * IMPORTANTE: No uses /v2/extract para esto: es async y requiere polling del
 * jobId. Si llamas POST y lees la respuesta directo, recibis el jobId pero
 * Firecrawl igual cobra creditos por el trabajo que dispara en background.
 */

const CANDIDATE_PATHS = ['', '/contact', '/contacto', '/about', '/about-us', '/nosotros'] as const;

// Regex robusto para emails. Usa lookbehind / flags para case-insensitive.
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

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
]);

const ASSET_SUFFIXES = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico'];

export interface FirecrawlEmailsResult {
  emails: string[];
  /** Rutas probadas y su resultado (para debug / logs). */
  attempts: Array<{
    url: string;
    ok: boolean;
    status?: number;
    error?: string;
    markdownLength?: number;
    matches?: number;
  }>;
  /** Primer error que bloqueo una ruta (si hubo alguno). */
  error?: string;
}

/**
 * Recorre /, /contact, /contacto, /about, /about-us, /nosotros y junta todos
 * los emails visibles en el markdown. Filtra locales genericos y falsos
 * positivos (imagenes con extension tipo `@2x.png`).
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
          formats: ['markdown'],
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
        data?: { markdown?: string; html?: string };
      };
      const markdown = payload?.data?.markdown || payload?.data?.html || '';
      attempt.markdownLength = markdown.length;
      if (!markdown) {
        attempts.push(attempt);
        continue;
      }
      const matches = markdown.match(EMAIL_REGEX) || [];
      attempt.matches = matches.length;
      for (const raw of matches) {
        const email = raw.toLowerCase().trim();
        const [local] = email.split('@');
        if (!local) continue;
        if (GENERIC_LOCALS.has(local)) continue;
        if (ASSET_SUFFIXES.some((suffix) => email.endsWith(suffix))) continue;
        found.add(email);
      }
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
