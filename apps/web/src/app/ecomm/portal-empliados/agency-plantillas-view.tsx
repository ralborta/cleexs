'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortalEmailDemoFetch } from '@/lib/portal-email-demo-data';
import './agency-stitch-scope.css';

type TemplateVariant = 'letter' | 'editorial';

type PreviewPayload = {
  ok: boolean;
  variant: TemplateVariant;
  subject: string;
  html: string;
  sampleScore: number;
  sampleDomain: string;
  sampleBrandName: string;
  newDiagnosticUrl: string;
  plansUrl: string;
};

/**
 * Plantillas = tab "Diseño Carta / Editorial" del Stitch email + preview/envío demo.
 * No hay HTML Stitch aparte; se alinea al mismo sistema visual que Secuencias/Envíos.
 */
export function AgencyPlantillasView({ onGoEnvios }: { onGoEnvios?: () => void }) {
  const fetcher = useMemo(() => createPortalEmailDemoFetch(), []);
  const [variant, setVariant] = useState<TemplateVariant>('letter');
  const [score, setScore] = useState(62);
  const [domain, setDomain] = useState('empliados.net');
  const [brandName, setBrandName] = useState('Empliados');
  const [testEmail, setTestEmail] = useState('ops@transporteandino.com');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        variant,
        score: String(score),
        domain,
        brandName,
      });
      const res = await fetcher(`/api/borrador/portal-email/templates/preview?${qs.toString()}`);
      const data = (await res.json()) as PreviewPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el preview');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [fetcher, variant, score, domain, brandName]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendTest() {
    if (!testEmail.trim()) {
      setHint('Ingresá un email de prueba.');
      return;
    }
    setSending(true);
    setHint(null);
    setError(null);
    try {
      const res = await fetcher('/api/borrador/portal-email/templates/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail.trim(),
          variant,
          score,
          domain,
          brandName,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; subject?: string; variant?: string; message?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setHint(
        data.message ||
          `Enviado (${data.variant ?? variant}): "${data.subject ?? preview?.subject}" → ${testEmail.trim()}`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al enviar prueba');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="agency-stitch flex w-full flex-col gap-space-lg pb-16">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs mb-1">
            <span className="material-symbols-outlined text-primary text-[20px]">article</span>
            <span className="font-label-micro text-label-micro text-primary uppercase font-bold tracking-wider">
              Crecimiento · Email
            </span>
          </div>
          <h1 className="font-headline-title text-headline-title text-on-surface font-bold">
            Diseño Carta / Editorial
          </h1>
          <p className="font-body-default text-body-sm text-on-surface-variant max-w-3xl">
            Plantillas base del Stitch email: <strong>Carta</strong> (letter) y <strong>Newsletter editorial</strong>.
            Preview en vivo y envío de prueba (demo portal-email).
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap">
          {onGoEnvios ? (
            <button
              type="button"
              onClick={onGoEnvios}
              className="flex items-center gap-1 px-space-md py-2 rounded-lg bg-surface-container-low text-on-surface font-body-medium text-body-sm"
            >
              <span className="material-symbols-outlined text-[18px]">stacked_bar_chart</span>
              Ir a Envíos
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={sending}
            className="flex items-center gap-1 px-space-md py-2 rounded-lg bg-primary text-on-primary font-body-medium text-body-sm shadow-sm disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${sending ? 'animate-spin' : ''}`}>
              {sending ? 'progress_activity' : 'send'}
            </span>
            Enviar prueba
          </button>
        </div>
      </div>

      <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-xl w-fit shadow-sm">
        <button
          type="button"
          onClick={() => setVariant('letter')}
          className={
            variant === 'letter'
              ? 'inline-flex items-center gap-2 px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-primary font-body-medium text-body-sm shadow-sm'
              : 'inline-flex items-center gap-1.5 px-space-md py-1.5 rounded-lg text-on-surface-variant font-body-medium text-body-sm'
          }
        >
          <span className="material-symbols-outlined text-[17px]">mail</span>
          Carta (letter)
        </button>
        <button
          type="button"
          onClick={() => setVariant('editorial')}
          className={
            variant === 'editorial'
              ? 'inline-flex items-center gap-2 px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-primary font-body-medium text-body-sm shadow-sm'
              : 'inline-flex items-center gap-1.5 px-space-md py-1.5 rounded-lg text-on-surface-variant font-body-medium text-body-sm'
          }
        >
          <span className="material-symbols-outlined text-[17px]">newspaper</span>
          Newsletter (editorial)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <div className="lg:col-span-4 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm flex flex-col gap-space-md">
          <h2 className="font-headline-title text-body-medium font-bold text-on-surface">Parámetros de muestra</h2>
          <div>
            <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
              Score
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value) || 0)}
              className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none font-metric-tabular"
            />
          </div>
          <div>
            <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
              Dominio
            </label>
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none"
            />
          </div>
          <div>
            <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
              Marca
            </label>
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none"
            />
          </div>
          <div>
            <label className="block font-label-micro text-label-micro text-outline uppercase tracking-wider mb-1">
              Enviar prueba a
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="w-full bg-surface-container-low px-space-md py-2 rounded-lg outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center justify-center gap-1 px-space-md py-2 rounded-lg bg-surface-container-high text-on-surface font-body-medium text-body-sm disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>sync</span>
            Actualizar preview
          </button>

          {error ? <p className="font-body-sm text-error">{error}</p> : null}
          {hint ? <p className="font-body-sm text-secondary">{hint}</p> : null}

          {preview ? (
            <div className="rounded-lg bg-surface-container-low p-space-md font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-1">
              <span>
                <strong className="text-on-surface">Asunto:</strong> {preview.subject}
              </span>
              <span>
                <strong className="text-on-surface">Muestra:</strong> {preview.sampleBrandName} · {preview.sampleDomain}{' '}
                · score {preview.sampleScore}
              </span>
              <a
                href={preview.newDiagnosticUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary font-medium inline-flex items-center gap-1 mt-1"
              >
                Nuevo diagnóstico
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-8 rounded-xl bg-surface-container-lowest shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-space-md py-space-sm border-b border-outline-variant/30">
            <span className="material-symbols-outlined text-primary text-[18px]">preview</span>
            <span className="font-body-medium text-body-sm text-on-surface font-semibold">
              Vista previa — {variant === 'letter' ? 'carta ejecutiva' : 'newsletter editorial'}
            </span>
          </div>
          {loading && !preview ? (
            <div className="flex items-center justify-center gap-2 py-24 text-outline font-body-sm">
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              Cargando…
            </div>
          ) : (
            <iframe
              title={`Preview email ${variant}`}
              srcDoc={preview?.html ?? ''}
              className="h-[720px] w-full border-0 bg-surface-container-low"
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}
