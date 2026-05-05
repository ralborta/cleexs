'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type CampaignRow = {
  id: string;
  slug: string;
  weekIndex: number;
  scoreBucket: string;
  title: string;
  description: string | null;
  espTemplateId: string | null;
  active: boolean;
  priority: number;
};

type LogRow = {
  id: string;
  recipientEmail: string;
  campaignSlug: string;
  scoreBucket: string | null;
  cleexsScore: number | null;
  status: string;
  createdAt: string;
  externalId: string | null;
};

type Stats = {
  windowDays: number;
  campaignsConfigured: number;
  logsAllTime: number;
  byStatusLast30Days: Record<string, number>;
};

export default function AdminEmailOpsPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState(false);

  const [nSlug, setNSlug] = useState('');
  const [nWeek, setNWeek] = useState(1);
  const [nBucket, setNBucket] = useState<'low' | 'mid' | 'high' | 'all'>('mid');
  const [nTitle, setNTitle] = useState('');
  const [nEsp, setNEsp] = useState('');

  const [logEmail, setLogEmail] = useState('');
  const [logSlug, setLogSlug] = useState('');
  const [logScore, setLogScore] = useState('');
  const [logStatus, setLogStatus] = useState<'pending' | 'sent' | 'failed' | 'skipped'>('sent');

  const logout = useCallback(async () => {
    await fetch('/api/admin-ui/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  }, [router]);

  const loadAll = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [sRes, cRes, lRes] = await Promise.all([
        fetch('/api/admin-ui/email/stats'),
        fetch('/api/admin-ui/email/campaigns'),
        fetch('/api/admin-ui/email/logs?limit=80'),
      ]);
      const sData = await sRes.json().catch(() => ({}));
      const cData = await cRes.json().catch(() => ({}));
      const lData = await lRes.json().catch(() => ({}));
      if (!sRes.ok) throw new Error((sData as { error?: string }).error || 'stats');
      if (!cRes.ok) throw new Error((cData as { error?: string }).error || 'campaigns');
      if (!lRes.ok) throw new Error((lData as { error?: string }).error || 'logs');
      setStats(sData as Stats);
      setCampaigns(Array.isArray(cData) ? cData : []);
      setLogs(Array.isArray(lData) ? lData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function runSeed() {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin-ui/email/campaigns/seed-defaults', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
      setMessage(`Plantillas base: ${JSON.stringify(data)}`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  async function toggleCampaign(c: CampaignRow) {
    setError(null);
    try {
      const res = await fetch(`/api/admin-ui/email/campaigns/${encodeURIComponent(c.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !c.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  async function saveEspTemplate(c: CampaignRow, espTemplateId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/admin-ui/email/campaigns/${encodeURIComponent(c.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ espTemplateId: espTemplateId.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const body = {
        slug: nSlug.trim(),
        weekIndex: nWeek,
        scoreBucket: nBucket,
        title: nTitle.trim(),
        espTemplateId: nEsp.trim() || undefined,
        active: true,
      };
      const res = await fetch('/api/admin-ui/email/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
      setMessage('Campaña creada.');
      setNSlug('');
      setNTitle('');
      setNEsp('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function addManualLog(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        recipientEmail: logEmail.trim().toLowerCase(),
        campaignSlug: logSlug.trim(),
        status: logStatus,
      };
      const sc = logScore.trim();
      if (sc) body.cleexsScore = Number(sc);
      const res = await fetch('/api/admin-ui/email/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
      setMessage(`Log creado: ${data.id}`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin · Email (interno)</h1>
            <p className="text-sm text-slate-600">
              Secuencia semanal MVP: campañas por semana y bucket de score, auditoría de envíos y stats. El envío real va
              contra tu ESP en una fase siguiente.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <Link href="/admin/cuentas" className="font-medium text-violet-700 hover:underline">
                ← Cuentas y cortesías
              </Link>
              <button
                type="button"
                onClick={() => void loadAll()}
                disabled={busy}
                className="font-medium text-slate-700 hover:underline disabled:opacity-50"
              >
                Refrescar
              </button>
            </div>
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
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-slate-800">{message}</div>
        ) : null}

        {stats ? (
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Campañas configuradas</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.campaignsConfigured}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Logs totales</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stats.logsAllTime}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Por estado ({stats.windowDays} días)
              </p>
              <pre className="mt-2 max-h-28 overflow-auto text-[11px] text-slate-700">
                {JSON.stringify(stats.byStatusLast30Days, null, 2)}
              </pre>
            </div>
          </section>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Campañas (sem × bucket)</h2>
            <button
              type="button"
              onClick={() => void runSeed()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Crear plantillas semana 1–8 (bucket all)
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Duplicá filas con slug propio para <code className="rounded bg-slate-100 px-1">low</code> /{' '}
            <code className="rounded bg-slate-100 px-1">mid</code> /{' '}
            <code className="rounded bg-slate-100 px-1">high</code> cuando definan umbrales de score.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b border-slate-200 text-[10px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Sem</th>
                  <th className="py-2 pr-2">Bucket</th>
                  <th className="py-2 pr-2">Slug</th>
                  <th className="py-2 pr-2">Título</th>
                  <th className="py-2 pr-2">ESP template id</th>
                  <th className="py-2 pr-2">Activo</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <CampaignEspRow key={c.id} c={c} onToggle={() => void toggleCampaign(c)} onSaveEsp={saveEspTemplate} />
                ))}
              </tbody>
            </table>
            {campaigns.length === 0 ? <p className="mt-3 text-xs text-slate-500">Sin campañas. Usá el botón de seed.</p> : null}
          </div>

          <form onSubmit={createCampaign} className="mt-6 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold text-slate-800">Nueva campaña manual</h3>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Slug</span>
              <input
                required
                value={nSlug}
                onChange={(ev) => setNSlug(ev.target.value)}
                placeholder="ej. weekly-seq-w3-low"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Semana (1–52)</span>
              <input
                type="number"
                min={1}
                max={52}
                value={nWeek}
                onChange={(ev) => setNWeek(Number(ev.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Bucket</span>
              <select
                value={nBucket}
                onChange={(ev) => setNBucket(ev.target.value as typeof nBucket)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="low">low</option>
                <option value="mid">mid</option>
                <option value="high">high</option>
                <option value="all">all</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">ESP template id (opcional)</span>
              <input
                value={nEsp}
                onChange={(ev) => setNEsp(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Título</span>
              <input
                required
                value={nTitle}
                onChange={(ev) => setNTitle(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Crear campaña
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Auditoría — últimos envíos registrados</h2>
          <p className="mt-1 text-xs text-slate-500">
            Entradas creadas por jobs o manualmente. Cuando conectes el ESP, el worker debería escribir acá con estado{' '}
            <code className="rounded bg-slate-100 px-1">sent</code> y <code className="rounded bg-slate-100 px-1">externalId</code>.
          </p>

          <form onSubmit={addManualLog} className="mt-4 grid gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 sm:grid-cols-2">
            <h3 className="sm:col-span-2 text-sm font-semibold text-slate-800">Registrar envío manual (prueba)</h3>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Email</span>
              <input
                type="email"
                required
                value={logEmail}
                onChange={(ev) => setLogEmail(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">campaignSlug</span>
              <input
                required
                value={logSlug}
                onChange={(ev) => setLogSlug(ev.target.value)}
                placeholder="weekly-seq-w1-all"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Cleexs score (opcional)</span>
              <input
                value={logScore}
                onChange={(ev) => setLogScore(ev.target.value)}
                placeholder="42"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Estado</span>
              <select
                value={logStatus}
                onChange={(ev) => setLogStatus(ev.target.value as typeof logStatus)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="pending">pending</option>
                <option value="sent">sent</option>
                <option value="failed">failed</option>
                <option value="skipped">skipped</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
                Registrar log
              </button>
            </div>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="border-b border-slate-200 text-[10px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2 pr-2">Email</th>
                  <th className="py-2 pr-2">Campaña</th>
                  <th className="py-2 pr-2">Score</th>
                  <th className="py-2 pr-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-2 pr-2 whitespace-nowrap text-slate-600">
                      {new Date(r.createdAt).toLocaleString('es-AR')}
                    </td>
                    <td className="py-2 pr-2">{r.recipientEmail}</td>
                    <td className="py-2 pr-2 font-mono text-[10px]">{r.campaignSlug}</td>
                    <td className="py-2 pr-2">{r.cleexsScore ?? '—'}</td>
                    <td className="py-2 pr-2">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function CampaignEspRow({
  c,
  onToggle,
  onSaveEsp,
}: {
  c: CampaignRow;
  onToggle: () => void;
  onSaveEsp: (c: CampaignRow, esp: string) => Promise<void>;
}) {
  const [localEsp, setLocalEsp] = useState(c.espTemplateId ?? '');
  useEffect(() => {
    setLocalEsp(c.espTemplateId ?? '');
  }, [c.espTemplateId]);

  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 pr-2">{c.weekIndex}</td>
      <td className="py-2 pr-2">{c.scoreBucket}</td>
      <td className="py-2 pr-2 font-mono text-[10px]">{c.slug}</td>
      <td className="py-2 pr-2 max-w-[220px] truncate" title={c.title}>
        {c.title}
      </td>
      <td className="py-2 pr-2">
        <div className="flex flex-wrap items-center gap-1">
          <input
            value={localEsp}
            onChange={(ev) => setLocalEsp(ev.target.value)}
            className="min-w-[120px] flex-1 rounded border border-slate-200 px-2 py-1 font-mono text-[10px]"
            placeholder="template_id"
          />
          <button
            type="button"
            onClick={() => void onSaveEsp(c, localEsp)}
            className="rounded bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-800 hover:bg-slate-200"
          >
            Guardar
          </button>
        </div>
      </td>
      <td className="py-2 pr-2">
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${c.active ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700'}`}
        >
          {c.active ? 'sí' : 'no'}
        </button>
      </td>
    </tr>
  );
}
