'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Bot,
  ChevronDown,
  ClipboardList,
  FileText,
  BarChart3,
  Lightbulb,
  Lock,
  Search,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiagnosticoV2ViewModel } from '@/lib/diagnostico-v2-data';
import type { PublicDiagnostic } from '@/lib/api';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { ShareScoreButtons } from '@/components/share/share-score-buttons';
import {
  PlanConquistarCheckoutButton,
} from '@/components/planes/plan-conquistar-checkout-button';
import { EnginePaywallModal } from '@/components/diagnostico/engine-paywall-modal';
import type { EngineCardKey } from '@/components/diagnostico/cleexs-engine-scores-panel';
import { CompetitorNameLink } from '@/components/report/competitor-name-link';
import {
  CompetitorLeaderInsight,
  CompetitorShareChart,
} from '@/components/diagnostico/competitor-share-chart';
import { QueryDiscoveryPanel } from '@/components/diagnostico/query-discovery-panel';
import { CleexsScoreRing } from '@/components/ui/cleexs-score-ring';
import {
  CleexsStatusIcon,
  FINDING_TONE_CARD_CLASS,
  FINDING_TONE_TITLE_CLASS,
  FINDING_TONE_WATERMARK_CLASS,
} from '@/components/ui/cleexs-status-icon';
import {
  getScoreTrafficColors,
  normalizeScorePct,
  SCORE_NUMBER_CLASS,
} from '@/lib/score-traffic-colors';

const ENGINE_META: Record<EngineCardKey, { label: string; logo: string }> = {
  chatgpt: { label: 'ChatGPT', logo: '/engines/chatgpt.png' },
  gemini: { label: 'Gemini', logo: '/engines/gemini.png' },
  claude: { label: 'Claude', logo: '/engines/claude.png' },
  perplexity: { label: 'Perplexity', logo: '/engines/perplexity.png' },
};

function money(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function displayDomain(domain: string | null | undefined) {
  if (!domain) return 'tu empresa';
  return domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

function SectionBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-2 flex items-start gap-2">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white shadow shadow-violet-500/20">
        {n}
      </span>
      <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">{label}</h2>
    </div>
  );
}

function ReportBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/30 ring-1 ring-slate-100',
        className,
      )}
    >
      {children}
    </div>
  );
}

