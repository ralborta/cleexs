import Link from 'next/link';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminInternoNav } from '@/components/admin/admin-interno-nav';
import { AdminInternoTopBar } from '@/components/admin/admin-interno-top-bar';
import { adminRequireAuthEnabled } from '@/lib/admin-auth-config';
import { assertAdminUiSession, getAdminUiSession, getEffectiveAdminRole } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export default function AdminInternoLayout({ children }: { children: React.ReactNode }) {
  noStore();

  if (adminRequireAuthEnabled() && !assertAdminUiSession()) {
    redirect('/admin/login');
  }

  const session = getAdminUiSession();
  const role = getEffectiveAdminRole();
  const username = session?.username ?? null;

  const footerLinks =
    role === 'marketing'
      ? [
          { href: '/admin/conversion', label: 'Conversión' },
          { href: '/admin/marcas', label: 'Marcas' },
          { href: '/admin/reportes', label: 'Reportes' },
        ]
      : [
          { href: '/admin/cuentas', label: 'Cuentas' },
          { href: '/admin/email', label: 'Email' },
          { href: '/admin/outreach', label: 'Outreach' },
        ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminInternoTopBar role={role} username={username} />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <AdminInternoNav role={role} />
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
        </div>
      </div>
      <footer className="border-t border-slate-200 bg-white px-4 py-5 md:pl-[calc(15rem+2rem)] md:pr-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed">Cleexs · panel interno. Acceso restringido a equipo Cleexs.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-medium text-violet-700 transition hover:text-violet-900"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
