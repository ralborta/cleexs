'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy, Linkedin, Mail, MessageCircle, Send } from 'lucide-react';

function siteOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function ShareScoreButtons({
  path,
  title,
  summary,
}: {
  path: string;
  title: string;
  summary: string;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
  const encodedUrl = encodeURIComponent(url);
  const bodyText = `${summary}\n\n${url}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(bodyText)}`;
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} — Cleexs Score`)}&url=${encodedUrl}`;

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
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
        {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        Copiar enlace
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
        <a href={wa} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
        <a href={mailto}>
          <Mail className="h-4 w-4" />
          Email
        </a>
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
        <a href={linkedin} target="_blank" rel="noopener noreferrer">
          <Linkedin className="h-4 w-4" />
          LinkedIn
        </a>
      </Button>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
        <a href={x} target="_blank" rel="noopener noreferrer">
          <Send className="h-4 w-4" />
          X
        </a>
      </Button>
    </div>
  );
}
