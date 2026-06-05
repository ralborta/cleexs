'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import {
  CreditCard,
  FileBarChart2,
  Globe,
  Headphones,
  History,
  LineChart,
  MessageSquare,
  Scale,
  Sparkles,
  Target,
  UserSquare2,
  Users,
  Wrench,
} from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { PortalSignOutButton } from '@/components/portal/portal-sign-out';

export type PortalPremiumSidebarUsage = {
  planKey?: string;
  planDisplay?: string;
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};

export type PortalPremiumSidebarNavProps = {
  runId: string;
  usage: PortalPremiumSidebarUsage | null;
  loadingPlan?: boolean;
};

function nextRenewalLabel() {
  const d = new Date();
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return next.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

function planBadgeLabel(display: string) {
  const t = display.trim();
  if (/^siempre gratis$/i.test(t)) return 'Gratis';
  if (/^free$/i.test(t)) return 'Gratis';
  if (t.length > 22) return `${t.slice(0, 20)}…`;
  return t || 'Premium';
}

function premiumNavActive(pathname: string, runId: string): string {
  const cliente = `/portal-crecimiento/reporte/${runId}/cliente`;
  const premium = `/portal-crecimiento/reporte/${runId}/premium`;

  if (pathname === cliente || pathname.startsWith(`${cliente}/`)) return 'portal-cliente';

  const norm = pathname.replace(/\/$/, '');
  if (norm === premium) return 'interpretacion';

  if (pathname.includes(`${premium}/visibilidad-global`)) return 'visibilidad-global';
  if (pathname.includes(`${premium}/comparacion`)) return 'comparacion';
  if (pathname.includes(`${premium}/prompts`)) return 'prompts';
  if (pathname.includes(`${premium}/competidores`)) return 'competidores';
  if (pathname.includes(`${premium}/historial`)) return 'historial';
  if (pathname.includes(`${premium}/reportes`)) return 'reportes';
  if (pathname.includes(`${premium}/suscripcion`)) return 'suscripcion';
  if (pathname.includes(`${premium}/equipo`)) return 'equipo';
  if (pathname.includes(`${premium}/herramientas`)) return 'herramientas';
  if (pathname.includes(`${premium}/trafico-ia`)) return 'trafico-ia';

  return '';
}

function DisponibleLink({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'group flex items-center justify-between gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 ring-1 ring-violet-200/60'
          : 'group flex items-center justify-between gap-1.5 rounded-lg px-2.5 py-1.5 text-slate-700 hover:bg-slate-50'
      }
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <Icon
          className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-violet-600' : 'text-slate-500 group-hover:text-slate-600'}`}
          aria-hidden
        />
        <span className={`min-w-0 break-words leading-snug ${active ? 'font-semibold text-violet-800' : ''}`}>
          {label}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
        Disponible
      </span>
    </Link>
  );
}

