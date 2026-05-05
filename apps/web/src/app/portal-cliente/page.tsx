'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  capturePortalReferralFromLocation,
  clearPortalReferralSlug,
  peekPortalReferralSlug,
} from '@/lib/portal-referral-client';
import { PortalReferralUpsell } from '@/components/portal/portal-referral-upsell';

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

/** Entrada solo para cuentas en plan gratuito. Cleexs Crecimiento: /portal-crecimiento */
export default function PortalClienteHomePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    capturePortalReferralFromLocation();
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
      const list = Array.isArray(reportsData) ? reportsData : [];
      const latest =
        [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] || null;
      if (latest) {
        router.replace(`/portal-cliente/reporte/${latest.id}`);
        return;
      }
      setUsage(usageData);
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
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          referralSlug: peekPortalReferralSlug(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
      if (!body.token) throw new Error('Respuesta inválida del servidor.');
      sessionStorage.setItem(TOKEN_KEY, body.token);
      clearPortalReferralSlug();
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
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Portal gratuito</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Cleexs · portal cliente</h1>
            <p className="mt-2 text-sm text-slate-600">
              Iniciá sesión con tu email y contraseña para ver tu panel y tus análisis del plan incluido sin costo.
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
          <p className="text-center text-xs text-slate-500">
            ¿Tu empresa tiene contrato <span className="font-medium text-slate-700">Cleexs Crecimiento</span>?{' '}
            <Link href="/portal-crecimiento" className="font-medium text-violet-700 underline-offset-2 hover:underline">
              Entrá por el portal Crecimiento
            </Link>{' '}
            —es otra URL y otro flujo, separado de este portal gratuito.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-12 sm:p-6">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-100/95">Portal gratuito</p>
            <h1 className="mt-1 text-2xl font-bold">Portal cliente</h1>
            <p className="mt-1 text-sm text-violet-100">
              {usage?.account?.email ? <>Sesión: {usage.account.email}</> : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="self-start rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Cerrar sesión
          </button>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <p className="text-center text-sm text-slate-600">Abriendo tu portal…</p>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-900">Todavía no hay análisis en tu cuenta</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Cuando exista una corrida completada, al iniciar sesión vas a entrar directo al panel del portal
              cliente (plan Free).
            </p>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          ¿Contrato Cleexs Crecimiento?{' '}
          <Link href="/portal-crecimiento" className="text-violet-600 underline-offset-2 hover:underline">
            Portal Crecimiento
          </Link>
        </p>

        <div className="mt-8 border-t border-slate-200/90 pt-6">
          <PortalReferralUpsell />
        </div>
      </div>
    </main>
  );
}
