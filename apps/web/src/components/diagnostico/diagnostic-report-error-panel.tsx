'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DiagnosticReportErrorPanel({
  detail,
  loading,
  onRetry,
  onBack,
  backLabel = 'Volver al inicio',
}: {
  detail?: string | null;
  loading?: boolean;
  onRetry: () => void;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <main className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center bg-slate-50 px-6 py-10">
      <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50/90 p-6 text-center shadow-sm">
        <p className="text-lg font-bold leading-snug text-amber-950">
          Lamentablemente no pudimos generar tu reporte
        </p>
        {detail ? (
          <p className="mt-3 text-sm leading-relaxed text-amber-900/90">{detail}</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2.5">
          <Button type="button" className="h-11 rounded-xl px-8" onClick={onRetry} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Reintentando…
              </>
            ) : (
              'Volver a intentarlo'
            )}
          </Button>
          {onBack ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-1 rounded-xl border-amber-200/80 bg-white/80 text-amber-950 hover:bg-white"
              onClick={onBack}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {backLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
