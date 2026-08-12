'use client';

import type { BrandAccent } from '@/lib/brand-accent-from-logo';
import type { PlanAtaqueDocument } from '@/lib/plan-ataque-document';
import { BrandLogo } from '@/components/ui/brand-logo';
import { IndustryCoverWatermark } from '@/components/planes/industry-cover-watermark';
import { PlanAtaqueHubSections } from '@/components/planes/plan-ataque-hub-sections';
import { Calendar, Clock, Target, TrendingUp } from 'lucide-react';

function DocPage({
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
    <article className="min-h-[420px] rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {eyebrow ? (
        <p
          className="text-[11px] font-bold uppercase tracking-wide"
          style={{ color: accent.primary }}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
      <div className="mt-2 h-1.5 w-14 rounded-full" style={{ backgroundColor: accent.primary }} />
      <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-700">{children}</div>
    </article>
  );
}

export function PlanAtaqueSectionView({
  doc,
  sectionId,
  accent,
  logoUrl: _logoUrl,
  unlocked,
  today,
  onNavigate,
}: {
  doc: PlanAtaqueDocument;
  sectionId: string;
  accent: BrandAccent;
  logoUrl: string | null;
  unlocked: boolean;
  today: string;
  onNavigate: (id: string) => void;
}) {
  void _logoUrl;
  const {
    ctx,
    immediatePlan,
    roadmap,
    lostQuestions,
    suggestedContent,
    taskList,
    teaser,
    improveNow,
    defendNow,
    authorityChannels,
    courseModules,
  } = doc;

  const hub = (
    <PlanAtaqueHubSections
      doc={doc}
      sectionId={sectionId}
      accent={accent}
      unlocked={unlocked}
      onNavigate={onNavigate}
    />
  );
  if (hub) return hub;

  const enginesText =
    ctx.engines.length === 0
      ? 'ChatGPT'
      : ctx.engines.length <= 2
        ? ctx.engines.join(' y ')
        : `${ctx.engines.slice(0, -1).join(', ')} y ${ctx.engines[ctx.engines.length - 1]}`;

  const actions = ctx.opportunityCount;
  const hours =
    ctx.opportunityCount != null && ctx.opportunityCount > 0
      ? Math.max(6, Math.round(ctx.opportunityCount * 0.75))
      : null;
  const impact =
    (ctx.opportunityCount ?? 0) >= 20 || (ctx.cleexsScore != null && ctx.cleexsScore < 40)
      ? 'ALTO'
      : (ctx.opportunityCount ?? 0) >= 10 || (ctx.cleexsScore != null && ctx.cleexsScore < 60)
        ? 'MEDIO'
        : ctx.opportunityCount || ctx.cleexsScore != null
          ? 'MODERADO'
          : '—';

  if (sectionId === 'portada') {
    return (
      <div className="grid gap-3 md:grid-cols-[1.75fr_0.7fr_0.75fr]">
        <article className="relative flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm">
          <IndustryCoverWatermark
            industry={ctx.industry}
            domain={ctx.domain}
            brandName={ctx.brandName}
            accent={accent}
          />
          <div className="relative z-10 flex flex-col">
            <div className="mb-3 w-fit rounded-xl bg-white/90 p-1 shadow-sm backdrop-blur-[2px]">
              <BrandLogo
                name={ctx.brandName}
                domain={ctx.domain}
                size={96}
                variant="logo"
                hideIfMissing
                className="rounded-xl"
              />
            </div>
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Tu Plan de Ataque</h2>
            <div className="mt-2 h-1.5 w-14 rounded-full" style={{ backgroundColor: accent.primary }} />
            <p className="mt-3 text-xs leading-snug text-slate-700 sm:text-[13px]">
              Cómo conseguir más clientes desde {enginesText}{' '}
              <span className="font-semibold" style={{ color: accent.primary }}>
                en los próximos 90 días
              </span>
            </p>
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-[11px] text-slate-500">Preparado exclusivamente para</p>
              <p className="text-base font-bold" style={{ color: accent.primary }}>
                {ctx.domain}
              </p>
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                { Icon: Calendar, t: `Generado el: ${today}` },
                {
                  Icon: Target,
                  t: actions != null ? `${actions} acciones priorizadas` : 'Acciones a confirmar',
                },
                {
                  Icon: Clock,
                  t: hours != null ? `${hours} horas estimadas` : 'Horas a estimar',
                },
                { Icon: TrendingUp, t: `Impacto esperado: ${impact}` },
              ].map(({ Icon, t }) => (
                <div key={t} className="flex items-center gap-2 text-[11px] text-slate-600">
                  <Icon className="h-3.5 w-3.5" style={{ color: accent.primary }} />
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative z-10 mt-auto border-t border-slate-100 pt-3 text-[11px] leading-snug text-slate-500">
            {[
              ctx.country ? `Mercado: ${ctx.country}` : null,
              ctx.industry ? ctx.industry : null,
              ctx.cleexsScore != null ? `Cleexs Score ${ctx.cleexsScore}` : null,
              ctx.competitors.length ? `${ctx.competitors.length} competidores` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Plan personalizado Cleexs'}
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2
            className="text-center text-sm font-bold uppercase tracking-wide"
            style={{ color: accent.primary }}
          >
            Índice
          </h2>
          <ol className="mt-3 space-y-2">
            {doc.nav
              .filter((n) => n.id !== 'portada' && n.id !== 'indice')
              .map((item, i) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    className="flex w-full gap-2 text-left text-xs text-slate-600 hover:text-slate-900"
                  >
                    <span className="font-semibold" style={{ color: accent.primary }}>
                      {i + 1}.
                    </span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
          </ol>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p
            className="text-[11px] font-bold uppercase tracking-wide"
            style={{ color: accent.primary }}
          >
            Prioridad #1
          </p>
          <h2 className="mt-1 text-sm font-bold text-slate-900">
            {immediatePlan[0]?.theme || 'Primeras acciones'}
          </h2>
          <div className="mt-2 h-1 w-10 rounded-full" style={{ backgroundColor: accent.primary }} />
          <ol className="mt-3 space-y-2.5">
            {(immediatePlan[0]?.tasks ?? ctx.topActions.slice(0, 4)).map((q, i) => (
              <li key={`${i}-${q.slice(0, 24)}`} className="flex gap-2 text-xs text-slate-700">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: accent.primary }}
                >
                  {i + 1}
                </span>
                <span className="leading-snug">{q}</span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => onNavigate('prioridad')}
            className="mt-4 text-[11px] font-semibold underline"
            style={{ color: accent.primary }}
          >
            Ver prioridad completa →
          </button>
        </article>
      </div>
    );
  }

  if (sectionId === 'indice') {
    return (
      <DocPage accent={accent} eyebrow="Documento" title="Índice del Plan de Ataque">
        <p>
          Este plan está armado con el diagnóstico de <strong>{ctx.brandName}</strong> ({ctx.domain}
          ). Usá el menú para recorrer cada sección.
        </p>
        <ol className="space-y-3">
          {doc.nav
            .filter((n) => n.id !== 'indice')
            .map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className="flex w-full items-baseline gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-left hover:border-slate-200 hover:bg-white"
                >
                  <span className="text-sm font-bold" style={{ color: accent.primary }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="font-semibold text-slate-900">{item.label}</span>
                </button>
              </li>
            ))}
        </ol>
      </DocPage>
    );
  }

  if (sectionId === 'prioridad') {
    const phase = immediatePlan[0];
    return (
      <DocPage accent={accent} eyebrow="Prioridad #1" title={phase?.theme || 'Qué hacer primero'}>
        {phase?.evidence ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Evidencia: {phase.evidence}
          </p>
        ) : null}
        <ol className="space-y-3">
          {(phase?.tasks ?? ctx.topActions).map((task, i) => (
            <li
              key={`${i}-${task.slice(0, 20)}`}
              className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: accent.primary }}
              >
                {i + 1}
              </span>
              <p className="font-medium text-slate-900">{task}</p>
            </li>
          ))}
        </ol>
        {improveNow.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Mejorar primero (menor score)
            </p>
            <ul className="mt-2 space-y-2">
              {improveNow.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-800">{item.label}</span>
                  <span className="shrink-0 font-bold" style={{ color: accent.primary }}>
                    {item.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {teaser?.opportunities?.[0] ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Oportunidad origen
            </p>
            <p className="mt-1 font-semibold text-slate-900">{teaser.opportunities[0].title}</p>
            <p className="mt-1 text-xs text-slate-600">
              Score {teaser.opportunities[0].score}/100 · Prioridad {teaser.opportunities[0].priority}{' '}
              · {teaser.opportunities[0].intention}
            </p>
            {teaser.opportunities[0].scenario ? (
              <p className="mt-2 text-sm italic text-slate-600">
                “{teaser.opportunities[0].scenario}”
              </p>
            ) : null}
          </div>
        ) : null}
      </DocPage>
    );
  }

  if (sectionId === 'competidores') {
    return (
      <DocPage
        accent={accent}
        eyebrow="Competidores"
        title={`Contra quién competís en IA (${ctx.competitors.length || 0})`}
      >
        {ctx.competitors.length === 0 ? (
          <p>No hay competidores cargados en este diagnóstico.</p>
        ) : (
          <ul className="space-y-3">
            {ctx.competitors.map((c, i) => (
              <li
                key={`${c.name}-${c.domain || i}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {i + 1}. {c.name}
                  </p>
                  {c.domain ? <p className="text-xs text-slate-500">{c.domain}</p> : null}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Rival
                </span>
              </li>
            ))}
          </ul>
        )}
        {defendNow.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Posiciones a defender (mayor score)
            </p>
            <ul className="mt-2 space-y-2">
              {defendNow.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-800">{item.label}</span>
                  <span className="shrink-0 font-bold" style={{ color: accent.primary }}>
                    {item.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p>
          Acción: armá una comparativa honesta de <strong>{ctx.brandName}</strong>
          {ctx.competitors[0] ? (
            <>
              {' '}
              vs <strong>{ctx.competitors[0].name}</strong>
            </>
          ) : null}
          , explicando cuándo conviene elegirte.
        </p>
      </DocPage>
    );
  }

  if (sectionId === 'preguntas') {
    return (
      <DocPage
        accent={accent}
        eyebrow="Preguntas perdidas"
        title="Consultas donde hoy no te recomiendan lo suficiente"
      >
        {lostQuestions.length === 0 ? (
          <p>Cuando haya oportunidades del run, aparecen acá como preguntas a cubrir.</p>
        ) : (
          <ul className="space-y-3">
            {lostQuestions.map((q, i) => (
              <li key={`${i}-${q.title}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {i + 1}. {q.title}
                  </p>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {q.score}/100
                  </span>
                </div>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                  Prioridad {q.priority}
                  {q.impact ? ` · Impacto ${q.impact}` : ''}
                  {q.effort ? ` · Esfuerzo ${q.effort}` : ''}
                </p>
                {q.scenario ? (
                  <p className="mt-2 text-sm italic text-slate-600">“{q.scenario}”</p>
                ) : null}
                <p className="mt-2 text-sm text-slate-700">
                  <span className="font-semibold">Qué hacer: </span>
                  {q.action}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DocPage>
    );
  }

  if (sectionId === 'victorias') {
    const week = immediatePlan[1] || immediatePlan[0];
    return (
      <DocPage
        accent={accent}
        eyebrow="Victorias rápidas"
        title={week?.theme || 'Quick wins de esta semana'}
      >
        {week?.evidence ? (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{week.evidence}</p>
        ) : null}
        <ol className="space-y-3">
          {(week?.tasks ?? []).map((task, i) => (
            <li key={`${i}-${task.slice(0, 20)}`} className="flex gap-3 rounded-xl border border-slate-200 p-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: accent.primary }}
              >
                {i + 1}
              </span>
              <p className="font-medium text-slate-900">{task}</p>
            </li>
          ))}
        </ol>
        {immediatePlan[2] ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Siguiente paso · {immediatePlan[2].theme}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {immediatePlan[2].tasks.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {authorityChannels.length > 0 ? (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Canales de autoridad externa
            </p>
            <ul className="mt-2 space-y-2">
              {authorityChannels.map((c) => (
                <li key={c.name} className="text-sm">
                  <span className="font-semibold text-slate-900">{c.name}: </span>
                  <span className="text-slate-600">{c.goal}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DocPage>
    );
  }

  if (sectionId === 'contenido') {
    return (
      <DocPage accent={accent} eyebrow="Contenido sugerido" title="Piezas a publicar o mejorar">
        <ul className="space-y-3">
          {suggestedContent.map((item, i) => (
            <li key={`${i}-${item.title}`} className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">
                {i + 1}. {item.title}
              </p>
              <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
              {item.prompt ? (
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                  {item.prompt}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
        {courseModules.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Módulos de implementación
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
              {courseModules.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </DocPage>
    );
  }

  if (sectionId === 'plan90') {
    return (
      <DocPage accent={accent} eyebrow="Plan 90 días" title={`Roadmap para ${ctx.brandName}`}>
        <div className="space-y-4">
          {roadmap.map((tab) => (
            <div key={tab.id} className="rounded-xl border border-slate-200 p-4">
              <p
                className="text-[11px] font-bold uppercase tracking-wide"
                style={{ color: accent.primary }}
              >
                {tab.label}
              </p>
              <p className="mt-0.5 font-semibold text-slate-900">{tab.title}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {tab.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DocPage>
    );
  }

  if (sectionId === 'tareas') {
    const visible = unlocked ? taskList : taskList.slice(0, 10);
    return (
      <DocPage
        accent={accent}
        eyebrow="Lista de tareas"
        title={`${taskList.length} acciones para ejecutar`}
      >
        <ol className="space-y-2">
          {visible.map((task, i) => (
            <li
              key={`${i}-${task.slice(0, 24)}`}
              className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
            >
              <span className="mt-0.5 text-xs font-bold text-slate-400">{i + 1}.</span>
              <span className="text-sm text-slate-800">{task}</span>
            </li>
          ))}
        </ol>
        {!unlocked && taskList.length > 10 ? (
          <p className="text-xs text-slate-500">
            +{taskList.length - 10} tareas más se desbloquean con el plan completo.
          </p>
        ) : null}
      </DocPage>
    );
  }

  if (sectionId === 'vision') {
    const ENGINE_LABELS: Record<string, string> = {
      chatgpt: 'ChatGPT',
      gemini: 'Gemini',
      claude: 'Claude',
      perplexity: 'Perplexity',
    };
    const engineEntries = teaser?.engines ? Object.entries(teaser.engines) : [];
    return (
      <DocPage accent={accent} eyebrow="Visión IA" title={`Cómo te ven ${enginesText}`}>
        <p>
          Cleexs Score actual:{' '}
          <strong>{ctx.cleexsScore != null ? `${ctx.cleexsScore}/100` : '—'}</strong>
        </p>
        {engineEntries.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {engineEntries.map(([key, eng]) => (
              <div key={key} className="rounded-xl border border-slate-200 px-3 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {ENGINE_LABELS[key] || key}
                </p>
                <p className="mt-1 text-lg font-bold" style={{ color: accent.primary }}>
                  {eng.score != null ? `${Math.round(eng.score)}` : '—'}
                  <span className="text-xs font-medium text-slate-400"> / 100</span>
                </p>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{eng.status}</p>
              </div>
            ))}
          </div>
        ) : (
          <p>Motores del diagnóstico: {enginesText}.</p>
        )}
        {teaser?.domainRating ? (
          <p className="text-xs text-slate-500">
            Domain Rating / autoridad del dominio disponible en el diagnóstico premium.
          </p>
        ) : null}
      </DocPage>
    );
  }

  return (
    <DocPage accent={accent} eyebrow="FAQ" title="Preguntas frecuentes del plan">
      <div className="space-y-3">
        {[
          {
            q: '¿Esto reemplaza el informe premium?',
            a: 'No: este Plan de Ataque es el entregable ejecutable. El portal premium sigue con el informe completo, scores por motor e historial.',
          },
          {
            q: '¿En qué orden trabajo?',
            a: 'Empezá por Prioridad #1, después Victorias rápidas (esta semana), y seguí el Plan 90 días.',
          },
          {
            q: '¿Cuánto tarda?',
            a:
              hours != null
                ? `Estimamos alrededor de ${hours} horas de trabajo priorizado, repartidas en 90 días.`
                : 'Depende de cuántas oportunidades abiertas tenga tu diagnóstico.',
          },
          {
            q: '¿Cómo mido avance?',
            a: `Volvé a correr un diagnóstico Cleexs hacia el día 75–90 y compará el score de ${ctx.brandName}.`,
          },
        ].map((item) => (
          <div key={item.q} className="rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-900">{item.q}</p>
            <p className="mt-1 text-sm text-slate-600">{item.a}</p>
          </div>
        ))}
      </div>
    </DocPage>
  );
}
