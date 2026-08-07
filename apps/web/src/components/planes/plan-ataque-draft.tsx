'use client';

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  Calendar,
  Target,
  Clock,
  TrendingUp,
  ClipboardList,
  Lightbulb,
  FileText,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { IndustryCoverWatermark } from '@/components/planes/industry-cover-watermark';
import { brandAssetsApi, publicDiagnosticApi } from '@/lib/api';
import {
  CLEEXS_FALLBACK,
  accentFromDomain,
  extractAccentFromLogoUrl,
  type BrandAccent,
} from '@/lib/brand-accent-from-logo';
import {
  buildPlanConquistarLandingContext,
  type PlanConquistarLandingContext,
} from '@/lib/plan-conquistar-landing-context';
import { cn } from '@/lib/utils';

/**
 * Shell visual del “Plan de Ataque” (borrador).
 * Formato cercano a la muestra: barra de marca + tarjetas con icono + viewer.
 */

function impactLabel(ctx: PlanConquistarLandingContext): string {
  const ops = ctx.opportunityCount ?? 0;
  const score = ctx.cleexsScore;
  if (ops >= 20 || (score != null && score < 40)) return 'ALTO';
  if (ops >= 10 || (score != null && score < 60)) return 'MEDIO';
  if (ops > 0 || score != null) return 'MODERADO';
  return '—';
}

function estimatedHours(ctx: PlanConquistarLandingContext): number | null {
  const ops = ctx.opportunityCount;
  if (ops == null || ops <= 0) return null;
  return Math.max(6, Math.round(ops * 0.75));
}

