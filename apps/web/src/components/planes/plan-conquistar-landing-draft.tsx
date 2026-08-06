'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Check,
  Sparkles,
  Target,
  BarChart3,
  Users,
  ListChecks,
  CalendarCheck,
  GraduationCap,
  ClipboardCheck,
  RefreshCw,
  Gift,
  FileText,
  Loader2,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { PlanConquistarPromoPrice } from '@/components/planes/plan-conquistar-checkout-button';
import { PlanConquistarPageCheckout } from '@/components/planes/plan-conquistar-page-checkout';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import {
  buildLandingRoadmapTabs,
  buildPlanConquistarLandingContext,
  type PlanConquistarLandingContext,
  type RoadmapTabId,
} from '@/lib/plan-conquistar-landing-context';
import { cn } from '@/lib/utils';

const INCLUYE: Array<{ icon: typeof Check; title: string; desc: string }> = [
  {
    icon: Target,
    title: 'Auditoría avanzada de Visibilidad IA',
    desc: 'Analizamos en profundidad cómo te ven los principales motores de IA y revelamos los factores que están limitando tu visibilidad.',
  },
  {
    icon: BarChart3,
    title: 'Cleexs Score detallado por motor de IA',
    desc: 'Conocé cómo rankea tu marca en los 4 motores más importantes: ChatGPT, Claude, Gemini y Perplexity, para saber dónde estás perdiendo oportunidades.',
  },
  {
    icon: Users,
    title: 'Comparación contra competidores',
    desc: 'Comparate contra las empresas que hoy están capturando la atención que podría ser tuya.',
  },
  {
    icon: ListChecks,
    title: 'Las 20 oportunidades de mayor impacto',
    desc: 'Te mostramos las acciones concretas que pueden generar la mejora más rápida en tu posicionamiento en los motores de IA.',
  },
  {
    icon: CalendarCheck,
    title: 'Plan de acción personalizado de 90 días',
    desc: 'Un plan concreto, paso a paso, priorizado por impacto y facilidad de implementación, para mejorar tu presencia en los motores de IA.',
  },
  {
    icon: GraduationCap,
    title: 'Curso Express de Visibilidad IA',
    desc: 'Aprendé cómo funciona el nuevo SEO para ChatGPT y cómo ganar en este nuevo mundo. Videos cortos y concretos.',
  },
  {
    icon: ClipboardCheck,
    title: 'Checklist de implementación',
    desc: 'Una guía práctica para ejecutar cada recomendación sin perder tiempo.',
  },
  {
    icon: RefreshCw,
    title: 'Re-análisis completo a los 75 días',
    desc: 'Medimos nuevamente tu progreso y verificamos cuánto avanzaste en estos primeros 75 días.',
  },
];

