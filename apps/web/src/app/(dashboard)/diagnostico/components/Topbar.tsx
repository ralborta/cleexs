'use client';

import Link from 'next/link';
import { LayoutDashboard, Globe, Languages } from 'lucide-react';

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-slate-800 hover:text-slate-900">
            <LayoutDashboard className="h-6 w-6 text-primary-600" aria-hidden />
            <span className="font-semibold text-slate-800">Cleexs</span>
          </Link>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            Versión inicial
          </span>
        </div>
        <nav className="flex items-center gap-2 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <Globe className="h-4 w-4" aria-hidden />
            País: AR
          </span>
          <span className="flex items-center gap-1.5">
            <Languages className="h-4 w-4" aria-hidden />
            Idioma: ES
          </span>
        </nav>
      </div>
    </header>
  );
}
