import type { Top3Entry, PromptResultFlags } from '@cleexs/shared';

/**
 * Parsea el Top 3 de una respuesta de ChatGPT
 * Reglas de prioridad:
 * 1) Lista numerada (1., 2., 3.)
 * 2) Bullets (•, -, *)
 * 3) Secciones/párrafos por marca
 * 4) Texto corrido → ambiguous_ranking
 */
export function parseTop3(
  responseText: string,
  brandName: string,
  competitors: Array<{ name: string; aliases?: string[] }>
): {
  top3: Top3Entry[];
  flags: PromptResultFlags;
} {
  const flags: PromptResultFlags = {};
  const top3: Top3Entry[] = [];

  // Normalizar texto
  const normalized = responseText.toLowerCase();
  const allBrands = [
    { name: brandName, type: 'brand' as const },
    ...competitors.map((c) => ({ name: c.name, type: 'competitor' as const })),
  ];

  // 1) Intentar lista numerada (1., 2., 3. o 1) 2) 3))
  const numberedListRegex = /(?:^|\n)\s*(\d+)[\.\)]\s*([^\n]+)/gim;
  const numberedMatches = Array.from(responseText.matchAll(numberedListRegex));

  if (numberedMatches.length >= 3) {
    for (const match of numberedMatches.slice(0, 3)) {
      const position = parseInt(match[1]);
      const text = match[2].trim();
      const foundBrand = findBrandInText(text, allBrands);

      if (foundBrand) {
        top3.push({
          position,
          name: foundBrand.name,
          type: foundBrand.type,
        });
      }
    }

    if (top3.length > 0) {
      return { top3, flags };
    }
  }

  // 2) Intentar bullets (•, -, *, o -)
  const bulletRegex = /(?:^|\n)\s*[•\-\*]\s*([^\n]+)/gim;
  const bulletMatches = Array.from(responseText.matchAll(bulletRegex));

  if (bulletMatches.length >= 3) {
    let position = 1;
    for (const match of bulletMatches.slice(0, 3)) {
      const text = match[1].trim();
      const foundBrand = findBrandInText(text, allBrands);

      if (foundBrand) {
        top3.push({
          position,
          name: foundBrand.name,
          type: foundBrand.type,
        });
        position++;
      }
    }

    if (top3.length > 0) {
      return { top3, flags };
    }
  }

  // 3) Intentar secciones/párrafos separados
  const paragraphs = responseText.split(/\n\n+/);
  let position = 1;
  for (const para of paragraphs.slice(0, 3)) {
    const foundBrand = findBrandInText(para, allBrands);
    if (foundBrand && !top3.find((e) => e.name === foundBrand.name)) {
      top3.push({
        position,
        name: foundBrand.name,
        type: foundBrand.type,
      });
      position++;
    }
  }

  if (top3.length > 0) {
    return { top3, flags };
  }

  // 4) Texto corrido sin estructura clara
  flags.ambiguous_ranking = true;
  flags.no_ranking = true;

  return { top3, flags };
}

/**
 * Encuentra una marca en un texto
 */
function findBrandInText(
  text: string,
  brands: Array<{ name: string; type: 'brand' | 'competitor' }>
): { name: string; type: 'brand' | 'competitor' } | null {
  const normalizedText = normalizeText(text);

  for (const brand of brands) {
    const normalizedBrand = normalizeText(brand.name);
    if (normalizedText.includes(normalizedBrand)) {
      return brand;
    }
  }

  return null;
}

/**
 * Normaliza texto para comparación
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover tildes
    .replace(/[^\w\s]/g, '') // Remover puntuación
    .trim();
}
