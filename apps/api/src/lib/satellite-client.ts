type SatelliteToolKey =
  | 'crawlability'
  | 'robots_sitemap'
  | 'schema'
  | 'axp'
  | 'ai_presence'
  | 'citations'
  | 'alerts'
  | 'freshness'
  | 'ai_overview'
  | 'duplicates';

type SatelliteSuggestion = {
  priority?: string;
  message?: string;
  detail?: string;
  action?: string;
};

type SatelliteToolResult = {
  score?: number;
  suggestions?: SatelliteSuggestion[];
  error?: string;
} & Record<string, unknown>;

type SatelliteAnalyzeAllResponse = {
  overall_score?: number;
  target_url?: string;
} & Partial<Record<SatelliteToolKey, SatelliteToolResult>>;

export type SatelliteModuleResult = {
  /** `pending`: placeholder en DB mientras corre Cleexs Tools en segundo plano. */
  status: 'completed' | 'failed' | 'timeout' | 'skipped' | 'pending';
  targetUrl?: string;
  overallScore: number;
  tools: Partial<
    Record<SatelliteToolKey, { score: number; error?: string; detail?: Record<string, unknown> }>
  >;
  actions: Array<{
    priority: string;
    source: string;
    message: string;
    detail?: string;
    action?: string;
  }>;
  error?: string;
};

/**
 * Tiempo máximo de espera al resultado (incluye polling). El análisis completo puede tardar varios minutos
 * (herramientas en serie + IAs). Si SATELLITE_TIMEOUT_MS es bajo en prod, verás timeout con 0 tools.
 * El POST largo a /api/analyze-all suele cortarlo el proxy (~60s); el satélite expone /start + GET /jobs.
 */
const DEFAULT_SATELLITE_TIMEOUT_MS = 900_000;

function parseSatelliteTimeoutMs(): number {
  const raw = process.env.SATELLITE_TIMEOUT_MS?.trim();
  if (raw === undefined || raw === '') return DEFAULT_SATELLITE_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SATELLITE_TIMEOUT_MS;
  return Math.floor(n);
}

const TOOL_KEYS: SatelliteToolKey[] = [
  'crawlability',
  'robots_sitemap',
  'schema',
  'axp',
  'ai_presence',
  'citations',
  'alerts',
  'freshness',
  'ai_overview',
  'duplicates',
];

function normalizePriority(value: string | undefined): string {
  if (!value) return 'info';
  const p = value.trim().toLowerCase();
  if (['critica', 'alta', 'media', 'baja', 'info'].includes(p)) return p;
  return 'info';
}

/**
 * Reduce tamaño del JSON del satélite acortando solo strings largos (mantiene claves, arrays y objetos).
 * Usado al guardar y al servir el detalle por herramienta.
 */
export function deepTruncateSatelliteDetail(value: unknown, maxStringLen: number, depth = 0): unknown {
  if (depth > 40) return '[…]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length <= maxStringLen) return value;
    const keep = Math.max(48, maxStringLen - 28);
    return `${value.slice(0, keep)}… [texto acortado]`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => deepTruncateSatelliteDetail(item, maxStringLen, depth + 1));
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = deepTruncateSatelliteDetail(v, maxStringLen, depth + 1);
    }
    return out;
  }
  return value;
}

function parseSatelliteToolDetailStoreMaxChars(): number {
  const raw = process.env.SATELLITE_TOOL_DETAIL_STORE_MAX_CHARS?.trim();
  if (raw === undefined || raw === '') return 110_000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 12_000) return 110_000;
  return Math.min(Math.floor(n), 220_000);
}

/** Serializa el objeto tool completo para el desplegable; prioriza traer todo lo que quepa con recorte suave. */
function toolDetailForStorage(t: SatelliteToolResult): Record<string, unknown> | undefined {
  try {
    const plain = JSON.parse(JSON.stringify(t)) as Record<string, unknown>;
    const max = parseSatelliteToolDetailStoreMaxChars();
    let str = JSON.stringify(plain);
    if (str.length <= max) return plain;

    let maxStr = 16_000;
    for (let i = 0; i < 16; i++) {
      const candidate = deepTruncateSatelliteDetail(plain, maxStr) as Record<string, unknown>;
      str = JSON.stringify(candidate);
      if (str.length <= max) {
        return {
          ...candidate,
          _truncated: true,
          _note:
            'Algunos textos largos se acortaron para conservar el máximo de estructura y datos útiles en el informe.',
        };
      }
      maxStr = Math.max(400, Math.floor(maxStr * 0.52));
    }
    return {
      score: plain.score,
      error: plain.error,
      suggestions: plain.suggestions,
      _truncated: true,
      _note:
        'El detalle sigue siendo muy grande; mostramos score y sugerencias. Para el volcado completo abrí Cleexs Tools con el mismo sitio.',
    };
  } catch {
    return undefined;
  }
}

