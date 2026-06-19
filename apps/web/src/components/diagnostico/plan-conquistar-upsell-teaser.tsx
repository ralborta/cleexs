'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Crown,
  ExternalLink,
  Flag,
  Layers3,
  Lightbulb,
  Lock,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CrawlerAccessReport } from '@/lib/crawler-access';
import type { DomainRatingSnapshot } from '@/lib/api';
import { CrawlerAccessPlanSection } from '@/components/diagnostico/crawler-access-plan-section';
import { DomainRatingPanel } from '@/components/report/domain-rating-block';
import { PlanConquistarCheckoutButton } from '@/components/planes/plan-conquistar-checkout-button';

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

type ImplementationPrompt = {
  title: string;
  source: string;
  prompt: string;
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
  domainRating?: DomainRatingSnapshot | null;
  siteUrl?: string | null;
  implementationPrompts?: ImplementationPrompt[];
};

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

const MODAL_FEATURES = [
  { title: 'Score por los 4 motores', desc: 'ChatGPT, Gemini, Claude y Perplexity en una sola lectura.' },
  { title: 'Oportunidades priorizadas', desc: 'Ordenadas por impacto, esfuerzo y prioridad.' },
  { title: 'Plan de acción inmediato', desc: 'Qué hacer primero según tu diagnóstico.' },
  { title: 'Kit IA de implementación', desc: 'Prompts accionables para ejecutar el plan.' },
  { title: 'Premium incluido', desc: 'Acceso al portal durante la implementación.' },
] as const;

