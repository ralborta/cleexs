'use client';

/**
 * Mini-CMS de textos editables: helper `t(key, default)` para que el admin
 * pueda sobrescribir textos desde /admin/textos sin tocar código.
 *
 * Cómo funciona:
 * 1. <AppStringsProvider> en el root del layout hace UN fetch a /api/public/strings
 *    al montar, y guarda el diccionario en memoria (React context).
 * 2. El hook `useT()` devuelve `t(key, defaultValue)` que:
 *      - Si la key existe en el diccionario → devuelve el override.
 *      - Si NO existe → devuelve el defaultValue (el texto que estaba hoy en código).
 * 3. Cualquier cambio en /admin/textos se refleja en máximo ~60s (cache HTTP) o
 *    al recargar la página (lo que pase primero).
 *
 * Por qué client-only: evita mismatch de hidratación, no requiere meter fetch en
 * server components y mantiene el SSR idéntico al actual (siempre se renderiza
 * el default y luego se reemplaza si hay override).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type AppStringsDict = Record<string, string>;

type AppStringsContextValue = {
  loaded: boolean;
  locale: string;
  dict: AppStringsDict;
  t: (key: string, defaultValue: string) => string;
};

const AppStringsContext = createContext<AppStringsContextValue>({
  loaded: false,
  locale: 'es',
  dict: {},
  t: (_key, defaultValue) => defaultValue,
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function AppStringsProvider({
  children,
  initialLocale = 'es',
}: {
  children: React.ReactNode;
  initialLocale?: string;
}) {
  const [dict, setDict] = useState<AppStringsDict>({});
  const [loaded, setLoaded] = useState(false);
  const [locale] = useState(initialLocale);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/public/strings?locale=${encodeURIComponent(locale)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const data = (await res.json()) as { strings?: AppStringsDict };
        if (cancelled) return;
        setDict(data.strings || {});
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const t = useCallback(
    (key: string, defaultValue: string): string => {
      const override = dict[key];
      if (override == null || override === '') return defaultValue;
      return override;
    },
    [dict]
  );

  const value = useMemo(() => ({ loaded, locale, dict, t }), [loaded, locale, dict, t]);

  return <AppStringsContext.Provider value={value}>{children}</AppStringsContext.Provider>;
}

/** Hook principal: `const { t } = useT(); t('hero.title', 'Default')`. */
export function useT() {
  return useContext(AppStringsContext);
}

/**
 * Versión "shorthand" para cuando solo necesitás t() sin el resto del context.
 * Útil en componentes muy simples.
 */
export function useAppString(key: string, defaultValue: string): string {
  const { t } = useContext(AppStringsContext);
  return t(key, defaultValue);
}
