import type { DiagnosticoDashboardData } from './types';

/** Datos mock para el dashboard. Reemplazar por fetch(API) pasando diagnosticId u otro identificador. */
export const mockDiagnosticoData: DiagnosticoDashboardData = {
  brandName: 'Jumbo supermercados',
  industry: 'General',
  ranking: [
    { rank: 1, marca: 'Líder', score: 1.4, pctTop3: 33.3 },
    { rank: 2, marca: 'Cencosud', score: 1.6, pctTop3: 29.6 },
    { rank: 3, marca: 'Jumbo', score: 1.8, pctTop3: 25.9 },
    { rank: 4, marca: 'Walmart', score: 2.0, pctTop3: 22.2 },
    { rank: 5, marca: 'Falabella', score: 2.2, pctTop3: 18.5 },
    { rank: 6, marca: 'Tottus', score: 2.4, pctTop3: 14.8 },
  ],
  cleexsScore: {
    score: 28,
    vsLastMonth: 6,
    ponderadoPor: 'intención',
    modelo: 'consolidado',
    miniMetricas: [
      { label: 'Shortlist presence', value: 56 },
      { label: 'Recommendation share', value: 18 },
    ],
    tendencia: [
      { mes: 'Ene', valor: 18 },
      { mes: 'Feb', valor: 20 },
      { mes: 'Mar', valor: 22 },
      { mes: 'Abr', valor: 24 },
      { mes: 'May', valor: 26 },
      { mes: 'Jun', valor: 28 },
    ],
  },
  intenciones: [
    { key: 'urgencia', label: 'Urgencia', value: 33, peso: 30 },
    { key: 'calidad', label: 'Calidad', value: 33, peso: 40 },
    { key: 'precio', label: 'Precio', value: 17, peso: 30 },
  ],
  metricas: [
    { id: 1, label: 'Confianza de formato', value: 100 },
    { id: 2, label: 'Mención de marca', value: 67 },
    { id: 3, label: 'Aparición en Top 3', value: 56 },
    { id: 4, label: 'Posición #1', value: 56 },
  ],
  comparaciones: [
    { marca: 'Líder', tipo: 'competidor', apariciones: 7, pctTop3: 25.9 },
    { marca: 'Cencosud', tipo: 'competidor', apariciones: 6, pctTop3: 22.2 },
    { marca: 'Jumbo supermercados', tipo: 'marca', apariciones: 5, pctTop3: 18.5 },
  ],
  sugerencias: [
    { text: 'Subir cobertura en intención Precio (hoy baja).', highlights: ['Precio'] },
    { text: 'Agregar prompts "marca + categoría" para mejorar shortlist.', highlights: ['marca + categoría'] },
    { text: 'Alinear naming entre web, reseñas y redes (reduce sustitución).', highlights: [] },
  ],
};
