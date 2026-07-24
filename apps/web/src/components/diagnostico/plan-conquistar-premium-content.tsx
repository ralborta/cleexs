'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Flag,
  Layers3,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DomainRatingSnapshot } from '@/lib/api';
import type { CrawlerAccessReport } from '@/lib/crawler-access';
import { CrawlerAccessPlanSection } from '@/components/diagnostico/crawler-access-plan-section';
import { DomainRatingPanel } from '@/components/report/domain-rating-block';
import {
  CleexsEngineScoresPanel,
  type EngineCardKey,
  type EngineCardState,
} from '@/components/diagnostico/cleexs-engine-scores-panel';
import type { PlanConquistarTeaserData } from '@/components/diagnostico/plan-conquistar-upsell-teaser';
import type { PremiumSituationSummary, PremiumWeekItem } from '@/lib/diagnostico-premium-v2-data';
import {
  CleexsStatusIcon,
  FINDING_TONE_CARD_CLASS,
  FINDING_TONE_TITLE_CLASS,
} from '@/components/ui/cleexs-status-icon';

const CHECKLIST_ITEMS = [
  'Definir las 5 intenciones principales donde querés ser recomendado.',
  'Crear o mejorar una página para cada intención crítica.',
  'Agregar FAQs claras con respuestas directas y verificables.',
  'Publicar comparativas honestas contra competidores relevantes.',
  'Actualizar datos de marca, rubro, ubicación y propuesta de valor.',
  'Sumar casos, pruebas sociales y evidencia de autoridad.',
  'Medir nuevamente las oportunidades de menor score.',
  'Correr un nuevo diagnóstico cuando ejecutes las acciones principales.',
];

