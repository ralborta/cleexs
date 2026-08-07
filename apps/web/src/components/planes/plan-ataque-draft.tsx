'use client';

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Lock,
  Loader2,
  Calendar,
  Target,
  Clock,
  TrendingUp,
  BarChart3,
  Users,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { brandAssetsApi, publicDiagnosticApi } from '@/lib/api';
import {
  CLEEXS_FALLBACK,
  accentFromDomain,
  extractAccentFromLogoUrl,
  type BrandAccent,
} from '@/lib/brand-accent-from-logo';
import {
  buildPlanConquistarLandingContext,
  formatCompetitorList,
  type PlanConquistarLandingContext,
} from '@/lib/plan-conquistar-landing-context';
import { cn } from '@/lib/utils';

/**
 * Shell visual del “Plan de Ataque” (borrador).
 * - Menú / opciones: NO funcionales (solo maqueta).
 * - Color de marca: líneas + títulos desde el logo.
 * - Métricas: datos reales del diagnóstico cuando existen.
 */

function AccentLine({ accent, className }: { accent: BrandAccent; className?: string }) {
  return (
    <div
      className={cn('h-1.5 w-14 rounded-full', className)}
      style={{ backgroundColor: accent.primary }}
      aria-hidden
    />
  );
}

function impactLabel(ctx: PlanConquistarLandingContext): string {
  const ops = ctx.opportunityCount ?? 0;
  const score = ctx.cleexsScore;
  if (ops >= 20 || (score != null && score < 40)) return 'Alto';
  if (ops >= 10 || (score != null && score < 60)) return 'Medio';
  if (ops > 0 || score != null) return 'Moderado';
  return 'A estimar';
}

function estimatedHours(ctx: PlanConquistarLandingContext): number | null {
  const ops = ctx.opportunityCount;
  if (ops == null || ops <= 0) return null;
  // Heurística borrador: ~45 min por oportunidad, piso 6h
  return Math.max(6, Math.round(ops * 0.75));
}

