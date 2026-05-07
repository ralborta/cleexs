'use client';

import {
  AlertTriangle,
  BarChart3,
  Eye,
  Inbox,
  LayoutList,
  MailCheck,
  MousePointerClick,
  PieChart,
  ScrollText,
  Send,
  Activity,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminAuthExpiredCard, AdminCallout, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { AdminPanelSection } from '@/components/admin/admin-panel-section';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

const panelOuter =
  'rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/[0.05] backdrop-blur-sm md:p-9';

const field =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/15';
const labelCls = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500';

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

type ResendWebhookStats =
  | {
      available: true;
      windowDays: number;
      secretConfigured: boolean;
      ingestUrl: string;
      eventsTotalLastWindow: number;
      eventsByTypeLastWindow: Record<string, number>;
      uniqueEmailsByStageLastWindow: {
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        bounced: number;
        failed: number;
      };
      note: string;
    }
  | { available: false; reason: string };

type Stats = {
  windowDays: number;
  campaignsConfigured: number;
  logsAllTime: number;
  byStatusLast30Days: Record<string, number>;
  resendWebhook?: ResendWebhookStats;
};

export default function AdminEmailOpsPage() {
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

  const [testEmail, setTestEmail] = useState('');
  const [testBusy, setTestBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [sRes, cRes, lRes] = await Promise.all([
        adminUiFetch('/api/admin-ui/email/stats'),
        adminUiFetch('/api/admin-ui/email/campaigns'),
        adminUiFetch('/api/admin-ui/email/logs?limit=80'),
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

  async function sendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    setTestBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
      setMessage(`Envío de prueba OK:\n${JSON.stringify(data, null, 2)}`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setTestBusy(false);
    }
  }

  async function runSeed() {
    setMessage(null);
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/campaigns/seed-defaults', { method: 'POST' });
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
      const res = await adminUiFetch(`/api/admin-ui/email/campaigns/${encodeURIComponent(c.id)}`, {
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
      const res = await adminUiFetch(`/api/admin-ui/email/campaigns/${encodeURIComponent(c.id)}`, {
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
      const res = await adminUiFetch('/api/admin-ui/email/campaigns', {
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
      const res = await adminUiFetch('/api/admin-ui/email/logs', {
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
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">Administración</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">Email · secuencia interna</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
            Campañas por semana y bucket de score, auditoría de envíos y estadísticas. El envío masivo contra Resend u otro
            ESP se cablea en el worker; acá va la configuración y los logs.
          </p>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            Refrescar datos
          </button>
        </div>
      </div>

      <div className={`${panelOuter}`}>
        <div className="space-y-8">
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
            icon={Send}
            accent="violet"
            title="Prueba de envío (API)"
            description={
              <>
                Usa <strong className="font-semibold text-slate-800">Resend REST</strong> si hay{' '}
                <code className="rounded-md bg-violet-100 px-1.5 py-0.5 font-mono text-[11px]">RESEND_API_KEY</code>; si no,{' '}
                <strong className="font-semibold text-slate-800">SMTP</strong>. El envío queda en logs con slug{' '}
                <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px]">admin-send-test</code>.
              </>
            }
          >
            <form onSubmit={sendTestEmail} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className={labelCls}>Email destino</span>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(ev) => setTestEmail(ev.target.value)}
                  placeholder="vos@ejemplo.com"
                  className={field}
                />
              </label>
              <button
                type="submit"
                disabled={testBusy}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50"
              >
                {testBusy ? 'Enviando…' : 'Enviar prueba'}
              </button>
            </form>
          </AdminPanelSection>

          {stats ? (
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
                <BarChart3 className="absolute right-4 top-4 h-8 w-8 text-violet-200" aria-hidden />
                <p className={`${labelCls} text-slate-500`}>Campañas configuradas</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{stats.campaignsConfigured}</p>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
                <Inbox className="absolute right-4 top-4 h-8 w-8 text-sky-200" aria-hidden />
                <p className={`${labelCls} text-slate-500`}>Logs totales</p>
                <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{stats.logsAllTime}</p>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm ring-1 ring-slate-900/[0.03]">
                <PieChart className="absolute right-4 top-4 h-8 w-8 text-emerald-200" aria-hidden />
                <p className={`${labelCls} text-slate-500`}>Por estado ({stats.windowDays} días)</p>
                <pre className="mt-2 max-h-24 overflow-auto rounded-lg bg-slate-900/[0.04] p-2 font-mono text-[10px] leading-relaxed text-slate-700">
                  {JSON.stringify(stats.byStatusLast30Days, null, 2)}
                </pre>
              </div>
            </section>
          ) : null}

          {stats?.resendWebhook?.available ? (
            <AdminPanelSection
              icon={Activity}
              accent="emerald"
              title={`Resend · entregas y engagement (${stats.resendWebhook.windowDays} días)`}
              description={<span className="text-slate-600">{stats.resendWebhook.note}</span>}
            >
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                    stats.resendWebhook.secretConfigured
                      ? 'bg-emerald-100 text-emerald-900 ring-emerald-200'
                      : 'bg-amber-100 text-amber-900 ring-amber-200'
                  }`}
                >
                  {stats.resendWebhook.secretConfigured ? 'Signing secret en API' : 'Definí RESEND_WEBHOOK_SECRET'}
                </span>
                <code className="rounded-lg bg-slate-900/[0.06] px-2 py-1 font-mono text-[11px] text-slate-700">
                  POST …{stats.resendWebhook.ingestUrl}
                </code>
                <span className="text-xs text-slate-500">
                  Eventos webhook recibidos:{' '}
                  <strong className="text-slate-800">{stats.resendWebhook.eventsTotalLastWindow}</strong>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {(
                  [
                    ['Enviados (email.sent)', Send, stats.resendWebhook.uniqueEmailsByStageLastWindow.sent],
                    ['Entregados', MailCheck, stats.resendWebhook.uniqueEmailsByStageLastWindow.delivered],
                    ['Abiertos (únicos)', Eye, stats.resendWebhook.uniqueEmailsByStageLastWindow.opened],
                    ['Clics (únicos)', MousePointerClick, stats.resendWebhook.uniqueEmailsByStageLastWindow.clicked],
                    ['Rebotes', AlertTriangle, stats.resendWebhook.uniqueEmailsByStageLastWindow.bounced],
                    ['Fallidos envío', XCircle, stats.resendWebhook.uniqueEmailsByStageLastWindow.failed],
                  ] as const
                ).map(([label, Icon, v]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200/90 bg-gradient-to-br from-white to-emerald-50/30 p-4 shadow-sm ring-1 ring-slate-900/[0.03]"
                  >
                    <Icon className="h-4 w-4 text-emerald-700/90" aria-hidden />
                    <p className={`mt-2 ${labelCls} leading-snug text-slate-500`}>{label}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{v}</p>
                    <p className="mt-1 text-[10px] leading-tight text-slate-400">Por email_id distinto en Cleexs</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/90 p-4">
                <p className={`${labelCls} mb-2 text-slate-500`}>Conteo por tipo de evento</p>
                <pre className="max-h-40 overflow-auto font-mono text-[10px] leading-relaxed text-slate-700">
                  {JSON.stringify(stats.resendWebhook.eventsByTypeLastWindow, null, 2)}
                </pre>
              </div>
            </AdminPanelSection>
          ) : stats?.resendWebhook && !stats.resendWebhook.available ? (
            <AdminCallout variant="warning">
              Métricas Resend (webhooks) no disponibles: {(stats.resendWebhook as { reason: string }).reason}. Si acabás de
              desplegar, ejecutá migraciones para crear <code className="rounded bg-amber-100 px-1 text-[11px]">cleexs_resend_webhook_events</code>.
            </AdminCallout>
          ) : null}

          <AdminPanelSection
            icon={LayoutList}
            accent="indigo"
            title="Campañas (sem × bucket)"
            description={
              <>
                Duplicá filas con slug propio para <code className="rounded bg-indigo-50 px-1 font-mono text-[11px]">low</code> /{' '}
                <code className="rounded bg-indigo-50 px-1 font-mono text-[11px]">mid</code> /{' '}
                <code className="rounded bg-indigo-50 px-1 font-mono text-[11px]">high</code> cuando definan umbrales de score.
              </>
            }
            headerRight={
              <button
                type="button"
                onClick={() => void runSeed()}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-700"
              >
                Crear plantillas 1–8
              </button>
            }
          >
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-14 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-inner">
                  <Inbox className="h-8 w-8" aria-hidden />
                </div>
                <p className="mt-5 text-base font-semibold text-slate-900">Todavía no hay campañas</p>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                  Generá las filas base (semanas 1–8, bucket <span className="font-mono text-xs">all</span>) para empezar a asociar templates del ESP.
                </p>
                <button
                  type="button"
                  onClick={() => void runSeed()}
                  className="mt-6 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-700"
                >
                  Crear plantillas semana 1–8 (bucket all)
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-100/95 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-3 pr-2">Sem</th>
                      <th className="py-3 pr-2">Bucket</th>
                      <th className="py-3 pr-2">Slug</th>
                      <th className="py-3 pr-2">Título</th>
                      <th className="py-3 pr-2">ESP template id</th>
                      <th className="py-3 pr-2">Activo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <CampaignEspRow key={c.id} c={c} onToggle={() => void toggleCampaign(c)} onSaveEsp={saveEspTemplate} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form onSubmit={createCampaign} className="mt-8 grid gap-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5 sm:grid-cols-2">
              <h3 className="sm:col-span-2 text-sm font-bold text-slate-900">Nueva campaña manual</h3>
              <label className="block">
                <span className={labelCls}>Slug</span>
                <input
                  required
                  value={nSlug}
                  onChange={(ev) => setNSlug(ev.target.value)}
                  placeholder="ej. weekly-seq-w3-low"
                  className={`${field} font-mono text-xs`}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Semana (1–52)</span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={nWeek}
                  onChange={(ev) => setNWeek(Number(ev.target.value))}
                  className={field}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Bucket</span>
                <select
                  value={nBucket}
                  onChange={(ev) => setNBucket(ev.target.value as typeof nBucket)}
                  className={field}
                >
                  <option value="low">low</option>
                  <option value="mid">mid</option>
                  <option value="high">high</option>
                  <option value="all">all</option>
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>ESP template id (opcional)</span>
                <input value={nEsp} onChange={(ev) => setNEsp(ev.target.value)} className={field} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Título</span>
                <input required value={nTitle} onChange={(ev) => setNTitle(ev.target.value)} className={field} />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-slate-800"
                >
                  Crear campaña
                </button>
              </div>
            </form>
          </AdminPanelSection>

          <AdminPanelSection
            icon={ScrollText}
            accent="emerald"
            title="Auditoría — últimos envíos"
            description={
              <>
                Entradas por jobs o manualmente. Con el ESP conectado, el worker debería escribir{' '}
                <code className="rounded bg-emerald-50 px-1 font-mono text-[11px]">sent</code> y{' '}
                <code className="rounded bg-emerald-50 px-1 font-mono text-[11px]">externalId</code>.
              </>
            }
          >
            <form
              onSubmit={addManualLog}
              className="grid gap-4 rounded-2xl border border-dashed border-emerald-200/80 bg-emerald-50/40 p-5 sm:grid-cols-2"
            >
              <h3 className="sm:col-span-2 text-sm font-bold text-slate-900">Registrar envío manual (prueba)</h3>
              <label className="block">
                <span className={labelCls}>Email</span>
                <input
                  type="email"
                  required
                  value={logEmail}
                  onChange={(ev) => setLogEmail(ev.target.value)}
                  className={field}
                />
              </label>
              <label className="block">
                <span className={labelCls}>campaignSlug</span>
                <input
                  required
                  value={logSlug}
                  onChange={(ev) => setLogSlug(ev.target.value)}
                  placeholder="weekly-seq-w1-all"
                  className={`${field} font-mono text-xs`}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Cleexs score (opcional)</span>
                <input value={logScore} onChange={(ev) => setLogScore(ev.target.value)} placeholder="42" className={field} />
              </label>
              <label className="block">
                <span className={labelCls}>Estado</span>
                <select
                  value={logStatus}
                  onChange={(ev) => setLogStatus(ev.target.value as typeof logStatus)}
                  className={field}
                >
                  <option value="pending">pending</option>
                  <option value="sent">sent</option>
                  <option value="failed">failed</option>
                  <option value="skipped">skipped</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                >
                  Registrar log
                </button>
              </div>
            </form>

            {logs.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600">
                Sin registros en esta vista. Los envíos de prueba y el worker aparecerán aquí.
              </p>
            ) : (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/[0.03]">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="bg-slate-100/95 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-3 pr-2">Fecha</th>
                      <th className="py-3 pr-2">Email</th>
                      <th className="py-3 pr-2">Campaña</th>
                      <th className="py-3 pr-2">Score</th>
                      <th className="py-3 pr-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100 transition-colors hover:bg-violet-50/40">
                        <td className="px-3 py-2.5 pr-2 whitespace-nowrap text-slate-600">
                          {new Date(r.createdAt).toLocaleString('es-AR')}
                        </td>
                        <td className="py-2.5 pr-2">{r.recipientEmail}</td>
                        <td className="py-2.5 pr-2 font-mono text-[10px]">{r.campaignSlug}</td>
                        <td className="py-2.5 pr-2">{r.cleexsScore ?? '—'}</td>
                        <td className="py-2.5 pr-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              r.status === 'sent'
                                ? 'bg-emerald-100 text-emerald-900'
                                : r.status === 'failed'
                                  ? 'bg-red-100 text-red-900'
                                  : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminPanelSection>
        </div>
      </div>
    </div>
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
    <tr className="border-t border-slate-100 transition-colors hover:bg-violet-50/50">
      <td className="px-3 py-2.5 pr-2">{c.weekIndex}</td>
      <td className="py-2.5 pr-2">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">{c.scoreBucket}</span>
      </td>
      <td className="py-2.5 pr-2 font-mono text-[10px] text-slate-800">{c.slug}</td>
      <td className="max-w-[220px] truncate py-2.5 pr-2 text-slate-700" title={c.title}>
        {c.title}
      </td>
      <td className="py-2.5 pr-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={localEsp}
            onChange={(ev) => setLocalEsp(ev.target.value)}
            className="min-w-[120px] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-[10px] shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15"
            placeholder="template_id"
          />
          <button
            type="button"
            onClick={() => void onSaveEsp(c, localEsp)}
            className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-800 transition hover:bg-slate-200"
          >
            Guardar
          </button>
        </div>
      </td>
      <td className="py-2.5 pr-2">
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${
            c.active ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80' : 'bg-slate-200 text-slate-700 ring-1 ring-slate-300/80'
          }`}
        >
          {c.active ? 'sí' : 'no'}
        </button>
      </td>
    </tr>
  );
}
