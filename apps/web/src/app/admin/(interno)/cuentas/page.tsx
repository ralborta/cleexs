'use client';

import {
  Activity,
  Building2,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type EmailOps =
  | {
      campaignsConfigured: number;
      sendsLast30Days: number;
      byStatusLast30Days: Record<string, number>;
    }
  | { unavailable: true; reason?: string };

type DashboardSummary = {
  generatedAt: string;
  windowDays: number;
  tenantsOperational: number;
  usersTotal: number;
  usersWithPortalPassword: number;
  brandsTotal: number;
  runsLast30Days: number;
  entitlementOverridesActive: number;
  referralRewardsGrantedTenants: number;
  emailOps: EmailOps;
  integrations: {
    resendApiKeyConfigured: boolean;
    resendSmtpRelayConfigured?: boolean;
    smtpOutboundConfigured?: boolean;
  };
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  tenantId: string;
  tenantCode: string;
  role: string;
  hasPortalPassword: boolean;
};

type OverrideRow = {
  id: string;
  tenantId: string | null;
  userId: string | null;
  grantPlan: string;
  planDisplay: string;
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  reason: string | null;
};

const field =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15';
const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500';
const panel =
  'rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-900/[0.06] ring-1 ring-slate-900/[0.04] md:p-8';

export default function AdminCuentasPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dash, setDash] = useState<DashboardSummary | null>(null);
  const [dashBusy, setDashBusy] = useState(false);

  const [pEmail, setPEmail] = useState('');
  const [pDomain, setPDomain] = useState('');
  const [pPlan, setPPlan] = useState<'crecimiento' | 'free'>('crecimiento');
  const [pPassword, setPPassword] = useState('');
  const [pCourtesy, setPCourtesy] = useState(true);
  const [pBusy, setPBusy] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [uBusy, setUBusy] = useState(false);

  const [oTenantId, setOTenantId] = useState('');
  const [oUserId, setOUserId] = useState('');
  const [oGrant, setOGrant] = useState('crecimiento');
  const [oReason, setOReason] = useState('Cortesía manual');
  const [oBusy, setOBusy] = useState(false);

  const [listTenant, setListTenant] = useState('');
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [lBusy, setLBusy] = useState(false);

  const loadDashboard = useCallback(async () => {
    setDashBusy(true);
    try {
      const res = await fetch('/api/admin-ui/dashboard', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'No se pudo cargar el dashboard');
      setDash(data as DashboardSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard');
      setDash(null);
    } finally {
      setDashBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function runProvision(e: React.FormEvent) {
    e.preventDefault();
    setPBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        email: pEmail.trim().toLowerCase(),
        domain: pDomain.trim().toLowerCase(),
        plan: pPlan,
        grantCourtesyCrecimiento: pCourtesy,
      };
      if (pPassword.trim().length >= 8) body.password = pPassword.trim();

      const res = await fetch('/api/admin-ui/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
      setMessage(JSON.stringify(data, null, 2));
      setPPassword('');
      void loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setPBusy(false);
    }
  }

  async function runSearchUsers(e: React.FormEvent) {
    e.preventDefault();
    setUBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin-ui/users?q=${encodeURIComponent(searchQ.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setUsers([]);
    } finally {
      setUBusy(false);
    }
  }

  async function runOverride(e: React.FormEvent) {
    e.preventDefault();
    setOBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        tenantId: oTenantId.trim(),
        grantPlan: oGrant.trim(),
        reason: oReason.trim() || undefined,
      };
      if (oUserId.trim()) body.userId = oUserId.trim();

      const res = await fetch('/api/admin-ui/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || JSON.stringify(data));
      setMessage(JSON.stringify(data, null, 2));
      void loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setOBusy(false);
    }
  }

  async function loadOverrides(e?: React.FormEvent) {
    e?.preventDefault();
    setLBusy(true);
    setError(null);
    try {
      const qs = listTenant.trim() ? `?tenantId=${encodeURIComponent(listTenant.trim())}` : '';
      const res = await fetch(`/api/admin-ui/overrides${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setOverrides(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
      setOverrides([]);
    } finally {
      setLBusy(false);
    }
  }

  const windowDays = dash?.windowDays ?? 30;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">Administración</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">Cuentas y cortesías</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
            Provisioná tenants y overrides sin terminal. Arriba ves un resumen que viene de la API interna (no es Resend:
            es métrica de producto + estado de integración).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={dashBusy}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/15 disabled:opacity-50 sm:self-auto"
        >
          {dashBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4 opacity-90" aria-hidden />}
          Actualizar métricas
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <p className={`${labelCls} text-violet-200/80`}>Tenants activos</p>
            <Building2 className="h-5 w-5 text-violet-300/70" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">
            {dashBusy && !dash ? '—' : (dash?.tenantsOperational ?? '—')}
          </p>
          <p className="mt-2 text-xs text-slate-400">Excluye código tenant de sistema.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <p className={`${labelCls} text-violet-200/80`}>Usuarios</p>
            <Users className="h-5 w-5 text-violet-300/70" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">
            {dashBusy && !dash ? '—' : (dash?.usersTotal ?? '—')}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Con clave portal:{' '}
            <span className="font-medium text-slate-300">{dash?.usersWithPortalPassword ?? '—'}</span>
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <p className={`${labelCls} text-violet-200/80`}>Corridas ({windowDays}d)</p>
            <Activity className="h-5 w-5 text-emerald-300/70" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">
            {dashBusy && !dash ? '—' : (dash?.runsLast30Days ?? '—')}
          </p>
          <p className="mt-2 text-xs text-slate-400">Actividad reciente en la plataforma.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <p className={`${labelCls} text-violet-200/80`}>Overrides activos</p>
            <Sparkles className="h-5 w-5 text-amber-300/70" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">
            {dashBusy && !dash ? '—' : (dash?.entitlementOverridesActive ?? '—')}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Referidos premiados:{' '}
            <span className="font-medium text-slate-300">{dash?.referralRewardsGrantedTenants ?? '—'}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-slate-900/80 to-violet-950/40 p-5 backdrop-blur-md lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <Mail className="h-5 w-5 text-violet-300" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-white">Email interno (secuencia)</p>
              <p className="text-xs text-slate-400">
                Datos desde tablas de campañas y logs en la API — no sustituye la API de Resend.
              </p>
            </div>
          </div>
          {'unavailable' in (dash?.emailOps ?? {}) ? (
            <p className="mt-4 rounded-xl bg-black/30 px-4 py-3 text-xs text-amber-200/90">
              Métricas de email no disponibles: {(dash?.emailOps as { reason?: string }).reason ?? 'tablas o migración pendiente'}
            </p>
          ) : dash?.emailOps && !('unavailable' in dash.emailOps) ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className={labelCls}>Campañas</p>
                <p className="mt-1 text-2xl font-bold text-white tabular-nums">{dash.emailOps.campaignsConfigured}</p>
              </div>
              <div>
                <p className={labelCls}>Envíos ({windowDays}d)</p>
                <p className="mt-1 text-2xl font-bold text-white tabular-nums">{dash.emailOps.sendsLast30Days}</p>
              </div>
              <div className="sm:col-span-1">
                <p className={labelCls}>Por estado</p>
                <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-black/25 p-2 font-mono text-[10px] leading-relaxed text-slate-300">
                  {JSON.stringify(dash.emailOps.byStatusLast30Days, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">{dashBusy ? 'Cargando…' : 'Sin datos.'}</p>
          )}
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-white/12 bg-white/[0.06] p-5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-300" aria-hidden />
            <p className="text-sm font-semibold text-white">Canales de envío</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            REST <code className="rounded bg-black/30 px-1 font-mono text-[10px]">RESEND_API_KEY</code>, relay SMTP Resend y SMTP
            saliente genérico (mismo criterio que diagnósticos).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                dash?.integrations.resendApiKeyConfigured
                  ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30'
                  : 'bg-slate-500/15 text-slate-300 ring-white/10'
              }`}
            >
              Resend API {dash?.integrations.resendApiKeyConfigured ? '· sí' : '· no'}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                dash?.integrations.resendSmtpRelayConfigured
                  ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30'
                  : 'bg-slate-500/15 text-slate-300 ring-white/10'
              }`}
            >
              SMTP Resend {dash?.integrations.resendSmtpRelayConfigured ? '· sí' : '· no'}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                dash?.integrations.smtpOutboundConfigured
                  ? 'bg-sky-500/15 text-sky-100 ring-sky-400/25'
                  : 'bg-slate-500/15 text-slate-300 ring-white/10'
              }`}
            >
              SMTP listo {dash?.integrations.smtpOutboundConfigured ? '· sí' : '· no'}
            </span>
          </div>
          {dash?.generatedAt ? (
            <p className="mt-4 text-[10px] text-slate-500">Snapshot: {new Date(dash.generatedAt).toLocaleString('es')}</p>
          ) : null}
        </div>
      </div>

      <div className={`${panel} space-y-10 text-slate-900`}>
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
        ) : null}
        {message ? (
          <pre className="max-h-64 overflow-auto rounded-xl border border-emerald-200/80 bg-emerald-50/90 p-4 font-mono text-xs text-slate-800">
            {message}
          </pre>
        ) : null}

        <section>
          <div className="flex flex-col gap-1 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Nueva cuenta</h2>
              <p className="mt-1 text-xs text-slate-500">
                Equivale a <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">db:provision-account</code>.
                Contraseña opcional (mín. 8); si omitís, la API puede generar una.
              </p>
            </div>
          </div>
          <form onSubmit={runProvision} className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelCls}>Email</span>
              <input
                type="email"
                required
                value={pEmail}
                onChange={(ev) => setPEmail(ev.target.value)}
                className={field}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Dominio</span>
              <input
                type="text"
                required
                value={pDomain}
                onChange={(ev) => setPDomain(ev.target.value)}
                placeholder="ej. kiev-srl.com"
                className={field}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Plan base</span>
              <select
                value={pPlan}
                onChange={(ev) => setPPlan(ev.target.value as 'crecimiento' | 'free')}
                className={field}
              >
                <option value="crecimiento">Premium</option>
                <option value="free">Siempre gratis</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 sm:mt-7">
              <input
                type="checkbox"
                checked={pCourtesy}
                onChange={(ev) => setPCourtesy(ev.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm font-medium text-slate-700">Cortesía Premium (override 1 año)</span>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Contraseña portal (opcional)</span>
              <input
                type="password"
                value={pPassword}
                onChange={(ev) => setPPassword(ev.target.value)}
                placeholder="Mínimo 8 caracteres"
                className={field}
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pBusy}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
              >
                {pBusy ? 'Provisionando…' : 'Crear / actualizar cuenta'}
              </button>
            </div>
          </form>
        </section>

        <section className="border-t border-slate-100 pt-10">
          <h2 className="text-lg font-bold text-slate-900">Buscar usuarios</h2>
          <p className="mt-1 text-xs text-slate-500">Fragmento de email para copiar tenantId / userId.</p>
          <form onSubmit={runSearchUsers} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              type="text"
              value={searchQ}
              onChange={(ev) => setSearchQ(ev.target.value)}
              placeholder="ej. ralborta"
              className={`${field} sm:flex-1`}
            />
            <button
              type="submit"
              disabled={uBusy || searchQ.trim().length < 2}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 sm:w-auto"
            >
              {uBusy ? 'Buscando…' : 'Buscar'}
            </button>
          </form>
          {users.length > 0 ? (
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/90 p-4 text-sm shadow-sm transition hover:border-violet-200/80 hover:bg-white"
                >
                  <p className="font-semibold text-slate-900">{u.email}</p>
                  <p className="mt-2 font-mono text-[11px] text-slate-600">
                    userId: <span className="select-all">{u.id}</span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-600">
                    tenantId: <span className="select-all">{u.tenantId}</span> · {u.tenantCode}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Portal: {u.hasPortalPassword ? 'tiene clave' : 'sin clave'}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="border-t border-slate-100 pt-10">
          <h2 className="text-lg font-bold text-slate-900">Nueva cortesía</h2>
          <p className="mt-1 text-xs text-slate-500">Override de plan por tenant (y opcionalmente por usuario).</p>
          <form onSubmit={runOverride} className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelCls}>tenantId (UUID)</span>
              <input
                required
                value={oTenantId}
                onChange={(ev) => setOTenantId(ev.target.value)}
                className={`${field} font-mono text-xs`}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>userId (opcional)</span>
              <input
                value={oUserId}
                onChange={(ev) => setOUserId(ev.target.value)}
                className={`${field} font-mono text-xs`}
              />
            </label>
            <label className="block">
              <span className={labelCls}>grantPlan</span>
              <input value={oGrant} onChange={(ev) => setOGrant(ev.target.value)} className={field} />
            </label>
            <label className="block">
              <span className={labelCls}>Motivo</span>
              <input value={oReason} onChange={(ev) => setOReason(ev.target.value)} className={field} />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={oBusy}
                className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-md shadow-amber-600/20 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {oBusy ? 'Guardando…' : 'Crear override'}
              </button>
            </div>
          </form>
        </section>

        <section className="border-t border-slate-100 pt-10">
          <h2 className="text-lg font-bold text-slate-900">Overrides recientes</h2>
          <form onSubmit={loadOverrides} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className={labelCls}>Filtrar por tenantId (opcional)</span>
              <input
                value={listTenant}
                onChange={(ev) => setListTenant(ev.target.value)}
                className={`${field} font-mono text-xs`}
              />
            </label>
            <button
              type="submit"
              disabled={lBusy}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              {lBusy ? 'Cargando…' : 'Listar'}
            </button>
          </form>
          {overrides.length > 0 ? (
            <ul className="mt-5 max-h-72 space-y-2 overflow-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs">
              {overrides.map((r) => (
                <li key={r.id} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                  <span className="font-semibold text-slate-800">{r.planDisplay}</span>{' '}
                  <span className="text-slate-500">· {r.active ? 'activo' : 'inactivo'}</span>
                  <p className="mt-1 text-slate-600">{r.reason || '—'}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  );
}