function buildActions(payload: SatelliteAnalyzeAllResponse): SatelliteModuleResult['actions'] {
  const actions: SatelliteModuleResult['actions'] = [];
  for (const key of TOOL_KEYS) {
    const tool = payload[key];
    if (!tool || !Array.isArray(tool.suggestions)) continue;
    for (const s of tool.suggestions) {
      const message = (s?.message || '').trim();
      if (!message) continue;
      actions.push({
        priority: normalizePriority(s.priority),
        source: key,
        message,
        ...(s.detail ? { detail: s.detail } : {}),
        ...(s.action ? { action: s.action } : {}),
      });
    }
  }
  return actions;
}

export async function runSatelliteAnalysis(
  url: string
): Promise<SatelliteModuleResult> {
  const enabled = (process.env.SATELLITE_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    return { status: 'skipped', overallScore: 0, tools: {}, actions: [] };
  }

  const baseUrl = (process.env.SATELLITE_BASE_URL || '').trim();
  if (!baseUrl) {
    return {
      status: 'failed',
      overallScore: 0,
      tools: {},
      actions: [],
      error: 'SATELLITE_BASE_URL no configurado',
    };
  }

  const timeoutMs = parseSatelliteTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const base = baseUrl.replace(/\/$/, '');

  /** Espera sin acumular listeners en AbortSignal (evita MaxListenersExceededWarning en polling largo). */
  const sleep = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (controller.signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const t = setTimeout(() => {
        controller.signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      controller.signal.addEventListener('abort', onAbort);
    });

  try {
    const startResp = await fetch(`${base}/api/analyze-all/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    let payload: SatelliteAnalyzeAllResponse;

    if (startResp.status === 202) {
      const startJson = (await startResp.json()) as { job_id?: string };
      const jobId = startJson.job_id;
      if (!jobId) {
        return {
          status: 'failed',
          overallScore: 0,
          tools: {},
          actions: [],
          error: 'Satellite: respuesta /start sin job_id',
        };
      }
      for (;;) {
        const jobResp = await fetch(`${base}/api/analyze-all/jobs/${jobId}`, {
          signal: controller.signal,
        });
        if (!jobResp.ok) {
          return {
            status: 'failed',
            overallScore: 0,
            tools: {},
            actions: [],
            error: `Satellite HTTP ${jobResp.status}`,
          };
        }
        const job = (await jobResp.json()) as {
          job_status?: string;
          error?: string;
          overall_score?: number;
          target_url?: string;
        } & Record<string, unknown>;
        if (job.job_status === 'completed') {
          const { job_status: _js, ...rest } = job;
          payload = rest as SatelliteAnalyzeAllResponse;
          break;
        }
        if (job.job_status === 'failed') {
          return {
            status: 'failed',
            overallScore: 0,
            tools: {},
            actions: [],
            error: typeof job.error === 'string' ? job.error : 'Error en análisis satélite',
          };
        }
        await sleep(1500);
      }
    } else if (startResp.status === 404) {
      // Satélite antiguo sin /start: un solo POST (puede cortar el proxy si tarda mucho).
      const response = await fetch(`${base}/api/analyze-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          status: 'failed',
          overallScore: 0,
          tools: {},
          actions: [],
          error: `Satellite HTTP ${response.status}`,
        };
      }

      payload = (await response.json()) as SatelliteAnalyzeAllResponse;
    } else {
      return {
        status: 'failed',
        overallScore: 0,
        tools: {},
        actions: [],
        error: `Satellite /api/analyze-all/start HTTP ${startResp.status}`,
      };
    }
    const tools: SatelliteModuleResult['tools'] = {};
    for (const key of TOOL_KEYS) {
      const t = payload[key];
      if (!t) continue;
      const detail = toolDetailForStorage(t);
      tools[key] = {
        score: typeof t.score === 'number' ? t.score : 0,
        ...(typeof t.error === 'string' && t.error ? { error: t.error } : {}),
        ...(detail ? { detail } : {}),
      };
    }

    return {
      status: 'completed',
      targetUrl: typeof payload.target_url === 'string' ? payload.target_url : url,
      overallScore: typeof payload.overall_score === 'number' ? payload.overall_score : 0,
      tools,
      actions: buildActions(payload),
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      status: isAbort ? 'timeout' : 'failed',
      overallScore: 0,
      tools: {},
      actions: [],
      error: isAbort ? 'Timeout en análisis satélite' : (err instanceof Error ? err.message : 'Error desconocido'),
    };
  } finally {
    clearTimeout(timeout);
  }
}
