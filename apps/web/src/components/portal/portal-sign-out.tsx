'use client';

import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { clearPortalReferralSlug } from '@/lib/portal-referral-client';
import { cn } from '@/lib/utils';

export const PORTAL_SESSION_TOKEN_KEY = 'cleexs_portal_token';

/** Ruta de login donde vuelve cada portal (no mezcla producto Cleexs). */
export function derivePortalLandingPath(pathname: string | null): '/portal-cliente' | '/portal-crecimiento' {
  if (pathname?.startsWith('/portal-cliente')) return '/portal-cliente';
  return '/portal-crecimiento';
}

export function signOutPortalSession(landing?: '/portal-cliente' | '/portal-crecimiento'): void {
  if (typeof window === 'undefined') return;
  const path =
    landing ?? derivePortalLandingPath(typeof window.location?.pathname === 'string' ? window.location.pathname : null);
  try {
    sessionStorage.removeItem(PORTAL_SESSION_TOKEN_KEY);
  } catch {
    /* noop */
  }
  clearPortalReferralSlug();
  window.location.assign(path);
}

type PortalSignOutButtonProps = {
  landing?: '/portal-cliente' | '/portal-crecimiento';
  className?: string;
};

/** Opción visible para usuarios finales: cierra sesión del portal solo en esta ventana/navegación. */
export function PortalSignOutButton({ landing, className }: PortalSignOutButtonProps) {
  const pathname = usePathname();
  const target = landing ?? derivePortalLandingPath(pathname ?? null);

  const defaultSidebar =
    'flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={() => signOutPortalSession(target)}
      className={cn(defaultSidebar, className)}
    >
      <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      Salir de la cuenta
    </button>
  );
}
