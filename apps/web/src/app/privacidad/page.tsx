'use client';

import { useEffect } from 'react';

/** Hash no siempre se conserva con `redirect()` del servidor; forzamos ancla a privacidad. */
export default function PrivacidadLegacyRedirect() {
  useEffect(() => {
    window.location.replace('/legal/cleexs#politica-de-privacidad');
  }, []);
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-slate-50 px-4 text-center text-slate-600">
      <p className="text-sm">Redirigiendo a la política de privacidad…</p>
    </div>
  );
}
