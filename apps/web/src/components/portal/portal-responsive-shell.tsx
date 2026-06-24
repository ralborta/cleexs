'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { cn } from '@/lib/utils';
import { useTrapBrowserBack } from '@/lib/public-funnel-exit';

type PortalResponsiveShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  /** Título corto en la barra mobile (ej. nombre de marca). */
  mobileTitle?: string;
  className?: string;
};

export function PortalResponsiveShell({
  sidebar,
  children,
  mobileTitle = 'Portal Cleexs',
  className,
}: PortalResponsiveShellProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useTrapBrowserBack(open, () => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className={cn('mx-auto max-w-7xl', className)}>
      <div className="sticky top-0 z-30 -mx-3 mb-3 flex items-center gap-3 border-b border-slate-200/80 bg-slate-50/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80 sm:-mx-5 sm:px-5 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm active:scale-[0.98]"
          aria-label="Abrir menú del portal"
          aria-expanded={open}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <CleexsMark className="h-7 w-7 shrink-0" />
          <p className="truncate text-sm font-semibold text-slate-900">{mobileTitle}</p>
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[1px] lg:hidden"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú del portal"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(100%,20.5rem)] flex-col overflow-y-auto border-r border-slate-200 bg-white p-4 shadow-2xl lg:hidden"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Atrás
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {sidebar}
          </div>
        </>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="hidden lg:block">{sidebar}</div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
