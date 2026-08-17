'use client';

import Link from 'next/link';
import { ArrowRight, Calendar, Rocket, Target, TrendingUp } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { IndustryCoverWatermark } from '@/components/planes/industry-cover-watermark';
import type { BrandAccent } from '@/lib/brand-accent-from-logo';
import { cn } from '@/lib/utils';

export type PlanAtaqueEmailHeroProps = {
  brandName: string;
  domain: string;
  accent: BrandAccent;
  actionsCount: number | null;
  planUrl: string;
  generatedAt?: Date;
  industry?: string | null;
  className?: string;
};

function formatGeneratedEs(d: Date) {
  return d
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase();
}

/** Pie visual v4 — más fiel al PNG de referencia del cliente. */
export function PlanAtaqueEmailHero({
  brandName,
  domain,
  accent,
  actionsCount,
  planUrl,
  generatedAt = new Date(),
  industry,
  className,
}: PlanAtaqueEmailHeroProps) {
  const actions = actionsCount != null && actionsCount > 0 ? String(actionsCount) : '9';
  const primary = accent.primary;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[22px] border border-slate-200/90 bg-white',
        'shadow-[0_20px_60px_rgba(15,23,42,0.16)]',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3 sm:px-7"
        style={{ backgroundColor: primary }}
      >
        <span
          className="shrink-0 rounded-full bg-white px-3.5 py-1 text-[10px] font-black uppercase tracking-[0.04em] sm:text-[11px]"
          style={{ color: primary }}
        >
          Plan Conquistar
        </span>
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white sm:text-[12px]">
          Plan de Ataque: dominá ChatGPT en 90 días
        </span>
      </div>

      <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-slate-50 px-5 py-8 sm:px-8 sm:py-9">
        {/* Watermark de rubro (como Switch en el mock Nintendo) */}
        <IndustryCoverWatermark
          industry={industry}
          domain={domain}
          brandName={brandName}
          accent={accent}
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.11]"
        />

        {/* + y curvas */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <span
            className="absolute left-[4%] top-[8%] select-none font-black leading-none opacity-[0.07]"
            style={{ color: primary, fontSize: 'clamp(160px, 32vw, 280px)' }}
          >
            +
          </span>
          <svg
            className="absolute -bottom-10 -right-6 h-[90%] w-[55%] opacity-[0.1]"
            viewBox="0 0 420 420"
            fill="none"
          >
            <path
              d="M10 390C150 250 250 140 430 10"
              stroke={primary}
              strokeWidth="40"
              strokeLinecap="round"
            />
            <path
              d="M0 410C170 270 290 160 430 50"
              stroke={primary}
              strokeWidth="18"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-6">
          {/* IZQUIERDA */}
          <div className="min-w-0">
            <div
              className="mb-5 inline-flex rounded-2xl p-3 shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
              style={{ backgroundColor: primary }}
            >
              <div className="rounded-xl bg-white p-2">
                <BrandLogo
                  name={brandName}
                  domain={domain}
                  size={56}
                  variant="logo"
                  hideIfMissing
                  className="rounded-lg"
                />
              </div>
            </div>

            <h2 className="max-w-[19ch] text-[1.85rem] font-black leading-[1.1] tracking-[-0.025em] text-slate-900 sm:text-[2.35rem]">
              Tu Plan de Ataque personalizado{' '}
              <span style={{ color: primary }}>está listo.</span>
            </h2>

            <p className="mt-3 text-[14px] text-slate-500 sm:text-[15px]">
              Preparado exclusivamente para{' '}
              <span className="font-black" style={{ color: primary }}>
                {domain}
              </span>
            </p>

            <div className="mt-5 flex max-w-md items-center gap-3 rounded-2xl border border-slate-100/80 bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${primary}14`, color: primary }}
              >
                <Target className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <p className="text-[13px] leading-snug text-slate-700 sm:text-[14px]">
                No genérico. No teórico.{' '}
                <span className="font-black" style={{ color: primary }}>
                  Hecho 100% para tu negocio.
                </span>
              </p>
            </div>

            <div className="mt-5 grid max-w-md grid-cols-3 gap-3">
              {[
                { Icon: Target, value: actions, top: 'ACCIONES', bottom: 'prioritarias' },
                { Icon: TrendingUp, value: 'ALTO', top: 'IMPACTO', bottom: 'en tu negocio' },
                { Icon: Calendar, value: '90', top: 'DÍAS', bottom: 'para resultados' },
              ].map(({ Icon, value, top, bottom }) => (
                <div
                  key={top}
                  className="rounded-2xl border border-slate-100 bg-white px-2 py-4 text-center shadow-[0_10px_26px_rgba(15,23,42,0.09)]"
                >
                  <Icon className="mx-auto h-6 w-6" strokeWidth={2.4} style={{ color: primary }} />
                  <p
                    className="mt-2.5 text-[1.45rem] font-black leading-none tracking-tight sm:text-[1.65rem]"
                    style={{ color: primary }}
                  >
                    {value}
                  </p>
                  <p className="mt-2 text-[10px] font-black uppercase leading-[1.15] tracking-wide text-slate-900">
                    {top}
                    <br />
                    <span className="font-semibold normal-case tracking-normal text-slate-500">
                      {bottom}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* DERECHA — libro más realista */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative h-[340px] w-[260px] sm:h-[380px] sm:w-[290px]">
              {/* Sombra elíptica */}
              <div
                className="absolute bottom-2 left-[18%] right-[-4%] h-6 rounded-[100%] bg-black/35 blur-md"
                aria-hidden
              />

              {/* Grupo 3D */}
              <div
                className="absolute inset-x-4 bottom-6 top-0"
                style={{
                  transform: 'perspective(1200px) rotateY(-26deg) rotateX(9deg) rotateZ(-2deg)',
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Lomo */}
                <div
                  className="absolute left-0 top-1 bottom-1 w-[18px] -translate-x-[17px] rounded-l-[5px]"
                  style={{
                    background: `linear-gradient(90deg, #0f172a 0%, #334155 18%, ${primary} 55%, ${primary} 100%)`,
                    boxShadow: '-6px 4px 16px rgba(0,0,0,0.35)',
                    transform: 'rotateY(18deg)',
                    transformOrigin: 'right center',
                  }}
                  aria-hidden
                />

                {/* Páginas */}
                <div
                  className="absolute right-0 top-2 bottom-2 w-[12px] translate-x-[10px] rounded-r-[3px]"
                  style={{
                    background:
                      'linear-gradient(90deg, #cbd5e1, #f8fafc 30%, #e2e8f0 55%, #f1f5f9)',
                    boxShadow: '4px 2px 10px rgba(0,0,0,0.2)',
                  }}
                  aria-hidden
                />

                {/* Tapa */}
                <div
                  className="relative flex h-full flex-col overflow-hidden rounded-[8px] bg-white"
                  style={{
                    boxShadow:
                      '0 28px 55px rgba(15,23,42,0.4), inset 0 1px 0 rgba(255,255,255,0.7)',
                  }}
                >
                  <div
                    className="flex flex-[1.15] flex-col items-center px-5 pb-4 pt-6 text-center"
                    style={{ backgroundColor: primary }}
                  >
                    <div className="mb-3 rounded-lg bg-white px-2.5 py-2 shadow-md">
                      <BrandLogo
                        name={brandName}
                        domain={domain}
                        size={42}
                        variant="logo"
                        hideIfMissing
                        className="rounded"
                      />
                    </div>
                    <p className="text-[12px] font-black uppercase leading-snug tracking-tight text-white sm:text-[13px]">
                      Plan de Ataque para conquistar ChatGPT en 90 días
                    </p>
                    <div className="mt-3 rounded-full bg-white px-3 py-1.5 shadow-sm">
                      <p className="text-[9px] font-semibold text-slate-500">
                        Preparado exclusivamente para
                      </p>
                      <p className="text-[11px] font-black" style={{ color: primary }}>
                        {domain}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between bg-white px-4 pb-3 pt-4">
                    <div className="flex justify-between gap-1 text-center">
                      {[
                        { Icon: Target, v: actions, l: 'acciones' },
                        { Icon: TrendingUp, v: 'ALTO', l: 'impacto' },
                        { Icon: Calendar, v: '90', l: 'días' },
                      ].map(({ Icon, v, l }) => (
                        <div key={l} className="min-w-0 flex-1">
                          <Icon
                            className="mx-auto h-5 w-5"
                            strokeWidth={2.5}
                            style={{ color: primary }}
                          />
                          <p
                            className="mt-1.5 text-[15px] font-black leading-none"
                            style={{ color: primary }}
                          >
                            {v}
                          </p>
                          <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                            {l}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 border-t pt-2.5 text-center" style={{ borderColor: primary }}>
                      <p className="text-[8px] font-bold uppercase leading-tight tracking-wider text-slate-800">
                        Generado el {formatGeneratedEs(generatedAt)}
                      </p>
                      <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-500">
                        Plan personalizado · Confidencial
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={planUrl}
          className="relative z-10 mt-8 flex w-full items-center justify-between gap-3 rounded-full px-5 py-4 text-left text-[13px] font-bold text-white shadow-[0_12px_32px_rgba(0,0,0,0.25)] transition hover:brightness-110 sm:px-8 sm:py-[1.15rem] sm:text-[15px]"
          style={{ backgroundColor: primary }}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Rocket className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={2.25} />
            <span className="leading-snug">
              Quiero ver mi Plan de Ataque completo y empezar a ganar desde ChatGPT
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
