import Link from 'next/link';
import { Instagram, Mail, Twitter, Youtube } from 'lucide-react';
import { CLEEXS_CONTACT_EMAIL, CLEEXS_SOCIAL_LINKS } from '@/lib/site';
import { cn } from '@/lib/utils';

const SOCIAL_ITEMS = [
  { key: 'instagram', label: 'Instagram', href: CLEEXS_SOCIAL_LINKS.instagram, Icon: Instagram },
  { key: 'youtube', label: 'YouTube', href: CLEEXS_SOCIAL_LINKS.youtube, Icon: Youtube },
  { key: 'twitter', label: 'X (Twitter)', href: CLEEXS_SOCIAL_LINKS.twitter, Icon: Twitter },
] as const;

type CleexsContactLinksProps = {
  variant?: 'full' | 'compact' | 'icons';
  className?: string;
};

export function CleexsContactLinks({ variant = 'compact', className }: CleexsContactLinksProps) {
  if (variant === 'icons') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <a
          href={`mailto:${CLEEXS_CONTACT_EMAIL}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-violet-700"
          aria-label={`Email ${CLEEXS_CONTACT_EMAIL}`}
        >
          <Mail className="h-4 w-4" aria-hidden />
        </a>
        {SOCIAL_ITEMS.map(({ key, label, href, Icon }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-violet-700"
            aria-label={label}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </a>
        ))}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={cn('space-y-6', className)}>
        <a
          href={`mailto:${CLEEXS_CONTACT_EMAIL}`}
          className="flex items-center gap-4 rounded-2xl border border-violet-100 bg-violet-50/50 p-5 transition hover:border-violet-200 hover:bg-violet-50"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <Mail className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Escribinos por email</p>
            <p className="mt-0.5 text-sm text-violet-700">{CLEEXS_CONTACT_EMAIL}</p>
            <p className="mt-1 text-xs text-slate-500">Respondemos en 24–48 h hábiles.</p>
          </div>
        </a>

        <div className="grid gap-3 sm:grid-cols-3">
          {SOCIAL_ITEMS.map(({ key, label, href, Icon }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{label}</p>
                <p className="truncate text-xs text-slate-500">@cleexsnet</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600', className)}>
      <a href={`mailto:${CLEEXS_CONTACT_EMAIL}`} className="font-medium text-violet-700 hover:underline">
        {CLEEXS_CONTACT_EMAIL}
      </a>
      {SOCIAL_ITEMS.map(({ key, label, href }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-violet-700 hover:underline"
        >
          {label}
        </a>
      ))}
      <Link href="/contacto" className="font-medium text-violet-700 hover:underline">
        Ver todos los canales
      </Link>
    </div>
  );
}
