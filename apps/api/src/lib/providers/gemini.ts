import type { ChatMessage, ChatResponse, ModelId } from './index';

export interface GeminiChatConfig {
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

/**
 * Mapea los nombres de modelos de Cleexs a los IDs reales de Gemini.
 * gemini-1.5-* estan deprecados para cuentas nuevas => usamos 2.5.
 */
function resolveGeminiModelId(model: ModelId): string[] {
  switch (model) {
    case 'gemini-1.5-flash':
    case 'gemini-2.5-flash':
      return ['gemini-2.5-flash', 'gemini-1.5-flash'];
    case 'gemini-1.5-pro':
    case 'gemini-2.5-pro':
      return ['gemini-2.5-pro', 'gemini-1.5-pro'];
    default:
      return ['gemini-2.5-flash'];
  }
}

export async function chatGemini(
  messages: ChatMessage[],
  config: GeminiChatConfig
): Promise<ChatResponse> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY / GOOGLE_API_KEY no configurada');
  }

  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const userText = messages
    .filter((m) => m.role !== 'system')
    .map((m) => m.content)
    .join('\n\n');

  const prompt = systemText ? `${systemText}\n\n${userText}` : userText;

  const modelsToTry = resolveGeminiModelId(config.model);
  let lastError: Error | null = null;

  for (const modelId of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          temperature: config.temperature ?? 0.2,
          maxOutputTokens: config.maxTokens ?? 800,
          ...(config.responseFormat === 'json'
            ? { responseMimeType: 'application/json' }
            : {}),
        },
      });

      const text = response.text?.trim() || '';
      if (!text) {
        lastError = new Error(`Gemini ${modelId}: respuesta vacia`);
        continue;
      }

      // Gemini no siempre devuelve usage; estimamos por longitud si no viene.
      const usage = (response as { usageMetadata?: { totalTokenCount?: number } })
        .usageMetadata?.totalTokenCount;

      return {
        text,
        tokensUsed: usage || Math.ceil((prompt.length + text.length) / 4),
        model: config.model,
        provider: 'gemini',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = new Error(`Gemini ${modelId}: ${msg}`);
      const terminal =
        msg.includes('API_KEY') ||
        msg.includes('403') ||
        msg.includes('permission') ||
        msg.includes('not valid');
      if (terminal) break;
    }
  }

  throw lastError || new Error('Gemini: todos los modelos fallaron');
}
