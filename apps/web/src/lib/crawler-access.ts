import type { PublicDiagnosticSatelliteModule } from '@/lib/api';

export type CrawlerBotStatus = {
  name: string;
  engine: string;
  allowed: boolean;
  details?: string;
};

export type CrawlerAccessReport = {
  robotsFound: boolean;
  robotsUrl: string | null;
  bots: CrawlerBotStatus[];
  teaserBots: CrawlerBotStatus[];
  blockedCount: number;
  recommendedRobots: string | null;
  verificationChecklist: string[];
};

const FREE_TEASER_BOT_NAMES = ['GPTBot', 'OAI-SearchBot', 'PerplexityBot'] as const;

const AI_BOTS_FOR_ROBOTS_TXT = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'Google-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot-Extended',
  'CCBot',
  'Bytespider',
  'Amazonbot',
  'cohere-ai',
];

const VERIFICATION_CHECKLIST = [
  'Screaming Frog (modo lista): verificá que OAI-SearchBot y GPTBot puedan acceder a tus URLs clave.',
  'Probador de robots.txt (Google Search Console o herramienta online): validá reglas User-agent sin bloqueos accidentales.',
  'Logs del servidor: buscá visitas de OAI-SearchBot, GPTBot y PerplexityBot en los últimos 30 días.',
  'Si usás CDN o WAF, confirmá que no bloqueen user-agents de IA además del robots.txt.',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseBotRow(raw: unknown): CrawlerBotStatus | null {
  const row = asRecord(raw);
  if (!row || typeof row.name !== 'string') return null;
  return {
    name: row.name,
    engine: typeof row.engine === 'string' ? row.engine : row.name,
    allowed: row.allowed !== false,
    details: typeof row.details === 'string' ? row.details : undefined,
  };
}

function inferBotFromRawContent(raw: string, agent: string): boolean | null {
  const target = agent.toLowerCase();
  const blocks = raw.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim());
    const uaLine = lines.find((l) => /^user-agent:/i.test(l));
    if (!uaLine) continue;
    const ua = uaLine.replace(/^user-agent:\s*/i, '').trim().toLowerCase();
    if (ua !== '*' && ua !== target) continue;
    const hasRootDisallow = lines.some((l) => /^disallow:\s*\/\s*$/i.test(l) || /^disallow:\s*\/\*$/i.test(l));
    if (hasRootDisallow) return false;
    const hasAllow = lines.some((l) => /^allow:\s*\//i.test(l));
    if (hasAllow) return true;
  }
  return null;
}

function mergeKeyBots(bots: CrawlerBotStatus[], rawContent: string | null): CrawlerBotStatus[] {
  const byName = new Map(bots.map((b) => [b.name, b]));
  const defaults: Array<{ name: string; engine: string }> = [
    { name: 'GPTBot', engine: 'ChatGPT / OpenAI' },
    { name: 'OAI-SearchBot', engine: 'ChatGPT Search / OpenAI' },
    { name: 'PerplexityBot', engine: 'Perplexity AI' },
    { name: 'ClaudeBot', engine: 'Claude / Anthropic' },
    { name: 'Google-Extended', engine: 'Google AI / Gemini' },
    { name: 'ChatGPT-User', engine: 'ChatGPT Browse' },
  ];

  for (const def of defaults) {
    if (byName.has(def.name)) continue;
    const inferred = rawContent ? inferBotFromRawContent(rawContent, def.name) : null;
    byName.set(def.name, {
      name: def.name,
      engine: def.engine,
      allowed: inferred ?? true,
      details: inferred == null ? 'Sin regla explícita (por defecto permitido)' : undefined,
    });
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function generateRecommendedRobotsTxt(siteUrl: string | null): string {
  const origin = (siteUrl || 'https://tudominio.com').replace(/\/$/, '');
  const lines: string[] = ['# Robots.txt recomendado por Cleexs', ''];
  lines.push('User-agent: *');
  lines.push('Allow: /');
  lines.push('Disallow: /admin/');
  lines.push('Disallow: /private/');
  lines.push('Disallow: /api/');
  lines.push('');
  lines.push('# Bots de IA — permitidos para maximizar visibilidad en agentes generativos');
  for (const bot of AI_BOTS_FOR_ROBOTS_TXT) {
    lines.push(`User-agent: ${bot}`);
    lines.push('Allow: /');
    lines.push('');
  }
  lines.push(`Sitemap: ${origin}/sitemap.xml`);
  return lines.join('\n');
}

export function buildCrawlerAccessReport(
  module: PublicDiagnosticSatelliteModule | null | undefined,
  siteUrl?: string | null
): CrawlerAccessReport | null {
  if (!module || module.status === 'pending') return null;

  const tool = module.tools?.robots_sitemap;
  const detail = asRecord(tool?.detail);
  const robots = asRecord(detail?.robots);
  const rawBots = Array.isArray(robots?.ai_bots) ? robots.ai_bots.map(parseBotRow).filter(Boolean) : [];
  const bots = mergeKeyBots(rawBots as CrawlerBotStatus[], typeof robots?.raw_content === 'string' ? robots.raw_content : null);

  const teaserBots = FREE_TEASER_BOT_NAMES.map(
    (name) => bots.find((b) => b.name === name) || { name, engine: name, allowed: true }
  );
  const blockedCount = bots.filter((b) => !b.allowed).length;

  return {
    robotsFound: Boolean(robots?.found),
    robotsUrl: typeof robots?.url === 'string' ? robots.url : null,
    bots,
    teaserBots,
    blockedCount,
    recommendedRobots: siteUrl ? generateRecommendedRobotsTxt(siteUrl) : null,
    verificationChecklist: VERIFICATION_CHECKLIST,
  };
}

export function crawlerHeadline(report: CrawlerAccessReport): string {
  if (!report.robotsFound) {
    return 'No encontramos robots.txt: los crawlers de IA pueden entrar, pero conviene declarar reglas claras.';
  }
  if (report.blockedCount === 0) {
    return 'Los principales crawlers de IA pueden acceder a tu sitio según robots.txt.';
  }
  if (report.teaserBots.some((b) => !b.allowed)) {
    return 'Hay crawlers de IA bloqueados: ChatGPT y otros pueden no leer tu web para recomendarte.';
  }
  return 'Revisá el acceso de crawlers: hay bots de IA con restricciones en robots.txt.';
}
