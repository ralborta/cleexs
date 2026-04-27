'use client';

import { useCallback, useEffect, useState } from 'react';

type UsageResponse = {
  usage?: { scoreViews?: number; deepReportsGenerated?: number };
  limits?: { scoreViews?: number | null; deepReportsGenerated?: number | null };
  permissions?: { canViewScore?: boolean; canGenerateDeepReport?: boolean };
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
  brand: { name: string; domain?: string };
};

type BrandItem = { id: string; name: string; domain?: string | null };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const TENANT_ID = process.env.NEXT_PUBLIC_PORTAL_TENANT_ID?.trim();
const USER_ID = process.env.NEXT_PUBLIC_PORTAL_USER_ID?.trim();
const BRAND_ID = process.env.NEXT_PUBLIC_PORTAL_BRAND_ID?.trim();
const PORTAL_TITLE =
  process.env.NEXT_PUBLIC_PORTAL_TITLE?.trim() || 'Cleexs Crecimiento · Portal cliente';
const PORTAL_SUBTITLE =
  process.env.NEXT_PUBLIC_PORTAL_SUBTITLE?.trim() ||
  'Uso del plan, reportes profundos y marcas asociadas a tu tenant (datos reales desde la API).';

export default function PortalCrecimientoPage() {
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!TENANT_ID || !USER_ID) {
      setError(
        'Falta configuración: definí NEXT_PUBLIC_PORTAL_TENANT_ID y NEXT_PUBLIC_PORTAL_USER_ID en apps/web/.env.local (UUID reales). Referencia: apps/web/.env.example.'
      );
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutMs = 18_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const fetchOpts: RequestInit = { cache: 'no-store', signal: controller.signal };
    const q = `tenantId=${encodeURIComponent(TENANT_ID)}&userId=${encodeURIComponent(USER_ID)}`;

    try {
      const [usageRes, reportsRes, brandsRes] = await Promise.all([
        fetch(`${API_URL}/api/me/usage?${q}`, fetchOpts),
        fetch(`${API_URL}/api/reports/app/reports?${q}`, fetchOpts),
        fetch(`${API_URL}/api/brands?tenantId=${encodeURIComponent(TENANT_ID)}`, fetchOpts),
      ]);

      if (!usageRes.ok || !reportsRes.ok || !brandsRes.ok) {
        throw new Error(
          `La API respondió con error (${API_URL}). Comprobá migraciones, DATABASE_URL en la API y que existan tenant/usuario.`
        );
      }

      const [usageData, reportsData, brandsData] = await Promise.all([
        usageRes.json(),
        reportsRes.json(),
        brandsRes.json(),
      ]);

      setUsage(usageData);
      setReports(Array.isArray(reportsData) ? reportsData : []);
      setBrands(Array.isArray(brandsData) ? brandsData : []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError(
          `La API no respondió en ${timeoutMs / 1000}s (${API_URL}). Verificá que el backend esté en marcha y la URL en NEXT_PUBLIC_API_URL.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Error cargando el portal');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  async function generateDeepReport() {
    if (!TENANT_ID || !USER_ID || !BRAND_ID) {
      setError(
        'Para generar un reporte profundo desde acá, agregá NEXT_PUBLIC_PORTAL_BRAND_ID en .env.local (UUID de la marca).'
      );
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/reports/${encodeURIComponent(BRAND_ID)}/deep-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: TENANT_ID, userId: USER_ID }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Error HTTP ${res.status}`);
      }
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando reporte');
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-100">Portal cliente</p>
          <h1 className="mt-1 text-2xl font-bold">{PORTAL_TITLE}</h1>
          <p className="mt-1 text-sm text-violet-100">{PORTAL_SUBTITLE}</p>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            {usage?.planDisplay || usage?.planKey || 'Plan'}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Resumen de cuenta</h2>
          <p className="mt-1 text-sm text-slate-600">
            Cuenta:{' '}
            <span className="font-medium">{usage?.account?.email || '—'}</span>
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
                <p className="text-xs uppercase text-slate-500">Marcas en el tenant</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{brands.length}</p>
                <p className="text-xs text-slate-500">Listado desde /api/brands</p>
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
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Reportes profundos</h2>
                  <p className="text-xs text-slate-600">Historial desde la API (runs tipo deep_report).</p>
                </div>
                <button
                  type="button"
                  onClick={() => void generateDeepReport()}
                  disabled={creating || !usage?.permissions?.canGenerateDeepReport}
                  className="rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? 'Generando…' : 'Generar reporte profundo'}
                </button>
              </div>

              <div className="space-y-2">
                {reports.map((r) => (
                  <article
                    key={r.id}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
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
                  </article>
                ))}
                {reports.length === 0 ? (
                  <p className="text-sm text-slate-600">Todavía no hay reportes en el historial.</p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
