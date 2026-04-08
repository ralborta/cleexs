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
    name: 'Siempre Gratis',
    monthlyPrice: 0,
    periodLabel: '/mes',
    description: 'Ideal para entender cómo te ven las IAs y empezar a medir.',
    enginesTitle: 'Motores incluidos',
    engines: ['ChatGPT'],
    features: [
      '1 sitio web',
      '1 prompt trackeado',
      '1 competidor',
      'Cleexs Score mensual',
      'Soporte por email',
      'Reporte mensual',
    ],
    cta: 'Comenzar gratis',
  },
  {
    id: 'crecimiento',
    name: 'Crecimiento',
    monthlyPrice: 99,
    periodLabel: '/mes',
    description: 'Para marcas que ya quieren monitoreo activo y estrategia sostenida.',
    enginesTitle: 'Motores incluidos',
    engines: ['ChatGPT', 'Gemini', 'Perplexity', 'Claude'],
    features: [
      '1 sitio web',
      '25 prompts trackeados',
      '10 competidores',
      'Alertas',
      'Cleexs Score mensual',
      'Soporte prioritario',
      'Reporte semanal',
      'Google Analytics conectado',
    ],
    cta: 'Elegir crecimiento',
    highlighted: true,
    badge: 'Más elegido',
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

