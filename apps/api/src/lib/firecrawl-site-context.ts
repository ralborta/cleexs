/**
 * Extrae texto del sitio (Firecrawl) para anclar vertical/industria antes de competidores.
 * Varias páginas cortas suelen describir el negocio mejor que solo title/meta del fetch directo.
 */

import { firecrawlScrapePage } from './firecrawl-emails';

const EXTRA_PATHS = [
  '/nosotros',
  '/quienes-somos',
  '/servicios',
  '/soluciones',
  '/empresa',
  '/about',
  '/about-us',
  '/que-hacemos',
] as const;

const MAX_TOTAL_CHARS = 14_000;
const MIN_CHARS_BEFORE_EXTRA = 2_800;
const DEFAULT_MAX_PAGES = 3;

function originFromInput(trimmedUrl: string): string {
  const withProto = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
  return new URL(withProto).origin;
}

export interface FirecrawlSiteContextResult {
  /** Texto concatenado para prompts (truncado). */
  markdown: string;
  /** URLs de las que salió contenido (auditoría / logs). */
  sourceUrls: string[];
}

/**
 * Scrapea home + hasta (maxPages-1) rutas típicas hasta llenar presupuesto de caracteres.
 * Sin API key o sin URL http(s) válida → null.
 */
export async function fetchSiteContextForDiagnostics(
  trimmedUrl: string,
  apiKey: string | undefined,
  opts?: { maxPages?: number; timeoutMs?: number }
): Promise<FirecrawlSiteContextResult | null> {
  if (!apiKey?.trim() || !trimmedUrl?.trim()) return null;
  let origin: string;
  try {
    origin = originFromInput(trimmedUrl.trim());
  } catch {
    return null;
  }

  const maxPages = Math.min(5, Math.max(1, opts?.maxPages ?? DEFAULT_MAX_PAGES));
  const timeoutMs = opts?.timeoutMs ?? 22_000;
  const sourceUrls: string[] = [];
  const chunks: string[] = [];
  let total = 0;

  const tryScrape = async (pageUrl: string) => {
    if (total >= MAX_TOTAL_CHARS || sourceUrls.length >= maxPages) return;
    const r = await firecrawlScrapePage(pageUrl, apiKey, { timeoutMs, onlyMainContent: true });
    if (!r.ok || !r.markdown?.trim()) return;
    const header = `\n\n--- ${pageUrl} ---\n`;
    const piece = header + r.markdown.trim();
    sourceUrls.push(pageUrl);
    chunks.push(piece);
    total += piece.length;
  };

  await tryScrape(`${origin}/`);

  if (total < MIN_CHARS_BEFORE_EXTRA) {
    for (const p of EXTRA_PATHS) {
      if (sourceUrls.length >= maxPages || total >= MAX_TOTAL_CHARS) break;
      await tryScrape(`${origin}${p}`);
    }
  }

  if (chunks.length === 0) return null;

  let markdown = chunks.join('').trim();
  if (markdown.length > MAX_TOTAL_CHARS) {
    markdown = `${markdown.slice(0, MAX_TOTAL_CHARS)}\n\n[…truncado]`;
  }
  return { markdown, sourceUrls };
}
