'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Clock,
  Target,
  TrendingUp,
  ClipboardList,
  Lightbulb,
  FileText,
  Users,
  Zap,
} from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { IndustryCoverWatermark } from '@/components/planes/industry-cover-watermark';
import { brandAssetsApi } from '@/lib/api';
import {
  CLEEXS_FALLBACK,
  accentFromDomain,
  extractAccentFromLogoUrl,
  type BrandAccent,
} from '@/lib/brand-accent-from-logo';
import type { PlanConquistarLandingContext } from '@/lib/plan-conquistar-landing-context';
import { cn } from '@/lib/utils';

const MENU_BG = '#E9EDF2';
const BAR_BG = '#E1E6EC';
/** Lienzo más alto: título + 4 KPIs + viewer + pie de 6 métricas */
const DESIGN_W = 920;
const DESIGN_H = 720;

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

/** Foto automática del Plan de Ataque — título + viewer + pie (como la captura completa). */
export function PlanAtaquePhotoPreview({
  ctx,
  className,
}: {
  ctx: PlanConquistarLandingContext;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);
  const [accent, setAccent] = useState<BrandAccent>(
    () => accentFromDomain(ctx.domain) || CLEEXS_FALLBACK
  );

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const apply = () => setScale(el.clientWidth / DESIGN_W);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let logoUrl: string | null = null;
      try {
        const asset = await brandAssetsApi.resolve({
          domain: ctx.domain,
          brandName: ctx.brandName,
        });
        if (asset.status === 'ok' && asset.logoUrl && !asset.logoUrl.includes('brandfetch.io')) {
          logoUrl = asset.logoUrl;
        }
      } catch {
        // ignore
      }
      if (cancelled) return;
      if (logoUrl) {
        setAccent(await extractAccentFromLogoUrl(logoUrl, ctx.domain));
      } else {
        setAccent(accentFromDomain(ctx.domain));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx.domain, ctx.brandName]);

  const actions = ctx.opportunityCount;
  const hours = estimatedHours(ctx);
  const impact = impactLabel(ctx);
  const today = useMemo(
    () =>
      new Date().toLocaleDateString('es-AR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    []
  );

  const enginesText =
    ctx.engines.length === 0
      ? 'ChatGPT'
      : ctx.engines.length <= 2
        ? ctx.engines.join(' y ')
        : `${ctx.engines.slice(0, -1).join(', ')} y ${ctx.engines[ctx.engines.length - 1]}`;

  const faqs =
    ctx.topActions.length > 0
      ? ctx.topActions.slice(0, 5)
      : [
          `Definir la intención #1 para ${ctx.brandName}`,
          ctx.competitors[0]
            ? `Comparativa vs ${ctx.competitors[0].name}`
            : `Mejorar señales en ${ctx.domain}`,
          `Publicar preguntas frecuentes accionables`,
          `Alinear contenido con ${enginesText}`,
          `Lista de tareas 30/60/90`,
        ];

  const sidebarItems = [
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
  ];

  const indexItems = [
    'Resumen ejecutivo',
    'Competidores',
    'Tendencias en IA',
    'Victorias rápidas',
    'Contenido sugerido',
    'Plan 90 días',
    'Lista de tareas',
    'Preguntas frecuentes',
    'Recursos y enlaces',
  ];

  const nAcciones = actions ?? Math.max(ctx.topActions.length, 6);
  const nPrompts = Math.max(ctx.engines.length * 2, ctx.topActions.length, 4);
  const nPaginas = Math.max(3, Math.round(nAcciones * 0.65));
  const nComparativas = Math.max(ctx.competitors.length, 1);
  const nMejoras = Math.max(2, Math.round(nAcciones * 0.55));
  const footerStats = [
    { Icon: ClipboardList, value: String(nAcciones), label: 'Acciones' },
    { Icon: Lightbulb, value: String(nPrompts), label: 'Prompts' },
    { Icon: FileText, value: String(nPaginas), label: 'Páginas' },
    { Icon: Users, value: String(nComparativas), label: 'Comparativas' },
    { Icon: Zap, value: String(nMejoras), label: 'Mejoras' },
    { Icon: Target, value: '1', label: 'Plan de acción' },
  ];

  const heroMetrics = [
    {
      Icon: Target,
      primary: actions != null ? String(actions) : '—',
      secondary: 'acciones priorizadas',
      brand: true,
    },
    {
      Icon: Clock,
      primary: hours != null ? String(hours) : '—',
      secondary: 'horas estimadas',
      brand: false,
    },
    {
      Icon: TrendingUp,
      primary: impact,
      secondary: 'Impacto esperado',
      brand: true,
      emphasize: true,
    },
    {
      Icon: Calendar,
      primary: '90',
      secondary: 'días de plan',
      brand: false,
    },
  ];

  return (
    <div className={cn('mx-auto w-full max-w-[920px]', className)}>
      <div
        ref={frameRef}
        className="pointer-events-none relative w-full select-none overflow-hidden rounded-2xl border border-slate-200/80 bg-white"
        style={{
          height: DESIGN_H * scale,
          boxShadow: `0 10px 36px -8px ${accent.primary}55, 0 4px 14px -4px ${accent.primary}33`,
        }}
        aria-hidden
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: DESIGN_W,
            height: DESIGN_H,
            transform: `scale(${scale})`,
          }}
        >
          <div className="flex h-full flex-col bg-white">
            {/* Barra confidencial */}
            <div
              className="flex items-center justify-between px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
              style={{ backgroundColor: accent.primary }}
            >
              <span>Confidencial</span>
              <span className="normal-case tracking-normal opacity-95">
                Preparado exclusivamente para <strong>{ctx.domain}</strong>
              </span>
              <span className="normal-case tracking-normal opacity-95">cleexs</span>
            </div>

            {/* Título + 4 KPIs (lo que faltaba en la captura) */}
            <div className="shrink-0 px-5 pb-3 pt-4 text-center">
              <h2 className="text-[22px] font-bold leading-tight tracking-tight text-slate-900">
                Ya terminé el plan para{' '}
                <span style={{ color: accent.primary }}>{ctx.domain}</span>
                {ctx.countryFlag ? ` ${ctx.countryFlag}` : ''}
              </h2>
              <div className="mx-auto mt-3 flex max-w-3xl flex-wrap items-stretch justify-center gap-2">
                {heroMetrics.map(({ Icon, primary, secondary, brand, emphasize }) => (
                  <div
                    key={secondary}
                    className="flex min-w-[9.5rem] flex-1 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 shadow-sm"
                  >
                    <Icon
                      className="h-6 w-6 shrink-0"
                      strokeWidth={1.75}
                      style={{ color: brand ? accent.primary : '#0f172a' }}
                    />
                    <div className="min-w-0 text-left leading-tight">
                      <p
                        className="truncate text-[15px] font-bold"
                        style={emphasize ? { color: accent.primary } : undefined}
                      >
                        {primary}
                      </p>
                      <p className="truncate text-[10px] text-slate-600">{secondary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Viewer: menú + 3 paneles */}
            <div className="mx-3 mb-2 min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="grid h-full grid-cols-[148px_1fr]">
                <aside style={{ backgroundColor: MENU_BG }} className="border-r border-slate-200">
                  <div className="flex flex-col items-center gap-1 border-b border-slate-200 px-2 py-2.5 text-center">
                    <div className="rounded-xl bg-white p-2 shadow-sm">
                      <BrandLogo
                        name={ctx.brandName}
                        domain={ctx.domain}
                        size={64}
                        variant="icon"
                        hideIfMissing
                        className="rounded-lg"
                      />
                    </div>
                    <p className="w-full truncate text-[12px] font-semibold text-slate-900">
                      {ctx.brandName}
                    </p>
                    <p className="w-full truncate text-[10px] text-slate-500">{ctx.domain}</p>
                  </div>
                  <ul className="space-y-0.5 px-1.5 py-1.5">
                    {sidebarItems.map((item) => (
                      <li key={item.label}>
                        <div
                          className={cn(
                            'rounded-md px-1.5 py-1 text-[10px] leading-tight',
                            item.active ? 'bg-white font-semibold text-slate-900' : 'text-slate-600'
                          )}
                          style={
                            item.active
                              ? { boxShadow: `inset 2px 0 0 ${accent.primary}` }
                              : undefined
                          }
                        >
                          <span className="truncate">{item.label}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="px-2 pb-1.5 text-center text-[9px] font-semibold tracking-wide text-slate-400">
                    + páginas del plan · cleexs
                  </p>
                </aside>

                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-400">
                    <span>Vista previa</span>
                    <span>3 · 100%</span>
                  </div>

                  <div className="grid min-h-0 flex-1 grid-cols-[1.85fr_0.7fr_0.75fr] gap-1.5 p-2">
                    {/* Portada + watermark del rubro (derecha, como la pizza) */}
                    <div className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-2.5 text-left">
                      <IndustryCoverWatermark
                        industry={ctx.industry}
                        domain={ctx.domain}
                        brandName={ctx.brandName}
                        accent={accent}
                      />
                      <div className="relative z-10">
                        <div className="mb-1.5 w-fit rounded-lg bg-white/90 p-0.5 shadow-sm backdrop-blur-[2px]">
                          <BrandLogo
                            name={ctx.brandName}
                            domain={ctx.domain}
                            size={70}
                            variant="logo"
                            hideIfMissing
                            className="rounded-lg"
                          />
                        </div>
                        <p className="text-[14px] font-bold text-slate-900">Tu Plan de Ataque</p>
                        <div
                          className="mt-1 h-1 w-11 rounded-full"
                          style={{ backgroundColor: accent.primary }}
                        />
                        <p className="mt-1.5 text-[10px] leading-snug text-slate-600">
                          Cómo conseguir más clientes desde {enginesText}{' '}
                          <span className="font-semibold" style={{ color: accent.primary }}>
                            en los próximos 90 días
                          </span>
                        </p>
                        <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                          <p className="text-[9px] text-slate-500">Preparado exclusivamente para</p>
                          <p className="text-[12px] font-bold" style={{ color: accent.primary }}>
                            {ctx.domain}
                          </p>
                        </div>
                        <div className="mt-1.5 space-y-0.5">
                          {[
                            { Icon: Calendar, t: `Generado el: ${today}` },
                            {
                              Icon: Target,
                              t: actions != null ? `${actions} acciones priorizadas` : '—',
                            },
                            {
                              Icon: Clock,
                              t: hours != null ? `${hours} horas estimadas` : '—',
                            },
                            { Icon: TrendingUp, t: `Impacto esperado: ${impact}` },
                          ].map(({ Icon, t }) => (
                            <div
                              key={t}
                              className="flex items-center gap-1 text-[9px] text-slate-600"
                            >
                              <Icon
                                className="h-3 w-3 shrink-0"
                                style={{ color: accent.primary }}
                              />
                              <span className="truncate">{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="relative z-10 mt-auto border-t border-slate-100 pt-1.5 text-[8px] leading-snug text-slate-500">
                        {[
                          ctx.country ? `Mercado: ${ctx.country}` : null,
                          ctx.industry,
                          ctx.cleexsScore != null ? `Cleexs Score ${ctx.cleexsScore}` : null,
                          ctx.competitors.length > 0
                            ? `${ctx.competitors.length} competidores`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Plan personalizado Cleexs'}
                      </div>
                    </div>

                    {/* Índice */}
                    <div className="relative min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                      <p
                        className="text-center text-[11px] font-bold uppercase tracking-wide"
                        style={{ color: accent.primary }}
                      >
                        Índice
                      </p>
                      <ol className="mt-1.5 space-y-1">
                        {indexItems.map((t, i) => (
                          <li key={t} className="flex gap-1 text-[9px] text-slate-600">
                            <span className="font-semibold" style={{ color: accent.primary }}>
                              {i + 1}.
                            </span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-white via-white/90 to-transparent" />
                    </div>

                    {/* Prioridad */}
                    <div className="relative min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                      <p
                        className="text-[9px] font-bold uppercase tracking-wide"
                        style={{ color: accent.primary }}
                      >
                        Prioridad #1
                      </p>
                      <p className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-900">
                        Primeras acciones de tu diagnóstico
                      </p>
                      <div
                        className="mt-1 h-1 w-9 rounded-full"
                        style={{ backgroundColor: accent.primary }}
                      />
                      <ol className="mt-1.5 space-y-1">
                        {faqs.map((q, i) => (
                          <li
                            key={`${i}-${q.slice(0, 16)}`}
                            className="flex gap-1 text-[9px] text-slate-700"
                          >
                            <span
                              className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white"
                              style={{ backgroundColor: accent.primary }}
                            >
                              {i + 1}
                            </span>
                            <span className="leading-snug">{q}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[66%] bg-gradient-to-t from-white from-25% via-white/85 to-transparent backdrop-blur-[1.5px]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pie: 6 métricas (como imagen 3) */}
            <div
              className="shrink-0 border-t border-slate-200 px-3 py-2.5"
              style={{ backgroundColor: BAR_BG }}
            >
              <div className="grid grid-cols-6 gap-1.5">
                {footerStats.map(({ Icon, value, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center rounded-lg border border-slate-200/80 bg-white px-1 py-2"
                  >
                    <Icon className="h-4 w-4" style={{ color: accent.primary }} />
                    <p className="mt-0.5 text-[14px] font-bold leading-none text-slate-900">
                      {value}
                    </p>
                    <p className="mt-0.5 text-center text-[7px] font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
