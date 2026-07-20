/**
 * J101 — Motor de Auditoría Agéntica.
 *
 * Analiza qué tan "legible" es un sitio para agentes de IA (ChatGPT, Claude,
 * Gemini, Perplexity y los nuevos agentes que navegan en nombre del usuario).
 *
 * Autocontenido en Node (no depende del satélite Python en runtime).
 * Incluye lógica portada/adaptada desde cleexs-aeo-tools:
 *   - tool3_schema      → schema-checker.ts (JSON-LD, microdata, sugerencias)
 *   - tool1_crawlability → site-crawler.ts (crawl multi-página, issues)
 *   - generate_recommended_robots → robots-recommendation.ts
 * Más chequeos nativos: llms.txt, PageSpeed (a11y + CLS).
 * Pendiente Fase 2: tool4_axp (requiere LLM).
 */

import { checkSchema, type SchemaCheckResult } from './agentic-tools/schema-checker';
import { crawlSite, type SiteCrawlResult } from './agentic-tools/site-crawler';
import { generateRecommendedRobots } from './agentic-tools/robots-recommendation';
import { fetchPageContent } from './agentic-tools/page-fetch';
import { hasCloudflareManagedBlock, hasSitemapDirective, isBotBlocked, parseRobots } from './agentic-tools/robots-parse';

/**
 * Devuelve un "Agent-Readiness Score" (0-100) ponderado + checks individuales
 * + recomendaciones accionables priorizadas, listo para mostrar en el informe.
 */

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface AuditCheck {
  id: string;
  label: string;
  status: CheckStatus;
  /** 0-100, contribución de este check a su categoría. */
  score: number;
  summary: string;
  detail?: string;
}

export interface AuditCategory {
  id: string;
  label: string;
  /** Peso relativo dentro del score global (0-1). */
  weight: number;
  /** 0-100 */
  score: number;
  checks: AuditCheck[];
}

export interface AuditRecommendation {
  priority: 'alta' | 'media' | 'baja';
  category: string;
  title: string;
  detail: string;
}

export interface AgenticAuditResult {
  targetUrl: string;
  finalUrl?: string;
  fetchedAt: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  categories: AuditCategory[];
  recommendations: AuditRecommendation[];
  /** Datos profundos portados desde cleexs-aeo-tools (para el informe detallado). */
  deepTools?: {
    schema?: import('./agentic-tools/schema-checker').SchemaCheckResult;
    crawlability?: import('./agentic-tools/site-crawler').SiteCrawlResult;
    recommendedRobots?: string;
  };
  meta: {
    psiUsed: boolean;
    durationMs: number;
    warnings: string[];
    toolsSource: 'cleexs-aeo-tools-ported';
  };
}

const AI_BOTS = [
  { name: 'GPTBot', engine: 'ChatGPT / OpenAI', important: true },
  { name: 'ChatGPT-User', engine: 'ChatGPT (navegación)', important: true },
  { name: 'OAI-SearchBot', engine: 'ChatGPT Search', important: true },
  { name: 'ClaudeBot', engine: 'Claude / Anthropic', important: true },
  { name: 'Claude-Web', engine: 'Claude (web)', important: false },
  { name: 'anthropic-ai', engine: 'Anthropic', important: false },
  { name: 'Google-Extended', engine: 'Gemini / Google AI', important: true },
  { name: 'PerplexityBot', engine: 'Perplexity', important: true },
  { name: 'Perplexity-User', engine: 'Perplexity (navegación)', important: false },
  { name: 'Applebot-Extended', engine: 'Apple Intelligence', important: false },
  { name: 'CCBot', engine: 'Common Crawl', important: false },
  { name: 'Bytespider', engine: 'TikTok / ByteDance', important: false },
  { name: 'Amazonbot', engine: 'Amazon', important: false },
  { name: 'cohere-ai', engine: 'Cohere', important: false },
] as const;

const FETCH_TIMEOUT_MS = 12_000;

function normalizeUrl(raw: string): string {
  let u = (raw || '').trim();
  if (!u) throw new Error('URL vacía');
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  const parsed = new URL(u);
  return parsed.toString();
}

function originOf(url: string): string {
  return new URL(url).origin;
}

