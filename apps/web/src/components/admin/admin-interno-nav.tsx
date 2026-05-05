'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail, Users } from 'lucide-react';

const links = [
  { href: '/admin/cuentas', label: 'Cuentas y cortesías', icon: Users },
  { href: '/admin/email', label: 'Email · secuencia', icon: Mail },
] as const;

export function AdminInternoNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-56 shrink-0 border-r border-white/10 bg-black/30 py-6 backdrop-blur-sm md:block">
        <nav className="flex flex-col gap-1 px-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Menú</p>
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-white/12 text-white shadow-inner shadow-black/20'
                    : 'text-slate-400 hover:bg-white/6 hover:text-slate-200'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-violet-300' : 'opacity-70'}`} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-10 px-5">
          <p className="text-[10px] leading-relaxed text-slate-500">
            Métricas en vivo desde la API Cleexs. Próximo paso: cablear envíos con Resend en el worker de secuencia.
          </p>
        </div>
      </aside>

      <nav className="flex gap-2 overflow-x-auto border-b border-white/10 bg-black/25 px-4 py-3 md:hidden">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                active ? 'bg-violet-600 text-white' : 'bg-white/10 text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label.split('·')[0]?.trim()}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
