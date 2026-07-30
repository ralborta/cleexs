'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { trackUnlockClick } from '@/lib/track';
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

import {
  PLAN_CONQUISTAR_UNLOCK_LINKS,
  type PlanConquistarUnlockKey,
} from '@cleexs/shared';

const VER_RESULTADO_V2_UNLOCK = {
  transitionBanner: PLAN_CONQUISTAR_UNLOCK_LINKS[0].key,
  ctaPlanAccion: PLAN_CONQUISTAR_UNLOCK_LINKS[1].key,
  enginePaywall: PLAN_CONQUISTAR_UNLOCK_LINKS[2].key,
} as const satisfies Record<string, PlanConquistarUnlockKey>;

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

export type DiagnosticoV2LayoutVariant = 'default' | 'cro-phase-a' | 'cro-phase-b' | 'cro-phase-c';

function SectionIntro({ children, croPhaseB }: { children: ReactNode; croPhaseB?: boolean }) {
  return (
    <p
      className={cn(
        'mb-4 max-w-3xl leading-relaxed text-slate-600',
        croPhaseB ? 'text-base sm:text-lg' : 'text-sm sm:text-base',
      )}
    >
      {children}
    </p>
  );
}

function NarrativePatternRow({
  tone,
  label,
  body,
}: {
  tone: 'success' | 'warning';
  label: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-5 py-4 sm:px-6 sm:py-5',
        tone === 'success'
          ? 'border-emerald-200/90 bg-emerald-50/50'
          : 'border-amber-200/90 bg-amber-50/40',
      )}
    >
      <p
        className={cn(
          'text-xs font-bold uppercase tracking-widest',
          tone === 'success' ? 'text-emerald-700' : 'text-amber-800',
        )}
      >
        {label}
      </p>
      <p className="mt-2 text-base font-semibold leading-snug text-[#1e2a5a] sm:text-lg">{body}</p>
    </div>
  );
}

