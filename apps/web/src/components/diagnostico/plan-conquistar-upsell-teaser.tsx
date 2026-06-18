'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Crown,
  ExternalLink,
  Flag,
  Gauge,
  Layers3,
  Lightbulb,
  Lock,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CrawlerAccessReport } from '@/lib/crawler-access';
import { CrawlerAccessPlanSection } from '@/components/diagnostico/crawler-access-plan-section';

type Opportunity = {
  title: string;
  intention: string;
  score: number;
  priority: number;
  impact: 'Alto' | 'Medio' | 'Defensivo';
  effort: 'Bajo' | 'Medio' | 'Alto';
  scenario?: string;
  action: string;
};

type RoadmapPhase = {
  range: string;
  theme: string;
  evidence: string;
  tasks: string[];
};

export type PlanConquistarTeaserData = {
  brandName: string;
  cleexsScore: number;
  totalOpportunities: number;
  engineScores?: {
    chatgpt?: number | null;
    gemini?: number | null;
    claude?: number | null;
    perplexity?: number | null;
  };
  opportunities: Opportunity[];
  improveNow: Array<{ label: string; score: number }>;
  defendNow: Array<{ label: string; score: number }>;
  roadmap: RoadmapPhase[];
  courseModules: string[];
  externalAuthority: Array<{ name: string; goal: string }>;
  crawlerAccess?: CrawlerAccessReport | null;
};

const PLAN_CONQUISTAR_PATH = '/plan-conquistar';

const MODAL_FEATURES = [
  { Icon: Gauge, title: 'Score por los 4 motores', desc: 'ChatGPT, Gemini, Claude y Perplexity en una sola lectura.' },
  { Icon: Target, title: '20 oportunidades priorizadas', desc: 'Ordenadas por impacto, esfuerzo y prioridad.' },
  { Icon: CalendarCheck, title: 'Plan de acción inmediato', desc: 'Qué hacer primero según tu diagnóstico.' },
  { Icon: Lightbulb, title: 'Kit IA de implementación', desc: 'Prompts accionables para ejecutar el plan.' },
  { Icon: Crown, title: 'Premium incluido', desc: 'Acceso al portal durante la implementación.' },
] as const;

function fmtScore(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toString() : '—';
}

// ── Modal de compra ───────────────────────────────────────────────────────────

