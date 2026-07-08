'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { resolveApiBaseUrl } from '@/lib/api-base-url';
import { CLEEXS_MARKETING_URL } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { CleexsMark } from '@/components/brand/cleexs-mark';

const API_URL = resolveApiBaseUrl();

const CONTENT_LABEL =
  'Consejos y estrategias personalizadas para que tu empresa consiga más clientes en ChatGPT.';
const MONTHLY_LABEL = 'La actualización mensual gratuita de mi Cleexs Score';

const GONZALO_MESSAGE =
  'Fue un placer haberte acompañado hasta acá. Lamento que no te pude aportar más valor en este camino. Sigo convencido que es la gran oportunidad que tiene el marketing en la próxima década. Abrazo!';

type Step = 'preferences' | 'done';

type SaveResult = {
  stillReceivingContent: boolean;
  stillReceivingMonthlyScore: boolean;
  leaveContent: boolean;
  leaveMonthlyScore: boolean;
  changed: boolean;
};

function followUpMessage(result: SaveResult): string {
  const { stillReceivingContent, stillReceivingMonthlyScore, leaveContent, leaveMonthlyScore } = result;

  if (!leaveContent && !leaveMonthlyScore) {
    return 'Seguís recibiendo consejos y tu Cleexs Score mensual. No cambiamos nada.';
  }
  if (leaveContent && leaveMonthlyScore) {
    return GONZALO_MESSAGE;
  }
  if (leaveContent && stillReceivingMonthlyScore) {
    return `${GONZALO_MESSAGE}\n\nSeguirás recibiendo la actualización mensual gratuita de tu Cleexs Score.`;
  }
  if (leaveMonthlyScore && stillReceivingContent) {
    return 'Dejaste de recibir la actualización mensual de Cleexs Score. Seguirás recibiendo consejos y estrategias cuando los enviemos.';
  }
  return 'Actualizamos tus preferencias de email.';
}

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email')?.trim() || '';
  const fromParam = searchParams.get('from')?.trim() || '';
  const isPreview = searchParams.get('preview') === '1';

  const [step, setStep] = useState<Step>('preferences');
  const [leaveContent, setLeaveContent] = useState(true);
  const [leaveMonthlyScore, setLeaveMonthlyScore] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [doneMessage, setDoneMessage] = useState('');
  const [showGonzalo, setShowGonzalo] = useState(false);

  useEffect(() => {
    if (!emailParam || !emailParam.includes('@') || isPreview) return;

    const qs = new URLSearchParams({ email: emailParam });
    if (fromParam) qs.set('from', fromParam);

    void (async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/email/unsubscribe?${qs.toString()}`);
        const data = (await res.json().catch(() => ({}))) as {
          leaveContent?: boolean;
          leaveMonthlyScore?: boolean;
          error?: string;
        };
        if (!res.ok) return;
        if (typeof data.leaveContent === 'boolean') setLeaveContent(data.leaveContent);
        if (typeof data.leaveMonthlyScore === 'boolean') setLeaveMonthlyScore(data.leaveMonthlyScore);
      } catch {
        // defaults del formulario
      }
    })();
  }, [emailParam, fromParam, isPreview]);

  async function handleSave() {
    if (!emailParam || !emailParam.includes('@')) {
      setStatus('error');
      setErrorMessage('No encontramos un email válido en el enlace. Escribinos a info@cleexs.net si necesitás ayuda.');
      return;
    }

    if (isPreview) {
      setShowGonzalo(leaveContent || leaveMonthlyScore);
      setDoneMessage(followUpMessage({
        stillReceivingContent: !leaveContent,
        stillReceivingMonthlyScore: !leaveMonthlyScore,
        leaveContent,
        leaveMonthlyScore,
        changed: true,
      }));
      setStep('done');
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    try {
      const res = await fetch(`${API_URL}/api/public/email/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailParam,
          leaveContent,
          leaveMonthlyScore,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as SaveResult & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo actualizar tus preferencias');
      }

      const result: SaveResult = {
        stillReceivingContent: Boolean(data.stillReceivingContent),
        stillReceivingMonthlyScore: Boolean(data.stillReceivingMonthlyScore),
        leaveContent: Boolean(data.leaveContent),
        leaveMonthlyScore: Boolean(data.leaveMonthlyScore),
        changed: Boolean(data.changed),
      };

      setShowGonzalo(result.leaveContent || result.leaveMonthlyScore);
      setDoneMessage(followUpMessage(result));
      setStep('done');
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Error al guardar preferencias');
    }
  }

  const invalidEmail = !emailParam || !emailParam.includes('@');

  if (step === 'done') {
    return (
      <div
        className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16"
        style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}
      >
        <div className="mb-8">
          <CleexsMark className="h-8 w-auto" />
        </div>

        {showGonzalo ? (
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <Image
              src="/gonzalo-founder.png"
              alt="Gonzalo"
              width={96}
              height={96}
              className="h-24 w-24 shrink-0 rounded-full border-4 border-slate-100 object-cover shadow-md"
            />
            <div>
              <p className="text-lg font-semibold text-slate-900">Gonzalo</p>
              <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-600">{doneMessage}</p>
            </div>
          </div>
        ) : (
          <p className="text-base leading-relaxed text-slate-600">{doneMessage}</p>
        )}

        <p className="mt-8">
          <a href={CLEEXS_MARKETING_URL} className="text-sm font-medium text-primary-600 hover:underline">
            Volver a Cleexs
          </a>
        </p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 py-16"
      style={{ fontFamily: 'Inter, Arial, Helvetica, sans-serif' }}
    >
      <div className="mb-8">
        <CleexsMark className="h-8 w-auto" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900">Preferencias de email</h1>

      {invalidEmail && !isPreview ? (
        <p className="mt-4 text-slate-600">
          El enlace no incluye un email válido. Si llegaste acá desde un correo de Cleexs, probá abrir el enlace
          directamente desde el mail o contactanos en{' '}
          <a href="mailto:info@cleexs.net" className="text-primary-600 underline">
            info@cleexs.net
          </a>
          .
        </p>
      ) : (
        <>
          <p className="mt-4 text-slate-600">
            Elegí qué te gustaría dejar de recibir de Cleexs
            {emailParam ? (
              <>
                {' '}
                en <strong className="text-slate-800">{emailParam}</strong>
              </>
            ) : null}
            :
          </p>

          <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                checked={leaveContent}
                onChange={(e) => setLeaveContent(e.target.checked)}
                disabled={status === 'loading'}
              />
              <span className="text-sm leading-relaxed text-slate-700">{CONTENT_LABEL}</span>
            </label>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                checked={leaveMonthlyScore}
                onChange={(e) => setLeaveMonthlyScore(e.target.checked)}
                disabled={status === 'loading'}
              />
              <span className="text-sm leading-relaxed text-slate-700">{MONTHLY_LABEL}</span>
            </label>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button type="button" onClick={() => void handleSave()} disabled={status === 'loading' || invalidEmail}>
              {status === 'loading' ? 'Guardando…' : 'Actualizar lo que recibo'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={CLEEXS_MARKETING_URL}>Volver a Cleexs</a>
            </Button>
          </div>

          {status === 'error' ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}
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
