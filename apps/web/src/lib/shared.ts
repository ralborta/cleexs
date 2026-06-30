// Tipos y utilidades compartidas (copiadas de @cleexs/shared para Vercel)

export enum TenantType {
  ROOT = 'ROOT',
  AGENCY = 'AGENCY',
  DIRECT_CLIENT = 'DIRECT_CLIENT',
  AGENCY_CLIENT = 'AGENCY_CLIENT',
}

export enum TenantStatus {
  active = 'active',
  suspended = 'suspended',
  archived = 'archived',
}

export enum UserRole {
  owner = 'owner',
  editor = 'editor',
  viewer = 'viewer',
}

export enum RunStatus {
  pending = 'pending',
  running = 'running',
  completed = 'completed',
  failed = 'failed',
}

export interface Top3Entry {
  position: number; // 1, 2, 3
  name: string;
  type: 'brand' | 'competitor';
}

export interface PromptResultFlags {
  ambiguous_ranking?: boolean;
  no_ranking?: boolean;
  brand_not_detected?: boolean;
  competitor_detected?: boolean;
  parsing_error?: boolean;
  incomplete_response?: boolean;
  manual_override?: boolean;
}

export interface PRIAByCategory {
  [categoryId: string]: number; // PRIA score 0-100
}

/**
 * Calcula el score PRIA para una posición en el Top 3
 */
export function calculateScore(position: number | null): number {
  if (!position || position < 1 || position > 3) {
    return 0;
  }
  
  const scores = {
    1: 1.0,
    2: 0.7,
    3: 0.4,
  };
  
  return scores[position as keyof typeof scores] || 0;
}

/**
 * Calcula PRIA total (promedio de scores * 100)
 */
export function calculatePRIA(scores: number[]): number {
  if (scores.length === 0) return 0;
  const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(avg * 100 * 100) / 100; // Redondear a 2 decimales
}

/**
 * Encuentra la posición de una marca en el Top 3
 */
export function findBrandPosition(
  top3: Top3Entry[],
  brandName: string,
  aliases: string[]
): number | null {
  const normalizedBrand = normalizeBrandName(brandName);
  const normalizedAliases = aliases.map(normalizeBrandName);
  
  for (const entry of top3) {
    const normalizedEntry = normalizeBrandName(entry.name);
    if (
      normalizedEntry === normalizedBrand ||
      normalizedAliases.includes(normalizedEntry)
    ) {
      return entry.position;
    }
  }
  
  return null;
}

/**
 * Normaliza nombre de marca para comparación
 */
function normalizeBrandName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover tildes
    .replace(/[^\w\s]/g, '') // Remover puntuación
    .trim();
}
