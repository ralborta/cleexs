'use client';

import {
  AlertTriangle,
  BarChart3,
  Eye,
  Inbox,
  LayoutList,
  Loader2,
  Mail,
  MailCheck,
  Megaphone,
  MousePointerClick,
  RefreshCw,
  ScrollText,
  Send,
  Activity,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminAuthExpiredCard, looksLikeAdminAuthError } from '@/components/admin/admin-callout';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

const field =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200';
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50';
const subtleBtn =
  'inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50';

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
      ingestAbsoluteUrl: string | null;
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

type BroadcastResult = {
  ok: boolean;
  dryRun: boolean;
  campaignSlug: string;
  segment: string;
  totalRecipients: number;
  sent?: number;
  failed?: number;
  errors?: Array<{ email: string; error: string }>;
  sample?: Array<{
    email: string;
    planName?: string;
    brandName?: string;
    domain?: string;
    cleexsScore?: number;
    scoreBucket?: string;
  }>;
};

export default function AdminEmailOpsPage() {
  const [error, setError] = useState<string | null>(null);

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
  const [campaignPreviewBusyId, setCampaignPreviewBusyId] = useState<string | null>(null);
  const [sendActionHint, setSendActionHint] = useState<string | null>(null);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastSegment, setBroadcastSegment] = useState<'free' | 'all' | 'premium'>('free');
  const [broadcastLimit, setBroadcastLimit] = useState(250);
  const [broadcastDryRun, setBroadcastDryRun] = useState(true);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<BroadcastResult | null>(null);

  useEffect(() => {
    if (!sendActionHint) return;
    const id = window.setTimeout(() => setSendActionHint(null), 12000);
    return () => window.clearTimeout(id);
  }, [sendActionHint]);

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
    try {
      const res = await adminUiFetch('/api/admin-ui/email/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
      setSendActionHint(
        'Envío aceptado por la API. Si no ves cambios, tocá «Refrescar». El bloque «Resend · engagement» solo se mueve cuando el webhook está configurado en Railway.',
      );
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setTestBusy(false);
    }
  }

  async function runSeed() {
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/campaigns/seed-defaults', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
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

  async function sendCampaignPreview(c: CampaignRow) {
    const to = testEmail.trim().toLowerCase();
    if (!to) {
      setError('Completá el email destino arriba (mismo de la prueba genérica).');
      return;
    }
    setCampaignPreviewBusyId(c.id);
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/send-campaign-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, campaignId: c.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || JSON.stringify(data));
      setSendActionHint(`Prueba «${c.slug}» aceptada. Revisá la auditoría más abajo.`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setCampaignPreviewBusyId(null);
    }
  }

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setBroadcastBusy(true);
    setBroadcastResult(null);
    setError(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/email/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: broadcastSubject.trim(),
          body: broadcastBody.trim(),
          segment: broadcastSegment,
          limit: broadcastLimit,
          dryRun: broadcastDryRun,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as BroadcastResult & { error?: string };
      if (!res.ok) throw new Error(data.error || JSON.stringify(data));
      setBroadcastResult(data);
      if (!data.dryRun) await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setBroadcastBusy(false);
    }
  }

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  if (error && looksLikeAdminAuthError(error)) {
    return <AdminAuthExpiredCard />;
  }

  const sentLastWindow = stats != null ? Number(stats.byStatusLast30Days.sent) || 0 : 0;
  const failedLastWindow = stats != null ? Number(stats.byStatusLast30Days.failed) || 0 : 0;
  const skippedLastWindow = stats != null ? Number(stats.byStatusLast30Days.skipped) || 0 : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Email · secuencia</h1>
            <p className="text-sm text-slate-600">
              Campañas por semana y bucket de score, broadcast manual y auditoría de envíos.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={busy}
          className={secondaryBtn}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refrescar
        </button>
      </header>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}
      {sendActionHint ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {sendActionHint}
        </div>
      ) : null}

      {stats ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={<BarChart3 className="h-4 w-4 text-violet-600" />} label="Campañas configuradas" value={stats.campaignsConfigured} />
          <Kpi
            icon={<MailCheck className="h-4 w-4 text-emerald-600" />}
            label={`Enviados (${stats.windowDays} días)`}
            value={sentLastWindow}
          />
          <Kpi
            icon={<XCircle className="h-4 w-4 text-rose-600" />}
            label="Fallos / Saltados"
            value={`${failedLastWindow} / ${skippedLastWindow}`}
          />
          <Kpi icon={<Inbox className="h-4 w-4 text-sky-600" />} label="Logs totales" value={stats.logsAllTime} />
        </section>
      ) : null}

      <Card
        icon={<Send className="h-4 w-4" />}
        title="Enviar email de prueba"
        description="Mandá un correo real a una dirección puntual para verificar que el envío esté funcionando. El sistema usa Resend si está configurado; si no, intenta por SMTP. El resultado queda registrado en la auditoría de más abajo."
      >
        <form onSubmit={sendTestEmail} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className={labelCls}>Email destino</span>
            <input
              type="email"
              required
              value={testEmail}
              onChange={(ev) => setTestEmail(ev.target.value)}
              placeholder="ralborta@kiev-srl.com"
              className={field}
            />
          </label>
          <button type="submit" disabled={testBusy} className={primaryBtn}>
            {testBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {testBusy ? 'Enviando…' : 'Enviar prueba'}
          </button>
        </form>
      </Card>

      <Card
        icon={<Megaphone className="h-4 w-4" />}
        title="Broadcast manual"
        description={
          <>
            Enviá una oferta o aviso a registrados. Por seguridad arranca en{' '}
            <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">dryRun</code>: primero muestra
            destinatarios y muestra. Variables disponibles:{' '}
            <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{brandName}}'}</code>,{' '}
            <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{domain}}'}</code>,{' '}
            <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{score}}'}</code>,{' '}
            <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">{'{{tip1}}'}</code>.
          </>
        }
      >
        <form onSubmit={sendBroadcast} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_170px_150px]">
            <label className="block">
              <span className={labelCls}>Asunto</span>
              <input
                required
                value={broadcastSubject}
                onChange={(ev) => setBroadcastSubject(ev.target.value)}
                placeholder="Hoy 50% off para activar Premium"
                className={field}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Segmento</span>
              <select
                value={broadcastSegment}
                onChange={(ev) => setBroadcastSegment(ev.target.value as typeof broadcastSegment)}
                className={field}
              >
                <option value="free">free</option>
                <option value="all">all</option>
                <option value="premium">premium</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Límite</span>
              <input
                type="number"
                min={1}
                max={1000}
                value={broadcastLimit}
                onChange={(ev) => setBroadcastLimit(Number(ev.target.value))}
                className={field}
              />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Mensaje</span>
            <textarea
              required
              rows={6}
              value={broadcastBody}
              onChange={(ev) => setBroadcastBody(ev.target.value)}
              placeholder={'Hola {{brandName}}, hoy activamos 50% de descuento en Premium.\n\nTip para {{domain}}: {{tip1}}'}
              className={`${field} resize-y`}
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={broadcastDryRun}
                onChange={(ev) => setBroadcastDryRun(ev.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              Solo prueba (no enviar todavía)
            </label>
            <button type="submit" disabled={broadcastBusy} className={primaryBtn}>
              {broadcastBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              {broadcastBusy ? 'Procesando…' : broadcastDryRun ? 'Previsualizar destinatarios' : 'Enviar broadcast'}
            </button>
          </div>
        </form>
        {broadcastResult ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-800">
            <p className="font-semibold">
              {broadcastResult.dryRun ? 'Prueba lista' : 'Broadcast ejecutado'} ·{' '}
              {broadcastResult.totalRecipients} destinatarios ·{' '}
              <span className="font-mono text-xs text-slate-600">{broadcastResult.campaignSlug}</span>
            </p>
            {!broadcastResult.dryRun ? (
              <p className="mt-1 text-xs text-slate-600">
                Enviados: <strong className="text-emerald-700">{broadcastResult.sent ?? 0}</strong> · Fallidos:{' '}
                <strong className="text-rose-700">{broadcastResult.failed ?? 0}</strong>
              </p>
            ) : null}
            {broadcastResult.sample?.length ? (
              <pre className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-700">
                {JSON.stringify(broadcastResult.sample, null, 2)}
              </pre>
            ) : null}
            {broadcastResult.errors?.length ? (
              <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-rose-200 bg-rose-50 p-3 font-mono text-[11px] text-rose-900">
                {JSON.stringify(broadcastResult.errors, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </Card>

      {stats?.resendWebhook?.available ? (
        <Card
          icon={<Activity className="h-4 w-4" />}
          title={`Resend · entregas y engagement (${stats.resendWebhook.windowDays} días)`}
          description="Eventos que Resend envía por POST y que esta API guarda tras verificar la firma. Independiente del envío por API: podés mandar correos y seguir viendo ceros aquí si falta el webhook configurado en Railway."
        >
          {!stats.resendWebhook.secretConfigured ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              <p>
                <strong className="font-semibold">Sin métricas aquí:</strong> falta{' '}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-amber-200">
                  RESEND_WEBHOOK_SECRET
                </code>{' '}
                en Railway (debe coincidir con el Signing secret de Resend).
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer select-none text-xs font-semibold text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-950">
                  Pasos detallados
                </summary>
                <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-relaxed">
                  <li>
                    Resend → Webhooks: copiá el <strong className="font-semibold">Signing secret</strong> (
                    <code className="font-mono text-[11px]">whsec_…</code>).
                  </li>
                  <li>
                    Railway (servicio API): variable{' '}
                    <code className="rounded bg-white px-1 font-mono text-[11px]">RESEND_WEBHOOK_SECRET</code> con ese
                    valor → redeploy obligatorio.
                  </li>
                  <li>
                    URL del webhook en Resend = base pública de la API +{' '}
                    <code className="font-mono text-[11px]">{stats.resendWebhook.ingestUrl}</code>
                    {stats.resendWebhook.ingestAbsoluteUrl ? (
                      <code className="mt-1 block max-w-full select-all break-all rounded-md bg-white px-2 py-1 font-mono text-[11px] ring-1 ring-amber-200">
                        {stats.resendWebhook.ingestAbsoluteUrl}
                      </code>
                    ) : null}
                  </li>
                </ol>
              </details>
            </div>
          ) : null}

          <div className={`flex flex-wrap items-center gap-2 ${!stats.resendWebhook.secretConfigured ? 'mt-4' : ''}`}>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                stats.resendWebhook.secretConfigured
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-amber-50 text-amber-700 ring-amber-200'
              }`}
            >
              {stats.resendWebhook.secretConfigured ? 'Webhook configurado' : 'Falta secret'}
            </span>
            {stats.resendWebhook.ingestAbsoluteUrl ? (
              <code className="max-w-full select-all break-all rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                POST {stats.resendWebhook.ingestAbsoluteUrl}
              </code>
            ) : (
              <code className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                POST …{stats.resendWebhook.ingestUrl}
              </code>
            )}
            <span className="text-xs text-slate-500">
              Eventos en ventana:{' '}
              <strong className="text-slate-800">{stats.resendWebhook.eventsTotalLastWindow}</strong>
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(
              [
                ['Enviados', Send, stats.resendWebhook.uniqueEmailsByStageLastWindow.sent],
                ['Entregados', MailCheck, stats.resendWebhook.uniqueEmailsByStageLastWindow.delivered],
                ['Abiertos', Eye, stats.resendWebhook.uniqueEmailsByStageLastWindow.opened],
                ['Clics', MousePointerClick, stats.resendWebhook.uniqueEmailsByStageLastWindow.clicked],
                ['Rebotes', AlertTriangle, stats.resendWebhook.uniqueEmailsByStageLastWindow.bounced],
                ['Fallidos', XCircle, stats.resendWebhook.uniqueEmailsByStageLastWindow.failed],
              ] as const
            ).map(([label, Icon, v]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <Icon className="h-4 w-4 text-violet-600" aria-hidden />
                <p className={`mt-2 ${labelCls}`}>{label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{v}</p>
              </div>
            ))}
          </div>

          {Object.keys(stats.resendWebhook.eventsByTypeLastWindow).length > 0 ? (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className={`${labelCls} mb-2`}>Conteo por tipo de evento</p>
              <pre className="max-h-40 overflow-auto font-mono text-[10px] leading-relaxed text-slate-700">
                {JSON.stringify(stats.resendWebhook.eventsByTypeLastWindow, null, 2)}
              </pre>
            </div>
          ) : null}
        </Card>
      ) : stats?.resendWebhook && !stats.resendWebhook.available ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Métricas Resend (webhooks) no disponibles:{' '}
          {(stats.resendWebhook as { reason: string }).reason}.
        </div>
      ) : null}

      <Card
        icon={<LayoutList className="h-4 w-4" />}
        title="Campañas (sem × bucket)"
        description="Sin ID en Resend igual hay HTML incluido por semana (botón Probar). Con plantilla en Resend, pegá el id y usá variables WEEK, TITLE, PREHEADER, SLUG."
        rightSlot={
          <button type="button" onClick={() => void runSeed()} className={secondaryBtn}>
            Crear plantillas 1–8
          </button>
        }
      >
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <Inbox className="h-7 w-7" aria-hidden />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-900">Todavía no hay campañas</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
              Generá las filas base (semanas 1–8, bucket{' '}
              <span className="font-mono text-xs">all</span>) para empezar a asociar templates del ESP.
            </p>
            <button type="button" onClick={() => void runSeed()} className={`${primaryBtn} mt-5`}>
              Crear plantillas semana 1–8
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sem</th>
                  <th className="px-3 py-3">Bucket</th>
                  <th className="px-3 py-3">Slug</th>
                  <th className="px-3 py-3">Título</th>
                  <th className="px-3 py-3">ESP template id</th>
                  <th className="px-3 py-3">Probar</th>
                  <th className="px-3 py-3">Activa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {campaigns.map((c) => (
                  <CampaignEspRow
                    key={c.id}
                    c={c}
                    previewBusy={campaignPreviewBusyId === c.id}
                    onToggle={() => void toggleCampaign(c)}
                    onSaveEsp={saveEspTemplate}
                    onSendPreview={() => void sendCampaignPreview(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form
          onSubmit={createCampaign}
          className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5 sm:grid-cols-2"
        >
          <h3 className="text-sm font-semibold text-slate-900 sm:col-span-2">Nueva campaña manual</h3>
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
            <button type="submit" className={primaryBtn}>
              Crear campaña
            </button>
          </div>
        </form>
      </Card>

      <Card
        icon={<ScrollText className="h-4 w-4" />}
        title="Auditoría — últimos envíos"
        description="Entradas por jobs o manualmente. Con el ESP conectado, el worker debería escribir sent y externalId."
      >
        <form
          onSubmit={addManualLog}
          className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-5 sm:grid-cols-2"
        >
          <h3 className="text-sm font-semibold text-slate-900 sm:col-span-2">Registrar envío manual (prueba)</h3>
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
            <input
              value={logScore}
              onChange={(ev) => setLogScore(ev.target.value)}
              placeholder="42"
              className={field}
            />
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
            <button type="submit" className={secondaryBtn}>
              Registrar log
            </button>
          </div>
        </form>

        {logs.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Sin registros en esta vista. Los envíos de prueba y el worker aparecerán aquí.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Campaña</th>
                  <th className="px-3 py-3 text-right">Score</th>
                  <th className="px-3 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {logs.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {new Date(r.createdAt).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-3 text-slate-800">{r.recipientEmail}</td>
                    <td className="px-3 py-3 font-mono text-[11px] text-slate-600">{r.campaignSlug}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">{r.cleexsScore ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${
                          r.status === 'sent'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                            : r.status === 'failed'
                              ? 'bg-rose-50 text-rose-700 ring-rose-200'
                              : 'bg-slate-100 text-slate-600 ring-slate-200'
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
      </Card>
    </div>
  );
}

function Card({
  icon,
  title,
  description,
  children,
  rightSlot,
}: {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>
        {rightSlot ? <div className="flex shrink-0 flex-wrap gap-2">{rightSlot}</div> : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function CampaignEspRow({
  c,
  previewBusy,
  onToggle,
  onSaveEsp,
  onSendPreview,
}: {
  c: CampaignRow;
  previewBusy: boolean;
  onToggle: () => void;
  onSaveEsp: (c: CampaignRow, esp: string) => Promise<void>;
  onSendPreview: () => void;
}) {
  const [localEsp, setLocalEsp] = useState(c.espTemplateId ?? '');
  useEffect(() => {
    setLocalEsp(c.espTemplateId ?? '');
  }, [c.espTemplateId]);

  return (
    <tr className="align-top hover:bg-slate-50/40">
      <td className="px-4 py-3 font-medium text-slate-900">{c.weekIndex}</td>
      <td className="px-3 py-3">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{c.scoreBucket}</span>
      </td>
      <td className="px-3 py-3 font-mono text-xs text-slate-700">{c.slug}</td>
      <td className="max-w-[220px] truncate px-3 py-3 text-slate-700" title={c.title}>
        {c.title}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5">
          <input
            value={localEsp}
            onChange={(ev) => setLocalEsp(ev.target.value)}
            className="min-w-[120px] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px] shadow-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-200"
            placeholder="template_id"
          />
          <button
            type="button"
            onClick={() => void onSaveEsp(c, localEsp)}
            className={`${subtleBtn} text-[11px]`}
          >
            Guardar
          </button>
        </div>
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          disabled={previewBusy}
          onClick={onSendPreview}
          className={`${subtleBtn} text-[11px]`}
        >
          {previewBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {previewBusy ? 'Enviando…' : 'Probar'}
        </button>
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
            c.active
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-slate-100 text-slate-600 ring-slate-200'
          }`}
        >
          {c.active ? 'sí' : 'no'}
        </button>
      </td>
    </tr>
  );
}
