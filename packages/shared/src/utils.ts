// Utilidades compartidas

import type { Top3Entry } from './types';

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

