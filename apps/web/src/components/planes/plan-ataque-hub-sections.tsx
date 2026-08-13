'use client';

import { useState } from 'react';
import {
  Bot,
  CheckSquare,
  Copy,
  Crosshair,
  ExternalLink,
  Gauge,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { BrandAccent } from '@/lib/brand-accent-from-logo';
import type { PlanAtaqueDocument } from '@/lib/plan-ataque-document';
import { SatelliteModuleCard } from '@/components/diagnostico/satellite-aeo-report';
import { CrawlerAccessPlanSection } from '@/components/diagnostico/crawler-access-plan-section';
import { CLEEXS_TOOLS_PUBLIC_URL } from '@/lib/site';

function HubPage({
  accent,
  eyebrow,
  title,
  children,
}: {
  accent: BrandAccent;
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="min-h-[420px] space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {eyebrow ? (
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: accent.primary }}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      <div className="h-1.5 w-14 rounded-full" style={{ backgroundColor: accent.primary }} />
      <div className="space-y-4 text-sm leading-relaxed text-slate-700">{children}</div>
    </article>
  );
}

function CopyPromptButton({ text, accent }: { text: string; accent: BrandAccent }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white"
      style={{ backgroundColor: accent.primary }}
    >
      <Copy className="h-3.5 w-3.5" />
      {copied ? 'Copiado' : 'Copiar prompt'}
    </button>
  );
}

