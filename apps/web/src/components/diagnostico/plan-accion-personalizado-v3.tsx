'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Layers3,
  LayoutGrid,
  Rocket,
  Shield,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PersonalizedActionPlanV3,
  PlanAction,
  PlanPhase,
  PlanPhaseId,
} from '@/lib/diagnostico-premium-v3-data';
import { getActionsForWeek, getPhaseForWeek } from '@/lib/diagnostico-premium-v3-data';

type ViewMode = 'weeks' | 'timeline';

const PHASE_ICON: Record<PlanPhaseId, typeof Shield> = {
  fundamentos: Shield,
  optimizacion: TrendingUp,
  autoridad: BarChart3,
  escalamiento: Rocket,
};

const PHASE_ACCENT: Record<PlanPhase['accent'], { bar: string; pill: string; text: string; ring: string; bg: string }> = {
  blue: {
    bar: 'bg-blue-600',
    pill: 'bg-blue-50 text-blue-700 ring-blue-100',
    text: 'text-blue-700',
    ring: 'ring-blue-200',
    bg: 'bg-blue-600',
  },
  purple: {
    bar: 'bg-violet-600',
    pill: 'bg-violet-50 text-violet-700 ring-violet-100',
    text: 'text-violet-700',
    ring: 'ring-violet-200',
    bg: 'bg-violet-600',
  },
  indigo: {
    bar: 'bg-indigo-600',
    pill: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    text: 'text-indigo-700',
    ring: 'ring-indigo-200',
    bg: 'bg-indigo-600',
  },
  cyan: {
    bar: 'bg-cyan-600',
    pill: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
    text: 'text-cyan-700',
    ring: 'ring-cyan-200',
    bg: 'bg-cyan-600',
  },
};

function PriorityBadge({ priority }: { priority: PlanAction['priority'] }) {
  const tone =
    priority === 'alta'
      ? 'bg-rose-50 text-rose-700 ring-rose-100'
      : priority === 'media'
        ? 'bg-amber-50 text-amber-800 ring-amber-100'
        : 'bg-slate-100 text-slate-600 ring-slate-200';
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1', tone)}>
      Prioridad {priority}
    </span>
  );
}

function ImpactBadge({ impact }: { impact: PlanAction['impact'] }) {
  return (
    <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-100">
      Impacto {impact === 'Defensivo' ? 'moderado' : impact.toLowerCase()}
    </span>
  );
}

function EffortBadge({ effort }: { effort: PlanAction['effort'] }) {
  return (
    <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-800 ring-1 ring-cyan-100">
      Esfuerzo {effort.toLowerCase()}
    </span>
  );
}

