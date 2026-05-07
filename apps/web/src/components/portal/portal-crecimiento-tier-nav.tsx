'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  FileBarChart2,
  History,
  LayoutDashboard,
  Lock,
  MessageSquare,
  Scale,
  Sparkles,
  Target,
  Users,
  Wrench,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { PortalSignOutButton } from '@/components/portal/portal-sign-out';

function planCardLabel(display: string): string {
  const t = display.trim();
  if (/^siempre gratis$/i.test(t)) return 'Gratis';
  if (/^free$/i.test(t)) return 'Gratis';
  return display;
}

export type PortalCrecimientoTierNavProps = {
  basePath: string;
  runId: string;
  planLabel: string;
  analysesUsed: number;
  analysesLimit: number | null;
  renewalLabel: string;
};

type NavSuffix = 'free' | 'disponible' | 'lock' | null;

function NavRow({
  href,
  icon: Icon,
  children,
  active,
  anchor,
  suffix,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  active?: boolean;
  anchor?: boolean;
  suffix?: NavSuffix;
}) {
  const cls = `flex w-full items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
    active ? 'bg-violet-50 font-semibold text-violet-900' : 'text-slate-600 hover:bg-slate-50'
  }`;
  const right =
    suffix === 'free' ? (
      <span className="shrink-0 rounded-full bg-violet-200/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-900">
        Free
      </span>
    ) : suffix === 'disponible' ? (
      <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
        Disponible
      </span>
    ) : suffix === 'lock' ? (
      <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
    ) : null;

  const inner = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-100">
          <Icon className="h-3 w-3 text-violet-700" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 break-words leading-snug">{children}</span>
      </span>
      {right}
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
  const firstSegmentAfterBase =
    pathname && pathname.startsWith(base)
      ? pathname.slice(base.length).replace(/^\//, '').split('/')[0] ?? ''
      : '__';
  const onPortalClienteHome = !firstSegmentAfterBase || firstSegmentAfterBase === '';
  const premium = `/portal-crecimiento/reporte/${runId}/premium`;
  const analysesLabel =
    analysesLimit == null ? `${analysesUsed} (sin tope declarado)` : `${analysesUsed} / ${analysesLimit}`;

  return (
    <aside className="flex h-fit flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-5">
      <div className="mb-3 flex items-center gap-2">
        <CleexsMark className="h-5 w-5" />
        <p className="text-sm font-bold text-slate-900">Cleexs</p>
      </div>
      <nav className="space-y-2 text-xs">
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-1.5">
          <NavRow
            href={`/portal-crecimiento/reporte/${runId}/cliente`}
            icon={LayoutDashboard}
            active={onPortalClienteHome}
            suffix="free"
          >
            Portal cliente
          </NavRow>
        </div>
        <div className="space-y-1 rounded-xl border border-slate-200/90 bg-slate-50/70 p-1.5">
          <NavRow href={`${base}#competidores`} icon={Target} anchor suffix="disponible">
            Competidores
          </NavRow>
          <NavRow href={`${base}/equipo`} icon={Users} active={pathname?.includes('/equipo') ?? false} suffix="disponible">
            Equipo
          </NavRow>
          <NavRow
            href={`${base}/suscripcion`}
            icon={CreditCard}
            active={pathname?.includes('/suscripcion') ?? false}
            suffix="disponible"
          >
            Suscripción
          </NavRow>
        </div>
        <div className="space-y-1">
          <NavRow href={premium} icon={Sparkles} suffix="lock">
            Interpretación
          </NavRow>
          <NavRow
            href={`${base}/comparacion`}
            icon={Scale}
            active={pathname?.includes('/comparacion') ?? false}
            suffix="lock"
          >
            Comparación
          </NavRow>
          <NavRow href={`${premium}/prompts`} icon={MessageSquare} suffix="lock">
            Prompts
          </NavRow>
          <NavRow href={`${premium}/historial`} icon={History} suffix="lock">
            Historial
          </NavRow>
          <NavRow href={`${premium}/reportes`} icon={FileBarChart2} suffix="lock">
            Reportes
          </NavRow>
          <NavRow href={`${premium}/herramientas`} icon={Wrench} suffix="lock">
            Herramientas
          </NavRow>
        </div>
      </nav>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs text-slate-500">Plan actual</p>
        <p className="text-sm font-semibold text-slate-900">{planCardLabel(planLabel)}</p>
        <p className="mt-2 text-[11px] text-slate-600">Uso mensual (scores vistos)</p>
        <p className="text-xs font-semibold tabular-nums text-slate-900">{analysesLabel}</p>
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

      <PortalSignOutButton className="mt-4" />
    </aside>
  );
}