/** Menú lateral Premium alineado visualmente al portal Free (tarjetas, badges, iconos). */
export function PortalPremiumSidebarNav({ runId, usage, loadingPlan }: PortalPremiumSidebarNavProps) {
  const pathname = usePathname() ?? '';
  const active = premiumNavActive(pathname, runId);

  const premiumBase = `/portal-crecimiento/reporte/${runId}/premium`;
  const clientePath = `/portal-crecimiento/reporte/${runId}/cliente`;

  const analysesUsed = usage?.usage?.scoreViews ?? 0;
  const analysesLimit = usage?.limits?.scoreViews ?? null;
  const analysesLabel =
    analysesLimit == null ? `${analysesUsed} (sin tope declarado)` : `${analysesUsed} / ${analysesLimit}`;

  const planTitle = usage?.planDisplay || usage?.planKey || 'Premium';
  const renewalLabel = nextRenewalLabel();

  const portalClienteActive = active === 'portal-cliente';
  const interpretacionActive = active === 'interpretacion';

  return (
    <aside className="flex h-fit flex-col rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] lg:sticky lg:top-5">
      <div className="mb-3 flex items-center gap-2">
        <CleexsMark className="h-7 w-7" />
        <p className="text-sm font-bold tracking-tight text-slate-900">Cleexs</p>
      </div>

      <nav className="space-y-2 text-xs">
        <div className="space-y-1 rounded-xl border border-slate-200/90 bg-slate-50/70 p-1.5">
          <Link
            href={clientePath}
            className={
              portalClienteActive
                ? 'flex items-center justify-between gap-1.5 rounded-xl bg-violet-50 px-2.5 py-1.5 ring-1 ring-violet-200/60'
                : 'group flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 text-slate-700 hover:bg-white/80'
            }
          >
            <span
              className={`flex min-w-0 flex-1 items-center gap-1.5 ${
                portalClienteActive ? 'font-semibold text-violet-700' : 'group-hover:text-slate-900'
              }`}
            >
              <Users
                className={`h-3.5 w-3.5 shrink-0 ${portalClienteActive ? 'text-violet-600' : 'text-slate-500 group-hover:text-slate-600'}`}
                aria-hidden
              />
              <span className="min-w-0 break-words leading-snug">Portal cliente</span>
            </span>
            <span className="shrink-0 rounded-full bg-violet-200/90 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-900">
              {loadingPlan ? '…' : planBadgeLabel(planTitle)}
            </span>
          </Link>

          <Link
            href={premiumBase}
            className={
              interpretacionActive
                ? 'group flex items-center justify-between gap-1.5 rounded-xl bg-violet-50 px-2.5 py-1.5 ring-1 ring-violet-200/60'
                : 'group flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 text-slate-700 hover:bg-white/80'
            }
          >
            <span
              className={`flex min-w-0 flex-1 items-center gap-1.5 ${
                interpretacionActive ? 'font-semibold text-violet-700' : 'group-hover:text-slate-900'
              }`}
            >
              <Sparkles
                className={`h-3.5 w-3.5 shrink-0 ${interpretacionActive ? 'text-violet-600' : 'text-slate-500 group-hover:text-slate-600'}`}
                aria-hidden
              />
              <span className="min-w-0 break-words leading-snug">Interpretación</span>
            </span>
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 ring-1 ring-emerald-100">
              Disponible
            </span>
          </Link>
        </div>

        <div className="space-y-1 rounded-xl border border-slate-200/90 bg-slate-50/70 p-1.5">
          <DisponibleLink
            href={`${premiumBase}/visibilidad-global`}
            label="Visibilidad global"
            Icon={Globe}
            active={active === 'visibilidad-global'}
          />
          <DisponibleLink
            href={`${premiumBase}/comparacion`}
            label="Comparación"
            Icon={Scale}
            active={active === 'comparacion'}
          />
          <DisponibleLink
            href={`${premiumBase}/prompts`}
            label="Prompts"
            Icon={MessageSquare}
            active={active === 'prompts'}
          />
          <DisponibleLink
            href={`${premiumBase}/competidores`}
            label="Competidores"
            Icon={Target}
            active={active === 'competidores'}
          />
          <DisponibleLink
            href={`${premiumBase}/historial`}
            label="Historial"
            Icon={History}
            active={active === 'historial'}
          />
          <DisponibleLink
            href={`${premiumBase}/trafico-ia`}
            label="Tráfico de IAs"
            Icon={LineChart}
            active={active === 'trafico-ia'}
          />
          <DisponibleLink
            href={`${premiumBase}/reportes`}
            label="Reportes"
            Icon={FileBarChart2}
            active={active === 'reportes'}
          />
          <DisponibleLink
            href={`${premiumBase}/suscripcion`}
            label="Suscripción"
            Icon={CreditCard}
            active={active === 'suscripcion'}
          />
          <DisponibleLink
            href={`${premiumBase}/equipo`}
            label="Equipo"
            Icon={UserSquare2}
            active={active === 'equipo'}
          />
          <DisponibleLink
            href={`${premiumBase}/herramientas`}
            label="Herramientas"
            Icon={Wrench}
            active={active === 'herramientas'}
          />
        </div>
      </nav>

      <div className="mt-6 rounded-xl border border-violet-100/90 bg-gradient-to-br from-violet-50/80 to-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium text-slate-500">Plan actual</p>
          <span className="rounded-full bg-violet-200/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900">
            {loadingPlan ? '…' : planBadgeLabel(planTitle)}
          </span>
          <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-900">
            Incluido
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
          href={`${premiumBase}/suscripcion`}
          className="mt-3 block w-full rounded-lg border-2 border-violet-500 bg-white py-2.5 text-center text-xs font-semibold text-violet-700 shadow-sm hover:bg-violet-50"
        >
          Gestionar suscripción
        </Link>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-end pt-6">
        <PortalSignOutButton className="mb-4" landing="/portal-crecimiento" />
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          <Headphones className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          <span>¿Necesitás ayuda? Contactá a nuestro equipo</span>
        </div>
      </div>
    </aside>
  );
}
