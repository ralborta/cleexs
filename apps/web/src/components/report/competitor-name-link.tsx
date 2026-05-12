'use client';

import { cn } from '@/lib/utils';

function normalizeExternalUrl(url?: string | null): string | null {
  const trimmed = `${url || ''}`.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function CompetitorNameLink({
  name,
  url,
  className,
}: {
  name: string;
  url?: string | null;
  className?: string;
}) {
  const href = normalizeExternalUrl(url);
  if (!href) {
    return (
      <span className={className} title={name}>
        {name}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className, 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-300 rounded-sm')}
      title={`${name} · Abrir sitio web`}
    >
      {name}
    </a>
  );
}
