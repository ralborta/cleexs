'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Globe, Loader2, Lock, Sparkles } from 'lucide-react';
import { PortalPremiumSidebarNav } from '@/components/portal/portal-premium-sidebar-nav';
import { CountryPicker, CountryFlag } from '@/components/country/country-picker';
import { findCountryByIso, findCountryByName, DEFAULT_COUNTRY_ISO } from '@/lib/countries';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};
type RunData = {
  id: string;
  brand: { id?: string; name: string; domain?: string | null; country?: string | null };
};

function isPremiumPlan(planKey?: string) {
  return planKey === 'crecimiento' || planKey === 'enterprise';
}

export default function VisibilidadGlobalPage() {
  const params = useParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<RunData | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        let token: string | null = null;
        try {
          token = sessionStorage.getItem(TOKEN_KEY);
        } catch {
          token = null;
        }
        if (!token) {
          setLoadError('No hay sesión. Volvé al portal e iniciá sesión.');
          setLoading(false);
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };
        const [runRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
        ]);
        if (!runRes.ok) throw new Error(`Error ${runRes.status}`);
        const runData = (await runRes.json()) as RunData;
        const usageData = usageRes.ok ? ((await usageRes.json()) as UsageResponse) : {};
        if (!cancelled) {
          setRun(runData);
          setUsage(usageData);
          setSelectedIso(findCountryByName(runData.brand?.country)?.iso ?? DEFAULT_COUNTRY_ISO);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Error');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const premium = isPremiumPlan(usage?.planKey);
  const selected = useMemo(() => findCountryByIso(selectedIso), [selectedIso]);

  async function generate() {
    if (!run?.brand.id || !selected) return;
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(TOKEN_KEY);
    } catch {
      token = null;
    }
    if (!token) {
      setActionError('Sesión vencida. Volvé al portal e iniciá sesión.');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/runs/portal/mes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brandId: run.brand.id,
          country: selected.name,
          countryIso: selected.iso,
          geoMarket: selected.geoMarket,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string; runId?: string };
      if (!res.ok) throw new Error(body.message || body.error || `Error HTTP ${res.status}`);
      if (body.runId) {
        window.location.href = `/portal-crecimiento/reporte/${body.runId}/premium`;
        return;
      }
      window.location.href = '/portal-crecimiento';
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Error al generar el análisis');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <p className="text-center text-sm text-slate-600">Cargando…</p>
      </main>
    );
  }
  if (loadError || !run) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-red-200/80 bg-red-50/90 p-6 text-sm text-red-900">
          <p>{loadError || 'No encontrado.'}</p>
          <Link href={`/portal-crecimiento/reporte/${runId}/premium`} className="font-semibold underline">
            ← Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen scroll-smooth bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        <PortalPremiumSidebarNav runId={runId} usage={usage} loadingPlan={loading} />

        <div className="space-y-4">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-5 shadow-sm md:p-6">
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-fuchsia-200/30 blur-3xl" aria-hidden />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 ring-violet-100">
                <Globe className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-500/80">
                  {run.brand.name}
                </p>
                <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Visibilidad global</h1>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Medí cómo te ven las IAs en distintos mercados. Elegí un país y generamos una corrida
                  pensada para ese mercado (prompts y competidores locales).
                </p>
              </div>
            </div>
          </section>

          {!premium ? (
            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-6 shadow-sm">
              <p className="flex items-center gap-2 text-base font-bold text-amber-950">
                <Lock className="h-4 w-4" /> Función Premium
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-900/90">
                Medir en varios países está incluido en el plan <strong>Premium</strong>. Tu plan actual mide
                en un solo país. Pasate a Premium para medir hasta 5 mercados distintos.
              </p>
              <Link
                href={`/portal-crecimiento/reporte/${runId}/premium/suscripcion`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
              >
                <Sparkles className="h-4 w-4" /> Ver planes Premium
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-slate-900">¿Para qué país querés medir?</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">
                  <Sparkles className="h-3 w-3" /> Hasta 5 países
                </span>
              </div>

              <CountryPicker value={selectedIso} onChange={setSelectedIso} />

              {actionError && (
                <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                  {actionError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  La corrida tarda 1–3 minutos. Te llevamos al informe cuando esté lista.
                </p>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy || !selected}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : selected ? (
                    <CountryFlag iso={selected.iso} className="h-4 w-6 overflow-hidden rounded-[2px] ring-1 ring-white/40" />
                  ) : null}
                  {busy ? 'Generando…' : selected ? `Generar análisis en ${selected.name}` : 'Elegí un país'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