function PremiumSectionHeading({
  num,
  title,
  subtitle,
}: {
  num: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-2 flex items-start gap-2">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white shadow shadow-violet-500/20">
        {num}
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p> : null}
      </div>
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

function showDomainRatingPanel(domainRating?: DomainRatingSnapshot | null) {
  if (!domainRating) return false;
  return domainRating.brand.rating != null || domainRating.competitors.some((c) => c.rating != null);
}

function PremiumWeeklyPlanPanel({ weeks }: { weeks: PremiumWeekItem[] }) {
  const [openWeek, setOpenWeek] = useState(1);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reviewedWeeks, setReviewedWeeks] = useState<number[]>([]);

  const completedTasks = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked],
  );
  const totalTasks = useMemo(() => weeks.reduce((acc, w) => acc + w.tasks.length, 0), [weeks]);
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const toggleTask = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const markWeekReviewed = (week: number) => {
    setReviewedWeeks((prev) => (prev.includes(week) ? prev : [...prev, week].sort((a, b) => a - b)));
    if (week < 12) setOpenWeek(week + 1);
  };

  return (
    <div className="space-y-4">
      <ReportBlock className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#1e2a5a]">Progreso del plan · 12 semanas</p>
            <p className="mt-1 text-xs text-slate-500">
              {completedTasks} de {totalTasks} tareas marcadas · {reviewedWeeks.length} semanas revisadas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-sm font-bold tabular-nums text-violet-700">{progressPct}%</span>
          </div>
        </div>
      </ReportBlock>

      <div className="relative space-y-3 pl-0 sm:pl-4">
        <div className="pointer-events-none absolute bottom-2 left-[11px] top-2 hidden w-px bg-violet-200 sm:block" aria-hidden />
        {weeks.map((item) => {
          const isOpen = openWeek === item.week;
          const isReviewed = reviewedWeeks.includes(item.week);
          const weekDone = item.tasks.every((t) => checked[t.id]);

          return (
            <div key={item.week} className="relative">
              <ReportBlock className={cn(isOpen && 'ring-2 ring-violet-200')}>
                <button
                  type="button"
                  onClick={() => setOpenWeek(isOpen ? 0 : item.week)}
                  className="flex w-full items-start gap-3 p-4 text-left sm:p-5"
                >
                  <span
                    className={cn(
                      'relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      isReviewed
                        ? 'bg-emerald-500 text-white'
                        : isOpen
                          ? 'bg-violet-600 text-white'
                          : 'bg-violet-100 text-violet-700',
                    )}
                  >
                    {isReviewed ? '✓' : item.week}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {item.label}
                      </span>
                      {isReviewed ? <Badge tone="emerald">Revisada</Badge> : null}
                      {weekDone && !isReviewed ? <Badge tone="violet">Lista para revisar</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm font-bold text-[#1e2a5a] sm:text-base">{item.title}</p>
                    <p className="mt-0.5 text-xs text-violet-700">{item.theme}</p>
                  </div>
                  <ChevronDown
                    className={cn('mt-1 h-5 w-5 shrink-0 text-slate-400 transition', isOpen && 'rotate-180')}
                  />
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
                    <p className="text-xs leading-relaxed text-slate-500">{item.evidence}</p>
                    {(item.impact || item.effort) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.impact ? <Badge tone="rose">Impacto {item.impact}</Badge> : null}
                        {item.effort ? <Badge tone="emerald">Esfuerzo {item.effort}</Badge> : null}
                      </div>
                    )}
                    <ul className="mt-4 space-y-2">
                      {item.tasks.map((task) => (
                        <li key={task.id}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(checked[task.id])}
                              onChange={() => toggleTask(task.id)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            />
                            <span className={cn(checked[task.id] && 'text-slate-400 line-through')}>{task.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() => markWeekReviewed(item.week)}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
                      >
                        <CalendarCheck className="h-4 w-4" />
                        Marcar semana como revisada
                      </button>
                      <p className="text-xs text-slate-500">Revisión semanal · ~5 min</p>
                    </div>
                  </div>
                ) : null}
              </ReportBlock>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlanConquistarPremiumContent({
  data,
  situation,
  weeklyPlan,
  startSectionNum = 6,
}: {
  data: PlanConquistarTeaserData;
  situation: PremiumSituationSummary;
  weeklyPlan: PremiumWeekItem[];
  startSectionNum?: number;
}) {
  let sectionNum = startSectionNum;
  const implementationPrompts = data.implementationPrompts ?? [];

  return (
    <div className="space-y-6 border-t border-violet-100 pt-6">
      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-600 to-indigo-600 px-4 py-4 text-white shadow-lg shadow-violet-900/10 sm:px-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">Plan Cleexs Crecimiento activado</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-violet-100">
          Informe completo para {data.brandName}: diagnóstico, oportunidades desbloqueadas y plan de acción de 12 semanas
          con revisión semanal.
        </p>
      </div>

      <section id="premium-situacion">
        <PremiumSectionHeading
          num={sectionNum++}
          title="Qué está mal hoy"
          subtitle="Diagnóstico de situación basado en tu corrida — qué te frena en IA antes de ejecutar el plan."
        />
        <ReportBlock className="p-4 sm:p-5">
          <h3 className="text-lg font-bold text-[#1e2a5a] sm:text-xl">{situation.headline}</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{situation.intro}</p>
          {situation.problems.length > 0 ? (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {situation.problems.map((p) => (
                <div key={p.title} className={cn('rounded-lg border p-4', FINDING_TONE_CARD_CLASS[p.tone])}>
                  <div className="flex items-start gap-3">
                    <CleexsStatusIcon tone={p.tone} size="lg" className="shrink-0" />
                    <div>
                      <p className={cn('text-sm font-bold', FINDING_TONE_TITLE_CLASS[p.tone])}>{p.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-700 sm:text-sm">{p.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </ReportBlock>
      </section>

      <section>
        <PremiumSectionHeading
          num={sectionNum++}
          title="Cleexs Score por los 4 motores"
          subtitle="Visibilidad en ChatGPT, Gemini, Claude y Perplexity — desbloqueado en tu plan."
        />
        <ReportBlock className="p-4 sm:p-5">
          <CleexsEngineScoresPanel
            engines={data.engines}
            subtitle="Scores por motor según tu diagnóstico y corridas disponibles."
          />
        </ReportBlock>
      </section>

      <section>
        <PremiumSectionHeading
          num={sectionNum++}
          title="Oportunidades priorizadas"
          subtitle={`${data.totalOpportunities} oportunidades ordenadas por impacto, esfuerzo y prioridad.`}
        />
        <div className="grid gap-3 md:grid-cols-2">
          {data.opportunities.map((op, idx) => (
            <ReportBlock key={`${op.title}-${idx}`} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-start gap-2 text-sm font-semibold text-slate-900">
                  <span className="mt-0.5 inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-bold tabular-nums text-violet-700">
                    {idx + 1}
                  </span>
                  <span className="min-w-0">{op.title}</span>
                </p>
                <Badge tone="violet">Prio {op.priority}</Badge>
              </div>
              {op.scenario ? (
                <p className="mt-1.5 pl-7 text-xs italic leading-relaxed text-slate-500">“{op.scenario}”</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 pl-7">
                <Badge tone={op.impact === 'Alto' ? 'rose' : op.impact === 'Medio' ? 'amber' : 'emerald'}>
                  Impacto {op.impact}
                </Badge>
                <Badge tone={op.effort === 'Bajo' ? 'emerald' : 'amber'}>Esfuerzo {op.effort}</Badge>
                <Badge>Score {op.score}</Badge>
              </div>
              <p className="mt-2 pl-7 text-sm leading-relaxed text-slate-600">{op.action}</p>
            </ReportBlock>
          ))}
        </div>
      </section>

      {data.crawlerAccess ? (
        <section>
          <PremiumSectionHeading
            num={sectionNum++}
            title="Acceso de crawlers de IA"
            subtitle="¿Los bots de ChatGPT y otros motores pueden rastrear tu sitio?"
          />
          <ReportBlock className="p-4 sm:p-5">
            <CrawlerAccessPlanSection report={data.crawlerAccess} siteUrl={data.siteUrl ?? undefined} />
          </ReportBlock>
        </section>
      ) : null}

      {showDomainRatingPanel(data.domainRating) && data.domainRating ? (
        <section>
          <PremiumSectionHeading
            num={sectionNum++}
            title="Autoridad del dominio (SEO)"
            subtitle="Domain Rating vs competidores — complemento al score en IA."
          />
          <ReportBlock className="p-4 sm:p-5">
            <DomainRatingPanel data={data.domainRating} />
          </ReportBlock>
        </section>
      ) : null}

      <section>
        <PremiumSectionHeading
          num={sectionNum++}
          title="Mapa de ejecución"
          subtitle="Dónde enfocar primero según el score de cada consulta."
        />
        <ReportBlock className="p-4 sm:p-5">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200/90 bg-white p-4">
              <div className="mb-4 flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-violet-600" />
                <p className="text-sm font-bold text-slate-900">Dónde enfocar</p>
              </div>
              <div className="space-y-3">
                {[
                  { title: 'Mejorar ahora', hint: 'menor score = más margen', tone: 'rose' as const, items: data.improveNow },
                  { title: 'Defender', hint: 'mayor score = ya ganás', tone: 'emerald' as const, items: data.defendNow },
                ].map((group) => (
                  <div key={group.title} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{group.title}</h4>
                        <p className="text-xs text-slate-500">{group.hint}</p>
                      </div>
                      <Badge tone={group.tone}>{group.items.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {group.items.map((item, i) => (
                        <div
                          key={`${group.title}-${i}`}
                          className="flex items-center justify-between gap-4 rounded-lg bg-white px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-100"
                        >
                          <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold tabular-nums text-slate-600">
                            {item.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-violet-600" />
                <p className="text-sm font-bold text-slate-900">Autoridad externa (sugerida)</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.externalAuthority.map((ch) => (
                  <div key={ch.name} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-sm font-semibold text-slate-900">{ch.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{ch.goal}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ReportBlock>
      </section>

      <section>
        <PremiumSectionHeading
          num={sectionNum++}
          title="Plan de acción inmediato"
          subtitle="Tres bloques concretos: qué hacer primero, esta semana y el siguiente paso."
        />
        <div className="space-y-2.5">
          {data.roadmap.map((phase) => (
            <ReportBlock key={phase.range} className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
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
                      className="inline-flex max-w-full items-start gap-1.5 rounded-lg bg-violet-50/80 px-3 py-1.5 text-xs leading-relaxed text-slate-700 ring-1 ring-violet-100"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" />
                      <span>{task}</span>
                    </span>
                  ))}
                </div>
              </div>
            </ReportBlock>
          ))}
        </div>
      </section>

      <section id="premium-plan-semanal">
        <PremiumSectionHeading
          num={sectionNum++}
          title="Plan de acción · 12 semanas"
          subtitle="Roadmap de implementación con revisión semanal de avances."
        />
        <PremiumWeeklyPlanPanel weeks={weeklyPlan} />
      </section>

      <section>
        <PremiumSectionHeading
          num={sectionNum++}
          title="Kit IA de implementación"
          subtitle="Prompts listos para copiar en ChatGPT o Claude."
        />
        <ReportBlock className="p-4 sm:p-5">
          <div className="space-y-3">
            {(implementationPrompts.length > 0
              ? implementationPrompts
              : [
                  { title: 'Convertir la prioridad #1 en página', source: `Basado en ${data.brandName}`, prompt: '…' },
                ]
            ).map((item) => (
              <div key={item.title} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-sm font-bold text-slate-900">{item.title}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500">{item.source}</p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-100">
                  {item.prompt}
                </p>
              </div>
            ))}
          </div>
        </ReportBlock>
      </section>

      <section>
        <PremiumSectionHeading
          num={sectionNum++}
          title="Checklist de implementación"
          subtitle="Guía operativa para ejecutar sin perder tiempo."
        />
        <ReportBlock className="p-4 sm:p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => (
              <div key={item} className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </ReportBlock>
      </section>
    </div>
  );
}

export type { EngineCardKey, EngineCardState };
