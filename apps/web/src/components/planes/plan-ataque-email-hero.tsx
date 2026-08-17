'use client';

import Link from 'next/link';
import { ArrowRight, Calendar, Rocket, Target, TrendingUp } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import type { BrandAccent } from '@/lib/brand-accent-from-logo';
import { cn } from '@/lib/utils';

export type PlanAtaqueEmailHeroProps = {
  brandName: string;
  domain: string;
  accent: BrandAccent;
  actionsCount: number | null;
  planUrl: string;
  generatedAt?: Date;
  className?: string;
};

function formatGeneratedEs(d: Date) {
  return d
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
    .toUpperCase();
}

/**
 * Pie visual fiel al mock “Plan listo”.
 * v3: tipografía grande, libro más 3D, stats como el PNG de referencia.
 */
export function PlanAtaqueEmailHero({
  brandName,
  domain,
  accent,
  actionsCount,
  planUrl,
  generatedAt = new Date(),
  className,
}: PlanAtaqueEmailHeroProps) {
  const actions = actionsCount != null && actionsCount > 0 ? String(actionsCount) : '9';
  const primary = accent.primary;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[20px] border border-slate-200 bg-white',
        'shadow-[0_16px_48px_rgba(15,23,42,0.14)]',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-4 py-3 sm:gap-3 sm:px-6"
        style={{ backgroundColor: primary }}
      >
        <span
          className="shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide"
          style={{ color: primary }}
        >
          Plan Conquistar
        </span>
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-white sm:text-[12px]">
          Plan de Ataque: dominá ChatGPT en 90 días
        </span>
      </div>

      <div className="relative overflow-hidden bg-white px-4 py-7 sm:px-8 sm:py-8">
        {/* Decoración fondo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          <div
            className="absolute left-[-40px] top-[40px] h-[280px] w-[280px] rounded-full opacity-[0.07]"
            style={{
              background: `radial-gradient(circle, ${primary} 0%, transparent 70%)`,
            }}
          />
          <span
            className="absolute left-[6%] top-[12%] select-none font-black leading-none opacity-[0.08]"
            style={{ color: primary, fontSize: 'clamp(140px, 28vw, 240px)' }}
          >
            +
          </span>
          <svg
            className="absolute bottom-0 right-0 h-[85%] w-[60%] opacity-[0.09]"
            viewBox="0 0 420 420"
            fill="none"
          >
            <path
              d="M20 380C140 240 240 140 420 20"
              stroke={primary}
              strokeWidth="36"
              strokeLinecap="round"
            />
            <path
              d="M0 400C160 260 280 160 420 60"
              stroke={primary}
              strokeWidth="16"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1.15fr_0.95fr]">
          {/* IZQUIERDA */}
          <div>
            <div
              className="mb-5 inline-flex items-center justify-center rounded-2xl p-3 shadow-lg"
              style={{ backgroundColor: primary }}
            >
              <div className="rounded-lg bg-white p-1.5">
                <BrandLogo
                  name={brandName}
                  domain={domain}
                  size={52}
                  variant="logo"
                  hideIfMissing
                  className="rounded-md"
                />
              </div>
            </div>

            <h2 className="max-w-[18ch] text-[1.75rem] font-black leading-[1.12] tracking-[-0.02em] text-slate-900 sm:text-[2.15rem]">
              Tu Plan de Ataque{' '}
              <span style={{ color: primary }}>personalizado</span> está listo.
            </h2>

            <p className="mt-3 text-[14px] text-slate-600 sm:text-[15px]">
              Preparado exclusivamente para{' '}
              <span className="font-black" style={{ color: primary }}>
                {domain}
              </span>
            </p>

            <div className="mt-5 flex max-w-lg items-center gap-3 rounded-full border border-slate-100 bg-white/90 px-4 py-3 shadow-[0_6px_20px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${primary}1a`, color: primary }}
              >
                <Target className="h-4.5 w-4.5" strokeWidth={2.6} />
              </span>
              <p className="text-[13px] leading-snug text-slate-700 sm:text-[14px]">
                No genérico. No teórico.{' '}
                <span className="font-black" style={{ color: primary }}>
                  Hecho 100% para tu negocio.
                </span>
              </p>
            </div>

            <div className="mt-5 grid max-w-lg grid-cols-3 gap-3">
              {[
                {
                  Icon: Target,
                  value: actions,
                  top: 'ACCIONES',
                  bottom: 'prioritarias',
                },
                {
                  Icon: TrendingUp,
                  value: 'ALTO',
                  top: 'IMPACTO',
                  bottom: 'en tu negocio',
                },
                {
                  Icon: Calendar,
                  value: '90',
                  top: 'DÍAS',
                  bottom: 'para resultados',
                },
              ].map(({ Icon, value, top, bottom }) => (
                <div
                  key={top}
                  className="rounded-2xl border border-slate-100 bg-white px-2.5 py-3.5 text-center shadow-[0_8px_22px_rgba(15,23,42,0.08)]"
                >
                  <Icon
                    className="mx-auto h-6 w-6"
                    strokeWidth={2.4}
                    style={{ color: primary }}
                  />
                  <p
                    className="mt-2 text-[1.35rem] font-black leading-none tracking-tight sm:text-[1.5rem]"
                    style={{ color: primary }}
                  >
                    {value}
                  </p>
                  <p className="mt-1.5 text-[10px] font-black uppercase leading-tight tracking-wide text-slate-900">
                    {top}
                  </p>
                  <p className="text-[10px] font-semibold leading-tight text-slate-500">{bottom}</p>
                </div>
              ))}
            </div>
          </div>

          {/* DERECHA — libro */}
          <div className="flex justify-center pb-4 lg:justify-end lg:pb-2 lg:pr-1">
            <div
              className="relative w-[230px] sm:w-[270px]"
              style={{
                transform: 'perspective(1100px) rotateY(-22deg) rotateX(8deg)',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Sombra piso */}
              <div
                className="absolute -bottom-5 left-[10%] right-0 h-5 rounded-[100%] bg-black/30 blur-md"
                aria-hidden
              />

              {/* Lomo grueso */}
              <div
                className="absolute -left-[14px] top-2 bottom-2 w-[14px] rounded-l-[4px]"
                style={{
                  background: `linear-gradient(90deg, #1a1a1a 0%, ${primary} 35%, ${primary} 100%)`,
                  boxShadow: '-4px 0 12px rgba(0,0,0,0.25)',
                }}
                aria-hidden
              />

              {/* Canto páginas */}
              <div
                className="absolute -right-[8px] top-3 bottom-3 w-[10px] rounded-r-[2px]"
                style={{
                  background:
                    'repeating-linear-gradient(180deg, #f8fafc 0px, #e2e8f0 1px, #f1f5f9 2px, #fff 3px)',
                  boxShadow: '3px 0 8px rgba(0,0,0,0.15)',
                }}
                aria-hidden
              />

              {/* Tapa */}
              <div
                className="relative overflow-hidden rounded-[8px] bg-white"
                style={{
                  boxShadow:
                    '0 24px 50px rgba(15,23,42,0.35), inset 0 1px 0 rgba(255,255,255,0.6)',
                }}
              >
                <div className="px-5 pb-5 pt-6 text-center" style={{ backgroundColor: primary }}>
                  <div className="mx-auto mb-3.5 inline-flex rounded-md bg-white px-2.5 py-2 shadow-md">
                    <BrandLogo
                      name={brandName}
                      domain={domain}
                      size={40}
                      variant="logo"
                      hideIfMissing
                      className="rounded"
                    />
                  </div>
                  <p className="text-[12px] font-black uppercase leading-snug tracking-tight text-white">
                    Plan de Ataque para conquistar ChatGPT en 90 días
                  </p>
                  <p
                    className="mx-auto mt-3 w-fit rounded-full bg-white px-3 py-1 text-[10px] font-black"
                    style={{ color: primary }}
                  >
                    {domain}
                  </p>
                </div>

                <div className="bg-white px-4 py-4">
                  <div className="flex justify-between gap-2 text-center">
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
                          className="mt-1.5 text-base font-black leading-none"
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
                </div>

                <div
                  className="px-3 py-2.5 text-center text-[8px] font-bold uppercase leading-tight tracking-wider text-white"
                  style={{ backgroundColor: primary }}
                >
                  Generado el {formatGeneratedEs(generatedAt)}
                  <br />
                  <span className="opacity-95">Plan personalizado · Confidencial</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={planUrl}
          className="relative z-10 mt-8 flex w-full items-center justify-between gap-3 rounded-full px-5 py-4 text-left text-[13px] font-bold text-white shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition hover:brightness-110 sm:px-7 sm:text-[15px]"
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