function StarRow({
  count,
  max = 5,
  tone = 'amber',
}: {
  count: number;
  max?: number;
  tone?: 'amber' | 'violet';
}) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn('text-xl sm:text-2xl', i < count ? (tone === 'violet' ? 'text-violet-500' : 'text-amber-400') : 'text-slate-200')}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function splitPrimaryActionTitle(title: string) {
  const match = title.match(/^(.+?:)\s*["'](.+)["']$/);
  if (!match) return { prefix: title, highlight: null as string | null };
  return { prefix: match[1], highlight: `"${match[2]}"` };
}

function WhatIfBenefitCard({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof TrendingUp;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3.5 rounded-xl border border-slate-200/80 bg-white p-4 sm:gap-4 sm:p-5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 sm:h-12 sm:w-12">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.1} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-snug text-[#1e2a5a] sm:text-base">{title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">{body}</p>
      </div>
    </div>
  );
}

function WhatIfOutcomeCard() {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
      <div className="space-y-1 text-sm font-bold leading-snug text-emerald-700 sm:space-y-1.5 sm:text-base">
        <p>Más visibilidad = más confianza</p>
        <p>Más confianza = más leads</p>
        <p>Más leads = más clientes</p>
      </div>
      <BarChart3 className="h-10 w-10 shrink-0 text-emerald-500/85 sm:h-11 sm:w-11" strokeWidth={1.8} aria-hidden />
    </div>
  );
}

const WHAT_IF_BENEFITS = [
  {
    icon: TrendingUp,
    title: 'Más chances de aparecer',
    body: 'En consultas de comparación y decisión donde hoy casi no estás presente.',
  },
  {
    icon: Users,
    title: 'Hoy tus competidores ganan',
    body: 'estas consultas. Vos podés quedarte con ellas.',
  },
  {
    icon: Target,
    title: 'Mayor probabilidad de ser la primera recomendación',
    body: "Cuando el usuario pregunta '¿A quién recomendás?'",
  },
] as const;

function RoadmapCueArrow({ className }: { className?: string }) {
  return (
    <Image
      src="/diagnostico/roadmap-cue-arrow.png"
      alt=""
      width={112}
      height={80}
      className={cn('object-contain', className)}
      aria-hidden
    />
  );
}

function PlanNoteArrow({ className }: { className?: string }) {
  return (
    <Image
      src="/diagnostico/plan-note-arrow.png"
      alt=""
      width={72}
      height={56}
      className={cn('object-contain', className)}
      aria-hidden
    />
  );
}

function EngineSidebar({
  score,
  engines,
  onLockedClick,
}: {
  score: number;
  engines: DiagnosticoV2ViewModel['engines'];
  onLockedClick: (key: EngineCardKey) => void;
}) {
  const items: EngineCardKey[] = ['chatgpt', 'gemini', 'claude', 'perplexity'];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-4 pb-3.5 pt-3.5 lg:pt-4">
        <p className="text-base font-bold leading-tight text-[#1e2a5a] sm:text-lg">Este es tu Cleexs Score</p>
        <p className="mt-1.5 text-xs leading-snug text-slate-500 sm:text-sm">
          Mide la presencia y visibilidad en las respuestas de ChatGPT, Gemini, Claude y Perplexity.
        </p>
      </div>

      <div className="flex-1 divide-y divide-slate-100 px-4">
        {items.map((key) => {
          const meta = ENGINE_META[key];
          const locked = key !== 'chatgpt' && engines[key].status === 'locked';
          const pct = key === 'chatgpt' ? score : scoreToPct(engines[key].score);
          const traffic = getScoreTrafficColors(pct);

          return (
            <button
              key={key}
              type="button"
              disabled={!locked}
              onClick={() => locked && onLockedClick(key)}
              className={cn(
                'flex w-full items-center gap-3 py-3 text-left',
                locked && 'cursor-pointer transition hover:bg-slate-50/80',
              )}
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                <Image src={meta.logo} alt="" width={22} height={22} className="object-contain" />
              </span>
              <span className="w-[72px] shrink-0 text-sm font-bold text-slate-900">{meta.label}</span>

              {locked ? (
                <>
                  <span className="min-w-0 flex-1" aria-hidden />
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                    <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  </span>
                </>
              ) : (
                <>
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={cn('h-full rounded-full shadow-sm', traffic.barClass)}
                      style={{ width: `${Math.max(pct, 8)}%` }}
                    />
                  </div>
                  <span className="w-[52px] shrink-0 text-right tabular-nums leading-none">
                    <span className={cn('text-base font-black', SCORE_NUMBER_CLASS, traffic.textClass)}>{pct}</span>
                    <span className="text-xs font-medium text-slate-400"> /100</span>
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="border-t border-slate-100 px-4 py-3 text-center text-xs leading-snug text-slate-400">
        Los otros motores se desbloquean en el Plan Conquistar.
      </p>
    </div>
  );
}

function scoreToPct(score: number | null | undefined) {
  return normalizeScorePct(score);
}

function HeroScoreBlock({
  model,
  onScrollCompetitors,
}: {
  model: DiagnosticoV2ViewModel;
  onScrollCompetitors: () => void;
}) {
  const analyzedCompetitors = model.competitors.filter((c) => !c.isBrand);
  const competitorTotal = Math.max(analyzedCompetitors.length, model.competitorCount, 1);

  return (
    <div className="flex flex-col items-center gap-5 py-2 sm:flex-row sm:items-center sm:gap-6 sm:py-3 lg:gap-8">
      <CleexsScoreRing score={model.score} size="heroLg" className="shrink-0" />

      <div className="flex min-w-0 flex-col gap-4 sm:max-w-xs lg:max-w-sm">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" aria-hidden />
          <p className="text-base font-bold leading-snug text-violet-800 lg:text-lg">{model.verdictLabel}</p>
        </div>

        <button
          type="button"
          onClick={onScrollCompetitors}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-900 ring-1 ring-violet-100 transition hover:bg-violet-100 sm:text-base"
        >
          <Trophy className="h-4 w-4 shrink-0 text-violet-700" aria-hidden />
          #{model.brandRank} de {competitorTotal} competidores analizados
        </button>
      </div>
    </div>
  );
}

const FINDING_WATERMARK: Record<DiagnosticoV2ViewModel['findings'][0]['tone'], ReactNode> = {
  success: <Trophy className="h-16 w-16" />,
  warning: <Search className="h-16 w-16" />,
  critical: <Bot className="h-16 w-16" />,
};

function RevenueCalculator({ leaderName }: { leaderName: string }) {
  const [monthlyVisits, setMonthlyVisits] = useState('500');
  const [conversionRate, setConversionRate] = useState('10');
  const [clientValue, setClientValue] = useState('300');

  const visits = Number(monthlyVisits) || 0;
  const conversion = Number(conversionRate) || 0;
  const value = Number(clientValue) || 0;
  const monthly = visits * (conversion / 100) * value;

  return (
    <div className="p-4 sm:p-5">
      <h3 className="text-base font-bold text-[#1e2a5a]">¿Cuánto podrías ganar?</h3>
      <p className="mt-1.5 text-xs text-slate-600 sm:text-sm">
        Estimación ilustrativa si implementás las acciones del plan y mejorás tu visibilidad frente a{' '}
        {leaderName}.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Visitas adicionales por mes', value: monthlyVisits, set: setMonthlyVisits },
          { label: 'Conversión a cliente (%)', value: conversionRate, set: setConversionRate },
          { label: 'Facturación mensual por cliente (USD)', value: clientValue, set: setClientValue },
        ].map((field) => (
          <label key={field.label} className="block">
            <span className="text-xs font-semibold text-slate-500">{field.label}</span>
            <input
              type="number"
              min="0"
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </label>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-slate-50 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Resultado estimado</p>
        <p className="mt-1 text-2xl font-black text-[#2563eb]">{money(monthly)}</p>
        <p className="mt-1 text-sm font-medium text-slate-600">de facturación adicional mensual</p>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Estimación basada en tus supuestos. No es una promesa de resultados — sirve para dimensionar la
          oportunidad.
        </p>
      </div>
    </div>
  );
}

function DeliverableCard({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-slate-100 bg-white px-3 py-4 text-center">
      <div className="mb-2 text-violet-600">{icon}</div>
      <p className="text-2xl font-black tabular-nums text-[#1e2a5a]">{value}</p>
      <p className="mt-1 text-[11px] leading-snug text-slate-600">{label}</p>
    </div>
  );
}

function PlanTransitionBanner() {
  return (
    <div className="relative mb-8 pb-2">
      <div className="rounded-xl border-2 border-violet-300/70 bg-violet-50/40 px-4 py-5 text-center sm:px-6 sm:py-6">
        <p className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold leading-relaxed text-[#1e2a5a] sm:text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          Ya entendiste el problema. y viste el tamaño de la oportunidad
        </p>
        <p className="mt-2 text-base font-bold text-violet-700 sm:text-lg">
          Ahora te mostramos exactamente cómo resolverlo.
        </p>
      </div>
      <div
        className="absolute -bottom-1 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-violet-400 bg-white text-violet-600 shadow-sm"
        aria-hidden
      >
        <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
      </div>
    </div>
  );
}

export function DiagnosticoGratuitoV2({
  diagnostic,
  model,
  sharePath,
}: {
  diagnostic: PublicDiagnostic;
  model: DiagnosticoV2ViewModel;
  sharePath: string;
}) {
  const [paywallEngine, setPaywallEngine] = useState<EngineCardKey | null>(null);

  const scrollToCompetitors = () => {
    document.getElementById('seccion-competidores')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      {/* Header sticky */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
          <Link href="https://cleexs.net" className="inline-flex items-center gap-2">
            <CleexsMark className="h-7 w-auto" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {/* HERO */}
        <section className="mb-6">
          <span className="inline-flex rounded-full bg-violet-100 px-3.5 py-1.5 text-sm font-semibold text-violet-700">
            Diagnóstico gratuito de {displayDomain(model.domain)} completado
          </span>

          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start lg:gap-x-6 lg:gap-y-5">
            <h1 className="max-w-3xl text-3xl font-black leading-tight tracking-tight text-[#1e2a5a] sm:text-4xl lg:col-start-1 lg:row-start-1 lg:max-w-none lg:text-[2.75rem]">
              ¿Hoy ChatGPT recomienda {displayDomain(model.domain)}?
            </h1>

            <div className="lg:col-start-1 lg:row-start-2">
              <HeroScoreBlock model={model} onScrollCompetitors={scrollToCompetitors} />
            </div>

            <ReportBlock className="overflow-hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
              <EngineSidebar score={model.score} engines={model.engines} onLockedClick={setPaywallEngine} />
            </ReportBlock>
          </div>
        </section>

        <div className="space-y-6">
        {/* 1 — Hallazgos */}
        <section>
          <SectionBadge n={1} label="Lo más importante que encontramos" />
          <ReportBlock className="p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-3">
            {model.findings.map((f) => (
              <div
                key={f.title}
                className={cn(
                  'relative overflow-hidden rounded-lg border p-4',
                  FINDING_TONE_CARD_CLASS[f.tone],
                )}
              >
                <div
                  className={cn(
                    'pointer-events-none absolute -bottom-2 -right-2 opacity-[0.12]',
                    FINDING_TONE_WATERMARK_CLASS[f.tone],
                  )}
                  aria-hidden
                >
                  {FINDING_WATERMARK[f.tone]}
                </div>
                <div className="relative flex items-start gap-3">
                  <CleexsStatusIcon tone={f.tone} size="xl" className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-xs font-bold leading-snug sm:text-sm', FINDING_TONE_TITLE_CLASS[f.tone])}>
                      {f.title}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-700 sm:text-sm">{f.body}</p>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </ReportBlock>
        </section>

        {/* 2 — Competidores */}
        <section id="seccion-competidores" className="scroll-mt-20">
          <SectionBadge n={2} label="Dónde perdés clientes hoy" />
          <ReportBlock className="p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_175px] lg:items-start lg:gap-5">
              <CompetitorShareChart
                rows={model.competitors}
                brandDomain={model.domain}
                className="rounded-none border-0 p-0 shadow-none ring-0"
              />
              <CompetitorLeaderInsight
                leaderName={model.leaderName}
                leaderShare={model.leaderShare}
                className="lg:justify-self-end"
              />
            </div>
          </ReportBlock>
        </section>

        {/* 3 — Descubrimiento de consultas */}
        <section>
          <SectionBadge n={3} label="Lo que descubrimos sobre tu empresa" />
          <ReportBlock className="p-4 sm:p-5">
            <QueryDiscoveryPanel discovery={model.queryDiscovery} />
          </ReportBlock>
        </section>

        {/* 4 — Una acción */}
        <section>
          <SectionBadge n={4} label="Si solo pudieras hacer UNA cosa" />
          <p className="mb-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            La oportunidad con mayor impacto para ganar visibilidad en decisiones de compra.
          </p>
          <ReportBlock className="overflow-hidden">
            <div className="bg-slate-50/70 p-4 sm:p-5">
              <div className="flex gap-4 sm:gap-5">
                <Image
                  src="/diagnostico/mission-target.png"
                  alt=""
                  width={64}
                  height={64}
                  className="h-14 w-14 shrink-0 object-contain sm:h-16 sm:w-16"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {(() => {
                    const { prefix, highlight } = splitPrimaryActionTitle(model.primaryAction.title);
                    return (
                      <>
                        <h3 className="text-base font-bold leading-snug text-[#1e2a5a] sm:text-lg">
                          {prefix}
                        </h3>
                        {highlight ? (
                          <p className="mt-1.5 text-lg font-bold leading-snug text-violet-700 sm:text-xl">
                            {highlight}
                          </p>
                        ) : null}
                      </>
                    );
                  })()}
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                    {model.primaryAction.subtitle}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white px-4 py-4 text-center sm:py-5">
                  <p className="text-xs font-semibold text-slate-500 sm:text-sm">Impacto esperado</p>
                  <div className="my-2.5">
                    <StarRow count={model.primaryAction.impactStars} tone="violet" />
                  </div>
                  <p className="text-sm font-bold text-[#1e2a5a] sm:text-base">{model.primaryAction.impactLabel}</p>
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white px-4 py-4 text-center sm:py-5">
                  <p className="text-xs font-semibold text-slate-500 sm:text-sm">Esfuerzo estimado</p>
                  <div className="my-2.5">
                    <StarRow count={model.primaryAction.effortStars} tone="violet" />
                  </div>
                  <p className="text-sm font-bold text-[#1e2a5a] sm:text-base">{model.primaryAction.effortLabel}</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 border-t border-violet-100 bg-violet-50/80 px-4 py-3.5 sm:items-center sm:px-5 sm:py-4">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 sm:mt-0" aria-hidden />
              <p className="text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                Esta acción podría cerrar el{' '}
                <span className="font-bold text-[#1e2a5a]">{model.gapClosePct}%</span> de la brecha que hay hoy
                frente al líder.
              </p>
            </div>
          </ReportBlock>
        </section>

        {/* 5 — Qué pasa si lo hacés */}
        <section>
          <SectionBadge n={5} label="¿Qué pasaría si lo hacés?" />
          <ReportBlock className="p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              {WHAT_IF_BENEFITS.map((item) => (
                <WhatIfBenefitCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
              <WhatIfOutcomeCard />
            </div>
          </ReportBlock>
        </section>

        {/* Calculadora — fin del diagnóstico free */}
        <section>
          <ReportBlock>
            <RevenueCalculator leaderName={model.leaderName} />
          </ReportBlock>
        </section>

        <PlanTransitionBanner />

        {/* 6 — Buenas noticias */}
        <section>
          <SectionBadge n={6} label="Buenas noticias" />
          <div className="relative overflow-hidden rounded-2xl border border-violet-100/90 bg-[#f7f5ff] p-4 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1.05fr)_minmax(140px,0.62fr)] lg:items-start lg:gap-4">
              <div className="relative flex min-w-0 flex-col pb-12 pr-14 lg:pb-14 lg:pr-16">
                <div className="relative z-[1]">
                  <div className="inline-flex items-center gap-1.5 text-violet-700">
                    <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="text-xs font-semibold sm:text-sm">No necesitás rehacer tu sitio.</span>
                  </div>
                  <h3 className="mt-3 text-[0.95rem] font-bold leading-snug text-[#1e2a5a] sm:text-base lg:text-[1.125rem] lg:leading-snug">
                    Encontramos una oportunidad muy clara que podría mover significativamente tu presencia en ChatGPT.
                  </h3>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
                    Ahora te mostramos exactamente cómo aprovecharla.
                  </p>
                </div>
                <RoadmapCueArrow className="pointer-events-none absolute bottom-0 right-0 z-0 hidden h-[4.75rem] w-[7rem] lg:block" />
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/30">
                <p className="text-xs font-bold text-[#1e2a5a] sm:text-sm">Tu roadmap personalizado (preview)</p>
                <div className="mt-3 divide-y divide-slate-100">
                  {model.roadmapPreview.map((item) => (
                    <div key={item.week} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {item.week}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold leading-snug text-[#1e2a5a] sm:text-sm">{item.title}</p>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 sm:text-[11px]">
                            {item.detail}
                          </p>
                        </div>
                      </div>
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 py-3">
                    <p className="text-[11px] font-medium text-slate-500 sm:text-xs">
                      … y {Math.max(model.hiddenActionCount - 3, 0)} acciones más, ordenadas por impacto
                    </p>
                    <Lock className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                  </div>
                </div>
              </div>

              <div className="relative min-w-0 pt-1 lg:pt-2">
                <p className="relative z-[1] max-w-[12rem] font-serif text-lg italic leading-snug text-violet-500 sm:text-xl">
                  *Esto es solo el comienzo*
                </p>
                <div className="relative mt-2 min-h-[6rem]">
                  <PlanNoteArrow className="pointer-events-none absolute left-3 top-0 z-0 hidden h-[5rem] w-[5rem] lg:block" />
                  <p className="relative z-[1] max-w-[14rem] pt-16 text-[11px] leading-relaxed text-slate-600 sm:pt-[4.75rem] sm:text-xs">
                    El plan completo incluye {model.hiddenActionCount} acciones priorizadas, prompts, checklist y
                    roadmap de 90 días.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7 — Mientras leías */}
        <section>
          <SectionBadge n={7} label="Mientras vos leías este diagnóstico…" />
          <ReportBlock className="p-4 sm:p-5">
            <div className="mb-4 max-w-3xl space-y-2">
              <p className="text-sm font-semibold text-[#1e2a5a]">
                Nuestro motor terminó de trabajar sobre {model.brandName}.
              </p>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                Ya analizó todas las oportunidades. Ya calculó cuáles tienen mayor impacto. Ya descartó las que hoy
                no mueven la aguja. Y ya armó un plan de ejecución personalizado para que sepas exactamente qué hacer
                primero.
              </p>
              <p className="text-xs font-bold text-violet-700 sm:text-sm">Todo ya está listo. Solo falta activarlo.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <DeliverableCard
              icon={<ClipboardList className="h-6 w-6" />}
              value={model.deliverables[0].value}
              label={model.deliverables[0].label}
            />
            <DeliverableCard
              icon={<Lightbulb className="h-6 w-6" />}
              value={model.deliverables[1].value}
              label={model.deliverables[1].label}
            />
            <DeliverableCard
              icon={<FileText className="h-6 w-6" />}
              value={model.deliverables[2].value}
              label={model.deliverables[2].label}
            />
            <DeliverableCard
              icon={<Users className="h-6 w-6" />}
              value={model.deliverables[3].value}
              label={model.deliverables[3].label}
            />
            <DeliverableCard
              icon={<Zap className="h-6 w-6" />}
              value={model.deliverables[4].value}
              label={model.deliverables[4].label}
            />
            <DeliverableCard
              icon={<Target className="h-6 w-6" />}
              value={model.deliverables[5].value}
              label={model.deliverables[5].label}
            />
            </div>
          </ReportBlock>
        </section>

        {/* CTA principal — Plan Conquistar */}
        <section className="mt-2">
          <div className="overflow-hidden rounded-2xl bg-violet-600 px-4 py-8 shadow-lg shadow-violet-600/20 sm:px-6 sm:py-9">
            <PlanConquistarCheckoutButton
              className="mx-auto w-full max-w-xl rounded-2xl py-4 text-base shadow-md"
              variant="sidebar"
              label="Quiero mi plan de acción →"
              sourceChannel="ver_resultado_v2"
              diagnosticId={diagnostic.id}
              customerEmail={diagnostic.email}
              icon="sparkles"
            />
          </div>
        </section>

        {/* Share — debajo del CTA principal */}
        <footer className="grid gap-4 sm:grid-cols-[minmax(0,1.75fr)_minmax(220px,1fr)]">
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-4 sm:p-5">
            <p className="mb-3 text-sm font-bold text-[#1e2a5a]">Compartir resultado</p>
            <ShareScoreButtons
              path={sharePath}
              brandName={model.brandName}
              domain={model.domain}
              diagnosticId={diagnostic.id}
              shareSlug={diagnostic.shareSlug ?? undefined}
              intent="social"
            />
          </div>
          <div className="rounded-xl border border-sky-200/90 bg-sky-50/40 p-4 sm:p-5">
            <p className="mb-3 text-sm font-bold text-[#1e2a5a]">Invitar a tu equipo</p>
            <ShareScoreButtons
              path={sharePath}
              brandName={model.brandName}
              domain={model.domain}
              diagnosticId={diagnostic.id}
              shareSlug={diagnostic.shareSlug ?? undefined}
              intent="team"
            />
          </div>
        </footer>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Vista de prueba ·{' '}
          <Link href={`/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`} className="underline">
            Ver informe actual en producción
          </Link>
        </p>
      </main>

      <EnginePaywallModal
        open={paywallEngine != null}
        engineName={
          paywallEngine === 'gemini'
            ? 'Gemini'
            : paywallEngine === 'claude'
              ? 'Claude'
              : paywallEngine === 'perplexity'
                ? 'Perplexity'
                : null
        }
        onClose={() => setPaywallEngine(null)}
      />
    </div>
  );
}
