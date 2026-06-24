'use client';

import Link from 'next/link';
import { rememberLegalReturnUrl } from '@/lib/public-funnel-exit';

export function PortalLegalLink({ className }: { className?: string }) {
  return (
    <Link
      href="/legal/cleexs"
      onClick={rememberLegalReturnUrl}
      className={
        className ??
        'block rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800'
      }
    >
      Términos y privacidad
    </Link>
  );
}
