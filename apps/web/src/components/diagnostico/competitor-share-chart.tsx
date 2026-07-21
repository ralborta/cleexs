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
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-semibold tabular-nums text-slate-400">
        {rank}
      </span>
    );
  }

  const styles: Record<number, string> = {
    1: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-200/60',
    2: 'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-sm shadow-slate-200/60',
    3: 'bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm shadow-orange-200/60',
  };

  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-black tabular-nums',
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-50 ring-1 ring-sky-200/80">
        <Sparkles className="h-3 w-3 text-sky-600" strokeWidth={2.2} aria-hidden />
      </span>
    );
  }

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#1e2a5a] text-[10px] font-bold text-white">
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
        'min-w-0 shrink-0 truncate text-[11px] leading-tight sm:w-[148px] sm:text-xs',
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
      {showDomain ? (
        <span className="font-normal text-slate-400">
          {' '}
          ({domain})
        </span>
      ) : null}
    </p>
  );
}

function ShareBar({
  share,
  maxShare,
  highlighted,
}: {
  share: number;
  maxShare: number;
  highlighted: boolean;
}) {
  const widthPct = maxShare > 0 ? Math.max((share / maxShare) * 100, highlighted ? 16 : 5) : 0;
  const pctLabel = `${share.toFixed(1)}%`;
  const showPctInside = highlighted && widthPct >= 28;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <div
        className={cn(
          'relative min-w-0 flex-1 overflow-hidden rounded-full',
          highlighted ? 'h-[18px] bg-violet-100/70' : 'h-1 bg-slate-100',
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            highlighted ? 'bg-violet-600' : 'bg-slate-300',
          )}
          style={{ width: `${Math.min(widthPct, 100)}%` }}
        />
        {showPctInside ? (
          <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-bold tabular-nums text-white">
            {pctLabel}
          </span>
        ) : null}
      </div>
      {!showPctInside ? (
        <span
          className={cn(
            'w-9 shrink-0 text-right text-[10px] tabular-nums',
            highlighted ? 'font-bold text-violet-700' : 'font-medium text-slate-400',
          )}
        >
          {pctLabel}
        </span>
      ) : null}
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
  const topRows = rows.slice(0, 6);
  const maxShare = Math.max(...topRows.map((r) => r.share), 1);

  return (
    <div className={cn('min-w-0', className)}>
      <p className="mb-3 text-[10px] font-medium leading-snug text-slate-500 sm:text-[11px]">
        Participación en respuestas de ChatGPT en consultas relevantes (Top 6 marcas)
      </p>
      <div className="space-y-3">
        {topRows.map((row) => {
          const highlighted = row.rank <= 3;
          return (
            <div
              key={`${row.rank}-${row.name}`}
              className={cn('flex items-center gap-2', !highlighted && 'opacity-90')}
            >
              <RankBadge rank={row.rank} highlighted={highlighted} />
              <CompetitorAvatar name={row.name} isBrand={row.isBrand} />
              <CompetitorLabel row={row} brandDomain={brandDomain} />
              <ShareBar share={row.share} maxShare={maxShare} highlighted={highlighted} />
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
        'relative overflow-hidden rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-4 sm:p-5',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -bottom-4 -right-2 text-[#059669] opacity-[0.14]"
        aria-hidden
      >
        <Trophy className="h-28 w-28" strokeWidth={1.25} />
      </div>
      <div className="relative max-w-[92%]">
        <p className="text-sm font-bold leading-snug text-[#065f46] sm:text-[15px]">
          Estás muy cerca del líder.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-600 sm:text-xs">
          Con las acciones correctas, podrás quedarte con ese lugar y ser la primera recomendación.
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          {leaderName} lidera hoy con {leaderShare.toFixed(1)}%.
        </p>
      </div>
    </div>
  );
}
