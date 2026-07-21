'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Bot,
  Check,
  ClipboardList,
  FileText,
  Lightbulb,
  Lock,
  Search,
  Share2,
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
  PlanConquistarPromoPrice,
} from '@/components/planes/plan-conquistar-checkout-button';
import { EnginePaywallModal } from '@/components/diagnostico/engine-paywall-modal';
import type { EngineCardKey } from '@/components/diagnostico/cleexs-engine-scores-panel';
import { CompetitorNameLink } from '@/components/report/competitor-name-link';
import {
  CompetitorLeaderInsight,
  CompetitorShareChart,
} from '@/components/diagnostico/competitor-share-chart';
import { CleexsScoreRing } from '@/components/ui/cleexs-score-ring';
import {
  CleexsStatusIcon,
  FINDING_TONE_CARD_CLASS,
  FINDING_TONE_TITLE_CLASS,
  FINDING_TONE_WATERMARK_CLASS,
  type CleexsStatusTone,
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

function SectionBadge({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e2a5a] text-sm font-bold text-white">
        {n}
      </span>
      <h2 className="text-xl font-bold tracking-tight text-[#1e2a5a] sm:text-2xl">{label}</h2>
    </div>
  );
}

function StarRow({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={cn('text-lg', i < count ? 'text-amber-400' : 'text-slate-200')}>
          ★
        </span>
      ))}
    </div>
  );
}

