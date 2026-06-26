'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { OnboardingPreviewIntro } from '@/components/diagnostico/onboarding-preview/onboarding-preview-intro';
import { OnboardingPreviewHuman } from '@/components/diagnostico/onboarding-preview/onboarding-preview-human';
import { OnboardingPreviewWizard } from '@/components/diagnostico/onboarding-preview/onboarding-preview-wizard';
import { OnboardingPreviewCafecito } from '@/components/diagnostico/onboarding-preview/onboarding-preview-cafecito';
import { CLEEXS_FOUNDER_PHOTO_URL, CLEEXS_MARKETING_URL, CLEEXS_ONBOARDING_YOUTUBE_VIDEO_ID, CLEEXS_WHATSAPP_PHONE_E164 } from '@/lib/site';
import { parseYoutubeVideoId } from '@/lib/youtube';
import { cn } from '@/lib/utils';

type Stage = 'intro' | 'human' | 'wizard' | 'cafecito';

const STAGE_LABELS: Record<Stage, string> = {
  intro: 'Intro Gonzalo',
  human: 'Soy humano',
  wizard: 'Wizard 1–5',
  cafecito: 'Cafecito ☕',
};

function buildWhatsAppHref(name: string, domain: string): string {
  const text = `Hola Gonzalo, soy ${name} de ${domain}. Te escribo porque quiero contarte por qué hice el análisis de Cleexs…`;
  return `https://wa.me/${CLEEXS_WHATSAPP_PHONE_E164.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

function OnboardingPreviewContent() {
  const searchParams = useSearchParams();
  const domain = (searchParams.get('domain') || 'empresa.com').trim();
  const brand = (searchParams.get('brand') || 'Empresa Demo').trim();
  const userName = (searchParams.get('name') || 'Carlos').trim();
  const photo = searchParams.get('photo')?.trim() || CLEEXS_FOUNDER_PHOTO_URL;
  const youtube =
    parseYoutubeVideoId(searchParams.get('yt')) ?? CLEEXS_ONBOARDING_YOUTUBE_VIDEO_ID;
  const autoplay = searchParams.get('autoplay') === '1';

  const initialStage = (searchParams.get('stage') as Stage) || 'intro';
  const validStage: Stage =
    initialStage === 'human' || initialStage === 'wizard' || initialStage === 'cafecito'
      ? initialStage
      : 'intro';

  const [stage, setStage] = useState<Stage>(validStage);
  const [wizardStep, setWizardStep] = useState(1);
  const [introProcessing, setIntroProcessing] = useState(true);
  const [introReady, setIntroReady] = useState(false);
  const [reportReady, setReportReady] = useState(false);

  const mock = useMemo(
    () => ({
      country: 'Argentina',
      industry: 'Software B2B',
      email: `${userName.toLowerCase().replace(/\s+/g, '.')}@${domain}`,
      competitors: ['competidor1.com', 'competidor2.com', 'competidor3.com'],
    }),
    [domain, userName]
  );

  const whatsappHref = useMemo(() => buildWhatsAppHref(userName, domain), [userName, domain]);
  const reportHref = `/ver-resultado?diagnosticId=preview&domain=${encodeURIComponent(domain)}`;

  // Simula detección de contexto (intro)
  useEffect(() => {
    if (stage !== 'intro') return;
    setIntroProcessing(true);
    setIntroReady(false);
    const t = window.setTimeout(() => {
      setIntroProcessing(false);
      setIntroReady(true);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [stage]);

  // Simula análisis (cafecito)
  useEffect(() => {
    if (stage !== 'cafecito') {
      setReportReady(false);
      return;
    }
    setReportReady(false);
    const t = window.setTimeout(() => setReportReady(true), autoplay ? 6000 : 8000);
    return () => window.clearTimeout(t);
  }, [stage, autoplay]);

  const goNextStage = useCallback(() => {
    if (stage === 'intro') {
      setStage('human');
      return;
    }
    if (stage === 'human') {
      setStage('wizard');
      setWizardStep(1);
      return;
    }
    if (stage === 'wizard') {
      setStage('cafecito');
    }
  }, [stage]);

  // Autoplay demo lineal
  useEffect(() => {
    if (!autoplay) return;
    if (stage === 'intro' && introReady) {
      const t = window.setTimeout(goNextStage, 1200);
      return () => window.clearTimeout(t);
    }
    if (stage === 'human') {
      const t = window.setTimeout(goNextStage, 1600);
      return () => window.clearTimeout(t);
    }
  }, [autoplay, stage, introReady, goNextStage]);

  useEffect(() => {
    if (!autoplay || stage !== 'wizard') return;
    if (wizardStep < 5) {
      const t = window.setTimeout(() => setWizardStep((s) => s + 1), 1400);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(goNextStage, 1400);
    return () => window.clearTimeout(t);
  }, [autoplay, stage, wizardStep, goNextStage]);

  return (
    <main className="relative min-h-[calc(100vh-72px)] bg-slate-50 px-4 py-6 sm:px-6">
      <div className="sticky top-0 z-50 -mx-4 mb-6 border-b border-amber-200 bg-amber-50 px-4 py-3 shadow-sm sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
              Preview — no es producción
            </p>
            <p className="text-sm text-amber-900/80">
              Simula el onboarding propuesto (intro → humano → wizard 5 pasos → cafecito)
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STAGE_LABELS) as Stage[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  stage === s
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                )}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-5xl text-[11px] text-amber-900/70">
          Query:{' '}
          <code className="rounded bg-white/80 px-1">?domain=</code>{' '}
          <code className="rounded bg-white/80 px-1">?brand=</code>{' '}
          <code className="rounded bg-white/80 px-1">?name=</code>{' '}
          <code className="rounded bg-white/80 px-1">?photo=URL</code> (opcional, default Gonzalo){' '}
          <code className="rounded bg-white/80 px-1">?yt=URL_o_ID</code> (opcional){' '}
          <code className="rounded bg-white/80 px-1">?autoplay=1</code>{' '}
          <code className="rounded bg-white/80 px-1">?stage=human</code>{' '}
          <code className="rounded bg-white/80 px-1">?stage=cafecito</code>
        </p>
      </div>

      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Análisis de {brand}
          </h1>
          <Link href={CLEEXS_MARKETING_URL} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/CleexsLogo.png" alt="Cleexs" className="h-11 w-auto object-contain sm:h-12" />
          </Link>
        </div>

        {stage === 'intro' ? (
          <OnboardingPreviewIntro
            brandLabel={brand}
            domain={domain}
            founderPhotoUrl={photo}
            processing={introProcessing}
            ready={introReady}
            onContinue={goNextStage}
          />
        ) : null}

        {stage === 'human' ? (
          <OnboardingPreviewHuman onBack={() => setStage('intro')} onContinue={goNextStage} />
        ) : null}

        {stage === 'wizard' ? (
          <OnboardingPreviewWizard
            step={wizardStep}
            mock={mock}
            onBack={() => {
              if (wizardStep <= 1) setStage('human');
              else setWizardStep((s) => s - 1);
            }}
            onNext={() => {
              if (wizardStep >= 5) goNextStage();
              else setWizardStep((s) => s + 1);
            }}
          />
        ) : null}

        {stage === 'cafecito' ? (
          <OnboardingPreviewCafecito
            userName={userName}
            domain={domain}
            brandLabel={brand}
            founderPhotoUrl={photo}
            youtubeVideoId={youtube}
            whatsappHref={whatsappHref}
            reportReady={reportReady}
            reportHref={reportHref}
          />
        ) : null}
      </div>
    </main>
  );
}

export default function OnboardingPreviewPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
          Cargando preview…
        </main>
      }
    >
      <OnboardingPreviewContent />
    </Suspense>
  );
}
