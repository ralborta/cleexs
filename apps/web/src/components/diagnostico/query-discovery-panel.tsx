'use client';

import { Check, ChevronDown, Info, Search, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiagnosticoV2QueryDiscovery } from '@/lib/diagnostico-v2-data';

function PresenceFunnel({ discovery }: { discovery: DiagnosticoV2QueryDiscovery }) {
  const { funnel, totalQueries } = discovery;
  const stages = [
    {
      key: 'prompts',
      label: 'Prompts analizados',
      count: totalQueries,
      pct: totalQueries > 0 ? 100 : 0,
      bg: 'from-slate-500 to-slate-600',
      ring: 'ring-slate-300/60',
      hint: 'Base del análisis',
    },
    {
      key: 'menciones',
      label: 'Menciones de marca',
      count: funnel.mentionCount,
      pct: funnel.mentionRate,
      bg: 'from-slate-600 to-slate-700',
      ring: 'ring-slate-400/50',
      hint: 'La IA te reconoce',
    },
    {
      key: 'top3',
      label: 'Aparición en Top 3',
      count: funnel.top3Count,
      pct: funnel.top3Rate,
      bg: 'from-indigo-700 to-indigo-800',
      ring: 'ring-indigo-300/60',
      hint: 'La IA te recomienda',
    },
    {
      key: 'top1',
      label: 'Posición #1',
      count: funnel.top1Count,
      pct: funnel.top1Rate,
      bg: 'from-indigo-900 to-slate-900',
      ring: 'ring-indigo-400/50',
      hint: 'Primera recomendación',
    },
  ];

  const maxWidth = 100;
  const minWidth = 38;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm ring-1 ring-slate-100/60">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div>
          <p className="text-sm font-bold text-slate-900">Funnel de presencia</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            De {totalQueries} prompts hasta la recomendación #1
          </p>
        </div>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 ring-1 ring-slate-200">
          <TrendingUp className="h-3.5 w-3.5 text-slate-700" aria-hidden />
        </span>
      </div>

      {totalQueries === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Sin prompts analizados en esta corrida.</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          {stages.map((stage, idx) => {
            const pct = Math.max(0, Math.min(100, stage.pct));
            const width = minWidth + ((maxWidth - minWidth) * pct) / 100;
            const prev = idx > 0 ? stages[idx - 1]! : null;
            const dropPts = prev ? Math.max(0, Math.round(prev.pct - stage.pct)) : 0;

            return (
              <div key={stage.key}>
                {prev && (
                  <div className="flex items-center justify-center py-0.5">
                    <div className="flex items-center gap-1 rounded-full bg-slate-50 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 ring-1 ring-slate-200">
                      <ChevronDown className="h-2.5 w-2.5" aria-hidden />
                      {dropPts > 0 ? `-${dropPts} pts` : 'se mantiene'}
                    </div>
                  </div>
                )}
                <div className="relative mx-auto" style={{ width: `${width}%` }}>
                  <div
                    className={cn(
                      'relative flex items-center justify-between gap-2 overflow-hidden rounded-lg bg-gradient-to-r px-2.5 py-2 text-white shadow-sm ring-1',
                      stage.bg,
                      stage.ring,
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/85">
                        {stage.label}
                      </p>
                      <p className="text-[9px] font-medium text-white/70">{stage.hint}</p>
                    </div>
                    <div className="flex shrink-0 items-baseline gap-1 text-right">
                      <span className="text-base font-extrabold tabular-nums leading-none">{stage.count}</span>
                      <span className="text-[10px] font-semibold tabular-nums text-white/80">· {pct}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
            <div className="rounded-md bg-slate-50/80 px-2 py-1.5 ring-1 ring-slate-100">
              <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
                Conv. Menciones → Top 3
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                {Math.round(funnel.convMentionToTop3)}%
              </p>
            </div>
            <div className="rounded-md bg-slate-50/80 px-2 py-1.5 ring-1 ring-slate-100">
              <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">
                Conv. Top 3 → #1
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">
                {Math.round(funnel.convTop3ToFirst)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BucketColumn({
  tone,
  count,
  title,
  items,
}: {
  tone: 'success' | 'warning' | 'critical';
  count: number;
  title: string;
  items: string[];
}) {
  const toneStyles = {
    success: {
      count: 'text-emerald-600',
      check: 'bg-emerald-500 text-white',
      title: 'text-emerald-700',
    },
    warning: {
      count: 'text-amber-600',
      check: 'bg-amber-500 text-white',
      title: 'text-amber-700',
    },
    critical: {
      count: 'text-red-600',
      check: 'bg-red-500 text-white',
      title: 'text-red-700',
    },
  }[tone];

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className={cn('text-xl font-black tabular-nums leading-none sm:text-2xl', toneStyles.count)}>
          {count}
        </span>
        <span className={cn('text-sm font-bold sm:text-base', toneStyles.title)}>{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.length === 0 ? (
          <li className="text-xs text-slate-400 sm:text-sm">Sin consultas en este grupo</li>
        ) : (
          items.map((item) => (
            <li key={item} className="flex items-start gap-1.5">
              <span
                className={cn(
                  'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full',
                  toneStyles.check,
                )}
              >
                <Check className="h-2 w-2" strokeWidth={3} aria-hidden />
              </span>
              <span className="min-w-0 text-xs font-medium leading-snug text-slate-700 sm:text-sm">{item}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function QueryDiscoveryInsight({
  discovery,
  className,
}: {
  discovery: DiagnosticoV2QueryDiscovery;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex w-full max-w-[175px] flex-col overflow-hidden rounded-xl border border-violet-200/90 bg-violet-50/90 px-3.5 py-3.5 sm:px-4 sm:py-4',
        className,
      )}
    >
      <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-violet-600">
        <Search className="h-4 w-4" strokeWidth={2.2} aria-hidden />
      </div>
      <p className="text-sm leading-snug text-slate-700 sm:text-[15px]">
        {discovery.insightBody}{' '}
        <span className="font-bold text-violet-900">{discovery.insightHighlight}.</span>
      </p>
      <p className="mt-3 text-xs leading-snug text-slate-600 sm:text-sm">
        Ahí es donde hoy gana{' '}
        <span className="font-bold text-violet-800">{discovery.leaderName}</span>.
      </p>
    </div>
  );
}

export function QueryDiscoveryPanel({
  discovery,
  className,
}: {
  discovery: DiagnosticoV2QueryDiscovery;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="mb-4 flex items-start gap-1.5 text-sm text-slate-500 sm:text-base">
        <span>
          Analizamos {discovery.queryTypeCount} tipos de consultas relevantes de tu industria ({discovery.totalQueries}{' '}
          prompts)
        </span>
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_175px] lg:items-start lg:gap-5">
        <div className="min-w-0 space-y-4">
          <PresenceFunnel discovery={discovery} />

          <div className="grid gap-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 sm:grid-cols-3 sm:gap-3">
            <BucketColumn tone="success" count={discovery.lead.length} title="Liderás" items={discovery.lead} />
            <BucketColumn tone="warning" count={discovery.compete.length} title="Competís" items={discovery.compete} />
            <BucketColumn
              tone="critical"
              count={discovery.lose.length}
              title="Estás perdiendo"
              items={discovery.lose}
            />
          </div>
        </div>

        <QueryDiscoveryInsight discovery={discovery} className="lg:justify-self-end" />
      </div>
    </div>
  );
}
