import type { CleexsEmailTemplateVariant } from './shared';
import {
  type CleexsEmailBuilt,
  type CleexsEmailLinks,
  type CleexsEmailPersonalization,
} from './shared';
import { buildCleexsEmail } from './build-email';

export type EditableEmailStepContent = {
  variant: CleexsEmailTemplateVariant;
  subject?: string | null;
  preheader?: string | null;
  body?: string | null;
};

export function bodyTextToParagraphs(body: string): string[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function buildCleexsEmailFromEditableContent(input: {
  content: EditableEmailStepContent;
  personalization: CleexsEmailPersonalization;
  links: CleexsEmailLinks;
  showFounderSignature?: boolean;
  showScoreBlock?: boolean;
  showReportLinks?: boolean;
}): CleexsEmailBuilt {
  const paragraphs = bodyTextToParagraphs(input.content.body || '');
  const variant = input.content.variant;

  if (variant === 'letter') {
    return buildCleexsEmail({
      variant: 'letter',
      personalization: input.personalization,
      links: input.links,
      letterContent: {
        ...(input.content.subject?.trim() ? { subject: input.content.subject.trim() } : {}),
        ...(input.content.preheader?.trim() ? { preheader: input.content.preheader.trim() } : {}),
        ...(paragraphs.length > 0 ? { bodyParagraphs: paragraphs } : {}),
      },
      showFounderSignature: input.showFounderSignature ?? true,
      showScoreBlock: input.showScoreBlock ?? true,
      showReportLinks: input.showReportLinks ?? true,
    });
  }

  return buildCleexsEmail({
    variant: 'editorial',
    personalization: input.personalization,
    links: input.links,
    editorialContent: {
      ...(input.content.subject?.trim() ? { subject: input.content.subject.trim() } : {}),
      ...(input.content.preheader?.trim() ? { preheader: input.content.preheader.trim() } : {}),
      ...(paragraphs.length > 0 ? { introParagraphs: paragraphs } : {}),
    },
    showFounderSignature: input.showFounderSignature ?? true,
  });
}
