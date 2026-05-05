'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  FileBarChart2,
  History,
  LayoutDashboard,
  MessageSquare,
  Scale,
  Sparkles,
  Target,
  Users,
  Wrench,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';

export type PortalCrecimientoTierNavProps = {
  basePath: string;
  runId: string;
  planLabel: string;
  analysesUsed: number;
  analysesLimit: number | null;
  renewalLabel: string;
};

function NavRow({
  href,
  icon: Icon,
  children,
  active,
  anchor,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  active?: boolean;
  anchor?: boolean;
}) {
  const cls = `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
    active ? 'bg-violet-50 font-semibold text-violet-900' : 'text-slate-600 hover:bg-slate-50'
  }`;
  const inner = (
    <>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
        <Icon className="h-3.5 w-3.5 text-violet-700" aria-hidden />
      </span>
      <span>{children}</span>
    </>
  );
  if (anchor) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/** Menú izquierdo alineado al hub Premium (misma jerarquía e iconografía). */
export function PortalCrecimientoTierNav({
  basePath,
  runId,
  planLabel,
  analysesUsed,
  analysesLimit,
  renewalLabel,
}: PortalCrecimientoTierNavProps) {
  const pathname = usePathname();
  const base = basePath.replace(/\/$/, '');
  const onCliente = pathname?.includes('/cliente') ?? false;
  const premium = `/portal-crecimiento/reporte/${runId}/premium`;
  const analysesLabel =
    analysesLimit == null ? `${analysesUsed} (sin tope declarado)` : `${analysesUsed} / ${analysesLimit}`;

  return (
    <aside className="flex h-fit flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-5">
      <div className="mb-4 flex items-center gap-2">
        <CleexsMark className="h-6 w-6" />
        <p className="font-bold text-slate-900">Cleexs</p>
      </div>
      <nav className="space-y-1 text-sm">
        <NavRow href={`/portal-crecimiento/reporte/${runId}/cliente`} icon={LayoutDashboard} active={onCliente}>
          Portal cliente
        </NavRow>
        <NavRow href={premium} icon={Sparkles}>
          Interpretación
        </NavRow>
        <NavRow href={`${base}#comparacion`} icon={Scale} anchor>
          Comparación
        </NavRow>
        <NavRow href={`${premium}/prompts`} icon={MessageSquare}>
          Prompts
        </NavRow>
        <NavRow href={`${premium}/competidores`} icon={Target}>
          Competidores
        </NavRow>
        <NavRow href={`${premium}/historial`} icon={History}>
          Historial
        </NavRow>
        <NavRow href={`${premium}/reportes`} icon={FileBarChart2}>
          Reportes
        </NavRow>
        <NavRow href={`${premium}/suscripcion`} icon={CreditCard}>
          Suscripción
        </NavRow>
        <NavRow href={`${premium}/equipo`} icon={Users}>
          Equipo
        </NavRow>
        <NavRow href={`${premium}/herramientas`} icon={Wrench}>
          Herramientas
        </NavRow>
      </nav>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Plan actual</p>
        <p className="font-semibold text-slate-900">{planLabel}</p>
        <p className="mt-2 text-[11px] text-slate-600">Uso mensual (scores vistos)</p>
        <p className="text-sm font-semibold tabular-nums text-slate-900">{analysesLabel}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{
              width: `${analysesLimit ? Math.min(100, (analysesUsed / Math.max(1, analysesLimit)) * 100) : 50}%`,
            }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Corte {renewalLabel}</p>
        <Link
          href={`/portal-crecimiento/reporte/${runId}`}
          className="mt-3 block w-full rounded-lg border border-slate-300 bg-white py-2 text-center text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          Anexo técnico
        </Link>
      </div>

      <Link
        href={`/portal-cliente/reporte/${runId}`}
        className="mt-3 block rounded-lg border border-dashed border-slate-200 px-3 py-2 text-center text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        Abrir con menú portal Free →
      </Link>
    </aside>
  );
}
