/**
 * Catálogo de textos editables desde /admin/textos.
 *
 * Cada entrada describe:
 *  - key:        identificador único usado por t(key, default)
 *  - default:    texto que se ve en la app si NO hay override
 *  - section:    agrupador en la UI admin
 *  - description: dónde aparece este texto / qué contexto tiene
 *  - multiline:  si true, se edita en textarea; si no, en input
 *
 * Para agregar un texto editable nuevo:
 *  1. Reemplazá el texto hardcodeado por `t('mi.key', 'texto actual')`
 *     usando el hook `useT()` de `@/lib/app-strings`.
 *  2. Agregá una entrada acá con la misma key y el mismo default.
 *  3. Listo: aparece en /admin/textos y se puede editar.
 */

export type AppStringCatalogEntry = {
  key: string;
  default: string;
  section: string;
  description: string;
  multiline?: boolean;
};

export const APP_STRINGS_CATALOG: AppStringCatalogEntry[] = [
  // ────────────────────────────────────────────────────────────────
  // Tab Tráfico de IAs (portal Crecimiento)
  // ────────────────────────────────────────────────────────────────
  {
    key: 'trafico_ia.header.titulo',
    default: '¿Cuánto tráfico te están enviando las IAs?',
    section: 'Tráfico de IAs',
    description: 'Título del header en la pestaña Tráfico de IAs del portal.',
  },
  {
    key: 'trafico_ia.header.subtitulo',
    default: 'Medí en tiempo real cuántos usuarios llegan a {brand} desde ChatGPT, Perplexity, Gemini, Claude y otras IAs generativas.',
    section: 'Tráfico de IAs',
    description: 'Subtítulo del header. Usá {brand} para que se reemplace por el nombre de la marca del cliente.',
    multiline: true,
  },
  {
    key: 'trafico_ia.no_premium.titulo',
    default: 'Medí cuánto tráfico te envían las IAs',
    section: 'Tráfico de IAs',
    description: 'Título del upsell cuando el cliente NO tiene plan Crecimiento.',
  },
  {
    key: 'trafico_ia.no_premium.cuerpo',
    default: 'Conectá tu cuenta de Google Analytics para ver, en tiempo real, cuántos usuarios llegan a tu sitio desde ChatGPT, Perplexity, Gemini y Claude. Esta función está disponible en el plan Crecimiento.',
    section: 'Tráfico de IAs',
    description: 'Cuerpo del upsell. Aparece debajo del título cuando el plan es Free.',
    multiline: true,
  },
  {
    key: 'trafico_ia.no_premium.cta',
    default: 'Pasarme al plan Crecimiento',
    section: 'Tráfico de IAs',
    description: 'Botón principal del upsell.',
  },
  {
    key: 'trafico_ia.conectar.titulo',
    default: 'Conectá Google Analytics',
    section: 'Tráfico de IAs',
    description: 'Título de la card cuando el cliente Crecimiento todavía no conectó Google.',
  },
  {
    key: 'trafico_ia.conectar.cuerpo',
    default: 'Antes de conectar, te vamos a mostrar exactamente qué permisos pedimos y qué datos vamos a leer. Vos decidís si avanzar.',
    section: 'Tráfico de IAs',
    description: 'Texto explicativo arriba del botón Conectar Google Analytics.',
    multiline: true,
  },
  {
    key: 'trafico_ia.conectar.cta',
    default: 'Conectar Google Analytics',
    section: 'Tráfico de IAs',
    description: 'Texto del botón principal para iniciar OAuth.',
  },

  // ────────────────────────────────────────────────────────────────
  // Modal de confirmación OAuth Google
  // ────────────────────────────────────────────────────────────────
  {
    key: 'oauth_google.modal.titulo',
    default: 'Conectar Google Analytics',
    section: 'Modal OAuth Google',
    description: 'Título del modal de confirmación previo al OAuth de Google.',
  },
  {
    key: 'oauth_google.modal.subtitulo',
    default: 'Antes de redirigirte a Google, revisá qué te vamos a pedir',
    section: 'Modal OAuth Google',
    description: 'Subtítulo del modal.',
  },
  {
    key: 'oauth_google.modal.cta_confirmar',
    default: 'Sí, conectar con Google',
    section: 'Modal OAuth Google',
    description: 'Botón final del modal que dispara el redirect a Google.',
  },
  {
    key: 'oauth_google.modal.cta_cancelar',
    default: 'Cancelar',
    section: 'Modal OAuth Google',
    description: 'Botón secundario del modal.',
  },
];

/** Devuelve el catálogo agrupado por section, ordenado por section. */
export function groupCatalogBySection(): Array<{ section: string; items: AppStringCatalogEntry[] }> {
  const map = new Map<string, AppStringCatalogEntry[]>();
  for (const entry of APP_STRINGS_CATALOG) {
    const arr = map.get(entry.section) ?? [];
    arr.push(entry);
    map.set(entry.section, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([section, items]) => ({ section, items }));
}
