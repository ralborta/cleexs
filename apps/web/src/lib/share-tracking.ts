/**
 * Query estándar para enlaces compartidos (ref + UTM).
 * El dashboard agrupa por `utm_source` y `ref` (ver reports de plataforma).
 */
export type ShareTrackingKind = 'public_score' | 'invite_team';

export function buildShareTrackingQuery(opts: {
  kind: ShareTrackingKind;
  /** Preferido como `ref` (misma cadena que /score/{slug} en URL pública). */
  shareSlug: string | null | undefined;
  diagnosticId: string;
}): string {
  const params = new URLSearchParams();
  const slug = opts.shareSlug?.trim();
  const ref = slug && slug.length > 0 ? slug.toLowerCase() : opts.diagnosticId.toLowerCase();
  params.set('ref', ref);
  params.set('utm_source', 'cleexs');
  params.set('utm_medium', opts.kind === 'public_score' ? 'share_score' : 'share_team');
  params.set('utm_campaign', opts.kind === 'public_score' ? 'public_score' : 'invite_team');
  params.set('utm_content', opts.diagnosticId.replace(/-/g, '').slice(0, 12));
  return params.toString();
}

/** Añade query a path; si el path ya tiene `?`, usa `&`. */
export function appendQueryToPath(path: string, query: string): string {
  if (!query) return path;
  const joiner = path.includes('?') ? '&' : '?';
  return `${path}${joiner}${query}`;
}
