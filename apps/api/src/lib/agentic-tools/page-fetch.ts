/**
 * Fetch de páginas para auditoría agéntica.
 * SiteGround / WAF suelen devolver 403 a fetch de Node; Firecrawl actúa como fallback.
 */

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const AGENTIC_FETCH_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
};

export type PageFetchResult = {
  ok: boolean;
  status: number;
  text: string;
  finalUrl: string;
  source: 'direct' | 'firecrawl';
};

/** HTML de challenge / WAF (SiteGround, Cloudflare, etc.). */
export function isBlockedResponse(text: string, contentType?: string): boolean {
  if (!text) return true;
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('text/html') && /<html[\s>]/i.test(text)) {
    if (text.length > 5000 && !/<title[^>]*>[\s\S]*Cleexs/i.test(text)) {
      if (/cache-control|challenge|security|blocked|forbidden|access denied/i.test(text.slice(0, 2000))) {
        return true;
      }
    }
    if (/SiteGround|sgcaptcha|cf-browser-verification|Just a moment/i.test(text)) return true;
  }
  return false;
}

async function firecrawlScrape(
  url: string,
  apiKey: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; html: string; markdown: string; error?: string }> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html', 'rawHtml'],
        onlyMainContent: false,
        timeout: timeoutMs,
      }),
    });
    const status = response.status;
    if (!response.ok) {
      return { ok: false, status, html: '', markdown: '', error: `Firecrawl HTTP ${status}` };
    }
    const payload = (await response.json()) as {
      success?: boolean;
      data?: { markdown?: string; html?: string; rawHtml?: string };
    };
    const rawHtml = payload?.data?.rawHtml || '';
    const html = rawHtml || payload?.data?.html || '';
    const markdown = payload?.data?.markdown || '';
    return { ok: Boolean(html.trim() || markdown.trim()), status: 200, html, markdown };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      html: '',
      markdown: '',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * GET con headers de browser; si 403/WAF y hay FIRECRAWL_API_KEY, reintenta vía Firecrawl.
 */
export async function fetchPageContent(
  url: string,
  opts: { timeoutMs?: number; method?: 'GET' | 'HEAD' } = {},
): Promise<PageFetchResult | null> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const method = opts.method ?? 'GET';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: AGENTIC_FETCH_HEADERS,
    });
    if (method === 'HEAD') {
      return {
        ok: res.ok,
        status: res.status,
        text: '',
        finalUrl: res.url || url,
        source: 'direct',
      };
    }
    const text = await res.text();
    const ct = res.headers.get('content-type') || '';
    const blocked = res.status === 403 || isBlockedResponse(text, ct);
    if (res.ok && !blocked) {
      return { ok: true, status: res.status, text, finalUrl: res.url || url, source: 'direct' };
    }

    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
    if (!apiKey) {
      return {
        ok: res.ok,
        status: res.status,
        text,
        finalUrl: res.url || url,
        source: 'direct',
      };
    }

    const fc = await firecrawlScrape(url, apiKey, Math.min(timeoutMs, 25_000));
    if (!fc.ok) {
      return {
        ok: res.ok,
        status: res.status,
        text,
        finalUrl: res.url || url,
        source: 'direct',
      };
    }

    const isPlain =
      url.endsWith('.txt') || url.endsWith('.xml') || ct.includes('text/plain');
    // robots.txt / llms.txt: usar HTML/raw (Firecrawl markdown escapa * y #)
    const body = isPlain
      ? fc.html || fc.markdown
      : fc.html || fc.markdown;
    return {
      ok: Boolean(body.trim()),
      status: fc.ok ? 200 : res.status,
      text: body,
      finalUrl: url,
      source: 'firecrawl',
    };
  } catch {
    const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
    if (apiKey && method === 'GET') {
      const fc = await firecrawlScrape(url, apiKey, Math.min(timeoutMs, 25_000));
      if (fc.ok) {
        const isPlain = url.endsWith('.txt') || url.endsWith('.xml');
        const body = isPlain ? fc.html || fc.markdown : fc.html || fc.markdown;
        return { ok: Boolean(body.trim()), status: 200, text: body, finalUrl: url, source: 'firecrawl' };
      }
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
