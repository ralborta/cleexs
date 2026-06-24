'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CleexsLegalDocument } from '@/components/legal/cleexs-legal-document';

export type LegalSectionId = 'terminos-de-servicio' | 'politica-de-privacidad';

export function LegalAcceptanceModal({
  open,
  section,
  onClose,
}: {
  open: boolean;
  section: LegalSectionId;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const root = scrollRef.current;
      const target = root?.querySelector(`#${section}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [open, section]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[2147483100] bg-slate-900/50 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[2147483101] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
          className="relative flex max-h-[min(92vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
            <p id="legal-modal-title" className="text-sm font-semibold text-slate-900">
              Términos y privacidad
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-slate-50/90">
            <CleexsLegalDocument embedded />
          </div>

          <div className="shrink-0 border-t border-slate-200/90 bg-white/95 px-4 py-4 backdrop-blur sm:px-5">
            <Button
              type="button"
              className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-md shadow-violet-600/20 hover:from-violet-700 hover:to-indigo-700 sm:mx-auto sm:max-w-md"
              onClick={onClose}
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Acepto y vuelvo
            </Button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Cerrás este aviso y seguís en el mismo paso del diagnóstico.
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