function RoadmapTimeline({
  items,
}: {
  items: DiagnosticoV2ViewModel['roadmapPreview'];
}) {
  return (
    <div className="space-y-0">
      {items.map((item, index) => (
        <div key={`${item.week}-${item.title}`} className="relative flex gap-4 pb-8 last:pb-0">
          {index < items.length - 1 ? (
            <div
              className="absolute bottom-0 left-[11px] top-6 w-0.5 bg-violet-200"
              aria-hidden
            />
          ) : null}
          <div
            className="relative z-[1] mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 border-violet-500 bg-white shadow-sm shadow-violet-200/60"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600">{item.week}</p>
            <p className="mt-1 text-base font-bold leading-snug text-[#1e2a5a] sm:text-lg">{item.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionBadge({
  n,
  label,
  croPhaseA,
}: {
  n: number;
  label: string;
  croPhaseA?: boolean;
}) {
  return (
    <div className={cn('flex items-start gap-2', croPhaseA ? 'mb-3' : 'mb-2')}>
      <span
        className={cn(
          'mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 font-bold text-white shadow shadow-violet-500/20',
          croPhaseA ? 'h-7 w-7 text-[11px]' : 'h-6 w-6 text-[10px]',
        )}
      >
        {n}
      </span>
      <h2
        className={cn(
          'font-bold tracking-tight text-slate-900',
          croPhaseA ? 'text-xl leading-snug sm:text-2xl' : 'text-base sm:text-lg',
        )}
      >
        {label}
      </h2>
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
  unlockAll = false,
}: {
  score: number;
  engines: DiagnosticoV2ViewModel['engines'];
  onLockedClick: (key: EngineCardKey) => void;
  unlockAll?: boolean;
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
          const locked = !unlockAll && key !== 'chatgpt' && engines[key].status === 'locked';
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
  croPhaseA,
}: {
  model: DiagnosticoV2ViewModel;
  onScrollCompetitors: () => void;
  croPhaseA?: boolean;
}) {
  const analyzedCompetitors = model.competitors.filter((c) => !c.isBrand);
  const competitorTotal = Math.max(analyzedCompetitors.length, model.competitorCount, 1);

  return (
    <div
      className={cn(
        'flex flex-col gap-5 py-2 sm:flex-row sm:items-center sm:gap-6 sm:py-3 lg:gap-8',
        croPhaseA ? 'items-stretch sm:items-center' : 'items-center',
      )}
    >
      <CleexsScoreRing
        score={model.score}
        size={croPhaseA ? 'heroXl' : 'heroLg'}
        className={cn('shrink-0', croPhaseA && 'mx-auto sm:mx-0')}
      />

      <div className={cn('flex min-w-0 flex-col gap-4', croPhaseA ? 'sm:max-w-md lg:max-w-lg' : 'sm:max-w-xs lg:max-w-sm')}>
        <div className="text-left">
          {croPhaseA ? (
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-600">Conclusión</p>
          ) : null}
          <div className="flex items-start gap-2">
            <Sparkles
              className={cn('shrink-0 text-violet-600', croPhaseA ? 'mt-1 h-6 w-6' : 'mt-0.5 h-5 w-5')}
              aria-hidden
            />
            <p
              className={cn(
                'font-bold leading-snug text-violet-800',
                croPhaseA ? 'text-xl sm:text-2xl lg:text-[1.65rem]' : 'text-base lg:text-lg',
              )}
            >
              {model.verdictLabel}
            </p>
          </div>
          {croPhaseA ? (
            <p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">{model.verdictDetail}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onScrollCompetitors}
          className={cn(
            'inline-flex w-fit items-center gap-2 rounded-full bg-violet-50 font-bold text-violet-900 ring-1 ring-violet-100 transition hover:bg-violet-100',
            croPhaseA ? 'px-4 py-3 text-base' : 'px-4 py-2.5 text-sm sm:text-base',
          )}
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

function RevenueCalculator({
  leaderName,
  useSliders,
}: {
  leaderName: string;
  useSliders?: boolean;
}) {
  const [monthlyVisits, setMonthlyVisits] = useState(500);
  const [conversionRate, setConversionRate] = useState(10);
  const [clientValue, setClientValue] = useState(300);

  const monthly = monthlyVisits * (conversionRate / 100) * clientValue;

  const sliderFields = [
    {
      label: 'Visitas adicionales por mes',
      value: monthlyVisits,
      set: setMonthlyVisits,
      min: 100,
      max: 5000,
      step: 50,
      format: (v: number) => v.toLocaleString('es-AR'),
    },
    {
      label: 'Conversión a cliente (%)',
      value: conversionRate,
      set: setConversionRate,
      min: 1,
      max: 30,
      step: 1,
      format: (v: number) => `${v}%`,
    },
    {
      label: 'Facturación mensual por cliente (USD)',
      value: clientValue,
      set: setClientValue,
      min: 50,
      max: 2000,
      step: 25,
      format: (v: number) => money(v),
    },
  ] as const;

  if (useSliders) {
    return (
      <div className="p-5 sm:p-6">
        <h3 className="text-lg font-bold text-[#1e2a5a] sm:text-xl">¿Cuánto podrías ganar?</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
          Mové los controles — estimación ilustrativa si implementás el plan frente a {leaderName}.
        </p>
        <div className="mt-6 space-y-6">
          {sliderFields.map((field) => (
            <div key={field.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-slate-600">{field.label}</span>
                <span className="text-lg font-black tabular-nums text-[#1e2a5a]">
                  {field.format(field.value)}
                </span>
              </div>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={field.value}
                onChange={(e) => field.set(Number(e.target.value))}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-600"
                aria-valuemin={field.min}
                aria-valuemax={field.max}
                aria-valuenow={field.value}
              />
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-700">Resultado estimado</p>
          <p className="mt-2 text-4xl font-black tabular-nums text-[#2563eb] sm:text-5xl">{money(monthly)}</p>
          <p className="mt-1 text-sm font-medium text-slate-600">de facturación adicional mensual</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Estimación basada en tus supuestos. No es una promesa de resultados.
          </p>
        </div>
      </div>
    );
  }

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
              onChange={(e) => field.set(Number(e.target.value) || 0)}
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

function DeliverableCard({
  icon,
  value,
  label,
  shortLabel,
  croPhaseA,
  croPhaseB,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  shortLabel?: string;
  croPhaseA?: boolean;
  croPhaseB?: boolean;
}) {
  const enlarged = croPhaseA || croPhaseB;
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-slate-100 bg-white text-center',
        enlarged ? 'px-3 py-5' : 'px-3 py-4',
      )}
    >
      <div className="mb-2 text-violet-600">{icon}</div>
      <p
        className={cn(
          'font-black tabular-nums text-[#1e2a5a]',
          enlarged ? 'text-3xl sm:text-4xl' : 'text-2xl',
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          'mt-1 leading-snug text-slate-600',
          croPhaseB
            ? 'text-[11px] font-bold uppercase tracking-widest text-slate-500 sm:text-xs'
            : enlarged
              ? 'text-sm'
              : 'text-[11px]',
        )}
      >
        {croPhaseB ? shortLabel || label : label}
      </p>
    </div>
  );
}

function PlanConquistarCtaPanel({
  diagnostic,
  model,
  variant = 'main',
}: {
  diagnostic: PublicDiagnostic;
  model: DiagnosticoV2ViewModel;
  variant?: 'main' | 'inline' | 'sticky';
}) {
  const actions = model.deliverables[0]?.value ?? 0;
  const prompts = model.deliverables[1]?.value ?? 0;

  if (variant === 'sticky') {
    return (
      <PlanConquistarCheckoutButton
        className="w-full min-h-[48px] rounded-xl py-3.5 text-base shadow-md"
        variant="sidebar"
        label={`Desbloquear plan (${model.brandName}) →`}
        sourceChannel="ver_resultado_v2"
        unlockKey={VER_RESULTADO_V2_UNLOCK.ctaPlanAccion}
        diagnosticId={diagnostic.id}
        customerEmail={diagnostic.email}
        icon="sparkles"
        destination="plan-conquistar"
      />
    );
  }

  const wrapperClass =
    variant === 'inline'
      ? 'overflow-hidden rounded-2xl bg-violet-600 px-4 py-6 shadow-lg shadow-violet-600/25 sm:px-6 sm:py-7'
      : cn(
          'overflow-hidden rounded-2xl bg-violet-600 shadow-lg shadow-violet-600/20',
          'px-4 py-9 sm:px-8 sm:py-10',
        );

  const buttonClass =
    variant === 'inline'
      ? 'mx-auto w-full max-w-xl min-h-[52px] rounded-2xl py-4 text-base shadow-md sm:text-lg'
      : 'mx-auto w-full max-w-xl min-h-[56px] rounded-2xl py-5 text-lg shadow-md sm:min-h-[60px] sm:text-xl';

  return (
    <div className={wrapperClass}>
      {variant === 'inline' ? (
        <p className="mb-4 text-center text-sm font-medium text-violet-100 sm:text-base">
          Ya viste el problema y la acción prioritaria — el plan completo está listo.
        </p>
      ) : null}
      <PlanConquistarCheckoutButton
        className={buttonClass}
        variant="sidebar"
        label={`Desbloquear mi plan de acción (${model.brandName}) →`}
        sourceChannel="ver_resultado_v2"
        unlockKey={VER_RESULTADO_V2_UNLOCK.ctaPlanAccion}
        diagnosticId={diagnostic.id}
        customerEmail={diagnostic.email}
        icon="sparkles"
        destination="plan-conquistar"
      />
      {actions > 0 || prompts > 0 ? (
        <p className="mt-3 text-center text-sm font-medium text-violet-100/95 sm:text-base">
          {actions} {actions === 1 ? 'acción' : 'acciones'} · {prompts}{' '}
          {prompts === 1 ? 'prompt' : 'prompts'} · Roadmap de 90 días
        </p>
      ) : null}
    </div>
  );
}

function PlanTransitionBanner({
  diagnosticId,
  brandName,
}: {
  diagnosticId?: string;
  brandName?: string;
}) {
  const planHref = diagnosticId
    ? `/plan-conquistar?diagnosticId=${encodeURIComponent(diagnosticId)}`
    : '/plan-conquistar';
  const trackLabel = brandName
    ? `Informe v2 · Banner transición (${brandName})`
    : 'Informe v2 · Banner transición → Plan Conquistar';

  return (
    <div className="relative mb-8 pb-2">
      <Link
        href={planHref}
        onClick={() =>
          trackUnlockClick({
            unlockKey: VER_RESULTADO_V2_UNLOCK.transitionBanner,
            label: trackLabel,
            ...(diagnosticId ? { diagnosticId } : {}),
          })
        }
        className="group block rounded-xl border-2 border-violet-300/70 bg-violet-50/40 px-4 py-5 text-center transition hover:border-violet-400 hover:bg-violet-50/70 sm:px-6 sm:py-6"
      >
        <p className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold leading-relaxed text-[#1e2a5a] sm:text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          Ya entendiste el problema. y viste el tamaño de la oportunidad
        </p>
        <p className="mt-2 text-base font-bold text-violet-700 sm:text-lg">
          Ahora te mostramos exactamente cómo resolverlo.
        </p>
        <p className="mt-3 text-sm font-semibold text-violet-700 underline-offset-2 group-hover:underline">
          Ver Plan Conquistar →
        </p>
      </Link>
      <div
        className="pointer-events-none absolute -bottom-1 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-violet-400 bg-white text-violet-600 shadow-sm"
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
  variant = 'free',
  premiumAppend,
  layoutVariant = 'default',
}: {
  diagnostic: PublicDiagnostic;
  model: DiagnosticoV2ViewModel;
  sharePath: string;
  variant?: 'free' | 'premium';
  premiumAppend?: ReactNode;
  /** cro-phase-c = Fase B + CTAs sticky/inline + calculadora sliders */
  layoutVariant?: DiagnosticoV2LayoutVariant;
}) {
  const isPremium = variant === 'premium';
  const croPhaseC = layoutVariant === 'cro-phase-c';
  const croPhaseB = layoutVariant === 'cro-phase-b' || croPhaseC;
  const croPhaseA = layoutVariant === 'cro-phase-a' || croPhaseB;
  const [paywallEngine, setPaywallEngine] = useState<EngineCardKey | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [heroInView, setHeroInView] = useState(true);

  useEffect(() => {
    if (!croPhaseC || !heroRef.current) return;
    const node = heroRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroInView(entry.isIntersecting),
      { threshold: 0.12, rootMargin: '-8px 0px 0px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [croPhaseC]);

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

      <main
        className={cn(
          'mx-auto max-w-5xl px-4 sm:px-6',
          croPhaseA ? 'py-6 sm:py-10' : 'py-6 sm:py-8',
          croPhaseC && 'pb-28 sm:pb-10',
        )}
      >
        {/* HERO */}
        <section ref={heroRef} className={croPhaseA ? 'mb-8 sm:mb-10' : 'mb-6'}>
          <span
            className={cn(
              'inline-flex rounded-full px-3.5 py-1.5 font-semibold',
              croPhaseA ? 'text-sm sm:text-base' : 'text-sm',
              isPremium ? 'bg-emerald-100 text-emerald-800' : 'bg-violet-100 text-violet-700',
            )}
          >
            {isPremium
              ? `Plan Cleexs Crecimiento · ${displayDomain(model.domain)}`
              : croPhaseA
                ? `Diagnóstico ejecutivo · ${displayDomain(model.domain)}`
                : `Diagnóstico gratuito de ${displayDomain(model.domain)} completado`}
          </span>

          {croPhaseB ? (
            <div className="mt-5 space-y-6 sm:mt-6">
              <div className="max-w-3xl space-y-4">
                <h1 className="text-[2rem] font-black leading-[1.12] tracking-tight text-[#1e2a5a] sm:text-4xl lg:text-[2.85rem]">
                  {model.executiveNarrative.headline}
                </h1>
                <p className="text-lg font-medium leading-relaxed text-slate-700 sm:text-xl">
                  {model.executiveNarrative.openingLine}
                </p>
                <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                  {model.executiveNarrative.competitorLine}
                </p>
              </div>

              <div className="border-t border-slate-200/90 pt-8">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {model.executiveNarrative.evidenceLabel}
                </p>
                <div className="mt-4">
                  <HeroScoreBlock
                    model={model}
                    onScrollCompetitors={scrollToCompetitors}
                    croPhaseA={croPhaseA}
                  />
                </div>
              </div>

              <ReportBlock className="overflow-hidden border-slate-200/70 bg-slate-50/40">
                <EngineSidebar
                  score={model.score}
                  engines={model.engines}
                  onLockedClick={setPaywallEngine}
                  unlockAll={isPremium}
                />
              </ReportBlock>
            </div>
          ) : (
            <div
              className={cn(
                'mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start lg:gap-x-6 lg:gap-y-5',
                croPhaseA && 'gap-6',
              )}
            >
              <h1
                className={cn(
                  'max-w-3xl font-black leading-tight tracking-tight text-[#1e2a5a] lg:col-start-1 lg:row-start-1 lg:max-w-none',
                  croPhaseA
                    ? 'text-[2rem] sm:text-4xl lg:text-[3.25rem]'
                    : 'text-3xl sm:text-4xl lg:text-[2.75rem]',
                )}
              >
                ¿Hoy ChatGPT recomienda {displayDomain(model.domain)}?
              </h1>

              <div className="lg:col-start-1 lg:row-start-2">
                <HeroScoreBlock
                  model={model}
                  onScrollCompetitors={scrollToCompetitors}
                  croPhaseA={croPhaseA}
                />
              </div>

              <ReportBlock className="overflow-hidden lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
                <EngineSidebar
                  score={model.score}
                  engines={model.engines}
                  onLockedClick={setPaywallEngine}
                  unlockAll={isPremium}
                />
              </ReportBlock>
            </div>
          )}
        </section>

        <div className={cn(croPhaseA ? 'space-y-10' : 'space-y-6')}>
        {/* 1 — Hallazgos */}
        <section>
          <SectionBadge
            n={1}
            label={croPhaseB ? 'Qué descubrimos' : 'Lo más importante que encontramos'}
            croPhaseA={croPhaseA}
          />
          {croPhaseB ? (
            <>
              <SectionIntro croPhaseB>{model.executiveNarrative.findingsIntro}</SectionIntro>
              <div className="grid gap-4 sm:gap-5">
                <NarrativePatternRow
                  tone="success"
                  label="Muy fuerte"
                  body={model.executiveNarrative.strengthLine}
                />
                <NarrativePatternRow
                  tone="warning"
                  label="Debilidad clave"
                  body={model.executiveNarrative.weaknessLine}
                />
              </div>
            </>
          ) : (
            <ReportBlock className={croPhaseA ? 'p-5 sm:p-6' : 'p-4 sm:p-5'}>
              <div className="grid gap-3 md:grid-cols-3">
              {model.findings.map((f, idx) => (
                <div
                  key={`${f.tone}-${idx}-${f.title}`}
                  className={cn(
                    'relative overflow-hidden rounded-lg border',
                    croPhaseA ? 'p-5' : 'p-4',
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
                      <p
                        className={cn(
                          'font-bold leading-snug',
                          croPhaseA ? 'text-sm sm:text-base' : 'text-xs sm:text-sm',
                          FINDING_TONE_TITLE_CLASS[f.tone],
                        )}
                      >
                        {f.title}
                      </p>
                      <p
                        className={cn(
                          'mt-1.5 leading-relaxed text-slate-700',
                          croPhaseA ? 'text-base' : 'text-xs sm:text-sm',
                        )}
                      >
                        {f.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </ReportBlock>
          )}
        </section>

        {/* 2 — Competidores */}
        <section id="seccion-competidores" className="scroll-mt-20">
          <SectionBadge
            n={2}
            label={croPhaseB ? 'La evidencia en datos' : 'Dónde perdés clientes hoy'}
            croPhaseA={croPhaseA}
          />
          {croPhaseB ? (
            <SectionIntro croPhaseB>
              Así se traduce en menciones frente a {model.leaderName} y el resto de tus competidores.
            </SectionIntro>
          ) : null}
          <ReportBlock className={croPhaseA ? 'p-5 sm:p-6' : 'p-4 sm:p-5'}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_175px] lg:items-start lg:gap-5">
              <CompetitorShareChart
                rows={model.competitors}
                brandDomain={model.domain}
                className="rounded-none border-0 p-0 shadow-none ring-0"
              />
              <CompetitorLeaderInsight
                leaderName={model.leaderName}
                leaderShare={model.leaderShare}
                brandName={model.brandName}
                brandShare={model.brandShare}
                brandRank={model.brandRank}
                className="lg:justify-self-end"
              />
            </div>
          </ReportBlock>
        </section>

        {/* 3 — Descubrimiento de consultas */}
        <section>
          <SectionBadge n={3} label="Lo que descubrimos sobre tu empresa" croPhaseA={croPhaseA} />
          <ReportBlock className={croPhaseA ? 'p-5 sm:p-6' : 'p-4 sm:p-5'}>
            <QueryDiscoveryPanel discovery={model.queryDiscovery} />
          </ReportBlock>
        </section>

        {/* 4 — Una acción */}
        <section>
          <SectionBadge n={4} label={croPhaseB ? 'Nuestra principal recomendación' : 'Si solo pudieras hacer UNA cosa'} croPhaseA={croPhaseA} />
          <p
            className={cn(
              'mb-3 leading-relaxed text-slate-600',
              croPhaseB
                ? 'text-lg font-medium text-[#1e2a5a] sm:text-xl'
                : croPhaseA
                  ? 'text-base sm:text-lg'
                  : 'text-sm sm:text-base',
            )}
          >
            {croPhaseB
              ? model.executiveNarrative.primaryActionLead
              : 'La oportunidad con mayor impacto para ganar visibilidad en decisiones de compra.'}
          </p>
          <ReportBlock
            className={cn(
              'overflow-hidden',
              croPhaseB && 'border-2 border-violet-200 shadow-md shadow-violet-100/60',
            )}
          >
            <div className={croPhaseA ? 'bg-slate-50/70 p-5 sm:p-6' : 'bg-slate-50/70 p-4 sm:p-5'}>
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
                        <h3
                          className={cn(
                            'font-bold leading-snug text-[#1e2a5a]',
                            croPhaseA ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg',
                          )}
                        >
                          {prefix}
                        </h3>
                        {highlight ? (
                          <p
                            className={cn(
                              'mt-1.5 font-bold leading-snug text-violet-700',
                              croPhaseA ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl',
                            )}
                          >
                            {highlight}
                          </p>
                        ) : null}
                      </>
                    );
                  })()}
                  <p
                    className={cn(
                      'mt-3 leading-relaxed text-slate-600',
                      croPhaseA ? 'text-base sm:text-lg' : 'text-sm sm:text-base',
                    )}
                  >
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

        {croPhaseC ? (
          <section className="mt-10">
            <PlanConquistarCtaPanel diagnostic={diagnostic} model={model} variant="inline" />
          </section>
        ) : null}

        {/* 5 — Qué pasa si lo hacés */}
        <section>
          <SectionBadge n={5} label="¿Qué pasaría si lo hacés?" croPhaseA={croPhaseA} />
          {croPhaseC ? (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              {WHAT_IF_BENEFITS.map((item) => (
                <WhatIfBenefitCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
              <WhatIfOutcomeCard />
            </div>
          ) : (
          <ReportBlock className={croPhaseA ? 'p-5 sm:p-6' : 'p-4 sm:p-6'}>
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              {WHAT_IF_BENEFITS.map((item) => (
                <WhatIfBenefitCard key={item.title} icon={item.icon} title={item.title} body={item.body} />
              ))}
              <WhatIfOutcomeCard />
            </div>
          </ReportBlock>
          )}
        </section>

        {premiumAppend}

        {!isPremium ? (
          <>
        {/* Calculadora — fin del diagnóstico free */}
        <section>
          {croPhaseC ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/20">
              <RevenueCalculator leaderName={model.leaderName} useSliders />
            </div>
          ) : (
            <ReportBlock>
              <RevenueCalculator leaderName={model.leaderName} />
            </ReportBlock>
          )}
        </section>

        <PlanTransitionBanner diagnosticId={diagnostic.id} brandName={model.brandName} />

        {/* 6 — Buenas noticias */}
        <section>
          <SectionBadge
            n={6}
            label={croPhaseB ? 'Tu roadmap de 90 días' : 'Buenas noticias'}
            croPhaseA={croPhaseA}
          />
          {croPhaseB ? (
            <div className="overflow-hidden rounded-2xl border border-violet-100/90 bg-[#f7f5ff] p-5 sm:p-7">
              <SectionIntro croPhaseB>
                No necesitás rehacer tu sitio. Encontramos una oportunidad clara — esto es cómo la ejecutaríamos
                semana a semana.
              </SectionIntro>
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Preview del plan personalizado
                </p>
                <div className="mt-5">
                  <RoadmapTimeline items={model.roadmapPreview} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <p className="text-sm font-medium text-slate-600">
                    … y {Math.max(model.hiddenActionCount - 3, 0)} acciones más, ordenadas por impacto
                  </p>
                  <Lock className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                </div>
              </div>
              <p className="mt-5 font-serif text-lg italic leading-snug text-violet-500 sm:text-xl">
                Esto es solo el comienzo — el plan completo incluye {model.hiddenActionCount} acciones, prompts y
                checklist.
              </p>
            </div>
          ) : (
          <div className={cn('relative overflow-hidden rounded-2xl border border-violet-100/90 bg-[#f7f5ff]', croPhaseA ? 'p-5 sm:p-7' : 'p-4 sm:p-6')}>
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
          )}
        </section>

        {/* 7 — Mientras leías */}
        <section>
          <SectionBadge
            n={7}
            label={croPhaseB ? 'Tu plan ya está listo' : 'Mientras vos leías este diagnóstico…'}
            croPhaseA={croPhaseA}
          />
          <ReportBlock className={croPhaseA ? 'p-5 sm:p-6' : 'p-4 sm:p-5'}>
            <div className="mb-4 max-w-3xl space-y-2">
              <p className={cn('font-semibold text-[#1e2a5a]', croPhaseB ? 'text-base sm:text-lg' : 'text-sm')}>
                {croPhaseB
                  ? 'Nuestro motor ya hizo el trabajo sobre tu empresa.'
                  : `Nuestro motor terminó de trabajar sobre ${model.brandName}.`}
              </p>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                {model.deliverablesIntro}
              </p>
              <p className="text-xs font-bold text-violet-700 sm:text-sm">Todo ya está listo. Solo falta activarlo.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 sm:gap-3">
            <DeliverableCard
              icon={<ClipboardList className="h-6 w-6" />}
              value={model.deliverables[0].value}
              label={model.deliverables[0].label}
              shortLabel={model.deliverables[0].shortLabel}
              croPhaseA={croPhaseA}
              croPhaseB={croPhaseB}
            />
            <DeliverableCard
              icon={<Lightbulb className="h-6 w-6" />}
              value={model.deliverables[1].value}
              label={model.deliverables[1].label}
              shortLabel={model.deliverables[1].shortLabel}
              croPhaseA={croPhaseA}
              croPhaseB={croPhaseB}
            />
            <DeliverableCard
              icon={<FileText className="h-6 w-6" />}
              value={model.deliverables[2].value}
              label={model.deliverables[2].label}
              shortLabel={model.deliverables[2].shortLabel}
              croPhaseA={croPhaseA}
              croPhaseB={croPhaseB}
            />
            <DeliverableCard
              icon={<Users className="h-6 w-6" />}
              value={model.deliverables[3].value}
              label={model.deliverables[3].label}
              shortLabel={model.deliverables[3].shortLabel}
              croPhaseA={croPhaseA}
              croPhaseB={croPhaseB}
            />
            <DeliverableCard
              icon={<Zap className="h-6 w-6" />}
              value={model.deliverables[4].value}
              label={model.deliverables[4].label}
              shortLabel={model.deliverables[4].shortLabel}
              croPhaseA={croPhaseA}
              croPhaseB={croPhaseB}
            />
            <DeliverableCard
              icon={<Target className="h-6 w-6" />}
              value={model.deliverables[5].value}
              label={model.deliverables[5].label}
              shortLabel={model.deliverables[5].shortLabel}
              croPhaseA={croPhaseA}
              croPhaseB={croPhaseB}
            />
            </div>
          </ReportBlock>
        </section>

        {/* CTA principal — Plan Conquistar */}
        <section className={croPhaseA ? 'mt-12 sm:mt-14' : 'mt-10 sm:mt-12'}>
          <PlanConquistarCtaPanel diagnostic={diagnostic} model={model} variant="main" />
        </section>
          </>
        ) : null}

        {/* Share */}
        <footer className={cn('grid gap-4 sm:grid-cols-[minmax(0,1.75fr)_minmax(220px,1fr)]', isPremium ? 'mt-6' : 'mt-8 sm:mt-10')}>
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-4 sm:p-5">
            <p className="mb-3 text-sm font-bold text-[#1e2a5a]">
              Compartir resultado de {model.brandName}
            </p>
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
            <p className="mb-3 text-sm font-bold text-[#1e2a5a]">
              Invitar al equipo de {model.brandName}
            </p>
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

        {croPhaseC ? (
          <p className="mt-6 text-center text-xs text-slate-500">
            Preview Fase C CRO (conversión) ·{' '}
            <Link
              href={`/ver-resultado/v2/cro-preview-b?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
              className="font-medium text-violet-600 underline-offset-2 hover:underline"
            >
              Ver Fase B
            </Link>
            {' · '}
            <Link
              href={`/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
              className="font-medium text-violet-600 underline-offset-2 hover:underline"
            >
              Producción
            </Link>
          </p>
        ) : croPhaseB ? (
          <p className="mt-6 text-center text-xs text-slate-500">
            Preview Fase B CRO (narrativa) ·{' '}
            <Link
              href={`/ver-resultado/v2/cro-preview-c?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
              className="font-medium text-violet-600 underline-offset-2 hover:underline"
            >
              Ver Fase C (conversión)
            </Link>
            {' · '}
            <Link
              href={`/ver-resultado/v2/cro-preview?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
              className="font-medium text-violet-600 underline-offset-2 hover:underline"
            >
              Fase A
            </Link>
            {' · '}
            <Link
              href={`/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
              className="font-medium text-violet-600 underline-offset-2 hover:underline"
            >
              Producción
            </Link>
          </p>
        ) : croPhaseA ? (
          <p className="mt-6 text-center text-xs text-slate-500">
            Preview Fase A CRO ·{' '}
            <Link
              href={`/ver-resultado/v2/cro-preview-b?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
              className="font-medium text-violet-600 underline-offset-2 hover:underline"
            >
              Ver Fase B (narrativa)
            </Link>
            {' · '}
            <Link
              href={`/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnostic.id)}`}
              className="font-medium text-violet-600 underline-offset-2 hover:underline"
            >
              Comparar con producción
            </Link>
          </p>
        ) : (
          <p className="mt-6 text-center text-[11px] text-slate-400">
            {isPremium ? 'Vista premium de prueba · ' : 'Vista de prueba · '}
            <Link href={`/ver-resultado?diagnosticId=${encodeURIComponent(diagnostic.id)}`} className="underline">
              Ver informe actual en producción
            </Link>
            {' · '}
            <Link href={`/ver-resultado/v2?diagnosticId=${encodeURIComponent(diagnostic.id)}`} className="underline">
              Ver free v2
            </Link>
          </p>
        )}
      </main>

      {!isPremium && croPhaseC && !heroInView ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-200/80 bg-white/95 p-3 shadow-[0_-10px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <PlanConquistarCtaPanel diagnostic={diagnostic} model={model} variant="sticky" />
          <p className="mt-1.5 text-center text-[10px] font-medium text-slate-500">
            {model.deliverables[0]?.value ?? 0}{' '}
            {(model.deliverables[0]?.value ?? 0) === 1 ? 'acción' : 'acciones'} · roadmap 90 días
          </p>
        </div>
      ) : null}

      {!isPremium ? (
        <EnginePaywallModal
          open={paywallEngine != null}
          diagnosticId={diagnostic.id}
          unlockKey={VER_RESULTADO_V2_UNLOCK.enginePaywall}
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
      ) : null}
    </div>
  );
}
