'use client';

import Link from 'next/link';
import { AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';

export function AdminCallout({ variant, children }: { variant: 'error' | 'success' | 'warning'; children: React.ReactNode }) {
  const box =
    variant === 'success'
      ? 'border-emerald-200/90 bg-emerald-50/90 text-emerald-950'
      : variant === 'warning'
        ? 'border-amber-200/90 bg-amber-50/90 text-amber-950'
        : 'border-red-200/90 bg-red-50/90 text-red-950';
  const Icon = variant === 'success' ? CheckCircle2 : AlertCircle;
  const iconCls =
    variant === 'success' ? 'text-emerald-600' : variant === 'warning' ? 'text-amber-600' : 'text-red-600';

  return (
    <div className={`flex gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-sm ${box}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconCls}`} aria-hidden />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

/** Mensaje amigable cuando las rutas proxy devuelven 401. */
export function AdminAuthExpiredCard() {
  return (
    <div className="rounded-2xl border border-violet-300/40 bg-gradient-to-br from-violet-100/90 via-white to-indigo-50/80 p-6 shadow-lg shadow-violet-900/10 ring-1 ring-violet-900/[0.06]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-600/30">
          <ShieldAlert className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900">No estás autenticado en el panel interno</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            La cookie de sesión puede haber caducado o falta la contraseña admin en este entorno. Iniciá sesión de nuevo para
            usar provisionado, búsqueda y envíos de prueba.
          </p>
          <Link
            href="/admin/login"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/25 transition hover:bg-violet-700"
          >
            Ir al login admin
          </Link>
        </div>
      </div>
    </div>
  );
}

export function looksLikeAdminAuthError(msg: string | null): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return m.includes('no autenticado') || m.includes('autenticad');
}
