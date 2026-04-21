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
    const err = new Error(error.error || `HTTP error! status: ${response.status}`);
    if (error.code) (err as Error & { code?: string }).code = error.code;
    throw err;
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

export type RunScheduleType = 'semanal' | 'quincenal' | 'mensual';

export interface Brand {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  productType?: string;
  country?: string;
  objective?: string;
  runSchedule?: RunScheduleType | null;
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
  name?: string | null;
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

export interface LeadContact {
  id: string;
  name?: string;
  email: string;
  role?: string;
  source: string;
  score?: number;
  verified: boolean;
  status: string;
}

export interface LeadEmail {
  id: string;
  subject: string;
  body: string;
  provider?: string;
  status: string;
  sentAt?: string;
}

export interface LeadSource {
  id: string;
  tenantId: string;
  brandId?: string;
  runId?: string;
  promptId?: string;
  competitorName: string;
  competitorDomain?: string;
  evidenceJson?: Record<string, unknown>;
  brand?: { id: string; name: string; domain?: string };
  contacts: LeadContact[];
  emails: LeadEmail[];
  createdAt: string;
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

export interface BrandAutoCreateResponse {
  brand: Brand;
  classification: {
    domain: string;
    brandName: string;
    businessType: string;
    category: string;
    subcategory: string;
    geoMarket: string;
    sizeSegment: string;
    aliases: string[];
    description: string;
    confidence: number;
    knownEntity: boolean;
    reasoning: string;
  };
  competitorCandidates: Array<{ domain: string; name: string; reason: string }>;
  competitorsCreated: number;
  competitorsRejected: Array<{ domain: string; name: string; reason?: string }>;
  promptsCreated: number;
}

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
  autoCreate: (data: { tenantId: string; domain: string; promptCount?: number; versionName?: string }) =>
    api<BrandAutoCreateResponse>('/api/brands/auto-create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  classifyPreview: (domain: string) =>
    api<{
      classification: BrandAutoCreateResponse['classification'];
      candidates: BrandAutoCreateResponse['competitorCandidates'];
    }>('/api/brands/classify-preview', {
      method: 'POST',
      body: JSON.stringify({ domain }),
    }),
  addCompetitor: (brandId: string, data: { name: string; domain?: string; aliases?: string[] }) =>
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
  updateRunSchedule: (brandId: string, runSchedule: RunScheduleType | null) =>
    api<Brand>(`/api/brands/${brandId}`, {
      method: 'PATCH',
      body: JSON.stringify({ runSchedule }),
    }),
};

export const promptsApi = {
  getVersions: (tenantId: string) =>
    api<PromptVersion[]>(`/api/prompts/prompt-versions?tenantId=${tenantId}`),
  getPrompts: (versionId: string) =>
    api<Prompt[]>(`/api/prompts/prompts?versionId=${versionId}`, { cache: 'no-store' }),
  createVersion: (data: { tenantId: string; name: string }) =>
    api<PromptVersion>('/api/prompts/prompt-versions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createPrompt: (data: { promptVersionId: string; name?: string; promptText: string; active?: boolean }) =>
    api<Prompt>('/api/prompts/prompts', { method: 'POST', body: JSON.stringify(data) }),
};

export const runsApi = {
  list: (tenantId?: string, brandId?: string) =>
    api<Run[]>(
      `/api/runs${tenantId || brandId ? `?${tenantId ? `tenantId=${tenantId}` : ''}${brandId ? `&brandId=${brandId}` : ''}` : ''}`
    ),
  get: (id: string) => api<Run>(`/api/runs/${id}`, { cache: 'no-store' }),
  getDebug: (runId: string) =>
    api<{
      runId: string;
      promptVersionUsed: { id: string; name: string | null } | null;
      resultsCount: number;
      distinctPromptIdsInResults: string[];
      results: { resultId: string; promptId: string; createdAt: string }[];
      promptsUsedInRun: { id: string; promptTextPreview: string }[];
      allPromptsInVersionCount: number;
      allPromptsInVersion: { id: string; promptTextPreview: string; createdAt: string }[];
    }>(`/api/runs/${runId}/debug`, { cache: 'no-store' }),
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
  getBrandDashboard: (brandId: string) =>
    api<BrandDashboard>(`/api/reports/brand-dashboard?brandId=${brandId}`),
  getPlatformDashboard: () => api<PlatformDashboard>('/api/reports/platform-dashboard'),
};

export const leadsApi = {
  list: (tenantId: string) => api<LeadSource[]>(`/api/leads?tenantId=${tenantId}`),
  discover: (data: { tenantId: string; runId?: string; domain?: string; enrich?: boolean }) =>
    api<{ leads: LeadSource[] }>(`/api/leads/discover`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  generateEmail: (data: { leadSourceId: string; leadContactId: string }) =>
    api<LeadEmail>(`/api/leads/email`, { method: 'POST', body: JSON.stringify(data) }),
};

export interface BrandDashboardComparisonRow {
  name: string;
  type: string;
  appearances: number;
  averagePosition: number;
  share: number;
  sampleReason?: string;
}

export interface BrandDashboard {
  brand: { id: string; name: string; domain?: string; industry?: string; competitors: { id: string; name: string }[] };
  cleexsScore: number;
  comparison: BrandDashboardComparisonRow[];
  latestRun: { id: string; periodStart: string; periodEnd: string } | null;
  trend: PRIAReport[];
}

export interface PlatformDashboardSummary {
  totalRuns: number;
  runsToday: number;
  completedRuns: number;
  failedRuns: number;
  runningRuns: number;
  pendingRuns: number;
  successRate: number;
  averageCleexsScore: number;
}

export interface PlatformDashboardDailyRun {
  date: string;
  runs: number;
  avgScore: number;
}

export interface PlatformDashboardIndustryRow {
  industry: string;
  runs: number;
  avgScore: number;
}

export interface PlatformDashboardLatestRun {
  id: string;
  brandName: string;
  industry: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  score: number | null;
}

export interface PlatformDashboard {
  summary: PlatformDashboardSummary;
  dailyRuns: PlatformDashboardDailyRun[];
  industries: PlatformDashboardIndustryRow[];
  latestRuns: PlatformDashboardLatestRun[];
  referrals: {
    totalTrackedDiagnostics: number;
    topReferrers: Array<{
      refCode: string;
      visits: number;
      completedDiagnostics: number;
      capturedEmails: number;
      completionRate: number;
      latestAt: string;
      topSource: string;
    }>;
    topSources: Array<{
      source: string;
      visits: number;
    }>;
  };
}

// Diagnóstico público (flujo sin login)
export interface PublicDiagnosticStep {
  id: string;
  label: string;
  completed: boolean;
}

export interface PublicDiagnosticPromptResult {
  category: string;
  score: number;
  promptText?: string;
  responseText?: string;
  top3Json?: Array<{ position: number; name: string; type: string; reason?: string }>;
  flags?: Record<string, boolean>;
}

export interface PublicDiagnosticRunResult {
  brandId?: string;
  brandName: string;
  cleexsScore: number;
  competitors: string[];
  brandAliases: string[];
  promptResults: PublicDiagnosticPromptResult[];
}

/** Análisis simple (un solo proveedor). goldFallback = diagnóstico Gold pero solo OpenAI disponible */
export interface DiagnosticAnalysisSingle {
  goldFallback?: true;
  resumenEjecutivo?: string;
  contextoCompetitivo?: string;
  comentariosPorIntencion?: Array<{
    intencion: string;
    comentario: string;
    score: number;
    interpretacion?: string;
  }>;
  aspectosAdicionales?: string;
  fortalezas?: string[];
  debilidades?: string[];
  sugerencias?: string[];
  proximosPasos?: string[];
}

/** Análisis Gold: OpenAI + Gemini + perspectiva combinada */
export interface DiagnosticAnalysisGold {
  tier: 'gold';
  metrics: {
    cleexsScore: number;
    intentionScores: Array<{ label: string; score: number; weight: number }>;
    comparisonSummary: Array<{ name: string; type: string; appearances: number; share: number }>;
  };
  analisisOpenAI: DiagnosticAnalysisSingle;
  analisisGemini: DiagnosticAnalysisSingle;
  perspectivaAmbos: string;
}

export type DiagnosticAnalysisJson = DiagnosticAnalysisSingle | DiagnosticAnalysisGold;

export function isDiagnosticAnalysisGold(
  a: DiagnosticAnalysisJson | null | undefined
): a is DiagnosticAnalysisGold {
  return !!a && typeof a === 'object' && (a as { tier?: string }).tier === 'gold';
}

export interface PublicDiagnosticTrendPoint {
  label: string;
  score: number;
  date: string;
}

export interface PublicDiagnosticSatelliteModule {
  status: 'completed' | 'failed' | 'timeout' | 'skipped';
  targetUrl?: string;
  overallScore: number;
  tools: Record<string, { score: number; error?: string; detail?: Record<string, unknown> }>;
  actions: Array<{
    priority: string;
    source: string;
    message: string;
    detail?: string;
    action?: string;
  }>;
  error?: string;
}

export interface PublicDiagnostic {
  id: string;
  domain: string;
  brandName: string;
  industry?: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  tier?: 'gold' | 'freemium';
  isFirstRun?: boolean;
  showFullReport?: boolean;
  runId?: string | null;
  runGeminiId?: string | null;
  shareSlug?: string | null;
  steps?: PublicDiagnosticStep[];
  progressPercent?: number;
  runResult?: PublicDiagnosticRunResult;
  runResultGemini?: PublicDiagnosticRunResult;
  analysisJson?: DiagnosticAnalysisJson | null;
  trendData?: PublicDiagnosticTrendPoint[];
  satelliteModule?: PublicDiagnosticSatelliteModule | null;
}

export interface PublicDiagnosticShareUnlock {
  goldUnlocked: boolean;
  viralUnlocked: boolean;
  uniqueVisitCount: number;
  visitsNeeded: number;
  viralUnlockMin: number;
}

export interface PublicDiagnosticShareResponse {
  slug: string;
  diagnosticId: string;
  brandName: string;
  industry?: string | null;
  domain: string;
  status: string;
  tier: 'gold' | 'freemium';
  cleexsScore: number | null;
  resumenTeaser: string;
  unlock: PublicDiagnosticShareUnlock;
  shareFullUnlocked: boolean;
  preview?: {
    totalPrompts: number;
    avgPromptScore: number;
    topCategory: string | null;
    brandTop3PresencePct: number;
    competitorCount: number;
    geminiStatus: 'ready' | 'running' | 'not_available';
  };
  analysisJson?: DiagnosticAnalysisJson | null;
  satelliteModule?: PublicDiagnosticSatelliteModule | null;
  runResult?: PublicDiagnosticRunResult;
  runResultGemini?: PublicDiagnosticRunResult;
  trendData?: PublicDiagnosticTrendPoint[];
}

export const publicDiagnosticApi = {
  create: (
    brandName?: string,
    url?: string,
    tier?: 'gold' | 'freemium',
    tracking?: {
      refCode?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
    }
  ) =>
    api<{ diagnosticId: string }>('/api/public/diagnostic', {
      method: 'POST',
      body: JSON.stringify({
        ...(brandName != null && brandName !== '' && { brandName }),
        ...(url != null && url !== '' && { url }),
        ...(tier === 'gold' && { tier: 'gold' as const }),
        ...(tracking?.refCode ? { refCode: tracking.refCode } : {}),
        ...(tracking?.utmSource ? { utmSource: tracking.utmSource } : {}),
        ...(tracking?.utmMedium ? { utmMedium: tracking.utmMedium } : {}),
        ...(tracking?.utmCampaign ? { utmCampaign: tracking.utmCampaign } : {}),
      }),
    }),
  setEmail: (id: string, email: string) =>
    api<{ ok: boolean; emailSent?: boolean | null; emailError?: 'provider_rejected' | 'send_failed' }>(
      `/api/public/diagnostic/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ email }),
      }
    ),
  get: (id: string, tier?: 'gold' | 'freemium') =>
    api<PublicDiagnostic>(
      `/api/public/diagnostic/${id}${tier ? `?tier=${tier}` : ''}${tier ? '&' : '?'}_=${Date.now()}`,
      { cache: 'no-store' }
    ),
};

export const publicDiagnosticShareApi = {
  get: (slug: string) =>
    api<PublicDiagnosticShareResponse>(
      `/api/public/diagnostic/share/${encodeURIComponent(slug)}`,
      { cache: 'no-store' }
    ),
  registerVisit: (slug: string, visitorId: string) =>
    api<{
      ok: boolean;
      uniqueVisitCount: number;
      viralUnlocked: boolean;
      shareFullUnlocked: boolean;
      visitsNeeded: number;
    }>(`/api/public/diagnostic/share/${encodeURIComponent(slug)}/visit`, {
      method: 'POST',
      body: JSON.stringify({ visitorId }),
    }),
};
