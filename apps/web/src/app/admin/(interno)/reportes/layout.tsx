'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, ClipboardList, Mail, Trophy, FileSpreadsheet } from 'lucide-react';

type SubLink = {
  href: string;
  label: string;
  icon: typeof FileSpreadsheet;
  description: string;
  matchExact?: boolean;
};

const SUB_LINKS: readonly SubLink[] = [
  {
    href: '/admin/reportes',
    label: 'Inicio',
    icon: FileSpreadsheet,
    description: '4 reportes consolidados',
    matchExact: true,
  },
  {
    href: '/admin/reportes/adquisicion',
    label: 'Adquisicion y funnel',
    icon: BarChart3,
    description: 'Diagnosticos, embudo y referidores',
  },
  {
    href: '/admin/reportes/onboarding',
    label: 'Onboarding · perfil',
    icon: ClipboardList,
    description: 'Pais, nombre y como llego',
  },
  {
    href: '/admin/reportes/cleexs-score',
    label: 'Cleexs Score',
    icon: Trophy,
    description: 'Distribucion y top marcas',
  },
  {
    href: '/admin/reportes/email-outreach',
    label: 'Email y outreach',
    icon: Mail,
    description: 'Weekly + cold outreach',
  },
];

function isActive(pathname: string | null, href: string, exact?: boolean): boolean {
  if (!pathname) return false;
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminReportesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reportes</h1>
          <p className="text-sm text-slate-600">
            Vista consolidada del estado del negocio: adquisicion, posicionamiento y comunicacion.
          </p>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {SUB_LINKS.map(({ href, label, icon: Icon, matchExact }) => {
          const active = isActive(pathname, href, matchExact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-violet-600 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div>{children}</div>
    </div>
  );
}
