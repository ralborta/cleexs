/** Parser compartido de robots.txt (grupos User-agent / Allow / Disallow). */

export type RobotsGroup = { agents: string[]; disallows: string[]; allows: string[] };

/** Limpia artefactos de Markdown (Firecrawl) y bloque inyectado por Cloudflare. */
export function normalizeRobotsText(txt: string): string {
  let out = txt
    .replace(/\\#/g, '#')
    .replace(/\\\*/g, '*')
    .replace(/\r\n/g, '\n');
  out = out.replace(
    /# BEGIN Cloudflare Managed content[\s\S]*?# END Cloudflare Managed Content\s*/i,
    '# [Ignorado para auditoría: bloque Cloudflare Managed — ver reglas del sitio abajo]\n',
  );
  return out;
}

export function parseRobots(txt: string): RobotsGroup[] {
  const normalized = normalizeRobotsText(txt);
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of normalized.split(/\n/)) {
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

/** ¿El bot está bloqueado de la raíz del sitio? */
export function isBotBlocked(groups: RobotsGroup[], agent: string): boolean {
  const a = agent.toLowerCase();
  const matching = groups.filter((g) => g.agents.includes(a));
  const wildcard = groups.filter((g) => g.agents.includes('*'));
  const relevant = matching.length > 0 ? matching : wildcard;
  if (relevant.length === 0) return false;

  // Si hay un bloque dedicado con Allow: / (p. ej. Rank Math al final del archivo),
  // prevalece sobre un Disallow: / previo inyectado por CDN (Cloudflare Managed).
  for (const g of matching) {
    const allowsRoot = g.allows.some((al) => al === '/' || al === '');
    const blocksRoot = g.disallows.some((d) => d === '/' || d === '/*');
    if (allowsRoot && !blocksRoot) return false;
  }

  for (const g of relevant) {
    const blocksRoot = g.disallows.some((d) => d === '/' || d === '/*');
    if (blocksRoot) {
      const allowsRoot = g.allows.some((al) => al === '/' || al === '');
      if (!allowsRoot) return true;
    }
  }
  return false;
}

/** ¿User-agent: * bloquea todo el sitio? (no confundir con bloqueos por bot específico). */
export function isWildcardFullyBlocked(groups: RobotsGroup[]): boolean {
  return isBotBlocked(groups, '*');
}

export function hasSitemapDirective(txt: string): boolean {
  return /^sitemap:\s*\S+/im.test(normalizeRobotsText(txt));
}

export function hasCloudflareManagedBlock(txt: string): boolean {
  return /# BEGIN Cloudflare Managed content/i.test(txt);
}
