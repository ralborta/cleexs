# Alcance y complejidad – Trabajo Cleexs (WP + app)

Documento para asignar el trabajo a un desarrollador o cotizarlo. Incluye tipo de complejidad y descripción del alcance.

---

## Resumen por tipo de trabajo

| Ámbito | Complejidad | Tiempo estimado (referencia) |
|--------|-------------|------------------------------|
| Ajustes en WordPress (cleexs.net) | **Baja** | 2–4 h |
| Conexión app + documentación (ya hecho en repo) | **Baja** | Ya implementado |
| Replicar diseño WP en app Next.js (opcional) | **Media** | 4–8 h |

---

## 1. Trabajo en WordPress (cleexs.net) – Complejidad **BAJA**

**Tipo de tarea:** Mantenimiento y maquetación en sitio existente (Elementor + tema Astra). No requiere programación compleja ni backend.

**Qué hace el desarrollador:**
- Corregir errores de visualización en mobile (overflow, márgenes).
- Ajustar estilos en Elementor: fondos, espaciados, tamaños de cajas y botones.
- Desactivar menú fijo/sticky en el header.
- Reemplazar textos (footer, “aprendE” → “aprendé”) e imágenes (métrica xubio.com).
- Embeber video de YouTube en la página.
- Implementar el botón “Checkear visibilidad” para que redirija a la app Cleexs con el dominio en la URL (script sencillo o enlace con parámetro).
- Cuando el cliente defina ítems del menú y FAQ: cargar esos contenidos en WP.

**Requisitos:** Conocimiento de WordPress y Elementor (nivel usuario avanzado o front-end junior). Opcional: HTML/CSS y un poco de JavaScript para el botón de “Checkear visibilidad”.

**Cómo describirlo para un desarrollador:**

> “Ajustes de diseño y contenido en el sitio cleexs.net (WordPress + Elementor): corrección de responsive en mobile, reducción de espacios en blanco, achicar caja de búsqueda y botones, menú no fijo, cambio de imagen y textos (footer, aprendé), embed de video YouTube, y conectar el botón ‘Checkear visibilidad’ con la app Cleexs pasando el dominio por URL. Luego, cargar ítems finales del menú y preguntas/respuestas del FAQ según entregue el cliente. Guía paso a paso disponible.”

---

## 2. Trabajo en app Cleexs (Next.js) – Ya realizado en el repo

**Complejidad:** **BAJA** (cambios puntuales ya hechos).

**Qué se hizo:**
- Soporte de `?url=` en `/diagnostico/crear` para recibir el dominio desde cleexs.net y prellenar el formulario.
- Nuevo plan “Crecimiento” en `/planes` con Cleexs Score semanal y 4 motores (ChatGPT, Gemini, Perplexity, Claude).
- Documentación: qué cambios son WP vs app, guía de ajustes WP, y alcance para desarrollador.

**No requiere trabajo adicional** salvo deploy y, si hace falta, ajustar textos del plan Crecimiento.

---

## 3. Trabajo opcional: replicar diseño de WP en la app Next.js

**Complejidad:** **MEDIA**.

**Qué implica:** Llevar el diseño actual de la landing de cleexs.net (hero “Puede serlo”, input de dominio, botones, secciones) a una ruta de la app Cleexs (Next.js + Tailwind/shadcn) para que todo el flujo viva en un solo producto.

**Incluye:** Maquetación responsive, estilos y espaciados, posiblemente animaciones suaves; reutilizar el flujo actual de diagnóstico (crear → verificando → resultado). No incluye backend nuevo.

**Cómo describirlo:**

> “Replicar en la app Cleexs (Next.js) el diseño de la landing actual de cleexs.net: hero con título, input de dominio y botón ‘Checkear visibilidad’, secciones inferiores y estilo visual equivalente. Mantener integración con el flujo de diagnóstico existente. Responsive y, si aplica, animaciones ligeras.”

---

## Descripción unificada para un solo desarrollador (WP + opcional app)

Si una misma persona hace todo (solo WP o WP + réplica en app):

> **Alcance:** (1) Ajustes en el sitio cleexs.net (WordPress/Elementor): corrección mobile, espaciados, tamaños de caja y botones, menú no fijo, cambio de imagen y textos (footer, aprendé), video YouTube embebido, y conexión del botón “Checkear visibilidad” con la app Cleexs vía URL con dominio. Luego, actualizar menú y FAQ con contenidos que entregue el cliente. (2) [Opcional] Replicar el diseño de esa landing en la app Cleexs (Next.js) en una ruta dedicada, manteniendo el flujo de diagnóstico actual.  
> **Complejidad:** Baja para la parte WP; media si se incluye la réplica en Next.js.  
> **Entregables:** Sitio cleexs.net ajustado y publicado; documentación/guía de pasos realizados; [opcional] nueva ruta en app con diseño replicado.

---

## Niveles de complejidad (definición usada aquí)

- **Baja:** Cambios en UI/contenido, configuración en editor visual, scripts o enlaces sencillos. No requiere arquitectura ni lógica de negocio nueva.
- **Media:** Maquetación desde cero o réplica de diseño en otro stack, integración con flujos existentes, posible uso de estado y componentes.
- **Alta:** No aplica en este alcance (backend nuevo, integraciones complejas, etc.).
