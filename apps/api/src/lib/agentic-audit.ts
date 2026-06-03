/**
 * J101 — Motor de Auditoría Agéntica.
 *
 * Analiza qué tan "legible" es un sitio para agentes de IA (ChatGPT, Claude,
 * Gemini, Perplexity y los nuevos agentes que navegan en nombre del usuario).
 *
 * Es autocontenido (corre en Node, sin depender del satélite Python ni de
 * Chrome/Lighthouse experimental). Reproduce los chequeos que importan hoy:
 *   1. robots.txt  → ¿deja entrar a los bots de IA?
 *   2. llms.txt    → ¿existe y está bien formado?
 *   3. HTML/Schema → structured data, metadatos, semántica, sitemap
 *   4. PageSpeed   → accesibilidad + CLS/estabilidad (Google PSI API, gratis)
 *
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
  meta: {
    psiUsed: boolean;
    durationMs: number;
    warnings: string[];
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
const USER_AGENT =
  'Mozilla/5.0 (compatible; CleexsAgenticAudit/1.0; +https://cleexs.net)';

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, ...(init?.headers || {}) },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ────────────────────────────────────────────────────────────────
// 1. robots.txt — acceso de bots de IA
// ────────────────────────────────────────────────────────────────

type RobotsGroup = { agents: string[]; disallows: string[]; allows: string[] };

function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], disallows: [], allows: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (current && field === 'disallow') {
      current.disallows.push(value);
      lastWasAgent = false;
    } else if (current && field === 'allow') {
      current.allows.push(value);
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

/** ¿El bot `agent` está bloqueado de la raíz del sitio? */
function isBotBlocked(groups: RobotsGroup[], agent: string): boolean {
  const a = agent.toLowerCase();
  const matching = groups.filter((g) => g.agents.includes(a));
  const wildcard = groups.filter((g) => g.agents.includes('*'));
  const relevant = matching.length > 0 ? matching : wildcard;
  if (relevant.length === 0) return false;
  // Bloqueado si hay un Disallow: / sin un Allow más específico.
  for (const g of relevant) {
    const blocksRoot = g.disallows.some((d) => d === '/' || d === '/*');
    if (blocksRoot) {
      const allowsRoot = g.allows.some((al) => al === '/' || al === '');
      if (!allowsRoot) return true;
    }
  }
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
      detail: `Bloqueados: ${blocked.join(', ')}. ${
        blockedImportant.length > 0
          ? 'Incluye motores importantes — los agentes de esas plataformas no pueden leer tu sitio.'
          : 'Son motores secundarios, pero conviene revisarlo.'
      }`,
    });
  }

  const hasSitemapRef = /^\s*sitemap\s*:/im.test(robotsTxt);
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
  return { id: 'robots', label: 'Acceso de agentes (robots.txt)', weight: 0.3, score, checks };
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

  const lines = llmsTxt.split(/\r?\n/);
  const hasTitle = lines.some((l) => /^#\s+/.test(l.trim()));
  const linkCount = (llmsTxt.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  const hasSections = lines.some((l) => /^##\s+/.test(l.trim()));

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
// 3. HTML / Schema / semántica
// ────────────────────────────────────────────────────────────────

function auditHtml(html: string | null, sitemapFound: boolean): AuditCategory {
  const checks: AuditCheck[] = [];

  if (!html) {
    checks.push({
      id: 'html_fetch',
      label: 'Home accesible',
      status: 'fail',
      score: 0,
      summary: 'No se pudo descargar el HTML de la home.',
      detail: 'Si un crawler no puede traer el HTML, ningún agente puede leer el sitio.',
    });
    return { id: 'content', label: 'Contenido legible para IA', weight: 0.2, score: 0, checks };
  }

  // JSON-LD structured data
  const jsonLdBlocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const schemaTypes: string[] = [];
  if (jsonLdBlocks) {
    for (const block of jsonLdBlocks) {
      const inner = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      const m = inner.match(/"@type"\s*:\s*"([^"]+)"/g);
      if (m) for (const t of m) schemaTypes.push(t.replace(/"@type"\s*:\s*"/, '').replace(/"$/, ''));
    }
  }
  checks.push({
    id: 'schema_jsonld',
    label: 'Structured data (Schema.org)',
    status: schemaTypes.length > 0 ? 'pass' : 'warn',
    score: schemaTypes.length > 0 ? 100 : 45,
    summary:
      schemaTypes.length > 0
        ? `Detectados ${schemaTypes.length} bloque(s) JSON-LD (${[...new Set(schemaTypes)]
            .slice(0, 5)
            .join(', ')}).`
        : 'No se detectó JSON-LD. El structured data ayuda a los agentes a entender entidades y acciones.',
  });

  // <title> y meta description
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const hasMetaDesc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+["']/i.test(html);
  checks.push({
    id: 'meta_basics',
    label: 'Título y meta description',
    status: title && hasMetaDesc ? 'pass' : 'warn',
    score: title && hasMetaDesc ? 100 : title || hasMetaDesc ? 65 : 30,
    summary:
      title && hasMetaDesc
        ? 'La home tiene title y meta description.'
        : `Falta ${!title ? 'el <title>' : ''}${!title && !hasMetaDesc ? ' y ' : ''}${
            !hasMetaDesc ? 'la meta description' : ''
          }.`,
  });

  // H1 / semántica
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const hasMain = /<main[\s>]/i.test(html);
  const hasArticle = /<article[\s>]/i.test(html);
  const semanticScore = (h1Count === 1 ? 60 : h1Count > 1 ? 40 : 20) + (hasMain ? 25 : 0) + (hasArticle ? 15 : 0);
  checks.push({
    id: 'semantic_html',
    label: 'HTML semántico',
    status: semanticScore >= 80 ? 'pass' : semanticScore >= 50 ? 'warn' : 'fail',
    score: Math.min(100, semanticScore),
    summary: `H1: ${h1Count}${hasMain ? ', <main>' : ''}${hasArticle ? ', <article>' : ''}. ${
      h1Count === 1 ? 'Buena jerarquía.' : h1Count === 0 ? 'Falta un H1 claro.' : 'Hay múltiples H1.'
    }`,
  });

  // Sitemap
  checks.push({
    id: 'sitemap',
    label: 'sitemap.xml',
    status: sitemapFound ? 'pass' : 'warn',
    score: sitemapFound ? 100 : 55,
    summary: sitemapFound
      ? 'Se encontró un sitemap.xml accesible.'
      : 'No se encontró sitemap.xml en la ruta estándar.',
  });

  const score = Math.round(checks.reduce((a, c) => a + c.score, 0) / checks.length);
  return { id: 'content', label: 'Contenido legible para IA', weight: 0.2, score, checks };
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
  return { id: 'experience', label: 'Experiencia para agentes (a11y + CLS)', weight: 0.4, score, checks };
}

// ────────────────────────────────────────────────────────────────
// Recomendaciones + score global
// ────────────────────────────────────────────────────────────────

function buildRecommendations(categories: AuditCategory[]): AuditRecommendation[] {
  const recs: AuditRecommendation[] = [];
  const find = (catId: string, checkId: string) =>
    categories.find((c) => c.id === catId)?.checks.find((ch) => ch.id === checkId);

  const robotsAi = find('robots', 'robots_ai_access');
  if (robotsAi && robotsAi.status !== 'pass') {
    recs.push({
      priority: robotsAi.status === 'fail' ? 'alta' : 'media',
      category: 'Acceso de agentes',
      title: 'Permitir el acceso de los bots de IA en robots.txt',
      detail:
        'Quitá las reglas Disallow para GPTBot, ClaudeBot, Google-Extended y PerplexityBot (o agregá Allow explícitos). Si no, esos agentes no pueden leer tu sitio.',
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

  const schema = find('content', 'schema_jsonld');
  if (schema && schema.status !== 'pass') {
    recs.push({
      priority: 'media',
      category: 'Contenido',
      title: 'Agregar structured data (JSON-LD)',
      detail:
        'Sumá Schema.org en JSON-LD (Organization, Product, FAQPage, BreadcrumbList según corresponda). Es lo que más ayuda a los agentes a entender qué hacés y qué acciones ofrecés.',
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

  const semantic = find('content', 'semantic_html');
  if (semantic && semantic.status === 'fail') {
    recs.push({
      priority: 'baja',
      category: 'Contenido',
      title: 'Usar HTML semántico',
      detail:
        'Asegurá un único <h1> por página y usá <main>, <article>, <nav> y <section>. Da estructura clara para que un agente sepa dónde está el contenido principal.',
    });
  }

  const order = { alta: 0, media: 1, baja: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
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

  const [homeRes, robotsRes, llmsRes, sitemapRes, psi] = await Promise.all([
    timedFetch(target),
    timedFetch(`${origin}/robots.txt`),
    timedFetch(`${origin}/llms.txt`),
    timedFetch(`${origin}/sitemap.xml`, { method: 'HEAD' }),
    fetchPageSpeed(target, warnings),
  ]);

  const robotsTxt = robotsRes && robotsRes.ok ? robotsRes.text : null;
  const llmsTxt =
    llmsRes && llmsRes.ok && /[#\[\w]/.test(llmsRes.text) && !/<html/i.test(llmsRes.text)
      ? llmsRes.text
      : null;
  const html = homeRes && homeRes.ok ? homeRes.text : null;
  const sitemapFound = Boolean(sitemapRes && sitemapRes.ok);

  if (!html) warnings.push('No se pudo descargar la home del sitio.');

  const categories: AuditCategory[] = [
    auditRobots(robotsTxt),
    auditLlmsTxt(llmsTxt),
    auditHtml(html, sitemapFound),
    auditPsi(psi),
  ];

  const totalWeight = categories.reduce((a, c) => a + c.weight, 0) || 1;
  const overallScore = Math.round(
    categories.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight,
  );

  return {
    targetUrl: target,
    finalUrl: homeRes?.finalUrl,
    fetchedAt: new Date().toISOString(),
    overallScore,
    grade: gradeFor(overallScore),
    categories,
    recommendations: buildRecommendations(categories),
    meta: {
      psiUsed: Boolean(psi),
      durationMs: Date.now() - started,
      warnings,
    },
  };
}
