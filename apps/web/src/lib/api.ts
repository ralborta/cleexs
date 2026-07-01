import { resolveApiBaseUrl } from '@/lib/api-base-url';

const API_URL = resolveApiBaseUrl();

export async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 20000);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: options?.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('La API tardó demasiado en responder. Refrescá o probá de nuevo.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }

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
  leadContactId: string;
  subject: string;
  body: string;
  provider?: string;
  status: string;
  sentAt?: string;
  metaJson?: Record<string, unknown>;
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
  list: (tenantId?: string, brandId?: string, primaryOnly?: boolean) => {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    if (brandId) params.set('brandId', brandId);
    if (primaryOnly) params.set('primaryOnly', '1');
    const qs = params.toString();
    return api<Run[]>(`/api/runs${qs ? `?${qs}` : ''}`);
  },
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
  sendEmail: (
    id: string,
    data: { mode: 'shadow' | 'real'; shadowTo?: string; subject?: string; body?: string }
  ) =>
    api<{ ok: true; mode: 'shadow' | 'real'; provider: string; to: string; originalTo: string; externalId?: string | null }>(
      `/api/leads/email/${id}/send`,
      { method: 'POST', body: JSON.stringify(data) }
    ),
  emailStats: (windowDays = 30) => api<OutreachStats>(`/api/leads/email/stats?windowDays=${windowDays}`),
  listEmails: (params: { limit?: number; windowDays?: number; status?: string; mode?: 'shadow' | 'real' } = {}) => {
    const search = new URLSearchParams();
    if (params.limit) search.set('limit', String(params.limit));
    if (params.windowDays) search.set('windowDays', String(params.windowDays));
    if (params.status) search.set('status', params.status);
    if (params.mode) search.set('mode', params.mode);
    const qs = search.toString();
    return api<OutreachEmailRow[]>(`/api/leads/email/list${qs ? `?${qs}` : ''}`);
  },
  getTemplate: () => api<OutreachTemplate>(`/api/leads/template`),
  saveTemplate: (data: { subject: string; body: string; useAi?: boolean; updatedBy?: string }) =>
    api<OutreachTemplate & { ok: true }>(`/api/leads/template`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export interface OutreachTemplate {
  key: string;
  subject: string;
  body: string;
  useAi: boolean;
  openAiConfigured?: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  variables?: string[];
  example?: { brandName: string; competitorName: string; top3: string };
}

export interface OutreachStats {
  windowDays: number;
  asOf: string;
  totals: {
    contacts: number;
    drafts: number;
    queued: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
    failed: number;
    deliveryDelayed: number;
  };
  byMode: { shadow: number; real: number; unknown: number };
  rates: {
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  todayRealSent: number;
  dailyLimit: number;
  domainVerified: boolean;
  resendWebhook: {
    secretConfigured: boolean;
    eventsTotalLastWindow: number;
    eventsByTypeLastWindow: Record<string, number>;
    uniqueEmailsByStageLastWindow: {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
      complained: number;
      failed: number;
    };
    matchedToOutreach: number;
  };
}

// =========================
// Reportes internos (admin)
// =========================

export type ReportWindowDays = 7 | 30 | 90;

export type SponsorChannelBreakdownRow = {
  refCode: string;
  name: string;
  web: { diagnostics: number; withEmail: number };
  whatsapp: { diagnostics: number; withEmail: number };
  total: { diagnostics: number; withEmail: number };
};

export type ReferrerReportRow = {
  refCode: string;
  name: string;
  registered: boolean;
  active: boolean;
  isSponsor: boolean;
  category: 'sponsor' | 'registered' | 'share_followup' | 'inactive_legacy' | 'other';
};

export interface AcquisitionReport {
  windowDays: number;
  asOf: string;
  totals: {
    diagnosticsInWindow: number;
    diagnosticsAllTime: number;
    completedInWindow: number;
    withEmailInWindow: number;
    goldInWindow: number;
    completionRate: number;
    emailCaptureRate: number;
    goldUpgradeRate: number;
  };
  dailySeries: Array<{
    date: string;
    created: number;
    completed: number;
    withEmail: number;
  }>;
  channels: Array<{ channel: string; count: number; share: number }>;
  topReferrers: Array<
    ReferrerReportRow & {
      visits: number;
      completed: number;
      capturedEmails: number;
      completionRate: number;
      latestAt: string;
    }
  >;
  sponsorBreakdown: SponsorChannelBreakdownRow[];
  topUtmSources: Array<{ source: string; count: number }>;
  latestDiagnostics: Array<{
    id: string;
    createdAt: string;
    brandName: string;
    domain: string;
    email: string | null;
    status: string;
    tier: string | null;
    refCode: string | null;
    referrerName: string | null;
    utmSource: string | null;
    sourceChannel: string | null;
  }>;
}

export interface CleexsScoreReport {
  windowDays: number;
  asOf: string;
  totals: {
    reportsInWindow: number;
    brandsAnalyzed: number;
    averageScore: number;
  };
  distribution: {
    poor: number;
    low: number;
    mid: number;
    good: number;
    excellent: number;
  };
  topBrands: Array<{
    brandId: string;
    brandName: string;
    domain: string | null;
    industry: string | null;
    latestScore: number;
    avgScore: number;
    latestAt: string;
    runs: number;
  }>;
  bottomBrands: Array<{
    brandId: string;
    brandName: string;
    domain: string | null;
    industry: string | null;
    latestScore: number;
    avgScore: number;
    latestAt: string;
    runs: number;
  }>;
  industries: Array<{ industry: string; runs: number; avgScore: number }>;
  dailySeries: Array<{ date: string; runs: number; avgScore: number }>;
}

export interface EmailOutreachReport {
  windowDays: number;
  asOf: string;
  weekly: {
    campaignsConfigured: number;
    totals: {
      sent: number;
      failed: number;
      skipped: number;
      pending: number;
    };
    eventsByType: Record<string, number>;
    dailySeries: Array<{ date: string; sends: number }>;
  };
  outreach: {
    contactsAllTime: number;
    totals: {
      sent: number;
      delivered: number;
      opened: number;
      clicked: number;
      bounced: number;
      complained: number;
      failed: number;
      delivery_delayed: number;
      shadow: number;
      real: number;
      drafts: number;
    };
    rates: {
      deliveryRate: number;
      openRate: number;
      bounceRate: number;
    };
    topDomains: Array<{
      domain: string;
      sent: number;
      opened: number;
      clicked: number;
      openRate: number;
      clickRate: number;
    }>;
    dailySeries: Array<{ date: string; sends: number }>;
  };
  integrations: {
    resendWebhookSecretConfigured: boolean;
    outreachDomainVerified: boolean;
  };
}

export interface BrandsOverviewItem {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  country: string | null;
  category: string | null;
  runSchedule: string | null;
  createdAt: string;
  updatedAt: string;
  runsTotal: number;
  lastRun: { id: string; status: string; createdAt: string } | null;
  lastScore: number | null;
  lastScoreAt: string | null;
  tenant: {
    id: string;
    code: string;
    type: string;
    status: string;
    plan: string | null;
  } | null;
}

export interface BrandsOverviewReport {
  asOf: string;
  summary: {
    total: number;
    withScore: number;
    scoredAvg: number;
    premium: number;
    withRuns: number;
  };
  items: BrandsOverviewItem[];
}

export interface SystemConfigReport {
  asOf: string;
  environment: {
    nodeVersion: string;
    uptimeSec: number;
    hostname: string | null;
    railwayCommit: string | null;
    railwayBranch: string | null;
    railwayDomain: string | null;
    nodeEnv: string;
  };
  integrations: {
    openai: { configured: boolean; model: string; competitorsModel: string };
    gemini: { configured: boolean };
    resend: { apiKeyConfigured: boolean; webhookSecretConfigured: boolean };
    smtp: { configured: boolean; host: string | null; port: number; fromEmail: string | null; fromName: string | null };
    mercadopago: { accessTokenConfigured: boolean; webhookSecretConfigured: boolean; webhookUrl: string };
    firecrawl: { configured: boolean };
    hunter: { configured: boolean };
    serper: { configured: boolean };
    builderbot: { configured: boolean; baseUrl: string };
    whatsapp: { apiKeyConfigured: boolean; dailyLimit: number };
    satellite: { enabled: boolean; baseUrl: string | null };
    database: { configured: boolean };
  };
  variables: {
    outreach: {
      fromEmail: string | null;
      fromName: string | null;
      replyTo: string | null;
      shadowTo: string | null;
      dailyLimit: number;
      domainVerified: boolean;
    };
    admin: {
      apiSecretConfigured: boolean;
      requireAuth: boolean;
      fullAccessEmails: number;
      allowActorQuery: boolean;
    };
    auth: {
      portalJwtSecretConfigured: boolean;
      cronSecretConfigured: boolean;
    };
    urls: {
      frontend: string | null;
      frontendList: string | null;
      appUrl: string | null;
      marketingUrl: string;
      apiBase: string;
    };
    billing: {
      usdToArsRate: number | null;
      currency: string | null;
    };
    publicDiagnostic: {
      defaultCountry: string;
      marketConfidenceMin: number;
    };
  };
  webhooks: {
    mercadopago: {
      url: string;
      eventsLast30Days: number;
      lastEventAt: string | null;
      lastEventSource: string | null;
      configured: boolean;
    };
    resend: {
      url: string;
      eventsLast30Days: number;
      lastEventAt: string | null;
      lastEventType: string | null;
      eventsByType: Record<string, number>;
      configured: boolean;
    };
  };
  cron: {
    weeklyEmails: {
      lastSendAt: string | null;
      lastSendStatus: string | null;
      sendsLast30Days: number;
      sendsLast7Days: number;
      campaignsActive: number;
      cronSecretConfigured: boolean;
    };
    outreach: {
      dailyLimit: number;
      todayRealSent: number;
      last7DaysSent: number;
      domainVerified: boolean;
    };
  };
  database: {
    tenants: number;
    users: number;
    brands: number;
    runs: number;
    payments: number;
    subscriptions: number;
    leadContacts: number;
    leadEmails: number;
    publicDiagnostics: number;
  };
}

export interface AdminPaymentItem {
  id: string;
  status: string;
  currency: string;
  amountArs: number | null;
  amountUsd: number | null;
  netReceivedAmountArs: number | null;
  mpPaymentId: string | null;
  mpMerchantOrderId: string | null;
  mpPreapprovalId: string | null;
  paymentMethodId: string | null;
  paymentTypeId: string | null;
  statusDetail: string | null;
  payerEmail: string | null;
  paidAt: string | null;
  createdAt: string;
  tenant: { id: string; tenantCode: string; planName: string | null } | null;
  subscription:
    | { id: string; billingInterval: string; status: string; planName: string | null }
    | null;
}

export interface AdminPaymentsReport {
  items: AdminPaymentItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  summary: {
    byStatus: Record<string, number>;
    approvedAllTime: {
      count: number;
      totalArs: number;
      totalUsd: number;
      netReceivedArs: number;
    };
    approvedThisMonth: {
      count: number;
      totalArs: number;
      totalUsd: number;
      netReceivedArs: number;
    };
  };
}

export const internalReportsApi = {
  acquisition: (windowDays: ReportWindowDays = 30) =>
    api<AcquisitionReport>(`/api/reports/internal/acquisition?windowDays=${windowDays}`),
  cleexsScore: (windowDays: ReportWindowDays = 30) =>
    api<CleexsScoreReport>(`/api/reports/internal/cleexs-score?windowDays=${windowDays}`),
  emailOutreach: (windowDays: ReportWindowDays = 30) =>
    api<EmailOutreachReport>(`/api/reports/internal/email-outreach?windowDays=${windowDays}`),
  brands: (params: { search?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.limit) qs.set('limit', String(params.limit));
    const tail = qs.toString();
    return api<BrandsOverviewReport>(`/api/reports/internal/brands${tail ? `?${tail}` : ''}`);
  },
  systemConfig: () => api<SystemConfigReport>('/api/reports/internal/system-config'),
  payments: (
    params: { status?: string; search?: string; page?: number; pageSize?: number } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.search) qs.set('search', params.search);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const tail = qs.toString();
    return api<AdminPaymentsReport>(`/api/reports/internal/payments${tail ? `?${tail}` : ''}`);
  },
  weeklyEmailsStats: (
    params: { windowDays?: number; campaignLimit?: number; recipientsLimit?: number } = {}
  ) => {
    const qs = new URLSearchParams();
    if (params.windowDays) qs.set('windowDays', String(params.windowDays));
    if (params.campaignLimit) qs.set('campaignLimit', String(params.campaignLimit));
    if (params.recipientsLimit) qs.set('recipientsLimit', String(params.recipientsLimit));
    const tail = qs.toString();
    return api<WeeklyEmailsStatsReport>(
      `/api/reports/internal/weekly-emails-stats${tail ? `?${tail}` : ''}`
    );
  },
};

export type WeeklyEmailLogStatus = 'sent' | 'failed' | 'skipped' | 'pending';

export interface WeeklyEmailCampaignSummary {
  campaignSlug: string;
  firstSendAt: string;
  lastSendAt: string;
  recipients: number;
  sent: number;
  failed: number;
  skipped: number;
  pending: number;
  successRate: number;
  segment: string | null;
  weekSlot: number | null;
  mode: string | null;
}

export interface WeeklyEmailRecipient {
  id: string;
  recipientEmail: string;
  campaignSlug: string;
  status: WeeklyEmailLogStatus;
  errorMessage: string | null;
  externalId: string | null;
  scoreBucket: string | null;
  cleexsScore: number | null;
  segment: string | null;
  weekSlot: number | null;
  tenantCode: string | null;
  createdAt: string;
}

export interface WeeklyEmailsStatsReport {
  generatedAt: string;
  windowDays: number;
  campaignsTracked: number;
  allTime: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    pending: number;
    firstSendAt: string | null;
    lastSendAt: string | null;
    lastCampaignSlug: string | null;
    lastStatus: WeeklyEmailLogStatus | null;
  };
  window: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    pending: number;
    sentToday: number;
    sentLast7: number;
  };
  campaigns: WeeklyEmailCampaignSummary[];
  recentRecipients: WeeklyEmailRecipient[];
  cron: {
    cronSecretConfigured: boolean;
    scheduleHint: string;
  };
}

