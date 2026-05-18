'use client';

import type { DiagnosticAnalysisJson, PublicDiagnosticRunResult } from '@/lib/api';
import {
  computeWaRunMetrics,
  isBrandEntry,
  shortBrandName,
  type WaRunMetrics,
} from '@/lib/wa-run-metrics';
import { cn } from '@/lib/utils';
import {
  AtSign,
  BarChart3,
  Crown,
  FileCheck,
  Medal,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

function scoreTone(score: number) {
  if (score >= 70) {
    return { label: 'Alta', ring: 'stroke-emerald-500', text: 'text-emerald-600' };
  }
  if (score >= 45) {
    return { label: 'Media', ring: 'stroke-amber-500', text: 'text-amber-600' };
  }
  return { label: 'Baja', ring: 'stroke-rose-500', text: 'text-rose-600' };
}

export function ScoreRing({ value }: { value: number }) {
  const tone = scoreTone(value);
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;

  return (
    <div className="relative mx-auto h-40 w-40">
      <svg className="h-40 w-40 -rotate-90" viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} className="stroke-slate-100" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={r}
          className={cn(tone.ring, 'transition-all duration-700')}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums text-slate-900">{Math.round(value)}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Cleexs</span>
        <span className={cn('mt-0.5 text-xs font-bold', tone.text)}>{tone.label}</span>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="px-0.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary-600" />
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>
      {hint ? <p className="mt-0.5 pl-6 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  value,
  sub,
  accent,
}: {
  icon: LucideIcon;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white px-2 py-3 shadow-sm">
      <div className={cn('mb-1.5 flex h-8 w-8 items-center justify-center rounded-xl', accent)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <span className="text-lg font-bold tabular-nums leading-none text-slate-900">{value}</span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{sub}</span>
    </div>
  );
}

function MetricTile({
  title,
  icon: Icon,
  pct,
  num,
  den,
  barClass,
  iconClass,
}: {
  title: string;
  icon: LucideIcon;
  pct: number;
  num: number;
  den: number;
  barClass: string;
  iconClass: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
      <p className="mb-2 text-[11px] font-semibold leading-tight text-slate-600">{title}</p>
      <div className="mb-2 flex items-center justify-between">
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', iconClass)}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-xl font-bold tabular-nums text-slate-900">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-right text-[10px] tabular-nums text-slate-400">
        {num}/{den}
      </p>
    </div>
  );
}

function IntentionBars({ items }: { items: WaRunMetrics['intentionScores'] }) {
  if (!items.length) return null;
  const max = Math.max(...items.map((i) => i.score), 1);
  const barColors = ['bg-violet-500', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500'];

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        {items.slice(0, 4).map((item, i) => (
          <div key={item.key}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-slate-700">{item.label}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{item.score}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full transition-all duration-700', barColors[i % barColors.length])}
                style={{ width: `${(item.score / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompetitorBars({
  ranking,
  brandName,
  brandAliases,
}: {
  ranking: WaRunMetrics['ranking'];
  brandName: string;
  brandAliases: string[];
}) {
  if (!ranking.length) return null;
  const maxShare = Math.max(...ranking.map((r) => r.share), 1);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="space-y-2.5">
        {ranking.map((row, idx) => {
          const isBrand = row.type === 'brand' || isBrandEntry(row.name, brandName, brandAliases);
          const label = isBrand ? 'Tu marca' : shortBrandName(row.name);
          return (
            <div
              key={`${row.name}-${idx}`}
              className={cn(
                'rounded-xl px-2.5 py-2',
                isBrand ? 'bg-primary-50 ring-1 ring-primary-100' : 'bg-slate-50/80'
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    idx === 0 ? 'bg-amber-400 text-amber-950' : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {idx + 1}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-xs font-semibold',
                    isBrand ? 'text-primary-800' : 'text-slate-700'
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    'shrink-0 text-sm font-bold tabular-nums',
                    isBrand ? 'text-primary-700' : 'text-slate-800'
                  )}
                >
                  {row.share.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/80">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700',
                    isBrand ? 'bg-primary-500' : 'bg-slate-400'
                  )}
                  style={{ width: `${(row.share / maxShare) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PresenceFunnel({ m }: { m: WaRunMetrics }) {
  const steps = [
    { label: 'Prompts', pct: 100, n: m.totalPrompts, grad: 'from-slate-500 to-slate-600' },
    { label: 'Menciones', pct: m.mentionRate, n: m.mentionCount, grad: 'from-slate-600 to-slate-700' },
    { label: 'Top 3', pct: m.top3Rate, n: m.top3Count, grad: 'from-violet-500 to-violet-600' },
    { label: '#1', pct: m.top1Rate, n: m.top1Count, grad: 'from-indigo-600 to-indigo-800' },
  ];

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-right text-[10px] tabular-nums text-slate-400">{m.totalPrompts} prompts</p>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const widthPct = 100 - i * 12;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[10px] font-semibold text-slate-500">{s.label}</span>
              <div className="flex-1">
                <div
                  className={cn(
                    'flex h-8 items-center justify-end rounded-lg bg-gradient-to-r px-2 transition-all duration-700',
                    s.grad
                  )}
                  style={{ width: `${widthPct}%`, minWidth: '28%' }}
                >
                  <span className="text-xs font-bold tabular-nums text-white">{s.pct}%</span>
                </div>
              </div>
              <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-slate-400">{s.n}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 px-2 py-2 text-center">
          <p className="text-[9px] font-semibold uppercase text-slate-400">Mención→Top3</p>
          <p className="text-lg font-bold tabular-nums text-slate-800">{m.convMentionToTop3}%</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-2 py-2 text-center">
          <p className="text-[9px] font-semibold uppercase text-slate-400">Top3→#1</p>
          <p className="text-lg font-bold tabular-nums text-slate-800">{m.convTop3ToFirst}%</p>
        </div>
      </div>
    </section>
  );
}

export function WaMobileDashboard({
  runResult,
  analysisJson,
  domain,
}: {
  runResult: PublicDiagnosticRunResult;
  analysisJson?: DiagnosticAnalysisJson | null;
  domain: string;
}) {
  const m = computeWaRunMetrics(runResult, analysisJson);
  const brandAliases = runResult.brandAliases || [];
  const bestIntention = m.intentionScores[0];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {runResult.brandName}
        </p>
        <p className="text-xs text-slate-500">{domain}</p>
      </div>

      <ScoreRing value={m.displayScore} />

      <SectionHeading icon={Sparkles} title="Resumen" hint="Posición frente al grupo en esta corrida" />

      <div className="grid grid-cols-3 gap-2">
        <MiniStat
          icon={Medal}
          value={m.brandRank != null ? `#${m.brandRank}` : '—'}
          sub="Ranking"
          accent="bg-violet-500"
        />
        <MiniStat
          icon={Sparkles}
          value={`${m.brandTop3Share.toFixed(0)}%`}
          sub="En Top 3"
          accent="bg-sky-500"
        />
        <MiniStat
          icon={Zap}
          value={bestIntention ? String(bestIntention.score) : '—'}
          sub={bestIntention ? bestIntention.label.slice(0, 8) : 'Mejor'}
          accent="bg-amber-500"
        />
      </div>

      <SectionHeading
        icon={BarChart3}
        title="Métricas del análisis"
        hint="Señales clave sobre las respuestas de ChatGPT"
      />

      <div className="grid grid-cols-2 gap-2">
        <MetricTile
          title="Formato IA"
          icon={FileCheck}
          pct={m.formatConfidence}
          num={m.parseableCount}
          den={m.totalPrompts}
          barClass="bg-violet-500"
          iconClass="bg-violet-500"
        />
        <MetricTile
          title="Mención de marca"
          icon={AtSign}
          pct={m.mentionRate}
          num={m.mentionCount}
          den={m.totalPrompts}
          barClass="bg-sky-500"
          iconClass="bg-sky-500"
        />
        <MetricTile
          title="Aparición en Top 3"
          icon={TrendingUp}
          pct={m.top3Rate}
          num={m.top3Count}
          den={m.totalPrompts}
          barClass="bg-amber-500"
          iconClass="bg-amber-500"
        />
        <MetricTile
          title="Posición #1"
          icon={Crown}
          pct={m.top1Rate}
          num={m.top1Count}
          den={m.totalPrompts}
          barClass="bg-emerald-500"
          iconClass="bg-emerald-500"
        />
      </div>

      <SectionHeading
        icon={Target}
        title="Por intención de búsqueda"
        hint="Calidad, precio, consideración y urgencia"
      />
      <IntentionBars items={m.intentionScores} />

      <SectionHeading
        icon={Users}
        title="Competidores"
        hint="Cuota en el Top 3 de recomendaciones de IA"
      />
      <CompetitorBars ranking={m.ranking} brandName={runResult.brandName} brandAliases={brandAliases} />

      <SectionHeading icon={TrendingUp} title="Funnel de presencia" hint="De prompts hasta ser #1" />
      <PresenceFunnel m={m} />
    </div>
  );
}
