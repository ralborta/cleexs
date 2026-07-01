'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearSponsorCampaignHistory,
  listSponsorCampaignHistory,
  removeSponsorCampaignHistory,
  type SponsorCampaignHistoryEntry,
} from '@/lib/sponsor-campaign-history';
import {
  fetchServerSponsorCampaigns,
  mergeSponsorCampaignHistory,
} from '@/lib/sponsor-campaign-sync';
import { Button } from '@/components/ui/button';
import {
  Check,
  Copy,
  History,
  Loader2,
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
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const local = listSponsorCampaignHistory();
    try {
      const server = await fetchServerSponsorCampaigns();
      setEntries(mergeSponsorCampaignHistory(server, local));
    } catch {
      setEntries(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
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

  if (loading && entries.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-400" aria-hidden />
          <p className="text-sm">Cargando campañas del servidor…</p>
        </div>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5">
        <div className="flex items-center gap-2 text-slate-600">
          <History className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <div>
            <h2 className="text-sm font-bold text-slate-800">Campañas registradas</h2>
            <p className="mt-1 text-xs text-slate-500">
              Completá el formulario y tocá <strong>Guardar campaña</strong> o copiá el link. Quedan
              en el servidor y en Admin → Referidores.
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
            <h2 className="text-lg font-bold text-slate-900">Campañas registradas</h2>
            <p className="mt-1 text-sm text-slate-600">
              {entries.length} campaña{entries.length === 1 ? '' : 's'} en el servidor (visible en
              Admin → Referidores).
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-slate-600"
          onClick={() => {
            if (
              window.confirm(
                '¿Borrar solo el cache local de este navegador? Las campañas en el servidor no se eliminan.'
              )
            ) {
              clearSponsorCampaignHistory();
              void reload();
            }
          }}
        >
          Vaciar cache local
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
                      void reload();
                    }}
                    aria-label={`Quitar del cache local ${entry.refCode}`}
                    title="Quitar del cache local (no borra del servidor)"
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
