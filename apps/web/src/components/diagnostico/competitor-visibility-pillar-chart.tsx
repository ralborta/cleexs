'use client';

import { Info, LineChart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiagnosticoV2CompetitorRow } from '@/lib/diagnostico-v2-data';

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

function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatGap(value: number) {
  return value.toFixed(1).replace('.', ',');
}

function shortenLabel(name: string, isBrand: boolean, maxLen = 24): string {
  if (isBrand) return 'Tu empresa';
  const cleaned = name.trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trim()}…`;
}

function RankDisc({ rank, isBrand }: { rank: number; isBrand: boolean }) {
  const styles: Record<number, string> = {
    1: 'bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-sm',
    2: 'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-sm',
    3: isBrand
      ? 'bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm shadow-violet-300/50'
      : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm',
  };

  return (
    <span
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black tabular-nums ring-2 ring-white',
        styles[rank] ?? 'bg-slate-200 text-slate-600 ring-slate-100',
      )}
    >
      {rank}
    </span>
  );
}

function PillarColumn({
  row,
  maxShare,
}: {
  row: ChartRow;
  maxShare: number;
}) {
  if (row.placeholder) {
    return (
      <div className="flex min-w-[2.75rem] flex-1 flex-col items-center" aria-hidden>
        <span className="h-4 w-10 rounded bg-slate-100" />
        <div className="mt-2 flex h-[7.5rem] w-full items-end justify-center sm:h-[9.5rem]">
          <div className="h-8 w-[58%] rounded-b-md bg-slate-100" />
        </div>
        <span className="mt-2 h-2 w-full max-w-[4.5rem] rounded bg-slate-100" />
      </div>
    );
  }

  const heightPct = maxShare > 0 ? Math.min((row.share / maxShare) * 100, 100) : 0;
  const hasBar = row.share > 0.05;
  const barHeight = hasBar ? Math.max(heightPct, 14) : 0;
  const isBrand = row.isBrand;
  const dimmed = row.rank > 3;

  return (
    <div
      className={cn(
        'flex min-w-[2.75rem] flex-1 flex-col items-center',
        dimmed && 'opacity-70',
      )}
    >
      <p
        className={cn(
          'text-xs font-black tabular-nums sm:text-sm',
          isBrand ? 'text-violet-700' : dimmed ? 'text-slate-400' : 'text-slate-800',
        )}
      >
        {formatPct(row.share)}
      </p>

      <div className="relative mt-1.5 flex h-[7.5rem] w-full items-end justify-center sm:mt-2 sm:h-[9.5rem]">
        {hasBar ? (
          <div
            className="relative w-[58%] max-w-[3.25rem] transition-all duration-500"
            style={{ height: `${barHeight}%` }}
          >
            <div
              className={cn(
                'absolute -top-1.5 left-0 right-0 h-2 rounded-sm',
                isBrand
                  ? 'bg-gradient-to-r from-violet-300 via-violet-400 to-violet-500'
                  : 'bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500',
              )}
              style={{ transform: 'skewX(-8deg)' }}
              aria-hidden
            />
            <div
              className={cn(
                'relative h-full overflow-hidden rounded-b-md shadow-md',
                isBrand
                  ? 'bg-gradient-to-b from-violet-400 via-violet-600 to-violet-800 shadow-violet-300/40'
                  : 'bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600 shadow-slate-300/30',
              )}
            >
              <div
                className="absolute inset-y-0 right-0 w-[28%] bg-black/10"
                aria-hidden
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <RankDisc rank={row.rank} isBrand={isBrand} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-end pb-0.5">
            <RankDisc rank={row.rank} isBrand={isBrand} />
          </div>
        )}
      </div>

      <p
        className={cn(
          'mt-2 w-full px-0.5 text-center text-[9px] leading-tight sm:text-[10px]',
          isBrand ? 'font-bold text-violet-700' : dimmed ? 'font-medium text-slate-400' : 'font-semibold text-slate-700',
        )}
        title={row.isBrand ? 'Tu empresa' : row.name}
      >
        {shortenLabel(row.name, row.isBrand)}
      </p>
    </div>
  );
}

export function CompetitorVisibilityPillarChart({
  rows,
  leaderShare,
  brandShare,
  brandRank,
  className,
}: {
  rows: DiagnosticoV2CompetitorRow[];
  leaderShare: number;
  brandShare: number;
  brandRank: number;
  className?: string;
}) {
  const topRows = buildTopSixRows(rows);
  const maxShare = Math.max(...topRows.filter((r) => !r.placeholder).map((r) => r.share), 1);
  const gap = Math.max(0, leaderShare - brandShare);

  const insightText =
    brandRank <= 1 && brandShare >= leaderShare - 0.5
      ? 'Tu marca lidera o empata en menciones analizadas.'
      : `Estás a ${formatGap(gap)} puntos porcentuales del liderazgo`;

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <LineChart className="h-5 w-5" strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-[#1e2a5a] sm:text-lg">
            Dónde está perdiendo visibilidad tu marca
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">Presencia en respuestas de ChatGPT</p>
        </div>
      </div>

      <div className="-mx-1 mt-5 overflow-x-auto pb-1 sm:mx-0">
        <div className="flex min-w-[min(100%,22rem)] items-end justify-between gap-1 px-1 sm:min-w-0 sm:gap-2">
          {topRows.map((row) => (
            <PillarColumn key={`pillar-${row.rank}-${row.name || 'placeholder'}`} row={row} maxShare={maxShare} />
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/80 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
          {brandRank <= 1 ? (
            <Sparkles className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          ) : (
            <LineChart className="h-4 w-4" strokeWidth={2.2} aria-hidden />
          )}
        </span>
        <p className="text-sm leading-snug text-slate-700">
          {brandRank <= 1 ? (
            insightText
          ) : (
            <>
              Estás a{' '}
              <span className="font-black text-violet-700">{formatGap(gap)} puntos porcentuales</span> del
              liderazgo
            </>
          )}
        </p>
      </div>

      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        <span>
          Los porcentajes representan la proporción de consultas analizadas en las que aparece cada marca.
        </span>
      </p>
    </div>
  );
}
