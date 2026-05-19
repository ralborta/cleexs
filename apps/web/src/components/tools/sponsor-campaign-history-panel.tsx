'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearSponsorCampaignHistory,
  listSponsorCampaignHistory,
  removeSponsorCampaignHistory,
  type SponsorCampaignHistoryEntry,
} from '@/lib/sponsor-campaign-history';
import { Button } from '@/components/ui/button';
import {
  Check,
  Copy,
  History,
  MessageCircle,
  Pencil,
  Trash2,
} from 'lucide-react';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type Props = {
  refreshKey: number;
  onLoad: (entry: SponsorCampaignHistoryEntry) => void;
  onOpenWhatsAppQr: (entry: SponsorCampaignHistoryEntry) => void;
};

export function SponsorCampaignHistoryPanel({ refreshKey, onLoad, onOpenWhatsAppQr }: Props) {
  const [entries, setEntries] = useState<SponsorCampaignHistoryEntry[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const reload = useCallback(() => {
    setEntries(listSponsorCampaignHistory());
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const copyText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  if (entries.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
        <div className="flex items-center gap-2 text-slate-600">
          <History className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-slate-800">Campañas recientes</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cuando copies un link o generes un QR, aparecerá acá para reenviarla (guardado en este
              navegador).
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <History className="mt-0.5 h-5 w-5 text-primary-600" aria-hidden />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Campañas recientes</h2>
            <p className="mt-1 text-sm text-slate-600">
              Links y QR guardados en este navegador ({entries.length}). Podés copiarlos o cargarlos
              en el formulario.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-slate-600"
          onClick={() => {
            if (window.confirm('¿Borrar todo el historial local de campañas?')) {
              clearSponsorCampaignHistory();
              reload();
            }
          }}
        >
          Vaciar historial
        </Button>
      </div>

      <ul className="mt-5 space-y-3">
        {entries.map((entry) => {
          const webCopyKey = `web-${entry.refCode}`;
          const waCopyKey = `wa-${entry.refCode}`;
          return (
            <li
              key={entry.refCode}
              className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">
                    {entry.sponsorName || entry.refCode}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-slate-600">ref: {entry.refCode}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Actualizado {formatWhen(entry.updatedAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    onClick={() => onLoad(entry)}
                    title="Cargar en el formulario"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Cargar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600"
                    onClick={() => {
                      removeSponsorCampaignHistory(entry.refCode);
                      reload();
                    }}
                    aria-label={`Quitar ${entry.refCode}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Link web
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-slate-800">
                    {entry.marketingUrl}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 h-8 gap-1.5 text-xs"
                    onClick={() => void copyText(webCopyKey, entry.marketingUrl)}
                  >
                    {copiedKey === webCopyKey ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Copiar link
                  </Button>
                </div>

                {entry.whatsAppUrl ? (
                  <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                      WhatsApp
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-slate-800">
                      {entry.whatsAppUrl.length > 120
                        ? `${entry.whatsAppUrl.slice(0, 80)}…`
                        : entry.whatsAppUrl}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 border-emerald-200 text-xs text-emerald-900"
                        onClick={() => void copyText(waCopyKey, entry.whatsAppUrl!)}
                      >
                        {copiedKey === waCopyKey ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        Copiar wa.me
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 border-emerald-200 text-xs text-emerald-900"
                        onClick={() => onOpenWhatsAppQr(entry)}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Ver QR
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-emerald-200 text-xs text-emerald-800"
                    onClick={() => onOpenWhatsAppQr(entry)}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Generar QR WhatsApp
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
