'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { ReferralDashboard, ReferralRow } from '@/components/referidores/referidores-dashboard';
import {
  buildSponsorDiagnosticAppUrl,
  buildSponsorMarketingHomeUrl,
  slugifySponsorLabel,
} from '@/lib/sponsor-link';
import { syncSponsorCampaignToServer } from '@/lib/sponsor-campaign-sync';
import { patchSponsorCampaignHistory } from '@/lib/sponsor-campaign-history';
import { CLEEXS_APP_URL, formatCleexsWhatsAppPhoneDisplay } from '@/lib/site';
import { SponsorWhatsAppQrModal } from '@/components/tools/sponsor-whatsapp-qr-modal';
import './agency-stitch-scope.css';

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function shortUrlFor(refCode: string) {
  return `${CLEEXS_APP_URL.replace(/\/$/, '')}/r/${encodeURIComponent(refCode)}`;
}

/**
 * Referidos = HTML literal Stitch (campa-as-y-referidos.html) + APIs vivas.
 * Layout: banner → status → form|preview → tabla campañas (todo en una página).
 */
export function AgencyReferidosView() {
  const [summary, setSummary] = useState<ReferralDashboard | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [q, setQ] = useState('');

  const [sponsorName, setSponsorName] = useState('Revista Logística');
  const [refCode, setRefCode] = useState('revista_logistica');
  const [refTouched, setRefTouched] = useState(true);
  const [utmSource, setUtmSource] = useState('auspiciador');
  const [utmMedium, setUtmMedium] = useState('link');
  const [utmCampaign, setUtmCampaign] = useState('empliados_demo');
  const [dest, setDest] = useState<'home' | 'app'>('home');
  const [genQr, setGenQr] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRow, setCopiedRow] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [waOpen, setWaOpen] = useState(false);

  const fetcher = useCallback((path: string, init?: RequestInit) => fetch(path, { ...init, cache: 'no-store' }), []);

  const reload = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetcher('/api/borrador/portal-referrals');
      const json = await res.json().catch(() => null);
      if (res.ok && json) setSummary(json as ReferralDashboard);
    } finally {
      setLoadingSummary(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (refTouched) return;
    const slug = slugifySponsorLabel(sponsorName);
    if (slug) setRefCode(slug);
  }, [sponsorName, refTouched]);

  const linkParams = useMemo(
    () => ({
      ref: refCode,
      utmSource,
      utmMedium,
      utmCampaign: utmCampaign || undefined,
    }),
    [refCode, utmSource, utmMedium, utmCampaign]
  );

  const marketingUrl = useMemo(
    () => buildSponsorMarketingHomeUrl({ ...linkParams, baseUrl: 'https://empliados.net' }),
    [linkParams]
  );
  const appUrl = useMemo(() => buildSponsorDiagnosticAppUrl(linkParams), [linkParams]);
  const displayUrl = dest === 'home' ? marketingUrl : appUrl || marketingUrl;

  useEffect(() => {
    if (!genQr || !displayUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(displayUrl, { width: 220, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [genQr, displayUrl]);

  async function copyLink(url?: string) {
    const target = url ?? displayUrl;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  async function copyRow(row: ReferralRow) {
    try {
      await navigator.clipboard.writeText(row.targetUrl || shortUrlFor(row.refCode));
      setCopiedRow(row.refCode);
      window.setTimeout(() => setCopiedRow(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function saveCampaign() {
    if (!refCode.trim()) return;
    setSaveState('saving');
    setSaveError(null);
    patchSponsorCampaignHistory(refCode, {
      sponsorName,
      utmSource,
      utmMedium,
      utmCampaign,
      marketingUrl: marketingUrl || undefined,
      appDiagnosticUrl: appUrl ?? undefined,
    });
    const result = await syncSponsorCampaignToServer({
      refCode,
      sponsorName,
      utmSource,
      utmMedium,
      utmCampaign: utmCampaign || refCode,
    });
    if (result.ok) {
      setSaveState('saved');
      await reload();
      window.setTimeout(() => setSaveState('idle'), 2200);
    } else {
      setSaveState('error');
      setSaveError(result.error ?? 'No se pudo guardar');
    }
  }

  function resetForm() {
    setSponsorName('');
    setRefCode('');
    setRefTouched(false);
    setUtmSource('auspiciador');
    setUtmMedium('link');
    setUtmCampaign('');
    setDest('home');
    setGenQr(true);
    setSaveState('idle');
    setSaveError(null);
  }

  const rows = summary?.rows ?? [];
  const activeCampaigns = rows.filter((r) => r.registered && r.active && !r.isUnattributed).length;
  const clicks = rows.reduce((s, r) => s + (r.clicks30d || 0), 0);
  const filtered = rows.filter((r) => {
    if (r.isUnattributed) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(needle) ||
      r.refCode.toLowerCase().includes(needle) ||
      (r.utmCampaign || '').toLowerCase().includes(needle)
    );
  });

  function channelLabel(row: ReferralRow) {
    const m = (row.utmMedium || '').toLowerCase();
    if (m.includes('whatsapp') || m.includes('wa')) return { icon: 'chat', label: 'WhatsApp Direct', tone: 'text-secondary' };
    if (m.includes('qr')) return { icon: 'qr_code_scanner', label: 'QR Impreso', tone: 'text-outline' };
    if (genQr || m.includes('link')) return { icon: 'qr_code', label: 'Link + WhatsApp', tone: 'text-secondary' };
    return { icon: 'link', label: 'Link Web', tone: 'text-primary' };
  }

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-16">
      {/* Top Banner — Stitch */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-label-micro text-label-micro text-outline uppercase tracking-wider">
              Crecimiento &amp; Adquisición
            </span>
            <span className="text-outline text-xs">/</span>
            <span className="font-label-micro text-label-micro text-primary font-semibold uppercase tracking-wider">
              Referidos y Campañas
            </span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface tracking-tight">
            Campañas y Tracking de Referidos
          </h1>
          <p className="font-body-default text-body-default text-on-surface-variant max-w-3xl">
            Generá links web enriquecidos, códigos QR inteligentes y enlaces a WhatsApp con atribución directa. Medí
            conversiones y demos solicitadas para Empliados en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <div className="flex items-center gap-space-sm px-space-md py-2 rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[18px]">campaign</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-micro text-label-micro text-outline">Campañas Activas</span>
              <span className="font-headline-title text-body-medium font-bold text-on-surface">
                {loadingSummary ? '…' : fmt(activeCampaigns)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm px-space-md py-2 rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-secondary-container/40 flex items-center justify-center text-on-secondary-container">
              <span className="material-symbols-outlined text-[18px]">ads_click</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-micro text-label-micro text-outline">Clics del Mes</span>
              <span className="font-headline-title text-body-medium font-bold text-on-surface">
                {loadingSummary ? '…' : fmt(clicks)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar — Stitch */}
      <div className="flex items-center gap-space-sm px-space-md py-2.5 rounded-xl bg-surface-container-low text-on-surface-variant shadow-sm">
        <span className="material-symbols-outlined text-secondary text-[20px]">verified_user</span>
        <span className="font-body-sm text-body-sm flex-1">
          <strong className="font-semibold text-on-surface">Atribución Automática:</strong> Las campañas y códigos de
          referidos alimentan en vivo el ranking del portal y se sincronizan con los funnels de conversión y Hub LLM.
        </span>
        <span className="font-label-micro text-label-micro bg-surface-container-lowest text-secondary px-space-sm py-0.5 rounded-full font-semibold">
          Live Tracker v2.4
        </span>
      </div>

      {/* Form | Preview — Stitch 7/5 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <div className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">add_link</span>
                </div>
                <div className="flex flex-col">
                  <h2 className="font-headline-title text-body-medium font-bold text-on-surface">
                    Nueva Campaña / Auspiciador
                  </h2>
                  <p className="font-body-sm text-body-sm text-outline">
                    Configurá parámetros UTM e identificador de referencia
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center gap-1 text-outline hover:text-on-surface font-label-micro text-label-micro transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                <span>Limpiar</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-md">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-micro text-label-micro text-on-surface font-semibold uppercase tracking-wider flex items-center justify-between">
                  <span>Nombre del Auspiciador / Partner</span>
                  <span className="text-outline font-normal lowercase">Sugerencia en tiempo real</span>
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">corporate_fare</span>
                  <input
                    className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low font-body-default text-body-default text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="Ej: Cámara Argentina de Comercio, Expo Transporte..."
                    value={sponsorName}
                    onChange={(e) => {
                      setSponsorName(e.target.value);
                      if (!refTouched) setRefCode(slugifySponsorLabel(e.target.value));
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-micro text-label-micro text-on-surface font-semibold uppercase tracking-wider flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span>Código Ref Único</span>
                    <span className="text-error font-bold">*</span>
                  </div>
                  {refCode ? (
                    <span className="text-secondary font-semibold text-[11px] flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span> Código disponible
                    </span>
                  ) : null}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">tag</span>
                  <input
                    className="w-full pl-10 pr-space-md py-2.5 rounded-lg bg-surface-container-low font-metric-tabular text-body-sm text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="ej: revista_logistica"
                    value={refCode}
                    onChange={(e) => {
                      setRefTouched(true);
                      setRefCode(e.target.value);
                    }}
                  />
                </div>
                <p className="font-body-sm text-[12px] text-outline">
                  Letras minúsculas, números, guión y guión bajo. Se autogenera al tipear el nombre.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm pt-1">
                {(
                  [
                    ['UTM Source', utmSource, setUtmSource],
                    ['UTM Medium', utmMedium, setUtmMedium],
                    ['UTM Campaign', utmCampaign, setUtmCampaign],
                  ] as const
                ).map(([label, value, setter]) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <label className="font-label-micro text-label-micro text-on-surface font-semibold uppercase tracking-wider">
                      {label}
                    </label>
                    <input
                      className="w-full px-space-sm py-2 rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary outline-none transition-all"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <span className="font-label-micro text-label-micro text-on-surface font-semibold uppercase tracking-wider">
                  Destino del Enlace
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                  <label
                    className={`cursor-pointer flex items-center justify-between p-3 rounded-lg transition-colors ${
                      dest === 'home' ? 'bg-primary-fixed/30' : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="destinationTarget"
                        checked={dest === 'home'}
                        onChange={() => setDest('home')}
                        className="text-primary focus:ring-primary"
                      />
                      <div className="flex flex-col">
                        <span className="font-body-medium text-body-sm font-semibold text-on-surface">
                          Home con Landing Ref
                        </span>
                        <span className="font-body-sm text-[11px] text-on-surface-variant">
                          home de empliados.net/?ref=...
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-primary text-[18px]">home</span>
                  </label>
                  <label
                    className={`cursor-pointer flex items-center justify-between p-3 rounded-lg transition-colors ${
                      dest === 'app' ? 'bg-primary-fixed/30' : 'bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="destinationTarget"
                        checked={dest === 'app'}
                        onChange={() => setDest('app')}
                        className="text-primary focus:ring-primary"
                      />
                      <div className="flex flex-col">
                        <span className="font-body-medium text-body-sm font-semibold text-on-surface">
                          Diagnóstico Directo (App)
                        </span>
                        <span className="font-body-sm text-[11px] text-on-surface-variant">
                          app.cleexs.net/diagnostico/...
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-primary text-[18px]">speed</span>
                  </label>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={genQr}
                  onChange={(e) => setGenQr(e.target.checked)}
                  className="text-primary focus:ring-primary"
                />
                <span className="font-body-sm text-body-sm text-on-surface flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px] text-primary">qr_code_2</span>
                  Generar código QR dinámico
                </span>
              </label>

              {saveError ? <p className="font-body-sm text-error">{saveError}</p> : null}
              {saveState === 'saved' ? (
                <p className="font-body-sm text-secondary">Campaña guardada en el ranking.</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right: Live link + WhatsApp QR — Stitch */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center gap-space-sm">
              <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[20px]">link</span>
              </div>
              <div>
                <h3 className="font-headline-title text-body-medium font-bold text-on-surface">Link en vivo</h3>
                <p className="font-body-sm text-body-sm text-outline">Listo para publicar</p>
              </div>
            </div>
            <div className="rounded-lg bg-surface-container-low p-space-md break-all font-metric-tabular text-[12px] text-on-surface select-all">
              {displayUrl || '—'}
            </div>
            <div className="flex flex-wrap gap-space-sm">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="flex items-center gap-1 px-space-md py-space-sm rounded-lg bg-surface-container-high text-on-surface font-body-medium text-body-sm"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
              <button
                type="button"
                onClick={() => void saveCampaign()}
                disabled={saveState === 'saving' || !refCode.trim()}
                className="flex items-center gap-1 px-space-md py-space-sm rounded-lg bg-primary text-on-primary font-body-medium text-body-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                {saveState === 'saving' ? 'Guardando…' : 'Guardar'}
              </button>
              {displayUrl ? (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-space-md py-space-sm rounded-lg bg-surface-container-low text-on-surface font-body-medium text-body-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  Abrir
                </a>
              ) : null}
            </div>
          </div>

          <div
            className={`rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md ${
              genQr ? '' : 'opacity-50 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-space-sm">
              <div className="w-9 h-9 rounded-lg bg-secondary-container/40 flex items-center justify-center text-on-secondary-container">
                <span className="material-symbols-outlined text-[15px]">chat</span>
              </div>
              <div>
                <h3 className="font-headline-title text-body-medium font-bold text-on-surface">
                  WhatsApp &amp; QR Dinámico
                </h3>
                <p className="font-body-sm text-body-sm text-outline">{formatCleexsWhatsAppPhoneDisplay()}</p>
              </div>
            </div>
            {genQr && qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR campaña" className="mx-auto h-40 w-40 rounded-lg bg-white p-2 shadow-sm" />
            ) : (
              <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-lg bg-surface-container-low text-outline font-body-sm">
                QR off
              </div>
            )}
            <div className="flex flex-wrap gap-space-sm justify-center">
              {qrDataUrl ? (
                <a
                  href={qrDataUrl}
                  download={`qr-${refCode || 'campaña'}.png`}
                  className="flex items-center gap-1 px-space-md py-space-sm rounded-lg bg-surface-container-high text-on-surface font-body-medium text-body-sm"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Descargar QR
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setWaOpen(true)}
                className="flex items-center justify-center gap-1 px-space-md py-space-sm rounded-lg bg-secondary text-on-secondary font-body-medium text-body-sm"
              >
                <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                Generar QR WhatsApp
              </button>
            </div>
            <p className="font-body-sm text-[12px] text-outline text-center">
              <span className="text-secondary font-semibold">Trazabilidad WhatsApp Activa</span>
            </p>
          </div>
        </div>
      </div>

      {/* Campañas Activas table — Stitch */}
      <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-9 h-9 rounded-lg bg-primary-fixed flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">analytics</span>
            </div>
            <div>
              <h3 className="font-headline-title text-headline-title font-bold text-on-surface">
                Campañas Activas &amp; Rendimiento
              </h3>
              <p className="font-body-sm text-body-sm text-outline">
                Control de tráfico, escaneos QR y diagnósticos concluidos por auspiciador
              </p>
            </div>
          </div>
          <div className="flex items-center gap-space-sm flex-wrap">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-outline text-[18px]">search</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar campaña…"
                className="pl-10 pr-space-md py-2 rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary w-44"
              />
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="px-space-sm py-1 rounded-md text-on-surface-variant hover:text-on-surface font-label-micro text-label-micro flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Actualizar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low text-outline font-label-micro text-label-micro uppercase tracking-wider">
                <th className="py-3 px-space-md rounded-l-lg">Auspiciador / Partner</th>
                <th className="py-3 px-space-md">Canal</th>
                <th className="py-3 px-space-md text-right">Clics 30d</th>
                <th className="py-3 px-space-md text-right">Diagnósticos</th>
                <th className="py-3 px-space-md text-right">Emails</th>
                <th className="py-3 px-space-md text-right">Conv.</th>
                <th className="py-3 px-space-md rounded-r-lg text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {loadingSummary ? (
                <tr>
                  <td colSpan={7} className="py-8 px-space-md text-center text-outline font-body-sm">
                    Cargando campañas…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-space-md text-center text-outline font-body-sm">
                    No hay campañas todavía. Guardá una arriba para verla acá.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const ch = channelLabel(row);
                  return (
                    <tr key={row.refCode} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-space-md">
                        <div className="flex flex-col">
                          <span className="font-body-medium text-body-sm font-semibold text-on-surface">{row.name}</span>
                          <span className="font-metric-tabular text-[11px] text-outline">ref={row.refCode}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className={`flex items-center gap-1 ${ch.tone}`}>
                          <span className="material-symbols-outlined text-[16px]">{ch.icon}</span>
                          <span className="font-body-sm">{ch.label}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md text-right font-metric-tabular text-body-sm text-on-surface">
                        {fmt(row.clicks30d)}
                      </td>
                      <td className="py-3.5 px-space-md text-right font-metric-tabular text-body-sm text-on-surface">
                        {fmt(row.completedDiagnostics)}
                      </td>
                      <td className="py-3.5 px-space-md text-right font-metric-tabular text-body-sm text-on-surface">
                        {fmt(row.uniqueEmails)}
                      </td>
                      <td className="py-3.5 px-space-md text-right">
                        <span className="inline-flex items-center gap-0.5 text-secondary font-badge-label text-badge-label">
                          <span className="material-symbols-outlined text-[14px]">trending_up</span>
                          {row.completionRate.toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Copiar link"
                            onClick={() => void copyRow(row)}
                            className="p-1.5 rounded-md text-outline hover:text-on-surface hover:bg-surface-container"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {copiedRow === row.refCode ? 'check' : 'content_copy'}
                            </span>
                          </button>
                          <a
                            href={row.targetUrl || shortUrlFor(row.refCode)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-md text-outline hover:text-on-surface hover:bg-surface-container"
                            title="Abrir"
                          >
                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SponsorWhatsAppQrModal
        open={waOpen}
        onClose={() => setWaOpen(false)}
        sponsorName={sponsorName || refCode}
        refCode={refCode}
      />
    </div>
  );
}
