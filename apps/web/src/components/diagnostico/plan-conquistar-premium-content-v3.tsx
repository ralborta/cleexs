'use client';

import { type ReactNode } from 'react';
import {
  CheckCircle2,
  ExternalLink,
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
import type { PremiumSituationSummary } from '@/lib/diagnostico-premium-v2-data';
import type { PersonalizedActionPlanV3 } from '@/lib/diagnostico-premium-v3-data';
import { PlanAccionPersonalizadoV3 } from '@/components/diagnostico/plan-accion-personalizado-v3';
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

export function PlanConquistarPremiumContentV3({
  data,
  situation,
  actionPlan,
  startSectionNum = 6,
}: {
  data: PlanConquistarTeaserData;
  situation: PremiumSituationSummary;
  actionPlan: PersonalizedActionPlanV3;
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
          Informe completo para {data.brandName}: diagnóstico, oportunidades desbloqueadas y plan de acción interactivo v3
          (12 semanas · revisión semanal).
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

      <section id="premium-plan-v3">
        <PlanAccionPersonalizadoV3 plan={actionPlan} />
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
