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
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-slate-950/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-violet-500/25">
          C
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">Cleexs</p>
          <p className="text-sm font-semibold leading-tight text-white">Panel interno</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-3.5 w-3.5 opacity-80" aria-hidden />
        Salir
      </button>
    </header>
  );
}
