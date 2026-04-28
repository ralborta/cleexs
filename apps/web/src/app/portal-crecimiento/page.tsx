'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const TOKEN_KEY = 'cleexs_portal_token';

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

type ReportItem = {
  id: string;
  status: string;
  createdAt: string;
  score: number | null;
  reportType?: string;
  brand: { name: string; domain?: string };
};

type BrandItem = { id: string; name: string; domain?: string | null };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const PORTAL_TITLE =
  process.env.NEXT_PUBLIC_PORTAL_TITLE?.trim() || 'Cleexs Crecimiento · Portal cliente';
const PORTAL_SUBTITLE =
  process.env.NEXT_PUBLIC_PORTAL_SUBTITLE?.trim() ||
  'Iniciá sesión con tu email y contraseña de cuenta. Cada usuario ve solo su plan y su uso.';

export default function PortalCrecimientoPage() {
  const [token, setToken] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [brandId, setBrandId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [runningMes, setRunningMes] = useState(false);

  useEffect(() => {
    try {
      const t = sessionStorage.getItem(TOKEN_KEY);
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
    const timeoutMs = 18_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const fetchOpts: RequestInit = {
      cache: 'no-store',
      signal: controller.signal,
      headers: { ...authHeaders(token) },
    };

    try {
      const [usageRes, reportsRes, brandsRes] = await Promise.all([
        fetch(`${API_URL}/api/me/usage`, fetchOpts),
        fetch(`${API_URL}/api/reports/app/reports`, fetchOpts),
        fetch(`${API_URL}/api/brands`, fetchOpts),
      ]);

      if (usageRes.status === 401 || reportsRes.status === 401 || brandsRes.status === 401) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setError('Sesión vencida o inválida. Volvé a iniciar sesión.');
        return;
      }

      if (!usageRes.ok || !reportsRes.ok || !brandsRes.ok) {
        throw new Error(
          `La API respondió con error (${API_URL}). Comprobá migraciones, PORTAL_JWT_SECRET en la API y que el usuario tenga contraseña (provision --password).`
        );
      }

      const [usageData, reportsData, brandsData] = await Promise.all([
        usageRes.json(),
        reportsRes.json(),
        brandsRes.json(),
      ]);

      setUsage(usageData);
      const list = Array.isArray(brandsData) ? brandsData : [];
      setBrands(list);
      setBrandId((prev) => {
        if (prev && list.some((b) => b.id === prev)) return prev;
        return list[0]?.id ?? '';
      });
      setReports(Array.isArray(reportsData) ? reportsData : []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError(
          `La API no respondió en ${timeoutMs / 1000}s (${API_URL}). Verificá NEXT_PUBLIC_API_URL y que el backend esté en marcha.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Error cargando el portal');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void loadData();
    else {
      setUsage(null);
      setReports([]);
      setBrands([]);
      setBrandId('');
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
    setUsage(null);
    setReports([]);
    setBrands([]);
    setBrandId('');
    setError(null);
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
            ? `Generación de reporte no disponible (500). Suele faltar la tabla usage_ledger en la base de datos: ejecutá migraciones en la API (prisma migrate deploy). Detalle: ${detail}`
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
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; hint?: string };
      if (!res.ok) {
        throw new Error(body.message || body.error || `Error HTTP ${res.status}`);
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
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Portal cliente</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{PORTAL_TITLE}</h1>
            <p className="mt-2 text-sm text-slate-600">{PORTAL_SUBTITLE}</p>
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
              Contraseña: definila con{' '}
              <code className="rounded bg-slate-100 px-1">npm run db:provision:account -- --email=TU_EMAIL --domain=tu-dominio.com --password=TU_CLAVE</code>
              . La API necesita <code className="rounded bg-slate-100 px-1">PORTAL_JWT_SECRET</code>.
            </p>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-100">Portal cliente</p>
            <h1 className="mt-1 text-2xl font-bold">{PORTAL_TITLE}</h1>
            <p className="mt-1 text-sm text-violet-100">{PORTAL_SUBTITLE}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="self-start rounded-md border border-white/40 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Cerrar sesión
          </button>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            {usage?.planDisplay || usage?.planKey || 'Plan'}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Resumen de cuenta</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cuenta: <span className="font-medium">{usage?.account?.email || '—'}</span>
            {usage?.planDisplay ? (
              <>
                {' '}
                · Plan: <span className="font-medium">{usage.planDisplay}</span>
              </>
            ) : null}
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p>Cargando datos…</p>
            <p className="mt-2 text-xs text-slate-500">
              API: <span className="font-mono">{API_URL}</span>
            </p>
          </div>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase text-slate-500">Cleexs Scores vistos (perfiles distintos)</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{usage?.usage?.scoreViews ?? 0}</p>
                <p className="text-xs text-slate-500">Límite mensual: {usage?.limits?.scoreViews ?? 'Sin límite'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase text-slate-500">Reportes profundos generados</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{usage?.usage?.deepReportsGenerated ?? 0}</p>
                <p className="text-xs text-slate-500">
                  Límite mensual: {usage?.limits?.deepReportsGenerated ?? 'Sin límite'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase text-slate-500">Marcas en tu cuenta</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{brands.length}</p>
                <p className="text-xs text-slate-500">Asociadas a tu tenant</p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Próximos módulos</p>
              <p className="mt-1 text-xs text-slate-600">
                AEO herramientas, diagnóstico guiado y consultas avanzadas se integrarán aquí cuando los endpoints
                estén disponibles para tu sesión.
              </p>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Análisis Cleexs y reportes</h2>
                  <p className="text-xs text-slate-600">
                    Elegí marca, ejecutá una <strong>corrida</strong> (análisis estándar con prompts de tu plan) o un{' '}
                    <strong>reporte profundo</strong>. El historial muestra ambos; abrí &quot;Ver score y competencia&quot;
                    para el detalle.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                  <label className="text-xs text-slate-600">
                    Marca
                    <select
                      value={brandId}
                      onChange={(ev) => setBrandId(ev.target.value)}
                      className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => void runMonthlyAnalysis()}
                    disabled={
                      runningMes || !brandId || usage?.permissions?.canRunMonthlyAnalysis === false
                    }
                    className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {runningMes ? 'Iniciando corrida…' : 'Ejecutar corrida Cleexs'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateDeepReport()}
                    disabled={creating || !brandId || !usage?.permissions?.canGenerateDeepReport}
                    className="rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? 'Generando…' : 'Generar reporte profundo'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {reports.map((r) => (
                  <article
                    key={r.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-500">
                        {r.reportType === 'deep_report' ? 'Reporte profundo' : 'Corrida Cleexs'}
                      </p>
                      <p className="text-sm font-medium text-slate-900">{r.brand.name}</p>
                      {r.brand.domain ? <p className="text-xs text-slate-600">{r.brand.domain}</p> : null}
                    </div>
                    <div className="text-xs text-slate-600">
                      Estado: <span className="font-medium text-slate-900">{r.status}</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      Score: <span className="font-medium text-slate-900">{r.score ?? '—'}</span>
                    </div>
                    <div className="text-xs text-slate-600">{new Date(r.createdAt).toLocaleString()}</div>
                    <Link
                      href={`/portal-crecimiento/reporte/${r.id}`}
                      className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-center text-xs font-medium text-violet-800 hover:bg-violet-100"
                    >
                      Ver score y competencia
                    </Link>
                  </article>
                ))}
                {reports.length === 0 ? (
                  <p className="text-sm text-slate-600">Todavía no hay corridas ni reportes en el historial.</p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
