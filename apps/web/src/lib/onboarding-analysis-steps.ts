import type { AnalysisStepItem } from '@/app/diagnostico/verificando/analysis-steps-grid';

/** 11 pasos técnicos del checklist izquierdo (onboarding / verificando). */
export const ONBOARDING_ANALYSIS_STEP_LABELS = [
  'Verificando acceso de IA al sitio',
  'Analizando orden para IA',
  'Midiendo claridad de respuesta',
  'Evaluando autoridad real',
  'Chequeando idioma para IA',
  'Revisando actualización de info',
  'Detectando confianza real',
  'Testeando carga y funcionamiento',
  'Rastreando menciones externas',
  'Midiendo intención cubierta',
  'Evaluando comprensión por IA',
] as const;

export const ONBOARDING_ANALYSIS_STEP_COUNT = ONBOARDING_ANALYSIS_STEP_LABELS.length;

export function buildAnalysisStepItems(progressPct: number, running: boolean): AnalysisStepItem[] {
  if (!running) {
    return ONBOARDING_ANALYSIS_STEP_LABELS.map((label, i) => ({
      id: i + 1,
      label,
      state: 'pending' as const,
      visible: i === 0,
    }));
  }

  const activeIndex = Math.min(
    ONBOARDING_ANALYSIS_STEP_LABELS.length - 1,
    Math.floor((progressPct / 100) * ONBOARDING_ANALYSIS_STEP_LABELS.length),
  );
  const allDone = progressPct >= 100;

  return ONBOARDING_ANALYSIS_STEP_LABELS.map((label, i) => {
    const isCompleted = allDone || i < activeIndex;
    const isActive = !allDone && i === activeIndex;
    const state: AnalysisStepItem['state'] = isCompleted ? 'completed' : isActive ? 'active' : 'pending';
    return {
      id: i + 1,
      label,
      state,
      visible: i <= activeIndex || allDone,
    };
  });
}

export function activeAnalysisStepIndex(progressPct: number, running: boolean): number {
  if (!running) return 0;
  return Math.min(
    ONBOARDING_ANALYSIS_STEP_LABELS.length - 1,
    Math.floor((progressPct / 100) * ONBOARDING_ANALYSIS_STEP_LABELS.length),
  );
}
