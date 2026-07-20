/**
 * Port simplificado de cleexs-aeo-tools/tool1_crawlability.py → TypeScript nativo.
 * Crawl BFS de hasta N páginas del mismo dominio para detectar problemas de
 * rastreo que afectan a agentes de IA.
 */

import { fetchPageContent } from './page-fetch';
import { isBotBlocked, isWildcardFullyBlocked, parseRobots } from './robots-parse';

export type CrawlIssue = {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  url: string;
  message: string;
  details?: string;
};

export type CrawlSummary = {
  total_issues: number;
  critical: number;
  warnings: number;
  info: number;
  broken_links: number;
  slow_pages: number;
  pages_with_title: number;
  pages_with_h1: number;
};

export type SiteCrawlResult = {
  target_url: string;
  pages_crawled: number;
  total_links_found: number;
  score: number;
  issues: CrawlIssue[];
  summary: CrawlSummary;
  crawl_time: number;
};

const PAGE_TIMEOUT_MS = 10_000;

async function fetchPage(url: string): Promise<{
  ok: boolean;
  status: number;
  html: string;
  responseTime: number;
  finalUrl: string;
} | null> {
  const t0 = Date.now();
  const res = await fetchPageContent(url, { timeoutMs: PAGE_TIMEOUT_MS });
  if (!res) return null;
  const responseTime = (Date.now() - t0) / 1000;
  return {
    ok: res.ok,
    status: res.status,
    html: res.text,
    responseTime,
    finalUrl: res.finalUrl,
  };
}

function normalizeUrl(url: string): string {
  try {
    const p = new URL(url);
    const path = p.pathname.replace(/\/$/, '') || '/';
    return `${p.protocol}//${p.host}${path}`;
  } catch {
    return url;
  }
}

function extractLinks(html: string, baseUrl: string, baseHost: string): string[] {
  const links: string[] = [];
  const re = /<a[^>]+href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const full = new URL(m[1], baseUrl).href;
      const p = new URL(full);
      if (!['http:', 'https:'].includes(p.protocol)) continue;
      if (p.host === baseHost) {
        const norm = normalizeUrl(full);
        if (!links.includes(norm)) links.push(norm);
      }
    } catch {
      /* skip */
    }
  }
  return links.sort();
}

function analyzePageMeta(html: string) {
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : null;
  const metaDescM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const metaDesc = metaDescM?.[1] || null;
  const metaRobotsM = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i);
  const metaRobots = metaRobotsM?.[1] || null;
  const has_h1 = /<h1[\s>]/i.test(html);
  const imgTags = html.match(/<img[\s>]/gi) || [];
  const imgNoAlt = (html.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
  return { title, metaDesc, metaRobots, has_h1, totalImages: imgTags.length, imagesWithoutAlt: imgNoAlt };
}

