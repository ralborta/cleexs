'use client';

import { ExternalLink, Globe } from 'lucide-react';
import type { DomainRatingSnapshot } from '@/lib/api';
import { cn } from '@/lib/utils';

function drTone(rating: number | null | undefined): string {
  if (rating == null) return 'text-slate-500';
  if (rating >= 50) return 'text-emerald-700';
  if (rating >= 25) return 'text-amber-700';
  return 'text-slate-700';
}

function DrBadge({ rating }: { rating: number | null | undefined }) {
  return (
    <span className={cn('text-lg font-bold tabular-nums', drTone(rating))}>
      {rating == null ? '—' : rating}
    </span>
  );
}

function AhrefsAttribution({ className }: { className?: string }) {
  return (
    <p className={cn('text-[10px] text-slate-400', className)}>
      Domain Rating by{' '}
      <a
        href="https://ahrefs.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 font-medium text-slate-500 hover:text-violet-700 hover:underline"
      >
        Ahrefs
        <ExternalLink className="h-2.5 w-2.5" aria-hidden />
      </a>
      . Mide autoridad SEO por backlinks; no es lo mismo que tu Cleexs Score en IA.
    </p>
  );
}

/** Teaser para reporte gratuito: solo DR de la marca. */
export function DomainRatingTeaser({ data }: { data: DomainRatingSnapshot }) {
  if (data.brand.rating == null) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Globe className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Autoridad del dominio (SEO)</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <DrBadge rating={data.brand.rating} />
            <span className="text-xs text-slate-600">
              DR de <span className="font-medium text-slate-800">{data.brand.domain}</span>
            </span>
          </div>
          {data.insight ? <p className="mt-2 text-xs leading-relaxed text-slate-600">{data.insight}</p> : null}
          <AhrefsAttribution className="mt-3" />
        </div>
      </div>
    </div>
  );
}

/** Vista completa: marca + competidores + insight (Premium / reporte completo). */
export function DomainRatingPanel({ data }: { data: DomainRatingSnapshot }) {
  const rows = [
    { name: data.brand.name, domain: data.brand.domain, rating: data.brand.rating, isBrand: true },
    ...data.competitors.map((c) => ({
      name: c.name,
      domain: c.domain,
      rating: c.rating,
      isBrand: false,
    })),
  ].filter((r) => r.rating != null || r.isBrand);

  if (data.brand.rating == null && data.competitors.every((c) => c.rating == null)) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Autoridad del dominio (SEO)</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">Domain Rating vs competidores</p>
        </div>
        {data.gapVsLeader != null && data.gapVsLeader < 0 ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">
            {Math.abs(data.gapVsLeader)} pts debajo del líder
          </span>
        ) : null}
      </div>

      {data.insight ? (
        <p className="mb-3 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs leading-relaxed text-slate-700">
          {data.insight}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="pb-2 text-left">Marca</th>
              <th className="pb-2 text-left">Dominio</th>
              <th className="pb-2 text-right">DR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.name}-${row.domain ?? 'na'}`} className="border-t border-slate-50">
                <td className="py-2 pr-2 font-medium text-slate-900">
                  {row.name}
                  {row.isBrand ? (
                    <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700">
                      Tu marca
                    </span>
                  ) : null}
                </td>
                <td className="py-2 text-slate-500">{row.domain ?? '—'}</td>
                <td className="py-2 text-right">
                  <DrBadge rating={row.rating} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AhrefsAttribution className="mt-3" />
    </div>
  );
}

/** Columna DR para tablas de ranking existentes. */
export function DomainRatingTableCell({
  rating,
  className,
}: {
  rating?: number | null;
  className?: string;
}) {
  return (
    <td className={cn('py-2 text-right font-bold tabular-nums text-slate-800', className)}>
      {rating == null ? <span className="text-slate-300">—</span> : rating}
    </td>
  );
}

export function buildDomainRatingFromCompareRows(
  rows: Array<{
    name: string;
    domain?: string | null;
    tag: 'mi_empresa' | 'competidor';
    domainRating?: number | null;
  }>
): DomainRatingSnapshot | null {
  const brandRow = rows.find((r) => r.tag === 'mi_empresa');
  if (!brandRow?.domain) return null;

  const competitors = rows
    .filter((r) => r.tag === 'competidor')
    .map((r) => ({
      name: r.name,
      domain: r.domain ?? null,
      rating: r.domainRating ?? null,
    }));

  const brandRating = brandRow.domainRating ?? null;
  const competitorRatings = competitors
    .map((c) => c.rating)
    .filter((r): r is number => r != null);
  const allRatings = [brandRating, ...competitorRatings].filter((r): r is number => r != null);
  const leaderRating = allRatings.length > 0 ? Math.max(...allRatings) : null;
  const avgCompetitorRating =
    competitorRatings.length > 0
      ? Math.round(competitorRatings.reduce((a, b) => a + b, 0) / competitorRatings.length)
      : null;
  const gapVsLeader =
    brandRating != null && leaderRating != null ? brandRating - leaderRating : null;

  let insight: string | null = null;
  if (brandRating != null) {
    if (gapVsLeader != null && gapVsLeader < -10) {
      insight = `Tu DR (${brandRating}) está ${Math.abs(gapVsLeader)} puntos por debajo del líder del panel.`;
    } else if (leaderRating != null && brandRating >= leaderRating) {
      insight = `Tu DR (${brandRating}) está a la par o por encima de tus competidores.`;
    } else {
      insight = `Tu dominio tiene DR ${brandRating}. Complementa tu Cleexs Score con esta señal de autoridad SEO.`;
    }
  }

  if (brandRating == null && competitors.every((c) => c.rating == null)) return null;

  return {
    brand: {
      name: brandRow.name,
      domain: brandRow.domain,
      rating: brandRating,
    },
    competitors,
    leaderRating,
    avgCompetitorRating,
    gapVsLeader,
    insight,
  };
}
