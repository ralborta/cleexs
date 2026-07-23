'use client';

import { Check, Info, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiagnosticoV2QueryDiscovery } from '@/lib/diagnostico-v2-data';

function QueryDonut({ total }: { total: number }) {
  return (
    <div className="relative mx-auto h-[7.5rem] w-[7.5rem] shrink-0 sm:h-32 sm:w-32">
      <div
        className="h-full w-full rounded-full"
        style={{ background: 'conic-gradient(#059669 0% 100%)' }}
        aria-hidden
      />
      <div className="absolute inset-[17%] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
        <span className="text-3xl font-black tabular-nums leading-none text-[#1e2a5a] sm:text-4xl">
          {total}
        </span>
        <span className="mt-1 px-1 text-[10px] font-medium leading-tight text-slate-500 sm:text-[11px]">
          consultas
          <br />
          analizadas
        </span>
      </div>
    </div>
  );
}

function FunnelPointColumn({
  tone,
  count,
  title,
  items,
}: {
  tone: 'success' | 'warning' | 'critical' | 'neutral';
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
    neutral: {
      count: 'text-slate-700',
      check: 'bg-slate-500 text-white',
      title: 'text-slate-800',
    },
  }[tone];

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-black tabular-nums leading-none sm:text-3xl', toneStyles.count)}>
          {count}
        </span>
        <span className={cn('text-sm font-bold sm:text-base', toneStyles.title)}>{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <span
              className={cn(
                'mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full',
                toneStyles.check,
              )}
            >
              <Check className="h-2 w-2" strokeWidth={3} aria-hidden />
            </span>
            <span className="min-w-0 text-xs leading-snug text-slate-700 sm:text-sm">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function toneForRate(rate: number): 'success' | 'warning' | 'critical' | 'neutral' {
  if (rate >= 80) return 'success';
  if (rate >= 40) return 'warning';
  return 'critical';
}

function buildFunnelColumns(discovery: DiagnosticoV2QueryDiscovery) {
  const { funnel, totalQueries } = discovery;

  return [
    {
      tone: 'neutral' as const,
      count: totalQueries,
      title: 'Prompts analizados',
      items: ['Base del análisis · 100%'],
    },
    {
      tone: toneForRate(funnel.mentionRate),
      count: funnel.mentionCount,
      title: 'Menciones de marca',
      items: [`La IA te reconoce · ${Math.round(funnel.mentionRate)}%`],
    },
    {
      tone: toneForRate(funnel.top3Rate),
      count: funnel.top3Count,
      title: 'Aparición en Top 3',
      items: [`La IA te recomienda · ${Math.round(funnel.top3Rate)}%`],
    },
    {
      tone: toneForRate(funnel.top1Rate),
      count: funnel.top1Count,
      title: 'Posición #1',
      items: [`Primera recomendación · ${Math.round(funnel.top1Rate)}%`],
    },
  ];
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
  const funnelColumns = buildFunnelColumns(discovery);

  return (
    <div className={cn('min-w-0', className)}>
      <p className="mb-4 flex items-start gap-1.5 text-sm text-slate-500 sm:text-base">
        <span>
          De {discovery.totalQueries} prompts hasta la recomendación #1
        </span>
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_175px] lg:items-start lg:gap-5">
        <div className="min-w-0">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-4 lg:gap-5">
            <QueryDonut total={discovery.totalQueries} />
            <div className="grid min-w-0 flex-1 gap-4 rounded-xl border border-slate-200/80 bg-slate-50/40 p-3.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
              {funnelColumns.map((column) => (
                <FunnelPointColumn
                  key={column.title}
                  tone={column.tone}
                  count={column.count}
                  title={column.title}
                  items={column.items}
                />
              ))}
            </div>
          </div>
        </div>

        <QueryDiscoveryInsight discovery={discovery} className="lg:justify-self-end" />
      </div>
    </div>
  );
}
