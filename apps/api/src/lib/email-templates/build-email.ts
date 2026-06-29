import type { CleexsEmailTemplateVariant } from './shared';
import {
  type CleexsEmailAssets,
  type CleexsEmailBuilt,
  type CleexsEmailLinks,
  type CleexsEmailPersonalization,
  buildNewDiagnosticUrl,
  buildPlansUrl,
  sampleCleexsEmailLinks,
  sampleCleexsPersonalization,
} from './shared';
import { buildLetterEmail, defaultCleexsLetterContent, type CleexsLetterContent } from './letter-email';
import {
  buildEditorialEmail,
  defaultCleexsEditorialContent,
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
  showScoreTipsBlock?: boolean;
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
      showScoreTipsBlock: input.showScoreTipsBlock,
    });
  }

  return buildEditorialEmail({
    personalization: input.personalization,
    links: input.links,
    assets: input.assets,
    content: input.editorialContent,
    showFounderSignature: input.showFounderSignature,
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
    showScoreTipsBlock: true,
  });
}

export function buildMonthlyScoreDiagnosticUrl(baseUrl?: string): string {
  return buildNewDiagnosticUrl(baseUrl, 'monthly_score');
}

export function buildMonthlyScorePlansUrl(baseUrl?: string): string {
  return buildPlansUrl(baseUrl, 'monthly_score');
}

export function buildMonthlyScoreEmailPreviewExample(options?: {
  score?: number;
  assets?: Partial<CleexsEmailAssets>;
}): CleexsEmailBuilt {
  return buildCleexsEmailPreviewExample({
    variant: 'editorial',
    score: options?.score,
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
}): CleexsEmailBuilt {
  return buildEditorialEmail({
    personalization: { score: input.score },
    links: {
      newDiagnosticUrl: input.newDiagnosticUrl,
      plansUrl: input.plansUrl,
      unsubscribeUrl: input.unsubscribeUrl,
    },
    assets: input.assets,
    content: input.content,
    showFounderSignature: input.showFounderSignature,
  });
}

export {
  buildLetterEmail,
  buildEditorialEmail,
  defaultCleexsLetterContent,
  defaultCleexsEditorialContent,
  sampleCleexsEmailLinks,
  buildNewDiagnosticUrl,
  buildPlansUrl,
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