function WeekChecklist({
  tasks,
  accent,
}: {
  tasks: string[];
  accent: BrandAccent;
}) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  return (
    <ul className="space-y-2">
      {tasks.map((task, i) => {
        const checked = Boolean(done[i]);
        return (
          <li key={`${i}-${task.slice(0, 24)}`}>
            <button
              type="button"
              onClick={() => setDone((prev) => ({ ...prev, [i]: !prev[i] }))}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left hover:bg-white"
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold"
                style={
                  checked
                    ? { backgroundColor: accent.primary, borderColor: accent.primary, color: '#fff' }
                    : { borderColor: '#cbd5e1', color: 'transparent' }
                }
              >
                ✓
              </span>
              <span className={checked ? 'text-sm text-slate-400 line-through' : 'text-sm text-slate-800'}>
                {task}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function PlanAtaqueHubSections({
  doc,
  sectionId,
  accent,
  unlocked,
  onNavigate,
}: {
  doc: PlanAtaqueDocument;
  sectionId: string;
  accent: BrandAccent;
  unlocked: boolean;
  onNavigate: (id: string) => void;
}) {
  const {
    ctx,
    immediatePlan,
    satelliteModule,
    crawlerAccess,
    satelliteActions,
    siteUrl,
    teaser,
    improveNow,
    lostQuestions,
  } = doc;

  const weekTasks =
    immediatePlan[0]?.tasks?.length || immediatePlan[1]?.tasks?.length
      ? [...(immediatePlan[0]?.tasks ?? []), ...(immediatePlan[1]?.tasks ?? [])]
      : ctx.topActions.slice(0, 6);

  const prompts = (teaser?.implementationPrompts ?? []).filter((p) => p.prompt);
  const toolkitUrl = CLEEXS_TOOLS_PUBLIC_URL
    ? `${CLEEXS_TOOLS_PUBLIC_URL.replace(/\/$/, '')}/?url=${encodeURIComponent(siteUrl)}`
    : null;

  if (sectionId === 'panel') {
    return (
      <HubPage accent={accent} eyebrow="Hub" title={`Gestión del plan · ${ctx.brandName}`}>
        <p>
          Acá no es solo el documento: es tu centro para <strong>entender</strong>,{' '}
          <strong>priorizar</strong> y <strong>ejecutar</strong> el plan de acción con datos del
          diagnóstico.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              id: 'esta-semana',
              Icon: CheckSquare,
              title: 'Esta semana',
              desc: `${weekTasks.length} tareas priorizadas para arrancar ya`,
            },
            {
              id: 'satelite',
              Icon: Gauge,
              title: 'Análisis AEO',
              desc:
                satelliteModule && satelliteModule.status !== 'pending'
                  ? `Score técnico ${Math.round(satelliteModule.overallScore)}/100 · ${satelliteActions.length} acciones`
                  : 'Auditoría técnica de visibilidad en IA',
            },
            {
              id: 'crawlers',
              Icon: Bot,
              title: 'Crawlers & robots',
              desc: crawlerAccess
                ? `${crawlerAccess.bots.filter((b) => b.allowed).length}/${crawlerAccess.bots.length} bots OK · robots.txt listo`
                : 'Acceso de bots de ChatGPT, Gemini y Perplexity',
            },
            {
              id: 'kit',
              Icon: Sparkles,
              title: 'Kit IA',
              desc: `${prompts.length || doc.suggestedContent.length} prompts para ejecutar en ChatGPT/Claude`,
            },
            {
              id: 'prioridad',
              Icon: Crosshair,
              title: 'Prioridad #1',
              desc: immediatePlan[0]?.theme || 'Primera acción del diagnóstico',
            },
            {
              id: 'plan90',
              Icon: Wrench,
              title: 'Plan 90 días',
              desc: 'Roadmap completo por fases',
            },
          ].map(({ id, Icon, title, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <Icon className="h-5 w-5" style={{ color: accent.primary }} />
              <p className="mt-2 font-semibold text-slate-900">{title}</p>
              <p className="mt-1 text-xs text-slate-600">{desc}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Resumen rápido</p>
          <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            <li>Cleexs Score: <strong>{ctx.cleexsScore != null ? `${ctx.cleexsScore}/100` : '—'}</strong></li>
            <li>Oportunidades: <strong>{ctx.opportunityCount ?? lostQuestions.length}</strong></li>
            <li>Competidores: <strong>{ctx.competitors.length}</strong></li>
            <li>Mejorar primero: <strong>{improveNow[0]?.label?.slice(0, 48) || '—'}</strong></li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('comparacion')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Comparación
          </button>
          <button
            type="button"
            onClick={() => onNavigate('competidores')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Competidores
          </button>
          <button
            type="button"
            onClick={() => onNavigate('kit')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            Prompts
          </button>
          {toolkitUrl ? (
            <a
              href={toolkitUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: accent.primary }}
            >
              Abrir AEO ToolKit <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>

        {!unlocked ? (
          <p className="text-xs text-amber-800">
            Vista borrador: el hub completo se desbloquea con Plan Conquistar.
          </p>
        ) : null}
      </HubPage>
    );
  }

  if (sectionId === 'esta-semana') {
    return (
      <HubPage accent={accent} eyebrow="Ejecución" title="Checklist de esta semana">
        <p>
          Marcá avance sobre las acciones inmediatas. Esto te ayuda a gestionar el plan sin perder el
          foco.
        </p>
        <WeekChecklist tasks={weekTasks} accent={accent} />
        {satelliteActions.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              Fixes técnicos sugeridos (Análisis AEO)
            </p>
            <ul className="mt-2 space-y-2">
              {satelliteActions.slice(0, 4).map((a, i) => (
                <li key={`${i}-${a.message}`} className="text-sm text-slate-800">
                  <span className="font-semibold">{a.priority}: </span>
                  {a.action || a.message}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onNavigate('satelite')}
              className="mt-3 text-xs font-semibold underline"
              style={{ color: accent.primary }}
            >
              Ver Análisis AEO completo →
            </button>
          </div>
        ) : null}
      </HubPage>
    );
  }

  if (sectionId === 'satelite') {
    return (
      <HubPage accent={accent} eyebrow="Técnico" title="Análisis AEO · auditoría del sitio">
        <p>
          Resultado del Análisis AEO sobre <strong>{siteUrl}</strong>: crawlability, schema,
          presencia en IA, freshness y más. Usalo para entender qué bloquea o potencia tu plan.
        </p>
        {satelliteModule && satelliteModule.status !== 'pending' ? (
          <div className="-mx-1">
            <SatelliteModuleCard module={satelliteModule} siteUrl={siteUrl} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Todavía no hay resultado de Análisis AEO en este diagnóstico. Cuando exista, aparece acá con
            score por herramienta y acciones concretas.
          </div>
        )}
        {satelliteActions.length > 0 ? (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Acciones técnicas priorizadas
            </p>
            <ol className="mt-2 space-y-2">
              {satelliteActions.map((a, i) => (
                <li key={`${i}-${a.message}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-900">
                    {i + 1}. [{a.priority}] {a.source}
                  </p>
                  <p className="mt-0.5 text-slate-700">{a.action || a.message}</p>
                  {a.detail ? <p className="mt-1 text-xs text-slate-500">{a.detail}</p> : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {toolkitUrl ? (
          <a
            href={toolkitUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: accent.primary }}
          >
            Generar / abrir en AEO ToolKit <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </HubPage>
    );
  }

  if (sectionId === 'crawlers') {
    return (
      <HubPage accent={accent} eyebrow="Acceso IA" title="Crawlers & robots.txt">
        <p>
          Si los bots de las IAs no pueden leer tu sitio, el plan de contenido pierde impacto. Acá
          ves el estado y el robots recomendado para copiar.
        </p>
        {crawlerAccess ? (
          <CrawlerAccessPlanSection report={crawlerAccess} siteUrl={siteUrl} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            No hay informe de crawlers en este diagnóstico. Suele venir del Análisis AEO
            (robots & sitemap).
          </div>
        )}
      </HubPage>
    );
  }

  if (sectionId === 'kit') {
    return (
      <HubPage accent={accent} eyebrow="Implementación" title="Kit IA · prompts listos">
        <p>
          Copiá estos prompts a ChatGPT o Claude para ejecutar piezas del plan (páginas,
          comparativas, FAQs) con el contexto de tu diagnóstico.
        </p>
        {prompts.length > 0 ? (
          <ul className="space-y-3">
            {prompts.map((p, i) => (
              <li key={`${i}-${p.title}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {i + 1}. {p.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{p.source}</p>
                  </div>
                  <CopyPromptButton text={p.prompt} accent={accent} />
                </div>
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                  {p.prompt}
                </pre>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {doc.suggestedContent.map((item, i) => (
              <li key={`${i}-${item.title}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {i + 1}. {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  </div>
                  {item.prompt ? <CopyPromptButton text={item.prompt} accent={accent} /> : null}
                </div>
                {item.prompt ? (
                  <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                    {item.prompt}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </HubPage>
    );
  }

  return null;
}
