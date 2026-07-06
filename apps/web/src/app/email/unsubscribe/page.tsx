'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { resolveApiBaseUrl } from '@/lib/api-base-url';
import { Button } from '@/components/ui/button';
import { CleexsMark } from '@/components/brand/cleexs-mark';

const API_URL = resolveApiBaseUrl();

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email')?.trim() || '';
  const isPreview = searchParams.get('preview') === '1';

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [already, setAlready] = useState(false);

  useEffect(() => {
    if (!isPreview || !emailParam) return;
    setMessage('Vista previa: confirmá la baja con el botón de abajo.');
  }, [isPreview, emailParam]);

  async function handleUnsubscribe() {
    if (!emailParam || !emailParam.includes('@')) {
      setStatus('error');
      setMessage('No encontramos un email válido en el enlace. Escribinos a info@cleexs.net si necesitás ayuda.');
      return;
    }

    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/api/public/email/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        already?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo procesar la baja');
      }
      setAlready(Boolean(data.already));
      setStatus('done');
      setMessage(
        data.already
          ? 'Este email ya estaba dado de baja de los correos de Cleexs.'
          : 'Listo. No vas a recibir más emails de marketing de Cleexs en esta dirección.'
      );
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Error al procesar la baja');
    }
  }

  const invalidEmail = !emailParam || !emailParam.includes('@');

  return (
    <div
      className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16"
      style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}
    >
      <div className="mb-8">
        <CleexsMark className="h-8 w-auto" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Baja de emails</h1>
      {invalidEmail && !isPreview ? (
        <p className="mt-4 text-slate-600">
          El enlace no incluye un email válido. Si llegaste acá desde un correo de Cleexs, probá abrir el
          enlace directamente desde el mail o contactanos en{' '}
          <a href="mailto:info@cleexs.net" className="text-primary-600 underline">
            info@cleexs.net
          </a>
          .
        </p>
      ) : (
        <>
          <p className="mt-4 text-slate-600">
            {emailParam ? (
              <>
                Vas a dejar de recibir emails de marketing de Cleexs en{' '}
                <strong className="text-slate-800">{emailParam}</strong>.
              </>
            ) : (
              'Confirmá que querés darte de baja de los emails de Cleexs.'
            )}
          </p>
          {status === 'done' ? (
            <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {message}
            </p>
          ) : (
            <>
              {message ? <p className="mt-4 text-sm text-slate-500">{message}</p> : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => void handleUnsubscribe()}
                  disabled={status === 'loading' || invalidEmail}
                >
                  {status === 'loading' ? 'Procesando…' : 'Confirmar baja'}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/diagnostico/crear">Volver a Cleexs</Link>
                </Button>
              </div>
              {status === 'error' ? (
                <p className="mt-4 text-sm text-red-600">{message}</p>
              ) : null}
            </>
          )}
          {status === 'done' && !already ? (
            <p className="mt-6">
              <Link href="/diagnostico/crear" className="text-sm font-medium text-primary-600 hover:underline">
                Volver a Cleexs
              </Link>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function EmailUnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-slate-500">Cargando…</div>
      }
    >
      <UnsubscribeContent />
    </Suspense>
  );
}
