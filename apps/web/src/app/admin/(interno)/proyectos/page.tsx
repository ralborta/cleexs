'use client';

import Link from 'next/link';
import { FolderKanban } from 'lucide-react';

export default function AdminProyectosPage() {
  return (
    <div className="space-y-6 text-slate-100">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
          <FolderKanban className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Proyectos</h1>
          <p className="text-sm text-slate-400">
            Gestión de proyectos por cliente. Próximamente: vista consolidada y métricas por marca.
          </p>
        </div>
      </header>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <p className="text-sm leading-relaxed text-slate-300">
          Hoy los proyectos se manejan dentro del dashboard de cada tenant.{' '}
          <Link href="/admin/dashboard" className="text-violet-300 underline hover:text-violet-200">
            Ir al Dashboard
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
