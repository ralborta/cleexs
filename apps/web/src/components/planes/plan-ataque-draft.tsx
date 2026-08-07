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
  type LucideIcon,
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
      { label: 'Portada', locked: false, active: true },
      { label: 'Índice', locked: false },
      { label: '★ Prioridad #1', locked: false },
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
      { label: 'Schema & Datos', locked: true },
      { label: 'Roadmap 90 días', locked: true },
      { label: 'Calendario', locked: true },
      { label: 'Checklist', locked: true },
      {
        label: ctx.engines[0] ? `IA · ${ctx.engines[0]}` : 'IA Overview',
        locked: true,
      },
      { label: 'FAQ', locked: true },
      { label: 'Recursos', locked: true },
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
          `Publicar FAQs accionables en el sitio`,
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

      {/* Barra superior — color de marca (formato muestra) */}
      <div
        className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white sm:px-5 sm:text-[11px]"
        style={{ backgroundColor: accent.primary }}
      >
        <span className="justify-self-start">Confidencial</span>
        <span className="max-w-[70vw] truncate text-center font-medium normal-case tracking-normal opacity-95">
          Preparado exclusivamente para{' '}
          <span className="font-bold">{ctx.domain}</span>
        </span>
        <span className="justify-self-end tracking-normal opacity-90">cleexs</span>
      </div>

      {/* Hero */}
      <section className="px-4 pb-5 pt-7 text-center sm:px-6 sm:pb-6 sm:pt-9">
        <h1 className="mx-auto max-w-3xl text-xl font-bold tracking-tight text-slate-900 sm:text-2xl md:text-[1.75rem]">
          Ya terminé el plan para{' '}
          <span style={{ color: accent.primary }}>{ctx.domain}</span>
          {ctx.countryFlag ? ` ${ctx.countryFlag}` : ''}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 sm:text-[15px]">
          No es un reporte genérico. Es un plan de ejecución creado para{' '}
          <span className="font-semibold text-slate-800">TU</span> empresa.
        </p>

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
            secondary="días de roadmap"
          />
        </div>
      </section>

      {/* App shell: sidebar + documento */}
      <div className="mx-auto max-w-6xl px-3 pb-10 sm:px-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/70">
          <div className="grid lg:grid-cols-[200px_1fr]">
            {/* Menú gris oscuro */}
            <aside className="bg-slate-700 text-slate-100 lg:min-h-[520px]">
              <div className="flex flex-col items-center gap-2 border-b border-slate-600 px-3 py-4 text-center">
                <div className="rounded-lg bg-white p-1.5 shadow-sm">
                  <BrandLogo
                    name={ctx.brandName}
                    domain={ctx.domain}
                    size={40}
                    variant="icon"
                    hideIfMissing
                    className="rounded-md"
                  />
                </div>
                <div className="min-w-0 w-full">
                  <p className="truncate text-xs font-semibold text-white">{ctx.brandName}</p>
                  <p className="truncate text-[10px] text-slate-300">{ctx.domain}</p>
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
                          'flex w-full cursor-not-allowed items-center justify-between gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[12px]',
                          item.active ? 'font-semibold text-white' : 'text-slate-200/90'
                        )}
                        style={
                          item.active
                            ? {
                                backgroundColor: `${accent.primary}33`,
                                boxShadow: `inset 2px 0 0 ${accent.primary}`,
                              }
                            : undefined
                        }
                      >
                        <span className="truncate">{item.label}</span>
                        {item.locked ? (
                          <Lock className="h-3 w-3 shrink-0 opacity-60" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled
                  className="mt-2 flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-slate-500 px-2 py-1.5 text-[11px] text-slate-300"
                >
                  <Lock className="h-3 w-3" />
                  + páginas más
                </button>
              </nav>
            </aside>

            {/* Viewer */}
            <div className="relative bg-slate-100">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-500">
                <span>Vista previa</span>
                <span>3 / — · 100%</span>
              </div>

              <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-3">
                {/* Portada */}
                <article className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
                  <div className="mb-3 flex justify-center">
                    <BrandLogo
                      name={ctx.brandName}
                      domain={ctx.domain}
                      size={44}
                      variant="logo"
                      hideIfMissing
                      className="rounded-lg"
                    />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 sm:text-lg">Tu Plan de Ataque</h2>
                  <div
                    className="mx-auto mt-2 h-1 w-10 rounded-full"
                    style={{ backgroundColor: accent.primary }}
                  />
                  <p className="mt-2.5 text-[11px] leading-snug text-slate-700 sm:text-xs">
                    Cómo conseguir más clientes desde {enginesText}{' '}
                    <span className="font-semibold" style={{ color: accent.primary }}>
                      en los próximos 90 días
                    </span>
                  </p>
                  <div className="mt-3 border-t border-slate-100 pt-2.5">
                    <p className="text-[10px] text-slate-500">Preparado para</p>
                    <p className="text-sm font-bold" style={{ color: accent.primary }}>
                      {ctx.domain}
                    </p>
                  </div>
                  <div className="mt-3 space-y-1.5 text-left">
                    {[
                      { Icon: Calendar, t: today },
                      {
                        Icon: Target,
                        t: actions != null ? `${actions} acciones` : 'Acciones pend.',
                      },
                      {
                        Icon: Clock,
                        t: hours != null ? `${hours} h est.` : 'Horas a estimar',
                      },
                      { Icon: TrendingUp, t: `Impacto ${impact}` },
                    ].map(({ Icon, t }) => (
                      <div key={t} className="flex items-center gap-2 text-[10px] text-slate-600">
                        <Icon className="h-3.5 w-3.5" style={{ color: accent.primary }} />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </article>

                {/* Índice bloqueado */}
                <article className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-center text-xs font-bold uppercase tracking-wide text-slate-800">
                    Índice
                  </h2>
                  <ul className="mt-3 space-y-2 blur-[2.5px] select-none" aria-hidden>
                    {['Resumen ejecutivo', 'Competidores', 'Quick Wins', 'Roadmap', 'FAQ'].map(
                      (t) => (
                        <li key={t} className="text-[11px] text-slate-600">
                          {t}
                        </li>
                      )
                    )}
                  </ul>
                  <div className="absolute inset-0 flex items-center justify-center bg-white/55">
                    <Lock className="h-7 w-7 text-slate-400" />
                  </div>
                </article>

                {/* Prioridad #1 */}
                <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wide"
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
                    className="mt-2 h-1 w-8 rounded-full"
                    style={{ backgroundColor: accent.primary }}
                  />
                  <ol className="mt-3 space-y-2">
                    {faqs.map((q, i) => (
                      <li key={`${i}-${q.slice(0, 20)}`} className="flex gap-2 text-[11px] text-slate-700">
                        <span
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ backgroundColor: accent.primary }}
                        >
                          {i + 1}
                        </span>
                        <span className="leading-snug">{q}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="relative mt-3 overflow-hidden rounded bg-slate-50 p-2">
                    <p className="blur-[2px] select-none text-[10px] text-slate-400">
                      Detalle bloqueado…
                    </p>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </article>
              </div>

              {/* CTA inferior */}
              <div className="border-t border-slate-700 bg-slate-700 px-4 py-4 sm:px-5">
                <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10"
                    aria-hidden
                  >
                    <Lock className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white sm:text-base">
                      Desbloqueá el plan completo
                    </p>
                    <ul className="mt-1.5 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-300 sm:justify-start">
                      {[
                        actions != null ? `+${Math.max(0, actions - 4)} recomendaciones` : 'Recomendaciones',
                        'Quick Wins',
                        'Checklist de tareas',
                        'Roadmap 90 días',
                      ].map((t) => (
                        <li key={t} className="inline-flex items-center gap-1">
                          <span style={{ color: accent.primary }}>✓</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-lg px-4 py-2 text-xs font-semibold text-white opacity-90"
                    style={{ backgroundColor: accent.primary }}
                  >
                    Desbloquear
                  </button>
                </div>
              </div>
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