export interface AdminPlanItem {
  id: string;
  name: string;
  tier: string | null;
  description: string | null;
  ctaLabel: string | null;
  badge: string | null;
  isRecommended: boolean;
  isPublic: boolean;
  displayOrder: number;
  priceMonthly: number | null;
  runsPerMonth: number;
  promptsActiveLimit: number;
  brandsLimit: number;
  competitorsLimit: number;
  retentionMonths: number;
  automationEnabled: boolean;
  features: string[];
  engines: string[];
  tenantsCount?: number;
  subscriptionsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminPlansResponse {
  items: AdminPlanItem[];
}

export type AdminPlanUpdate = Partial<
  Omit<
    AdminPlanItem,
    'id' | 'tenantsCount' | 'subscriptionsCount' | 'createdAt' | 'updatedAt'
  >
>;

export const adminPlansApi = {
  list: () => api<AdminPlansResponse>('/api/reports/internal/plans'),
  update: (id: string, patch: AdminPlanUpdate) =>
    api<AdminPlanItem>(`/api/reports/internal/plans/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
};

export interface OutreachEmailRow {
  id: string;
  createdAt: string;
  sentAt: string | null;
  updatedAt: string;
  status: string;
  provider: string | null;
  subject: string;
  mode: 'shadow' | 'real' | null;
  effectiveTo: string | null;
  originalTo: string | null;
  externalId: string | null;
  lastResendEvent: string | null;
  competitor: string;
  competitorDomain: string | null;
  contactEmail: string;
}

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
    topReferrers: Array<
      ReferrerReportRow & {
        visits: number;
        completedDiagnostics: number;
        capturedEmails: number;
        completionRate: number;
        latestAt: string;
        topSource: string;
      }
    >;
    topSources: Array<{
      source: string;
      visits: number;
    }>;
    sponsorBreakdown: SponsorChannelBreakdownRow[];
  };
  whatsappReferrals: {
    totalDiagnostics: number;
    topReferrers: Array<
      ReferrerReportRow & {
        visits: number;
        completedDiagnostics: number;
        capturedEmails: number;
        completionRate: number;
        latestAt: string;
      }
    >;
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
  competitorDetails?: Array<{ name: string; domain?: string | null }>;
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

/** Análisis Gold: OpenAI + Gemini (+ opcional Perplexity y Claude via OpenRouter) + perspectiva combinada */
export interface DiagnosticAnalysisGold {
  tier: 'gold';
  metrics: {
    cleexsScore: number;
    intentionScores: Array<{ label: string; score: number; weight: number }>;
    comparisonSummary: Array<{ name: string; type: string; appearances: number; share: number }>;
  };
  analisisOpenAI: DiagnosticAnalysisSingle;
  analisisGemini: DiagnosticAnalysisSingle;
  /** Presente solo si OPENROUTER_API_KEY esta configurada y Perplexity respondio. */
  analisisPerplexity?: DiagnosticAnalysisSingle;
  /** Presente solo si OPENROUTER_API_KEY esta configurada y Claude respondio. */
  analisisClaude?: DiagnosticAnalysisSingle;
  /** Sintesis OpenAI + Gemini (legado). */
  perspectivaAmbos: string;
  /** Sintesis combinada de los 4 LLMs cuando Perplexity o Claude estan disponibles. */
  perspectivaTodas?: string;
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

/** Domain Rating (Ahrefs) — autoridad SEO del dominio, complemento al Cleexs Score. */
export interface DomainRatingSnapshot {
  brand: { name: string; domain: string; rating: number | null };
  competitors: Array<{ name: string; domain: string | null; rating: number | null }>;
  leaderRating: number | null;
  avgCompetitorRating: number | null;
  gapVsLeader: number | null;
  insight: string | null;
}

export interface PublicDiagnosticSatelliteModule {
  status: 'completed' | 'failed' | 'timeout' | 'skipped' | 'pending';
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

export interface PublicDiagnosticSetupDraft {
  suggestedCompetitorUrls: string[];
  marketCountry?: string;
  useSerp?: boolean;
  /** País sugerido (nombre en español) para que el usuario confirme. */
  suggestedCountry?: string;
  /** Rubro/industria sugerido por la IA para que el usuario confirme/edite. */
  suggestedIndustry?: string;
  /** País confirmado por el usuario. */
  confirmedCountry?: string;
  /** Rubro confirmado por el usuario. */
  confirmedIndustry?: string;
  /** Motores de IA elegidos (registrados para plan pago). */
  selectedEngines?: string[];
  /** URLs de competidor confirmadas al iniciar el análisis. */
  confirmedCompetitorUrls?: string[];
  /** ISO timestamp: la detección automática ya terminó (aunque sea sin resultados). */
  competitorRescueAttemptedAt?: string;
}

export interface PublicDiagnostic {
  id: string;
  domain: string;
  brandName: string;
  status:
    | 'pending'
    | 'detecting_competitors'
    | 'awaiting_user'
    | 'running'
    | 'completed'
    | 'failed';
  tier?: 'gold' | 'freemium';
  sourceChannel?: string | null;
  resultUrl?: string | null;
  channelView?: 'whatsapp_lite';
  isFirstRun?: boolean;
  showFullReport?: boolean;
  showPlanConquistarUpsell?: boolean;
  runId?: string | null;
  runGeminiId?: string | null;
  runPerplexityId?: string | null;
  runClaudeId?: string | null;
  /** Estado del segundo run (Gemini), si existe `runGeminiId`. */
  geminiRunStatus?: 'pending' | 'running' | 'completed' | 'failed' | null;
  /** Estado del run Perplexity (OpenRouter), si existe `runPerplexityId`. Solo gold. */
  perplexityRunStatus?: 'pending' | 'running' | 'completed' | 'failed' | null;
  /** Estado del run Claude (OpenRouter), si existe `runClaudeId`. Solo gold. */
  claudeRunStatus?: 'pending' | 'running' | 'completed' | 'failed' | null;
  shareSlug?: string | null;
  email?: string | null;
  /** URLs sugeridas y contexto antes de confirmar correo + competidores. */
  setupDraft?: PublicDiagnosticSetupDraft | null;
  steps?: PublicDiagnosticStep[];
  progressPercent?: number;
  runResult?: PublicDiagnosticRunResult;
  runResultGemini?: PublicDiagnosticRunResult;
  runResultPerplexity?: PublicDiagnosticRunResult;
  runResultClaude?: PublicDiagnosticRunResult;
  analysisJson?: DiagnosticAnalysisJson | null;
  trendData?: PublicDiagnosticTrendPoint[];
  satelliteModule?: PublicDiagnosticSatelliteModule | null;
  domainRating?: DomainRatingSnapshot | null;
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
    input: {
      url: string;
      brandName?: string;
      tier?: 'gold' | 'freemium';
      useSerp?: boolean;
      tracking?: {
        refCode?: string;
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
      };
    },
    opts?: { visitorId?: string }
  ) =>
    api<{ diagnosticId: string }>('/api/public/diagnostic', {
      method: 'POST',
      body: JSON.stringify({
        url: input.url,
        ...(input.brandName != null && input.brandName !== '' && { brandName: input.brandName }),
        ...(input.tier === 'gold' && { tier: 'gold' as const }),
        ...(typeof input.useSerp === 'boolean' ? { useSerp: input.useSerp } : {}),
        ...(input.tracking?.refCode ? { refCode: input.tracking.refCode } : {}),
        ...(input.tracking?.utmSource ? { utmSource: input.tracking.utmSource } : {}),
        ...(input.tracking?.utmMedium ? { utmMedium: input.tracking.utmMedium } : {}),
        ...(input.tracking?.utmCampaign ? { utmCampaign: input.tracking.utmCampaign } : {}),
      }),
      headers: {
        ...(opts?.visitorId ? { 'x-visitor-id': opts.visitorId } : {}),
      },
    }),
  start: (
    id: string,
    body: {
      email: string;
      competitorUrls: string[];
      useSerp?: boolean;
      country?: string;
      industry?: string;
      engines?: string[];
    },
    opts?: { visitorId?: string }
  ) =>
    api<{ ok: boolean; diagnosticId: string }>(`/api/public/diagnostic/${id}/start`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        ...(opts?.visitorId ? { 'x-visitor-id': opts.visitorId } : {}),
      },
    }),
  confirmContext: (
    id: string,
    body: { country?: string; industry?: string; engines?: string[] }
  ) =>
    api<{
      ok: boolean;
      redetecting: boolean;
      confirmedCountry: string;
      confirmedIndustry: string;
    }>(`/api/public/diagnostic/${id}/confirm-context`, {
      method: 'POST',
      body: JSON.stringify(body),
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
      `/api/public/diagnostic/${id}?${tier ? `tier=${tier}&` : ''}_=${Date.now()}`,
      { cache: 'no-store' }
    ),
};

/** Canal WhatsApp (BuilderBot). Requiere `WHATSAPP_CHANNEL_API_KEY` en la API. */
export const publicDiagnosticWhatsAppApi = {
  create: (body: {
    phone: string;
    url?: string;
    message?: string;
    refCode?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }) =>
    api<{
      diagnosticId: string;
      status: string;
      resultUrl: string;
      domain: string;
      brandName: string;
    }>('/api/public/diagnostic/whatsapp', {
      method: 'POST',
      headers: {
        'x-cleexs-channel-key': process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL_API_KEY || '',
      },
      body: JSON.stringify(body),
    }),
  getTeaser: (diagnosticId: string) =>
    api<{
      status: string;
      domain?: string;
      brandName?: string;
      cleexsScore: number | null;
      teaserLine: string | null;
      resultUrl: string;
      ready: boolean;
    }>(`/api/public/diagnostic/whatsapp/${encodeURIComponent(diagnosticId)}/teaser`, {
      cache: 'no-store',
      headers: {
        'x-cleexs-channel-key': process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL_API_KEY || '',
      },
    }),
  /** Mensaje entrante → texto listo para enviar por WA (BuilderBot add_http). */
  webhookInbound: (body: {
    phone: string;
    message?: string;
    url?: string;
    refCode?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  }) =>
    api<{
      code: string;
      reply: string;
      diagnosticId?: string;
      resultUrl?: string;
      domain?: string;
      brandName?: string;
      status?: string;
      ready: boolean;
    }>('/api/public/diagnostic/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'x-cleexs-channel-key': process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL_API_KEY || '',
      },
      body: JSON.stringify(body),
    }),
  /** Poll: reply listo para WA cuando el análisis terminó (o mensaje “casi listo”). */
  webhookReply: (diagnosticId: string) =>
    api<{
      code: string;
      reply: string;
      status?: string;
      domain?: string;
      brandName?: string;
      cleexsScore?: number | null;
      teaserLine?: string | null;
      resultUrl?: string;
      diagnosticId?: string;
      ready: boolean;
    }>(
      `/api/public/diagnostic/whatsapp/webhook/reply?diagnosticId=${encodeURIComponent(diagnosticId)}`,
      {
        cache: 'no-store',
        headers: {
          'x-cleexs-channel-key': process.env.NEXT_PUBLIC_WHATSAPP_CHANNEL_API_KEY || '',
        },
      }
    ),
};

export const publicDiagnosticShareApi = {
  get: (slug: string, opts?: { visitorId?: string }) =>
    api<PublicDiagnosticShareResponse>(
      `/api/public/diagnostic/share/${encodeURIComponent(slug)}`,
      {
        cache: 'no-store',
        headers: {
          ...(opts?.visitorId ? { 'x-visitor-id': opts.visitorId } : {}),
        },
      }
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
