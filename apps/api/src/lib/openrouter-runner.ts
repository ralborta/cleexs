/**
 * Cliente para OpenRouter (https://openrouter.ai).
 *
 * OpenRouter expone una API OpenAI-compatible. Lo usamos para Perplexity Sonar
 * y Claude Sonnet 4, sin abrir cuentas separadas en cada proveedor.
 *
 * Solo se invoca en tier "gold". Si OPENROUTER_API_KEY no esta seteada o el
 * proveedor no responde, devuelve null y el pipeline sigue con los LLMs
 * disponibles (no bloquea el flujo).
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export interface OpenRouterChatOptions {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

/** Devuelve el texto crudo de la respuesta del modelo, o null ante cualquier error. */
export async function callOpenRouterChat(opts: OpenRouterChatOptions): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[OpenRouter] OPENROUTER_API_KEY no configurado; se omite el llamado.');
    return null;
  }

  const referer = process.env.OPENROUTER_REFERER?.trim() || 'https://app.cleexs.net';
  const appTitle = process.env.OPENROUTER_APP_TITLE?.trim() || 'Cleexs';

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': referer,
        'X-Title': appTitle,
      },
      body: JSON.stringify({
        model: opts.model,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 4500,
        messages: [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: opts.userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    const json = (await response.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string | number };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!response.ok) {
      const msg = json?.error?.message || `HTTP ${response.status}`;
      console.warn(`[OpenRouter] ${opts.model} fallo: ${msg}`);
      return null;
    }

    const content = json?.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[OpenRouter] ${opts.model} excepcion: ${msg}`);
    return null;
  }
}

/** Modelo configurable via env para permitir cambiar sin redeploy. */
export function getPerplexityModelId(): string {
  return process.env.OPENROUTER_PERPLEXITY_MODEL?.trim() || 'perplexity/sonar';
}

export function getClaudeModelId(): string {
  return process.env.OPENROUTER_CLAUDE_MODEL?.trim() || 'anthropic/claude-sonnet-4';
}
