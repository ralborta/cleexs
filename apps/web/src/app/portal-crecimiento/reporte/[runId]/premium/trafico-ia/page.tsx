'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Crown,
  Globe,
  LineChart as LineChartIcon,
  Loader2,
  Lock,
  Plug,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Unplug,
} from 'lucide-react';
import { PortalPremiumSidebarNav } from '@/components/portal/portal-premium-sidebar-nav';

const TOKEN_KEY = 'cleexs_portal_token';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────

type UsageResponse = {
  planKey?: string;
  planDisplay?: string;
  usage?: { scoreViews?: number };
  limits?: { scoreViews?: number | null };
};

type GoogleStatus = {
  planKey: string;
  premium: boolean;
  configured: boolean;
  integration: null | {
    id: string;
    googleEmail: string;
    status: 'active' | 'revoked' | 'error' | string;
    connectedAt: string;
    lastErrorMessage: string | null;
    lastErrorAt: string | null;
    propertiesCount: number;
  };
};

type GA4Property = {
  accountId: string;
  accountName: string;
  propertyId: string;
  propertyName: string;
  displayName: string;
};

type AITrafficResponse = {
  brand: { id: string; name: string; domain: string | null };
  property: null | {
    id: string;
    ga4PropertyId: string;
    ga4PropertyName: string | null;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
  };
  windowDays: number;
  totals: { sessions: number; totalUsers: number; conversions: number };
  bySource: Array<{
    aiSource: string;
    sessions: number;
    totalUsers: number;
    conversions: number;
    topLanding?: string | null;
  }>;
  series: Array<{ aiSource: string; points: Array<{ date: string; sessions: number }> }>;
};

type RunBrand = { id?: string; name: string; domain?: string | null };
type PortalRun = { brand: RunBrand };

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const AI_LABELS: Record<string, { label: string; color: string; ring: string }> = {
  chatgpt:    { label: 'ChatGPT',    color: 'bg-emerald-500', ring: 'ring-emerald-100' },
  perplexity: { label: 'Perplexity', color: 'bg-sky-500',     ring: 'ring-sky-100' },
  gemini:     { label: 'Gemini',     color: 'bg-violet-500',  ring: 'ring-violet-100' },
  claude:     { label: 'Claude',     color: 'bg-amber-500',   ring: 'ring-amber-100' },
  copilot:    { label: 'Copilot',    color: 'bg-blue-500',    ring: 'ring-blue-100' },
  you:        { label: 'You.com',    color: 'bg-rose-500',    ring: 'ring-rose-100' },
  otros_ia:   { label: 'Otras IA',   color: 'bg-slate-400',   ring: 'ring-slate-100' },
};
function aiLabel(key: string) {
  return AI_LABELS[key] || { label: key, color: 'bg-slate-400', ring: 'ring-slate-100' };
}

function isPremiumPlan(planKey?: string | null) {
  const k = (planKey || '').toLowerCase();
  return k === 'crecimiento' || k === 'enterprise' || k === 'admin';
}

function fmtNumber(n: number) {
  return new Intl.NumberFormat('es-AR').format(n);
}

