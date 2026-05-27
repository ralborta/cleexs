'use client';

import {
  Activity,
  Building2,
  ClipboardList,
  Gift,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminAuthExpiredCard, AdminCallout, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { AdminPanelSection } from '@/components/admin/admin-panel-section';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

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
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15';
const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500';
const panelOuter =
  'rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/[0.05] backdrop-blur-sm md:p-9';

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

  /** Etiqueta legible cuando el admin eligió un usuario desde la búsqueda */
  const [courtesyClientLabel, setCourtesyClientLabel] = useState<string | null>(null);
  const [overridesFilterLabel, setOverridesFilterLabel] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setDashBusy(true);
    try {
      const res = await adminUiFetch('/api/admin-ui/dashboard', { cache: 'no-store' });
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

      const res = await adminUiFetch('/api/admin-ui/provision', {
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
      const res = await adminUiFetch(`/api/admin-ui/users?q=${encodeURIComponent(searchQ.trim())}`);
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

      const res = await adminUiFetch('/api/admin-ui/overrides', {
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
      const res = await adminUiFetch(`/api/admin-ui/overrides${qs}`);
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

  function fillCourtesyFromSearch(u: UserRow) {
    setOTenantId(u.tenantId);
    setOUserId(u.id);
    setCourtesyClientLabel(`${u.email} · empresa ${u.tenantCode}`);
    setError(null);
  }

  function fillOverridesFilterFromSearch(u: UserRow) {
    setListTenant(u.tenantId);
    setOverridesFilterLabel(`${u.email} · empresa ${u.tenantCode}`);
    setError(null);
  }

  const windowDays = dash?.windowDays ?? 30;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">Administración</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Cuentas y cortesías</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
            Provisioná tenants y overrides sin terminal. Arriba ves un resumen que viene de la API interna (no es Resend:
            es métrica de producto + estado de integración).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          disabled={dashBusy}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 backdrop-blur-sm transition hover:bg-slate-50 disabled:opacity-50 sm:self-auto"
        >
          {dashBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="h-4 w-4 opacity-90" aria-hidden />}
          Actualizar métricas
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/[0.07] p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <p className={`${labelCls} text-violet-700/80`}>Tenants activos</p>
            <Building2 className="h-5 w-5 text-violet-500" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
            {dashBusy && !dash ? '—' : (dash?.tenantsOperational ?? '—')}
          </p>
          <p className="mt-2 text-xs text-slate-600">Excluye código tenant de sistema.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/[0.07] p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <p className={`${labelCls} text-violet-700/80`}>Usuarios</p>
            <Users className="h-5 w-5 text-violet-500" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
            {dashBusy && !dash ? '—' : (dash?.usersTotal ?? '—')}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Con clave portal:{' '}
            <span className="font-medium text-slate-700">{dash?.usersWithPortalPassword ?? '—'}</span>
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/[0.07] p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <p className={`${labelCls} text-violet-700/80`}>Corridas ({windowDays}d)</p>
            <Activity className="h-5 w-5 text-emerald-300/70" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
            {dashBusy && !dash ? '—' : (dash?.runsLast30Days ?? '—')}
          </p>
          <p className="mt-2 text-xs text-slate-600">Actividad reciente en la plataforma.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/[0.07] p-5 backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <p className={`${labelCls} text-violet-700/80`}>Overrides activos</p>
            <Sparkles className="h-5 w-5 text-amber-300/70" aria-hidden />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">
            {dashBusy && !dash ? '—' : (dash?.entitlementOverridesActive ?? '—')}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Referidos premiados:{' '}
            <span className="font-medium text-slate-700">{dash?.referralRewardsGrantedTenants ?? '—'}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center gap-3">
            <Mail className="h-5 w-5 text-violet-600" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-slate-900">Emails de campañas</p>
              <p className="text-xs text-slate-600">
                Resumen de campañas configuradas, envíos recientes y estados registrados por Cleexs.
              </p>
            </div>
          </div>
          {'unavailable' in (dash?.emailOps ?? {}) ? (
            <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-xs text-amber-700">
              Métricas de email no disponibles: {(dash?.emailOps as { reason?: string }).reason ?? 'tablas o migración pendiente'}
            </p>
          ) : dash?.emailOps && !('unavailable' in dash.emailOps) ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className={labelCls}>Campañas</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{dash.emailOps.campaignsConfigured}</p>
              </div>
              <div>
                <p className={labelCls}>Envíos ({windowDays}d)</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{dash.emailOps.sendsLast30Days}</p>
              </div>
              <div className="sm:col-span-1">
                <p className={labelCls}>Por estado</p>
                <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-slate-100 p-2 font-mono text-[10px] leading-relaxed text-slate-700">
                  {JSON.stringify(dash.emailOps.byStatusLast30Days, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">{dashBusy ? 'Cargando…' : 'Sin datos.'}</p>
          )}
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-slate-700" aria-hidden />
            <p className="text-sm font-semibold text-slate-900">Canales de envío</p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Estado de las conexiones disponibles para mandar emails desde la plataforma.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                dash?.integrations.resendApiKeyConfigured
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-slate-100 text-slate-600 ring-slate-200'
              }`}
            >
              Resend {dash?.integrations.resendApiKeyConfigured ? 'configurado' : 'no configurado'}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                dash?.integrations.resendSmtpRelayConfigured
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-slate-100 text-slate-600 ring-slate-200'
              }`}
            >
              Relay Resend {dash?.integrations.resendSmtpRelayConfigured ? 'configurado' : 'no configurado'}
            </span>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                dash?.integrations.smtpOutboundConfigured
                  ? 'bg-sky-50 text-sky-700 ring-sky-200'
                  : 'bg-slate-100 text-slate-600 ring-slate-200'
              }`}
            >
              SMTP alternativo {dash?.integrations.smtpOutboundConfigured ? 'configurado' : 'no configurado'}
            </span>
          </div>
          {dash?.generatedAt ? (
            <p className="mt-4 text-[10px] text-slate-500">Snapshot: {new Date(dash.generatedAt).toLocaleString('es')}</p>
          ) : null}
        </div>
      </div>

      <div className={`${panelOuter} space-y-8 text-slate-900`}>
        {error ? (
          looksLikeAdminAuthError(error) ? (
            <AdminAuthExpiredCard />
          ) : (
            <AdminCallout variant="error">{error}</AdminCallout>
          )
        ) : null}
        {message ? (
          <AdminCallout variant="success">
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{message}</pre>
          </AdminCallout>
        ) : null}

        <AdminPanelSection
          icon={UserPlus}
          accent="violet"
          title="Nueva cuenta"
          description={
            <>
              Equivale a{' '}
              <code className="rounded-md bg-violet-100/80 px-1.5 py-0.5 font-mono text-[11px] text-violet-900">
                db:provision-account
              </code>
              . Contraseña opcional (mín. 8); si omitís, la API puede generar una.
            </>
          }
        >
          <form onSubmit={runProvision} className="grid gap-5 sm:grid-cols-2">
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
            <label className="flex min-h-[46px] cursor-pointer items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3 ring-1 ring-violet-100/80 sm:mt-[26px]">
              <input
                type="checkbox"
                checked={pCourtesy}
                onChange={(ev) => setPCourtesy(ev.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm font-medium text-slate-800">Cortesía Premium (override 1 año)</span>
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
        </AdminPanelSection>

        <AdminPanelSection
          icon={Search}
          accent="slate"
          title="Buscar usuarios"
          description="Escribí parte del correo del cliente. Después tocá el botón para cargar la cortesía o ver solo sus overrides: no hace falta saber códigos internos."
        >
          <form onSubmit={runSearchUsers} className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              type="text"
              value={searchQ}
              onChange={(ev) => setSearchQ(ev.target.value)}
              placeholder="ej. nombre o dominio del mail"
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
                  <p className="mt-1 text-xs text-slate-600">
                    Empresa en sistema: <span className="font-medium text-slate-800">{u.tenantCode}</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">Portal: {u.hasPortalPassword ? 'tiene clave' : 'sin clave'}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fillCourtesyFromSearch(u)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/90 px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-400"
                    >
                      <Gift className="h-3.5 w-3.5" aria-hidden />
                      Usar para nueva cortesía
                    </button>
                    <button
                      type="button"
                      onClick={() => fillOverridesFilterFromSearch(u)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                      Ver overrides de este cliente
                    </button>
                  </div>
                  <details className="mt-3 text-[11px] text-slate-600">
                    <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-700">
                      Datos técnicos (soporte)
                    </summary>
                    <p className="mt-2 font-mono text-[11px] text-slate-600">
                      usuario: <span className="select-all">{u.id}</span>
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-slate-600">
                      empresa (id): <span className="select-all">{u.tenantId}</span>
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          ) : null}
        </AdminPanelSection>

        <AdminPanelSection
          icon={Gift}
          accent="amber"
          title="Nueva cortesía"
          description="Extendemos el plan de una empresa (y, si hace falta, de un usuario concreto). Lo más simple es elegir al cliente desde «Buscar usuarios»."
        >
          <form onSubmit={runOverride} className="grid gap-5 sm:grid-cols-2">
            {courtesyClientLabel ? (
              <p className="sm:col-span-2 rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                <span className="font-semibold">Cliente elegido:</span> {courtesyClientLabel}
              </p>
            ) : null}
            <label className="block sm:col-span-2">
              <span className={labelCls}>Empresa en sistema (rellená desde la búsqueda)</span>
              <input
                required
                value={oTenantId}
                onChange={(ev) => {
                  setOTenantId(ev.target.value);
                  setCourtesyClientLabel(null);
                }}
                placeholder="Se completa solo al tocar «Usar para nueva cortesía»"
                className={`${field} font-mono text-xs`}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Es un código interno de la empresa; no hace falta copiarlo si usás la búsqueda por correo.
              </p>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Usuario concreto (opcional)</span>
              <input
                value={oUserId}
                onChange={(ev) => {
                  setOUserId(ev.target.value);
                  setCourtesyClientLabel(null);
                }}
                placeholder="Vacío = cortesía a nivel empresa"
                className={`${field} font-mono text-xs`}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Solo necesario si la cortesía es para una persona en particular; también se puede rellenar desde la búsqueda.
              </p>
            </label>
            <label className="block">
              <span className={labelCls}>Plan otorgado</span>
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
        </AdminPanelSection>

        <AdminPanelSection
          icon={ClipboardList}
          accent="indigo"
          title="Overrides recientes"
          description="Historial de cortesías y cambios de plan. Para ver solo las de un cliente, usá «Ver overrides de este cliente» en los resultados de búsqueda."
        >
          {overridesFilterLabel ? (
            <p className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950">
              <span className="font-semibold">Filtrando por cliente:</span> {overridesFilterLabel}
              <button
                type="button"
                onClick={() => {
                  setListTenant('');
                  setOverridesFilterLabel(null);
                }}
                className="ml-3 text-xs font-semibold text-indigo-700 underline decoration-indigo-400 underline-offset-2 hover:text-indigo-900"
              >
                Quitar filtro
              </button>
            </p>
          ) : null}
          <form onSubmit={loadOverrides} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className={labelCls}>Código interno de empresa (opcional)</span>
              <input
                value={listTenant}
                onChange={(ev) => {
                  setListTenant(ev.target.value);
                  setOverridesFilterLabel(null);
                }}
                placeholder="Solo si soporte te pasó un ID; si no, usá la búsqueda"
                className={`${field} font-mono text-xs`}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Equivale al filtro técnico por empresa; lo habitual es no tocar este campo.
              </p>
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
          ) : (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
              Todavía no cargaste overrides. Tocá <span className="font-medium text-slate-700">Listar</span> para ver todos,
              o elegí un cliente en la búsqueda y <span className="font-medium text-slate-700">Ver overrides de este cliente</span>.
            </p>
          )}
        </AdminPanelSection>
      </div>
    </div>
  );
}