async function timedFetch(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string } | null> {
  const method = init?.method === 'HEAD' ? 'HEAD' : 'GET';
  const res = await fetchPageContent(url, { timeoutMs: FETCH_TIMEOUT_MS, method });
  if (!res) return null;
  return { ok: res.ok, status: res.status, text: res.text, finalUrl: res.finalUrl };
}

// ────────────────────────────────────────────────────────────────
// 1. robots.txt — acceso de bots de IA
// ────────────────────────────────────────────────────────────────

async function detectSitemap(origin: string): Promise<boolean> {
  const paths = ['/sitemap_index.xml', '/sitemap.xml', '/wp-sitemap.xml'];
  for (const path of paths) {
    const head = await timedFetch(`${origin}${path}`, { method: 'HEAD' });
    if (head && head.ok) return true;
    const get = await timedFetch(`${origin}${path}`);
    if (get && get.ok && !/<html/i.test(get.text.slice(0, 400))) return true;
  }
  const robots = await timedFetch(`${origin}/robots.txt`);
  if (robots?.ok && hasSitemapDirective(robots.text)) return true;
  return false;
}

function auditRobots(robotsTxt: string | null): AuditCategory {
  const checks: AuditCheck[] = [];

  if (robotsTxt === null) {
    checks.push({
      id: 'robots_exists',
      label: 'robots.txt accesible',
      status: 'warn',
      score: 60,
      summary: 'No se encontró robots.txt.',
      detail:
        'Sin robots.txt los bots usan reglas por defecto (suelen poder entrar), pero perdés control explícito sobre qué agentes de IA pueden indexar tu sitio.',
    });
    return { id: 'robots', label: 'Acceso de agentes (robots.txt)', weight: 0.3, score: 60, checks };
  }

  const groups = parseRobots(robotsTxt);
  const blocked: string[] = [];
  const blockedImportant: string[] = [];
  for (const bot of AI_BOTS) {
    if (isBotBlocked(groups, bot.name)) {
      blocked.push(`${bot.name} (${bot.engine})`);
      if (bot.important) blockedImportant.push(bot.name);
    }
  }

  checks.push({
    id: 'robots_exists',
    label: 'robots.txt accesible',
    status: 'pass',
    score: 100,
    summary: 'Se encontró y se pudo leer el robots.txt.',
  });

  if (blocked.length === 0) {
    checks.push({
      id: 'robots_ai_access',
      label: 'Bots de IA permitidos',
      status: 'pass',
      score: 100,
      summary: 'Ningún bot de IA relevante está bloqueado. Los agentes pueden leer tu sitio.',
    });
  } else {
    const status: CheckStatus = blockedImportant.length > 0 ? 'fail' : 'warn';
    checks.push({
      id: 'robots_ai_access',
      label: 'Bots de IA permitidos',
      status,
      score: blockedImportant.length > 0 ? 25 : 65,
      summary: `${blocked.length} bot(s) de IA bloqueados en robots.txt.`,
      detail: `Bloqueados: ${blocked.join(', ')}.${
        hasCloudflareManagedBlock(robotsTxt)
          ? ' Cloudflare inyecta bloqueos al inicio; WordPress ya tiene Allow al final — desactivar Managed robots.txt en CF.'
          : ''
      } ${
        blockedImportant.length > 0
          ? 'Incluye motores importantes — los agentes de esas plataformas no pueden leer tu sitio.'
          : 'Son motores secundarios, pero conviene revisarlo.'
      }`,
    });
  }

  const hasSitemapRef = hasSitemapDirective(robotsTxt);
  checks.push({
    id: 'robots_sitemap_ref',
    label: 'Referencia a sitemap',
    status: hasSitemapRef ? 'pass' : 'warn',
    score: hasSitemapRef ? 100 : 70,
    summary: hasSitemapRef
      ? 'El robots.txt declara la ubicación del sitemap.'
      : 'El robots.txt no referencia un sitemap.',
  });

  const score = Math.round(checks.reduce((a, c) => a + c.score, 0) / checks.length);
  return { id: 'robots', label: 'Acceso de agentes (robots.txt)', weight: 0.25, score, checks };
}

// ────────────────────────────────────────────────────────────────
// 2. llms.txt
// ────────────────────────────────────────────────────────────────

