import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminInternoNav } from '@/components/admin/admin-interno-nav';
import { AdminInternoTopBar } from '@/components/admin/admin-interno-top-bar';
import { assertAdminUiSession } from '@/lib/admin-api';

export const dynamic = 'force-dynamic';

export default function AdminInternoLayout({ children }: { children: React.ReactNode }) {
  if (!assertAdminUiSession()) {
    redirect('/admin/login');
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgb(76,29,149),rgb(15,23,42)_45%,rgb(2,6,23)_100%)] text-slate-100">
      <AdminInternoTopBar />
      <div className="flex min-h-[calc(100vh-3.5rem)]">
        <AdminInternoNav />
        <div className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
        </div>
      </div>
      <footer className="border-t border-white/10 bg-black/25 px-4 py-6 backdrop-blur-sm md:pl-[calc(14rem+2rem)] md:pr-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="leading-relaxed">
            Cleexs · uso interno. Las métricas de la página Cuentas vienen de{' '}
            <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-200">
              GET /api/admin/dashboard-summary
            </code>{' '}
            (API Cleexs).
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/admin/cuentas" className="font-medium text-violet-300 transition hover:text-white">
              Cuentas y cortesías
            </Link>
            <Link href="/admin/email" className="font-medium text-violet-300 transition hover:text-white">
              Secuencia email (interno)
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
