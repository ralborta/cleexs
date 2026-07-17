'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Ban,
  Bot,
  CheckCircle2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Server,
  ShieldOff,
  XCircle,
} from 'lucide-react';
import { adminUiFetch } from '@/lib/admin-ui-client-fetch';

const POLL_MS = 15_000;

type MonitorServiceProbe = {
  id: string;
  ok: boolean;
  latency_ms?: number;
  status?: number | string;
  error?: string;
  service?: string;
  whatsapp?: string;
  phone?: string | null;
  detail?: string;
  qr_available?: boolean;
  qr_updated_at?: string | null;
  auto_reconnect?: boolean;
};

type MonitorStatus = {
  ok: boolean;
  checked_at: string;
  baileys_configured: boolean;
  public_bot_url?: string | null;
  services: {
    api: MonitorServiceProbe;
    bot: MonitorServiceProbe;
    whatsapp: MonitorServiceProbe;
  };
  hints?: string[];
};

const FALLBACK_BOT_QR_URL = 'https://agente-cleexs-wa-bot.wd75db.easypanel.host/vincular';

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function serviceLabel(id: string) {
  switch (id) {
    case 'api':
      return 'API Cleexs';
    case 'bot':
      return 'Bot Baileys (HTTP)';
    case 'whatsapp':
      return 'WhatsApp';
    default:
      return id;
  }
}

function serviceIcon(id: string) {
  switch (id) {
    case 'api':
      return <Server className="h-5 w-5" />;
    case 'bot':
      return <Bot className="h-5 w-5" />;
    case 'whatsapp':
      return <MessageCircle className="h-5 w-5" />;
    default:
      return <Activity className="h-5 w-5" />;
  }
}

