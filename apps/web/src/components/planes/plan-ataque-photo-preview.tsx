'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, Lock, Target, TrendingUp } from 'lucide-react';
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
/** Ancho/alto de diseño: se escala al contenedor sin deformar. */
const DESIGN_W = 720;
const DESIGN_H = 430;

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

/**
 * “Foto” automática del Plan de Ataque.
 * Lienzo fijo + scale → recuadro angosto sin aplastar.
 */
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
      ? ctx.topActions.slice(0, 3)
      : [
          `Definir la intención #1 para ${ctx.brandName}`,
          ctx.competitors[0]
            ? `Comparativa vs ${ctx.competitors[0].name}`
            : `Mejorar señales en ${ctx.domain}`,
          `FAQs accionables en el sitio`,
        ];

  const sidebarItems = [
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
    { label: 'Quick Wins', locked: true },
    { label: 'Roadmap 90 días', locked: true },
    { label: 'Checklist', locked: true },
    {
      label: ctx.engines[0] ? `IA · ${ctx.engines[0]}` : 'IA Overview',
      locked: true,
    },
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
          <div className="grid h-full grid-cols-[168px_1fr]">
            <aside style={{ backgroundColor: MENU_BG }} className="border-r border-slate-200">
              <div className="flex flex-col items-center gap-1.5 border-b border-slate-200 px-3 py-3.5 text-center">
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
                <p className="w-full truncate text-[13px] font-semibold text-slate-900">
                  {ctx.brandName}
                </p>
                <p className="w-full truncate text-[11px] text-slate-500">{ctx.domain}</p>
              </div>
              <ul className="space-y-0.5 px-2 py-2.5">
                {sidebarItems.map((item) => (
                  <li key={item.label}>
                    <div
                      className={cn(
                        'flex items-center justify-between gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] leading-tight',
                        item.active ? 'bg-white font-semibold text-slate-900' : 'text-slate-600'
                      )}
                      style={
                        item.active
                          ? { boxShadow: `inset 2px 0 0 ${accent.primary}` }
                          : undefined
                      }
                    >
                      <span className="truncate">{item.label}</span>
                      {item.locked ? (
                        <Lock className="h-3 w-3 shrink-0 text-slate-400" />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="flex h-full flex-col bg-slate-50">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-400">
                <span>Vista previa</span>
                <span>3 / — · 100%</span>
              </div>
              <div className="grid flex-1 grid-cols-3 gap-2.5 p-2.5">
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center">
                  <div className="mb-1.5 flex justify-center">
                    <BrandLogo
                      name={ctx.brandName}
                      domain={ctx.domain}
                      size={36}
                      variant="icon"
                      hideIfMissing
                    />
                  </div>
                  <p className="text-[13px] font-bold text-slate-900">Tu Plan de Ataque</p>
                  <div
                    className="mx-auto mt-1.5 h-1 w-10 rounded-full"
                    style={{ backgroundColor: accent.primary }}
                  />
                  <p className="mt-1.5 text-[10px] leading-snug text-slate-600">
                    Clientes desde {enginesText}{' '}
                    <span className="font-semibold" style={{ color: accent.primary }}>
                      en 90 días
                    </span>
                  </p>
                  <p className="mt-1.5 text-[12px] font-bold" style={{ color: accent.primary }}>
                    {ctx.domain}
                  </p>
                  <div className="mt-2 space-y-1 text-left">
                    {[
                      { Icon: Calendar, t: today },
                      { Icon: Target, t: actions != null ? `${actions} acciones` : '—' },
                      { Icon: Clock, t: hours != null ? `${hours} h` : '—' },
                      { Icon: TrendingUp, t: impact },
                    ].map(({ Icon, t }) => (
                      <div key={t} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: accent.primary }} />
                        <span className="truncate">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-2.5">
                  <p className="text-center text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    Índice
                  </p>
                  <ul className="mt-2 space-y-1.5 blur-[2px]" aria-hidden>
                    {['Resumen', 'Competidores', 'Quick Wins', 'Roadmap'].map((t) => (
                      <li key={t} className="text-[11px] text-slate-500">
                        {t}
                      </li>
                    ))}
                  </ul>
                  <div className="absolute inset-0 flex items-center justify-center bg-white/55">
                    <Lock className="h-6 w-6 text-slate-400" />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: accent.primary }}
                  >
                    Prioridad #1
                  </p>
                  <p className="mt-0.5 text-[12px] font-semibold leading-tight text-slate-900">
                    Primeras acciones
                  </p>
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
                        <span className="line-clamp-2 leading-snug">{q}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div
                className="mt-auto flex items-center gap-2.5 border-t border-slate-200 px-3 py-2.5"
                style={{ backgroundColor: BAR_BG }}
              >
                <Lock className="h-4 w-4 shrink-0 text-slate-500" />
                <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-slate-800">
                  Desbloqueá el plan completo
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
