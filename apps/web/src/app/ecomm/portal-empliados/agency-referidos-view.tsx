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

type ChannelFilter = 'todos' | 'web' | 'wa';

function fmt(n: number) {
  return n.toLocaleString('es-AR');
}

function shortUrlFor(refCode: string) {
  return `${CLEEXS_APP_URL.replace(/\/$/, '')}/r/${encodeURIComponent(refCode)}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function stitchWaMessage(sponsor: string, ref: string) {
  const s = sponsor.trim() || 'nuestro partner';
  const r = ref.trim() || 'ref';
  return `Hola! Vengo de parte de ${s} [ref: ${r}]. Quiero conocer la visibilidad de mi empresa en ChatGPT y motores de IA.`;
}

function channelOf(row: ReferralRow): { filter: ChannelFilter; icon: string; label: string; tone: string } {
  const m = `${row.utmMedium || ''} ${row.utmSource || ''}`.toLowerCase();
  if (m.includes('whatsapp') || m.includes('wa') || m.includes('qr')) {
    if (m.includes('print') || m.includes('impres')) {
      return { filter: 'wa', icon: 'qr_code_scanner', label: 'QR Impreso', tone: 'text-outline' };
    }
    return { filter: 'wa', icon: 'qr_code', label: 'Link + WhatsApp', tone: 'text-secondary' };
  }
  if (m.includes('landing') || m.includes('home')) {
    return { filter: 'web', icon: 'link', label: 'Landing Directa', tone: 'text-primary' };
  }
  return { filter: 'web', icon: 'link', label: 'Web Links', tone: 'text-primary' };
}

/**
 * Port fiel del HTML Stitch campa-as-y-referidos.html + datos vivos.
 */
export function AgencyReferidosView() {
  const [summary, setSummary] = useState<ReferralDashboard | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [q, setQ] = useState('');
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('todos');

  const [sponsorName, setSponsorName] = useState('Revista Logística');
  const [refCode, setRefCode] = useState('revista_logistica');
  const [refTouched, setRefTouched] = useState(true);
  const [utmSource, setUtmSource] = useState('auspiciador');
  const [utmMedium, setUtmMedium] = useState('link');
  const [utmCampaign, setUtmCampaign] = useState('empliados_demo');
  const [dest, setDest] = useState<'home' | 'app'>('home');
  const [genQr, setGenQr] = useState(true);
  const [waMessage, setWaMessage] = useState(() => stitchWaMessage('Revista Logística', 'revista_logistica'));
  const [waTouched, setWaTouched] = useState(false);
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

  useEffect(() => {
    if (waTouched) return;
    setWaMessage(stitchWaMessage(sponsorName, refCode));
  }, [sponsorName, refCode, waTouched]);

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
    void QRCode.toDataURL(displayUrl, { width: 240, margin: 1, color: { dark: '#131b2e', light: '#ffffff' } })
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
    if (marketingUrl) {
      patchSponsorCampaignHistory(refCode, {
        sponsorName,
        utmSource,
        utmMedium,
        utmCampaign,
        marketingUrl,
        appDiagnosticUrl: appUrl ?? undefined,
      });
    }
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
    setWaTouched(false);
    setWaMessage(stitchWaMessage('', ''));
    setSaveState('idle');
    setSaveError(null);
  }

  function exportCsv() {
    const rows = filtered;
    const header = [
      'name',
      'refCode',
      'channel',
      'clicks30d',
      'diagnosticsStarted',
      'completionRate',
      'active',
      'targetUrl',
    ];
    const lines = [
      header.join(','),
      ...rows.map((r) => {
        const ch = channelOf(r);
        return [
          csv(r.name),
          csv(r.refCode),
          csv(ch.label),
          r.clicks30d,
          r.diagnosticsStarted,
          r.completionRate,
          r.active ? 'activa' : 'pausada',
          csv(r.targetUrl || shortUrlFor(r.refCode)),
        ].join(',');
      }),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `campañas-referidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function csv(v: string) {
    return `"${String(v).replace(/"/g, '""')}"`;
  }

  const rows = summary?.rows ?? [];
  const ranked = rows.filter((r) => !r.isUnattributed);
  const activeCampaigns = ranked.filter((r) => r.registered && r.active).length;
  const clicks = ranked.reduce((s, r) => s + (r.clicks30d || 0), 0);
  const webCount = ranked.filter((r) => channelOf(r).filter === 'web').length;
  const waCount = ranked.filter((r) => channelOf(r).filter === 'wa').length;

  const filtered = ranked.filter((r) => {
    if (channelFilter !== 'todos' && channelOf(r).filter !== channelFilter) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      r.name.toLowerCase().includes(needle) ||
      r.refCode.toLowerCase().includes(needle) ||
      (r.utmCampaign || '').toLowerCase().includes(needle) ||
      (r.notes || '').toLowerCase().includes(needle)
    );
  });

  const avatarTones = [
    'bg-primary-fixed text-on-primary-fixed',
    'bg-secondary-fixed text-on-secondary-fixed',
    'bg-tertiary-fixed text-on-tertiary-fixed',
    'bg-surface-container-high text-primary',
  ];

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

      {/* Status — Stitch */}
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

      {/* Form | Preview — Stitch 7 / 5 */}
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
                    <span className="text-secondary font-semibold text-[11px] flex items-center gap-1 uppercase tracking-wider">
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
                    <span
                      className={`material-symbols-outlined text-[18px] ${
                        dest === 'app' ? 'text-primary' : 'text-outline'
                      }`}
                    >
                      speed
                    </span>
                  </label>
                </div>
              </div>

              {/* Toggle QR — Stitch */}
              <div className="flex items-center justify-between p-space-md rounded-xl bg-surface-container-low mt-2">
                <div className="flex items-center gap-space-sm">
                  <div className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                    <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-body-medium text-body-sm font-semibold text-on-surface">
                      Generar código QR dinámico
                    </span>
                    <span className="font-body-sm text-[12px] text-on-surface-variant">
                      Habilita descarga SVG en alta resolución y trazabilidad de escaneos offline
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={genQr}
                    onChange={(e) => setGenQr(e.target.checked)}
                  />
                  <div className="w-11 h-6 rounded-full" />
                </label>
              </div>

              {saveError ? <p className="font-body-sm text-error">{saveError}</p> : null}
              {saveState === 'saved' ? (
                <p className="font-body-sm text-secondary">Campaña guardada en el ranking.</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right column — Stitch */}
        <div className="lg:col-span-5 flex flex-col gap-space-md">
          <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">link</span>
                <span className="font-headline-title text-body-medium font-bold text-on-surface">
                  Enlace para Compartir
                </span>
              </div>
              <span className="font-label-micro text-[11px] bg-secondary-container/40 text-on-secondary-container px-2 py-0.5 rounded font-semibold">
                Listo para publicar
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Lleva a la <strong className="text-on-surface">landing de Empliados</strong>. El script de atribución
              preserva el ref cuando el visitante inicia el diagnóstico de visibilidad de marca.
            </p>
            <div className="relative bg-surface-container-low rounded-lg p-3 font-metric-tabular text-body-sm text-on-surface break-all select-all flex items-start gap-2">
              <span className="material-symbols-outlined text-outline text-[16px] shrink-0 mt-0.5">open_in_browser</span>
              <span className="font-mono text-[12px] leading-relaxed text-on-surface">{displayUrl || '—'}</span>
            </div>
            <div className="flex items-center gap-space-sm pt-1">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-space-md rounded-lg bg-primary text-on-primary font-body-medium text-body-sm font-semibold shadow-sm hover:bg-primary-container transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                <span>{copied ? 'Copiado' : 'Copiar link'}</span>
              </button>
              <button
                type="button"
                onClick={() => void saveCampaign()}
                disabled={saveState === 'saving' || !refCode.trim()}
                className="flex items-center justify-center gap-1.5 py-2.5 px-space-md rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container font-body-medium text-body-sm font-semibold transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
                <span>{saveState === 'saving' ? '…' : 'Guardar'}</span>
              </button>
              {displayUrl ? (
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Probar en nueva pestaña"
                  className="flex items-center justify-center p-2.5 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                </a>
              ) : null}
            </div>
          </div>

          <div
            className={`rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md ${
              genQr ? '' : 'opacity-50 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-secondary-container/40 flex items-center justify-center text-on-secondary-container">
                  <span className="material-symbols-outlined text-[15px]">chat</span>
                </div>
                <span className="font-headline-title text-body-medium font-bold text-on-surface">
                  WhatsApp &amp; QR Dinámico
                </span>
              </div>
              <span className="font-label-micro text-label-micro text-outline">
                {formatCleexsWhatsAppPhoneDisplay()}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-space-md items-center">
              <div className="relative shrink-0 p-3 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col items-center gap-2">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR campaña" className="w-32 h-32 rounded-lg bg-white" />
                ) : (
                  <div className="w-32 h-32 rounded-lg bg-surface-container-low flex items-center justify-center text-outline font-body-sm">
                    QR
                  </div>
                )}
                {qrDataUrl ? (
                  <a
                    href={qrDataUrl}
                    download={`qr-${refCode || 'campaña'}.png`}
                    className="flex items-center gap-1 font-label-micro text-label-micro text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    <span>Descargar SVG</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setWaOpen(true)}
                    className="flex items-center gap-1 font-label-micro text-label-micro text-primary"
                  >
                    <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                    Generar QR WA
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2 flex-1 w-full">
                <label className="font-label-micro text-label-micro text-on-surface-variant uppercase tracking-wider">
                  Mensaje preconfigurado al escanear:
                </label>
                <textarea
                  rows={3}
                  value={waMessage}
                  onChange={(e) => {
                    setWaTouched(true);
                    setWaMessage(e.target.value);
                  }}
                  className="w-full p-2.5 rounded-lg bg-surface-container-low font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary outline-none transition-all resize-none"
                />
                <div className="flex items-center justify-between text-outline text-[11px] font-label-micro">
                  <span>
                    Variables: <code className="text-primary font-mono">{'{auspiciador}'}</code>,{' '}
                    <code className="text-primary font-mono">{'{ref}'}</code>
                  </span>
                  <span className="text-secondary font-semibold">Trazabilidad WhatsApp Activa</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table — Stitch */}
      <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md mt-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="w-9 h-9 rounded-lg bg-secondary-container/40 flex items-center justify-center text-on-secondary-container">
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
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="relative flex items-center bg-surface-container-low rounded-lg px-2.5 py-1.5">
              <span className="material-symbols-outlined text-outline text-[18px] mr-1.5">search</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por partner o código..."
                className="bg-transparent border-none outline-none font-body-default text-body-sm text-on-surface placeholder:text-outline w-44 md:w-56"
              />
            </div>
            <div className="flex items-center bg-surface-container-low rounded-lg p-1 gap-1">
              {(
                [
                  ['todos', `Todos (${ranked.length})`],
                  ['web', `Web Links`],
                  ['wa', `WhatsApp QR`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChannelFilter(key)}
                  className={
                    channelFilter === key
                      ? 'px-space-sm py-1 rounded-md bg-surface-container-lowest text-on-surface font-label-micro text-label-micro shadow-sm'
                      : 'px-space-sm py-1 rounded-md text-on-surface-variant hover:text-on-surface font-label-micro text-label-micro'
                  }
                >
                  {key === 'web' ? `${label}${webCount ? ` (${webCount})` : ''}` : key === 'wa' ? `${label}${waCount ? ` (${waCount})` : ''}` : label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-space-sm py-1.5 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container text-body-sm font-label-micro transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-outline font-label-micro text-label-micro uppercase tracking-wider rounded-lg">
                <th className="py-3 px-space-md rounded-l-lg">Auspiciador / Partner</th>
                <th className="py-3 px-space-md">Código Ref</th>
                <th className="py-3 px-space-md">Canal / Medio</th>
                <th className="py-3 px-space-md text-right">Clics / Escaneos</th>
                <th className="py-3 px-space-md text-right">Demos Iniciadas</th>
                <th className="py-3 px-space-md text-right">Conversión</th>
                <th className="py-3 px-space-md text-center">Estado</th>
                <th className="py-3 px-space-md text-right rounded-r-lg">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-default text-body-sm text-on-surface">
              {loadingSummary ? (
                <tr>
                  <td colSpan={8} className="py-8 px-space-md text-center text-outline">
                    Cargando campañas…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-space-md text-center text-outline">
                    No hay campañas todavía. Guardá una arriba para verla acá.
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const ch = channelOf(row);
                  const tone = avatarTones[idx % avatarTones.length]!;
                  return (
                    <tr key={row.refCode} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-space-md">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${tone}`}
                          >
                            {initials(row.name || row.refCode)}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-body-medium font-semibold text-on-surface">{row.name}</span>
                            <span className="font-body-sm text-[11px] text-outline">
                              {row.utmCampaign || row.notes || row.utmSource || '—'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className="font-mono text-[12px] bg-surface-container px-2 py-0.5 rounded text-primary font-semibold">
                          {row.refCode}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <div className={`flex items-center gap-1.5 text-on-surface-variant`}>
                          <span className={`material-symbols-outlined text-[16px] ${ch.tone}`}>{ch.icon}</span>
                          <span className="font-body-sm">{ch.label}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md text-right font-metric-tabular font-semibold">
                        {fmt(row.clicks30d)}
                      </td>
                      <td className="py-3.5 px-space-md text-right font-metric-tabular text-on-surface font-semibold">
                        {fmt(row.diagnosticsStarted)}
                      </td>
                      <td className="py-3.5 px-space-md text-right">
                        <div className="inline-flex items-center gap-1 font-metric-tabular text-secondary font-bold">
                          <span>{row.completionRate.toFixed(2)}%</span>
                          <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md text-center">
                        {row.active ? (
                          <span className="font-label-micro text-[11px] bg-secondary-container/40 text-on-secondary-container px-2.5 py-1 rounded-full font-semibold">
                            Activa
                          </span>
                        ) : (
                          <span className="font-label-micro text-[11px] bg-surface-container text-outline px-2.5 py-1 rounded-full font-semibold">
                            Pausada
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-space-md text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Copiar Enlace"
                            onClick={() => void copyRow(row)}
                            className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              {copiedRow === row.refCode ? 'check' : 'content_copy'}
                            </span>
                          </button>
                          <a
                            href={row.targetUrl || shortUrlFor(row.refCode)}
                            target="_blank"
                            rel="noreferrer"
                            title="Ver Analítica"
                            className="p-1 rounded text-outline hover:text-primary hover:bg-surface-container transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">insights</span>
                          </a>
                          <button
                            type="button"
                            title="Opciones"
                            className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                          </button>
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
        initialCustomMessage={waMessage}
      />
    </div>
  );
}
