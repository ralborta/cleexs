'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

export function AdminInternoTopBar() {
  const router = useRouter();

  async function logout() {
    await adminUiFetch('/api/admin-ui/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-sm">
          C
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-600">Cleexs</p>
          <p className="text-sm font-semibold text-slate-900">Panel interno</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <LogOut className="h-3.5 w-3.5 opacity-80" aria-hidden />
        Salir
      </button>
    </header>
  );
}