function VerdictIcon({ verdict }: { verdict: DiagnosticoV2ViewModel['verdict'] }) {
  const tone: CleexsStatusTone =
    verdict === 'yes' ? 'success' : verdict === 'partial' ? 'warning' : 'critical';
  return <CleexsStatusIcon tone={tone} size="md" />;
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
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm ring-1 ring-slate-100/80">
      <div className="border-b border-slate-100 pb-4">
        <p className="text-[15px] font-bold text-[#1e2a5a]">Tu presencia en los motores</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">Mide tu visibilidad y recomendaciones.</p>
      </div>

      <div className="divide-y divide-slate-100">
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
                'flex w-full items-center gap-3 py-3.5 text-left',
                locked && 'cursor-pointer transition hover:bg-slate-50/80',
              )}
            >
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-slate-100">
                <Image src={meta.logo} alt="" width={26} height={26} className="object-contain" />
              </span>
              <span className="w-[76px] shrink-0 text-sm font-bold text-slate-900">{meta.label}</span>

              {locked ? (
                <>
                  <span className="min-w-0 flex-1" aria-hidden />
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                    <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  </span>
                </>
              ) : (
                <>
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn('h-full rounded-full', traffic.barClass)}
                      style={{ width: `${Math.max(pct, 6)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-right tabular-nums leading-none">
                    <span className={cn('text-base', SCORE_NUMBER_CLASS, traffic.textClass)}>{pct}</span>
                    <span className="text-xs font-medium text-slate-400"> / 100</span>
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 border-t border-slate-100 pt-3 text-center text-[11px] leading-relaxed text-slate-400">
        Los otros motores se desbloquean en el Plan Conquistar.
      </p>
    </div>
  );
}

function scoreToPct(score: number | null | undefined) {
  return normalizeScorePct(score);
}

function HeroSummaryPanel({
  model,
  summaryTab,
  onSummaryTab,
  onScrollCompetitors,
}: {
  model: DiagnosticoV2ViewModel;
  summaryTab: 'score' | 'competidores';
  onSummaryTab: (tab: 'score' | 'competidores') => void;
  onScrollCompetitors: () => void;
}) {
  const rankLabel = String(model.brandRank).padStart(2, '0');
  const competitorTotal = Math.max(model.competitorCount, 1);

  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => onSummaryTab('score')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition',
            summaryTab === 'score' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:text-violet-700',
          )}
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Cleexs Score
        </button>
        <button
          type="button"
          onClick={() => onSummaryTab('competidores')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition',
            summaryTab === 'competidores'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-violet-700',
          )}
        >
          <Trophy className="h-3.5 w-3.5" aria-hidden />
          Competidores
        </button>
      </div>

      {summaryTab === 'score' ? (
        <>
          <div className="flex items-start gap-2">
            <VerdictIcon verdict={model.verdict} />
            <p className="text-lg font-bold leading-snug text-slate-800">{model.verdictLabel}</p>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">{model.verdictDetail}</p>
          <button
            type="button"
            onClick={onScrollCompetitors}
            className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 ring-1 ring-violet-100 transition hover:bg-violet-100"
          >
            <Trophy className="h-4 w-4 shrink-0" />#{rankLabel} de {competitorTotal} competidores analizados
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-500">
            Orden por participación en Top 3 ({competitorTotal} competidores)
          </p>
          {model.competitors.length === 0 ? (
            <p className="text-sm text-slate-500">Sin competidores cargados en este diagnóstico.</p>
          ) : (
            <ul className="space-y-1.5">
              {model.competitors.slice(0, 6).map((row) => (
                <li
                  key={row.name}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
                    row.isBrand ? 'border-violet-200 bg-violet-50/80' : 'border-slate-200 bg-white',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
                      row.rank === 1
                        ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
                        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
                    )}
                  >
                    {row.rank}
                  </span>
                  {row.isBrand ? (
                    <span className="min-w-0 flex-1 truncate font-semibold text-violet-800">{row.name} (vos)</span>
                  ) : (
                    <CompetitorNameLink
                      name={row.name}
                      url={row.url}
                      className="min-w-0 flex-1 truncate font-medium text-slate-700"
                    />
                  )}
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">
                    {row.share.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h3 className="text-lg font-bold text-[#1e2a5a] sm:text-xl">¿Cuánto podrías ganar?</h3>
      <p className="mt-2 text-sm text-slate-600">
        Estimación ilustrativa si implementás las acciones del plan y mejorás tu visibilidad frente a{' '}
        {leaderName}.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </label>
        ))}
      </div>
      <div className="mt-6 rounded-xl bg-slate-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado estimado</p>
        <p className="mt-1 text-3xl font-black text-[#2563eb]">{money(monthly)}</p>
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
    <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center shadow-sm">
      <div className="mb-3 text-violet-600">{icon}</div>
      <p className="text-3xl font-black tabular-nums text-[#1e2a5a]">{value}</p>
      <p className="mt-2 text-xs leading-snug text-slate-600">{label}</p>
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
  const [summaryTab, setSummaryTab] = useState<'score' | 'competidores'>('score');

  const scrollToCompetitors = () => {
    setSummaryTab('competidores');
    document.getElementById('seccion-competidores')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      {/* Header sticky */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="https://cleexs.net" className="inline-flex items-center gap-2">
            <CleexsMark className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="https://cleexs.net"
              className="hidden text-xs font-medium text-slate-500 hover:text-slate-800 sm:inline"
            >
              ¿Cómo funciona este diagnóstico?
            </Link>
            <ShareScoreButtons
              path={sharePath}
              brandName={model.brandName}
              domain={model.domain}
              diagnosticId={diagnostic.id}
              shareSlug={diagnostic.shareSlug ?? undefined}
              intent="social"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        {/* HERO */}
        <section className="mb-16 sm:mb-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Diagnóstico gratuito</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight text-[#1e2a5a] sm:text-4xl lg:text-[2.65rem]">
            ¿Hoy ChatGPT recomienda tu empresa?
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Medimos tu presencia y visibilidad en las respuestas de ChatGPT, Gemini, Claude y Perplexity.
          </p>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px] lg:items-start">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <CleexsScoreRing score={model.score} size="xl" />
              <HeroSummaryPanel
                model={model}
                summaryTab={summaryTab}
                onSummaryTab={setSummaryTab}
                onScrollCompetitors={scrollToCompetitors}
              />
            </div>
            <EngineSidebar score={model.score} engines={model.engines} onLockedClick={setPaywallEngine} />
          </div>
        </section>

        {/* 1 — Hallazgos */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={1} label="Esto explica tu resultado" />
          <div className="grid gap-4 md:grid-cols-3">
            {model.findings.map((f) => (
              <div
                key={f.title}
                className={cn(
                  'relative overflow-hidden rounded-2xl border p-5 shadow-sm',
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
                  <CleexsStatusIcon tone={f.tone} size="md" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-bold leading-snug', FINDING_TONE_TITLE_CLASS[f.tone])}>
                      {f.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{f.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2 — Competidores */}
        <section id="seccion-competidores" className="mb-16 scroll-mt-24 sm:mb-20">
          <SectionBadge n={2} label="Dónde perdés clientes hoy" />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-stretch">
            <CompetitorShareChart rows={model.competitors} brandDomain={model.domain} />
            <CompetitorLeaderInsight leaderName={model.leaderName} leaderShare={model.leaderShare} />
          </div>
        </section>

        {/* 3 — Una acción */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={3} label="Si solo pudieras hacer UNA cosa" />
          <div className="overflow-hidden rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/80 to-white shadow-md">
            <div className="border-b border-violet-100 bg-violet-600/5 px-6 py-4">
              <div className="flex items-center gap-2 text-violet-700">
                <Target className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-wide">Tu primera misión</span>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <h3 className="text-xl font-bold leading-snug text-[#1e2a5a] sm:text-2xl">
                {model.primaryAction.title}
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
                {model.primaryAction.subtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-8">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Impacto esperado</p>
                  <StarRow count={model.primaryAction.impactStars} />
                  <p className="mt-1 text-sm font-bold text-slate-800">{model.primaryAction.impactLabel}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Esfuerzo estimado</p>
                  <StarRow count={model.primaryAction.effortStars} />
                  <p className="mt-1 text-sm font-bold text-slate-800">{model.primaryAction.effortLabel}</p>
                </div>
              </div>
              <p className="mt-6 text-xs text-slate-500">
                Esta acción sola podría cerrar ~{model.gapClosePct}% de la brecha con {model.leaderName}.
              </p>
            </div>
          </div>
        </section>

        {/* 4 — Qué pasa si lo hacés */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={4} label="¿Qué pasaría si lo hacés?" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: <TrendingUp className="h-6 w-6" />, text: 'Más presencia en consultas de decisión' },
              { icon: <Users className="h-6 w-6" />, text: 'Mayor probabilidad de ser la recomendación #1' },
              { icon: <Sparkles className="h-6 w-6" />, text: 'Más confianza cuando comparan opciones' },
            ].map((item) => (
              <div
                key={item.text}
                className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center shadow-sm"
              >
                <div className="mb-3 text-violet-600">{item.icon}</div>
                <p className="text-sm font-semibold text-slate-700">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <p className="text-sm font-bold text-emerald-800">
              Más visibilidad + más confianza = más clientes desde ChatGPT
            </p>
          </div>
        </section>

        {/* Calculadora — fin del diagnóstico free */}
        <section className="mb-20">
          <RevenueCalculator leaderName={model.leaderName} />
          <p className="mt-6 text-center text-sm font-medium text-slate-600">
            Ya entendiste el problema y viste el tamaño de la oportunidad. Ahora te mostramos exactamente cómo
            resolverlo.
          </p>
        </section>

        {/* Corte — Plan Conquistar */}
        <div className="mb-10 border-t border-slate-200 pt-10" />

        {/* 5 — Buenas noticias */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={5} label="Buenas noticias" />
          <p className="mb-6 max-w-2xl text-lg font-semibold text-[#1e2a5a]">
            No necesitás rehacer tu sitio web.
          </p>
          <p className="mb-8 max-w-2xl text-sm leading-relaxed text-slate-600">
            Encontramos una oportunidad muy clara para que ChatGPT te recomiende más seguido. El Plan Conquistar
            convierte ese diagnóstico en un plan de ejecución personalizado.
          </p>
          <div className="grid gap-6 lg:grid-cols-[1fr_200px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold text-[#1e2a5a]">Tu roadmap personalizado (preview)</p>
              <div className="mt-4 space-y-3">
                {model.roadmapPreview.map((item) => (
                  <div
                    key={item.week}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-violet-700">{item.week}</p>
                      <p className="text-sm text-slate-600">{item.task}</p>
                    </div>
                    <Lock className="h-4 w-4 shrink-0 text-slate-300" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center">
              <p className="rotate-0 text-center font-serif text-2xl italic text-violet-400 lg:-rotate-6">
                Esto es solo el comienzo
              </p>
            </div>
          </div>
        </section>

        {/* 6 — Mientras leías */}
        <section className="mb-16 sm:mb-20">
          <SectionBadge n={6} label="Mientras vos leías este diagnóstico…" />
          <div className="mb-8 max-w-3xl space-y-3">
            <p className="text-base font-semibold text-[#1e2a5a]">
              Nuestro motor terminó de trabajar sobre {model.brandName}.
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              Ya analizó todas las oportunidades. Ya calculó cuáles tienen mayor impacto. Ya descartó las que hoy
              no mueven la aguja. Y ya armó un plan de ejecución personalizado para que sepas exactamente qué hacer
              primero.
            </p>
            <p className="text-sm font-bold text-violet-700">Todo ya está listo. Solo falta activarlo.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <DeliverableCard
              icon={<ClipboardList className="h-7 w-7" />}
              value={model.deliverables[0].value}
              label={model.deliverables[0].label}
            />
            <DeliverableCard
              icon={<Lightbulb className="h-7 w-7" />}
              value={model.deliverables[1].value}
              label={model.deliverables[1].label}
            />
            <DeliverableCard
              icon={<FileText className="h-7 w-7" />}
              value={model.deliverables[2].value}
              label={model.deliverables[2].label}
            />
            <DeliverableCard
              icon={<Users className="h-7 w-7" />}
              value={model.deliverables[3].value}
              label={model.deliverables[3].label}
            />
            <DeliverableCard
              icon={<Zap className="h-7 w-7" />}
              value={model.deliverables[4].value}
              label={model.deliverables[4].label}
            />
            <DeliverableCard
              icon={<Target className="h-7 w-7" />}
              value={model.deliverables[5].value}
              label={model.deliverables[5].label}
            />
          </div>
        </section>

        {/* Footer CTA */}
        <section className="overflow-hidden rounded-3xl bg-[#1e2a5a] text-white shadow-2xl">
          <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[1fr_300px] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">Plan Conquistar</p>
              <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
                Desbloqueá tu plan personalizado para conseguir clientes desde ChatGPT
              </h2>
              <ul className="mt-6 space-y-2.5">
                {[
                  'Roadmap de implementación de 90 días',
                  '25 acciones priorizadas por impacto',
                  'Qué hacer esta semana y qué puede esperar',
                  'Prompts listos para copiar y ejecutar',
                  'Cómo cerrar la brecha con tu competidor líder',
                  'Premium incluido durante la implementación',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-200">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 space-y-2 border-t border-white/10 pt-6">
                <p className="text-lg font-bold">El diagnóstico te mostró dónde está la oportunidad.</p>
                <p className="text-sm text-slate-300">
                  El Plan Conquistar te muestra exactamente cómo capturarla.
                </p>
                <p className="text-sm font-semibold text-white/90">
                  Mientras vos intentabas entender qué hacer… nosotros ya lo resolvimos.
                </p>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-xl">
              <PlanConquistarPromoPrice size="md" className="justify-center" />
              <PlanConquistarCheckoutButton
                className="mt-5 w-full"
                variant="promo"
                label="Quiero mi plan de acción"
                sourceChannel="ver_resultado_v2"
                diagnosticId={diagnostic.id}
                customerEmail={diagnostic.email}
                icon="sparkles"
              />
              <p className="mt-4 text-center text-[11px] text-slate-500">Pago único · Acceso inmediato</p>
            </div>
          </div>
        </section>

        {/* Share footer */}
        <footer className="mt-10 flex flex-col items-center gap-4 border-t border-slate-200 pt-8 sm:flex-row sm:justify-between">
          <ShareScoreButtons
            path={sharePath}
            brandName={model.brandName}
            domain={model.domain}
            diagnosticId={diagnostic.id}
            shareSlug={diagnostic.shareSlug ?? undefined}
            intent="team"
          />
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Share2 className="h-3.5 w-3.5" />
            Invitá a tu equipo a ver este diagnóstico
          </p>
        </footer>

        <p className="mt-8 text-center text-[11px] text-slate-400">
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
