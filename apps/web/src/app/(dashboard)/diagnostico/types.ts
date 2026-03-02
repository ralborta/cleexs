/** Tipado para el dashboard de diagnóstico. Sustituir por datos de API cuando corresponda. */

export type ModelTab = 'consolidado' | 'chatgpt' | 'gemini';

export interface BrandRankRow {
  rank: number;
  marca: string;
  score: number;
  pctTop3: number;
}

export interface CleexsScoreData {
  score: number;
  vsLastMonth?: number;
  ponderadoPor: string;
  modelo: string;
  miniMetricas: { label: string; value: number }[];
  tendencia: { mes: string; valor: number }[];
}

export interface IntencionItem {
  key: string;
  label: string;
  value: number;
  peso?: number;
}

export interface MetricItem {
  id: number;
  label: string;
  value: number;
}

export interface ComparisonRow {
  marca: string;
  tipo: 'marca' | 'competidor';
  apariciones: number;
  pctTop3: number;
}

export interface SuggestionItem {
  text: string;
  highlights?: string[];
}

export interface DiagnosticoDashboardData {
  brandName: string;
  industry?: string;
  ranking: BrandRankRow[];
  cleexsScore: CleexsScoreData;
  intenciones: IntencionItem[];
  metricas: MetricItem[];
  comparaciones: ComparisonRow[];
  sugerencias: SuggestionItem[];
}
