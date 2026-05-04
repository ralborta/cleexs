'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  account?: { email?: string };
};

type ReportItem = {
  id: string;
  status: string;
  createdAt: string;
  score: number | null;
  reportType?: string;
  brand: { name: string; domain?: string };
};

function isPremiumPlan(planKey?: string) {
  return planKey === 'crecimiento' || planKey === 'enterprise';
}

/** Entrada del portal cliente (plan Free). Cleexs Crecimiento sigue en /portal-crecimiento. */
export default function PortalClienteHomePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const t = sessionStorage.getItem(TOKEN_KEY);
      setToken(t && t.length > 20 ? t : null);
    } catch {
      setToken(null);
    }
    setBooting(false);
  }, []);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [usageRes, reportsRes] = await Promise.all([
        fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        fetch(`${API_URL}/api/reports/app/reports`, { cache: 'no-store', headers }),
      ]);
      if (usageRes.status === 401 || reportsRes.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setError('Sesión vencida. Volvé a iniciar sesión.');
        return;
      }
      if (!usageRes.ok || !reportsRes.ok) {
        throw new Error('Error al cargar datos del portal.');
      }
      const usageData = (await usageRes.json()) as UsageResponse;
      const reportsData = (await reportsRes.json()) as ReportItem[];
      if (isPremiumPlan(usageData.planKey)) {
        router.replace('/portal-crecimiento');
        return;
      }
      setUsage(usageData);
      setReports(Array.isArray(reportsData) ? reportsData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    if (token) void loadData();
    else {
      setUsage(null);
      setReports([]);
    }
  }, [token, loadData]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      if (!body.token) throw new Error('Respuesta inválida del servidor.');
      sessionStorage.setItem(TOKEN_KEY, body.token);
      setPassword('');
      setToken(body.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoginBusy(false);
    }
  }

  function onLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  if (booting) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Cargando…</p>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-md space-y-6 pt-12">
          <header className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Portal cliente</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Cleexs · Plan Free</h1>
            <p className="mt-2 text-sm text-slate-600">
              Accedé con tu cuenta. El portal <strong>Crecimiento</strong> (Premium) está en{' '}
              <Link href="/portal-crecimiento" className="font-semibold text-violet-700 underline">
                /portal-crecimiento
              </Link>
              .
            </p>
          </header>
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : null}
          <form onSubmit={onLogin} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <label htmlFor="pc-email" className="block text-xs font-medium text-slate-700">
                Email
              </label>
              <input
                id="pc-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pc-password" className="block text-xs font-medium text-slate-700">
                Contraseña
              </label>
              <input
                id="pc-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loginBusy}
              className="w-full rounded-md bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {loginBusy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const latestReport = [...reports].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] || null;

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-12 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-100/95">Portal cliente · Free</p>
            <h1 className="mt-1 text-2xl font-bold">Tu panel limitado</h1>
            <p className="mt-1 text-sm text-violet-100">
              {usage?.account?.email ? <>Sesión: {usage.account.email}</> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onLogout}
              className="rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm text-sm text-slate-600">
          <p>
            ¿Tenés plan <strong>Crecimiento</strong>?{' '}
            <Link href="/portal-crecimiento" className="font-semibold text-violet-700 underline">
              Ir al portal Crecimiento
            </Link>
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Cargando reportes…</p>
        ) : (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Tus corridas</h2>
            {latestReport ? (
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                <p className="text-xs font-semibold uppercase text-violet-800">Última corrida</p>
                <p className="mt-1 font-medium text-slate-900">{latestReport.brand.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/portal-cliente/reporte/${latestReport.id}`}
                    className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                  >
                    Abrir portal cliente
                  </Link>
                  <Link
                    href={`/portal-crecimiento/reporte/${latestReport.id}`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Anexo técnico por prompt
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Todavía no hay corridas en tu cuenta.</p>
            )}
            <ul className="space-y-2">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm"
                >
                  <span className="font-medium text-slate-900">{r.brand.name}</span>
                  <span className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>
                  <div className="flex w-full gap-2 sm:w-auto">
                    <Link
                      href={`/portal-cliente/reporte/${r.id}`}
                      className="rounded-md bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-900 hover:bg-violet-200"
                    >
                      Portal cliente
                    </Link>
                    <Link
                      href={`/portal-crecimiento/reporte/${r.id}`}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Anexo técnico
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