export function WhatsAppMonitorPanel() {
  const [data, setData] = useState<MonitorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockPhone, setBlockPhone] = useState('');
  const [blockBusy, setBlockBusy] = useState<'add' | 'remove' | null>(null);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);
  const [blockErr, setBlockErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await adminUiFetch('/api/admin-ui/monitor/status');
      const json = (await res.json().catch(() => ({}))) as MonitorStatus & { error?: string };
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de monitoreo');
    } finally {
      setLoading(false);
    }
  }, []);

  const setBlacklist = useCallback(async (intent: 'add' | 'remove') => {
    const number = blockPhone.trim();
    if (!number) {
      setBlockErr('Ingresá un número (ej. 54911…)');
      setBlockMsg(null);
      return;
    }
    setBlockBusy(intent);
    setBlockErr(null);
    setBlockMsg(null);
    try {
      const res = await adminUiFetch('/api/admin-ui/monitor/whatsapp/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number, intent }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        number?: string;
      };
      if (!res.ok || json.ok === false) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setBlockMsg(
        json.message ||
          (intent === 'add'
            ? `Bloqueado ${json.number || number}`
            : `Desbloqueado ${json.number || number}`)
      );
    } catch (err) {
      setBlockErr(err instanceof Error ? err.message : 'No se pudo actualizar blacklist');
    } finally {
      setBlockBusy(null);
    }
  }, [blockPhone]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const services = data ? [data.services.api, data.services.bot, data.services.whatsapp] : [];
  const botQrUrl = (() => {
    const base = (data?.public_bot_url || FALLBACK_BOT_QR_URL).replace(/\/$/, '');
    if (/\/vincular$/i.test(base) || /\/qr$/i.test(base)) return base;
    return `${base}/vincular`;
  })();
  const bannerOk = !error && Boolean(data?.ok);
  const bannerTone = error
    ? 'border-rose-200 bg-rose-50'
    : bannerOk
      ? 'border-emerald-200 bg-emerald-50'
      : 'border-amber-200 bg-amber-50';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Monitor WhatsApp Cleexs</h2>
            <p className="text-xs text-slate-500">
              Chequeo cada {POLL_MS / 1000}s · API, bot Baileys y sesión WhatsApp
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className={`rounded-2xl border p-5 ${bannerTone}`}>
        <div className="flex items-start gap-3">
          {error || !data?.ok ? (
            <XCircle className="mt-0.5 h-7 w-7 shrink-0 text-rose-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600" />
          )}
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {error
                ? 'No se pudo contactar la API'
                : data?.ok
                  ? 'Todo operativo'
                  : 'Atención — hay servicios caídos'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {error ??
                (data?.checked_at
                  ? `Último chequeo: ${fmtTime(data.checked_at)}`
                  : 'Esperando primer chequeo…')}
            </p>
            {data?.hints && data.hints.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-amber-800">
                {data.hints.map((h) => (
                  <li key={h}>→ {h}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      {data && !data.services.whatsapp.ok ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <QrCode className="h-4 w-4 text-violet-600" />
                Vincular WhatsApp
              </h3>
              <p className="mt-2 max-w-xl text-xs text-slate-500">
                No usamos QR acá (se queda viejo y genera conflictos). Abrí la página del bot:
                se actualiza sola y se oculta al conectar.
              </p>
            </div>
            <a
              href={botQrUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <QrCode className="h-4 w-4" />
              Abrir QR del bot
            </a>
          </div>
          <ol className="mt-4 list-decimal space-y-1 pl-4 text-xs text-slate-500">
            <li>EasyPanel: Zero Downtime OFF en wa-bot</li>
            <li>WhatsApp → Dispositivos vinculados → Vincular</li>
            <li>Escaneá solo el QR vivo de esa página (si dice vencido, esperá el nuevo)</li>
            <li>Cuando diga conectado, no vuelvas a escanear</li>
          </ol>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
            <Ban className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900">Bloquear número</h3>
            <p className="mt-1 text-xs text-slate-500">
              Igual que en BBC: el bot deja de responder a ese contacto (blacklist Baileys).
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="tel"
                inputMode="numeric"
                placeholder="54911…"
                value={blockPhone}
                onChange={(e) => setBlockPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-violet-500 focus:bg-white focus:ring-2 sm:max-w-xs"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={blockBusy != null}
                  onClick={() => void setBlacklist('add')}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  <Ban className={`h-4 w-4 ${blockBusy === 'add' ? 'animate-pulse' : ''}`} />
                  Bloquear
                </button>
                <button
                  type="button"
                  disabled={blockBusy != null}
                  onClick={() => void setBlacklist('remove')}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <ShieldOff className={`h-4 w-4 ${blockBusy === 'remove' ? 'animate-pulse' : ''}`} />
                  Desbloquear
                </button>
              </div>
            </div>
            {blockMsg ? <p className="mt-2 text-sm text-emerald-700">{blockMsg}</p> : null}
            {blockErr ? <p className="mt-2 text-sm text-rose-700">{blockErr}</p> : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {services.map((svc) => (
          <div key={svc.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    svc.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {serviceIcon(svc.id)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{serviceLabel(svc.id)}</p>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      svc.ok
                        ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                        : 'bg-rose-100 text-rose-800 ring-1 ring-rose-200'
                    }`}
                  >
                    {svc.ok ? 'OK' : 'CAÍDO'}
                  </span>
                </div>
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-xs text-slate-500">
              {svc.latency_ms != null && svc.latency_ms > 0 ? (
                <div className="flex justify-between gap-2">
                  <dt>Latencia</dt>
                  <dd className="tabular-nums text-slate-800">{svc.latency_ms} ms</dd>
                </div>
              ) : null}
              {svc.phone ? (
                <div className="flex justify-between gap-2">
                  <dt>Número bot</dt>
                  <dd className="text-slate-800">{svc.phone}</dd>
                </div>
              ) : null}
              {svc.detail ? (
                <div>
                  <dt className="mb-0.5">Detalle</dt>
                  <dd className="text-slate-800">{svc.detail}</dd>
                </div>
              ) : null}
              {svc.error ? (
                <div>
                  <dt className="mb-0.5 text-rose-600">Error</dt>
                  <dd className="text-rose-700">{svc.error}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ))}
        {loading && services.length === 0 ? (
          <p className="col-span-full text-sm text-slate-500">Cargando estado…</p>
        ) : null}
      </div>
    </div>
  );
}
