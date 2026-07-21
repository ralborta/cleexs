'use client';

import { Sparkles } from 'lucide-react';
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
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-sm font-semibold tabular-nums text-slate-400">
        {rank}
      </span>
    );
  }

  const styles: Record<number, string> = {
    1: 'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-white ring-2 ring-amber-200/80 shadow-sm',
    2: 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-800 ring-2 ring-slate-200 shadow-sm',
    3: 'bg-gradient-to-br from-orange-300 via-amber-600 to-orange-700 text-white ring-2 ring-orange-200/80 shadow-sm',
  };

  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums',
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
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 ring-1 ring-sky-200">
        <Sparkles className="h-4 w-4 text-sky-600" strokeWidth={2.2} aria-hidden />
      </span>
    );
  }

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1e2a5a] text-sm font-bold text-white shadow-sm">
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

  return (
    <p
      className={cn(
        'min-w-[120px] shrink-0 text-sm leading-tight sm:min-w-[148px]',
        row.rank <= 3 ? 'font-bold text-slate-900' : 'font-medium text-slate-500',
      )}
    >
      {row.isBrand ? (
        <span className="text-[#1e2a5a]">{label}</span>
      ) : (
        <CompetitorNameLink
          name={label}
          url={row.url}
          className={row.rank <= 3 ? 'text-slate-900 hover:text-violet-800' : 'text-slate-500 hover:text-slate-700'}
        />
      )}
      {domain ? (
        <span className={cn('font-normal', row.rank <= 3 ? 'text-slate-500' : 'text-slate-400')}>
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
  const widthPct = maxShare > 0 ? Math.max((share / maxShare) * 100, highlighted ? 12 : 4) : 0;

  return (
    <div className="relative min-w-0 flex-1">
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-slate-100',
          highlighted ? 'h-8 sm:h-9' : 'h-2.5',
        )}
      >
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-all',
            highlighted ? 'min-w-[4.25rem] bg-gradient-to-r from-violet-700 to-violet-600' : 'bg-slate-300',
          )}
          style={{ width: `${Math.min(widthPct, 100)}%` }}
        />
        {highlighted ? (
          <span className="absolute inset-y-0 right-3 flex items-center text-sm font-bold tabular-nums text-white drop-shadow-sm">
            {share.toFixed(1)}%
          </span>
        ) : null}
      </div>
      {!highlighted ? (
        <span className="mt-1 block text-right text-xs font-medium tabular-nums text-slate-400">
          {share.toFixed(1)}%
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
    <div className={cn('rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm sm:p-6', className)}>
      <p className="mb-5 text-sm font-medium text-slate-500">
        Participación en respuestas de ChatGPT en consultas relevantes (Top 6 marcas)
      </p>
      <div className="space-y-4 sm:space-y-5">
        {topRows.map((row) => {
          const highlighted = row.rank <= 3;
          return (
            <div
              key={`${row.rank}-${row.name}`}
              className={cn('flex items-center gap-2.5 sm:gap-3', !highlighted && 'opacity-90')}
            >
              <RankBadge rank={row.rank} highlighted={highlighted} />
              <CompetitorAvatar name={row.name} isBrand={row.isBrand} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
                <CompetitorLabel row={row} brandDomain={brandDomain} />
                <ShareBar share={row.share} maxShare={maxShare} highlighted={highlighted} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LeaderInsightTrophy({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={cn('h-[88px] w-[88px] sm:h-[100px] sm:w-[100px]', className)}
      fill="none"
      aria-hidden
    >
      {/* Destellos */}
      <path d="M60 10V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M48 14l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M72 14l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 22l-5-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M78 22l5-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Asas y copa */}
      <path
        d="M38 34c0-6 4.5-10 10-10h24c5.5 0 10 4 10 10v2H38v-2Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M34 36h8M78 36h8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M42 36h36l-4 28H46L42 36Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Vástago y base */}
      <path d="M52 64h16v10H52V64Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M44 74h32v8H44V74Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M38 82h44v6H38V82Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
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
        'flex min-h-[280px] flex-col justify-between overflow-hidden rounded-2xl border border-violet-100/90 bg-[#f5f3fa] p-6 sm:min-h-[320px] sm:p-7',
        className,
      )}
    >
      <div className="max-w-[92%]">
        <p className="text-lg font-bold leading-snug text-[#1e2a5a] sm:text-[1.35rem]">
          Estás muy cerca del líder.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
          Con las acciones correctas, podrás quedarte con ese lugar y ser la primera recomendación.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {leaderName} lidera hoy con {leaderShare.toFixed(1)}%.
        </p>
      </div>

      <div className="mt-6 flex justify-end pt-2 text-[#8b7fd4]">
        <LeaderInsightTrophy />
      </div>
    </div>
  );
}
