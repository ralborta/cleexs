'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CleexsContactLinks } from '@/components/layout/cleexs-contact-links';
import { shouldHidePublicFooter } from '@/lib/public-chrome';

export function CleexsPublicFooter() {
  const pathname = usePathname();
  if (shouldHidePublicFooter(pathname)) return null;

  return (
    <footer className="border-t border-slate-200/90 bg-white/95">
      <div className="container mx-auto flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} Cleexs · Visibilidad en motores de IA</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <Link href="/contacto" className="font-medium text-violet-700 hover:underline">
              Contacto
            </Link>
            <Link href="/legal/cleexs" className="text-slate-600 hover:text-violet-700 hover:underline">
              Términos y privacidad
            </Link>
            <Link href="/planes" className="text-slate-600 hover:text-violet-700 hover:underline">
              Planes
            </Link>
          </div>
        </div>
        <CleexsContactLinks variant="icons" />
      </div>
    </footer>
  );
}
