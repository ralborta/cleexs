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
  /** Insight elegido (de los 12): se muestra en la tarjeta de la carta. */
  featuredInsight?: { label: string; text: string } | null;
}): CleexsEmailBuilt {
  const paragraphs = bodyTextToParagraphs(input.content.body || '');
  const variant = input.content.variant;
  const featured = input.featuredInsight;

  if (variant === 'letter') {
    // Con insight editable: el comentario va a la tarjeta (signal), no se duplica en el cuerpo.
    const letterBodyParagraphs = featured?.text
      ? ([] as string[])
      : paragraphs.length > 0
        ? paragraphs
        : undefined;

    return buildCleexsEmail({
      variant: 'letter',
      personalization: input.personalization,
      links: input.links,
      letterContent: {
        ...(input.content.subject?.trim() ? { subject: input.content.subject.trim() } : {}),
        ...(input.content.preheader?.trim() ? { preheader: input.content.preheader.trim() } : {}),
        ...(letterBodyParagraphs ? { bodyParagraphs: letterBodyParagraphs } : {}),
        ...(featured?.text
          ? {
              signalLabel: featured.label.endsWith(':') ? featured.label : `${featured.label}:`,
              // Comentario editable (puede traer {{brandName}}, {{score}}, etc.).
              signalTemplate: featured.text,
            }
          : {}),
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
