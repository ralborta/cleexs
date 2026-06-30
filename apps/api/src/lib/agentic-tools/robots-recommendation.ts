/**
 * Port de cleexs-aeo-tools generate_recommended_robots() → TypeScript nativo.
 * Genera un robots.txt de referencia que permite bots de IA.
 */

const AI_BOTS = [
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

export function generateRecommendedRobots(baseUrl: string, allowAi = true): string {
  const lines: string[] = ['# Robots.txt recomendado por Cleexs — Auditoría Agéntica', ''];
  lines.push('User-agent: *');
  lines.push('Allow: /');
  lines.push('Disallow: /admin/');
  lines.push('Disallow: /private/');
  lines.push('Disallow: /api/');
  lines.push('');

  if (allowAi) {
    lines.push('# Bots de IA — Permitidos para maximizar visibilidad en agentes generativos');
    for (const bot of AI_BOTS) {
      lines.push(`User-agent: ${bot}`);
      lines.push('Allow: /');
      lines.push('');
    }
  } else {
    lines.push('# Bots de IA — Bloqueados');
    for (const bot of AI_BOTS) {
      lines.push(`User-agent: ${bot}`);
      lines.push('Disallow: /');
      lines.push('');
    }
  }

  const origin = baseUrl.replace(/\/$/, '');
  lines.push(`Sitemap: ${origin}/sitemap.xml`);
  return lines.join('\n');
}
