'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { OnboardingPreviewIntro } from '@/components/diagnostico/onboarding-preview/onboarding-preview-intro';
import { OnboardingPreviewHuman } from '@/components/diagnostico/onboarding-preview/onboarding-preview-human';
import { OnboardingPreviewWizard } from '@/components/diagnostico/onboarding-preview/onboarding-preview-wizard';
import { OnboardingPreviewCafecito } from '@/components/diagnostico/onboarding-preview/onboarding-preview-cafecito';
import { OnboardingMobileShell } from '@/components/diagnostico/onboarding-preview/onboarding-mobile-shell';
import { CLEEXS_FOUNDER_PHOTO_URL, CLEEXS_ONBOARDING_YOUTUBE_VIDEO_ID } from '@/lib/site';
import { buildOnboardingWhatsAppHref } from '@/lib/onboarding-whatsapp';
import { parseYoutubeVideoId } from '@/lib/youtube';
import { cn } from '@/lib/utils';

type Stage = 'intro' | 'human' | 'wizard' | 'cafecito';

const STAGE_LABELS: Record<Stage, string> = {
  intro: 'Intro',
  human: 'Humano',
  wizard: 'Wizard',
  cafecito: 'Cafecito',
};

function OnboardingMobilePreviewContent() {
  const searchParams = useSearchParams();
  const domain = (searchParams.get('domain') || 'gsbworld.com').trim();
  const brand = (searchParams.get('brand') || 'Gsbworld').trim();
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
  const [reportProgress, setReportProgress] = useState(0);
  const [analysisStarted, setAnalysisStarted] = useState(validStage !== 'intro');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mock = useMemo(
    () => ({
      country: 'Argentina',
      industry: 'Software B2B',
      email: `${userName.toLowerCase().replace(/\s+/g, '.')}@${domain}`,
      competitors: ['competidor1.com', 'competidor2.com', 'competidor3.com'],
    }),
    [domain, userName],
  );

  const leftProgressPct = useMemo(() => {
    if (!analysisStarted) return 0;
    if (stage === 'cafecito') return Math.min(100, 25 + Math.round(reportProgress * 0.75));
    if (stage === 'human') return 8;
    if (stage === 'wizard') return 8 + Math.round((wizardStep / 5) * 17);
    return 4;
  }, [analysisStarted, stage, wizardStep, reportProgress]);

  const whatsappHref = useMemo(
    () => buildOnboardingWhatsAppHref(userName, domain),
    [userName, domain],
  );
  const reportHref = `/ver-resultado?diagnosticId=preview&domain=${encodeURIComponent(domain)}`;

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

  useEffect(() => {
    if (!analysisStarted) {
      setElapsedSeconds(0);
      return;
    }
    const t = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [analysisStarted]);

  useEffect(() => {
    if (stage !== 'cafecito') {
      setReportReady(false);
      setReportProgress(0);
      return;
    }
    setReportReady(false);
    setReportProgress(0);
    const duration = autoplay ? 6000 : 8000;
    const start = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(98, Math.round((elapsed / duration) * 100));
      setReportProgress(pct);
      if (elapsed >= duration) {
        window.clearInterval(tick);
        setReportProgress(100);
        setReportReady(true);
      }
    }, 80);
    return () => window.clearInterval(tick);
  }, [stage, autoplay]);

  const handleIntroContinue = useCallback(() => {
    setAnalysisStarted(true);
    setStage('human');
  }, []);

  const goNextStage = useCallback(() => {
    if (stage === 'intro') {
      handleIntroContinue();
      return;
    }
    if (stage === 'human') {
      setStage('wizard');
      setWizardStep(1);
      return;
    }
    if (stage === 'wizard') setStage('cafecito');
  }, [stage, handleIntroContinue]);

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
    <main className="relative flex min-h-[100dvh] flex-col bg-[#eef1f6] px-3 py-4 sm:px-4">
      <div className="sticky top-0 z-50 -mx-3 mb-4 border-b border-violet-200 bg-violet-50 px-3 py-2.5 shadow-sm sm:-mx-4 sm:px-4">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-800">
                Preview móvil · webapp
              </p>
              <p className="text-xs text-violet-900/80">
                Sin grilla lateral — progreso compacto arriba
              </p>
            </div>
            <Link
              href="/diagnostico/onboarding-preview"
              className="shrink-0 text-[11px] font-semibold text-violet-700 underline-offset-2 hover:underline"
            >
              Desktop
            </Link>
          </div>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(STAGE_LABELS) as Stage[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStage(s);
                  if (s !== 'intro') setAnalysisStarted(true);
                  else setAnalysisStarted(false);
                }}
                className={cn(
                  'rounded-md px-2 py-1 text-[10px] font-semibold transition',
                  stage === s
                    ? 'bg-violet-600 text-white'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200',
                )}
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <OnboardingMobileShell
        brandLabel={brand}
        analysisRunning={analysisStarted}
        progressPct={leftProgressPct}
        elapsedSeconds={elapsedSeconds}
      >
        {stage === 'intro' ? (
          <OnboardingPreviewIntro
            brandLabel={brand}
            domain={domain}
            founderPhotoUrl={photo}
            processing={introProcessing}
            ready={introReady}
            onContinue={handleIntroContinue}
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
            reportProgress={reportProgress}
            reportHref={reportHref}
          />
        ) : null}
      </OnboardingMobileShell>
    </main>
  );
}

export default function OnboardingMobilePreviewPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-[#eef1f6] text-sm text-slate-600">
          Cargando preview móvil…
        </main>
      }
    >
      <OnboardingMobilePreviewContent />
    </Suspense>
  );
}
