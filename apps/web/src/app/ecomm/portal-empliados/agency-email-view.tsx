'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortalEmailDemoFetch } from '@/lib/portal-email-demo-data';
import './agency-stitch-scope.css';

type Campaign = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  preheader: string | null;
  description: string | null;
  active: boolean;
  templateVariant: string | null;
};

type Step = {
  id: string;
  name: string;
  daysAfter: number;
  subject: string;
  preheader: string;
  template: string;
  body: string;
  active: boolean;
};

type Tab = 'secuencia' | 'diseno' | 'metricas' | 'webhooks';

const DEFAULT_STEPS: Step[] = [
  {
    id: 's1',
    name: 'Bienvenida post-demo',
    daysAfter: 0,
    subject: 'Gracias por la demo · qué hace cada Empliado en tu operación',
    preheader: 'Tu oficina virtual de logística, paso a paso',
    template: 'Carta ejecutiva (Editorial sans) - Cleexs',
    body: 'Hola — gracias por la demo. Acá te dejamos cómo cada Empliado impacta reclamos, seguimiento y coordinación en tu operación.',
    active: true,
  },
  {
    id: 's2',
    name: 'Caso reclamos & automatización',
    daysAfter: 2,
    subject: 'Caso reclamos 24/7 · menos llamados a la oficina',
    preheader: 'Cómo un cliente bajó el teléfono un 40%',
    template: 'Boletín Métricas IA + Scorecard',
    body: 'Mirá el caso de un operador que automatizó reclamos con el Agente de Reclamos y liberó a la oficina.',
    active: true,
  },
  {
    id: 's3',
    name: 'Invitación Referidos & Beneficio',
    daysAfter: 5,
    subject: 'Tu link de referidos Empliados',
    preheader: 'Compartí y sumá crédito en agentes',
    template: 'Notificación Transaccional',
    body: 'Activá tu link de referidos y sumá crédito para activar más agentes en tu flota.',
    active: true,
  },
];

const STORAGE_KEY = 'portal_empliados_email_seq_v1';

function loadSteps(): Step[] {
  if (typeof window === 'undefined') return DEFAULT_STEPS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STEPS;
    const parsed = JSON.parse(raw) as Step[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_STEPS;
  } catch {
    return DEFAULT_STEPS;
  }
}

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

/**
 * Email = HTML Stitch (email-secuencias-y-env-os.html) + demo API portal-email.
 * Cubre Secuencias + Envíos (Plantillas sigue en su dashboard: no hay screen Stitch).
 */