function PlanConquistarPaywallModal({
  open,
  brandName,
  totalOpportunities,
  onClose,
}: {
  open: boolean;
  brandName: string;
  totalOpportunities: number;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-slate-900/55 backdrop-blur-[2px]" aria-hidden onClick={onClose} />
      <div className="fixed inset-0 z-[71] flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Plan Conquistar disponible"
          className="relative my-4 w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white shadow-2xl sm:my-0"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="px-6 pb-5 pt-9 text-center sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-100">
              <Sparkles className="h-7 w-7 text-violet-600" />
            </div>
            <h2 className="mt-4 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              Tu informe completo está listo para activarse
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
              Desbloqueá el <strong>AI Visibility Accelerator</strong> para {brandName || 'tu marca'}: score por
              motores, oportunidades priorizadas y un roadmap concreto para mejorar tu presencia en ChatGPT, Claude,
              Gemini y Perplexity.
            </p>
          </div>

          <div className="border-y border-slate-100 px-5 py-4 sm:px-8">
            <ul className="grid gap-3 sm:grid-cols-2">
              {MODAL_FEATURES.map(({ Icon, title, desc }) => (
                <li key={title} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                    <Icon className="h-5 w-5 text-violet-700" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{title}</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-b-3xl bg-violet-50/95 px-5 py-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <Crown className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                <p className="text-sm leading-snug text-violet-950">
                  <span className="font-black">Detectamos {Math.max(totalOpportunities, 0)} oportunidades.</span>{' '}
                  Convertí este diagnóstico en un plan de acción listo para ejecutar.
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                <Link
                  href={PLAN_CONQUISTAR_PATH}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
                >
                  <Crown className="h-4 w-4" />
                  Quiero ser el favorito de ChatGPT
                </Link>
                <button type="button" onClick={onClose} className="text-center text-xs font-semibold text-violet-800/80">
                  No, por ahora no
                </button>
              </div>
            </div>
          </div>

          <p className="flex items-center justify-center gap-1.5 px-5 py-3 text-[11px] text-slate-500">
            <Lock className="h-3.5 w-3.5" />
            Pago único USD 99 · Reporte Premium + plan de acción incluido
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Sección con bloqueo progresivo (primeras filas visibles + fade + CTA) ───────

function LockedSection({
  num,
  title,
  subtitle,
  previewMaxH,
  onUnlock,
  children,
}: {
  num: number;
  title: string;
  subtitle?: string;
  previewMaxH: number;
  onUnlock: () => void;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
            {num}
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-base font-black tracking-tight text-slate-900">
              {title}
              <button
                type="button"
                onClick={onUnlock}
                aria-label={`Desbloquear ${title}`}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 transition hover:bg-violet-200"
              >
                <Lock className="h-3.5 w-3.5" />
              </button>
            </h3>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="overflow-hidden" style={{ maxHeight: previewMaxH }}>
          {children}
        </div>
        {/* Degradado de desvanecido */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/85 to-transparent" />
        {/* CTA flotante sobre el fade */}
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <button
            type="button"
            onClick={onUnlock}
            className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/95 px-4 py-2 text-xs font-bold text-violet-700 shadow-md backdrop-blur transition hover:bg-violet-50"
          >
            <Lock className="h-3.5 w-3.5" />
            Desbloquear esta sección
          </button>
        </div>
      </div>
    </section>
  );
}

function Badge({
  children,
  tone = 'slate',
}: {
  children: ReactNode;
  tone?: 'slate' | 'violet' | 'emerald' | 'amber' | 'rose';
}) {
  const classes: Record<typeof tone, string> = {
    slate: 'bg-slate-100 text-slate-600',
    violet: 'bg-violet-100 text-violet-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', classes[tone])}>
      {children}
    </span>
  );
}

// ── Reporte Plan Conquistar bloqueado ──────────────────────────────────────────

export function PlanConquistarUpsellTeaser({ data }: { data: PlanConquistarTeaserData }) {
  const [modalOpen, setModalOpen] = useState(false);
  const open = () => setModalOpen(true);
  const engineScores = data.engineScores || {};
  const hiddenCount = Math.max(data.totalOpportunities - 3, 0);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-violet-200/70 bg-white shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500" />

      {/* Encabezado */}
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-br from-violet-50/70 via-white to-white px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-bold text-violet-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            AI Visibility Accelerator · bloqueado
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Tu Plan Conquistar está listo
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Detectamos <strong>{data.totalOpportunities} oportunidades</strong> en tu análisis. Abajo podés ver una
            parte; desbloqueá las otras <strong>{hiddenCount}</strong> y el plan completo personalizado.
          </p>
        </div>
        <button
          type="button"
          onClick={open}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
        >
          <Crown className="h-4 w-4" />
          Desbloquear USD 99
        </button>
      </div>

      <div className="space-y-8 px-5 py-7 sm:px-7">
        {/* 1 · Score por motor */}
        <LockedSection
          num={1}
          title="Cleexs Score por los 4 motores"
          subtitle="ChatGPT sale de tu corrida. El resto se desbloquea con el plan."
          previewMaxH={210}
          onUnlock={open}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['ChatGPT', fmtScore(engineScores.chatgpt ?? data.cleexsScore), false],
              ['Gemini', fmtScore(engineScores.gemini), true],
              ['Claude', fmtScore(engineScores.claude), true],
              ['Perplexity', fmtScore(engineScores.perplexity), true],
            ].map(([name, score, locked]) => (
              <div
                key={name as string}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{name}</p>
                  {locked ? <Lock className="h-4 w-4 text-slate-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </div>
                <p className={cn('mt-3 text-3xl font-black', locked ? 'text-slate-300' : 'text-slate-900')}>
                  {locked ? '—' : (score as string)}
                </p>
                <p className="mt-1 text-xs text-slate-500">{locked ? 'Bloqueado' : 'Disponible'}</p>
              </div>
            ))}
          </div>
        </LockedSection>

        {data.crawlerAccess ? (
          <LockedSection
            num={2}
            title="Acceso de crawlers de IA"
            subtitle="GPTBot, OAI-SearchBot, Perplexity y el resto de bots que leen tu web para recomendarte."
            previewMaxH={320}
            onUnlock={open}
          >
            <CrawlerAccessPlanSection report={data.crawlerAccess} />
          </LockedSection>
        ) : null}

        {/* Oportunidades priorizadas */}
        <LockedSection
          num={data.crawlerAccess ? 3 : 2}
          title="Oportunidades priorizadas"
          subtitle={`Te mostramos 3 de ${data.totalOpportunities}. Ordenadas por prioridad real.`}
          previewMaxH={360}
          onUnlock={open}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {data.opportunities.map((op, idx) => (
              <div key={`${op.title}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-start gap-2 text-sm font-semibold text-slate-900">
                    <span className="mt-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-bold text-violet-700">
                      {idx + 1}
                    </span>
                    <span>{op.title}</span>
                  </p>
                  <span className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
                    Prioridad {op.priority}
                  </span>
                </div>
                {op.scenario ? (
                  <p className="mt-1.5 pl-7 text-xs italic text-slate-500">“{op.scenario}”</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={op.impact === 'Alto' ? 'rose' : op.impact === 'Medio' ? 'amber' : 'emerald'}>
                    Impacto {op.impact}
                  </Badge>
                  <Badge tone={op.effort === 'Bajo' ? 'emerald' : 'amber'}>Esfuerzo {op.effort}</Badge>
                  <Badge>Score actual {op.score}</Badge>
                  <Badge>{op.intention}</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{op.action}</p>
              </div>
            ))}
          </div>
        </LockedSection>

        {/* Mapa de ejecución */}
        <LockedSection
          num={data.crawlerAccess ? 4 : 3}
          title="Mapa de ejecución"
          subtitle="Dónde enfocar primero y qué señales externas reforzar."
          previewMaxH={260}
          onUnlock={open}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-violet-600" />
                <p className="text-sm font-bold text-slate-900">Dónde enfocar</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { title: 'Mejorar ahora', tone: 'rose' as const, items: data.improveNow },
                  { title: 'Defender', tone: 'emerald' as const, items: data.defendNow },
                ].map((group) => (
                  <div key={group.title} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">{group.title}</h4>
                      <Badge tone={group.tone}>{group.items.length}</Badge>
                    </div>
                    <div className="space-y-1.5">
                      {group.items.map((item, i) => (
                        <div
                          key={`${group.title}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-md bg-white p-2 text-xs text-slate-700 ring-1 ring-slate-100"
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="shrink-0 font-semibold text-slate-500">{item.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-violet-600" />
                <p className="text-sm font-bold text-slate-900">Autoridad externa (sugerida)</p>
              </div>
              <div className="grid gap-2">
                {data.externalAuthority.map((ch) => (
                  <div key={ch.name} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-sm font-semibold text-slate-900">{ch.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{ch.goal}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </LockedSection>

        {/* Plan de acción inmediato */}
        <LockedSection
          num={data.crawlerAccess ? 5 : 4}
          title="Plan de acción inmediato"
          subtitle="Prioridad inmediata, quick wins y siguiente paso — basado en tu corrida."
          previewMaxH={250}
          onUnlock={open}
        >
          <div className="space-y-2.5">
            {data.roadmap.map((phase) => (
              <div
                key={phase.range}
                className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4 lg:flex-row lg:items-start"
              >
                <div className="flex gap-2 lg:w-64 lg:shrink-0">
                  <Flag className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900">{phase.range}</h4>
                    <p className="text-xs font-semibold text-violet-700">{phase.theme}</p>
                    <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">{phase.evidence}</p>
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap gap-2">
                  {phase.tasks.map((task) => (
                    <span
                      key={task}
                      className="inline-flex items-start gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-100"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
                      <span>{task}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </LockedSection>

        {/* Materiales */}
        <LockedSection
          num={data.crawlerAccess ? 6 : 5}
          title="Materiales de implementación"
          subtitle="Curso express y Kit IA de prompts listos para ejecutar."
          previewMaxH={230}
          onUnlock={open}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-violet-600" />
                <p className="text-sm font-bold text-slate-900">Curso Express de Visibilidad IA</p>
              </div>
              <div className="space-y-2">
                {data.courseModules.map((module, idx) => (
                  <div key={module} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">
                      {idx + 1}
                    </div>
                    <p className="text-sm font-medium text-slate-800">{module}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-violet-600" />
                <p className="text-sm font-bold text-slate-900">Kit IA de implementación</p>
              </div>
              <div className="space-y-2">
                {['Convertir la prioridad #1 en página', 'Cerrar brecha contra competidor', 'Tareas concretas de esta semana'].map(
                  (item) => (
                    <div key={item} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                      <p className="text-sm font-bold text-slate-900">{item}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Prompt personalizado con los datos reales de {data.brandName}.
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </LockedSection>
      </div>

      {/* CTA final */}
      <div className="border-t border-slate-100 bg-gradient-to-br from-violet-50/80 to-white px-5 py-6 text-center sm:px-7">
        <h3 className="text-lg font-black tracking-tight text-slate-950">
          Desbloqueá tu informe completo
        </h3>
        <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
          Pago único de USD 99 · Incluye reporte Premium + plan de acción y acceso al portal.
        </p>
        <button
          type="button"
          onClick={open}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
        >
          <Crown className="h-4 w-4" />
          Quiero ser el favorito de ChatGPT
        </button>
      </div>

      <PlanConquistarPaywallModal
        open={modalOpen}
        brandName={data.brandName}
        totalOpportunities={data.totalOpportunities}
        onClose={() => setModalOpen(false)}
      />
    </section>
  );
}
