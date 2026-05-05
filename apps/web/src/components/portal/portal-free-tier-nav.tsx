'use client';

import Link from 'next/link';
import { Headphones, Lock } from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';

export type PortalFreeTierNavProps = {
  /** Ruta base para anclas (#portal-cliente, #comparacion, …). Sin barra final. */
  basePath: string;
  analysesUsed: number;
  analysesLimit: number | null;
  renewalLabel: string;
};

export function PortalFreeTierNav({
  basePath,
  analysesUsed,
  analysesLimit,
  renewalLabel,
}: PortalFreeTierNavProps) {
  const analysesLabel =
    analysesLimit == null ? `${analysesUsed} (sin tope declarado)` : `${analysesUsed} / ${analysesLimit}`;
  const base = basePath.replace(/\/$/, '');

  return (
    <aside className="flex h-fit flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] lg:sticky lg:top-5">
      <div className="mb-4 flex items-center gap-2.5">
        <CleexsMark className="h-8 w-8" />
        <p className="text-lg font-bold tracking-tight text-slate-900">Cleexs</p>
      </div>
      <nav className="space-y-1 text-sm">
        <a
          href={`${base}#portal-cliente`}
          className="flex items-center justify-between gap-2 rounded-xl bg-violet-50 px-3 py-2.5 font-semibold text-violet-950 ring-1 ring-violet-100/80"
        >
          Portal cliente
          <span className="rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Free
          </span>
        </a>
        <a
          href={`${base}#comparacion`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
        >
          Comparación
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
            Disponible
          </span>
        </a>
        <a
          href={`${base}#competidores`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
        >
          Competidores
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
            Disponible
          </span>
        </a>
        <a
          href={`${base}#equipo`}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50"
        >
          Equipo
          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
            Disponible
          </span>
        </a>
        {(['Prompts', 'Historial', 'Reportes', 'Herramientas', 'Suscripción'] as const).map((label) => (
          <div
            key={label}
            className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-slate-400"
            title="Incluido en plan Crecimiento / Premium"
          >
            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {label}
          </div>
        ))}
      </nav>

      <div className="mt-6 rounded-xl border border-violet-100/90 bg-gradient-to-br from-violet-50/80 to-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-slate-500">Plan actual</p>
          <span className="rounded-md bg-violet-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Free
          </span>
          <span className="rounded-md border border-amber-200/80 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
            Limitado
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-600">Análisis usados este mes</p>
        <p className="text-sm font-semibold text-slate-900">{analysesLabel} análisis</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{
              width: `${analysesLimit ? Math.min(100, (analysesUsed / Math.max(1, analysesLimit)) * 100) : 50}%`,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Renueva el {renewalLabel}</p>
        <Link
          href="/planes"
          className="mt-3 block w-full rounded-lg border-2 border-violet-500 bg-white py-2.5 text-center text-xs font-semibold text-violet-700 shadow-sm hover:bg-violet-50"
        >
          Actualizar plan
        </Link>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-end pt-6">
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Headphones className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          <span>¿Necesitás ayuda? Contactá a nuestro equipo</span>
        </div>
      </div>
    </aside>
  );
}