function auditLlmsTxt(llmsTxt: string | null): AuditCategory {
  const checks: AuditCheck[] = [];
  if (llmsTxt === null) {
    checks.push({
      id: 'llms_exists',
      label: 'llms.txt presente',
      status: 'warn',
      score: 40,
      summary: 'No se encontró llms.txt.',
      detail:
        'llms.txt es un estándar emergente para guiar a los agentes de IA sobre tu contenido más importante. Todavía no es obligatorio (Google no lo usa aún), pero sumarlo te adelanta a la curva y lo aprovechan varios agentes.',
    });
    return { id: 'llms', label: 'Guía para LLMs (llms.txt)', weight: 0.1, score: 40, checks };
  }

  const lines = llmsTxt.replace(/\\#/g, '#').split(/\r?\n/);
  const hasTitle = lines.some((l) => /^#\s+\S/.test(l.trim()));
  const linkCount = (llmsTxt.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  const hasSections = lines.some((l) => /^##\s+\S/.test(l.trim()));

  checks.push({
    id: 'llms_exists',
    label: 'llms.txt presente',
    status: 'pass',
    score: 100,
    summary: 'Se encontró un archivo llms.txt.',
  });
  checks.push({
    id: 'llms_structured',
    label: 'llms.txt bien formado',
    status: hasTitle && linkCount > 0 ? 'pass' : 'warn',
    score: hasTitle && linkCount > 0 ? 100 : 60,
    summary:
      hasTitle && linkCount > 0
        ? `Tiene título y ${linkCount} enlace(s) a recursos${hasSections ? ' y secciones' : ''}.`
        : 'Existe pero le falta estructura (título "# ", enlaces a recursos clave).',
  });

  const score = Math.round(checks.reduce((a, c) => a + c.score, 0) / checks.length);
  return { id: 'llms', label: 'Guía para LLMs (llms.txt)', weight: 0.1, score, checks };
}

// ────────────────────────────────────────────────────────────────
// 3. Schema (port de tool3_schema.py)
// ────────────────────────────────────────────────────────────────

function auditSchemaCategory(schema: SchemaCheckResult, sitemapFound: boolean): AuditCategory {
  const checks: AuditCheck[] = [];
  const types = [...new Set(schema.schemas_found.map((s) => s.schema_type))];

  checks.push({
    id: 'schema_present',
    label: 'Structured data (Schema.org)',
    status: schema.has_schema ? 'pass' : 'fail',
    score: schema.score,
    summary: schema.has_schema
      ? `${schema.total_schemas} schema(s): ${types.slice(0, 6).join(', ')}${types.length > 6 ? '…' : ''}.`
      : 'No se detectó structured data en la home.',
    detail: schema.has_schema
      ? undefined
      : 'Solo ~12% de los sitios tienen schema. Agregar JSON-LD mejora la visibilidad en IAs.',
  });

  if (schema.missing_types.length > 0) {
    checks.push({
      id: 'schema_types',
      label: 'Tipos recomendados',
      status: schema.missing_types.length >= 2 ? 'warn' : 'pass',
      score: Math.max(40, 100 - schema.missing_types.length * 20),
      summary: `Faltan: ${schema.missing_types.join(', ')}.`,
    });
  }

  if (schema.page_info.title) {
    checks.push({
      id: 'page_title',
      label: 'Título de página',
      status: 'pass',
      score: 100,
      summary: schema.page_info.title.slice(0, 80),
    });
  } else {
    checks.push({
      id: 'page_title',
      label: 'Título de página',
      status: 'warn',
      score: 40,
      summary: 'La home no tiene <title>.',
    });
  }

  checks.push({
    id: 'sitemap',
    label: 'sitemap.xml',
    status: sitemapFound ? 'pass' : 'warn',
    score: sitemapFound ? 100 : 55,
    summary: sitemapFound
      ? 'Se encontró un sitemap.xml accesible.'
      : 'No se encontró sitemap.xml en la ruta estándar.',
  });

  const score = Math.round(
    (schema.score * 0.7 + (sitemapFound ? 100 : 55) * 0.15 + (schema.page_info.has_h1 ? 100 : 50) * 0.15),
  );
  return {
    id: 'schema',
    label: 'Structured data (cleexs-tools)',
    weight: 0.2,
    score,
    checks,
  };
}

// ────────────────────────────────────────────────────────────────
// 4. Crawlability (port de tool1_crawlability.py)
// ────────────────────────────────────────────────────────────────

function auditCrawlCategory(crawl: SiteCrawlResult): AuditCategory {
  const checks: AuditCheck[] = [];
  const { summary } = crawl;

  checks.push({
    id: 'crawl_pages',
    label: 'Páginas rastreadas',
    status: crawl.pages_crawled >= 3 ? 'pass' : crawl.pages_crawled >= 1 ? 'warn' : 'fail',
    score: Math.min(100, crawl.pages_crawled * 25),
    summary: `${crawl.pages_crawled} página(s) analizadas en ${crawl.crawl_time}s.`,
  });

  checks.push({
    id: 'crawl_issues',
    label: 'Problemas de rastreo',
    status: summary.critical > 0 ? 'fail' : summary.warnings > 2 ? 'warn' : 'pass',
    score: Math.max(0, 100 - summary.critical * 20 - summary.warnings * 5),
    summary: `${summary.total_issues} issue(s): ${summary.critical} críticos, ${summary.warnings} advertencias.`,
    detail:
      crawl.issues.length > 0
        ? crawl.issues
            .slice(0, 4)
            .map((i) => `• ${i.message} (${i.url})`)
            .join('\n')
        : 'Sin problemas graves de rastreo detectados.',
  });

  if (summary.broken_links > 0) {
    checks.push({
      id: 'broken_links',
      label: 'Enlaces rotos',
      status: 'fail',
      score: 30,
      summary: `${summary.broken_links} enlace(s) con error HTTP.`,
    });
  }

  return {
    id: 'crawlability',
    label: 'Rastreo del sitio (cleexs-tools)',
    weight: 0.15,
    score: crawl.score,
    checks,
  };
}

// ────────────────────────────────────────────────────────────────
// 4. PageSpeed Insights (accesibilidad + CLS)
// ────────────────────────────────────────────────────────────────

interface PsiData {
  accessibilityScore: number | null;
  cls: number | null;
  lcp: number | null;
  performanceScore: number | null;
}

async function fetchPageSpeed(url: string, warnings: string[]): Promise<PsiData | null> {
  const key = process.env.PAGESPEED_API_KEY?.trim();
  const params = new URLSearchParams({ url, strategy: 'mobile' });
  params.append('category', 'PERFORMANCE');
  params.append('category', 'ACCESSIBILITY');
  if (key) params.append('key', key);
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(endpoint, { signal: controller.signal });
    if (!res.ok) {
      warnings.push(`PageSpeed Insights respondió ${res.status} (se omiten métricas de performance/accesibilidad).`);
      return null;
    }
    const json: any = await res.json();
    const lh = json?.lighthouseResult;
    const audits = lh?.audits || {};
    const a11y = lh?.categories?.accessibility?.score;
    const perf = lh?.categories?.performance?.score;
    return {
      accessibilityScore: typeof a11y === 'number' ? Math.round(a11y * 100) : null,
      performanceScore: typeof perf === 'number' ? Math.round(perf * 100) : null,
      cls:
        typeof audits['cumulative-layout-shift']?.numericValue === 'number'
          ? audits['cumulative-layout-shift'].numericValue
          : null,
      lcp:
        typeof audits['largest-contentful-paint']?.numericValue === 'number'
          ? audits['largest-contentful-paint'].numericValue
          : null,
    };
  } catch {
    warnings.push('No se pudo consultar PageSpeed Insights (timeout o red).');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function auditPsi(psi: PsiData | null): AuditCategory {
  const checks: AuditCheck[] = [];
  if (!psi) {
    checks.push({
      id: 'psi_unavailable',
      label: 'Accesibilidad y estabilidad',
      status: 'info',
      score: 60,
      summary: 'No se pudieron obtener métricas de PageSpeed Insights en esta corrida.',
      detail: 'Se puede reintentar la auditoría; estas métricas dependen de un servicio externo de Google.',
    });
    return { id: 'experience', label: 'Experiencia para agentes (a11y + CLS)', weight: 0.4, score: 60, checks };
  }

  // Accesibilidad (proxy de "agent-readiness": roles, labels, alt, contraste)
  if (psi.accessibilityScore != null) {
    const s = psi.accessibilityScore;
    checks.push({
      id: 'accessibility',
      label: 'Accesibilidad (ARIA, labels, alt)',
      status: s >= 90 ? 'pass' : s >= 70 ? 'warn' : 'fail',
      score: s,
      summary: `Score de accesibilidad: ${s}/100.`,
      detail:
        'La accesibilidad es el mejor proxy disponible de "agent-readiness": roles ARIA, labels de formularios y textos alternativos permiten que un agente interprete y opere la página.',
    });
  }

  // CLS
  if (psi.cls != null) {
    const cls = psi.cls;
    const status: CheckStatus = cls <= 0.1 ? 'pass' : cls <= 0.25 ? 'warn' : 'fail';
    const score = cls <= 0.1 ? 100 : cls <= 0.25 ? 65 : 30;
    checks.push({
      id: 'cls',
      label: 'Estabilidad de layout (CLS)',
      status,
      score,
      summary: `CLS: ${cls.toFixed(3)} (${status === 'pass' ? 'bueno' : status === 'warn' ? 'mejorable' : 'pobre'}).`,
      detail:
        'Un layout que salta confunde tanto a usuarios como a agentes que intentan interactuar con elementos en posiciones predecibles.',
    });
  }

  if (psi.lcp != null) {
    const lcpS = psi.lcp / 1000;
    const status: CheckStatus = lcpS <= 2.5 ? 'pass' : lcpS <= 4 ? 'warn' : 'fail';
    checks.push({
      id: 'lcp',
      label: 'Velocidad de carga (LCP)',
      status,
      score: lcpS <= 2.5 ? 100 : lcpS <= 4 ? 65 : 30,
      summary: `LCP: ${lcpS.toFixed(1)}s.`,
    });
  }

  if (checks.length === 0) {
    checks.push({
      id: 'psi_partial',
      label: 'Métricas parciales',
      status: 'info',
      score: 60,
      summary: 'PageSpeed respondió pero sin métricas utilizables.',
    });
  }

  const score = Math.round(checks.reduce((a, c) => a + c.score, 0) / checks.length);
  return { id: 'experience', label: 'Experiencia para agentes (a11y + CLS)', weight: 0.3, score, checks };
}

// ────────────────────────────────────────────────────────────────
// Recomendaciones + score global
// ────────────────────────────────────────────────────────────────

function buildRecommendations(
  categories: AuditCategory[],
  schema?: SchemaCheckResult,
  crawl?: SiteCrawlResult,
): AuditRecommendation[] {
  const recs: AuditRecommendation[] = [];
  const find = (catId: string, checkId: string) =>
    categories.find((c) => c.id === catId)?.checks.find((ch) => ch.id === checkId);

  if (schema) {
    for (const s of schema.suggestions.slice(0, 4)) {
      const priority =
        s.priority === 'critica' || s.priority === 'alta'
          ? 'alta'
          : s.priority === 'media'
            ? 'media'
            : 'baja';
      recs.push({
        priority,
        category: 'Structured data',
        title: s.message,
        detail: s.action || s.detail,
      });
    }
  }

  if (crawl) {
    for (const issue of crawl.issues.filter((i) => i.severity !== 'info').slice(0, 3)) {
      recs.push({
        priority: issue.severity === 'critical' ? 'alta' : 'media',
        category: 'Rastreo',
        title: issue.message,
        detail: issue.details || issue.url,
      });
    }
  }

  const robotsAi = find('robots', 'robots_ai_access');
  if (robotsAi && robotsAi.status !== 'pass') {
    recs.push({
      priority: robotsAi.status === 'fail' ? 'alta' : 'media',
      category: 'Acceso de agentes',
      title: 'Permitir el acceso de los bots de IA en robots.txt',
      detail:
        'WordPress ya declara Allow para GPTBot, ClaudeBot y otros, pero Cloudflare puede inyectar Disallow al inicio del archivo. Pedí acceso al panel Cloudflare para desactivar "Managed robots.txt" (ver docs/MENSAJE-CLIENTE-CLOUDFLARE-ROBOTS.txt).',
    });
  }

  const llms = find('llms', 'llms_exists');
  if (llms && llms.status !== 'pass') {
    recs.push({
      priority: 'baja',
      category: 'Guía para LLMs',
      title: 'Publicar un archivo llms.txt',
      detail:
        'Creá /llms.txt con un título "# Tu marca", una breve descripción y enlaces en formato markdown a tus páginas clave (productos, docs, contacto). Guía a los agentes hacia lo importante.',
    });
  }

  const schemaCheck = find('schema', 'schema_present');
  if (schemaCheck && schemaCheck.status === 'fail' && !schema?.suggestions.length) {
    recs.push({
      priority: 'alta',
      category: 'Structured data',
      title: 'Agregar structured data (JSON-LD)',
      detail:
        'Sumá Schema.org en JSON-LD (Organization, Product, FAQPage, BreadcrumbList según corresponda).',
    });
  }

  const a11y = find('experience', 'accessibility');
  if (a11y && a11y.status !== 'pass') {
    recs.push({
      priority: a11y.status === 'fail' ? 'alta' : 'media',
      category: 'Experiencia',
      title: 'Mejorar la accesibilidad (roles, labels, alt)',
      detail:
        'Agregá labels a los formularios, textos alternativos a las imágenes y roles ARIA donde haga falta. Mejora la experiencia de usuarios y es el principal indicador de que un agente puede operar tu sitio.',
    });
  }

  const cls = find('experience', 'cls');
  if (cls && cls.status !== 'pass') {
    recs.push({
      priority: 'media',
      category: 'Experiencia',
      title: 'Reducir el desplazamiento de layout (CLS)',
      detail:
        'Reservá espacio para imágenes y anuncios (width/height), evitá insertar contenido por encima del existente y precargá fuentes. Un layout estable es más predecible para los agentes.',
    });
  }

  const order = { alta: 0, media: 1, baja: 2 };
  const seen = new Set<string>();
  return recs
    .filter((r) => {
      const k = r.title;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => order[a.priority] - order[b.priority])
    .slice(0, 8);
}

function gradeFor(score: number): AgenticAuditResult['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * Corre la auditoría agéntica completa sobre una URL.
 * Nunca lanza por fallos de red de un sitio externo: los reporta como checks.
 */
export async function runAgenticAudit(rawUrl: string): Promise<AgenticAuditResult> {
  const started = Date.now();
  const warnings: string[] = [];
  const target = normalizeUrl(rawUrl);
  const origin = originOf(target);

  const [robotsRes, llmsRes, sitemapFound, psi, schemaResult, crawlResult] = await Promise.all([
    timedFetch(`${origin}/robots.txt`),
    timedFetch(`${origin}/llms.txt`),
    detectSitemap(origin),
    fetchPageSpeed(target, warnings),
    checkSchema(target),
    crawlSite(target, { maxPages: 8, maxDepth: 2 }),
  ]);

  const robotsTxt = robotsRes && robotsRes.ok ? robotsRes.text : null;
  const llmsTxt =
    llmsRes && llmsRes.ok && /[#\[\w]/.test(llmsRes.text) && !/<html/i.test(llmsRes.text)
      ? llmsRes.text
      : null;

  const robotsCategory = auditRobots(robotsTxt);
  const needsRobotsFix = robotsCategory.checks.some(
    (c) => c.id === 'robots_ai_access' && c.status !== 'pass',
  );

  const categories: AuditCategory[] = [
    robotsCategory,
    auditLlmsTxt(llmsTxt),
    auditSchemaCategory(schemaResult, sitemapFound),
    auditCrawlCategory(crawlResult),
    auditPsi(psi),
  ];

  const totalWeight = categories.reduce((a, c) => a + c.weight, 0) || 1;
  const overallScore = Math.round(
    categories.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight,
  );

  return {
    targetUrl: target,
    finalUrl: schemaResult.url,
    fetchedAt: new Date().toISOString(),
    overallScore,
    grade: gradeFor(overallScore),
    categories,
    recommendations: buildRecommendations(categories, schemaResult, crawlResult),
    deepTools: {
      schema: schemaResult,
      crawlability: crawlResult,
      ...(needsRobotsFix ? { recommendedRobots: generateRecommendedRobots(origin, true) } : {}),
    },
    meta: {
      psiUsed: Boolean(psi),
      durationMs: Date.now() - started,
      warnings,
      toolsSource: 'cleexs-aeo-tools-ported',
    },
  };
}
