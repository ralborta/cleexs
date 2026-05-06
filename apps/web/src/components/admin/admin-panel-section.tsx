'use client';

import type { LucideIcon } from 'lucide-react';

const accentBorder: Record<'violet' | 'indigo' | 'amber' | 'slate' | 'emerald', string> = {
  violet: 'border-l-violet-500',
  indigo: 'border-l-indigo-500',
  amber: 'border-l-amber-500',
  slate: 'border-l-slate-400',
  emerald: 'border-l-emerald-500',
};

export function AdminPanelSection({
  icon: Icon,
  title,
  description,
  accent = 'slate',
  headerRight,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  accent?: keyof typeof accentBorder;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/75 bg-gradient-to-b from-slate-50/70 to-white p-6 shadow-sm ring-1 ring-slate-900/[0.04] md:p-7 border-l-[4px] ${accentBorder[accent]}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200/90">
            <Icon className="h-5 w-5 text-slate-700" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
            {description ? <div className="mt-1.5 text-xs leading-relaxed text-slate-600">{description}</div> : null}
          </div>
        </div>
        {headerRight ? <div className="shrink-0 sm:pt-0.5">{headerRight}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
