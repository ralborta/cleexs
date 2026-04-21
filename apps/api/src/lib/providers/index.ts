/**
 * Abstraccion de providers de IA.
 * Permite usar OpenAI y Gemini con la misma interfaz.
 */

import { chatOpenAI, OpenAIChatConfig } from './openai';
import { chatGemini, GeminiChatConfig } from './gemini';

export type ModelId =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatConfig {
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface ChatResponse {
  text: string;
  tokensUsed: number;
  model: ModelId;
  provider: 'openai' | 'gemini';
}

export function providerFor(model: ModelId): 'openai' | 'gemini' {
  if (model.startsWith('gemini')) return 'gemini';
  return 'openai';
}

/**
 * Funcion unica para llamar a cualquier modelo.
 * Abstrae OpenAI vs Gemini.
 */
export async function chatWithModel(
  messages: ChatMessage[],
  config: ChatConfig
): Promise<ChatResponse> {
  const provider = providerFor(config.model);

  if (provider === 'openai') {
    return chatOpenAI(messages, config as OpenAIChatConfig);
  }
  return chatGemini(messages, config as GeminiChatConfig);
}

/**
 * Modelos por defecto para runs de medicion (PRIA).
 */
export function defaultMeasureModels(): ModelId[] {
  const raw = process.env.DEFAULT_MEASURE_MODELS || 'gpt-4o-mini';
  const tokens = raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean) as ModelId[];
  return tokens.length > 0 ? tokens : ['gpt-4o-mini'];
}

/**
 * Modelo por defecto para clasificacion interna (marca, competidores, prompts).
 */
export function defaultClassifierModel(): ModelId {
  const provider = process.env.CLASSIFIER_PROVIDER || 'openai';
  if (provider === 'gemini') return 'gemini-1.5-flash';
  return 'gpt-4o-mini';
}
