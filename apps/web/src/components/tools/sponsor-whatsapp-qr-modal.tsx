'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildSponsorGentilezaLine,
  buildSponsorWhatsAppPublicMessage,
  buildSponsorWhatsAppUrl,
} from '@/lib/sponsor-link';
import { renderBrandedWhatsAppQrDataUrl } from '@/lib/sponsor-whatsapp-qr';
import { CLEEXS_WHATSAPP_PHONE_E164 } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { Check, Copy, Download, Loader2, MessageCircle, X } from 'lucide-react';

const fieldCls =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/25';
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-slate-500';

type Props = {
  open: boolean;
  onClose: () => void;
  sponsorName: string;
  refCode: string;
  initialCustomMessage?: string;
  onWhatsAppReady?: (data: {
    whatsAppUrl: string;
    whatsAppMessage: string;
    customMessage: string;
  }) => void;
};

export function SponsorWhatsAppQrModal({
  open,
  onClose,
  sponsorName,
  refCode,
  initialCustomMessage,
  onWhatsAppReady,
}: Props) {
  const [phone, setPhone] = useState(CLEEXS_WHATSAPP_PHONE_E164);
  const [customMessage, setCustomMessage] = useState('');
  const [messageTouched, setMessageTouched] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);

  const refValid = Boolean(refCode.trim());

  useEffect(() => {
    if (!open) return;
    setPhone(CLEEXS_WHATSAPP_PHONE_E164);
    setQrDataUrl(null);
    setQrError(null);
    if (initialCustomMessage?.trim()) {
      setCustomMessage(initialCustomMessage.trim());
      setMessageTouched(true);
    } else {
      setMessageTouched(false);
      setCustomMessage('');
    }
  }, [open, initialCustomMessage]);

  useEffect(() => {
    if (!open || !refValid) return;
    if (!messageTouched) {
      setCustomMessage(
        buildSponsorWhatsAppPublicMessage({ sponsorDisplayName: sponsorName, refCode })
      );
    }
  }, [open, refValid, sponsorName, refCode, messageTouched]);

  const waMeUrl = useMemo(() => {
    if (!refValid) return null;
    return buildSponsorWhatsAppUrl({
      phoneE164: phone,
      sponsorDisplayName: sponsorName,
      refCode,
      customMessage: customMessage || undefined,
    });
  }, [phone, sponsorName, refCode, customMessage, refValid]);

  const gentilezaPreview = useMemo(
    () => buildSponsorGentilezaLine(sponsorName),
    [sponsorName]
  );

  const fullMessagePreview = useMemo(() => {
    if (!refValid) return '';
    const parts: string[] = [];
    if (gentilezaPreview) parts.push(gentilezaPreview);
    if (customMessage.trim()) parts.push(customMessage.trim());
    parts.push(`ref:${refCode.trim().toLowerCase()}`);
    return parts.join('\n\n');
  }, [gentilezaPreview, customMessage, refCode, refValid]);

  useEffect(() => {
    if (!open || !waMeUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    setQrLoading(true);
    setQrError(null);
    void renderBrandedWhatsAppQrDataUrl(waMeUrl)
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(null);
          setQrError('No pudimos generar el QR. Revisá el número y el mensaje.');
        }
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, waMeUrl]);

  useEffect(() => {
    if (!open || !waMeUrl || !onWhatsAppReady) return;
    onWhatsAppReady({
      whatsAppUrl: waMeUrl,
      whatsAppMessage: fullMessagePreview,
      customMessage: customMessage.trim(),
    });
  }, [open, waMeUrl, fullMessagePreview, customMessage, onWhatsAppReady]);

  const copyText = useCallback(async (text: string, kind: 'link' | 'message') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  function downloadQr() {
    if (!qrDataUrl || !refCode) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `cleexs-whatsapp-qr-${refCode}.png`;
    a.click();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal
      aria-labelledby="wa-qr-modal-title"
    >
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 pr-10">
          <MessageCircle className="h-5 w-5 text-emerald-600" aria-hidden />
          <h2 id="wa-qr-modal-title" className="text-lg font-bold text-slate-900">
            QR WhatsApp del auspiciador
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          El mensaje incluye <strong>Gentileza de …</strong>, el texto de campaña y un{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">ref:</code> interno para atribución en la API.
        </p>

        {!refValid ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Completá el código <strong>ref</strong> en el formulario principal antes de generar el QR.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className={labelCls}>Número WhatsApp Cleexs</span>
              <input
                type="tel"
                value={phone}
                readOnly
                placeholder="5411… (solo dígitos)"
                className={fieldCls}
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Número fijo para todos los QR: <code className="text-xs">+541153866372</code>
              </span>
            </label>

            {gentilezaPreview && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className={labelCls}>Vista previa — gentileza</span>
                <p className="mt-1 font-medium">{gentilezaPreview}</p>
              </div>
            )}

            <label className="block">
              <span className={labelCls}>Mensaje de campaña</span>
              <textarea
                value={customMessage}
                onChange={(e) => {
                  setMessageTouched(true);
                  setCustomMessage(e.target.value);
                }}
                rows={4}
                className={`${fieldCls} resize-y`}
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Por defecto menciona el Cleexs Score gratis gracias al auspiciador. Podés editarlo; el{' '}
                <code className="text-xs">ref:</code> se agrega al final automáticamente.
              </span>
            </label>

            <details className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700">Mensaje completo (desarrollo)</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-slate-800">
                {fullMessagePreview}
              </pre>
            </details>

            <div className="flex flex-col items-center gap-3 border-t border-slate-100 pt-5">
              {qrLoading && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generando QR…
                </p>
              )}
              {qrError && <p className="text-sm text-rose-600">{qrError}</p>}
              {qrDataUrl && !qrLoading && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR WhatsApp Cleexs"
                    width={280}
                    height={280}
                    className="rounded-2xl shadow-md ring-2 ring-primary-500/20"
                  />
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" variant="secondary" className="gap-2" onClick={downloadQr}>
                      <Download className="h-4 w-4" />
                      Descargar PNG
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => waMeUrl && void copyText(waMeUrl, 'link')}
                    >
                      {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      Copiar link wa.me
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={() => void copyText(fullMessagePreview, 'message')}
                    >
                      {copied === 'message' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      Copiar mensaje
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
