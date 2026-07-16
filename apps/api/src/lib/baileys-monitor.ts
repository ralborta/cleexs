const PROBE_TIMEOUT_MS = 6000;

export type MonitorServiceProbe = {
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
  reconnect_note?: string;
};

function baileysBotBase(): string {
  return (process.env.BAILEYS_BOT_URL || '').trim().replace(/\/$/, '');
}

/** URL pública para que el cliente abra y escanee el QR. */
export function baileysBotPublicUrl(): string | null {
  const explicit = (process.env.BAILEYS_BOT_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const base = baileysBotBase();
  if (base.startsWith('https://') || base.startsWith('http://')) {
    // Solo exponer si parece URL pública (no hostname interno de docker)
    if (!/localhost|127\.0\.0\.1|:3008$|cleexs-wa-bot/i.test(base)) return base;
  }
  return null;
}

async function probeJson(url: string, id: string): Promise<MonitorServiceProbe> {
  if (!url) {
    return { id, ok: false, error: 'URL no configurada' };
  }
  const started = Date.now();
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);
    const raw = await res.text().catch(() => '');
    let data: Record<string, unknown> = {};
    try {
      data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      data = { raw: raw.slice(0, 120) };
    }
    return {
      id,
      ok: res.ok && data.ok !== false,
      status: res.status,
      latency_ms: Date.now() - started,
      ...data,
    };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    return {
      id,
      ok: false,
      latency_ms: Date.now() - started,
      error: e.name === 'AbortError' ? 'timeout' : e.message || 'probe failed',
    };
  }
}

function whatsappOk(botProbe: MonitorServiceProbe): boolean {
  if (!botProbe?.ok) return false;
  return botProbe.whatsapp === 'connected' && Boolean(botProbe.phone);
}

export async function buildWhatsAppMonitorStatus() {
  const botBase = baileysBotBase();
  const publicUrl = baileysBotPublicUrl();
  const bot = await probeJson(botBase ? `${botBase}/health` : '', 'bot');

  const api: MonitorServiceProbe = {
    id: 'api',
    ok: true,
    service: 'cleexs-api',
    latency_ms: 0,
  };

  const waConnected = whatsappOk(bot);
  const botOperational = bot.ok && waConnected;

  const services = {
    api,
    bot: {
      ...bot,
      whatsapp: bot.whatsapp ?? (waConnected ? 'connected' : 'disconnected'),
    },
    whatsapp: {
      id: 'whatsapp',
      ok: waConnected,
      phone: bot.phone ?? null,
      status: bot.whatsapp ?? (waConnected ? 'connected' : 'disconnected'),
      qr_available: bot.qr_available ?? false,
      qr_updated_at: bot.qr_updated_at ?? null,
      auto_reconnect: bot.auto_reconnect ?? true,
      detail: waConnected
        ? 'Sesión activa'
        : bot.whatsapp === 'awaiting_qr' || bot.qr_available
          ? 'Esperando escaneo de QR'
          : bot.ok
            ? 'Desconectado — el bot intenta reconectar'
            : bot.error === 'URL no configurada'
              ? 'BAILEYS_BOT_URL no configurado'
              : 'Bot no responde',
    } satisfies MonitorServiceProbe,
  };

  const ok = api.ok && botOperational;

  const hints: string[] = [];
  if (!botBase) {
    hints.push('Configurá BAILEYS_BOT_URL en la API (URL del bot Baileys en EasyPanel).');
  } else if (!waConnected && bot.ok) {
    hints.push(
      publicUrl
        ? `WhatsApp desconectado — abrí ${publicUrl} o usá «Mostrar QR» abajo.`
        : 'WhatsApp desconectado — usá «Mostrar QR» abajo o abrí la URL pública del bot.',
    );
    if (bot.auto_reconnect) {
      hints.push('Baileys reconecta solo ante cortes de red; si la sesión expiró, escaneá QR.');
    }
  } else if (!bot.ok) {
    hints.push('Servicio cleexs-wa-bot caído — revisá logs en EasyPanel.');
  }

  return {
    ok,
    checked_at: new Date().toISOString(),
    public_bot_url: publicUrl,
    baileys_configured: Boolean(botBase),
    services,
    hints,
  };
}

export async function fetchBaileysWhatsappQr() {
  const botBase = baileysBotBase();
  if (!botBase) {
    return {
      ok: false,
      connected: false,
      error: 'BAILEYS_BOT_URL no configurado',
      public_bot_url: baileysBotPublicUrl(),
    };
  }

  let status: Record<string, unknown> | null = null;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${botBase}/v1/whatsapp/status`, {
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (res.ok) status = (await res.json()) as Record<string, unknown>;
  } catch {
    status = null;
  }

  if (status?.whatsapp === 'connected') {
    return {
      ok: true,
      connected: true,
      phone: (status.phone as string | null) ?? null,
      message: 'WhatsApp ya está conectado.',
      public_bot_url: baileysBotPublicUrl(),
    };
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${botBase}/v1/whatsapp/qr`, {
      signal: ac.signal,
    });
    clearTimeout(timer);

    if (res.ok && res.headers.get('content-type')?.includes('png')) {
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        ok: true,
        connected: false,
        qr_available: true,
        image_base64: `data:image/png;base64,${buf.toString('base64')}`,
        qr_updated_at: (status?.qr_updated_at as string | null) ?? null,
        auto_reconnect: (status?.auto_reconnect as boolean) ?? true,
        message: 'Escaneá con WhatsApp → Dispositivos vinculados → Vincular dispositivo.',
        public_bot_url: baileysBotPublicUrl(),
      };
    }
  } catch {
    /* fallthrough */
  }

  return {
    ok: true,
    connected: false,
    qr_available: false,
    auto_reconnect: (status?.auto_reconnect as boolean) ?? true,
    message: 'Generando código QR… reintentá en unos segundos.',
    public_bot_url: baileysBotPublicUrl(),
  };
}
