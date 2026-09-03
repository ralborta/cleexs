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

function builderBotCloudConfigured(): boolean {
  return Boolean(
    (process.env.BUILDERBOT_BOT_ID || '').trim() && (process.env.BUILDERBOT_API_KEY || '').trim(),
  );
}

function displayWhatsAppPhone(): string | null {
  const fromEnv = (process.env.CLEEXS_WHATSAPP_PHONE_E164 || process.env.CLEEXS_WHATSAPP_PHONE || '')
    .trim()
    .replace(/\D/g, '');
  if (fromEnv.length >= 9) return fromEnv;
  // Número campaña Cleexs (auspiciadores) — fallback de UI si no hay env.
  return '5491162630542';
}

/** URL pública para que el cliente abra y escanee el QR (solo modo Baileys). */
export function baileysBotPublicUrl(): string | null {
  const explicit = (process.env.BAILEYS_BOT_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const base = baileysBotBase();
  if (base.startsWith('https://') || base.startsWith('http://')) {
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
  const bbc = builderBotCloudConfigured();
  const phone = displayWhatsAppPhone();

  const api: MonitorServiceProbe = {
    id: 'api',
    ok: true,
    service: 'cleexs-api',
    latency_ms: 0,
  };

  // Modo BBC Cloud (rollback): la UI debe verse operativa sin depender de Baileys.
  if (!botBase && bbc) {
    return {
      ok: true,
      checked_at: new Date().toISOString(),
      public_bot_url: null,
      baileys_configured: false,
      channel: 'builderbot_cloud' as const,
      services: {
        api,
        bot: {
          id: 'bot',
          ok: true,
          service: 'builderbot-cloud',
          status: 'online',
          whatsapp: 'connected',
          phone,
          detail: 'Canal BuilderBot Cloud',
          latency_ms: 0,
        },
        whatsapp: {
          id: 'whatsapp',
          ok: true,
          phone,
          status: 'connected',
          whatsapp: 'connected',
          qr_available: false,
          qr_updated_at: null,
          auto_reconnect: true,
          detail: 'Sesión activa (BuilderBot Cloud)',
        } satisfies MonitorServiceProbe,
      },
      hints: [] as string[],
    };
  }

  const bot = await probeJson(botBase ? `${botBase}/health` : '', 'bot');

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
              ? 'Sin canal WhatsApp configurado'
              : 'Bot no responde',
    } satisfies MonitorServiceProbe,
  };

  const ok = api.ok && botOperational;

  const hints: string[] = [];
  if (!botBase && !bbc) {
    hints.push('Configurá BUILDERBOT_* (Cloud) o BAILEYS_BOT_URL.');
  } else if (!waConnected && bot.ok) {
    hints.push(
      publicUrl
        ? `WhatsApp desconectado — abrí el QR vivo en ${publicUrl}/vincular.`
        : 'WhatsApp desconectado — escaneá QR del canal activo.',
    );
  } else if (!bot.ok && botBase) {
    hints.push('Servicio wa-bot caído — revisá EasyPanel.');
  }

  return {
    ok,
    checked_at: new Date().toISOString(),
    public_bot_url: publicUrl,
    baileys_configured: Boolean(botBase),
    channel: botBase ? ('baileys' as const) : bbc ? ('builderbot_cloud' as const) : ('none' as const),
    services,
    hints,
  };
}

export async function fetchBaileysWhatsappQr() {
  const botBase = baileysBotBase();
  if (!botBase) {
    if (builderBotCloudConfigured()) {
      return {
        ok: true,
        connected: true,
        phone: displayWhatsAppPhone(),
        message: 'Canal activo en BuilderBot Cloud (sin QR Baileys).',
        public_bot_url: null,
      };
    }
    return {
      ok: false,
      connected: false,
      error: 'Sin canal WhatsApp (BBC o Baileys)',
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
