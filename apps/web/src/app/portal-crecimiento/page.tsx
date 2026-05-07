'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { PORTAL_SESSION_TOKEN_KEY, signOutPortalSession } from '@/components/portal/portal-sign-out';

type UsageResponse = {
  usage?: { scoreViews?: number; deepReportsGenerated?: number };
  limits?: { scoreViews?: number | null; deepReportsGenerated?: number | null };
  permissions?: {
    canViewScore?: boolean;
    canGenerateDeepReport?: boolean;
    canRunMonthlyAnalysis?: boolean;
  };
  account?: { email?: string };
  plan?: string;
  planKey?: string;
  planDisplay?: string;
};

type BrandItem = { id: string; name: string; domain?: string | null };

type PanelRow = {
  rank: number;
  name: string;
  domain: string | null;
  tag: 'mi_empresa' | 'competidor';
  score: number | null;
};

type PanelResponse = {
  primaryBrandId: string | null;
  multimarca: boolean;
  compareRows: PanelRow[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PORTAL_TITLE =
  process.env.NEXT_PUBLIC_PORTAL_TITLE?.trim() || 'Panel de cuenta · análisis y reportes ampliados';
const PORTAL_LOGIN_SUBTITLE =
  process.env.NEXT_PUBLIC_PORTAL_SUBTITLE?.trim() ||
  'Iniciá sesión con tu email y contraseña de cuenta. Cada usuario ve solo su plan y su uso.';

function limitLabel(v: number | null | undefined): string {
  if (v == null) return 'Ilimitado';
  return String(v);
}

function isPremiumPlan(planKey?: string) {
  return planKey === 'crecimiento' || planKey === 'enterprise';
}

export default function PortalCrecimientoPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [brandId, setBrandId] = useState<string>('');
  const [panel, setPanel] = useState<PanelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [runningMes, setRunningMes] = useState(false);
  /** false hasta conocer redirect vs panel “primera corrida” */
  const [portalBootstrapped, setPortalBootstrapped] = useState(false);

  useEffect(() => {
    try {
      const t = sessionStorage.getItem(PORTAL_SESSION_TOKEN_KEY);
      setToken(t && t.length > 20 ? t : null);
    } catch {
      setToken(null);
    }
    setBooting(false);
  }, []);

  const authHeaders = (t: string | null): HeadersInit =>
    t ? { Authorization: `Bearer ${t}` } : {};

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutMs = 22_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const fetchOpts: RequestInit = {
      cache: 'no-store',
      signal: controller.signal,
      headers: { ...authHeaders(token) },
    };

    let redirected = false;
    try {
      const panelQs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : '';
      const [usageRes, reportsRes] = await Promise.all([
        fetch(`${API_URL}/api/me/usage`, fetchOpts),
        fetch(`${API_URL}/api/reports/app/reports`, fetchOpts),
      ]);

      if (usageRes.status === 401 || reportsRes.status === 401) {
        sessionStorage.removeItem(PORTAL_SESSION_TOKEN_KEY);
        setToken(null);
        setError('Sesión vencida o inválida. Volvé a iniciar sesión.');
        return;
      }

      if (!usageRes.ok || !reportsRes.ok) {
        throw new Error(
          `La API respondió con error (${API_URL}). Comprobá migraciones, PORTAL_JWT_SECRET y despliegue de la última API.`,
        );
      }

      const [usageData, reportsData] = await Promise.all([
        usageRes.json(),
        reportsRes.json(),
      ]);

      const premiumUser = isPremiumPlan((usageData as UsageResponse).planKey);
      const reportsList = Array.isArray(reportsData) ? reportsData : [];
      const latestReport =
        [...reportsList].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] || null;

      if (!premiumUser) {
        redirected = true;
        if (latestReport) {
          router.replace(`/portal-cliente/reporte/${latestReport.id}`);
        } else {
          router.replace('/portal-cliente');
        }
        return;
      }

      if (latestReport) {
        redirected = true;
        router.replace(`/portal-crecimiento/reporte/${latestReport.id}/premium`);
        return;
      }

      const [brandsRes, panelRes] = await Promise.all([
        fetch(`${API_URL}/api/brands`, fetchOpts),
        fetch(`${API_URL}/api/reports/app/portal-panel${panelQs}`, fetchOpts),
      ]);

      if (brandsRes.status === 401 || panelRes.status === 401) {
        sessionStorage.removeItem(PORTAL_SESSION_TOKEN_KEY);
        setToken(null);
        setError('Sesión vencida o inválida. Volvé a iniciar sesión.');
        return;
      }

      if (!brandsRes.ok || !panelRes.ok) {
        throw new Error(
          `La API respondió con error (${API_URL}). Comprobá migraciones, PORTAL_JWT_SECRET y despliegue de la última API (portal-panel).`,
        );
      }

      const [brandsData, panelData] = await Promise.all([brandsRes.json(), panelRes.json()]);

      setUsage(usageData as UsageResponse);
      setPanel(panelData as PanelResponse);
      const list = Array.isArray(brandsData) ? brandsData : [];
      setBrands(list);
      setBrandId((prev) => {
        if (prev && list.some((b) => b.id === prev)) return prev;
        return list[0]?.id ?? '';
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError(
          `La API no respondió en ${timeoutMs / 1000}s (${API_URL}). Verificá NEXT_PUBLIC_API_URL y el backend.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Error cargando el portal');
      }
    } finally {
      clearTimeout(timeoutId);
      if (!redirected) {
        setLoading(false);
        setPortalBootstrapped(true);
      }
    }
  }, [token, brandId, router]);

  useEffect(() => {
    if (token) void loadData();
    else {
      setUsage(null);
      setBrands([]);
      setBrandId('');
      setPanel(null);
      setPortalBootstrapped(false);
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
      if (!res.ok) {
        throw new Error(body.error || `Error ${res.status}`);
      }
      if (!body.token) throw new Error('Respuesta inválida del servidor.');
      sessionStorage.setItem(PORTAL_SESSION_TOKEN_KEY, body.token);
      setPassword('');
      setToken(body.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoginBusy(false);
    }
  }

  function onLogout() {
    signOutPortalSession('/portal-crecimiento');
  }

  async function generateDeepReport() {
    if (!token || !brandId) {
      setError('Elegí una marca para generar el reporte.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/reports/${encodeURIComponent(brandId)}/deep-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        const detail = body.message || body.error || `HTTP ${res.status}`;
        throw new Error(
          res.status === 500 && (body.error === 'Internal Server Error' || !body.message)
            ? `Generación de reporte no disponible (500). Revisá migraciones y logs de la API. Detalle: ${detail}`
            : detail
        );
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando reporte');
    } finally {
      setCreating(false);
    }
  }

  async function runMonthlyAnalysis() {
    if (!token || !brandId) {
      setError('Elegí una marca para ejecutar el análisis.');
      return;
    }
    setRunningMes(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/runs/portal/mes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ brandId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        hint?: string;
        runId?: string;
      };
      if (!res.ok) {
        throw new Error(body.message || body.error || `Error HTTP ${res.status}`);
      }
      if (body.runId) {
        window.location.href = `/portal-crecimiento/reporte/${body.runId}/premium`;
        return;
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar la corrida');
    } finally {
      setRunningMes(false);
    }
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
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Cleexs Crecimiento</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{PORTAL_TITLE}</h1>
            <p className="mt-2 text-sm text-slate-600">{PORTAL_LOGIN_SUBTITLE}</p>
          </header>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : null}

          <form
            onSubmit={onLogin}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div>
              <label htmlFor="portal-email" className="block text-xs font-medium text-slate-700">
                Email
              </label>
              <input
                id="portal-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="portal-password" className="block text-xs font-medium text-slate-700">
                Contraseña
              </label>
              <input
                id="portal-password"
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
            <p className="text-xs text-slate-500">
              Contraseña: definila con provisionado en API. Variable{' '}
              <code className="rounded bg-slate-100 px-1">PORTAL_JWT_SECRET</code>.
            </p>
            <p className="text-center text-xs text-slate-500">
              ¿Estás en el <span className="font-medium text-slate-700">plan gratuito</span>?{' '}
              <Link href="/portal-cliente" className="font-medium text-violet-700 underline-offset-2 hover:underline">
                Usá el portal cliente gratuito
              </Link>
              .
            </p>
          </form>
        </div>
      </main>
    );
  }

  if (!portalBootstrapped) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Abriendo tu cuenta…</p>
        {error ? (
          <div className="mx-auto mt-4 max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </main>
    );
  }

  const planUpper = (usage?.planDisplay || usage?.planKey || 'Plan').toUpperCase();

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-12 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-100/95">Cleexs Crecimiento</p>
            <h1 className="mt-1 text-2xl font-bold">Portal Premium</h1>
            <p className="mt-1 text-sm leading-relaxed text-violet-100">
              Cuando haya una corrida en tu cuenta, al iniciar sesión vas directo a Interpretación. Si todavía no hay
              datos, generá la primera corrida desde acá.
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="self-start rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Salir de la cuenta
          </button>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">{planUpper}</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Primera corrida</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cuenta: <span className="font-medium">{usage?.account?.email || '—'}</span>
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p>Abriendo tu portal…</p>
          </div>
        ) : (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase text-slate-500">Cleexs Scores vistos</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                  {usage?.usage?.scoreViews ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">Límite: {limitLabel(usage?.limits?.scoreViews)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase text-slate-500">Reportes profundos</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">
                  {usage?.usage?.deepReportsGenerated ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Límite: {limitLabel(usage?.limits?.deepReportsGenerated)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase text-slate-500">Marcas</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{brands.length}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {panel?.multimarca ? 'Multimarca' : 'Una marca'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <label className="text-xs font-medium text-slate-700">
                Marca
                <select
                  value={brandId}
                  onChange={(ev) => setBrandId(ev.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void runMonthlyAnalysis()}
                  disabled={runningMes || !brandId || usage?.permissions?.canRunMonthlyAnalysis === false}
                  className="rounded-lg border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {runningMes ? 'Iniciando…' : 'Ejecutar corrida Cleexs'}
                </button>
                <button
                  type="button"
                  onClick={() => void generateDeepReport()}
                  disabled={creating || !brandId || !usage?.permissions?.canGenerateDeepReport}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? 'Generando…' : 'Generar reporte profundo'}
                </button>
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Cuando la corrida figure en tu cuenta, actualizá esta página o volvé a iniciar sesión: te llevará solo a
                la vista Interpretación del portal Premium.
              </p>
            </div>
          </section>
        )}

        <p className="text-center text-xs text-slate-400">
          ¿Plan gratuito?{' '}
          <Link href="/portal-cliente" className="text-violet-600 underline-offset-2 hover:underline">
            Portal cliente Free
          </Link>
        </p>
      </div>
    </main>
  );
}
