'use client';

import { useEffect, useMemo, useState } from 'react';
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
 * “Foto” automática del Plan de Ataque (solo bloque de datos).
 * Escala + sombra + sin interacción — se genera sola por diagnóstico.
 */
export function PlanAtaquePhotoPreview({
  ctx,
  className,
}: {
  ctx: PlanConquistarLandingContext;
  className?: string;
}) {
  const [accent, setAccent] = useState<BrandAccent>(() =>
    accentFromDomain(ctx.domain) || CLEEXS_FALLBACK
  );

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
    <div
      className={cn(
        'pointer-events-none select-none overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]',
        className
      )}
      aria-hidden
    >
      <div className="grid grid-cols-[118px_1fr] sm:grid-cols-[132px_1fr]">
        {/* Menú */}
        <aside style={{ backgroundColor: MENU_BG }} className="border-r border-slate-200/80">
          <div className="flex flex-col items-center gap-1 border-b border-slate-200 px-2 py-2.5 text-center">
            <div className="rounded-md bg-white p-1 shadow-sm">
              <BrandLogo
                name={ctx.brandName}
                domain={ctx.domain}
                size={28}
                variant="icon"
                hideIfMissing
                className="rounded"
              />
            </div>
            <p className="w-full truncate text-[10px] font-semibold text-slate-900">
              {ctx.brandName}
            </p>
            <p className="w-full truncate text-[8px] text-slate-500">{ctx.domain}</p>
          </div>
          <ul className="space-y-px px-1 py-1.5">
            {sidebarItems.map((item) => (
              <li key={item.label}>
                <div
                  className={cn(
                    'flex items-center justify-between gap-1 rounded px-1.5 py-1 text-[9px] leading-tight',
                    item.active ? 'bg-white font-semibold text-slate-900' : 'text-slate-600'
                  )}
                  style={
                    item.active
                      ? { boxShadow: `inset 2px 0 0 ${accent.primary}` }
                      : undefined
                  }
                >
                  <span className="truncate">{item.label}</span>
                  {item.locked ? <Lock className="h-2.5 w-2.5 shrink-0 text-slate-400" /> : null}
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Páginas */}
        <div className="bg-slate-50">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2 py-1 text-[8px] text-slate-400">
            <span>Vista previa</span>
            <span>3 / —</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1.5 sm:gap-2 sm:p-2">
            <div className="rounded border border-slate-200 bg-white p-1.5 text-center sm:p-2">
              <div className="mb-1 flex justify-center">
                <BrandLogo
                  name={ctx.brandName}
                  domain={ctx.domain}
                  size={22}
                  variant="icon"
                  hideIfMissing
                />
              </div>
              <p className="text-[9px] font-bold text-slate-900 sm:text-[10px]">Tu Plan de Ataque</p>
              <div
                className="mx-auto mt-1 h-0.5 w-6 rounded-full"
                style={{ backgroundColor: accent.primary }}
              />
              <p className="mt-1 text-[7px] leading-snug text-slate-600 sm:text-[8px]">
                Clientes desde {enginesText}{' '}
                <span style={{ color: accent.primary }}>en 90 días</span>
              </p>
              <p className="mt-1 text-[8px] font-bold" style={{ color: accent.primary }}>
                {ctx.domain}
              </p>
              <div className="mt-1.5 space-y-0.5 text-left">
                {[
                  { Icon: Calendar, t: today },
                  { Icon: Target, t: actions != null ? `${actions} acciones` : '—' },
                  { Icon: Clock, t: hours != null ? `${hours} h` : '—' },
                  { Icon: TrendingUp, t: impact },
                ].map(({ Icon, t }) => (
                  <div key={t} className="flex items-center gap-1 text-[7px] text-slate-600">
                    <Icon className="h-2.5 w-2.5" style={{ color: accent.primary }} />
                    <span className="truncate">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded border border-slate-200 bg-white p-1.5 sm:p-2">
              <p className="text-center text-[8px] font-bold uppercase tracking-wide text-slate-700">
                Índice
              </p>
              <ul className="mt-1.5 space-y-1 blur-[1.5px]" aria-hidden>
                {['Resumen', 'Competidores', 'Quick Wins', 'Roadmap'].map((t) => (
                  <li key={t} className="text-[7px] text-slate-500">
                    {t}
                  </li>
                ))}
              </ul>
              <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                <Lock className="h-4 w-4 text-slate-400" />
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-white p-1.5 sm:p-2">
              <p className="text-[8px] font-bold uppercase" style={{ color: accent.primary }}>
                Prioridad #1
              </p>
              <p className="mt-0.5 text-[8px] font-semibold leading-tight text-slate-900 sm:text-[9px]">
                Primeras acciones
              </p>
              <ol className="mt-1.5 space-y-1">
                {faqs.map((q, i) => (
                  <li key={`${i}-${q.slice(0, 16)}`} className="flex gap-1 text-[7px] text-slate-700">
                    <span
                      className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[6px] font-bold text-white"
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
            className="flex items-center gap-2 border-t border-slate-200 px-2 py-1.5"
            style={{ backgroundColor: BAR_BG }}
          >
            <Lock className="h-3 w-3 shrink-0 text-slate-500" />
            <p className="min-w-0 flex-1 truncate text-[8px] font-semibold text-slate-800 sm:text-[9px]">
              Desbloqueá el plan completo
            </p>
            <span
              className="shrink-0 rounded px-2 py-0.5 text-[8px] font-semibold text-white"
              style={{ backgroundColor: accent.primary }}
            >
              Desbloquear
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
