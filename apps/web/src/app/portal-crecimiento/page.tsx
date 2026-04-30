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
  process.env.NEXT_PUBLIC_PORTAL_TITLE?.trim() || 'Cleexs Crecimiento · Portal cliente';
/** Subtítulo del panel (mock 1). */
const PORTAL_PANEL_SUBTITLE =
  process.env.NEXT_PUBLIC_PORTAL_PANEL_SUBTITLE?.trim() ||
  'Vista dedicada para mostrar score propio, competidores y reportes profundos.';
const PORTAL_LOGIN_SUBTITLE =
  process.env.NEXT_PUBLIC_PORTAL_SUBTITLE?.trim() ||
  'Iniciá sesión con tu email y contraseña de cuenta. Cada usuario ve solo su plan y su uso.';

function limitLabel(v: number | null | undefined): string {
  if (v == null) return 'Ilimitado';
  return String(v);
}

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
  const [panel, setPanel] = useState<PanelResponse | null>(null);
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
    const timeoutMs = 22_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const fetchOpts: RequestInit = {
      cache: 'no-store',
      signal: controller.signal,
      headers: { ...authHeaders(token) },
    };

    try {
      const panelQs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : '';
      const [usageRes, reportsRes, brandsRes, panelRes] = await Promise.all([
        fetch(`${API_URL}/api/me/usage`, fetchOpts),
        fetch(`${API_URL}/api/reports/app/reports`, fetchOpts),
        fetch(`${API_URL}/api/brands`, fetchOpts),
        fetch(`${API_URL}/api/reports/app/portal-panel${panelQs}`, fetchOpts),
      ]);

      if (
        usageRes.status === 401 ||
        reportsRes.status === 401 ||
        brandsRes.status === 401 ||
        panelRes.status === 401
      ) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setError('Sesión vencida o inválida. Volvé a iniciar sesión.');
        return;
      }

      if (!usageRes.ok || !reportsRes.ok || !brandsRes.ok || !panelRes.ok) {
        throw new Error(
          `La API respondió con error (${API_URL}). Comprobá migraciones, PORTAL_JWT_SECRET y despliegue de la última API (portal-panel).`
        );
      }

      const [usageData, reportsData, brandsData, panelData] = await Promise.all([
        usageRes.json(),
        reportsRes.json(),
        brandsRes.json(),
        panelRes.json(),
      ]);

      setUsage(usageData);
      setPanel(panelData as PanelResponse);
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
          `La API no respondió en ${timeoutMs / 1000}s (${API_URL}). Verificá NEXT_PUBLIC_API_URL y el backend.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Error cargando el portal');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [token, brandId]);

  useEffect(() => {
    if (token) void loadData();
    else {
      setUsage(null);
      setReports([]);
      setBrands([]);
      setBrandId('');
      setPanel(null);
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
    setPanel(null);
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
          </form>
        </div>
      </main>
    );
  }

  const planUpper = (usage?.planDisplay || usage?.planKey || 'Plan').toUpperCase();
  const latestReport = [...reports].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] || null;

  return (
    <main className="min-h-screen bg-slate-50 p-4 pb-12 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-100/95">Portal cliente</p>
            <h1 className="mt-1 text-2xl font-bold">{PORTAL_TITLE}</h1>
            <p className="mt-1 text-sm leading-relaxed text-violet-100">{PORTAL_PANEL_SUBTITLE}</p>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">{planUpper}</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">Vista cliente · cuenta operativa</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cuenta: <span className="font-medium">{usage?.account?.email || '—'}</span>
            {usage?.planDisplay ? (
              <>
                {' '}
                · Plan: <span className="font-medium">{usage.planDisplay}</span>
              </>
            ) : null}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {latestReport ? (
              <>
                <Link
                  href={`/portal-crecimiento/reporte/${latestReport.id}`}
                  className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-900 hover:bg-violet-100"
                >
                  Abrir último resultado
                </Link>
                <Link
                  href={`/portal-crecimiento/reporte/${latestReport.id}/premium`}
                  className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
                >
                  Abrir último Premium
                </Link>
              </>
            ) : (
              <span className="text-xs text-slate-500">
                No hay corridas todavía para abrir en modo Premium.
              </span>
            )}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p>Cargando panel…</p>
            <p className="mt-2 text-xs text-slate-500">
              API: <span className="font-mono">{API_URL}</span>
            </p>
          </div>
        ) : (
          <>
            {/* Mock 1 — KPIs */}
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase text-slate-500">Cleexs Scores vistos</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                  {usage?.usage?.scoreViews ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Límite: {limitLabel(usage?.limits?.scoreViews)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase text-slate-500">Reportes profundos</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                  {usage?.usage?.deepReportsGenerated ?? 0}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Límite: {limitLabel(usage?.limits?.deepReportsGenerated)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-medium uppercase text-slate-500">Marcas gestionadas</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{brands.length}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {panel?.multimarca ? 'Multimarca habilitado' : 'Una marca en la cuenta'}
                </p>
              </div>
            </section>

            {/* Mock 1 — Tabla comparativa (panel; no el reporte largo) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Cleexs Score comparativo</h2>
                  <p className="text-xs text-slate-600">
                    Tu marca, el resto de marcas de tu cuenta y competidores en una sola vista (según la última
                    corrida completada y PRIA por marca).
                  </p>
                </div>
                <label className="text-xs text-slate-600">
                  Marca pivot
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
              </div>
              <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {(panel?.compareRows?.length ?? 0) === 0 ? (
                  <p className="p-4 text-sm text-slate-600">
                    Sin filas todavía. Ejecutá una corrida completada o agregá marcas y competidores.
                  </p>
                ) : (
                  panel!.compareRows.map((row) => (
                    <div
                      key={`${row.tag}-${row.name}-${row.rank}`}
                      className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {row.rank}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{row.name}</p>
                          {row.domain ? (
                            <p className="text-xs text-slate-500">{row.domain}</p>
                          ) : null}
                          <span
                            className={
                              row.tag === 'mi_empresa'
                                ? 'mt-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800'
                                : 'mt-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900'
                            }
                          >
                            {row.tag === 'mi_empresa' ? 'Mi empresa' : 'Competidor'}
                          </span>
                        </div>
                      </div>
                      <p className="text-2xl font-bold tabular-nums text-slate-900 sm:text-right">
                        {row.score ?? '—'}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Los scores de competidores se estiman desde la última corrida de la marca pivot cuando hay Top 3
                parseable; el resultado del diagnóstico (secciones 1–8 + anexo técnico) está en “Ver resultado del
                diagnóstico”.
              </p>
            </section>

            {/* Mock 2 — Operación del plan (UI; integraciones progresivas) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Operación del plan</h2>
              <p className="mt-1 text-xs text-slate-600">
                Generar diagnóstico propio, ejecutar herramientas AEO, consultas y reporte completo. La corrida
                estándar ya está disponible abajo; el resto se conectará a medida que los endpoints estén listos.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  disabled
                  className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-left opacity-80"
                >
                  <p className="font-medium text-violet-800">Generar diagnóstico propio</p>
                  <p className="mt-1 text-xs text-slate-600">Resumen ejecutivo con foco de mejora inmediata.</p>
                  <p className="mt-2 text-[10px] font-medium uppercase text-amber-700">Próximamente</p>
                </button>
                <button
                  type="button"
                  disabled
                  className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-left opacity-80"
                >
                  <p className="font-medium text-violet-800">Correr herramientas AEO</p>
                  <p className="mt-1 text-xs text-slate-600">Auditoría técnica y oportunidades por módulo.</p>
                  <p className="mt-2 text-[10px] font-medium uppercase text-amber-700">Próximamente</p>
                </button>
              </div>
              <div className="mt-6">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Consulta inteligente
                </p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    readOnly
                    disabled
                    value="¿Cómo subimos el score esta temporada?"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  />
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white opacity-50"
                  >
                    Consultar
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Crear prompt propio
                </p>
                <textarea
                  readOnly
                  disabled
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  value="Compará tu marca vs un competidor en intención de compra y recomendá 3 mejoras accionables."
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    disabled
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white opacity-50"
                  >
                    Ejecutar prompt
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Sugerencias priorizadas</h2>
              <p className="mt-1 text-xs text-slate-600">Acciones con impacto esperado en score (plantilla de UI).</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  {
                    title: 'SEO técnico',
                    body: 'Corregir schema.org Organization y Product en páginas clave.',
                    impact: '+4 a +7 pts Cleexs Score',
                    prio: 'Alta',
                  },
                  {
                    title: 'Contenido',
                    body: 'Publicar piezas orientadas a intención de compra en tus categorías débiles.',
                    impact: 'Mejora presencia en Top 3 IA',
                    prio: 'Alta',
                  },
                  {
                    title: 'Autoridad',
                    body: 'Conseguir menciones en medios o directorios del sector.',
                    impact: 'Más citaciones en respuestas',
                    prio: 'Media',
                  },
                ].map((s) => (
                  <div key={s.title} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm">
                    <span
                      className={
                        s.prio === 'Alta'
                          ? 'rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900'
                          : 'rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700'
                      }
                    >
                      {s.prio}
                    </span>
                    <p className="mt-2 font-semibold text-slate-900">{s.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{s.body}</p>
                    <p className="mt-2 text-[11px] text-violet-700">{s.impact}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-slate-400">
                Ejemplos visuales; las sugerencias dinámicas llegarán con el motor de recomendaciones.
              </p>
            </section>

            {/* Mock 3 — Historial (resultado del diagnóstico: informe ejecutivo, no solo listado por prompt) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-slate-900">Historial de diagnósticos</h2>
                <p className="text-xs text-slate-600">
                  Ver corridas anteriores y abrir el <strong>resultado del diagnóstico</strong> (resumen, KPIs,
                  comparativa, métricas y acciones). El listado largo por prompt queda como anexo al final.
                </p>
              </div>
              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="mb-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Reportes completos</p>
                    <p className="text-[11px] text-slate-500">Generá una nueva corrida o reporte profundo.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void runMonthlyAnalysis()}
                      disabled={
                        runningMes || !brandId || usage?.permissions?.canRunMonthlyAnalysis === false
                      }
                      className="rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {runningMes ? 'Iniciando…' : 'Ejecutar corrida Cleexs'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void generateDeepReport()}
                      disabled={creating || !brandId || !usage?.permissions?.canGenerateDeepReport}
                      className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creating ? 'Generando…' : 'Generar reporte profundo'}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {reports.map((r) => (
                    <article
                      key={r.id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-500">
                          {r.reportType === 'deep_report' ? 'Reporte profundo' : 'Corrida Cleexs'}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">{r.brand.name}</p>
                        {r.brand.domain ? <p className="text-xs text-slate-600">{r.brand.domain}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span>
                          Estado: <span className="font-medium text-slate-900">{r.status}</span>
                        </span>
                        <span>
                          Score:{' '}
                          <span className="font-medium text-slate-900">{r.score ?? '—'}</span>
                        </span>
                        <span>{new Date(r.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Link
                          href={`/portal-crecimiento/reporte/${r.id}`}
                          className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-center text-xs font-semibold text-violet-900 hover:bg-violet-100"
                        >
                          Ver resultado
                        </Link>
                        <Link
                          href={`/portal-crecimiento/reporte/${r.id}/premium`}
                          className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-center text-xs font-semibold text-indigo-900 hover:bg-indigo-100"
                        >
                          Ver Premium
                        </Link>
                      </div>
                    </article>
                  ))}
                  {reports.length === 0 ? (
                    <p className="text-sm text-slate-600">Todavía no hay entradas en el historial.</p>
                  ) : null}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
