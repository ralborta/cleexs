'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  Loader2,
} from 'lucide-react';
import { PlanConquistarPromoPrice } from '@/components/planes/plan-conquistar-checkout-button';
import { PlanConquistarPageCheckout } from '@/components/planes/plan-conquistar-page-checkout';
import { PlanAtaquePhotoPreview } from '@/components/planes/plan-ataque-photo-preview';
import { BrandLogo } from '@/components/ui/brand-logo';
import { CountryFlag } from '@/components/country/country-picker';
import { publicDiagnosticApi, type PublicDiagnostic } from '@/lib/api';
import {
  buildLandingRoadmapTabs,
  buildPlanConquistarLandingContext,
  formatCompetitorList,
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

function RoadmapTabs({ ctx }: { ctx: PlanConquistarLandingContext }) {
  const tabs = useMemo(() => buildLandingRoadmapTabs(ctx), [ctx]);
  const [active, setActive] = useState<RoadmapTabId>('hora');
  const current = tabs.find((t) => t.id === active) || tabs[0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 text-center sm:mb-5">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Tu roadmap de 90 días</h2>
        <p className="mt-1 text-base text-slate-600 sm:text-lg">
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
  if (ctx.country) {
    stats.push({
      label: 'Mercado',
      value: `${ctx.countryFlag ? `${ctx.countryFlag} ` : ''}${ctx.country}`,
    });
  }
  if (ctx.competitors.length > 0) {
    stats.push({ label: 'Competidores', value: String(ctx.competitors.length) });
  }
  if (ctx.engines.length > 0) {
    stats.push({ label: 'Motores', value: String(ctx.engines.length) });
  }
  if (ctx.cleexsScore != null) {
    stats.push({ label: 'Cleexs Score', value: String(ctx.cleexsScore) });
  }
  if (stats.length === 0) return null;

  return (
    <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center shadow-sm sm:min-w-[7rem] sm:px-4"
        >
          <p className="text-sm font-bold text-violet-700 sm:text-base">{s.value}</p>
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-[11px]">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function OnboardingDatosMini({ ctx }: { ctx: PlanConquistarLandingContext }) {
  const rivalsText = formatCompetitorList(ctx.competitors.map((c) => c.name));
  const enginesText = ctx.engines.length ? ctx.engines.join(', ') : null;
  const personName =
    ctx.firstName || ctx.lastName
      ? [ctx.firstName, ctx.lastName].filter(Boolean).join(' ')
      : null;

  const rows: Array<{ label: string; value: ReactNode; blank?: boolean }> = [
    { label: 'Sitio', value: ctx.domain || ctx.brandName },
    {
      label: 'País',
      value: ctx.country ? (
        <span className="inline-flex items-center gap-1">
          {ctx.countryIso ? (
            <CountryFlag iso={ctx.countryIso} className="h-2.5 w-4 rounded-[1px]" />
          ) : null}
          {ctx.country}
          {ctx.countryFlag ? ` ${ctx.countryFlag}` : ''}
        </span>
      ) : (
        ''
      ),
      blank: !ctx.country,
    },
    { label: 'Rubro', value: ctx.industry || '', blank: !ctx.industry },
    {
      label: 'Idioma',
      value: ctx.languageLabel || ctx.language || '',
      blank: !ctx.languageLabel && !ctx.language,
    },
    { label: 'Motores IA', value: enginesText || '', blank: !enginesText },
    { label: 'Competidores', value: rivalsText || '', blank: !rivalsText },
    // Si no hay nombre: fila en blanco (sin placeholder)
    { label: 'Nombre', value: personName || '', blank: !personName },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Datos..
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/90 shadow-sm">
        <dl className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[4.5rem_1fr] gap-2 px-2.5 py-1 sm:grid-cols-[5.5rem_1fr] sm:px-3 sm:py-1.5"
            >
              <dt className="text-[10px] font-medium text-slate-400 sm:text-[11px]">{row.label}</dt>
              <dd
                className={cn(
                  'min-h-[1rem] text-[11px] font-medium text-slate-800 sm:text-xs',
                  row.blank && 'text-transparent'
                )}
              >
                {row.blank ? '\u00a0' : row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function HeroPersonalized({ ctx }: { ctx: PlanConquistarLandingContext }) {
  const greeting = ctx.firstName
    ? `${ctx.firstName}${ctx.lastName ? ` ${ctx.lastName}` : ''}, `
    : '';
  const countryWithFlag = ctx.country
    ? `${ctx.country}${ctx.countryFlag ? ` ${ctx.countryFlag}` : ''}`
    : null;
  const rivalsText = formatCompetitorList(ctx.competitors.slice(0, 3).map((c) => c.name));
  const enginesText =
    ctx.engines.length === 0
      ? 'ChatGPT'
      : ctx.engines.length <= 2
        ? ctx.engines.join(' y ')
        : `${ctx.engines.slice(0, -1).join(', ')} y ${ctx.engines[ctx.engines.length - 1]}`;

  const profileChips: Array<{ key: string; node: ReactNode }> = [];
  if (ctx.country) {
    profileChips.push({
      key: 'country',
      node: (
        <span className="inline-flex items-center gap-1.5">
          {ctx.countryIso ? (
            <CountryFlag iso={ctx.countryIso} className="h-3.5 w-5 rounded-[2px]" />
          ) : null}
          {countryWithFlag}
        </span>
      ),
    });
  }
  if (ctx.industry) profileChips.push({ key: 'industry', node: ctx.industry });
  if (ctx.languageLabel) profileChips.push({ key: 'lang', node: ctx.languageLabel });
  if (ctx.domain) profileChips.push({ key: 'domain', node: ctx.domain });

  return (
    <section className="px-4 pt-10 pb-6 sm:px-6 sm:pt-16 sm:pb-8">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-violet-200 bg-white px-3.5 py-2 text-sm font-medium text-violet-700 shadow-sm sm:mb-5 sm:px-4 sm:py-2.5 sm:text-base">
          <Sparkles className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
          <span className="truncate">Plan Conquistar · armado con tu onboarding</span>
        </div>

        <div className="mb-5 flex justify-center">
          <BrandLogo
            name={ctx.brandName}
            domain={ctx.domain}
            size={56}
            variant="logo"
            hideIfMissing
            className="rounded-xl shadow-sm ring-1 ring-slate-200/80 px-2"
          />
        </div>

        <h1 className="text-[1.9rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[3.15rem]">
          {greeting}ya terminé el plan para{' '}
          <span className="text-violet-600">{ctx.domain || ctx.brandName}</span>
          {ctx.countryIso ? (
            <span className="ml-2 inline-flex align-middle">
              <CountryFlag iso={ctx.countryIso} className="h-6 w-9 rounded-sm shadow-sm sm:h-8 sm:w-12" />
            </span>
          ) : ctx.countryFlag ? (
            <span className="ml-1">{ctx.countryFlag}</span>
          ) : null}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 sm:mt-5 sm:text-xl">
          No es un reporte genérico. Es un plan de ejecución creado para{' '}
          <strong className="font-semibold text-slate-800">{ctx.brandName}</strong>
          {ctx.industry ? (
            <>
              {' '}
              en <strong className="font-semibold text-slate-800">{ctx.industry}</strong>
            </>
          ) : null}
          , usando lo que cargaste en el onboarding.
        </p>

        {profileChips.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {profileChips.map((chip) => (
              <span
                key={chip.key}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm sm:text-[15px]"
              >
                {chip.node}
              </span>
            ))}
          </div>
        )}

        <ul className="mx-auto mt-6 max-w-xl space-y-3 text-left text-base leading-relaxed text-slate-700 sm:text-lg">
          {countryWithFlag && (
            <li className="flex gap-2.5">
              <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
              <span>
                Comparado contra empresas de <strong className="font-semibold">{countryWithFlag}</strong>.
              </span>
            </li>
          )}
          {ctx.country && (
            <li className="flex gap-2.5">
              <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
              <span>
                Priorizamos oportunidades para <strong className="font-semibold">{ctx.country}</strong>.
              </span>
            </li>
          )}
          {rivalsText && (
            <li className="flex gap-2.5">
              <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
              <span>
                Competidores que cargaste: <strong className="font-semibold">{rivalsText}</strong>.
              </span>
            </li>
          )}
          <li className="flex gap-2.5">
            <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-500" />
            <span>
              Motores elegidos: <strong className="font-semibold">{enginesText}</strong>.
            </span>
          </li>
        </ul>

        <div className="mt-7 flex w-full flex-col items-stretch gap-3 sm:mt-9 sm:items-center">
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
          <section className="px-4 pb-4 sm:px-6">
            <div className="mx-auto max-w-3xl">
              <PlanAtaquePhotoPreview ctx={ctx} />
            </div>
            <div className="mt-3">
              <OnboardingDatosMini ctx={ctx} />
            </div>
          </section>
          <div className="px-4 pb-6 sm:px-6">
            <StatsBar ctx={ctx} />
          </div>
          <section className="px-4 py-6 sm:px-6 sm:py-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Ya preparamos tu plan
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-base text-slate-600 sm:text-lg">
                No es un paywall vacío: el plan para {ctx.brandName} ya está armado a partir de tu
                onboarding y diagnóstico. Al comprar desbloqueás el reporte completo y el seguimiento.
              </p>
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
                  formatCompetitorList(ctx.competitors.slice(0, 2).map((c) => c.name)) ||
                  'tus competidores'
                } aparecen más que ${ctx.brandName}${
                  ctx.country ? ` en ${ctx.country}` : ''
                }… y qué tenés que hacer para superarlos.`
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