function ActionAccordion({
  action,
  week,
  defaultOpen,
  done,
  onToggleDone,
}: {
  action: PlanAction;
  week: number;
  defaultOpen?: boolean;
  done: boolean;
  onToggleDone: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const weekRole = action.weekRoles[week];

  return (
    <div className={cn('rounded-xl border bg-white', done ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left sm:p-5"
      >
        <ChevronDown className={cn('mt-1 h-5 w-5 shrink-0 text-slate-400 transition', open && 'rotate-180')} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-[#1e2a5a] sm:text-base">{action.title}</p>
            {weekRole ? (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                {weekRole}
              </span>
            ) : null}
            {action.weekEnd > action.weekStart ? (
              <span className="text-[10px] font-medium text-slate-400">
                S{action.weekStart}–S{action.weekEnd}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <PriorityBadge priority={action.priority} />
            <ImpactBadge impact={action.impact} />
            <EffortBadge effort={action.effort} />
          </div>
          {action.statusNote ? (
            <p className="mt-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Estado actual:</span> {action.statusNote}
            </p>
          ) : null}
        </div>
        {done ? <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-500" /> : null}
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailBlock title="Qué detectamos" body={action.detected} />
            <DetailBlock title="Por qué importa" body={action.whyItMatters} />
            <DetailBlock title="Acción recomendada" body={action.recommendedAction} className="sm:col-span-2" />
            <DetailBlock title="Entregable" body={action.deliverable} />
            <DetailBlock title="Responsable sugerido" body={action.owner} />
            <DetailBlock title="Indicador de éxito" body={action.successIndicator} />
            <DetailBlock title="Relación con el diagnóstico" body={action.diagnosticLink} />
          </div>

          {action.cleexsCanImplement ? (
            <div className="mt-4 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50 px-4 py-3">
              <p className="text-sm font-semibold text-blue-900">Cleexs puede implementarlo por vos</p>
              <p className="mt-1 text-xs leading-relaxed text-blue-800/80">
                Delegá la ejecución técnica o de contenido y ahorrá tiempo del equipo interno.
              </p>
              <button
                type="button"
                className="mt-3 inline-flex rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Consultar implementación →
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              className="inline-flex rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Ver instrucciones
            </button>
            <button
              type="button"
              onClick={onToggleDone}
              className={cn(
                'inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white',
                done ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500',
              )}
            >
              {done ? 'Marcada como realizada' : 'Marcar como realizada'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailBlock({ title, body, className }: { title: string; body: string; className?: string }) {
  return (
    <div className={cn('rounded-lg bg-slate-50/80 p-3 ring-1 ring-slate-100', className)}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{body}</p>
    </div>
  );
}

function WeekTimelineBar({
  plan,
  selectedWeek,
  completedWeeks,
  onSelectWeek,
}: {
  plan: PersonalizedActionPlanV3;
  selectedWeek: number;
  completedWeeks: number[];
  onSelectWeek: (week: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 sm:gap-2 sm:p-2">
        {plan.phases.map((phase) => {
          const Icon = PHASE_ICON[phase.id];
          const accent = PHASE_ACCENT[phase.accent];
          const active = selectedWeek >= phase.weekStart && selectedWeek <= phase.weekEnd;
          return (
            <div
              key={phase.id}
              className={cn(
                'rounded-lg px-2 py-2 sm:px-3 sm:py-2.5',
                active ? cn('ring-2', accent.ring, 'bg-white') : 'bg-slate-50/80',
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={cn('h-3.5 w-3.5', active ? accent.text : 'text-slate-400')} />
                <p className={cn('text-[11px] font-bold sm:text-xs', active ? accent.text : 'text-slate-700')}>
                  {phase.name}
                </p>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">{phase.shortLabel}</p>
            </div>
          );
        })}
      </div>

      <div className="relative px-1">
        <div className="absolute left-4 right-4 top-1/2 hidden h-0.5 -translate-y-1/2 bg-slate-200 sm:block" aria-hidden />
        <div className="flex gap-1 overflow-x-auto pb-1 sm:justify-between sm:gap-0 sm:overflow-visible">
          {plan.weeks.map((w) => {
            const done = completedWeeks.includes(w.week);
            const active = selectedWeek === w.week;
            const phase = getPhaseForWeek(plan, w.week);
            const accent = PHASE_ACCENT[phase.accent];
            return (
              <div key={w.week} className="relative flex shrink-0 flex-col items-center sm:flex-1">
                <button
                  type="button"
                  onClick={() => onSelectWeek(w.week)}
                  className={cn(
                    'relative z-[1] flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition sm:h-10 sm:w-10',
                    done
                      ? 'bg-blue-600 text-white'
                      : active
                        ? cn(accent.bg, 'text-white shadow-md ring-4 ring-blue-100')
                        : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:ring-blue-200',
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : w.week}
                </button>
                <span className={cn('mt-1.5 text-[10px] font-semibold', active ? 'text-blue-700' : 'text-slate-400')}>
                  S{w.week}
                </span>
                {active ? (
                  <span className="mt-1 hidden h-0 w-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-blue-600 sm:block" />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GanttView({ plan, selectedWeek }: { plan: PersonalizedActionPlanV3; selectedWeek: number }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <p className="mb-4 text-sm font-bold text-[#1e2a5a]">Vista de cronograma (resumen)</p>
        <div className="min-w-[720px]">
          <div className="mb-2 grid grid-cols-[minmax(160px,1.4fr)_repeat(12,minmax(28px,1fr))] gap-1 text-[10px] font-semibold text-slate-400">
            <span>Acción</span>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className={cn('text-center', selectedWeek === i + 1 && 'text-blue-600')}>
                {i + 1}
              </span>
            ))}
          </div>
          {plan.actions.map((action) => (
            <div
              key={action.id}
              className="mb-2 grid grid-cols-[minmax(160px,1.4fr)_repeat(12,minmax(28px,1fr))] items-center gap-1"
            >
              <span className="truncate pr-2 text-xs font-medium text-slate-700">{action.title}</span>
              {action.ganttWeeks.map((active, idx) => (
                <div key={idx} className="flex h-7 items-center justify-center">
                  {active ? (
                    <span
                      className={cn(
                        'h-2.5 w-full max-w-[24px] rounded-full',
                        idx + 1 === selectedWeek ? 'bg-blue-600' : 'bg-blue-300',
                      )}
                    />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-slate-200" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {plan.phases.map((phase) => {
          const accent = PHASE_ACCENT[phase.accent];
          return (
            <div key={phase.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className={cn('mb-2 h-1.5 rounded-full', accent.bar)} />
              <p className="text-xs font-bold text-slate-800">{phase.name}</p>
              <p className="text-[10px] text-slate-500">
                Semanas {phase.weekStart}–{phase.weekEnd}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CronogramaPhaseCards({
  plan,
  selectedWeek,
  onSelectWeek,
}: {
  plan: PersonalizedActionPlanV3;
  selectedWeek: number;
  onSelectWeek: (week: number) => void;
}) {
  const phase = getPhaseForWeek(plan, selectedWeek);
  const weekActions = getActionsForWeek(plan, selectedWeek);
  const progressPct = Math.round((selectedWeek / 12) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
          <Calendar className="h-3.5 w-3.5" />
          Semana {selectedWeek} de 12
        </span>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="relative flex h-8 w-8 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15" fill="none" stroke="#e2e8f0" strokeWidth="3" />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                strokeDasharray={`${progressPct} 100`}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[10px] font-bold text-blue-700">{progressPct}%</span>
          </span>
          del plan
        </span>
      </div>

      <WeekTimelineBar
        plan={plan}
        selectedWeek={selectedWeek}
        completedWeeks={[]}
        onSelectWeek={onSelectWeek}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {plan.phases.map((p) => {
          const Icon = PHASE_ICON[p.id];
          const accent = PHASE_ACCENT[p.accent];
          const active = p.id === phase.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectWeek(p.weekStart)}
              className={cn(
                'rounded-xl border bg-white p-4 text-left transition hover:shadow-sm',
                active ? cn('border-blue-200 ring-2', accent.ring) : 'border-slate-200',
              )}
            >
              <div className={cn('mb-3 inline-flex rounded-lg p-2', accent.pill)}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold text-slate-900">{p.name}</p>
              <p className="text-xs text-slate-500">
                Semanas {p.weekStart}–{p.weekEnd}
              </p>
              <p className="mt-1 text-xs text-slate-600">{p.subtitle}</p>
              <div className={cn('mt-3 h-1 rounded-full', active ? accent.bar : 'bg-slate-100')} />
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-bold text-blue-900">
              Semana {selectedWeek} · {phase.name}
            </p>
            <p className="mt-1 text-xs text-blue-800/80">{weekActions.length} acciones planificadas</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {weekActions.slice(0, 3).map((a) => (
              <span
                key={a.id}
                className="inline-flex max-w-[180px] truncate rounded-full border border-white bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm"
              >
                {a.title}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onSelectWeek(selectedWeek)}
            className="inline-flex shrink-0 items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Ver acciones de la semana →
          </button>
        </div>
      </div>

      <GanttView plan={plan} selectedWeek={selectedWeek} />
    </div>
  );
}

export function PlanAccionPersonalizadoV3({ plan }: { plan: PersonalizedActionPlanV3 }) {
  const [view, setView] = useState<ViewMode>('weeks');
  const [selectedWeek, setSelectedWeek] = useState(3);
  const [doneActions, setDoneActions] = useState<Record<string, boolean>>({});

  const week = plan.weeks.find((w) => w.week === selectedWeek)!;
  const phase = getPhaseForWeek(plan, selectedWeek);
  const weekActions = useMemo(() => getActionsForWeek(plan, selectedWeek), [plan, selectedWeek]);

  const toggleDone = (id: string) => {
    setDoneActions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/40 ring-1 ring-slate-100">
      {/* Encabezado ejecutivo */}
      <div className="border-b border-slate-100 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#1e2a5a] sm:text-2xl">Plan de acción personalizado</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              12 semanas para corregir barreras, fortalecer autoridad y mejorar la presencia de la marca en motores de IA.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-xl">
            {[
              { icon: Calendar, label: `${plan.stats.weeks} semanas` },
              { icon: Layers3, label: `${plan.stats.phases} etapas` },
              { icon: CheckCircle2, label: `${plan.stats.actions} acciones` },
              { icon: AlertCircle, label: `${plan.stats.criticalAreas} áreas de mejora` },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5"
              >
                <Icon className="h-4 w-4 shrink-0 text-blue-600" />
                <span className="text-xs font-semibold text-slate-700">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-100 px-4 sm:px-6">
        <div className="flex gap-6">
          {[
            { id: 'weeks' as const, label: 'Por semanas', icon: LayoutGrid },
            { id: 'timeline' as const, label: 'Cronograma completo', icon: Calendar },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                'inline-flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition',
                view === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:p-6">
        <div className="min-w-0 space-y-5">
          {view === 'weeks' ? (
            <>
              <WeekTimelineBar
                plan={plan}
                selectedWeek={selectedWeek}
                completedWeeks={[]}
                onSelectWeek={setSelectedWeek}
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                      Semana {week.week} · {phase.name}
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-[#1e2a5a]">{week.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      <span className="font-semibold text-slate-700">Objetivo:</span> {week.objective}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {weekActions.length} acciones
                    </span>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-100">
                      Impacto {week.expectedImpact}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {weekActions.map((action, idx) => (
                  <ActionAccordion
                    key={`${action.id}-${selectedWeek}`}
                    action={action}
                    week={selectedWeek}
                    defaultOpen={idx === 0}
                    done={Boolean(doneActions[`${action.id}-${selectedWeek}`])}
                    onToggleDone={() => toggleDone(`${action.id}-${selectedWeek}`)}
                  />
                ))}
              </div>

              <GanttView plan={plan} selectedWeek={selectedWeek} />
            </>
          ) : (
            <CronogramaPhaseCards plan={plan} selectedWeek={selectedWeek} onSelectWeek={setSelectedWeek} />
          )}
        </div>

        {/* Sidebar resultado esperado */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-[#1e2a5a]">Resultado esperado</p>
            <p className="mt-1 text-xs text-slate-500">Proyección al completar esta fase del plan</p>
            <div className="mt-4 space-y-4">
              {plan.expectedResults.map((item) => {
                const barColor =
                  item.accent === 'blue' ? 'bg-blue-600' : item.accent === 'purple' ? 'bg-violet-600' : 'bg-cyan-500';
                return (
                  <div key={item.label}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="font-bold tabular-nums text-slate-900">{item.pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn('h-full rounded-full', barColor)} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-4">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div>
                <p className="text-sm font-bold text-blue-900">Cleexs puede implementarlo por vos</p>
                <p className="mt-1 text-xs leading-relaxed text-blue-800/85">
                  Delegá la ejecución y ahorrá tiempo. Ideal para acciones técnicas y de contenido prioritarias.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