function MetricCard({
  icon: Icon,
  accent,
  iconTone = 'brand',
  primary,
  secondary,
  emphasizePrimary = false,
}: {
  icon: LucideIcon;
  accent: BrandAccent;
  iconTone?: 'brand' | 'ink';
  primary: string;
  secondary: string;
  /** Si true, el valor grande usa color de marca (ej. ALTO) */
  emphasizePrimary?: boolean;
}) {
  const iconColor = iconTone === 'brand' ? accent.primary : '#0f172a';
  return (
    <div className="flex min-w-[9.5rem] flex-1 items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-sm sm:min-w-[10.5rem] sm:gap-3 sm:px-3.5 sm:py-3">
      <Icon className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" strokeWidth={1.75} style={{ color: iconColor }} />
      <div className="min-w-0 text-left leading-tight">
        <p
          className={cn(
            'truncate text-base font-bold sm:text-lg',
            emphasizePrimary ? '' : 'text-slate-900'
          )}
          style={emphasizePrimary ? { color: accent.primary } : undefined}
        >
          {primary}
        </p>
        <p className="truncate text-[11px] text-slate-600 sm:text-xs">{secondary}</p>
      </div>
    </div>
  );
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

  const enginesText =
    ctx.engines.length === 0
      ? 'ChatGPT'
      : ctx.engines.length <= 2
        ? ctx.engines.join(' y ')
        : `${ctx.engines.slice(0, -1).join(', ')} y ${ctx.engines[ctx.engines.length - 1]}`;

  const sidebarItems = useMemo(
    () => [
      { label: 'Portada', active: true },
      { label: 'Índice' },
      { label: 'Prioridad #1' },
      {
        label:
          ctx.competitors.length > 0
            ? `Competidores (${ctx.competitors.length})`
            : 'Competidores',
      },
      { label: 'Preguntas perdidas' },
      { label: 'Victorias rápidas' },
      { label: 'Contenido sugerido' },
      { label: 'Plan 90 días' },
      { label: 'Lista de tareas' },
      {
        label: ctx.engines[0] ? `Visión IA · ${ctx.engines[0]}` : 'Visión IA',
      },
      { label: 'Preguntas frecuentes' },
    ],
    [ctx.competitors.length, ctx.engines]
  );

  const faqs =
    ctx.topActions.length > 0
      ? ctx.topActions.slice(0, 4)
      : [
          `Definir la intención #1 donde ${ctx.brandName} quiere ser recomendada`,
          ctx.competitors[0]
            ? `Comparativa clara vs ${ctx.competitors[0].name}`
            : `Mejorar señales de marca en ${ctx.domain}`,
          `Publicar preguntas frecuentes accionables`,
          `Alinear contenido con ${enginesText}`,
        ];

  return (
    <div
      className="min-h-screen bg-white text-slate-900"
      style={
        {
          '--brand': accent.primary,
          '--brand-ink': accent.ink,
          '--brand-soft': accent.soft,
        } as CSSProperties
      }
    >
      <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-900">
        Borrador · menú no funcional · acento {accent.primary} ({accent.source}
        {logoUrl ? '' : ', sin logo'})
      </div>

      {/* Barra superior — más angosta; Confidencial/cleexs alineados al recuadro */}
      <div style={{ backgroundColor: accent.primary }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white sm:px-5 sm:text-[11px]">
          <span className="shrink-0">Confidencial</span>
          <span className="min-w-0 truncate text-center font-medium normal-case tracking-normal opacity-95">
            Preparado exclusivamente para{' '}
            <span className="font-bold">{ctx.domain}</span>
          </span>
          <span className="shrink-0 tracking-normal opacity-95">cleexs</span>
        </div>
      </div>

      {/* Hero */}
      <section className="px-4 pb-5 pt-7 text-center sm:px-6 sm:pb-6 sm:pt-9">
        <h1 className="mx-auto max-w-3xl text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-[1.75rem]">
          Ya terminé el plan para{' '}
          <span style={{ color: accent.primary }}>{ctx.domain}</span>
          {ctx.countryFlag ? ` ${ctx.countryFlag}` : ''}
        </h1>

        {/* Tarjetas métricas — icono izq + texto (letras chicas) */}
        <div className="mx-auto mt-5 flex max-w-4xl flex-wrap items-stretch justify-center gap-2.5 sm:gap-3">
          <MetricCard
            icon={Target}
            accent={accent}
            iconTone="brand"
            primary={actions != null ? String(actions) : '—'}
            secondary="acciones priorizadas"
          />
          <MetricCard
            icon={Clock}
            accent={accent}
            iconTone="ink"
            primary={hours != null ? String(hours) : '—'}
            secondary="horas estimadas"
          />
          <MetricCard
            icon={TrendingUp}
            accent={accent}
            iconTone="brand"
            primary={impact}
            secondary="Impacto esperado"
            emphasizePrimary
          />
          <MetricCard
            icon={Calendar}
            accent={accent}
            iconTone="ink"
            primary="90"
            secondary="días de plan"
          />
        </div>
      </section>

      {/* App shell: sidebar + documento */}
      <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70">
          <div className="grid lg:grid-cols-[200px_1fr] lg:items-start">
            {/* Menú lateral #E9EDF2 — sin candados, todo en español */}
            <aside className="flex flex-col text-slate-800 lg:self-start" style={{ backgroundColor: '#E9EDF2' }}>
              <div className="flex flex-col items-center gap-2 border-b border-slate-200 px-3 py-4 text-center">
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <BrandLogo
                    name={ctx.brandName}
                    domain={ctx.domain}
                    size={80}
                    variant="icon"
                    hideIfMissing
                    className="rounded-lg"
                  />
                </div>
                <div className="min-w-0 w-full">
                  <p className="truncate text-sm font-semibold text-slate-900">{ctx.brandName}</p>
                  <p className="truncate text-[11px] text-slate-600">{ctx.domain}</p>
                </div>
              </div>
              <nav className="px-1.5 py-2" aria-label="Índice (maqueta)">
                <ul className="space-y-0.5">
                  {sidebarItems.map((item) => (
                    <li key={item.label}>
                      <button
                        type="button"
                        disabled
                        title="Aún no funcional"
                        className={cn(
                          'w-full cursor-not-allowed rounded-md px-2.5 py-1.5 text-left text-[12px]',
                          item.active
                            ? 'font-semibold text-slate-900'
                            : 'text-slate-700'
                        )}
                        style={
                          item.active
                            ? {
                                backgroundColor: '#ffffff',
                                boxShadow: `inset 2px 0 0 ${accent.primary}`,
                              }
                            : undefined
                        }
                      >
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 px-2 text-center text-[10px] text-slate-500">
                  + páginas del plan completo
                </p>
              </nav>
              <p className="mt-auto border-t border-slate-200 px-3 py-2.5 text-center text-[11px] font-semibold tracking-wide text-slate-500">
                cleexs
              </p>
            </aside>

            {/* Viewer */}
            <div className="relative bg-slate-100">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500">
                <span>Vista previa</span>
                <span>3 / — · 100%</span>
              </div>

              <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-[1.75fr_0.7fr_0.75fr]">
                {/* Portada — watermark del rubro a la derecha (como la pizza de referencia) */}
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
                    <div
                      className="mt-2 h-1.5 w-14 rounded-full"
                      style={{ backgroundColor: accent.primary }}
                    />
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
                          t:
                            actions != null
                              ? `${actions} acciones priorizadas`
                              : 'Acciones a confirmar',
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
                      ctx.competitors.length
                        ? `${ctx.competitors.length} competidores`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Plan personalizado Cleexs'}
                  </div>
                </article>

                {/* Índice — sin candado; pie difuminado */}
                <article className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h2
                    className="text-center text-sm font-bold uppercase tracking-wide"
                    style={{ color: accent.primary }}
                  >
                    Índice
                  </h2>
                  <ol className="mt-3 space-y-2">
                    {[
                      'Resumen ejecutivo',
                      'Competidores',
                      'Tendencias en IA',
                      'Victorias rápidas',
                      'Contenido sugerido',
                      'Plan 90 días',
                      'Lista de tareas',
                      'Preguntas frecuentes',
                      'Recursos y enlaces',
                    ].map((t, i) => (
                      <li key={t} className="flex gap-2 text-xs text-slate-600">
                        <span className="font-semibold" style={{ color: accent.primary }}>
                          {i + 1}.
                        </span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-white via-white/90 to-transparent" />
                </article>

                {/* Prioridad #1 — ~⅓ legible, resto difuminado, SIN candado */}
                <article className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p
                    className="text-[11px] font-bold uppercase tracking-wide"
                    style={{ color: accent.primary }}
                  >
                    Prioridad #1
                  </p>
                  <h2 className="mt-1 text-sm font-bold text-slate-900">
                    {ctx.topActions.length > 0
                      ? 'Primeras acciones de tu diagnóstico'
                      : 'Publicar las siguientes acciones'}
                  </h2>
                  <div
                    className="mt-2 h-1 w-10 rounded-full"
                    style={{ backgroundColor: accent.primary }}
                  />
                  <ol className="mt-3 space-y-2.5">
                    {[...faqs, 'Detalle de implementación y ejemplos…', 'Schema y señales externas…'].map(
                      (q, i) => (
                        <li key={`${i}-${q.slice(0, 20)}`} className="flex gap-2 text-xs text-slate-700">
                          <span
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: accent.primary }}
                          >
                            {i + 1}
                          </span>
                          <span className="leading-snug">{q}</span>
                        </li>
                      )
                    )}
                  </ol>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[66%] bg-gradient-to-t from-white from-20% via-white/90 to-transparent" />
                </article>
              </div>

              {/* Pie estilo métricas (imagen 3) — datos reales / derivados */}
              {(() => {
                const nAcciones = actions ?? Math.max(ctx.topActions.length, 6);
                const nPrompts = Math.max(ctx.engines.length * 2, ctx.topActions.length, 4);
                const nPaginas = Math.max(3, Math.round(nAcciones * 0.65));
                const nComparativas = Math.max(ctx.competitors.length, 1);
                const nMejoras = Math.max(2, Math.round(nAcciones * 0.55));
                const footerStats: Array<{
                  icon: LucideIcon;
                  value: string;
                  label: string;
                }> = [
                  { icon: ClipboardList, value: String(nAcciones), label: 'Acciones' },
                  { icon: Lightbulb, value: String(nPrompts), label: 'Prompts' },
                  { icon: FileText, value: String(nPaginas), label: 'Páginas' },
                  { icon: Users, value: String(nComparativas), label: 'Comparativas' },
                  { icon: Zap, value: String(nMejoras), label: 'Mejoras' },
                  { icon: Target, value: '1', label: 'Plan de acción' },
                ];
                return (
                  <div
                    className="border-t border-slate-200 px-3 py-3 sm:px-4"
                    style={{ backgroundColor: '#E1E6EC' }}
                  >
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5">
                      {footerStats.map(({ icon: Icon, value, label }) => (
                        <div
                          key={label}
                          className="flex flex-col items-center rounded-xl border border-slate-200/80 bg-white px-2 py-2.5 text-center shadow-sm"
                        >
                          <Icon
                            className="h-5 w-5"
                            strokeWidth={1.75}
                            style={{ color: accent.primary }}
                          />
                          <p className="mt-1 text-lg font-bold leading-none text-slate-900">{value}</p>
                          <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-center">
                      <button
                        type="button"
                        disabled
                        className="cursor-not-allowed rounded-lg px-4 py-2 text-xs font-semibold text-white opacity-90"
                        style={{ backgroundColor: accent.primary }}
                      >
                        Desbloquear plan completo
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          <Link href="/borrador/plan-conquistar" className="underline hover:text-slate-700">
            ← Landing Plan Conquistar
          </Link>
          {' · '}
          {ctx.domain}
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
          Agregá <code className="rounded bg-slate-100 px-1 text-sm">?diagnosticId=…</code>
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
