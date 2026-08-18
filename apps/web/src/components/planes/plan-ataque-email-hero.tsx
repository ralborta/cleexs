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

/**
 * Pie del mail día 0 — v5 (feedback cliente):
 * 1) Título full-width arriba
 * 2) Abajo: caja gráfica (stats + libro)
 * Sin nombres internos (“Plan Conquistar”). CTA orientado a clientes.
 */
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
      {/* Barra beneficio (sin nombre interno) */}
      <div
        className="px-5 py-3 text-center sm:px-7 sm:text-left"
        style={{ backgroundColor: primary }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-white sm:text-[12px]">
          Plan de ataque para dominar ChatGPT en 90 días
        </p>
      </div>

      <div className="relative overflow-hidden bg-gradient-to-br from-white via-white to-slate-50 px-5 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
        <IndustryCoverWatermark
          industry={industry}
          domain={domain}
          brandName={brandName}
          accent={accent}
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.1]"
        />
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <span
            className="absolute left-[3%] top-[28%] select-none font-black leading-none opacity-[0.06]"
            style={{ color: primary, fontSize: 'clamp(140px, 28vw, 240px)' }}
          >
            +
          </span>
        </div>

        {/* 1) ENCABEZADO full width — primero, solo */}
        <div className="relative z-10 mb-6 border-b border-slate-100 pb-5 sm:mb-7 sm:pb-6">
          <div className="mb-3 inline-flex rounded-2xl p-2.5 shadow-md" style={{ backgroundColor: primary }}>
            <div className="rounded-xl bg-white p-1.5">
              <BrandLogo
                name={brandName}
                domain={domain}
                size={48}
                variant="logo"
                hideIfMissing
                className="rounded-lg"
              />
            </div>
          </div>

          <h2 className="w-full text-[1.75rem] font-black leading-[1.12] tracking-[-0.025em] text-slate-900 sm:text-[2.25rem]">
            Tu Plan de Ataque personalizado{' '}
            <span style={{ color: primary }}>está listo.</span>
          </h2>

          <p className="mt-2.5 text-[14px] text-slate-500 sm:text-[15px]">
            Preparado exclusivamente para{' '}
            <span className="font-black" style={{ color: primary }}>
              {domain}
            </span>
          </p>
        </div>

        {/* 2) CAJA / GRÁFICO debajo — se adapta en columnas */}
        <div className="relative z-10 grid items-center gap-7 lg:grid-cols-[1.15fr_0.95fr] lg:gap-5">
          <div className="min-w-0">
            <div className="flex max-w-md items-center gap-3 rounded-2xl border border-slate-100/80 bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
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

            <div className="mt-4 grid max-w-md grid-cols-3 gap-3">
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

          {/* Libro = sensación de plan ya armado */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative h-[300px] w-[230px] sm:h-[340px] sm:w-[260px]">
              <div
                className="absolute bottom-2 left-[18%] right-[-4%] h-6 rounded-[100%] bg-black/30 blur-md"
                aria-hidden
              />
              <div
                className="absolute inset-x-3 bottom-5 top-0"
                style={{
                  transform: 'perspective(1200px) rotateY(-24deg) rotateX(8deg) rotateZ(-2deg)',
                  transformStyle: 'preserve-3d',
                }}
              >
                <div
                  className="absolute left-0 top-1 bottom-1 w-[16px] -translate-x-[15px] rounded-l-[5px]"
                  style={{
                    background: `linear-gradient(90deg, #0f172a 0%, #334155 18%, ${primary} 55%, ${primary})`,
                    boxShadow: '-6px 4px 16px rgba(0,0,0,0.35)',
                    transform: 'rotateY(18deg)',
                    transformOrigin: 'right center',
                  }}
                  aria-hidden
                />
                <div
                  className="absolute right-0 top-2 bottom-2 w-[11px] translate-x-[9px] rounded-r-[3px]"
                  style={{
                    background:
                      'linear-gradient(90deg, #cbd5e1, #f8fafc 30%, #e2e8f0 55%, #f1f5f9)',
                    boxShadow: '4px 2px 10px rgba(0,0,0,0.2)',
                  }}
                  aria-hidden
                />
                <div
                  className="relative flex h-full flex-col overflow-hidden rounded-[8px] bg-white"
                  style={{
                    boxShadow:
                      '0 28px 55px rgba(15,23,42,0.4), inset 0 1px 0 rgba(255,255,255,0.7)',
                  }}
                >
                  <div
                    className="flex flex-[1.1] flex-col items-center px-4 pb-3 pt-5 text-center"
                    style={{ backgroundColor: primary }}
                  >
                    <div className="mb-2.5 rounded-lg bg-white px-2 py-1.5 shadow-md">
                      <BrandLogo
                        name={brandName}
                        domain={domain}
                        size={36}
                        variant="logo"
                        hideIfMissing
                        className="rounded"
                      />
                    </div>
                    <p className="text-[11px] font-black uppercase leading-snug tracking-tight text-white sm:text-[12px]">
                      Plan de ataque para dominar ChatGPT en 90 días
                    </p>
                    <p
                      className="mt-2.5 rounded-full bg-white px-2.5 py-1 text-[10px] font-black"
                      style={{ color: primary }}
                    >
                      {domain}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col justify-between bg-white px-3 pb-2.5 pt-3">
                    <div className="flex justify-between gap-1 text-center">
                      {[
                        { Icon: Target, v: actions, l: 'acciones' },
                        { Icon: TrendingUp, v: 'ALTO', l: 'impacto' },
                        { Icon: Calendar, v: '90', l: 'días' },
                      ].map(({ Icon, v, l }) => (
                        <div key={l} className="min-w-0 flex-1">
                          <Icon
                            className="mx-auto h-4.5 w-4.5"
                            strokeWidth={2.5}
                            style={{ color: primary }}
                          />
                          <p
                            className="mt-1 text-[14px] font-black leading-none"
                            style={{ color: primary }}
                          >
                            {v}
                          </p>
                          <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                            {l}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div
                      className="mt-2 border-t pt-2 text-center"
                      style={{ borderColor: primary }}
                    >
                      <p className="text-[7.5px] font-bold uppercase leading-tight tracking-wider text-slate-800">
                        Generado el {formatGeneratedEs(generatedAt)}
                      </p>
                      <p className="mt-0.5 text-[7.5px] font-semibold uppercase tracking-wider text-slate-500">
                        Plan personalizado · Confidencial
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA — beneficio comercial */}
        <Link
          href={planUrl}
          className="relative z-10 mt-7 flex w-full items-center justify-center gap-3 rounded-full px-5 py-4 text-center text-[14px] font-bold text-white shadow-[0_12px_32px_rgba(0,0,0,0.25)] transition hover:brightness-110 sm:px-8 sm:py-[1.15rem] sm:text-[16px]"
          style={{ backgroundColor: primary }}
        >
          <Rocket className="h-5 w-5 shrink-0" strokeWidth={2.25} />
          <span>Empezar a conseguir clientes desde ChatGPT</span>
          <ArrowRight className="h-5 w-5 shrink-0" strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  );
}