export async function crawlSite(
  rawUrl: string,
  opts: { maxPages?: number; maxDepth?: number } = {},
): Promise<SiteCrawlResult> {
  const maxPages = opts.maxPages ?? 8;
  const maxDepth = opts.maxDepth ?? 2;
  const start = Date.now();
  let target = rawUrl.trim();
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;

  const parsed = new URL(target);
  const baseHost = parsed.host;
  const baseUrl = `${parsed.protocol}//${parsed.host}`;

  const visited = new Set<string>();
  const issues: CrawlIssue[] = [];
  let pagesWithTitle = 0;
  let pagesWithH1 = 0;
  let brokenLinks = 0;
  let slowPages = 0;

  // robots.txt quick check
  const robotsRes = await fetchPage(`${baseUrl}/robots.txt`);
  if (robotsRes && robotsRes.ok && robotsRes.html) {
    const txt = robotsRes.html;
    const groups = parseRobots(txt);
    if (isWildcardFullyBlocked(groups)) {
      issues.push({
        severity: 'critical',
        category: 'robots_txt',
        url: `${baseUrl}/robots.txt`,
        message: "robots.txt bloquea todo el sitio con 'Disallow: /' para User-agent: *",
        details: 'Los motores de búsqueda e IAs no pueden acceder a ninguna página.',
      });
    }
    for (const bot of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'PerplexityBot']) {
      if (isBotBlocked(groups, bot)) {
        issues.push({
          severity: 'warning',
          category: 'ai_bots',
          url: `${baseUrl}/robots.txt`,
          message: `El bot de IA '${bot}' está bloqueado en robots.txt`,
          details: `${bot} no puede rastrear tu sitio.`,
        });
      }
    }
  }

  const queue: Array<[string, number]> = [[normalizeUrl(target), 0]];

  while (queue.length > 0 && visited.size < maxPages) {
    const [currentUrl, depth] = queue.shift()!;
    if (visited.has(currentUrl) || depth > maxDepth) continue;
    const p = new URL(currentUrl);
    if (p.host !== baseHost) continue;
    visited.add(currentUrl);

    const page = await fetchPage(currentUrl);
    if (!page) {
      issues.push({
        severity: 'warning',
        category: 'connectivity',
        url: currentUrl,
        message: 'Error al acceder a la página',
        details: 'Timeout o error de red.',
      });
      continue;
    }

    if (page.status >= 400) {
      brokenLinks++;
      issues.push({
        severity: page.status === 404 ? 'critical' : 'warning',
        category: 'broken_links',
        url: currentUrl,
        message: `Enlace roto: HTTP ${page.status}`,
        details: `Esta página devuelve error ${page.status}.`,
      });
      continue;
    }

    if (page.responseTime > 3) {
      slowPages++;
      issues.push({
        severity: 'warning',
        category: 'performance',
        url: currentUrl,
        message: `Página lenta: ${page.responseTime.toFixed(1)}s`,
        details: 'Tiempo de respuesta superior a 3 segundos afecta el rastreo.',
      });
    }

    if (!page.html) continue;

    const meta = analyzePageMeta(page.html);
    if (meta.title) pagesWithTitle++;
    if (meta.has_h1) pagesWithH1++;

    if (meta.metaRobots?.toLowerCase().includes('noindex')) {
      issues.push({
        severity: 'warning',
        category: 'indexability',
        url: currentUrl,
        message: "Meta tag 'noindex' detectado",
        details: 'Esta página no será indexada.',
      });
    }
    if (!meta.title) {
      issues.push({
        severity: 'warning',
        category: 'seo',
        url: currentUrl,
        message: 'Falta el título de la página',
        details: 'Sin título, las IAs no pueden entender el contenido.',
      });
    }
    if (!meta.has_h1) {
      issues.push({
        severity: 'warning',
        category: 'seo',
        url: currentUrl,
        message: 'No se encontró etiqueta H1',
        details: 'Cada página debería tener un H1 claro.',
      });
    }
    if (meta.imagesWithoutAlt > 0) {
      issues.push({
        severity: 'info',
        category: 'accessibility',
        url: currentUrl,
        message: `${meta.imagesWithoutAlt} imagen(es) sin atributo alt`,
        details: 'Las imágenes sin alt son invisibles para rastreadores de IA.',
      });
    }

    const links = extractLinks(page.html, currentUrl, baseHost);
    for (const link of links.slice(0, 15)) {
      if (!visited.has(link) && depth < maxDepth) queue.push([link, depth + 1]);
    }
  }

  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 15;
    else if (issue.severity === 'warning') score -= 5;
    else score -= 1;
  }
  score = Math.max(0, Math.min(100, score));

  const critical = issues.filter((i) => i.severity === 'critical').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const info = issues.filter((i) => i.severity === 'info').length;

  return {
    target_url: target,
    pages_crawled: visited.size,
    total_links_found: visited.size,
    score,
    issues: issues.slice(0, 25),
    summary: {
      total_issues: issues.length,
      critical,
      warnings,
      info,
      broken_links: brokenLinks,
      slow_pages: slowPages,
      pages_with_title: pagesWithTitle,
      pages_with_h1: pagesWithH1,
    },
    crawl_time: Math.round((Date.now() - start) / 100) / 10,
  };
}
