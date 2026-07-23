'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { PORTAL_SESSION_TOKEN_KEY } from '@/components/portal/portal-sign-out';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function PortalAccesoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    const rawToken = searchParams.get('token')?.trim();
    if (!rawToken) {
      setError('Este link no es válido. Pedí un nuevo acceso desde el correo que te enviamos.');
      setStatus('error');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/portal/magic-link/consume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: rawToken }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          token?: string;
          redirectUrl?: string;
        };

        if (cancelled) return;

        if (!res.ok || !data.token || !data.redirectUrl) {
          setError(data.error || 'No pudimos validar tu acceso. El link puede haber expirado.');
          setStatus('error');
          return;
        }

        sessionStorage.setItem(PORTAL_SESSION_TOKEN_KEY, data.token);
        router.replace(data.redirectUrl);
      } catch {
        if (!cancelled) {
          setError('Error de conexión. Intentá de nuevo en unos segundos.');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/95">
        <div className="mx-auto flex max-w-lg items-center px-4 py-4 sm:px-6">
          <Link href="https://cleexs.net" className="inline-flex items-center gap-2">
            <CleexsMark className="h-7 w-auto" />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        {status === 'loading' ? (
          <>
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
            <p className="mt-5 text-sm font-medium text-slate-700">Validando tu acceso al portal…</p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-slate-900">No pudimos abrir tu portal</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{error}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/portal-cliente"
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Ir al portal cliente
              </Link>
              <Link
                href="/portal-crecimiento"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Portal Premium
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function PortalAccesoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f7f8fb] text-sm text-slate-600">
          Cargando…
        </div>
      }
    >
      <PortalAccesoInner />
    </Suspense>
  );
}
