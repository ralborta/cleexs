'use client';

import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CleexsLegalDocument } from '@/components/legal/cleexs-legal-document';
import { useTrapBrowserBack } from '@/lib/public-funnel-exit';

export type LegalSectionId = 'terminos-de-servicio' | 'politica-de-privacidad';

export function LegalAcceptanceModal({
  open,
  section,
  onClose,
  backFooterLabel = 'Atrás al diagnóstico',
  backFooterHint = 'Volvés al mismo paso del análisis, sin perder lo que cargaste.',
}: {
  open: boolean;
  section: LegalSectionId;
  onClose: () => void;
  backFooterLabel?: string;
  backFooterHint?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToSection = useCallback((targetSection: LegalSectionId) => {
    const root = scrollRef.current;
    const target = root?.querySelector(`#${targetSection}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useTrapBrowserBack(open, onClose);

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
    const t = window.setTimeout(() => scrollToSection(section), 80);
    return () => window.clearTimeout(t);
  }, [open, section, scrollToSection]);

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
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-2.5 sm:px-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 gap-1 rounded-lg px-2.5 text-slate-700"
              onClick={onClose}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Atrás
            </Button>
            <p id="legal-modal-title" className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-900">
              Términos y privacidad
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 via-white to-slate-50/90">
            <CleexsLegalDocument embedded onSectionJump={scrollToSection} />
          </div>

          <div className="shrink-0 border-t border-slate-200/90 bg-white/95 px-4 py-4 backdrop-blur sm:px-5">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:mx-auto sm:max-w-md"
              onClick={onClose}
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              {backFooterLabel}
            </Button>
            <p className="mt-2 text-center text-[11px] text-slate-500">{backFooterHint}</p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