function fmtRelativeTime(iso: string | null) {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'hace un instante';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Página
// ──────────────────────────────────────────────────────────────────────────────

export default function TraficoIAPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const runId = params?.runId as string;
  const basePath = `/portal-crecimiento/reporte/${runId}/premium`;

  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState<string>('');
  const [traffic, setTraffic] = useState<AITrafficResponse | null>(null);
  const [properties, setProperties] = useState<GA4Property[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'select' | 'disconnect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'error'; msg: string } | null>(null);

  // Mostrar flash desde el callback de Google
  useEffect(() => {
    const g = search?.get('google');
    const detail = search?.get('googleDetail');
    if (g === 'ok') {
      setFlash({ kind: 'ok', msg: 'Cuenta de Google conectada. Ahora elegí qué propiedad GA4 querés ver.' });
    } else if (g === 'error') {
      setFlash({
        kind: 'error',
        msg: `No se pudo conectar Google${detail ? ` (${detail})` : ''}. Intentá de nuevo.`,
      });
    }
  }, [search]);

  // Carga inicial
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let token: string | null = null;
        try { token = sessionStorage.getItem(TOKEN_KEY); } catch { token = null; }
        if (!token) {
          router.replace('/portal-crecimiento');
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };

        const [usageRes, runRes, statusRes] = await Promise.all([
          fetch(`${API_URL}/api/me/usage`, { cache: 'no-store', headers }),
          fetch(`${API_URL}/api/reports/app/reports/${encodeURIComponent(runId)}`, {
            cache: 'no-store',
            headers,
          }),
          fetch(`${API_URL}/api/google/status`, { cache: 'no-store', headers }),
        ]);

        if (usageRes.status === 401 || statusRes.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          router.replace('/portal-crecimiento');
          return;
        }

        const usageData = usageRes.ok ? ((await usageRes.json()) as UsageResponse) : {};
        const runData = runRes.ok ? ((await runRes.json()) as PortalRun) : null;
        const statusData = statusRes.ok ? ((await statusRes.json()) as GoogleStatus) : null;

        if (cancelled) return;

        setUsage(usageData);
        setLoadingUsage(false);
        setStatus(statusData);
        setBrandId(runData?.brand?.id || null);
        setBrandName(runData?.brand?.name || '');

        // Si está conectado y hay brand, traemos tráfico
        if (statusData?.integration?.status === 'active' && runData?.brand?.id) {
          const tRes = await fetch(
            `${API_URL}/api/google/brands/${encodeURIComponent(runData.brand.id)}/ai-traffic`,
            { cache: 'no-store', headers }
          );
          if (tRes.ok) {
            const tData = (await tRes.json()) as AITrafficResponse;
            if (!cancelled) setTraffic(tData);

            // si no hay propiedad seleccionada, listamos GA4 properties para que elija
            if (!tData.property) {
              const pRes = await fetch(`${API_URL}/api/google/properties`, {
                cache: 'no-store',
                headers,
              });
              if (pRes.ok) {
                const pData = (await pRes.json()) as { properties: GA4Property[] };
                if (!cancelled) setProperties(pData.properties);
              }
            }
          }
        }

        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(String(err?.message || err));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router, runId]);

  // Acciones
  async function authHeader() {
    const token = (() => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } })();
    if (!token) throw new Error('Sesión expirada.');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  async function startConnect() {
    setBusy('connect');
    setError(null);
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_URL}/api/google/oauth/start`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brandId: brandId || undefined,
          returnTo: `${basePath}/trafico-ia`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'Error iniciando OAuth');
      if (!data?.authorizeUrl) throw new Error('Respuesta sin authorizeUrl');
      window.location.href = data.authorizeUrl as string;
    } catch (err: any) {
      setError(String(err?.message || err));
      setBusy(null);
    }
  }

  async function selectProperty(p: GA4Property) {
    if (!brandId) {
      setError('Falta brandId del reporte.');
      return;
    }
    setBusy('select');
    setError(null);
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_URL}/api/google/properties/select`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          brandId,
          propertyId: p.propertyId,
          propertyName: p.propertyName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'Error al seleccionar propiedad');
      // Disparamos sync para que muestre datos al toque
      await runSync();
    } catch (err: any) {
      setError(String(err?.message || err));
      setBusy(null);
    }
  }

  async function runSync() {
    if (!brandId) return;
    setBusy('sync');
    setError(null);
    try {
      const headers = await authHeader();
      const res = await fetch(
        `${API_URL}/api/google/brands/${encodeURIComponent(brandId)}/sync`,
        { method: 'POST', headers }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || 'Error en sync');
      // Refrescamos tráfico
      const tRes = await fetch(
        `${API_URL}/api/google/brands/${encodeURIComponent(brandId)}/ai-traffic`,
        { cache: 'no-store', headers }
      );
      if (tRes.ok) setTraffic((await tRes.json()) as AITrafficResponse);
      setBusy(null);
      setFlash({ kind: 'ok', msg: 'Tráfico sincronizado.' });
    } catch (err: any) {
      setError(String(err?.message || err));
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar tu cuenta de Google? Vamos a borrar la integración y los datos sincronizados.')) return;
    setBusy('disconnect');
    setError(null);
    try {
      const headers = await authHeader();
      const res = await fetch(`${API_URL}/api/google/disconnect`, { method: 'POST', headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any)?.message || 'Error al desconectar');
      }
      setStatus((prev) => prev ? { ...prev, integration: null } : prev);
      setTraffic(null);
      setProperties(null);
      setBusy(null);
      setFlash({ kind: 'ok', msg: 'Google desconectado.' });
    } catch (err: any) {
      setError(String(err?.message || err));
      setBusy(null);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 p-3 sm:p-5">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[280px_1fr]">
        <PortalPremiumSidebarNav runId={runId} usage={usage} loadingPlan={loadingUsage} />

        <div className="space-y-4">
          <Header brandName={brandName} />

          {flash && (
            <FlashBanner
              kind={flash.kind}
              message={flash.msg}
              onClose={() => setFlash(null)}
            />
          )}

          {loading ? (
            <LoadingCard />
          ) : error ? (
            <ErrorCard message={error} onRetry={() => window.location.reload()} />
          ) : !status?.premium ? (
            <NotPremiumCard planKey={status?.planKey || ''} basePath={basePath} />
          ) : !status?.configured ? (
            <NotConfiguredCard />
          ) : !status?.integration ? (
            <NotConnectedCard onConnect={startConnect} connecting={busy === 'connect'} />
          ) : status.integration.status !== 'active' ? (
            <IntegrationErrorCard
              integration={status.integration}
              onReconnect={startConnect}
              connecting={busy === 'connect'}
            />
          ) : !traffic?.property ? (
            <SelectPropertyCard
              googleEmail={status.integration.googleEmail}
              properties={properties || []}
              onSelect={selectProperty}
              onDisconnect={disconnect}
              busy={busy}
            />
          ) : traffic.totals.sessions === 0 ? (
            <NoDataYetCard
              googleEmail={status.integration.googleEmail}
              propertyName={traffic.property.ga4PropertyName || traffic.property.ga4PropertyId}
              lastSyncAt={traffic.property.lastSyncAt}
              onSync={runSync}
              syncing={busy === 'sync'}
              onDisconnect={disconnect}
            />
          ) : (
            <DashboardConnected
              googleEmail={status.integration.googleEmail}
              propertyName={traffic.property.ga4PropertyName || traffic.property.ga4PropertyId}
              lastSyncAt={traffic.property.lastSyncAt}
              traffic={traffic}
              onSync={runSync}
              syncing={busy === 'sync'}
              onDisconnect={disconnect}
            />
          )}
        </div>
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────────────────────

function Header({ brandName }: { brandName: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
        <LineChartIcon className="h-3.5 w-3.5" />
        Tráfico de IAs
      </div>
      <h1 className="text-3xl font-bold text-slate-900">
        ¿Cuánto tráfico te están enviando las IAs?
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Medí en tiempo real cuántos usuarios llegan a {brandName || 'tu sitio'} desde
        <br className="hidden sm:block" />
        <strong> ChatGPT, Perplexity, Gemini, Claude</strong> y otras IAs generativas.
      </p>
    </div>
  );
}

function FlashBanner({
  kind,
  message,
  onClose,
}: {
  kind: 'ok' | 'error';
  message: string;
  onClose: () => void;
}) {
  const ok = kind === 'ok';
  return (
    <div
      className={[
        'flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-800',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        {ok ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <span>{message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-xs font-semibold opacity-70 hover:opacity-100"
      >
        Cerrar
      </button>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
      <p className="mt-3 text-sm text-slate-600">Cargando tu integración con Google…</p>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">No pudimos cargar esta sección.</p>
          <p className="mt-1 text-sm">{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}

function NotPremiumCard({ planKey, basePath }: { planKey: string; basePath: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-white to-violet-50/40 shadow-sm">
      <div className="relative px-8 py-10">
        <div className="absolute right-6 top-6 inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          <Crown className="h-3.5 w-3.5" />
          Crecimiento
        </div>

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
          <Lock className="h-7 w-7 text-violet-700" />
        </div>

        <h2 className="mt-5 text-2xl font-bold text-slate-900">
          Medí cuánto tráfico te envían las IAs
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-600">
          Conectá tu cuenta de Google Analytics para ver, en tiempo real, cuántos usuarios llegan
          a tu sitio desde <strong>ChatGPT, Perplexity, Gemini y Claude</strong>. Esta función
          está disponible en el plan Crecimiento.
        </p>

        <ul className="mt-5 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          {[
            'Sesiones por IA, día a día',
            'Top landing pages desde cada IA',
            'Conversiones atribuidas a IA',
            'Sincronización automática cada 6 h',
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <a
            href={`${basePath}/suscripcion`}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            <Sparkles className="h-4 w-4" />
            Pasarme al plan Crecimiento
          </a>
          <span className="text-xs text-slate-500">
            Tu plan actual: <strong className="capitalize">{planKey || 'free'}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

function NotConfiguredCard() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-semibold">Estamos terminando de habilitar esta función.</p>
          <p className="mt-1 text-sm">
            La integración con Google Analytics se está configurando del lado de Cleexs.
            Vas a poder conectar tu cuenta apenas esté lista. Te avisamos.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotConnectedCard({
  onConnect,
  connecting,
}: {
  onConnect: () => void;
  connecting: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100">
          <Plug className="h-8 w-8 text-violet-700" />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-slate-900">
          Conectá Google Analytics
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Una sola vez, con tu cuenta de Google. Solo permisos de <strong>lectura</strong>.
          Nunca modificamos ni vendemos tus datos.
        </p>

        <button
          type="button"
          onClick={onConnect}
          disabled={connecting}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
        >
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
          {connecting ? 'Redirigiendo a Google…' : 'Conectar Google Analytics'}
        </button>

        <p className="mt-3 text-[11px] text-slate-500">
          Cleexs solicita: <code className="rounded bg-slate-100 px-1 py-0.5">analytics.readonly</code> ·{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">webmasters.readonly</code>
        </p>
      </div>

      {/* Preview cards (lo que verás cuando conectes) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(AI_LABELS).slice(0, 4).map(([key, conf]) => (
          <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${conf.color}`} />
              <p className="text-xs font-semibold text-slate-700">{conf.label}</p>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-300">— sesiones</p>
            <p className="mt-1 text-[11px] text-slate-400">Conectá Google para ver datos</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationErrorCard({
  integration,
  onReconnect,
  connecting,
}: {
  integration: NonNullable<GoogleStatus['integration']>;
  onReconnect: () => void;
  connecting: boolean;
}) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold">
            Tu integración con Google ({integration.googleEmail}) tiene un problema.
          </p>
          <p className="mt-1 text-sm">
            Estado: <strong>{integration.status}</strong>.{' '}
            {integration.lastErrorMessage && (
              <>Detalle: <span className="font-mono text-xs">{integration.lastErrorMessage}</span>.{' '}</>
            )}
            Reconectá para reactivar la sincronización.
          </p>
          <button
            type="button"
            onClick={onReconnect}
            disabled={connecting}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Reconectar Google
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectPropertyCard({
  googleEmail,
  properties,
  onSelect,
  onDisconnect,
  busy,
}: {
  googleEmail: string;
  properties: GA4Property[];
  onSelect: (p: GA4Property) => void;
  onDisconnect: () => void;
  busy: 'connect' | 'sync' | 'select' | 'disconnect' | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <ConnectedHeader email={googleEmail} onDisconnect={onDisconnect} />

      <div className="mt-5">
        <h3 className="text-base font-bold text-slate-900">Elegí qué propiedad GA4 querés ver</h3>
        <p className="mt-1 text-sm text-slate-600">
          Tu cuenta tiene acceso a {properties.length} {properties.length === 1 ? 'propiedad' : 'propiedades'}.
          Elegí cuál asociar a este reporte.
        </p>

        {properties.length === 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No encontramos propiedades GA4 accesibles con esta cuenta de Google.
            Verificá que tu usuario tenga acceso a GA4 en{' '}
            <a
              href="https://analytics.google.com/"
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline"
            >
              analytics.google.com
            </a>.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {properties.map((p) => (
              <li key={p.propertyId}>
                <button
                  type="button"
                  disabled={busy === 'select'}
                  onClick={() => onSelect(p)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{p.propertyName}</p>
                    <p className="text-xs text-slate-500">
                      Cuenta: {p.accountName} · {p.propertyId}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NoDataYetCard({
  googleEmail,
  propertyName,
  lastSyncAt,
  onSync,
  syncing,
  onDisconnect,
}: {
  googleEmail: string;
  propertyName: string;
  lastSyncAt: string | null;
  onSync: () => void;
  syncing: boolean;
  onDisconnect: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <ConnectedHeader email={googleEmail} onDisconnect={onDisconnect} />

      <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/40 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
          <Globe className="h-7 w-7 text-violet-700" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-slate-900">
          Aún no tenemos sesiones de IAs en los últimos 30 días.
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Esto puede ser normal si recién instalaste GA4 o si tu sitio todavía no
          recibe tráfico desde ChatGPT/Perplexity/Gemini/Claude. Probá una sincronización manual.
        </p>
        <p className="mt-3 text-[11px] text-slate-500">
          Propiedad: <strong>{propertyName}</strong> · Última sync: {fmtRelativeTime(lastSyncAt)}
        </p>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sincronizar ahora
        </button>
      </div>
    </div>
  );
}

function DashboardConnected({
  googleEmail,
  propertyName,
  lastSyncAt,
  traffic,
  onSync,
  syncing,
  onDisconnect,
}: {
  googleEmail: string;
  propertyName: string;
  lastSyncAt: string | null;
  traffic: AITrafficResponse;
  onSync: () => void;
  syncing: boolean;
  onDisconnect: () => void;
}) {
  const topSource = traffic.bySource[0]?.aiSource;
  const maxSessions = useMemo(
    () => Math.max(...traffic.bySource.map((s) => s.sessions), 1),
    [traffic.bySource]
  );

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            Conectado a <strong>{googleEmail}</strong> · Propiedad: <strong>{propertyName}</strong>
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span>Última sync {fmtRelativeTime(lastSyncAt)}</span>
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Sincronizar
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-100"
          >
            <Unplug className="h-3.5 w-3.5" /> Desconectar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Sesiones desde IAs"
          value={traffic.totals.sessions}
          sub={`últimos ${traffic.windowDays} días`}
          accent="violet"
          Icon={TrendingUp}
        />
        <KpiCard
          label="Usuarios únicos"
          value={traffic.totals.totalUsers}
          sub="desde IA generativa"
          accent="sky"
          Icon={Globe}
        />
        <KpiCard
          label="Conversiones"
          value={traffic.totals.conversions}
          sub="atribuidas a IA"
          accent="emerald"
          Icon={CheckCircle2}
        />
      </div>

      {/* Breakdown por IA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Tráfico por IA</h3>
          {topSource && (
            <span className="rounded-full bg-violet-100 px-3 py-1 text-[11px] font-semibold text-violet-700">
              Líder: {aiLabel(topSource).label}
            </span>
          )}
        </div>
        <ul className="space-y-3">
          {traffic.bySource.map((s) => {
            const conf = aiLabel(s.aiSource);
            const pct = Math.round((s.sessions / maxSessions) * 100);
            return (
              <li key={s.aiSource}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${conf.color}`} />
                    <span className="font-semibold text-slate-800">{conf.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span><strong className="text-slate-900">{fmtNumber(s.sessions)}</strong> sesiones</span>
                    <span><strong className="text-slate-700">{fmtNumber(s.totalUsers)}</strong> usuarios</span>
                    <span><strong className="text-emerald-700">{fmtNumber(s.conversions)}</strong> conv.</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${conf.color}`} style={{ width: `${pct}%` }} />
                </div>
                {s.topLanding && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Top landing: <span className="font-mono text-slate-700">{s.topLanding}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Serie diaria (sparkline simple SVG) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-bold text-slate-900">Tendencia diaria</h3>
        <DailyChart series={traffic.series} />
        <p className="mt-3 text-[11px] text-slate-500">
          Eje vertical: sesiones diarias por IA · Eje horizontal: días (más reciente a la derecha)
        </p>
      </div>
    </div>
  );
}

function ConnectedHeader({
  email,
  onDisconnect,
}: {
  email: string;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">Cuenta de Google conectada</p>
          <p className="text-xs text-slate-500">{email}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onDisconnect}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
      >
        <Unplug className="h-3.5 w-3.5" /> Desconectar
      </button>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  Icon,
}: {
  label: string;
  value: number;
  sub: string;
  accent: 'violet' | 'sky' | 'emerald';
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const accentBg = { violet: 'bg-violet-100 text-violet-700', sky: 'bg-sky-100 text-sky-700', emerald: 'bg-emerald-100 text-emerald-700' }[accent];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accentBg}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-3xl font-bold text-slate-900">{fmtNumber(value)}</p>
        <p className="text-xs text-slate-500">{sub}</p>
      </div>
    </div>
  );
}

function DailyChart({
  series,
}: {
  series: Array<{ aiSource: string; points: Array<{ date: string; sessions: number }> }>;
}) {
  // Tomamos union de todas las fechas, ordenadas asc
  const dates = useMemo(() => {
    const set = new Set<string>();
    series.forEach((s) => s.points.forEach((p) => set.add(p.date)));
    return [...set].sort();
  }, [series]);

  const maxY = useMemo(() => {
    let m = 0;
    series.forEach((s) => s.points.forEach((p) => { if (p.sessions > m) m = p.sessions; }));
    return Math.max(1, m);
  }, [series]);

  if (dates.length === 0) {
    return <p className="text-sm text-slate-500">Sin datos en el rango.</p>;
  }

  const W = 720;
  const H = 180;
  const padL = 32, padR = 8, padT = 8, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  function xFor(idx: number) {
    if (dates.length === 1) return padL + innerW / 2;
    return padL + (idx / (dates.length - 1)) * innerW;
  }
  function yFor(v: number) {
    return padT + innerH - (v / maxY) * innerH;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img" aria-label="Sesiones diarias por IA">
        {/* eje Y guía */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={padL} x2={W - padR}
            y1={padT + innerH * (1 - f)} y2={padT + innerH * (1 - f)}
            stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1"
          />
        ))}
        {/* labels Y */}
        {[0, 0.5, 1].map((f) => (
          <text key={f} x={4} y={padT + innerH * (1 - f) + 3} fontSize="9" fill="#94a3b8">
            {Math.round(maxY * f)}
          </text>
        ))}
        {/* labels X: primer y último */}
        <text x={padL} y={H - 6} fontSize="9" fill="#94a3b8">{dates[0]}</text>
        <text x={W - padR - 50} y={H - 6} fontSize="9" fill="#94a3b8">{dates[dates.length - 1]}</text>

        {/* líneas por IA */}
        {series.map((s) => {
          const conf = aiLabel(s.aiSource);
          const byDate = new Map(s.points.map((p) => [p.date, p.sessions]));
          const d = dates
            .map((date, i) => {
              const v = byDate.get(date) || 0;
              return `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`;
            })
            .join(' ');
          const stroke =
            conf.color.includes('emerald') ? '#10b981' :
            conf.color.includes('sky') ? '#0ea5e9' :
            conf.color.includes('violet') ? '#8b5cf6' :
            conf.color.includes('amber') ? '#f59e0b' :
            conf.color.includes('blue') ? '#3b82f6' :
            conf.color.includes('rose') ? '#f43f5e' : '#64748b';
          return (
            <path key={s.aiSource} d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          );
        })}
      </svg>

      {/* Leyenda */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
        {series.map((s) => {
          const conf = aiLabel(s.aiSource);
          return (
            <span key={s.aiSource} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${conf.color}`} />
              {conf.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
