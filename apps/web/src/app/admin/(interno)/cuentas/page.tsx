'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

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

export default function AdminCuentasPage() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const logout = useCallback(async () => {
    await fetch('/api/admin-ui/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }, [router]);

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

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin · Cuentas y cortesías</h1>
            <p className="text-sm text-slate-600">Provisioná usuarios y overrides sin usar la terminal.</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cerrar sesión admin
          </button>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        ) : null}
        {message ? (
          <pre className="max-h-64 overflow-auto rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-slate-800">
            {message}
          </pre>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Nueva cuenta (provision)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Equivale a <code className="rounded bg-slate-100 px-1">db:provision-account</code>. Contraseña opcional
            (mín. 8); si no ponés, la API genera una y la devuelve en la respuesta.
          </p>
          <form onSubmit={runProvision} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Email</span>
              <input
                type="email"
                required
                value={pEmail}
                onChange={(ev) => setPEmail(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Dominio (ej. kiev-srl.com)</span>
              <input
                type="text"
                required
                value={pDomain}
                onChange={(ev) => setPDomain(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Plan base</span>
              <select
                value={pPlan}
                onChange={(ev) => setPPlan(ev.target.value as 'crecimiento' | 'free')}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="crecimiento">Crecimiento</option>
                <option value="free">Siempre gratis</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
              <input type="checkbox" checked={pCourtesy} onChange={(ev) => setPCourtesy(ev.target.checked)} />
              Cortesía Crecimiento (override 1 año)
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Contraseña portal (opcional)</span>
              <input
                type="password"
                value={pPassword}
                onChange={(ev) => setPPassword(ev.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={pBusy}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {pBusy ? 'Provisionando…' : 'Crear / actualizar cuenta'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Buscar usuarios</h2>
          <p className="mt-1 text-xs text-slate-500">Por fragmento de email (para copiar tenantId / userId).</p>
          <form onSubmit={runSearchUsers} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={searchQ}
              onChange={(ev) => setSearchQ(ev.target.value)}
              placeholder="ej. ralborta"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={uBusy || searchQ.trim().length < 2}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {uBusy ? 'Buscando…' : 'Buscar'}
            </button>
          </form>
          {users.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {users.map((u) => (
                <li key={u.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">{u.email}</p>
                  <p className="text-xs text-slate-600">
                    userId: <code className="select-all">{u.id}</code>
                  </p>
                  <p className="text-xs text-slate-600">
                    tenantId: <code className="select-all">{u.tenantId}</code> · {u.tenantCode}
                  </p>
                  <p className="text-xs text-slate-500">Portal: {u.hasPortalPassword ? 'tiene clave' : 'sin clave'}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Nueva cortesía (override de plan)</h2>
          <form onSubmit={runOverride} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">tenantId (UUID)</span>
              <input
                required
                value={oTenantId}
                onChange={(ev) => setOTenantId(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">userId (opcional, UUID)</span>
              <input
                value={oUserId}
                onChange={(ev) => setOUserId(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">grantPlan (texto)</span>
              <input
                value={oGrant}
                onChange={(ev) => setOGrant(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Motivo</span>
              <input
                value={oReason}
                onChange={(ev) => setOReason(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={oBusy}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {oBusy ? 'Guardando…' : 'Crear override'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Overrides recientes</h2>
          <form onSubmit={loadOverrides} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="text-xs font-medium text-slate-600">Filtrar por tenantId (opcional)</span>
              <input
                value={listTenant}
                onChange={(ev) => setListTenant(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            <button
              type="submit"
              disabled={lBusy}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {lBusy ? 'Cargando…' : 'Listar'}
            </button>
          </form>
          {overrides.length > 0 ? (
            <ul className="mt-4 max-h-64 space-y-2 overflow-auto text-xs">
              {overrides.map((r) => (
                <li key={r.id} className="rounded border border-slate-100 p-2">
                  <span className="font-medium">{r.planDisplay}</span> · {r.active ? 'activo' : 'inactivo'}
                  <br />
                  <span className="text-slate-600">{r.reason || '—'}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
