'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CleexsMark } from '@/components/brand/cleexs-mark';
import {
  isPublicMarketingExitPath,
  logoHrefForPath,
  shouldHidePublicChrome,
  usesMinimalPublicHeader,
} from '@/lib/public-chrome';

export function Header() {
  const pathname = usePathname();
  if (shouldHidePublicChrome(pathname)) return null;
  const minimal = usesMinimalPublicHeader(pathname);
  const logoHref = logoHrefForPath(pathname);
  const logoExitsToMarketing = isPublicMarketingExitPath(pathname);

  if (!minimal) {
    return (
      <header className="flex h-14 shrink-0 items-center border-b border-border bg-card">
        <div className="container mx-auto flex h-full items-center justify-between px-6">
          <a
            href={logoHref}
            className="flex items-center text-foreground no-underline hover:opacity-90"
            aria-label="Volver a cleexs.net"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-12 sm:w-12">
              <CleexsMark className="h-9 w-9 sm:h-10 sm:w-10" />
            </div>
          </a>
          <Link
            href="/contacto"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Contacto
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-card">
      <div className="container mx-auto flex h-full items-center justify-between px-6">
        {logoExitsToMarketing ? (
          <a
            href={logoHref}
            className="flex items-center text-foreground no-underline hover:opacity-90"
            aria-label="Volver a cleexs.net"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-12 sm:w-12">
              <CleexsMark className="h-9 w-9 sm:h-10 sm:w-10" />
            </div>
          </a>
        ) : (
          <Link
            href={logoHref}
            className="flex items-center text-foreground no-underline hover:opacity-90"
            aria-label="Cleexs"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center sm:h-12 sm:w-12">
              <CleexsMark className="h-9 w-9 sm:h-10 sm:w-10" />
            </div>
          </Link>
        )}
        <Link
          href="/contacto"
          className={
            pathname === '/contacto'
              ? 'text-sm font-semibold text-violet-700'
              : 'text-sm font-medium text-muted-foreground transition-colors hover:text-foreground'
          }
        >
          Contacto
        </Link>
      </div>
    </header>
  );
}
