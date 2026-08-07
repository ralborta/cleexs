'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, Target, TrendingUp } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
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
const DESIGN_W = 780;
const DESIGN_H = 460;

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

/** Foto automática del Plan de Ataque — sin candados, menú en español. */
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
  ];

  return (
    <div className={cn('mx-auto w-full max-w-[820px]', className)}>
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
          <div className="grid h-full grid-cols-[150px_1fr]">
            <aside style={{ backgroundColor: MENU_BG }} className="border-r border-slate-200">
              <div className="flex flex-col items-center gap-1.5 border-b border-slate-200 px-2.5 py-3 text-center">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  <BrandLogo
                    name={ctx.brandName}
                    domain={ctx.domain}
                    size={56}
                    variant="icon"
                    hideIfMissing
                    className="rounded-lg"
                  />
                </div>
                <p className="w-full truncate text-[13px] font-semibold text-slate-900">
                  {ctx.brandName}
                </p>
                <p className="w-full truncate text-[11px] text-slate-500">{ctx.domain}</p>
              </div>
              <ul className="space-y-0.5 px-1.5 py-2">
                {sidebarItems.map((item) => (
                  <li key={item.label}>
                    <div
                      className={cn(
                        'rounded-md px-2 py-1.5 text-[11px] leading-tight',
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
              <p className="mt-auto px-2 pb-2 text-center text-[10px] font-semibold tracking-wide text-slate-400">
                cleexs
              </p>
            </aside>

            <div className="flex h-full flex-col bg-slate-50">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-400">
                <span>Vista previa</span>
                <span>3 · 100%</span>
              </div>

              {/* Portada más ancha + índice + prioridad */}
              <div className="grid flex-1 grid-cols-[1.35fr_0.9fr_0.95fr] gap-2.5 p-2.5">
                {/* Portada (imagen 3) — más grande */}
                <div className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 text-center">
                  <div className="mb-2 flex justify-center">
                    <BrandLogo
                      name={ctx.brandName}
                      domain={ctx.domain}
                      size={52}
                      variant="logo"
                      hideIfMissing
                      className="rounded-lg"
                    />
                  </div>
                  <p className="text-[15px] font-bold text-slate-900">Tu Plan de Ataque</p>
                  <div
                    className="mx-auto mt-1.5 h-1 w-12 rounded-full"
                    style={{ backgroundColor: accent.primary }}
                  />
                  <p className="mt-2 text-[11px] leading-snug text-slate-600">
                    Cómo conseguir más clientes desde {enginesText}{' '}
                    <span className="font-semibold" style={{ color: accent.primary }}>
                      en los próximos 90 días
                    </span>
                  </p>
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="text-[10px] text-slate-500">Preparado exclusivamente para</p>
                    <p className="text-[13px] font-bold" style={{ color: accent.primary }}>
                      {ctx.domain}
                    </p>
                  </div>
                  <div className="mt-2 space-y-1 text-left">
                    {[
                      { Icon: Calendar, t: today },
                      { Icon: Target, t: actions != null ? `${actions} acciones priorizadas` : '—' },
                      { Icon: Clock, t: hours != null ? `${hours} horas estimadas` : '—' },
                      { Icon: TrendingUp, t: `Impacto esperado: ${impact}` },
                    ].map(({ Icon, t }) => (
                      <div key={t} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: accent.primary }} />
                        <span className="truncate">{t}</span>
                      </div>
                    ))}
                  </div>
                  {/* Pie con datos disponibles */}
                  <div className="mt-auto border-t border-slate-100 pt-2 text-left text-[9px] leading-snug text-slate-500">
                    {[ctx.country, ctx.industry, ctx.cleexsScore != null ? `Score ${ctx.cleexsScore}` : null]
                      .filter(Boolean)
                      .join(' · ') || 'Plan personalizado Cleexs'}
                  </div>
                </div>

                {/* Índice — sin candado, algo difuminado abajo */}
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-2.5">
                  <p
                    className="text-center text-[12px] font-bold uppercase tracking-wide"
                    style={{ color: accent.primary }}
                  >
                    Índice
                  </p>
                  <ol className="mt-2 space-y-1.5">
                    {indexItems.map((t, i) => (
                      <li key={t} className="flex gap-1.5 text-[10px] text-slate-600">
                        <span className="font-semibold" style={{ color: accent.primary }}>
                          {i + 1}.
                        </span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-white via-white/90 to-transparent" />
                </div>

                {/* Prioridad — ~⅓ legible, resto difuminado, SIN candado */}
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-2.5">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: accent.primary }}
                  >
                    Prioridad #1
                  </p>
                  <p className="mt-0.5 text-[12px] font-semibold leading-tight text-slate-900">
                    Primeras acciones de tu diagnóstico
                  </p>
                  <div
                    className="mt-1.5 h-1 w-10 rounded-full"
                    style={{ backgroundColor: accent.primary }}
                  />
                  <ol className="mt-2 space-y-1.5">
                    {faqs.map((q, i) => (
                      <li
                        key={`${i}-${q.slice(0, 16)}`}
                        className="flex gap-1.5 text-[10px] text-slate-700"
                      >
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
                  {/* ~⅔ inferior difuminado */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[66%] bg-gradient-to-t from-white from-25% via-white/85 to-transparent backdrop-blur-[1.5px]" />
                </div>
              </div>

              <div
                className="mt-auto flex items-center gap-2.5 border-t border-slate-200 px-3 py-2.5"
                style={{ backgroundColor: BAR_BG }}
              >
                <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-800">
                  Desbloqueá el plan completo
                  {ctx.country ? ` · ${ctx.country}` : ''}
                  {actions != null ? ` · ${actions} acciones` : ''}
                </p>
                <span
                  className="shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: accent.primary }}
                >
                  Desbloquear
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