function money(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function showDomainRatingPanel(domainRating?: DomainRatingSnapshot | null) {
  if (!domainRating) return false;
  return (
    domainRating.brand.rating != null || domainRating.competitors.some((c) => c.rating != null)
  );
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
              {MODAL_FEATURES.map(({ title, desc }) => (
                <li key={title} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                    <Sparkles className="h-5 w-5 text-violet-700" />
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
                <PlanConquistarCheckoutButton
                  variant="compact"
                  sourceChannel="ver_resultado_upsell_modal"
                  className="w-full sm:w-auto"
                />
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

// ── Sección bloqueada (continúa numeración desde el punto 7 del reporte free) ──

function LockedSectionHeading({
  num,
  title,
  subtitle,
  onUnlock,
}: {
  num: number;
  title: string;
  subtitle?: string;
  onUnlock: () => void;
}) {
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] font-bold text-white shadow shadow-violet-500/20">
            {num}
          </span>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {title}
              <button
                type="button"
                onClick={onUnlock}
                aria-label={`Desbloquear ${title}`}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700 transition hover:bg-violet-200"
              >
                <Lock className="h-3.5 w-3.5" />
              </button>
            </h2>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <LockedSectionHeading num={num} title={title} subtitle={subtitle} onUnlock={onUnlock} />
      <div className="relative">
        <div className="overflow-hidden" style={{ maxHeight: previewMaxH }}>
          {children}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/85 to-transparent" />
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

function EconomicScenarioPreview() {
  const monthlyVisits = 1000;
  const conversionRate = 2;
  const leadValue = 250;
  const visibilityLift = 10;
  const estimatedExtraRevenue = monthlyVisits * (conversionRate / 100) * leadValue * (visibilityLift / 100);
  const estimatedAnnualRevenue = estimatedExtraRevenue * 12;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
      <p className="mb-3 text-xs leading-relaxed text-slate-600">
        Completá con datos reales del cliente si los tenés. El resultado es{' '}
        <strong className="font-semibold text-slate-800">visitas × conversión × valor × mejora de visibilidad</strong> — una
        hipótesis de leads o ingreso incremental, no un compromiso de Cleexs.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Visitas mensuales estimadas', value: monthlyVisits, suffix: '' },
          { label: 'Conversión a lead (%)', value: conversionRate, suffix: '%' },
          { label: 'Valor promedio por lead (USD)', value: leadValue, suffix: 'USD' },
          { label: 'Mejora de visibilidad esperada (%)', value: visibilityLift, suffix: '%' },
        ].map((field) => (
          <div key={field.label} className="block rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <span className="text-xs font-semibold text-slate-500">{field.label}</span>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900">
                {field.value}
              </div>
              {field.suffix ? <span className="text-xs font-semibold text-slate-400">{field.suffix}</span> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hipótesis mensual</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{money(estimatedExtraRevenue)} / mes</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {money(estimatedAnnualRevenue)} al año si se cumplen los supuestos ({monthlyVisits} visitas · {conversionRate}%
          conv. · {visibilityLift}% mejora visibilidad).
        </p>
      </div>
    </div>
  );
}

// ── Continuación Plan Conquistar (secciones 8+) ────────────────────────────────

export function PlanConquistarUpsellTeaser({ data }: { data: PlanConquistarTeaserData }) {
  const [modalOpen, setModalOpen] = useState(false);
  const open = () => setModalOpen(true);
  const hiddenCount = Math.max(data.totalOpportunities - 3, 0);
  const implementationPrompts = data.implementationPrompts ?? [];
  const showDr = showDomainRatingPanel(data.domainRating);

  let sectionNum = 8;

  return (
    <div className="space-y-5 border-t border-violet-100 pt-5">
      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-bold text-violet-700 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              AI Visibility Accelerator · Plan Conquistar
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ya viste tu diagnóstico (puntos 1–7). Detectamos{' '}
              <strong>{data.totalOpportunities} oportunidades</strong> más en el plan completo — desbloqueá desde el punto{' '}
              {sectionNum} para ver el roadmap personalizado de {data.brandName}.
            </p>
          </div>
          <PlanConquistarCheckoutButton
            variant="compact"
            label="Desbloquear USD 99"
            sourceChannel="ver_resultado_upsell_banner"
            className="shrink-0"
          />
        </div>
      </div>

      {data.crawlerAccess ? (
        <LockedSection
          num={sectionNum++}
          title="Acceso de crawlers de IA"
          subtitle="¿ChatGPT y otros motores pueden rastrear tu sitio? Revisión de robots.txt, bots clave y checklist de verificación."
          previewMaxH={320}
          onUnlock={open}
        >
          <CrawlerAccessPlanSection report={data.crawlerAccess} siteUrl={data.siteUrl ?? undefined} />
        </LockedSection>
      ) : null}

      {showDr && data.domainRating ? (
        <LockedSection
          num={sectionNum++}
          title="Autoridad del dominio (SEO)"
          subtitle="Domain Rating (Ahrefs) de tu dominio vs competidores. Mide autoridad por backlinks; no es lo mismo que tu Cleexs Score en IA."
          previewMaxH={280}
          onUnlock={open}
        >
          <DomainRatingPanel data={data.domainRating} />
        </LockedSection>
      ) : null}

      <LockedSection
        num={sectionNum++}
        title="Oportunidades priorizadas"
        subtitle={`Te mostramos 3 de ${data.totalOpportunities}. Ordenadas por prioridad (mayor a menor).`}
        previewMaxH={380}
        onUnlock={open}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {data.opportunities.map((op, idx) => (
            <div key={`${op.title}-${idx}`} className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
              <div className="flex items-start justify-between gap-3">
                <p className="flex min-w-0 items-start gap-2 text-sm font-semibold text-slate-900">
                  <span className="mt-0.5 inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-bold tabular-nums text-violet-700">
                    {idx + 1}
                  </span>
                  <span className="min-w-0">{op.title}</span>
                </p>
                <span className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">
                  Prioridad {op.priority}
                </span>
              </div>
              {op.scenario ? (
                <p className="mt-1.5 pl-7 text-xs italic leading-relaxed text-slate-500">“{op.scenario}”</p>
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

      <LockedSection
        num={sectionNum++}
        title="Mapa de ejecución"
        subtitle="Dónde enfocar primero según el score real de cada consulta y qué señales externas reforzar (sugeridas)."
        previewMaxH={300}
        onUnlock={open}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
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
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
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
      </LockedSection>

      <LockedSection
        num={sectionNum++}
        title="Plan de acción inmediato"
        subtitle="Tres bloques concretos basados en esta corrida: qué hacer primero, esta semana y el siguiente paso."
        previewMaxH={260}
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
                    className="inline-flex max-w-full items-start gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-100"
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

      <LockedSection
        num={sectionNum++}
        title="Escenario económico (hipótesis)"
        subtitle="Calculadora con supuestos editables. Úsala para conversar con el cliente; no es proyección garantizada."
        previewMaxH={260}
        onUnlock={open}
      >
        <EconomicScenarioPreview />
      </LockedSection>

      <LockedSection
        num={sectionNum++}
        title="Kit IA de implementación"
        subtitle="Prompts listos para copiar en ChatGPT o Claude, basados en los datos de esta corrida."
        previewMaxH={280}
        onUnlock={open}
      >
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-100/60">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-violet-600" />
            <p className="text-sm font-bold text-slate-900">Prompts personalizados</p>
          </div>
          <div className="space-y-3">
            {(implementationPrompts.length > 0
              ? implementationPrompts
              : [
                  { title: 'Convertir la prioridad #1 en página', source: `Basado en ${data.brandName}`, prompt: '…' },
                  { title: 'Cerrar brecha contra competidor', source: 'Basado en el competidor principal', prompt: '…' },
                  { title: 'Tareas concretas de esta semana', source: 'Basado en las prioridades del reporte', prompt: '…' },
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
        </div>
      </LockedSection>

      <LockedSection
        num={sectionNum++}
        title="Checklist de implementación"
        subtitle="Guía operativa para ejecutar el plan sin perder tiempo."
        previewMaxH={220}
        onUnlock={open}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item} className="flex gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </LockedSection>

      <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/80 to-white px-4 py-5 text-center sm:px-5">
        <h3 className="text-lg font-black tracking-tight text-slate-950">Desbloqueá tu informe completo</h3>
        <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
          {hiddenCount > 0
            ? `Incluye ${hiddenCount} oportunidades más, plan de acción, Kit IA y checklist. `
            : null}
          Pago único de USD 99 · Reporte Premium + plan de acción incluido.
        </p>
          <PlanConquistarCheckoutButton
            variant="compact"
            sourceChannel="ver_resultado_upsell"
            className="mt-4"
          />
      </div>

      <PlanConquistarPaywallModal
        open={modalOpen}
        brandName={data.brandName}
        totalOpportunities={data.totalOpportunities}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
