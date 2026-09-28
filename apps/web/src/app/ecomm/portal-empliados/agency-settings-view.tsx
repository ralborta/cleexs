'use client';

import { useCallback, useEffect, useState } from 'react';
import './agency-stitch-scope.css';

type Tab = 'integraciones' | 'marca' | 'competidores' | 'alertas';

type PortalSettings = {
  integrations: {
    wordpress: { enabled: boolean; url: string };
    ga4: { enabled: boolean };
    gsc: { enabled: boolean };
    shopify: { enabled: boolean };
    resend: { enabled: boolean };
  };
};

const INTEGRATION_META: Array<{
  name: string;
  key: keyof PortalSettings['integrations'] | 'hubspot' | 'whatsapp' | 'tms';
  icon: string;
  blurb: string;
}> = [
  { name: 'CRM / HubSpot', key: 'hubspot', icon: 'hub', blurb: 'Leads y deals sincronizados al portal.' },
  { name: 'Resend · Email Transaccional', key: 'resend', icon: 'mail', blurb: 'Secuencias post-demo y webhooks.' },
  { name: 'WhatsApp Business Cloud API', key: 'whatsapp', icon: 'chat', blurb: 'Click-to-chat y QR de referidos.' },
  { name: 'Google Analytics 4 (GA4)', key: 'ga4', icon: 'analytics', blurb: 'Tráfico y conversiones.' },
  { name: 'Google Search Console', key: 'gsc', icon: 'travel_explore', blurb: 'Indexación y queries.' },
  { name: 'WordPress / Headless CMS', key: 'wordpress', icon: 'language', blurb: 'Home Empliados + atribución ref.' },
  { name: 'TMS / ERP Logístico Cliente', key: 'tms', icon: 'local_shipping', blurb: 'Próxima integración operativa.' },
];

/**
 * Config = HTML Stitch (configuraci-n-e-integraciones.html) + API portal-brand.
 */
