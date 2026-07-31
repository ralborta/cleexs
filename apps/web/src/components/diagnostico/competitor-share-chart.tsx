'use client';

import { Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompetitorNameLink } from '@/components/report/competitor-name-link';
import type { DiagnosticoV2CompetitorRow } from '@/lib/diagnostico-v2-data';
import { buildCompetitorLeaderInsightCopy } from '@/lib/diagnostico-v2-data';

function displayDomain(url: string | null | undefined, fallback?: string | null): string | null {
  const raw = `${url || fallback || ''}`.trim();
  if (!raw) return null;
  return raw
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

function RankBadge({ rank, highlighted }: { rank: number; highlighted: boolean }) {
  if (!highlighted) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-semibold tabular-nums text-slate-400">
        {rank}
      </span>
    );
  }

  const styles: Record<number, string> = {
    1: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white',
    2: 'bg-gradient-to-br from-slate-300 to-slate-500 text-white',
    3: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white',
  };

  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black tabular-nums shadow-sm',
        styles[rank] ?? 'bg-slate-200 text-slate-700',
      )}
    >
      {rank}
    </span>
  );
}

function CompetitorAvatar({ name, isBrand }: { name: string; isBrand: boolean }) {
  if (isBrand) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-sky-50 ring-1 ring-sky-200/80">
        <Sparkles className="h-3 w-3 text-sky-600" strokeWidth={2.2} aria-hidden />
      </span>
    );
  }

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#1e2a5a] text-[10px] font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function CompetitorLabel({
  row,
  brandDomain,
}: {
  row: DiagnosticoV2CompetitorRow;
  brandDomain?: string | null;
}) {
  const domain = row.isBrand ? displayDomain(null, brandDomain) : displayDomain(row.url);
  const label = row.isBrand ? 'Tu empresa' : row.name;
  const showDomain = domain && !label.toLowerCase().includes(domain.toLowerCase());

  return (
    <p
      className={cn(
        'min-w-0 truncate text-[15px] leading-tight sm:text-base',
        row.rank <= 3 ? 'font-semibold text-slate-900' : 'font-medium text-slate-500',
      )}
    >
      {row.isBrand ? (
        <span className="text-[#1e2a5a]">{label}</span>
      ) : (
        <CompetitorNameLink
          name={label}
          url={row.url}
          className={row.rank <= 3 ? 'text-slate-900 hover:text-violet-700' : 'text-slate-500 hover:text-slate-700'}
        />
      )}
      {showDomain ? <span className="font-normal text-slate-400"> ({domain})</span> : null}
    </p>
  );
}

function ShareBar({
  share,
  maxShare,
  highlighted,
  showPct,
}: {
  share: number;
  maxShare: number;
  highlighted: boolean;
  showPct?: boolean;
}) {
  const widthPct = maxShare > 0 ? Math.max((share / maxShare) * 100, highlighted ? 14 : 5) : 0;
  const pctLabel = `${share.toFixed(1)}%`;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={cn(
          'min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100',
          highlighted ? 'h-2.5' : 'h-1',
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            highlighted
              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-500'
              : 'bg-gradient-to-r from-slate-300 to-slate-200',
          )}
          style={{ width: `${Math.min(widthPct, 100)}%` }}
        />
      </div>
      {showPct !== false ? (
        <span
          className={cn(
            'w-9 shrink-0 text-right text-[11px] tabular-nums sm:text-xs',
            highlighted ? 'font-bold text-violet-700' : 'font-medium text-slate-400',
          )}
        >
          {pctLabel}
        </span>
      ) : (
        <span className="w-9 shrink-0" aria-hidden />
      )}
    </div>
  );
}

type ChartRow = DiagnosticoV2CompetitorRow & { placeholder?: boolean };

