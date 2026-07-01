import Link from 'next/link';
import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminInternoNav } from '@/components/admin/admin-interno-nav';
import { AdminInternoTopBar } from '@/components/admin/admin-interno-top-bar';
import { adminRequireAuthEnabled } from '@/lib/admin-auth-config';
import { assertAdminUiSession } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export default function AdminInternoLayout({ children }: { children: React.ReactNode }) {
  noStore();
  if (adminRequireAuthEnabled() && !assertAdminUiSession()) {
    redirect('/admin/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminInternoTopBar />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <AdminInternoNav />
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
        </div>
      </div>
      <footer className="border-t border-slate-200 bg-white px-4 py-5 md:pl-[calc(15rem+2rem)] md:pr-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed">Cleexs · panel interno. Acceso restringido a equipo Cleexs.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/admin/cuentas" className="font-medium text-violet-700 transition hover:text-violet-900">
              Cuentas
            </Link>
            <Link href="/admin/email" className="font-medium text-violet-700 transition hover:text-violet-900">
              Email
            </Link>
            <Link href="/admin/outreach" className="font-medium text-violet-700 transition hover:text-violet-900">
              Outreach
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