function PlanIndexPreview({ ctx }: { ctx: PlanConquistarLandingContext }) {
  const indexItems = [
    'Resumen ejecutivo y Cleexs Score',
    ctx.competitors.length
      ? `Comparativa vs ${ctx.competitors
          .slice(0, 2)
          .map((c) => c.name)
          .join(' y ')}`
      : 'Comparativa contra competidores',
    'Oportunidades priorizadas por impacto',
    'Roadmap 90 días (hora → semana → 30/60/90)',
    'Checklist + curso express',
  ];

  const actions =
    ctx.topActions.length > 0
      ? ctx.topActions.slice(0, 4)
      : [
          `Definir la intención #1 donde ${ctx.brandName} quiere ser recomendada`,
          `Mejorar la página clave del sitio (${ctx.domain})`,
          ctx.competitors[0]
            ? `Comparativa honesta vs ${ctx.competitors[0].name}`
            : 'Sumar FAQs verificables en el sitio',
          'Preparar señales de autoridad externas',
        ];

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-lg shadow-violet-100/60">
      <div className="flex items-center gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-3 sm:px-5">
        <BrandLogo name={ctx.brandName} domain={ctx.domain} size={40} />
        <div className="min-w-0 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-600">Plan listo</p>
          <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">
            Plan Conquistar · {ctx.brandName}
            {ctx.countryFlag ? ` ${ctx.countryFlag}` : ''}
          </p>
        </div>
      </div>
      <div className="grid gap-0 sm:grid-cols-2">
        <div className="border-b border-slate-100 p-4 sm:border-b-0 sm:border-r sm:p-5">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <FileText className="h-3.5 w-3.5" />
            Índice
          </p>
          <ul className="space-y-2">
            {indexItems.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-4 sm:p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Primeras acciones
          </p>
          <ol className="space-y-2.5">
            {actions.map((item, i) => (
              <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-2.5 text-sm text-slate-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-bold text-violet-700">
                  {i + 1}
                </span>
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ol>
          {ctx.topActions.length === 0 && (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Acciones base según tu diagnóstico. El detalle completo se desbloquea al comprar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RoadmapTabs({ ctx }: { ctx: PlanConquistarLandingContext }) {
  const tabs = useMemo(() => buildLandingRoadmapTabs(ctx), [ctx]);
  const [active, setActive] = useState<RoadmapTabId>('hora');
  const current = tabs.find((t) => t.id === active) || tabs[0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 text-center sm:mb-5">
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Tu roadmap de 90 días</h2>
        <p className="mt-1 text-sm text-slate-600">
          Así se estructura el plan para {ctx.brandName}
          {ctx.country ? ` en ${ctx.country}` : ''}.
        </p>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:text-sm',
              active === tab.id
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4 sm:mt-4 sm:p-5">
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{current.title}</h3>
        <ul className="mt-3 space-y-2.5">
          {current.items.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatsBar({ ctx }: { ctx: PlanConquistarLandingContext }) {
  const stats: Array<{ label: string; value: string }> = [];
  if (ctx.cleexsScore != null) {
    stats.push({ label: 'Cleexs Score', value: String(ctx.cleexsScore) });
  }
  if (ctx.opportunityCount != null && ctx.opportunityCount > 0) {
    stats.push({ label: 'Oportunidades', value: String(ctx.opportunityCount) });
  }
  if (ctx.competitors.length > 0) {
    stats.push({ label: 'Competidores', value: String(ctx.competitors.length) });
  }
  if (ctx.engines.length > 0) {
    stats.push({ label: 'Motores IA', value: String(ctx.engines.length) });
  }
  if (stats.length === 0) return null;

  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm sm:px-4"
        >
          <p className="text-lg font-bold tabular-nums text-violet-700 sm:text-xl">{s.value}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-[11px]">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function HeroPersonalized({ ctx }: { ctx: PlanConquistarLandingContext }) {
  const greeting = ctx.firstName ? `${ctx.firstName}, ` : '';
  const countryLine = ctx.country
    ? ` en ${ctx.country}${ctx.countryFlag ? ` ${ctx.countryFlag}` : ''}`
    : '';
  const rivalNames = ctx.competitors.slice(0, 3).map((c) => c.name);
  const rivalsText =
    rivalNames.length === 0
      ? null
      : rivalNames.length === 1
        ? rivalNames[0]
        : `${rivalNames.slice(0, -1).join(', ')} y ${rivalNames[rivalNames.length - 1]}`;

  return (
    <section className="px-4 pt-10 pb-8 sm:px-6 sm:pt-16 sm:pb-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 shadow-sm sm:mb-5 sm:px-4 sm:py-2 sm:text-sm">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate">Plan Conquistar ChatGPT en 90 Días</span>
        </div>

        <div className="mb-5 flex justify-center">
          <BrandLogo name={ctx.brandName} domain={ctx.domain} size={56} className="rounded-2xl" />
        </div>

        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          {greeting}tu Plan Conquistar para{' '}
          <span className="text-violet-600">{ctx.brandName}</span>
          {countryLine}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">
          Ya preparamos el plan de acción personalizado para que {ctx.brandName} sea favorita de{' '}
          {ctx.engines.slice(0, 3).join(', ')}
          {ctx.engines.length > 3 ? ' y más' : ''}. Es lo que haríamos si tu empresa fuera nuestra.
        </p>
        {rivalsText && (
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
            Enfocamos el plan contra lo que hoy te gana atención: <strong className="font-semibold text-slate-700">{rivalsText}</strong>.
          </p>
        )}
        {ctx.industry && (
          <p className="mx-auto mt-2 text-sm text-slate-500">
            Contexto: {ctx.industry}
            {ctx.domain ? ` · ${ctx.domain}` : ''}
          </p>
        )}

        <div className="mt-6 flex w-full flex-col items-stretch gap-3 sm:mt-8 sm:items-center">
          <PlanConquistarPageCheckout className="w-full sm:w-auto" />
          <PlanConquistarPromoPrice size="md" className="justify-center" />
        </div>
      </div>
    </section>
  );
}

function HeroGeneric() {
  return (
    <section className="px-4 pt-10 pb-8 sm:px-6 sm:pt-16 sm:pb-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 shadow-sm sm:mb-5 sm:px-4 sm:py-2 sm:text-sm">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate">Plan Conquistar ChatGPT en 90 Días</span>
        </div>
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Hacé que tu marca sea la <span className="text-violet-600">favorita de la IA</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:mt-5 sm:text-lg">
          El plan de acción personalizado para que tu marca sea la favorita de ChatGPT, Claude, Gemini y
          demás. Agregá <code className="rounded bg-slate-100 px-1 text-sm">?diagnosticId=…</code> para
          ver la versión personalizada.
        </p>
        <div className="mt-6 flex w-full flex-col items-stretch gap-3 sm:mt-8 sm:items-center">
          <PlanConquistarPageCheckout className="w-full sm:w-auto" />
          <PlanConquistarPromoPrice size="md" className="justify-center" />
        </div>
      </div>
    </section>
  );
}

function DraftLandingBody({
  ctx,
  loadError,
  loading,
}: {
  ctx: PlanConquistarLandingContext | null;
  loadError: string | null;
  loading: boolean;
}) {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-violet-50/60 via-white to-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm">
        Borrador · no es producción · la landing live sigue en{' '}
        <Link href="/plan-conquistar" className="underline hover:text-amber-950">
          /plan-conquistar
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando tu diagnóstico…
        </div>
      )}

      {!loading && loadError && (
        <div className="mx-auto max-w-lg px-4 py-8 text-center">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
          </p>
          <HeroGeneric />
        </div>
      )}

      {!loading && !loadError && ctx && (
        <>
          <HeroPersonalized ctx={ctx} />
          <div className="px-4 pb-6 sm:px-6">
            <StatsBar ctx={ctx} />
          </div>
          <section className="px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-3xl">
              <div className="mb-5 text-center">
                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Ya preparamos tu plan
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 sm:text-base">
                  No es un paywall vacío: el plan para {ctx.brandName} ya está armado a partir de tu
                  diagnóstico. Al comprar desbloqueás el reporte completo y el seguimiento.
                </p>
              </div>
              <PlanIndexPreview ctx={ctx} />
            </div>
          </section>
          <section className="px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-3xl">
              <RoadmapTabs ctx={ctx} />
            </div>
          </section>
        </>
      )}

      {!loading && !loadError && !ctx && <HeroGeneric />}

      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-violet-100 bg-violet-50/50 p-5 text-center sm:p-9">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Desbloqueá tu Plan de Dominación de IA
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            {ctx
              ? `Descubrí exactamente por qué ${
                  ctx.competitors[0]?.name || 'tus competidores'
                } aparecen en ChatGPT, Claude, Gemini y Perplexity más que ${ctx.brandName}… y qué tenés que hacer para superarlos.`
              : 'Descubrí exactamente por qué tus competidores aparecen en ChatGPT, Claude, Gemini y Perplexity más que vos... y qué tenés que hacer para superarlos.'}
          </p>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-5 text-center text-xl font-bold text-slate-900 sm:mb-8 sm:text-2xl">
            Todo lo que incluye
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {INCLUYE.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:gap-4 sm:p-5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="flex items-start gap-2 text-sm font-semibold text-slate-900">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{title}</span>
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 sm:p-9">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Gift className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                Bonus especial: USD 297 en acceso total a Cleexs Premium por 90 días
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
                Monitoreá tu evolución, seguí a tus competidores, detectá nuevas oportunidades y experimentá
                todas las funcionalidades premium sin restricciones.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-8 pt-4 sm:px-6 sm:pb-20 sm:pt-8">
        <div className="mx-auto max-w-2xl rounded-3xl border border-violet-200 bg-white p-6 text-center shadow-xl sm:p-9">
          <p className="text-sm font-medium uppercase tracking-wide text-violet-600">Pago único</p>
          <div className="mt-3 flex justify-center">
            <PlanConquistarPromoPrice
              size="md"
              className="text-base [&>span:last-child]:text-2xl [&>span:last-child]:font-bold sm:text-lg sm:[&>span:last-child]:text-3xl"
            />
          </div>
          <p className="mx-auto mt-4 max-w-md text-sm text-slate-600 sm:text-base">
            {ctx
              ? `Sumate al Plan Conquistar para ${ctx.brandName} y empezá a construir tu ventaja antes de que tus competidores se adelanten.`
              : 'Sumate al Plan Conquistar ChatGPT en 90 días y empezá a construir tu ventaja antes de que tus competidores se adelanten.'}
          </p>
          <div className="mt-6 sm:mt-7">
            <PlanConquistarPageCheckout className="w-full" />
          </div>
          <p className="mt-5 text-sm text-slate-500 sm:mt-6">
            ¿Todavía no probaste el diagnóstico?{' '}
            <Link href="/diagnostico/crear" className="font-medium text-violet-600 hover:underline">
              Hacé tu diagnóstico gratuito
            </Link>
          </p>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-200/80 bg-white/95 px-3 pt-2.5 shadow-[0_-10px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:hidden pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <PlanConquistarPageCheckout className="w-full min-h-[48px]" />
        <p className="mt-1.5 text-center text-[11px] font-medium text-slate-500">
          <PlanConquistarPromoPrice size="sm" className="justify-center" />
        </p>
      </div>
    </main>
  );
}

function PlanConquistarLandingDraftInner() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const [loading, setLoading] = useState(Boolean(diagnosticId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<PlanConquistarLandingContext | null>(null);

  useEffect(() => {
    if (!diagnosticId) {
      setLoading(false);
      setCtx(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    publicDiagnosticApi
      .get(diagnosticId)
      .then((diag: PublicDiagnostic) => {
        if (cancelled) return;
        setCtx(buildPlanConquistarLandingContext(diag));
      })
      .catch(() => {
        if (cancelled) return;
        setCtx(null);
        setLoadError('No pudimos cargar ese diagnóstico. Revisá el diagnosticId.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [diagnosticId]);

  return <DraftLandingBody ctx={ctx} loadError={loadError} loading={loading} />;
}

export function PlanConquistarLandingDraft() {
  return (
    <Suspense
      fallback={
        <DraftLandingBody ctx={null} loadError={null} loading />
      }
    >
      <PlanConquistarLandingDraftInner />
    </Suspense>
  );
}
