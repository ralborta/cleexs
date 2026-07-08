import type { CleexsEmailTemplateVariant } from './shared';
import { getAppBaseUrlForPublicLinks } from '../app-public-url';
import {
  type CleexsEmailAssets,
  type CleexsEmailBuilt,
  type CleexsEmailLinks,
  type CleexsEmailPersonalization,
  buildNewDiagnosticUrl,
  buildPlansUrl,
  buildPlanConquistarUrl,
  sampleCleexsEmailLinks,
  sampleCleexsPersonalization,
} from './shared';
import { buildLetterEmail, defaultCleexsLetterContent, type CleexsLetterContent } from './letter-email';
import {
  buildEditorialEmail,
  defaultCleexsEditorialContent,
  defaultMonthlyScoreEditorialContent,
  type CleexsEditorialContent,
} from './editorial-email';

export type BuildCleexsEmailInput = {
  variant: CleexsEmailTemplateVariant;
  personalization: CleexsEmailPersonalization;
  links: CleexsEmailLinks;
  assets?: Partial<CleexsEmailAssets>;
  letterContent?: Partial<CleexsLetterContent>;
  editorialContent?: Partial<CleexsEditorialContent>;
  showFounderSignature?: boolean;
  showScoreBlock?: boolean;
  showReportLinks?: boolean;
};

export function buildCleexsEmail(input: BuildCleexsEmailInput): CleexsEmailBuilt {
  if (input.variant === 'letter') {
    return buildLetterEmail({
      personalization: input.personalization,
      links: input.links,
      assets: input.assets,
      content: input.letterContent,
      showFounderSignature: input.showFounderSignature,
      showScoreBlock: input.showScoreBlock,
      showReportLinks: input.showReportLinks,
    });
  }

  return buildEditorialEmail({
    personalization: input.personalization,
    links: input.links,
    assets: input.assets,
    content: input.editorialContent,
    showFounderSignature: input.showFounderSignature,
    showScoreBlock: input.showScoreBlock,
  });
}

export function buildCleexsEmailPreviewExample(options?: {
  variant?: CleexsEmailTemplateVariant;
  score?: number;
  domain?: string;
  brandName?: string;
}): CleexsEmailBuilt {
  return buildCleexsEmail({
    variant: options?.variant ?? 'letter',
    personalization: sampleCleexsPersonalization(options),
    links: sampleCleexsEmailLinks(),
    showFounderSignature: true,
    showScoreBlock: true,
    showReportLinks: true,
  });
}

export function buildMonthlyScoreViewUrl(
  baseUrl?: string,
  input?: { domain?: string; brandName?: string; email?: string }
): string {
  const base = (baseUrl ?? getAppBaseUrlForPublicLinks()).trim().replace(/\/+$/, '');
  const params = new URLSearchParams({
    utm_source: 'email',
    utm_medium: 'monthly_score',
    utm_campaign: 'monthly_score_update',
    autostart: '1',
  });
  if (input?.domain) params.set('url', input.domain);
  if (input?.brandName) params.set('brand', input.brandName);
  if (input?.email) params.set('email', input.email);
  return `${base}/diagnostico/crear?${params.toString()}`;
}

export function buildMonthlyScoreDiagnosticUrl(baseUrl?: string): string {
  return buildNewDiagnosticUrl(baseUrl, 'monthly_score');
}

export function buildMonthlyScorePlansUrl(baseUrl?: string): string {
  return buildPlansUrl(baseUrl, 'monthly_score');
}

export function buildFreeOnboardingPlanConquistarUrl(baseUrl?: string): string {
  return buildPlanConquistarUrl(baseUrl, 'free_onboarding');
}

export function buildMonthlyScoreEmailPreviewExample(options?: {
  score?: number;
  domain?: string;
  brandName?: string;
  assets?: Partial<CleexsEmailAssets>;
}): CleexsEmailBuilt {
  const base = getAppBaseUrlForPublicLinks();
  return buildCleexsEmail({
    variant: 'editorial',
    personalization: sampleCleexsPersonalization({
      score: options?.score ?? 62,
      domain: options?.domain,
      brandName: options?.brandName,
    }),
    links: {
      ...sampleCleexsEmailLinks(base),
      newDiagnosticUrl: buildMonthlyScoreViewUrl(base, {
        domain: options?.domain ?? 'empliados.net',
        brandName: options?.brandName ?? 'Empliados',
        email: 'ejemplo@cleexs.net',
      }),
    },
    assets: options?.assets,
    editorialContent: defaultMonthlyScoreEditorialContent(),
    showFounderSignature: true,
    showScoreBlock: false,
  });
}

export function buildMonthlyScoreEmail(input: {
  score: number | null;
  newDiagnosticUrl: string;
  plansUrl: string;
  unsubscribeUrl: string;
  assets?: Partial<CleexsEmailAssets>;
  content?: Partial<CleexsEditorialContent>;
  showFounderSignature?: boolean;
  showScoreBlock?: boolean;
}): CleexsEmailBuilt {
  return buildEditorialEmail({
    personalization: { score: input.score },
    links: {
      newDiagnosticUrl: input.newDiagnosticUrl,
      plansUrl: input.plansUrl,
      unsubscribeUrl: input.unsubscribeUrl,
    },
    assets: input.assets,
    content: input.content ?? defaultMonthlyScoreEditorialContent(),
    showFounderSignature: input.showFounderSignature,
    showScoreBlock: input.showScoreBlock ?? false,
  });
}

export {
  buildLetterEmail,
  buildEditorialEmail,
  defaultCleexsLetterContent,
  defaultCleexsEditorialContent,
  defaultMonthlyScoreEditorialContent,
  sampleCleexsEmailLinks,
  buildNewDiagnosticUrl,
  buildPlansUrl,
  buildPlanConquistarUrl,
};

export type {
  CleexsEmailTemplateVariant,
  CleexsEmailPersonalization,
  CleexsEmailLinks,
  CleexsEmailBuilt,
  CleexsEmailAssets,
} from './shared';

export type { CleexsLetterContent } from './letter-email';
export type { CleexsEditorialContent } from './editorial-email';
