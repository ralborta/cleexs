'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import { CLEEXS_APP_URL, formatCleexsWhatsAppPhoneDisplay } from '@/lib/site';
import {
  buildSponsorDiagnosticAppUrl,
  buildSponsorMarketingHomeUrl,
  slugifySponsorLabel,
} from '@/lib/sponsor-link';
import { SponsorCampaignHistoryPanel } from '@/components/tools/sponsor-campaign-history-panel';
import { SponsorTrackingPanel } from '@/components/tools/sponsor-tracking-panel';
import { SponsorWhatsAppQrModal } from '@/components/tools/sponsor-whatsapp-qr-modal';
import { patchSponsorCampaignHistory } from '@/lib/sponsor-campaign-history';
import { syncSponsorCampaignToServer, migrateRecentLocalSponsorCampaignsToServer } from '@/lib/sponsor-campaign-sync';
import { Check, Copy, Download, ExternalLink, Link2, Loader2, MessageCircle, QrCode, Save } from 'lucide-react';

const fieldCls =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25';
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

export function SponsorLinkBuilder() {
  const [sponsorName, setSponsorName] = useState('');
  const [refCode, setRefCode] = useState('');
  const [refTouched, setRefTouched] = useState(false);
  const [utmSource, setUtmSource] = useState('auspiciador');
  const [utmMedium, setUtmMedium] = useState('link');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [waQrOpen, setWaQrOpen] = useState(false);
  const [waInitialMessage, setWaInitialMessage] = useState<string | undefined>();
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [migrationNote, setMigrationNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void migrateRecentLocalSponsorCampaignsToServer({ maxAgeDays: 21 }).then((result) => {
      if (cancelled) return;
      if (result.migrated > 0) {
        setMigrationNote(
          `Migramos ${result.migrated} campaña${result.migrated === 1 ? '' : 's'} del historial local al servidor.`
        );
        setHistoryRefresh((n) => n + 1);
      } else if (result.errors.length > 0) {
        setMigrationNote(result.errors[0] ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const generatedUrl = useMemo(() => buildSponsorMarketingHomeUrl(linkParams), [linkParams]);
  const appDiagnosticUrl = useMemo(() => buildSponsorDiagnosticAppUrl(linkParams), [linkParams]);

  const refValid = Boolean(generatedUrl);

  useEffect(() => {
    if (!showQr || !generatedUrl) {
      setQrDataUrl(null);
      setQrError(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(generatedUrl, {
      width: 280,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          setQrError('No pudimos generar el QR. Probá de nuevo.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showQr, generatedUrl]);

  const persistCampaign = useCallback(
    async (patch: {
      whatsAppUrl?: string | null;
      whatsAppMessage?: string | null;
      customWaMessage?: string | null;
      syncToServer?: boolean;
    }) => {
      if (!generatedUrl || !refCode.trim()) return;
      patchSponsorCampaignHistory(refCode, {
        sponsorName,
        utmSource,
        utmMedium,
        utmCampaign,
        marketingUrl: generatedUrl,
        appDiagnosticUrl: appDiagnosticUrl ?? null,
        whatsAppUrl: patch.whatsAppUrl,
        whatsAppMessage: patch.whatsAppMessage,
        whatsAppCustomMessage: patch.customWaMessage,
      });
      setHistoryRefresh((n) => n + 1);

      if (patch.syncToServer === false) return;

      setSaveState('saving');
      setSaveError(null);
      const result = await syncSponsorCampaignToServer({
        refCode,
        sponsorName,
        utmSource,
        utmMedium,
        utmCampaign: utmCampaign || refCode,
      });
      if (result.ok) {
        setSaveState('saved');
        setHistoryRefresh((n) => n + 1);
        window.setTimeout(() => setSaveState('idle'), 2500);
      } else {
        setSaveState('error');
        setSaveError(result.error ?? 'No se pudo guardar');
      }
    },
    [generatedUrl, refCode, sponsorName, utmSource, utmMedium, utmCampaign, appDiagnosticUrl]
  );

  const saveCampaignToServer = useCallback(async () => {
    if (!refValid) return;
    await persistCampaign({});
  }, [persistCampaign, refValid]);

  const copyUrl = useCallback(async () => {
    if (!generatedUrl) return;
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      void persistCampaign({});
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [generatedUrl, persistCampaign]);

  function downloadQr() {
    if (!qrDataUrl || !refCode) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `cleexs-qr-${refCode}.png`;
    a.click();
    void persistCampaign({});
  }

  function openWhatsAppQr(initialMessage?: string) {
    setWaInitialMessage(initialMessage);
    setWaQrOpen(true);
    void persistCampaign({});
  }

  function loadCampaignFromHistory(entry: {
    refCode: string;
    sponsorName: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    whatsAppMessage: string | null;
    whatsAppCustomMessage?: string | null;
  }) {
    setRefTouched(true);
    setRefCode(entry.refCode);
    setSponsorName(entry.sponsorName);
    setUtmSource(entry.utmSource);
    setUtmMedium(entry.utmMedium);
    setUtmCampaign(entry.utmCampaign);
    setWaInitialMessage(entry.whatsAppMessage ?? undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
          <CleexsMark className="h-11 w-11" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Auspiciadores</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Generá link web, QR WhatsApp con mensaje de campaña y seguí conversiones por{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">ref</code> (web y canal WhatsApp).
        </p>
        <p className="mt-3 rounded-lg border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          Cada campaña se guarda en el servidor y aparece en{' '}
          <strong className="font-semibold">Admin → Referidores</strong> para el ranking de emails.
        </p>
        {migrationNote ? (
          <p className="mt-2 rounded-lg border border-primary-200/80 bg-primary-50 px-3 py-2 text-xs text-primary-900">
            {migrationNote}
          </p>
        ) : null}
      </header>

      <form
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/50"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="block">
          <span className={labelCls}>Nombre del auspiciador</span>
          <input
            type="text"
            value={sponsorName}
            onChange={(e) => setSponsorName(e.target.value)}
            placeholder="Ej. Radio La Red, YouTube Cleexs"
            className={fieldCls}
            autoComplete="off"
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            Solo orientativo; sugerimos el código ref automáticamente.
          </span>
        </label>

        <label className="block">
          <span className={labelCls}>
            Código ref <span className="text-rose-500">*</span>
          </span>
          <input
            type="text"
            value={refCode}
            onChange={(e) => {
              setRefTouched(true);
              setRefCode(e.target.value);
            }}
            placeholder="radio_la_red"
            className={fieldCls}
            required
            autoComplete="off"
          />
          <span className="mt-1 block text-[11px] text-slate-500">
            Letras minúsculas, números, guión y guión bajo (máx. 120).
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className={labelCls}>utm_source</span>
            <input type="text" value={utmSource} onChange={(e) => setUtmSource(e.target.value)} className={fieldCls} />
          </label>
          <label className="block sm:col-span-1">
            <span className={labelCls}>utm_medium</span>
            <input type="text" value={utmMedium} onChange={(e) => setUtmMedium(e.target.value)} className={fieldCls} />
          </label>
          <label className="block sm:col-span-1">
            <span className={labelCls}>utm_campaign</span>
            <input
              type="text"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              placeholder="opcional"
              className={fieldCls}
            />
          </label>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <input
            type="checkbox"
            checked={showQr}
            onChange={(e) => setShowQr(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <QrCode className="h-4 w-4 text-primary-600" aria-hidden />
            Generar código QR
          </span>
        </label>
      </form>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
        <p className={labelCls}>Enlace para compartir</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Lleva a la <strong className="text-slate-700">home de cleexs.net</strong> con ref/UTM. El diagnóstico arranca
          en la app cuando el usuario usa &quot;Checkear visibilidad&quot; (el script de WordPress debe reenviar los
          parámetros).
        </p>

        {refValid && generatedUrl ? (
          <>
            <p className="mt-3 break-all rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-xs leading-relaxed text-slate-800">
              {generatedUrl}
            </p>
            {appDiagnosticUrl ? (
              <details className="mt-3 text-[11px] text-slate-500">
                <summary className="cursor-pointer font-medium text-slate-600">
                  Link directo al diagnóstico (app, sin pasar por la home)
                </summary>
                <p className="mt-2 break-all rounded-lg border border-slate-100 bg-slate-50 px-2 py-2 font-mono text-[10px] text-slate-600">
                  {appDiagnosticUrl}
                </p>
              </details>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => void copyUrl()} className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copiado' : 'Copiar link'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                disabled={saveState === 'saving'}
                onClick={() => void saveCampaignToServer()}
              >
                {saveState === 'saving' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saveState === 'saved' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saveState === 'saved' ? 'Guardado' : 'Guardar campaña'}
              </Button>
              <Button type="button" variant="outline" className="gap-2" asChild>
                <a href={generatedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Probar
                </a>
              </Button>
            </div>
            {saveState === 'error' && saveError ? (
              <p className="mt-2 text-xs text-rose-600">{saveError}</p>
            ) : null}

            {showQr && (
              <div className="mt-6 flex flex-col items-center gap-3 border-t border-slate-200 pt-6">
                {qrError ? (
                  <p className="text-sm text-rose-600">{qrError}</p>
                ) : qrDataUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrDataUrl}
                      alt={`QR para ${refCode}`}
                      width={280}
                      height={280}
                      className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                    />
                    <Button type="button" variant="secondary" className="gap-2" onClick={downloadQr}>
                      <Download className="h-4 w-4" />
                      Descargar PNG
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Generando QR…</p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            Completá el código <strong className="font-semibold text-slate-800">ref</strong> para ver el enlace.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 to-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={labelCls}>WhatsApp</p>
            <p className="mt-1 text-sm text-slate-600">
              QR con mensaje <strong className="font-medium text-slate-800">Gentileza de …</strong> y tracking{' '}
              <code className="text-xs">ref:</code> en el texto prefijado.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Número fijo del QR:{' '}
              <code className="text-[11px]">{formatCleexsWhatsAppPhoneDisplay()}</code>
            </p>
          </div>
          <Button
            type="button"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            disabled={!refValid}
            onClick={() => openWhatsAppQr()}
          >
            <MessageCircle className="h-4 w-4" />
            Generar QR WhatsApp
          </Button>
        </div>
      </section>

      <SponsorCampaignHistoryPanel
        refreshKey={historyRefresh}
        onLoad={loadCampaignFromHistory}
        onOpenWhatsAppQr={(entry) => {
          loadCampaignFromHistory(entry);
          openWhatsAppQr(entry.whatsAppCustomMessage ?? undefined);
        }}
      />

      <SponsorTrackingPanel activeRef={refCode} />

      <SponsorWhatsAppQrModal
        open={waQrOpen}
        onClose={() => setWaQrOpen(false)}
        sponsorName={sponsorName}
        refCode={refCode}
        initialCustomMessage={waInitialMessage}
        onWhatsAppReady={({ whatsAppUrl, whatsAppMessage, customMessage }) => {
          void persistCampaign({
            whatsAppUrl,
            whatsAppMessage,
            customWaMessage: customMessage,
          });
        }}
      />
    </div>
  );
}
