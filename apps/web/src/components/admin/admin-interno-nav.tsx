'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CalendarClock,
  CreditCard,
  FileSpreadsheet,
  Layers,
  Link2,
  Mail,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Receipt,
  ScanSearch,
  Settings,
  Sparkles,
  TrendingUp,
  Type,
  Users,
} from 'lucide-react';

type NavLink = {
  href: string;
  label: string;
  icon: typeof Mail;
  extraPrefixes?: string[];
  excludePrefixes?: string[];
};

type NavSection = {
  title: string;
  links: NavLink[];
};

const sections: NavSection[] = [
  {
    title: 'Operaciones',
    links: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3, extraPrefixes: ['/dashboard'] },
      { href: '/admin/conversion', label: 'Métricas de Conversión', icon: TrendingUp, extraPrefixes: ['/conversion'] },
      { href: '/admin/runs', label: 'Runs · diagnósticos', icon: Layers, extraPrefixes: ['/runs'] },
      { href: '/admin/outreach', label: 'Outreach competidores', icon: Sparkles, extraPrefixes: ['/outreach'] },
    ],
  },
  {
    title: 'Marketing',
    links: [
      { href: '/admin/email', label: 'Email · secuencia', icon: Mail, excludePrefixes: ['/admin/email/weekly', '/admin/email/monthly-score', '/admin/email/templates'] },
      { href: '/admin/email/templates', label: 'Email · plantillas', icon: Mail },
      { href: '/admin/email/weekly', label: 'Emails semanales', icon: CalendarClock },
      { href: '/admin/whatsapp', label: 'Mensajes WhatsApp', icon: MessageCircle },
      { href: '/admin/referidores', label: 'Referidores', icon: MousePointerClick },
      { href: '/tools/auspiciadores', label: 'Links auspiciador', icon: Link2 },
    ],
  },
  {
    title: 'Clientes y cobranza',
    links: [
      { href: '/admin/cuentas', label: 'Cuentas y cortesías', icon: Users },
      { href: '/admin/planes', label: 'Planes', icon: CreditCard, extraPrefixes: ['/planes'] },
      { href: '/admin/facturas', label: 'Facturas', icon: Receipt, extraPrefixes: ['/facturas'] },
    ],
  },
  {
    title: 'Análisis',
    links: [
      { href: '/admin/marcas', label: 'Marcas analizadas', icon: Building2 },
      { href: '/admin/reportes', label: 'Reportes', icon: FileSpreadsheet },
    ],
  },
  {
    title: 'Herramientas',
    links: [
      {
        href: '/admin/auditoria-agentica',
        label: 'Auditoría Agéntica',
        icon: ScanSearch,
        extraPrefixes: ['/auditoria-agentica'],
      },
      {
        href: '/admin/analisis-aeo',
        label: 'Análisis AEO',
        icon: Sparkles,
        extraPrefixes: ['/analisis-aeo'],
      },
    ],
  },
  {
    title: 'Configuración',
    links: [
      { href: '/admin/settings', label: 'Configuración general', icon: Settings, extraPrefixes: ['/settings'] },
      { href: '/admin/promociones', label: 'Promociones', icon: Megaphone, extraPrefixes: ['/promociones'] },
      { href: '/admin/textos', label: 'Textos editables', icon: Type },
    ],
  },
];

function isLinkActive(pathname: string | null, link: NavLink): boolean {
  if (!pathname) return false;
  if (link.excludePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return false;
  }
  const allPrefixes = [link.href, ...(link.extraPrefixes ?? [])];
  return allPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AdminInternoNav() {
  const pathname = usePathname();

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white py-6 md:block">
        <nav className="flex flex-col gap-5 px-3">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {section.title}
              </p>
              {section.links.map(({ href, label, icon: Icon, extraPrefixes, excludePrefixes }) => {
                const active = isLinkActive(pathname, { href, label, icon: Icon, extraPrefixes, excludePrefixes });
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-violet-50 text-violet-900 ring-1 ring-violet-200/60'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-violet-600' : 'text-slate-400'}`} aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        {sections.flatMap((section) =>
          section.links.map(({ href, label, icon: Icon, extraPrefixes, excludePrefixes }) => {
            const active = isLinkActive(pathname, { href, label, icon: Icon, extraPrefixes, excludePrefixes });
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  active ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label.split('·')[0]?.trim()}
              </Link>
            );
          }),
        )}
      </nav>
    </>
  );
}
