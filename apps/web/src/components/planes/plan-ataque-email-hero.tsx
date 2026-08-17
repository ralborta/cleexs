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

/** Pie visual fiel al mock “Plan listo” (maqueta HTML; en prod → imagen). */
export function PlanAtaqueEmailHero({
  brandName,
  domain,
  accent,
  actionsCount,
  planUrl,
  generatedAt = new Date(),
  className,
}: PlanAtaqueEmailHeroProps) {
  const actions = actionsCount != null ? String(actionsCount) : '—';
  const primary = accent.primary;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.12)]',
        className
      )}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 sm:px-5"
        style={{ backgroundColor: primary }}
      >
        <span
          className="shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em]"
          style={{ color: primary }}
        >
          Plan Conquistar
        </span>
        <span className="truncate text-[10px] font-bold uppercase tracking-[0.06em] text-white sm:text-[11px]">
          Plan de Ataque: dominá ChatGPT en 90 días
        </span>
      </div>

      <div className="relative overflow-hidden px-4 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7">
        {/* Decorative + / curves (como el mock) */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <span
            className="absolute left-[8%] top-[18%] select-none text-[200px] font-black leading-none opacity-[0.06] sm:text-[260px]"
            style={{ color: primary }}
          >
            +
          </span>
          <svg
            className="absolute -right-8 top-8 h-[70%] w-[55%] opacity-[0.08]"
            viewBox="0 0 400 400"
            fill="none"
          >
            <path
              d="M40 320C120 200 200 120 380 40"
              stroke={primary}
              strokeWidth="28"
              strokeLinecap="round"
            />
            <path
              d="M20 360C140 240 240 160 390 90"
              stroke={primary}
              strokeWidth="14"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[1.2fr_0.9fr] lg:gap-4">
          {/* —— Izquierda —— */}
          <div className="min-w-0">
            {/* Logo en caja de marca */}
            <div
              className="mb-4 inline-flex items-center justify-center rounded-xl p-2.5 shadow-md"
              style={{ backgroundColor: primary }}
            >
              <div className="rounded-md bg-white/95 p-1">
                <BrandLogo
                  name={brandName}
                  domain={domain}
                  size={44}
                  variant="logo"
                  hideIfMissing
                  className="rounded"
                />
              </div>
            </div>

            <h2 className="max-w-[20ch] text-[1.55rem] font-black leading-[1.15] tracking-tight text-slate-900 sm:text-[1.85rem]">
              Tu Plan de Ataque{' '}
              <span style={{ color: primary }}>personalizado</span> está listo.
            </h2>

            <p className="mt-2.5 text-[13px] text-slate-600 sm:text-sm">
              Preparado exclusivamente para{' '}
              <span className="font-extrabold" style={{ color: primary }}>
                {domain}
              </span>
            </p>

            {/* Pill claim */}
            <div className="mt-4 flex max-w-md items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.06)]">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `${primary}18`, color: primary }}
              >
                <Target className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <p className="text-[12px] leading-snug text-slate-700 sm:text-[13px]">
                No genérico. No teórico.{' '}
                <span className="font-extrabold" style={{ color: primary }}>
                  Hecho 100% para tu negocio.
                </span>
              </p>
            </div>

            {/* 3 stats */}
            <div className="mt-4 grid max-w-md grid-cols-3 gap-2.5">
              {[
                {
                  Icon: Target,
                  value: actions,
                  label: (
                    <>
                      ACCIONES
                      <br />
                      <span className="font-semibold text-slate-500">prioritarias</span>
                    </>
                  ),
                },
                {
                  Icon: TrendingUp,
                  value: 'ALTO',
                  label: (
                    <>
                      IMPACTO
                      <br />
                      <span className="font-semibold text-slate-500">en tu negocio</span>
                    </>
                  ),
                },
                {
                  Icon: Calendar,
                  value: '90',
                  label: (
                    <>
                      DÍAS
                      <br />
                      <span className="font-semibold text-slate-500">para resultados</span>
                    </>
                  ),
                },
              ].map(({ Icon, value, label }) => (
                <div
                  key={String(value) + String(label)}
                  className="rounded-2xl border border-slate-100 bg-white px-2 py-3 text-center shadow-[0_6px_16px_rgba(15,23,42,0.07)]"
                >
                  <Icon
                    className="mx-auto h-[22px] w-[22px]"
                    strokeWidth={2.4}
                    style={{ color: primary }}
                  />
                  <p
                    className="mt-1.5 text-lg font-black leading-none tracking-tight sm:text-xl"
                    style={{ color: primary }}
                  >
                    {value}
                  </p>
                  <p className="mt-1 text-[9px] font-extrabold uppercase leading-tight tracking-wide text-slate-800 sm:text-[10px]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* —— Derecha: libro 3D —— */}
          <div className="flex justify-center lg:justify-end lg:pr-2">
            <div
              className="relative w-[210px] sm:w-[245px]"
              style={{
                transform: 'perspective(1000px) rotateY(-18deg) rotateX(6deg)',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Sombra en el piso */}
              <div
                className="absolute -bottom-3 left-[8%] right-[2%] h-4 rounded-[100%] bg-black/25 blur-md"
                aria-hidden
              />

              {/* Lomo */}
              <div
                className="absolute -left-[10px] top-1 bottom-1 w-[12px] rounded-l-[3px]"
                style={{
                  background: `linear-gradient(90deg, ${primary}cc, ${primary})`,
                  transform: 'rotateY(25deg)',
                  transformOrigin: 'right center',
                }}
                aria-hidden
              />

              {/* Páginas (canto derecho) */}
              <div
                className="absolute -right-[6px] top-2 bottom-2 w-[8px] rounded-r-sm bg-gradient-to-r from-slate-200 to-slate-100"
                style={{ boxShadow: '2px 0 6px rgba(0,0,0,0.12)' }}
                aria-hidden
              />

              {/* Tapa */}
              <div
                className="relative overflow-hidden rounded-[6px] bg-white"
                style={{
                  boxShadow:
                    '0 18px 40px rgba(15,23,42,0.28), 0 2px 0 rgba(255,255,255,0.5) inset',
                }}
              >
                {/* Mitad superior roja */}
                <div className="px-4 pb-4 pt-5 text-center" style={{ backgroundColor: primary }}>
                  <div className="mx-auto mb-3 inline-flex rounded-md bg-white px-2 py-1.5 shadow-sm">
                    <BrandLogo
                      name={brandName}
                      domain={domain}
                      size={32}
                      variant="logo"
                      hideIfMissing
                      className="rounded"
                    />
                  </div>
                  <p className="text-[11px] font-black uppercase leading-snug tracking-tight text-white">
                    Plan de Ataque para conquistar ChatGPT en 90 días
                  </p>
                  <p className="mx-auto mt-2.5 w-fit rounded-full bg-white px-2.5 py-0.5 text-[9px] font-extrabold"
                    style={{ color: primary }}
                  >
                    {domain}
                  </p>
                </div>

                {/* Mitad inferior blanca */}
                <div className="bg-white px-3 py-3.5">
                  <div className="flex justify-around gap-1 text-center">
                    {[
                      { Icon: Target, v: actions, l: 'acciones' },
                      { Icon: TrendingUp, v: 'ALTO', l: 'impacto' },
                      { Icon: Calendar, v: '90', l: 'días' },
                    ].map(({ Icon, v, l }) => (
                      <div key={l} className="min-w-0 flex-1">
                        <Icon
                          className="mx-auto h-4 w-4"
                          strokeWidth={2.5}
                          style={{ color: primary }}
                        />
                        <p
                          className="mt-1 text-sm font-black leading-none"
                          style={{ color: primary }}
                        >
                          {v}
                        </p>
                        <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-500">
                          {l}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer tapa */}
                <div
                  className="px-2 py-2 text-center text-[7.5px] font-bold uppercase leading-tight tracking-wider text-white"
                  style={{ backgroundColor: primary }}
                >
                  Generado el {formatGeneratedEs(generatedAt)}
                  <br />
                  <span className="opacity-90">Plan personalizado · Confidencial</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={planUrl}
          className="relative z-10 mt-6 flex w-full items-center justify-between gap-3 rounded-full px-4 py-3.5 text-left text-[13px] font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition hover:brightness-110 sm:px-6 sm:py-4 sm:text-[15px]"
          style={{ backgroundColor: primary }}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Rocket className="h-5 w-5 shrink-0" strokeWidth={2.25} />
            <span className="leading-snug">
              Quiero ver mi Plan de Ataque completo y empezar a ganar desde ChatGPT
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
