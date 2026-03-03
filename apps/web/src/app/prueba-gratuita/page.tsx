'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

/**
 * Entrada directa para la prueba gratuita desde el website de Cleexs.
 * Redirige al formulario de creación de diagnóstico (misma pantalla).
 * Uso: https://tu-dominio.com/prueba-gratuita o .../prueba-gratuita?tier=gold
 */
export default function PruebaGratuitaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tier = searchParams.get('tier');
    const query = tier ? `?tier=${tier}` : '';
    router.replace(`/diagnostico/crear${query}`);
  }, [router, searchParams]);

  return (
    <main className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-500">Redirigiendo a la prueba gratuita…</p>
    </main>
  );
}
