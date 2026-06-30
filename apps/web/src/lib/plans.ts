export type BillingMode = 'monthly' | 'annual';

export interface PlanDefinition {
  id: 'free' | 'crecimiento' | 'enterprise';
  name: string;
  monthlyPrice: number | null;
  contactOnly?: boolean;
  periodLabel: string;
  description: string;
  enginesTitle: string;
  engines: string[];
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
}

export const APP_PLANS: PlanDefinition[] = [
  {
    id: 'free',
    name: 'Plan',
    monthlyPrice: 0,
    periodLabel: '/mes',
    description: 'Cleexs Score visible y reportes esenciales para empezar a medir frente a la competencia.',
    enginesTitle: 'Motores incluidos',
    engines: ['ChatGPT'],
    features: [
      '1 sitio web',
      'Hasta 5 marcas de competencia en reportes',
      'Cleexs Score y resumen público',
      'Reportes con profundidad acotada',
      'Soporte por email',
    ],
    cta: 'Comenzar con Plan',
  },
  {
    id: 'crecimiento',
    name: 'Premium',
    monthlyPrice: 99,
    periodLabel: '/mes',
    description: 'Reporte completo, más competidores en análisis y motores extra para decisiones serias.',
    enginesTitle: 'Motores incluidos',
    engines: ['ChatGPT', 'Gemini', 'Perplexity', 'Claude'],
    features: [
      '1 sitio web',
      '25 prompts trackeados',
      'Hasta 10 marcas de competencia en reportes',
      'Alertas',
      'Cleexs Score y reporte profundo',
      'Soporte prioritario',
      'Reportes más frecuentes',
      'Google Analytics conectado',
    ],
    cta: 'Elegir Premium',
    highlighted: true,
    badge: 'Recomendado',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    contactOnly: true,
    periodLabel: '',
    description: 'Para equipos, múltiples marcas y necesidades de seguimiento avanzadas.',
    enginesTitle: 'Incluye',
    engines: ['Setup asistido', 'Integraciones', 'Soporte dedicado'],
    features: [
      'Productos ilimitados',
      'Hasta 1000 prompts',
      'Hasta 10 sitios web',
      'Hasta 50 competidores',
      'Alertas avanzadas',
      'Soporte telefónico',
      'Reportes personalizados',
    ],
    cta: 'Hablar con ventas',
  },
];

export function getAnnualPrice(monthlyPrice: number): number {
  return Math.round(monthlyPrice * 0.8);
}