export function AgencyEmailView({ initialFocus = 'secuencia' }: { initialFocus?: 'secuencia' | 'envios' }) {
  const fetcher = useMemo(() => createPortalEmailDemoFetch(), []);
  const [tab, setTab] = useState<Tab>(initialFocus === 'envios' ? 'metricas' : 'secuencia');
  const [steps, setSteps] = useState<Step[]>(DEFAULT_STEPS);
  const [selected, setSelected] = useState(0);
  const [cronOn, setCronOn] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<{ sent: number; opened: number; clicked: number; purchased: number } | null>(null);
  const [q, setQ] = useState('');
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('ops@transporteandino.com');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSteps(loadSteps());
  }, []);

  useEffect(() => {
    setTab(initialFocus === 'envios' ? 'metricas' : 'secuencia');
  }, [initialFocus]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        fetcher('/api/borrador/portal-email/stats'),
        fetcher('/api/borrador/portal-email/campaigns'),
      ]);
      const sJson = await sRes.json().catch(() => null);
      const cJson = await cRes.json().catch(() => null);
      if (sRes.ok && sJson?.resendWebhook?.uniqueEmailsByStageLastWindow) {
        const u = sJson.resendWebhook.uniqueEmailsByStageLastWindow;
        setStats({
          sent: sJson.byStatusLast30Days?.sent ?? u.sent ?? 0,
          opened: u.opened ?? 0,
          clicked: u.clicked ?? 0,
          purchased: Math.round((u.clicked ?? 0) * 0.35),
        });
      }
      if (cRes.ok && Array.isArray(cJson)) setCampaigns(cJson as Campaign[]);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void load();
  }, [load]);

  const step = steps[selected] ?? steps[0]!;

  function updateStep(patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, i) => (i === selected ? { ...s, ...patch } : s)));
    setSaveState('idle');
  }

  async function saveChanges() {
    setSaveState('saving');
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
      await fetcher('/api/borrador/portal-email/free-sequence-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps }),
      });
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('idle');
    }
  }

  function addStep() {
    const id = `s${Date.now()}`;
    setSteps((prev) => [
      ...prev,
      {
        id,
        name: `Nuevo paso ${prev.length + 1}`,
        daysAfter: 3,
        subject: 'Asunto pendiente',
        preheader: '',
        template: 'Carta ejecutiva (Editorial sans) - Cleexs',
        body: '',
        active: false,
      },
    ]);
    setSelected(steps.length);
  }

  async function sendTest() {
    setTestMsg(null);
    const res = await fetcher('/api/borrador/portal-email/test-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testEmail, stepId: step.id, subject: step.subject }),
    });
    const json = await res.json().catch(() => ({}));
    setTestMsg(json.message || (res.ok ? 'Prueba disparada (demo)' : 'Error'));
    if (res.ok) window.setTimeout(() => setTestOpen(false), 1200);
  }

  const openRate = stats && stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 1000) / 10 : 40.2;
  const ctr = stats && stats.opened > 0 ? Math.round((stats.clicked / stats.opened) * 1000) / 10 : 26.6;
  const conv = stats && stats.sent > 0 ? Math.round((stats.purchased / stats.sent) * 1000) / 10 : 3.1;

  const filteredCampaigns = campaigns.filter((c) => {
    if (!q.trim()) return true;
    const n = q.trim().toLowerCase();
    return c.title.toLowerCase().includes(n) || c.slug.toLowerCase().includes(n);
  });

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs mb-1">
            <span className="material-symbols-outlined text-primary text-[20px]">mark_email_unread</span>
            <span className="font-label-micro text-label-micro text-primary uppercase font-bold tracking-wider">
              Crecimiento · Email
            </span>
          </div>
          <h1 className="font-headline-title text-headline-title text-on-surface font-bold">
            Secuencias y Envíos de Email
          </h1>
          <p className="font-body-default text-body-sm text-on-surface-variant max-w-3xl">
            Armá la secuencia free post-demo, editá cada paso con preview en vivo y monitoreá envíos / aperturas /
            clics UTM (demo Empliados · Resend).
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap">
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1 px-space-md py-2 rounded-lg bg-surface-container-low text-on-surface font-body-medium text-body-sm"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>sync</span>
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => setTestOpen(true)}
            className="flex items-center gap-1 px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            Enviar prueba ahora
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {(
          [
            ['Total Enviados', fmt(stats?.sent ?? 5102), 'send', 'bg-primary-container/20 text-primary'],
            ['Tasa de Apertura', `${openRate}%`, 'visibility', 'bg-tertiary-fixed text-tertiary'],
            ['Clics & CTR', `${ctr}%`, 'ads_click', 'bg-secondary-container/40 text-secondary'],
            ['Compraron / Activaron', `${conv}%`, 'verified', 'bg-secondary-fixed text-on-secondary-fixed'],
          ] as const
        ).map(([label, value, icon, tone]) => (
          <div key={label} className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-space-xs">
              <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">{label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}>
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
              </div>
            </div>
            <div className="font-headline-metric text-headline-metric text-on-surface">{value}</div>
            <span className="font-body-sm text-[12px] text-outline mt-1">Últimos 30 días · demo</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-xl w-fit overflow-x-auto shadow-sm">
        {(
          [
            ['secuencia', 'Secuencia Free Post-Demo', 'fiber_manual_record'],
            ['diseno', 'Diseño Carta / Editorial', 'article'],
            ['metricas', 'Métricas por Campaña', 'stacked_bar_chart'],
            ['webhooks', 'Webhook & Logs Resend', 'webhook'],
          ] as const
        ).map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? 'inline-flex items-center gap-2 px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-primary font-body-medium text-body-sm shadow-sm'
                : 'inline-flex items-center gap-1.5 px-space-md py-1.5 rounded-lg text-on-surface-variant font-body-medium text-body-sm'
            }
          >
            {key === 'secuencia' && tab === key ? (
              <span className="w-2 h-2 rounded-full bg-secondary" />
            ) : (
              <span className="material-symbols-outlined text-[17px]">{icon}</span>
            )}
            <span>{label}</span>
            {key === 'secuencia' ? (
              <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-label-micro font-label-micro">Activa</span>
            ) : null}
          </button>
        ))}
      </div>

      {(tab === 'secuencia' || tab === 'diseno') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className="lg:col-span-5 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
              <div className="flex items-center justify-between mb-space-xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
                  <span className="font-body-medium text-body-sm text-on-surface font-semibold">Cron &amp; Programación</span>
                </div>
                <span className="font-label-micro text-label-micro text-secondary bg-secondary-container/40 px-2 py-0.5 rounded-full font-medium">
                  11:30 AR
                </span>
              </div>
              <label className="flex items-center justify-between pt-1 cursor-pointer">
                <span className="font-body-sm text-body-sm text-on-surface-variant">Corrida automática diaria</span>
                <input type="checkbox" checked={cronOn} onChange={(e) => setCronOn(e.target.checked)} className="text-primary" />
              </label>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-2">
              <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
                Pipeline de pasos
              </span>
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={
                    selected === i
                      ? 'text-left p-space-md rounded-xl bg-primary-fixed/40 border border-primary/20'
                      : 'text-left p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container'
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-body-medium text-body-sm font-semibold text-on-surface">
                      Paso {i + 1}: {s.name}
                    </span>
                    <span className="font-label-micro text-[11px] text-outline">D+{s.daysAfter}</span>
                  </div>
                  <p className="font-body-sm text-[12px] text-outline mt-0.5 truncate">{s.subject}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={addStep}
                className="flex items-center justify-center gap-1 py-2 rounded-lg text-primary font-body-medium text-body-sm hover:bg-primary-fixed/30"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Agregar nuevo paso a la secuencia
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-headline-title text-body-medium font-bold text-on-surface">
                    Contenido del Correo · Paso {selected + 1}
                  </h2>
                  <span className="font-label-micro text-label-micro text-outline">
                    Editás acá y los cambios se reflejan en el preview
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {saveState === 'saved' ? (
                    <span className="font-label-micro text-secondary flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-secondary" /> Guardado
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void saveChanges()}
                    disabled={saveState === 'saving'}
                    className="px-space-sm py-1 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm disabled:opacity-50"
                  >
                    {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
                  Nombre Interno del Paso
                </label>
                <input
                  className="w-full bg-surface-container-low px-space-md py-2 rounded-lg font-body-default text-body-default text-on-surface outline-none focus:bg-surface-container-lowest"
                  value={step.name}
                  onChange={(e) => updateStep({ name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <div>
                  <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
                    Días después del paso anterior
                  </label>
                  <input
                    type="number"
                    className="w-full bg-surface-container-low px-space-md py-2 rounded-lg font-metric-tabular text-body-default outline-none"
                    value={step.daysAfter}
                    onChange={(e) => updateStep({ daysAfter: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
                    Plantilla / Layout
                  </label>
                  <select
                    className="w-full bg-surface-container-low px-space-md py-2 rounded-lg font-body-default text-body-default outline-none cursor-pointer"
                    value={step.template}
                    onChange={(e) => updateStep({ template: e.target.value })}
                  >
                    <option>Carta ejecutiva (Editorial sans) - Cleexs</option>
                    <option>Boletín Métricas IA + Scorecard</option>
                    <option>Notificación Transaccional</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
                  Subject Line
                </label>
                <input
                  className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none"
                  value={step.subject}
                  onChange={(e) => updateStep({ subject: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
                  Preheader
                </label>
                <input
                  className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none"
                  value={step.preheader}
                  onChange={(e) => updateStep({ preheader: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
                  Cuerpo
                </label>
                <textarea
                  rows={4}
                  className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none resize-none font-body-sm text-body-sm"
                  value={step.body}
                  onChange={(e) => updateStep({ body: e.target.value })}
                />
              </div>
            </div>

            {/* Preview */}
            <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm">
              <div className="flex items-center gap-2 mb-space-md">
                <span className="material-symbols-outlined text-primary text-[18px]">preview</span>
                <span className="font-headline-title text-body-medium font-bold text-on-surface">Preview en vivo</span>
              </div>
              <div className="rounded-xl bg-surface-container-low p-space-md">
                <div className="font-label-micro text-label-micro text-outline mb-1">De: Empliados · hello@empliados.net</div>
                <div className="font-body-medium text-body-sm font-bold text-on-surface mb-1">{step.subject || '—'}</div>
                <div className="font-body-sm text-[12px] text-outline mb-space-md">{step.preheader}</div>
                <p className="font-body-default text-body-sm text-on-surface whitespace-pre-wrap">{step.body || '—'}</p>
                <div className="mt-space-md inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-fixed/40 text-primary font-label-micro text-label-micro">
                  Layout: {step.template}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(tab === 'metricas' || tab === 'webhooks' || initialFocus === 'envios') && (
        <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div>
              <h2 className="font-headline-title text-headline-title text-on-surface">
                Monitoreo de Envíos por Campaña
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Secuencias programadas, aperturas reales y atribución vía UTM (demo portal-email).
              </p>
            </div>
            <div className="relative flex items-center bg-surface-container-low rounded-lg px-space-sm py-1.5">
              <span className="material-symbols-outlined text-outline text-[18px] mr-1">search</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar campañas..."
                className="bg-transparent outline-none font-body-sm text-body-sm w-44"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-outline font-label-micro text-label-micro uppercase tracking-wider">
                  <th className="py-2.5 px-space-md rounded-l-lg">Campaña / Batch</th>
                  <th className="py-2.5 px-space-sm">Slug</th>
                  <th className="py-2.5 px-space-sm">Variant</th>
                  <th className="py-2.5 px-space-sm">Estado</th>
                  <th className="py-2.5 px-space-sm text-right rounded-r-lg">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-outline font-body-sm">
                      Cargando campañas…
                    </td>
                  </tr>
                ) : filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-outline font-body-sm">
                      Sin campañas
                    </td>
                  </tr>
                ) : (
                  filteredCampaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-space-md px-space-md">
                        <div className="flex items-center gap-space-sm">
                          <span className={`w-2 h-2 rounded-full ${c.active ? 'bg-secondary' : 'bg-outline'}`} />
                          <div>
                            <div className="font-body-medium text-body-sm font-semibold text-on-surface">{c.title}</div>
                            <div className="font-body-sm text-[11px] text-outline truncate max-w-xs">{c.subject}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-space-md px-space-sm font-mono text-[11px] text-primary">{c.slug}</td>
                      <td className="py-space-md px-space-sm font-body-sm">{c.templateVariant || '—'}</td>
                      <td className="py-space-md px-space-sm">
                        <span
                          className={
                            c.active
                              ? 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container font-semibold'
                              : 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-outline font-semibold'
                          }
                        >
                          {c.active ? 'Activa' : 'Pausada'}
                        </span>
                      </td>
                      <td className="py-space-md px-space-sm text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setTab('secuencia');
                            const idx = steps.findIndex((s) => s.subject === c.subject);
                            if (idx >= 0) setSelected(idx);
                          }}
                          className="p-1 rounded text-outline hover:text-primary"
                          title="Abrir en editor"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {tab === 'webhooks' ? (
            <div className="flex items-center gap-space-sm px-space-md py-2.5 rounded-xl bg-surface-container-low text-on-surface-variant font-body-sm">
              <span className="material-symbols-outlined text-secondary text-[20px]">webhook</span>
              <span className="flex-1">
                Resend webhook demo activo · ingest <code className="text-primary font-mono text-[11px]">/api/webhooks/resend</code>
              </span>
              <button type="button" onClick={() => void load()} className="font-label-micro text-primary font-semibold">
                Ver logs completos
              </button>
            </div>
          ) : null}
        </div>
      )}

      {testOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-space-lg shadow-lg flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-title text-body-medium font-bold text-on-surface">Enviar Correo de Prueba</h3>
              <button type="button" onClick={() => setTestOpen(false)} className="text-outline">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <p className="font-body-sm text-body-sm text-outline">
              Dispara el paso actual ({step.name}) vía demo API — sin envío real a producción Cleexs.
            </p>
            <input
              className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="email@empresa.com"
            />
            {testMsg ? <p className="font-body-sm text-secondary">{testMsg}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTestOpen(false)} className="px-space-md py-2 rounded-lg bg-surface-container-low font-body-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void sendTest()}
                className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-sm flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                Disparar prueba
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
