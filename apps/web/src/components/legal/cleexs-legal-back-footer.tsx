'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { consumeLegalReturnUrl, exitPublicFunnelToMarketingSite } from '@/lib/public-funnel-exit';

/** Vuelve al paso anterior del onboarding o a la URL guardada al abrir legales. */
export function CleexsLegalBackFooter() {
  const router = useRouter();

  return (
    <footer className="sticky bottom-0 z-10 border-t border-slate-200/90 bg-white/95 py-5 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 px-4 sm:flex-row sm:justify-center">
        <Button
          type="button"
          size="default"
          className="min-h-11 w-full max-w-md rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-6 text-sm font-semibold shadow-md shadow-violet-600/20 hover:from-violet-700 hover:to-indigo-700 sm:w-auto"
          onClick={() => {
            const returnUrl = consumeLegalReturnUrl();
            if (returnUrl) {
              window.location.assign(returnUrl);
              return;
            }
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
              return;
            }
            exitPublicFunnelToMarketingSite();
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
          Atrás
        </Button>
        <p className="text-center text-xs text-slate-500 sm:max-w-xs sm:text-left">
          Volvés a donde estabas en el diagnóstico o en la app.
        </p>
      </div>
    </footer>
  );
}
