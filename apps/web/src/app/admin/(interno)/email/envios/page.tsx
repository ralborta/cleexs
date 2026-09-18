'use client';

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { EmailEnviosDashboard } from '@/components/email/email-envios-dashboard';

export const dynamic = 'force-dynamic';

export default function AdminEmailEnviosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      }
    >
      <EmailEnviosDashboard mode="admin" />
    </Suspense>
  );
}
