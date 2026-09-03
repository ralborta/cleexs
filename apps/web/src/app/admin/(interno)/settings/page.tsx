'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Calendar,
  Cog,
  CreditCard,
  Database,
  Globe,
  Lock,
  Mail,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  Webhook,
  Zap,
} from 'lucide-react';
import { internalReportsApi, type SystemConfigReport } from '@/lib/api';
import {
  ReportErrorBanner,
  ReportLoading,
  ReportRefreshButton,
  ReportSection,
  formatDate,
} from '@/components/admin/report-ui';
import { WhatsAppMonitorPanel } from '@/components/admin/whatsapp-monitor-panel';

function StatusBadge({ ok, labelOk = 'OK', labelKo = 'Faltante' }: { ok: boolean; labelOk?: string; labelKo?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        ok
          ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
          : 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      {ok ? labelOk : labelKo}
    </span>
  );
}

function IntegrationCard({
  Icon,
  name,
  status,
  description,
  rows,
}: {
  Icon: typeof Mail;
  name: string;
  status: 'ok' | 'warning' | 'missing';
  description?: string;
  rows: Array<{ label: string; value: string | number | null; ok?: boolean }>;
}) {
  const toneRing =
    status === 'ok'
      ? 'ring-emerald-200'
      : status === 'warning'
        ? 'ring-amber-200'
        : 'ring-rose-200';
  const toneBg =
    status === 'ok' ? 'bg-emerald-50' : status === 'warning' ? 'bg-amber-50' : 'bg-rose-50';
  const toneIcon =
    status === 'ok' ? 'text-emerald-700' : status === 'warning' ? 'text-amber-700' : 'text-rose-700';

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ${toneRing}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneBg}`}>
            <Icon className={`h-5 w-5 ${toneIcon}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            {description ? <p className="text-xs text-slate-500">{description}</p> : null}
          </div>
        </div>
        <StatusBadge
          ok={status === 'ok'}
          labelOk={status === 'ok' ? 'Configurado' : status === 'warning' ? 'Parcial' : 'Faltante'}
          labelKo={status === 'warning' ? 'Parcial' : 'Faltante'}
        />
      </div>
      {rows.length > 0 ? (
        <dl className="space-y-1 text-xs">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3">
              <dt className="text-slate-500">{row.label}</dt>
              <dd className="max-w-[60%] truncate text-right font-mono text-[11px] text-slate-700" title={row.value?.toString() ?? ''}>
                {row.value === null || row.value === '' ? (
                  <span className="italic text-slate-400">—</span>
                ) : (
                  row.value
                )}
                {row.ok != null ? <StatusBadge ok={row.ok} /> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function KeyValueRow({ label, value, mono = true }: { label: string; value: string | number | boolean | null; mono?: boolean }) {
  const render = () => {
    if (value === null || value === '') return <span className="italic text-slate-400">—</span>;
    if (typeof value === 'boolean') {
      return value ? <StatusBadge ok labelOk="true" /> : <StatusBadge ok={false} labelKo="false" />;
    }
    return value;
  };
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`max-w-[60%] truncate text-right text-slate-800 ${mono ? 'font-mono text-[11px]' : ''}`} title={String(value ?? '')}>
        {render()}
      </span>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remM = mins % 60;
  if (hours < 24) return `${hours}h ${remM}m`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return `${days}d ${remH}h`;
}

function smtpStatus(s: SystemConfigReport['integrations']['smtp']): 'ok' | 'warning' | 'missing' {
  return s.configured ? 'ok' : 'missing';
}

function resendStatus(r: SystemConfigReport['integrations']['resend']): 'ok' | 'warning' | 'missing' {
  if (r.apiKeyConfigured && r.webhookSecretConfigured) return 'ok';
  if (r.apiKeyConfigured) return 'warning';
  return 'missing';
}

function mpStatus(m: SystemConfigReport['integrations']['mercadopago']): 'ok' | 'warning' | 'missing' {
  if (m.accessTokenConfigured && m.webhookSecretConfigured) return 'ok';
  if (m.accessTokenConfigured) return 'warning';
  return 'missing';
}

export default function AdminSettingsPage() {
  const [data, setData] = useState<SystemConfigReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await internalReportsApi.systemConfig();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la configuracion.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Cog className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Configuracion general</h1>
            <p className="text-sm text-slate-600">
              Estado de las integraciones, variables y webhooks que mantienen vivo a Cleexs.
            </p>
          </div>
        </div>
        <ReportRefreshButton loading={loading} onClick={load} />
      </header>

      {error ? <ReportErrorBanner message={error} /> : null}

      <ReportSection
        title="Estado WhatsApp"
        description="Monitor en vivo de la API Cleexs, el bot Baileys y la sesión WhatsApp."
      >
        <WhatsAppMonitorPanel />
      </ReportSection>

      {loading && !data ? <ReportLoading /> : null}

      {data ? (
        <>
          {/* Environment */}
          <ReportSection title="Entorno y deploy" description="Informacion del proceso de la API.">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Node" value={data.environment.nodeVersion} />
              <StatTile label="Uptime" value={formatUptime(data.environment.uptimeSec)} />
              <StatTile label="Env" value={data.environment.nodeEnv} />
              <StatTile label="Dominio" value={data.environment.railwayDomain || '—'} />
            </div>
            {data.environment.railwayCommit ? (
              <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                <KeyValueRow label="Commit" value={data.environment.railwayCommit.slice(0, 12)} />
                <KeyValueRow label="Branch" value={data.environment.railwayBranch} />
              </div>
            ) : null}
          </ReportSection>

          {/* Integrations */}
          <ReportSection
            title="Integraciones"
            description="Cada bloque muestra si el servicio externo esta configurado y operando."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <IntegrationCard
                Icon={Bot}
                name="OpenAI"
                status={data.integrations.openai.configured ? 'ok' : 'missing'}
                description="Provee diagnosticos, prompts y analisis."
                rows={[
                  { label: 'API key', value: data.integrations.openai.configured ? 'configurada' : 'falta' },
                  { label: 'Modelo principal', value: data.integrations.openai.model },
                  { label: 'Competidores', value: data.integrations.openai.competitorsModel },
                ]}
              />
              <IntegrationCard
                Icon={Sparkles}
                name="Gemini (Google)"
                status={data.integrations.gemini.configured ? 'ok' : 'missing'}
                description="LLM secundario para tier Gold."
                rows={[{ label: 'API key', value: data.integrations.gemini.configured ? 'configurada' : 'falta' }]}
              />
              <IntegrationCard
                Icon={Mail}
                name="Resend"
                status={resendStatus(data.integrations.resend)}
                description="Envio de emails y tracking via webhooks."
                rows={[
                  { label: 'API key', value: data.integrations.resend.apiKeyConfigured ? 'configurada' : 'falta' },
                  { label: 'Webhook secret', value: data.integrations.resend.webhookSecretConfigured ? 'configurado' : 'falta' },
                ]}
              />
              <IntegrationCard
                Icon={Send}
                name="SMTP (fallback)"
                status={smtpStatus(data.integrations.smtp)}
                description="Solo se usa si Resend no esta disponible."
                rows={[
                  { label: 'Host', value: data.integrations.smtp.host },
                  { label: 'Puerto', value: data.integrations.smtp.port },
                  { label: 'From', value: data.integrations.smtp.fromEmail },
                ]}
              />
              <IntegrationCard
                Icon={CreditCard}
                name="MercadoPago"
                status={mpStatus(data.integrations.mercadopago)}
                description="Cobros de planes Premium en ARS."
                rows={[
                  { label: 'Access token', value: data.integrations.mercadopago.accessTokenConfigured ? 'configurado' : 'falta' },
                  { label: 'Webhook secret', value: data.integrations.mercadopago.webhookSecretConfigured ? 'configurado' : 'falta' },
                  { label: 'Webhook URL', value: data.integrations.mercadopago.webhookUrl },
                ]}
              />
              <IntegrationCard
                Icon={Globe}
                name="Firecrawl"
                status={data.integrations.firecrawl.configured ? 'ok' : 'missing'}
                description="Scraping de competidores para outreach."
                rows={[{ label: 'API key', value: data.integrations.firecrawl.configured ? 'configurada' : 'falta' }]}
              />
              <IntegrationCard
                Icon={Search}
                name="Hunter"
                status={data.integrations.hunter.configured ? 'ok' : 'missing'}
                description="Descubrimiento de emails de contacto."
                rows={[{ label: 'API key', value: data.integrations.hunter.configured ? 'configurada' : 'falta' }]}
              />
              <IntegrationCard
                Icon={Search}
                name="Serper / SerpAPI"
                status={data.integrations.serper.configured ? 'ok' : 'missing'}
                description="Resultados web reales para enriquecer diagnosticos."
                rows={[{ label: 'API key', value: data.integrations.serper.configured ? 'configurada' : 'falta' }]}
              />
              <IntegrationCard
                Icon={MessageCircle}
                name="WhatsApp / Baileys"
                status={
                  data.integrations.builderbot.baileysBotUrl || data.integrations.builderbot.configured
                    ? 'ok'
                    : 'missing'
                }
                description="Bot self-hosted (Baileys) o BuilderBot Cloud."
                rows={[
                  {
                    label: 'Baileys URL',
                    value: data.integrations.builderbot.baileysBotUrl || 'no configurado',
                  },
                  {
                    label: 'BBC (fallback)',
                    value: data.integrations.builderbot.configured ? 'configurado' : 'no',
                  },
                ]}
              />
              <IntegrationCard
                Icon={Smartphone}
                name="Canal WhatsApp"
                status={data.integrations.whatsapp.apiKeyConfigured ? 'ok' : 'missing'}
                description="Diagnosticos desde QR / WhatsApp."
                rows={[
                  { label: 'API key', value: data.integrations.whatsapp.apiKeyConfigured ? 'configurada' : 'falta' },
                  { label: 'Limite diario', value: data.integrations.whatsapp.dailyLimit },
                ]}
              />
              <IntegrationCard
                Icon={Zap}
                name="Satellite (AEO tools)"
                status={data.integrations.satellite.enabled ? (data.integrations.satellite.baseUrl ? 'ok' : 'warning') : 'missing'}
                description="Modulo satelite de herramientas AEO."
                rows={[
                  { label: 'Habilitado', value: data.integrations.satellite.enabled ? 'true' : 'false' },
                  { label: 'Base URL', value: data.integrations.satellite.baseUrl },
                ]}
              />
              <IntegrationCard
                Icon={Database}
                name="Database (Postgres)"
                status={data.integrations.database.configured ? 'ok' : 'missing'}
                description="Conexion Prisma a Railway."
                rows={[{ label: 'DATABASE_URL', value: data.integrations.database.configured ? 'configurado' : 'falta' }]}
              />
            </div>
          </ReportSection>

          {/* Variables / Vars*/}
          <ReportSection
            title="Variables clave del sistema"
            description="Configuracion que afecta el comportamiento del producto. No expone secretos."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Mail className="h-3.5 w-3.5" />
                  Outreach (cold emails)
                </h3>
                <KeyValueRow label="From email" value={data.variables.outreach.fromEmail} />
                <KeyValueRow label="From name" value={data.variables.outreach.fromName} mono={false} />
                <KeyValueRow label="Reply-to" value={data.variables.outreach.replyTo} />
                <KeyValueRow label="Shadow to" value={data.variables.outreach.shadowTo} />
                <KeyValueRow label="Limite diario" value={data.variables.outreach.dailyLimit} />
                <KeyValueRow label="Dominio verificado" value={data.variables.outreach.domainVerified} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Lock className="h-3.5 w-3.5" />
                  Admin y autenticacion
                </h3>
                <KeyValueRow label="ADMIN_API_SECRET" value={data.variables.admin.apiSecretConfigured} />
                <KeyValueRow label="Auth requerida (ADMIN_REQUIRE_AUTH)" value={data.variables.admin.requireAuth} />
                <KeyValueRow label="Emails con acceso full" value={data.variables.admin.fullAccessEmails} />
                <KeyValueRow label="ALLOW_USAGE_ACTOR_QUERY" value={data.variables.admin.allowActorQuery} />
                <KeyValueRow label="PORTAL_JWT_SECRET" value={data.variables.auth.portalJwtSecretConfigured} />
                <KeyValueRow label="CRON_SECRET" value={data.variables.auth.cronSecretConfigured} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Globe className="h-3.5 w-3.5" />
                  URLs publicas
                </h3>
                <KeyValueRow label="App URL" value={data.variables.urls.appUrl} />
                <KeyValueRow label="Marketing URL" value={data.variables.urls.marketingUrl} />
                <KeyValueRow label="Frontend URL" value={data.variables.urls.frontend} />
                <KeyValueRow label="Frontend extras" value={data.variables.urls.frontendList} />
                <KeyValueRow label="API base" value={data.variables.urls.apiBase} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Tag className="h-3.5 w-3.5" />
                  Billing y diagnostico publico
                </h3>
                <KeyValueRow label="USD -> ARS rate" value={data.variables.billing.usdToArsRate} />
                <KeyValueRow label="Moneda default" value={data.variables.billing.currency} />
                <KeyValueRow label="Pais default" value={data.variables.publicDiagnostic.defaultCountry} />
                <KeyValueRow label="Mercado confianza min" value={data.variables.publicDiagnostic.marketConfidenceMin} />
              </div>
            </div>
          </ReportSection>

          {/* Webhooks */}
          <ReportSection
            title="Webhooks entrantes"
            description="URLs a las que los proveedores externos avisan eventos."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-900">MercadoPago</p>
                  <StatusBadge ok={data.webhooks.mercadopago.configured} />
                </div>
                <KeyValueRow label="URL" value={data.webhooks.mercadopago.url} />
                <KeyValueRow label="Eventos ultimos 30d" value={data.webhooks.mercadopago.eventsLast30Days} />
                <KeyValueRow label="Ultimo evento" value={formatDate(data.webhooks.mercadopago.lastEventAt)} />
                <KeyValueRow label="Source" value={data.webhooks.mercadopago.lastEventSource} />
                {data.webhooks.mercadopago.eventsLast30Days === 0 && data.webhooks.mercadopago.configured ? (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    Sin eventos en 30 dias: verifica que el panel de MP apunte a esta URL.
                  </p>
                ) : null}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-900">Resend</p>
                  <StatusBadge ok={data.webhooks.resend.configured} />
                </div>
                <KeyValueRow label="URL" value={data.webhooks.resend.url} />
                <KeyValueRow label="Eventos ultimos 30d" value={data.webhooks.resend.eventsLast30Days} />
                <KeyValueRow label="Ultimo evento" value={formatDate(data.webhooks.resend.lastEventAt)} />
                <KeyValueRow label="Tipo" value={data.webhooks.resend.lastEventType} />
                {Object.keys(data.webhooks.resend.eventsByType).length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(data.webhooks.resend.eventsByType).map(([evt, count]) => (
                      <span
                        key={evt}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                      >
                        {evt}: {count}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </ReportSection>

          {/* Cron jobs */}
          <ReportSection
            title="Tareas programadas"
            description="Estado de los jobs que corren en background."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-900">Weekly emails (insights)</p>
                  <StatusBadge ok={data.cron.weeklyEmails.cronSecretConfigured} labelOk="Activo" labelKo="Sin CRON_SECRET" />
                </div>
                <KeyValueRow label="Ultimo envio" value={formatDate(data.cron.weeklyEmails.lastSendAt)} />
                <KeyValueRow label="Status ultimo" value={data.cron.weeklyEmails.lastSendStatus} />
                <KeyValueRow label="Envios 7d" value={data.cron.weeklyEmails.sendsLast7Days} />
                <KeyValueRow label="Envios 30d" value={data.cron.weeklyEmails.sendsLast30Days} />
                <KeyValueRow label="Campanas activas" value={data.cron.weeklyEmails.campaignsActive} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-900">Cold outreach competidores</p>
                  <StatusBadge
                    ok={data.cron.outreach.domainVerified}
                    labelOk="Dominio verificado"
                    labelKo="Modo shadow"
                  />
                </div>
                <KeyValueRow label="Limite diario" value={data.cron.outreach.dailyLimit} />
                <KeyValueRow label="Enviados hoy" value={data.cron.outreach.todayRealSent} />
                <KeyValueRow label="Enviados 7d" value={data.cron.outreach.last7DaysSent} />
                <KeyValueRow label="Dominio verificado" value={data.cron.outreach.domainVerified} />
              </div>
            </div>
          </ReportSection>

          {/* DB stats */}
          <ReportSection
            title="Estado de la base de datos"
            description="Conteos en vivo (tabla por tabla)."
          >
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <StatTile label="Tenants" value={data.database.tenants} />
              <StatTile label="Users" value={data.database.users} />
              <StatTile label="Brands" value={data.database.brands} />
              <StatTile label="Runs" value={data.database.runs} />
              <StatTile label="Diagnosticos publicos" value={data.database.publicDiagnostics} />
              <StatTile label="Suscripciones" value={data.database.subscriptions} />
              <StatTile label="Payments" value={data.database.payments} />
              <StatTile label="Lead contacts" value={data.database.leadContacts} />
              <StatTile label="Lead emails" value={data.database.leadEmails} />
            </div>
          </ReportSection>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p>
              El wizard antiguo de onboarding (crear marca + competidores + prompts) sigue accesible en{' '}
              <a href="/settings" className="font-medium text-violet-700 hover:text-violet-900">
                /settings
              </a>{' '}
              por si lo necesitas, pero ya no esta linkeado desde el admin (el flujo nuevo lo hace
              automaticamente el diagnostico publico).
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
