'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

/**
 * Vuelve al paso anterior del onboarding (misma pestaña). Si no hay historial, va al inicio del diagnóstico.
 */
export function CleexsLegalBackFooter() {
  const router = useRouter();

  return (
    <footer className="sticky bottom-0 z-10 border-t border-slate-200/90 bg-white/95 py-5 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-center">
        <Button
          type="button"
          size="lg"
          className="min-h-12 w-full max-w-md rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 text-base font-semibold shadow-md shadow-violet-600/20 hover:from-violet-700 hover:to-indigo-700 sm:w-auto"
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
              return;
            }
            router.push('/diagnostico/crear');
          }}
        >
          <ArrowLeft className="mr-2 h-5 w-5" aria-hidden />
          Acepto y vuelvo
        </Button>
        <p className="text-center text-sm text-slate-500 sm:max-w-xs sm:text-left">
          Volvés al paso del diagnóstico donde estabas (captcha o correo).
        </p>
      </div>
    </footer>
  );
}
