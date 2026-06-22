'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CreditCard,
  FileBarChart2,
  Headphones,
  History,
  Lock,
  MessageSquare,
  Scale,
  Target,
  Trophy,
  Users,
  UserSquare2,
  Wrench,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import {
  PlanConquistarCheckoutButton,
  PlanConquistarPromoPrice,
} from '@/components/planes/plan-conquistar-checkout-button';
import { PortalSignOutButton } from '@/components/portal/portal-sign-out';

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
  const pathname = usePathname();
  const analysesLabel =
    analysesLimit == null ? `${analysesUsed} (sin tope declarado)` : `${analysesUsed} / ${analysesLimit}`;
  const base = basePath.replace(/\/$/, '');
  const firstSegmentAfterBase =
    pathname && pathname.startsWith(base)
      ? pathname.slice(base.length).replace(/^\//, '').split('/')[0] ?? ''
      : '__';
  const onPortalClienteHome = !firstSegmentAfterBase || firstSegmentAfterBase === '';
  const onComparacionPage = pathname?.includes('/comparacion') ?? false;
  const onCompetidoresPage = pathname?.includes('/competidores') ?? false;
  const onEquipoPage = pathname?.includes('/equipo') ?? false;
  const onSuscripcionPage = pathname?.includes('/suscripcion') ?? false;

  return (
    <aside className="flex h-fit flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] lg:sticky lg:top-5">
      <div className="mb-3 flex items-center gap-2">
        <CleexsMark className="h-7 w-7" />
        <p className="text-sm font-bold tracking-tight text-slate-900">Cleexs</p>
      </div>
      <nav className="space-y-2 text-xs">
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-1.5">
          <a
            href={`${base}#portal-cliente`}
            className={
              onPortalClienteHome
                ? 'flex items-center justify-between gap-1.5 rounded-xl bg-violet-50 px-2.5 py-1.5 ring-1 ring-violet-200/60'
                : 'group flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 text-slate-700 hover:bg-white/80'
            }
          >
            <span
              className={`flex min-w-0 flex-1 items-center gap-1.5 ${
                onPortalClienteHome ? 'font-semibold text-violet-700' : 'group-hover:text-slate-900'
              }`}
            >
              <Users
                className={`h-3.5 w-3.5 shrink-0 ${onPortalClienteHome ? 'text-violet-600' : 'text-slate-500 group-hover:text-slate-600'}`}
                aria-hidden
              />
              <span className="min-w-0 break-words leading-snug">Portal cliente</span>
            </span>
            <span className="shrink-0 rounded-full bg-violet-200/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-900">
              Free
            </span>
          </a>
        </div>

        <div className="space-y-1 rounded-xl border border-slate-200/90 bg-slate-50/70 p-1.5">
          <Link
            href={`${base}/equipo`}
            className={
              onEquipoPage
                ? 'group flex items-center justify-between gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 ring-1 ring-violet-200/60'
                : 'group flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50'
            }
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <UserSquare2
                className={`h-3.5 w-3.5 shrink-0 ${onEquipoPage ? 'text-violet-600' : 'text-slate-500 group-hover:text-slate-600'}`}
                aria-hidden
              />
              <span
                className={`min-w-0 break-words leading-snug ${onEquipoPage ? 'font-semibold text-violet-800' : ''}`}
              >
                Equipo
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
              Disponible
            </span>
          </Link>
          <Link
            href={`${base}/suscripcion`}
            className={
              onSuscripcionPage
                ? 'group flex items-center justify-between gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 ring-1 ring-violet-200/60'
                : 'group flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50'
            }
          >
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <CreditCard
                className={`h-3.5 w-3.5 shrink-0 ${onSuscripcionPage ? 'text-violet-600' : 'text-slate-500 group-hover:text-slate-600'}`}
                aria-hidden
              />
              <span
                className={`min-w-0 break-words leading-snug ${onSuscripcionPage ? 'font-semibold text-violet-800' : ''}`}
              >
                Suscripción
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
              Disponible
            </span>
          </Link>
        </div>

        <div className="space-y-1">
          <Link
            href={`${base}/competidores`}
            className={
              onCompetidoresPage
                ? 'flex items-center justify-between gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-700 ring-1 ring-slate-200/80'
                : 'flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-50'
            }
            title="Incluido en plan Crecimiento / Premium"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Target className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <span className="min-w-0 break-words leading-snug">Competidores</span>
            </span>
            <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
          </Link>
          <Link
            href={`${base}/comparacion`}
            className={
              onComparacionPage
                ? 'flex items-center justify-between gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-slate-700 ring-1 ring-slate-200/80'
                : 'flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-600 hover:bg-slate-50'
            }
            title="Vista previa limitada. Plan Crecimiento desbloquea el análisis completo."
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              <span className="min-w-0 break-words leading-snug">Comparación</span>
            </span>
            <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
          </Link>
          {(
            [
              { label: 'Prompts' as const, Icon: MessageSquare },
            { label: 'Historial' as const, Icon: History },
            { label: 'Reportes' as const, Icon: FileBarChart2 },
            { label: 'Herramientas' as const, Icon: Wrench },
          ] as const
        ).map(({ label, Icon }) => (
            <div
              key={label}
              className="flex cursor-not-allowed items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-600"
              title="Incluido en plan Crecimiento / Premium"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                {label}
              </span>
              <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            </div>
          ))}
        </div>
      </nav>

      <div className="mt-6 rounded-xl border border-violet-300/70 bg-gradient-to-br from-violet-600 to-fuchsia-600 p-4 text-white shadow-md shadow-violet-600/20">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 shrink-0" aria-hidden />
          <span className="text-sm font-bold leading-tight">Plan Conquistar</span>
          <PlanConquistarPromoPrice size="sm" inverted className="ml-auto" />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-violet-50">
          Sé la marca favorita de ChatGPT, Claude, Gemini y Perplexity en 90 días. Plan de acción + Premium incluido.
        </p>
        <PlanConquistarCheckoutButton variant="sidebar" sourceChannel="portal_sidebar" icon="sparkles" />
      </div>

      <div className="mt-4 rounded-xl border border-violet-100/90 bg-gradient-to-br from-violet-50/80 to-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-slate-500">Plan actual</p>
          <span className="rounded-full bg-violet-200/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900">
            Free
          </span>
          <span className="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
            Limitado
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-600">Análisis usados este mes</p>
        <p className="text-xs font-semibold text-slate-900">{analysesLabel} análisis</p>
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
          href={`${base}/suscripcion`}
          className="mt-3 block w-full rounded-lg border-2 border-violet-500 bg-white py-2.5 text-center text-xs font-semibold text-violet-700 shadow-sm hover:bg-violet-50"
        >
          Actualizar plan
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-slate-100/80 pt-6">
        <Link
          href="/contacto"
          className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
        >
          <Headphones className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          <span>¿Necesitás ayuda? Contactá a nuestro equipo</span>
        </Link>
        <PortalSignOutButton />
      </div>
    </aside>
  );
}
