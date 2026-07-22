'use client';

import { Sparkles, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompetitorNameLink } from '@/components/report/competitor-name-link';
import type { DiagnosticoV2CompetitorRow } from '@/lib/diagnostico-v2-data';

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
        'min-w-0 truncate text-xs leading-tight sm:text-[13px]',
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
  const filled: ChartRow[] = rows.slice(0, 6).map((row) => ({ ...row, placeholder: false }));
  while (filled.length < 6) {
    filled.push({
      rank: filled.length + 1,
      name: '',
      share: 0,
      isBrand: false,
      url: null,
      placeholder: true,
    });
  }
  return filled;
}

function PlaceholderRow({ rank }: { rank: number }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 opacity-45 blur-[0.4px] sm:gap-x-10 lg:gap-x-14">
      <div className="flex max-w-[min(100%,220px)] items-center gap-1.5 sm:max-w-[min(100%,260px)]">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center text-xs font-semibold tabular-nums text-slate-300">
          {rank}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-[18%] rounded-full bg-slate-200" />
        </div>
        {rank <= 4 ? <span className="w-9 shrink-0" aria-hidden /> : null}
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
      <p className="mb-3 text-xs font-medium leading-snug text-slate-500">
        Participación en respuestas de ChatGPT en consultas relevantes (Top 6 marcas)
      </p>
      <div className="space-y-3">
        {topRows.map((row) => {
          if (row.placeholder) {
            return <PlaceholderRow key={`placeholder-${row.rank}`} rank={row.rank} />;
          }

          const highlighted = row.rank <= 3;
          return (
            <div
              key={`${row.rank}-${row.name}`}
              className={cn(
                'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 sm:gap-x-10 lg:gap-x-14',
                !highlighted && 'opacity-55 blur-[0.25px]',
              )}
            >
              <div className="flex max-w-[min(100%,220px)] items-center gap-1.5 sm:max-w-[min(100%,260px)]">
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
  className,
}: {
  leaderName: string;
  leaderShare: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex w-full max-w-[220px] flex-col justify-center overflow-hidden rounded-xl border border-violet-200/90 bg-violet-50/90 px-3.5 py-3.5 sm:px-4 sm:py-4',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute bottom-0 right-1 text-violet-500 opacity-[0.14]"
        aria-hidden
      >
        <Trophy className="h-[4.5rem] w-[4.5rem]" strokeWidth={1.1} />
      </div>
      <div className="relative z-[1] pr-6">
        <p className="text-sm font-bold leading-snug text-violet-900">Estás muy cerca del líder.</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
          Con las acciones correctas, podrás quedarte con ese lugar y ser la primera recomendación.
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
          {leaderName} lidera hoy con {leaderShare.toFixed(1)}%.
        </p>
      </div>
    </div>
  );
}
