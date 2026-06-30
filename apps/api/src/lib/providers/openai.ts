import type { ChatMessage, ChatResponse, ModelId } from './index';

export interface OpenAIChatConfig {
  model: ModelId;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export async function chatOpenAI(
  messages: ChatMessage[],
  config: OpenAIChatConfig
): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no configurada');
  }

  const body: Record<string, unknown> = {
    model: config.model,
    temperature: config.temperature ?? 0.2,
    max_tokens: config.maxTokens ?? 800,
    messages,
  };

  if (config.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  if (!response.ok) {
    throw new Error(json?.error?.message || `OpenAI error (HTTP ${response.status})`);
  }

  const text = json?.choices?.[0]?.message?.content?.trim() || '';
  return {
    text,
    tokensUsed: json?.usage?.total_tokens || 0,
    model: config.model,
    provider: 'openai',
  };
}