function PlanAtaqueShell({
  ctx,
  accent,
  logoUrl,
}: {
  ctx: PlanConquistarLandingContext;
  accent: BrandAccent;
  logoUrl: string | null;
}) {
  const today = new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const actions = ctx.opportunityCount;
  const hours = estimatedHours(ctx);
  const impact = impactLabel(ctx);
  const rivals = formatCompetitorList(ctx.competitors.map((c) => c.name));
  const enginesText =
    ctx.engines.length === 0
      ? 'ChatGPT'
      : ctx.engines.length <= 2
        ? ctx.engines.join(' y ')
        : `${ctx.engines.slice(0, -1).join(', ')} y ${ctx.engines[ctx.engines.length - 1]}`;

  const sidebarItems = useMemo(() => {
    const priorityLabel =
      ctx.topActions[0] != null
        ? `★ Prioridad #1`
        : '★ Prioridad #1';
    return [
      { label: 'Portada', locked: false, active: true },
      { label: 'Índice', locked: false },
      { label: priorityLabel, locked: false },
      {
        label:
          ctx.competitors.length > 0
            ? `Competidores (${ctx.competitors.length})`
            : 'Competidores',
        locked: true,
      },
      { label: 'Preguntas perdidas', locked: true },
      { label: 'Quick Wins', locked: true },
      { label: 'Contenido recomendado', locked: true },
      { label: 'Schema & datos', locked: true },
      { label: 'Roadmap 90 días', locked: true },
      { label: 'Calendario', locked: true },
      { label: 'Checklist', locked: true },
      {
        label: ctx.engines.length ? `IA · ${ctx.engines[0]}` : 'IA Overview',
        locked: true,
      },
      { label: 'FAQ', locked: true },
      { label: 'Recursos', locked: true },
    ];
  }, [ctx.competitors.length, ctx.engines, ctx.topActions]);

  const metricCards = [
    {
      value: actions != null ? String(actions) : '—',
      label: 'Acciones',
      hint: actions != null ? 'priorizadas del diagnóstico' : 'sin corrida aún',
    },
    {
      value: hours != null ? String(hours) : '—',
      label: 'Horas est.',
      hint: hours != null ? 'estimación borrador' : 'pendiente',
    },
    {
      value: impact,
      label: 'Impacto',
      hint: 'esperado',
    },
    {
      value: '90',
      label: 'Días roadmap',
      hint: 'horizonte fijo',
    },
  ];

  const coverMetrics: Array<{ icon: typeof Calendar; text: string }> = [
    { icon: Calendar, text: `Generado el: ${today}` },
    {
      icon: Target,
      text:
        actions != null
          ? `${actions} acciones priorizadas`
          : 'Acciones: pendiente de corrida',
    },
    {
      icon: Clock,
      text: hours != null ? `${hours} horas estimadas` : 'Horas: a estimar',
    },
    {
      icon: TrendingUp,
      text: `Impacto esperado: ${impact}`,
    },
  ];

  if (ctx.cleexsScore != null) {
    coverMetrics.push({
      icon: BarChart3,
      text: `Cleexs Score: ${ctx.cleexsScore}`,
    });
  }
  if (ctx.competitors.length > 0) {
    coverMetrics.push({
      icon: Users,
      text: `${ctx.competitors.length} competidor${ctx.competitors.length === 1 ? '' : 'es'} en el plan`,
    });
  }

  const faqs =
    ctx.topActions.length > 0
      ? ctx.topActions.slice(0, 4)
      : [
          `Definir la intención #1 donde ${ctx.brandName} quiere ser recomendada`,
          ctx.competitors[0]
            ? `Comparativa clara vs ${ctx.competitors[0].name}`
            : `Mejorar señales de marca en ${ctx.domain}`,
          ctx.industry
            ? `FAQs concretas de ${ctx.industry}`
            : `Publicar FAQs accionables en el sitio`,
          `Alinear contenido con ${enginesText}`,
        ];

  return (
    <div
      className="min-h-screen bg-slate-100 text-slate-900"
      style={
        {
          '--brand': accent.primary,
          '--brand-ink': accent.ink,
          '--brand-soft': accent.soft,
        } as CSSProperties
      }
    >
      <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 sm:text-sm">
        Borrador · Plan de Ataque · menú aún no navega · acento{' '}
        <span className="font-mono">{accent.primary}</span> ({accent.source}
        {logoUrl ? '' : ', sin logo'})
      </div>

      <div
        className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white sm:text-xs"
        style={{ backgroundColor: accent.ink }}
      >
        Confidencial · Preparado exclusivamente para {ctx.domain}
      </div>
      <div className="h-1 w-full" style={{ backgroundColor: accent.primary }} aria-hidden />

      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10">
        {/* Intro centrada */}
        <header className="mb-6 text-center sm:mb-8">
          <p className="text-sm font-medium text-slate-500">Borrador visual</p>
          <h1 className="mx-auto mt-1 max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Ya terminé el plan para{' '}
            <span style={{ color: accent.ink }}>{ctx.domain}</span>
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">
            Plan de ejecución a medida
            {ctx.country ? ` · ${ctx.country}${ctx.countryFlag ? ` ${ctx.countryFlag}` : ''}` : ''}
            {ctx.industry ? ` · ${ctx.industry}` : ''}.
            {rivals ? ` Frente a ${rivals}.` : ''}
          </p>

          {/* Métricas reales centradas */}
          <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-stretch justify-center gap-3">
            {metricCards.map((s) => (
              <div
                key={s.label}
                className="min-w-[6.5rem] flex-1 basis-[6.5rem] rounded-xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm sm:max-w-[9rem]"
              >
                <p className="text-xl font-bold sm:text-2xl" style={{ color: accent.ink }}>
                  {s.value}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {s.label}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{s.hint}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="grid lg:grid-cols-[230px_1fr]">
            {/* Sidebar gris oscuro (no negro) para que se vean logos */}
            <aside className="border-b border-slate-300 bg-slate-600 text-slate-100 lg:border-b-0 lg:border-r lg:border-slate-500">
              <div className="flex flex-col items-center gap-2 border-b border-slate-500 px-4 py-5 text-center">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  <BrandLogo
                    name={ctx.brandName}
                    domain={ctx.domain}
                    size={48}
                    variant="icon"
                    hideIfMissing
                    className="rounded-lg"
                  />
                </div>
                <div className="min-w-0 w-full">
                  <p className="truncate text-sm font-semibold text-white">{ctx.brandName}</p>
                  <p className="truncate text-[11px] text-slate-300">{ctx.domain}</p>
                  {ctx.cleexsScore != null ? (
                    <p className="mt-1 text-[11px] font-medium text-slate-200">
                      Score {ctx.cleexsScore}
                    </p>
                  ) : null}
                </div>
              </div>
              <nav className="px-2 py-3" aria-label="Índice del plan (maqueta)">
                <ul className="space-y-0.5">
                  {sidebarItems.map((item) => (
                    <li key={item.label}>
                      <button
                        type="button"
                        disabled
                        title="Aún no funcional"
                        className={cn(
                          'flex w-full cursor-not-allowed items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px]',
                          item.active
                            ? 'bg-white/15 font-semibold text-white'
                            : 'text-slate-200/85'
                        )}
                        style={
                          item.active
                            ? { boxShadow: `inset 3px 0 0 ${accent.primary}` }
                            : undefined
                        }
                      >
                        <span className="truncate">{item.label}</span>
                        {item.locked ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled
                  className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-500 px-3 py-2 text-xs text-slate-300"
                >
                  <Lock className="h-3.5 w-3.5" />
                  + páginas más
                </button>
              </nav>
            </aside>

            {/* Documento: portada grande centrada (estilo muestra) + prioridad */}
            <div className="bg-slate-50 p-3 sm:p-5 lg:p-8">
              <p className="mb-4 text-center text-xs text-slate-500">Vista previa · maqueta</p>

              {/* PORTADA — pieza importante */}
              <article className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white px-6 py-8 text-center shadow-sm sm:px-10 sm:py-10">
                <div className="mx-auto mb-6 flex justify-center">
                  <div className="rounded-2xl bg-white p-2">
                    <BrandLogo
                      name={ctx.brandName}
                      domain={ctx.domain}
                      size={72}
                      variant="logo"
                      hideIfMissing
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Tu Plan de Ataque
                </h2>
                <div className="mt-3 flex justify-center">
                  <AccentLine accent={accent} />
                </div>

                <p className="mx-auto mt-4 max-w-md text-base leading-snug text-slate-800 sm:text-lg">
                  Cómo conseguir más clientes desde {enginesText}{' '}
                  <span className="font-semibold" style={{ color: accent.primary }}>
                    en los próximos 90 días
                  </span>
                </p>

                <div className="mx-auto mt-6 max-w-sm border-t border-slate-200 pt-5">
                  <p className="text-xs text-slate-500">Preparado exclusivamente para:</p>
                  <p
                    className="mt-1 text-xl font-bold tracking-tight sm:text-2xl"
                    style={{ color: accent.primary }}
                  >
                    {ctx.domain}
                  </p>
                  {ctx.brandName.toLowerCase() !== ctx.domain.toLowerCase() ? (
                    <p className="mt-0.5 text-sm text-slate-500">{ctx.brandName}</p>
                  ) : null}
                </div>

                <div className="mx-auto mt-8 flex max-w-xl flex-col items-center gap-3 sm:gap-2.5">
                  {coverMetrics.map(({ icon: Icon, text }) => (
                    <div
                      key={text}
                      className="flex w-full max-w-md items-center justify-center gap-2.5 text-sm text-slate-700 sm:justify-start sm:text-[15px]"
                    >
                      <Icon
                        className="h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px]"
                        style={{ color: accent.primary }}
                      />
                      <span className="text-center sm:text-left">{text}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-10 flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wide text-slate-400">cleexs</span>
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: accent.soft }}
                    title="Secciones bloqueadas (maqueta)"
                  >
                    <Lock className="h-4 w-4" style={{ color: accent.ink }} />
                  </span>
                </div>
              </article>

              {/* Prioridad #1 — acciones reales si hay */}
              <article className="mx-auto mt-5 max-w-2xl rounded-xl border border-slate-200 bg-white px-6 py-6 text-center shadow-sm sm:px-8">
                <div
                  className="mx-auto inline-flex items-center rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: accent.primary }}
                >
                  Prioridad #1
                </div>
                <h3 className="mt-3 text-lg font-bold text-slate-900 sm:text-xl">
                  {ctx.topActions.length > 0
                    ? 'Primeras acciones de tu diagnóstico'
                    : 'Primeras acciones sugeridas'}
                </h3>
                <div className="mt-2 flex justify-center">
                  <AccentLine accent={accent} className="w-16" />
                </div>
                <ol className="mx-auto mt-5 max-w-lg space-y-3 text-left">
                  {faqs.map((q, i) => (
                    <li key={`${i}-${q.slice(0, 24)}`} className="flex gap-3 text-sm text-slate-700">
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                        style={{ backgroundColor: accent.primary }}
                      >
                        {i + 1}
                      </span>
                      <span className="leading-snug">{q}</span>
                    </li>
                  ))}
                </ol>
                {ctx.topActions.length === 0 ? (
                  <p className="mt-4 text-xs text-slate-400">
                    Todavía no hay oportunidades en la corrida; mostramos base según onboarding.
                  </p>
                ) : null}
              </article>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-slate-700 px-4 py-5 text-center sm:px-6">
            <p className="text-base font-semibold text-white sm:text-lg">
              Desbloqueá el plan completo
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Checkout todavía no cableado en este borrador.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 cursor-not-allowed rounded-xl px-5 py-2.5 text-sm font-semibold text-white opacity-90"
              style={{ backgroundColor: accent.primary }}
            >
              Desbloquear (próximamente)
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/borrador/plan-conquistar" className="underline hover:text-slate-700">
            ← Borrador landing Plan Conquistar
          </Link>
          {' · '}
          <span className="font-medium text-slate-600">{ctx.domain}</span>
        </p>
      </div>
    </div>
  );
}

function PlanAtaqueDraftInner() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('diagnosticId');
  const [loading, setLoading] = useState(Boolean(diagnosticId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ctx, setCtx] = useState<PlanConquistarLandingContext | null>(null);
  const [accent, setAccent] = useState<BrandAccent>(CLEEXS_FALLBACK);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!diagnosticId) {
      setLoading(false);
      setCtx(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    publicDiagnosticApi
      .get(diagnosticId)
      .then(async (diag) => {
        if (cancelled) return;
        const next = buildPlanConquistarLandingContext(diag);
        setCtx(next);

        let resolvedLogo: string | null = null;
        try {
          const asset = await brandAssetsApi.resolve({
            domain: next.domain,
            brandName: next.brandName,
          });
          if (asset.status === 'ok' && asset.logoUrl && !asset.logoUrl.includes('brandfetch.io')) {
            resolvedLogo = asset.logoUrl;
          }
        } catch {
          // ignore
        }
        if (cancelled) return;
        setLogoUrl(resolvedLogo);

        if (resolvedLogo) {
          const fromLogo = await extractAccentFromLogoUrl(resolvedLogo, next.domain);
          if (!cancelled) setAccent(fromLogo);
        } else {
          setAccent(accentFromDomain(next.domain));
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError('No pudimos cargar ese diagnóstico. Revisá el diagnosticId.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [diagnosticId]);

  if (!diagnosticId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-medium text-amber-800">Borrador · Plan de Ataque</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Falta diagnosticId</h1>
        <p className="mt-2 text-slate-600">
          Agregá <code className="rounded bg-slate-100 px-1 text-sm">?diagnosticId=…</code> a la
          URL.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando borrador…
      </div>
    );
  }

  if (loadError || !ctx) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-600">{loadError || 'Sin datos'}</p>
      </div>
    );
  }

  return <PlanAtaqueShell ctx={ctx} accent={accent} logoUrl={logoUrl} />;
}

export function PlanAtaqueDraft() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      }
    >
      <PlanAtaqueDraftInner />
    </Suspense>
  );
}
