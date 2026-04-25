'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy, Linkedin, Mail, MessageCircle, Send } from 'lucide-react';
import { buildPublicShareCopy, buildTeamInviteCopy } from '@/lib/share-messages';

const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

type ShareScoreButtonsProps = {
  path: string;
  /** `team`: solo copiar, WhatsApp y email (sin LinkedIn / X). */
  intent?: 'social' | 'team';
  /**
   * Si viene `brandName`, se usan los textos de difusión pública o invitación interna según `intent`.
   * Si no, hace falta `title` + `summary` (compatibilidad).
   */
  brandName?: string;
  domain?: string | null;
  title?: string;
  summary?: string;
};

export function ShareScoreButtons({
  path,
  intent = 'social',
  brandName,
  domain,
  title = '',
  summary = '',
}: ShareScoreButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState(PUBLIC_SITE_URL);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  useEffect(() => {
    if (PUBLIC_SITE_URL) {
      setOrigin(PUBLIC_SITE_URL);
      return;
    }
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const url = origin ? `${origin}${normalizedPath}` : normalizedPath;
  const encodedUrl = encodeURIComponent(url);
  const useTemplates = Boolean(brandName?.trim());

  const links = useMemo(() => {
    if (useTemplates) {
      const name = brandName!.trim();
      if (intent === 'team') {
        const copy = buildTeamInviteCopy({ brandName: name, domain, url });
        const wa = `https://wa.me/?text=${encodeURIComponent(copy.whatsappText)}`;
        const mailto = `mailto:?subject=${encodeURIComponent(copy.emailSubject)}&body=${encodeURIComponent(copy.emailBody)}`;
        return { wa, mailto, linkedin: null as string | null, x: null as string | null };
      }
      const copy = buildPublicShareCopy({ brandName: name, domain, url });
      const wa = `https://wa.me/?text=${encodeURIComponent(copy.whatsappText)}`;
      const mailto = `mailto:?subject=${encodeURIComponent(copy.emailSubject)}&body=${encodeURIComponent(copy.emailBody)}`;
      const linkedin = `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodeURIComponent(
        copy.linkedinTitle
      )}&summary=${encodeURIComponent(copy.linkedinSummary)}`;
      const tweetText = copy.twitterText || copy.linkedinTitle;
      const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodedUrl}`;
      return { wa, mailto, linkedin, x };
    }
    const bodyText = `${summary}\n\n${url}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
    const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(bodyText)}`;
    const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} — Cleexs Score`)}&url=${encodedUrl}`;
    return { wa, mailto, linkedin, x };
  }, [useTemplates, intent, brandName, domain, url, encodedUrl, title, summary]);

  const showSocialNetworks = intent === 'social';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
        onClick={copyLink}
      >
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-600" />}
        Copiar enlace
      </Button>
      <Button
        type="button"
        size="sm"
        className="gap-1.5 border-0 bg-[#25D366] text-white shadow-sm hover:bg-[#20bd5a] hover:text-white"
        asChild
      >
        <a href={links.wa} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4 shrink-0" />
          WhatsApp
        </a>
      </Button>
      <Button
        type="button"
        size="sm"
        className="gap-1.5 border-0 bg-sky-600 text-white shadow-sm hover:bg-sky-700 hover:text-white"
        asChild
      >
        <a href={links.mailto}>
          <Mail className="h-4 w-4 shrink-0" />
          Email
        </a>
      </Button>
      {showSocialNetworks && links.linkedin && links.x && (
        <>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 border-0 bg-[#0A66C2] text-white shadow-sm hover:bg-[#095195] hover:text-white"
            asChild
          >
            <a href={links.linkedin} target="_blank" rel="noopener noreferrer">
              <Linkedin className="h-4 w-4 shrink-0" />
              LinkedIn
            </a>
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5 border-0 bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:text-white"
            asChild
          >
            <a href={links.x} target="_blank" rel="noopener noreferrer">
              <Send className="h-4 w-4 shrink-0" />
              X
            </a>
          </Button>
        </>
      )}
    </div>
  );
}