export function AgencySettingsView() {
  const [tab, setTab] = useState<Tab>('integraciones');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandForm, setBrandForm] = useState({
    name: 'Empliados',
    industry: 'Agentes de IA para logística',
    country: 'Argentina',
    description:
      'SOL · Sistema Operativo de Logística. Agentes de IA preconfigurados para pymes de transporte y logística.',
    objective: 'Ser la marca #1 en prompts de agentes IA logística en Latam',
    runSchedule: 'semanal' as '' | 'semanal' | 'quincenal' | 'mensual',
  });
  const [competitors, setCompetitors] = useState([
    { name: 'Beetrack', domain: 'beetrack.com' },
    { name: 'Enviame', domain: 'enviame.io' },
    { name: 'Melonn', domain: 'melonn.com' },
    { name: 'project44', domain: 'project44.com' },
    { name: 'FourKites', domain: 'fourkites.com' },
  ]);
  const [settings, setSettings] = useState<PortalSettings | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/borrador/portal-brand?domain=empliados.net', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) return;
      setBrandId(json.brand?.id ?? null);
      if (json.brand) {
        setBrandForm({
          name: json.brand.name || 'Empliados',
          industry: json.brand.industry || 'Agentes de IA para logística',
          country: json.brand.country || 'Argentina',
          description:
            json.brand.description ||
            'SOL · Sistema Operativo de Logística. Agentes de IA preconfigurados para pymes de transporte y logística.',
          objective: json.brand.objective || 'Ser la marca #1 en prompts de agentes IA logística en Latam',
          runSchedule: json.brand.runSchedule || 'semanal',
        });
      }
      if (json.competitors?.length) {
        setCompetitors(
          json.competitors.map((c: { name: string; domain: string | null }) => ({
            name: c.name,
            domain: c.domain || '',
          }))
        );
      }
      if (json.settings) setSettings(json.settings);
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(payload: Record<string, unknown>) {
    setSaving(true);
    setSaveMsg(null);
    setSaveErr(null);
    try {
      const res = await fetch('/api/borrador/portal-brand?domain=empliados.net', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaveMsg('Guardado');
      await load();
      window.setTimeout(() => setSaveMsg(null), 2000);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function statusOf(key: (typeof INTEGRATION_META)[number]['key']): string {
    if (key === 'hubspot' || key === 'whatsapp') return 'Conectado';
    if (key === 'tms') return 'Próximo';
    const enabled = settings?.integrations?.[key as keyof PortalSettings['integrations']]?.enabled;
    if (key === 'resend') return enabled === false ? 'Pendiente' : 'Conectado';
    return enabled ? 'Conectado' : 'Pendiente';
  }

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-16">
      <div>
        <span className="font-label-micro text-label-micro text-primary uppercase font-bold tracking-wider">
          Sistema
        </span>
        <h1 className="font-headline-title text-headline-title text-on-surface font-bold tracking-tight">
          Configuración &amp; Conexiones del Ecosistema
        </h1>
        <p className="font-body-default text-body-sm text-on-surface-variant max-w-3xl">
          Integraciones, marca Empliados, competidores y alertas · datos vivos vía portal-brand.
        </p>
      </div>

      {(saveMsg || saveErr) && (
        <div
          className={`px-space-md py-2 rounded-xl font-body-sm ${
            saveErr ? 'bg-error-container text-on-error-container' : 'bg-secondary-container/30 text-on-secondary-container'
          }`}
        >
          {saveErr || saveMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['integraciones', 'Integraciones'],
            ['marca', 'Marca'],
            ['competidores', 'Competidores'],
            ['alertas', 'Alertas'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={
              tab === id
                ? 'px-space-md py-1.5 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm font-semibold shadow-sm'
                : 'px-space-md py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-body-medium text-body-sm'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'integraciones' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          {INTEGRATION_META.map((it) => {
            const st = statusOf(it.key);
            return (
              <div key={it.name} className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-space-sm">
                    <div className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[20px]">{it.icon}</span>
                    </div>
                    <span className="font-headline-title text-body-medium font-bold text-on-surface">{it.name}</span>
                  </div>
                  <span
                    className={
                      st === 'Conectado'
                        ? 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container font-semibold'
                        : st === 'Próximo'
                          ? 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-surface-container text-outline font-semibold'
                          : 'font-label-micro text-[11px] px-2 py-0.5 rounded-full bg-tertiary-fixed/50 text-tertiary font-semibold'
                    }
                  >
                    {st}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-outline">{it.blurb}</p>
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === 'marca' ? (
        <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md max-w-3xl">
          {(
            [
              ['name', 'Nombre'],
              ['industry', 'Industria'],
              ['country', 'País'],
              ['description', 'Descripción'],
              ['objective', 'Objetivo'],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
                {label}
              </label>
              {key === 'description' || key === 'objective' ? (
                <textarea
                  rows={3}
                  className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none resize-none font-body-sm"
                  value={brandForm[key]}
                  onChange={(e) => setBrandForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              ) : (
                <input
                  className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none"
                  value={brandForm[key]}
                  onChange={(e) => setBrandForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              )}
            </div>
          ))}
          <div>
            <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
              Frecuencia SOV
            </label>
            <select
              className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none cursor-pointer"
              value={brandForm.runSchedule}
              onChange={(e) =>
                setBrandForm((f) => ({
                  ...f,
                  runSchedule: e.target.value as typeof brandForm.runSchedule,
                }))
              }
            >
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              void save({
                brandId,
                brand: brandForm,
              })
            }
            className="self-start px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar marca'}
          </button>
        </div>
      ) : null}

      {tab === 'competidores' ? (
        <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
          {competitors.map((c, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
              <input
                className="bg-surface-container-low px-space-md py-2 rounded-lg outline-none"
                value={c.name}
                onChange={(e) => {
                  const next = [...competitors];
                  next[idx] = { ...c, name: e.target.value };
                  setCompetitors(next);
                }}
                placeholder="Nombre"
              />
              <input
                className="bg-surface-container-low px-space-md py-2 rounded-lg outline-none"
                value={c.domain}
                onChange={(e) => {
                  const next = [...competitors];
                  next[idx] = { ...c, domain: e.target.value };
                  setCompetitors(next);
                }}
                placeholder="dominio.com"
              />
            </div>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={() => void save({ brandId, competitors })}
            className="self-start px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar competidores'}
          </button>
        </div>
      ) : null}

      {tab === 'alertas' ? (
        <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-sm max-w-xl">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Alertas de caída de SOV, fallas de webhook Resend y gaps de indexación (config demo).
          </p>
          {['Caída SOV > 2 pp', 'Webhook Resend con errores', 'FAQ sin schema FAQPage'].map((a) => (
            <label key={a} className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low cursor-pointer">
              <span className="font-body-sm text-body-sm text-on-surface">{a}</span>
              <input type="checkbox" defaultChecked className="text-primary" />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
