export {
  buildCleexsEmail,
  buildCleexsEmailPreviewExample,
  buildMonthlyScoreEmail,
  buildMonthlyScoreEmailPreviewExample,
  buildMonthlyScoreDiagnosticUrl,
  buildMonthlyScorePlansUrl,
  buildLetterEmail,
  buildEditorialEmail,
  defaultCleexsEditorialContent,
  defaultCleexsLetterContent,
} from './email-templates/build-email';

export type {
  BuildCleexsEmailInput,
  CleexsEmailTemplateVariant,
  CleexsEmailPersonalization,
  CleexsEmailLinks,
  CleexsEmailBuilt,
  CleexsEmailAssets,
} from './email-templates/build-email';

export type { CleexsLetterContent } from './email-templates/letter-email';
export type { CleexsEditorialContent } from './email-templates/editorial-email';

// Alias históricos
export type { CleexsEditorialContent as MonthlyScoreEmailContent } from './email-templates/editorial-email';
