const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Tipos básicos
export interface Tenant {
  id: string;
  tenantCode: string;
  tenantPath: string;
  tenantType: 'ROOT' | 'AGENCY' | 'DIRECT_CLIENT' | 'AGENCY_CLIENT';
  plan: Plan;
}

export interface Plan {
  id: string;
  name: string;
  runsPerMonth: number;
  promptsActiveLimit: number;
  brandsLimit: number;
}

export interface Brand {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  productType?: string;
  country?: string;
  objective?: string;
  aliases: Array<{ id: string; alias: string }>;
  competitors: Array<{ id: string; name: string }>;
}

export interface CompetitorSuggestionItem {
  name: string;
  reason?: string;
}

export interface CompetitorSuggestionResponse {
  suggestions: CompetitorSuggestionItem[];
}

export interface PromptVersion {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Prompt {
  id: string;
  promptText: string;
  active: boolean;
  category?: { id: string; name: string };
}

export interface Run {
  id: string;
  brandId: string;
  brand: { id: string; name: string };
  periodStart: string;
  periodEnd: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priaReports?: Array<{ priaTotal: number }>;
}

export interface PRIAReport {
  id: string;
  runId: string;
  brandId: string;
  priaTotal: number;
  priaByCategoryJson: Record<string, number>;
  createdAt: string;
  run: {
    brand: { id: string; name: string };
    periodStart: string;
    periodEnd: string;
  };
}

export interface RankingEntry {
  brandId: string;
  brandName: string;
  pria: number;
  runId: string;
  periodStart: string;
  periodEnd: string;
}

// API calls
export const tenantsApi = {
  get: (id: string) => api<Tenant>(`/api/tenants/${id}`),
  getByCode: (code: string) => api<Tenant>(`/api/tenants/by-code/${code}`),
  getChildren: (id: string) => api<Tenant[]>(`/api/tenants/${id}/children`),
  getUsage: (id: string, year?: number, month?: number) =>
    api<{
      consumption: { runs: number; runsLimit: number; canCreateRun: boolean };
    }>(`/api/tenants/${id}/usage${year && month ? `?year=${year}&month=${month}` : ''}`),
};

export const brandsApi = {
  list: (tenantId: string) => api<Brand[]>(`/api/brands?tenantId=${tenantId}`),
  get: (id: string) => api<Brand>(`/api/brands/${id}`),
  create: (data: {
    tenantId: string;
    name: string;
    domain?: string;
    industry?: string;
    productType?: string;
    country?: string;
    objective?: string;
    description?: string;
  }) =>
    api<Brand>('/api/brands', { method: 'POST', body: JSON.stringify(data) }),
  addCompetitor: (brandId: string, data: { name: string; aliases?: string[] }) =>
    api(`/api/brands/${brandId}/competitors`, { method: 'POST', body: JSON.stringify(data) }),
  suggestCompetitors: (
    brandId: string,
    data: {
      industry?: string;
      productType?: string;
      country?: string;
      objective?: string;
      useCases?: string[];
      factors?: string[];
    }
  ) =>
    api<CompetitorSuggestionResponse>(`/api/brands/${brandId}/competitor-suggestions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const promptsApi = {
  getVersions: (tenantId: string) =>
    api<PromptVersion[]>(`/api/prompts/prompt-versions?tenantId=${tenantId}`),
  getPrompts: (versionId: string) =>
    api<Prompt[]>(`/api/prompts/prompts?versionId=${versionId}`),
  createVersion: (data: { tenantId: string; name: string }) =>
    api<PromptVersion>('/api/prompts/prompt-versions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createPrompt: (data: { promptVersionId: string; promptText: string; active?: boolean }) =>
    api<Prompt>('/api/prompts/prompts', { method: 'POST', body: JSON.stringify(data) }),
};

export const runsApi = {
  list: (tenantId?: string, brandId?: string) =>
    api<Run[]>(
      `/api/runs${tenantId || brandId ? `?${tenantId ? `tenantId=${tenantId}` : ''}${brandId ? `&brandId=${brandId}` : ''}` : ''}`
    ),
  get: (id: string) => api<Run>(`/api/runs/${id}`, { cache: 'no-store' }),
  create: (data: {
    tenantId: string;
    brandId: string;
    periodStart: string;
    periodEnd: string;
  }) => api<Run>('/api/runs', { method: 'POST', body: JSON.stringify(data) }),
  execute: (
    runId: string,
    data?: { promptVersionId?: string; model?: string; temperature?: number; maxTokens?: number; force?: boolean }
  ) =>
    api(`/api/runs/${runId}/execute`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  addResult: (runId: string, promptId: string, responseText: string) =>
    api(`/api/runs/${runId}/results`, {
      method: 'POST',
      body: JSON.stringify({ promptId, responseText }),
    }),
};

export const reportsApi = {
  getPRIA: (brandId: string, versionId?: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ brandId });
    if (versionId) params.append('versionId', versionId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api<PRIAReport[]>(`/api/reports/pria?${params.toString()}`);
  },
  getRanking: (tenantId: string, versionId?: string, periodStart?: string, periodEnd?: string) => {
    const params = new URLSearchParams({ tenantId });
    if (versionId) params.append('versionId', versionId);
    if (periodStart) params.append('periodStart', periodStart);
    if (periodEnd) params.append('periodEnd', periodEnd);
    return api<RankingEntry[]>(`/api/reports/ranking?${params.toString()}`);
  },
};