function buildTopSixRows(rows: DiagnosticoV2CompetitorRow[]): ChartRow[] {
  return Array.from({ length: 6 }, (_, index) => {
    const rank = index + 1;
    const row = rows[index];
    if (!row) {
      return {
        rank,
        name: '',
        share: 0,
        isBrand: false,
        url: null,
        placeholder: true,
      };
    }
    return { ...row, rank, placeholder: false };
  });
}

const CHART_ROW_LAYOUT =
  'flex min-h-[2.125rem] flex-col gap-1.5 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-x-5 md:gap-x-8 lg:gap-x-14';

function PlaceholderRow({ rank }: { rank: number }) {
  return (
    <div className={CHART_ROW_LAYOUT} aria-hidden>
      <div className="flex min-w-0 max-w-full items-center gap-1.5 sm:max-w-[min(100%,280px)]">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-slate-300">
          {rank}
        </span>
        <span className="h-6 w-6 shrink-0 rounded bg-slate-100/80" />
        <span className="h-3 min-w-[7rem] flex-1 rounded bg-slate-100/70" />
      </div>
      <div className="flex min-w-0 items-center gap-2 opacity-70">
        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[22%] rounded-full bg-slate-200" />
        </div>
        <span className="w-9 shrink-0" />
      </div>
    </div>
  );
}

export function CompetitorShareChart({
  rows,
  brandDomain,
  className,
}: {
  rows: DiagnosticoV2CompetitorRow[];
  brandDomain?: string | null;
  className?: string;
}) {
  const topRows = buildTopSixRows(rows);
  const maxShare = Math.max(...topRows.filter((r) => !r.placeholder).map((r) => r.share), 1);

  return (
    <div className={cn('min-w-0', className)}>
      <p className="mb-3 text-sm font-medium leading-snug text-slate-500">
        Participación en respuestas de ChatGPT en consultas relevantes (Top 6 marcas)
      </p>
      <div className="space-y-2.5">
        {topRows.map((row) => {
          if (row.placeholder) {
            return <PlaceholderRow key={`placeholder-${row.rank}`} rank={row.rank} />;
          }

          const highlighted = row.rank <= 3;
          return (
            <div
              key={`${row.rank}-${row.name}`}
              className={cn(CHART_ROW_LAYOUT, !highlighted && 'opacity-60')}
            >
              <div className="flex min-w-0 max-w-full items-center gap-1.5 sm:max-w-[min(100%,260px)]">
                <RankBadge rank={row.rank} highlighted={highlighted} />
                {highlighted ? <CompetitorAvatar name={row.name} isBrand={row.isBrand} /> : null}
                <div className="min-w-0 flex-1">
                  <CompetitorLabel row={row} brandDomain={brandDomain} />
                </div>
              </div>
              <ShareBar
                share={row.share}
                maxShare={maxShare}
                highlighted={highlighted}
                showPct={row.rank <= 4}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CompetitorLeaderInsight({
  leaderName,
  leaderShare,
  brandName,
  brandShare,
  brandRank,
  className,
}: {
  leaderName: string;
  leaderShare: number;
  brandName: string;
  brandShare: number;
  brandRank: number;
  className?: string;
}) {
  const copy = buildCompetitorLeaderInsightCopy({
    brandName,
    brandShare,
    brandRank,
    leaderName,
    leaderShare,
  });

  return (
    <div
      className={cn(
        'relative flex h-full min-h-[10.5rem] w-full flex-col justify-center overflow-hidden rounded-xl border border-violet-200/90 bg-violet-50/90 px-3.5 py-3.5 sm:min-h-0 sm:max-w-[175px] sm:px-3.5 sm:py-3.5',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute bottom-0 right-0.5 text-violet-500 opacity-[0.13]"
        aria-hidden
      >
        <Trophy className="h-[3.75rem] w-[3.75rem]" strokeWidth={1.1} />
      </div>
      <div className="relative z-[1] pr-5">
        <p className="text-sm font-bold leading-snug text-violet-900 sm:text-base">{copy.title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">{copy.body}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-sm">{copy.footer}</p>
      </div>
    </div>
  );
}
