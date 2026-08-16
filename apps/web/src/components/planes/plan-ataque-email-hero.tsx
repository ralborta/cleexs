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

/** Pie visual tipo mock “Plan listo” — maqueta HTML (en prod real iría como imagen + CTA). */
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
  const soft = accent.soft || `${primary}22`;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5"
        style={{ backgroundColor: primary }}
      >
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
          style={{ color: primary }}
        >
          Plan Conquistar
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/95 sm:text-[11px]">
          Plan de Ataque: dominá ChatGPT en 90 días
        </span>
      </div>

      <div className="relative px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
        {/* Watermark + */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.07]"
          aria-hidden
        >
          <span className="select-none text-[220px] font-black leading-none" style={{ color: primary }}>
            +
          </span>
        </div>

        <div className="relative z-10 grid gap-5 md:grid-cols-[1.15fr_0.85fr] md:items-center">
          {/* Left */}
          <div>
            <div className="mb-3 w-fit rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-black/5">
              <BrandLogo
                name={brandName}
                domain={domain}
                size={48}
                variant="logo"
                hideIfMissing
                className="rounded-md"
              />
            </div>

            <h2 className="text-[1.35rem] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[1.65rem]">
              Tu Plan de Ataque personalizado{' '}
              <span style={{ color: primary }}>está listo.</span>
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Preparado exclusivamente para{' '}
              <span className="font-bold" style={{ color: primary }}>
                {domain}
              </span>
            </p>

            <div className="mt-4 flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: primary }}
              >
                <Target className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              <p className="text-[12px] leading-snug text-slate-700 sm:text-[13px]">
                No genérico. No teórico.{' '}
                <span className="font-bold" style={{ color: primary }}>
                  Hecho 100% para tu negocio.
                </span>
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                {
                  Icon: Target,
                  line: (
                    <>
                      <span className="font-extrabold" style={{ color: primary }}>
                        {actions}
                      </span>{' '}
                      <span className="font-bold text-slate-800">ACCIONES</span>
                      <br />
                      <span className="font-normal text-slate-500">prioritarias</span>
                    </>
                  ),
                },
                {
                  Icon: TrendingUp,
                  line: (
                    <>
                      <span className="font-extrabold" style={{ color: primary }}>
                        ALTO
                      </span>{' '}
                      <span className="font-bold text-slate-800">IMPACTO</span>
                      <br />
                      <span className="font-normal text-slate-500">en tu negocio</span>
                    </>
                  ),
                },
                {
                  Icon: Calendar,
                  line: (
                    <>
                      <span className="font-extrabold" style={{ color: primary }}>
                        90
                      </span>{' '}
                      <span className="font-bold text-slate-800">DÍAS</span>
                      <br />
                      <span className="font-normal text-slate-500">para resultados</span>
                    </>
                  ),
                },
              ].map(({ Icon, line }, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-100 bg-white px-2 py-2.5 text-center shadow-sm"
                >
                  <Icon
                    className="mx-auto h-5 w-5"
                    strokeWidth={2.25}
                    style={{ color: primary }}
                  />
                  <p className="mt-1.5 text-[10px] leading-tight sm:text-[11px]">{line}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: book mock */}
          <div className="flex justify-center md:justify-end">
            <div
              className="relative w-[200px] sm:w-[230px]"
              style={{
                transform: 'perspective(900px) rotateY(-12deg) rotateX(4deg)',
              }}
            >
              <div
                className="absolute -right-1.5 top-2 bottom-2 w-3 rounded-r-md"
                style={{ backgroundColor: primary, opacity: 0.85 }}
              />
              <div className="relative overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
                <div className="px-3 pb-3 pt-4" style={{ background: soft }}>
                  <div className="mx-auto mb-2 w-fit rounded bg-white/90 p-0.5 shadow-sm">
                    <BrandLogo
                      name={brandName}
                      domain={domain}
                      size={36}
                      variant="logo"
                      hideIfMissing
                      className="rounded"
                    />
                  </div>
                  <p className="text-center text-[10px] font-extrabold leading-snug tracking-tight text-slate-900">
                    PLAN DE ATAQUE PARA CONQUISTAR CHATGPT EN 90 DÍAS
                  </p>
                  <p
                    className="mx-auto mt-2 w-fit rounded-full bg-white px-2.5 py-0.5 text-[9px] font-bold shadow-sm"
                    style={{ color: primary }}
                  >
                    {domain}
                  </p>
                  <div className="mt-3 flex justify-center gap-3 text-[9px] font-bold text-slate-600">
                    <span className="flex flex-col items-center gap-0.5">
                      <Target className="h-3.5 w-3.5" style={{ color: primary }} />
                      {actions}
                    </span>
                    <span className="flex flex-col items-center gap-0.5">
                      <TrendingUp className="h-3.5 w-3.5" style={{ color: primary }} />
                      ALTO
                    </span>
                    <span className="flex flex-col items-center gap-0.5">
                      <Calendar className="h-3.5 w-3.5" style={{ color: primary }} />
                      90
                    </span>
                  </div>
                </div>
                <div
                  className="px-2 py-2 text-center text-[8px] font-bold uppercase leading-tight tracking-wide text-white"
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
          className="relative z-10 mt-5 flex w-full items-center justify-between gap-3 rounded-full px-4 py-3.5 text-left text-sm font-bold text-white shadow-md transition hover:brightness-110 sm:px-5 sm:text-[15px]"
          style={{ backgroundColor: primary }}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <Rocket className="h-5 w-5 shrink-0" />
            <span className="leading-snug">
              Quiero ver mi Plan de Ataque completo y empezar a ganar desde ChatGPT
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Link>
      </div>
    </div>
  );
}
