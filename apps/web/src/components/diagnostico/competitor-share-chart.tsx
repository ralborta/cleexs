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
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] font-semibold tabular-nums text-slate-400">
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
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-black tabular-nums shadow-sm',
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
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sky-50 ring-1 ring-sky-200/80">
        <Sparkles className="h-2.5 w-2.5 text-sky-600" strokeWidth={2.2} aria-hidden />
      </span>
    );
  }

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#1e2a5a] text-[9px] font-bold text-white">
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
        'min-w-0 flex-1 truncate text-[10px] leading-tight sm:text-[11px]',
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
}: {
  share: number;
  maxShare: number;
  highlighted: boolean;
}) {
  const widthPct = maxShare > 0 ? Math.max((share / maxShare) * 100, highlighted ? 14 : 5) : 0;
  const pctLabel = `${share.toFixed(1)}%`;

  return (
    <div className="flex w-[88px] shrink-0 items-center gap-1.5 sm:w-[104px]">
      <div
        className={cn(
          'min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100',
          highlighted ? 'h-2' : 'h-[3px]',
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
      <span
        className={cn(
          'w-8 shrink-0 text-right text-[9px] tabular-nums sm:text-[10px]',
          highlighted ? 'font-bold text-violet-700' : 'font-medium text-slate-400',
        )}
      >
        {pctLabel}
      </span>
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
      <p className="mb-2.5 text-[10px] font-medium leading-snug text-slate-500">
        Participación en respuestas de ChatGPT en consultas relevantes (Top 6 marcas)
      </p>
      <div className="space-y-2.5">
        {topRows.map((row) => {
          const highlighted = row.rank <= 3;
          return (
            <div
              key={`${row.rank}-${row.name}`}
              className={cn('flex items-center gap-1.5 sm:gap-2', !highlighted && 'opacity-90')}
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
        'relative mx-auto flex min-h-[168px] w-full max-w-[210px] flex-col justify-center overflow-hidden rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-5 lg:mx-0 lg:max-w-[200px]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -bottom-4 -right-2 text-[#059669] opacity-[0.12]"
        aria-hidden
      >
        <Trophy className="h-[6.5rem] w-[6.5rem]" strokeWidth={1.2} />
      </div>
      <div className="relative z-[1] pr-2">
        <p className="text-[13px] font-bold leading-snug text-[#065f46]">Estás muy cerca del líder.</p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
          Con las acciones correctas, podrás quedarte con ese lugar y ser la primera recomendación.
        </p>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          {leaderName} lidera hoy con {leaderShare.toFixed(1)}%.
        </p>
      </div>
    </div>
  );
}
