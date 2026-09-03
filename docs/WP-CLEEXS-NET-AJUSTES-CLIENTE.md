# Ajustes en WordPress (cleexs.net) – Guía paso a paso

Guía para aplicar en Elementor/WordPress los cambios que pide el cliente.  
Quien tenga acceso al editor de la página en cleexs.net puede seguir estos pasos.

---

## 1. Errores en mobile

- **Qué hacer:** Abrir la página en **vista previa móvil** (icono de móvil en la barra inferior de Elementor) y anotar los 2 errores que aparecen (mensaje o captura).
- **Dónde:** Elementor → editar la página → abajo "Responsive" → elegir Mobile.
- Si los errores son de **contenido que se sale** (overflow): en el bloque que se rompe → pestaña **Avanzado** → **Ancho** / **Padding** y ajustar para móvil (o activar "Contenido en columna").
- Si son **errores de consola** (JavaScript): puede ser un widget o script de terceros; desactivar plugins uno a uno en modo móvil para localizar el que falla.

---

## 2. Fondo azul en “Favorita”

- **Qué hacer:** La sección o bloque donde está el texto “Favorita” debe tener **fondo azul completo** (no solo un detalle).
- **Dónde:** Clic en la sección/columna que contiene “Favorita” → panel izquierdo **Estilo** → **Fondo** → **Color clásico** (o degradado) y elegir el mismo azul que usa el sitio. Aplicar a toda la sección para que “sea todo azul de fondo”.

---

## 3. “aprendE” → “aprendé” (sin mayúscula en la E)

- **Qué hacer:** Buscar en la página el texto “aprendE” y cambiarlo por **“aprendé”** (minúscula, con tilde).
- **Dónde:** Clic en el widget de **Texto** o **Encabezado** donde está ese texto → editar y escribir: `aprendé`.

---

## 4. Menos “aire” (espacio en blanco)

**a) Entre el menú de navegación y el texto “tu marca…”**

- Clic en la **sección** que está justo debajo del menú (la que tiene “tu marca…” o el hero).
- Panel izquierdo → **Avanzado** → **Padding** (o **Margen**).
- Reducir **Padding superior** (Top), por ejemplo de 80px a 40px (o el valor que tengan). Ajustar hasta que el espacio se vea bien.

**b) Entre “Puede serlo” y “Primer paso”**

- Clic en el widget que tiene “Puede serlo” (título) → **Avanzado** → **Margen inferior** y bajarlo (ej. de 24px a 12px).
- O clic en el bloque que tiene “Primer paso” → **Avanzado** → **Margen superior** y reducirlo.
- Objetivo: que haya menos espacio vertical entre esas dos líneas.

---

## 5. Caja del URL más chica (mitad de tamaño)

- Clic en el **widget del input** donde se ingresa el dominio (ej. “Ingresá tu dominio”).
- En **Contenido** o **Estilo**: reducir **Ancho** (Width). Si está al 100%, poner 50% o un valor fijo menor (ej. 400px). Si usan un contenedor, reducir el ancho del contenedor.
- Ajustar en **Responsive** (Desktop / Tablet / Mobile) para que no se vea cortado en móvil.

---

## 6. Los 3 “botoncitos” debajo de la caja de búsqueda: achicar ancho

- Seleccionar cada uno de los 3 elementos (Cómo rankeás, Qué dice de tu marca, Qué competidores aparecen).
- En **Contenido** o **Estilo** → **Ancho**: en lugar de “Completo” o 100%, usar un ancho fijo (ej. 180px o 200px) o un % menor (ej. 30% cada uno si están en fila).
- Si están dentro de una **columna**, reducir el ancho de la columna en el layout.

---

## 7. Menú: que no sea barra fija flotante

- Ir a **Apariencia** → **Personalizar** (o al **Header** en Elementor si el menú está en una plantilla).
- Buscar la opción del **encabezado** (Header): suele llamarse “Sticky”, “Fijo al hacer scroll”, “Fixed” o “Floating”.
- **Desactivar** esa opción para que el menú suba con el scroll y no quede flotando arriba.

Si usan **Elementor Pro** y el header es un template: editar el template del Header → clic en la sección del menú → **Avanzado** → **Efectos de movimiento** / **Sticky** → desactivar.

---

## 8. Imagen: cambiar por una real (métrica para xubio.com)

- El cliente debe pasar la **imagen real** (métrica para xubio.com) o el enlace.
- En Elementor: clic en la **imagen** actual → panel **Contenido** → **Elegir imagen** → subir la nueva o pegar la URL.
- Guardar.

---

## 9. Video de YouTube embebido

- URL a usar: `https://www.youtube.com/watch?v=iaIckB8k7R0&t=37s`
- En Elementor: arrastrar el widget **YouTube** (o **Video**) a la sección donde debe ir el video.
- En **URL del video** pegar: `https://www.youtube.com/watch?v=iaIckB8k7R0` (el `&t=37s` es el segundo de inicio; algunos widgets lo aceptan en la misma URL).
- Ajustar ancho y relación de aspecto si hace falta.

---

## 10. Hostear en vivo en cleexs.net

- Esto es **configuración de dominio y hosting** (Hostinger u otro).
- En el panel de Hostinger: **Dominios** → añadir/Conectar dominio **cleexs.net** al sitio WordPress correcto.
- Si el sitio está en un subdominio temporal, usar “Mover dominio” o “Conectar dominio” apuntando cleexs.net al mismo proyecto.
- No hay pasos dentro de Elementor para esto; es DNS y hosting.

---

## 11. Última caja (“la IA ya menciona tus competidores”) tarda en cargar (lazy load)

- Clic en esa **sección** o **widget** (la última caja).
- En **Avanzado** → buscar opciones de **Lazy Load** o **Animación al entrar**. Si tiene “animación al scroll”, puede retrasar la sensación de carga: probar desactivarla o acortar el delay.
- Si la demora es por una **imagen pesada** dentro de la caja: reemplazar por una optimizada (menor tamaño/resolución) o usar un plugin de optimización de imágenes (ej. ShortPixel, Imagify).
- En **Elementor** → **Ajustes** → **Optimización**: revisar si hay “Improved Asset Loading” o “Lazy Load” y probar activar/desactivar según mejore el comportamiento de esa caja.

---

## 12. Footer: cambiar el texto

- **Quitar:** “Todos los derechos © 2026 hotpink-porcupine-851380.hostingersite.com | Funciona gracias a Tema Astra para WordPress”
- **Poner solo:** “Todos los derechos reservados © 2026”

**Dónde:**

- Si el footer se edita con **Elementor**: ir a **Plantillas** → **Theme Parts** → **Footer** (o la plantilla que tenga el pie). Editar el widget de texto del footer y reemplazar por: `Todos los derechos reservados © 2026`.
- Si es del **tema Astra**: **Apariencia** → **Personalizar** → **Footer** (o **Configuración del sitio** → pie de página) y cambiar el texto en el campo correspondiente.

---

## 13. Que “Checkear visibilidad” lleve al usuario a nuestro proceso (app Cleexs)

El usuario puede ingresar **el nombre de la marca** o **el sitio web (dominio)** en el mismo campo. Al hacer clic en “Checkear visibilidad”, debe ir a la app Cleexs con ese valor ya cargado y seguir nuestro flujo (diagnóstico → verificando → resultado).

**Cómo funciona en la app:** La app acepta:
- `?url=dominio.com` → rellena el campo URL.
- `?brand=Nombre Marca` o `?marca=Nombre Marca` → rellena el campo Marca.
- `?q=valor` → si el valor parece un dominio (tiene punto, ej. `tumarca.com`) rellena URL; si no (ej. `Colgate`), rellena Marca.

Así en WP basta con **un solo campo** y pasar su valor en `?q=`. La app decide sola si es dominio o marca.

**Opción A – Botón + script (recomendada, un solo input)**

1. En Elementor, el **input** donde el usuario escribe (dominio o marca): clic en el widget → **Avanzado** → **Atributos CSS** → Añadir: Nombre `id`, Valor `input-checkear-visibilidad`.
2. El **botón** “Checkear visibilidad” no debe enviar un formulario a WP. En el botón → **Avanzado** → **Atributos CSS** → Añadir: Nombre `data-checkear-visibilidad`, Valor `1`.
3. Añadir un widget **HTML** en la misma sección (arriba o abajo del input/botón) con este código. **Reemplazá `https://TU-APP-CLEEXS.com`** por la URL real de la app (ej. `https://cleexs.nivel41.com`):

```html
<script>
(function () {
  var APP = 'https://app.cleexs.net/diagnostico/crear';
  var STORAGE_KEY = 'cleexs_diagnostic_attribution';

  function attributionFromReferrer() {
    try {
      var refUrl = document.referrer ? new URL(document.referrer) : null;
      if (!refUrl) return null;
      var host = refUrl.hostname.replace(/^www\./, '').toLowerCase();
      var isYt =
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'youtu.be' ||
        host === 'youtube-nocookie.com';
      if (!isYt) return null;
      var videoId = refUrl.searchParams.get('v') || '';
      // Video Herederos conocido
      if (videoId && videoId.toLowerCase() === 'h6tusfuydqo') {
        return {
          ref: 'herederos',
          utm_source: 'auspiciador',
          utm_medium: 'youtube',
          utm_campaign: 'herederos',
        };
      }
      return {
        ref: '',
        utm_source: 'youtube',
        utm_medium: 'referral',
        utm_campaign: videoId ? 'yt_' + videoId.toLowerCase() : 'youtube_organic',
      };
    } catch (e) {
      return null;
    }
  }

  function attributionFromLanding() {
    var sp = new URLSearchParams(window.location.search);
    var ref = sp.get('ref') || sp.get('ref_code') || '';
    var utm_source = sp.get('utm_source') || '';
    var utm_medium = sp.get('utm_medium') || '';
    var utm_campaign = sp.get('utm_campaign') || '';
    if (!ref && !utm_source && !utm_medium && !utm_campaign) {
      var fromRef = attributionFromReferrer();
      if (fromRef) {
        ref = fromRef.ref || '';
        utm_source = fromRef.utm_source || '';
        utm_medium = fromRef.utm_medium || '';
        utm_campaign = fromRef.utm_campaign || '';
      }
    }
    if (ref || utm_source || utm_medium || utm_campaign) {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ref: ref, utm_source: utm_source, utm_medium: utm_medium, utm_campaign: utm_campaign })
        );
      } catch (e) {}
    }
    return { ref: ref, utm_source: utm_source, utm_medium: utm_medium, utm_campaign: utm_campaign };
  }

  function appendAttribution(params) {
    var a = attributionFromLanding();
    if (a.ref) params.set('ref', a.ref);
    if (a.utm_source) params.set('utm_source', a.utm_source);
    if (a.utm_medium) params.set('utm_medium', a.utm_medium);
    if (a.utm_campaign) params.set('utm_campaign', a.utm_campaign);
  }

  document.addEventListener('DOMContentLoaded', function () {
    attributionFromLanding();
    var btn = document.querySelector('[data-checkear-visibilidad]');
    var input = document.getElementById('input-checkear-visibilidad');
    if (btn && input) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var valor = (input.value || '').trim();
        if (!valor) {
          alert('Ingresá tu dominio o el nombre de tu marca');
          return;
        }
        var params = new URLSearchParams();
        appendAttribution(params);
        params.set('q', valor);
        window.location.href = APP + '?' + params.toString();
      });
    }
  });
})();
</script>
```

**Links de campaña / auspiciador:** deben apuntar a la **home** de cleexs.net, no a `/diagnostico/crear` (esa ruta no existe en WordPress y da 404). Ejemplo:

`https://cleexs.net/?ref=tipito_entrevista&utm_source=sponsor&utm_medium=youtube&utm_campaign=entrevista`

**Herederos (video `h6TUsFUyDQo`):** pegar en la descripción de YouTube:

`https://cleexs.net/?ref=herederos&utm_source=auspiciador&utm_medium=youtube&utm_campaign=herederos`

El usuario ve la landing; al hacer clic en “Checkear visibilidad”, el script anterior lleva a la app con el mismo `ref` y UTM. Si alguien llega desde YouTube **sin** esos params, el script (y la app) intentan inferir `youtube` / `herederos` desde `document.referrer` cuando el navegador lo envía.

4. Si el input en Elementor tiene otro ID, cambiá en el script `input-checkear-visibilidad` por ese ID.

**Opción B – Enlace directo (sin rellenar)**

- Enlace a `https://TU-APP-CLEEXS.com/diagnostico/crear`. El usuario escribe de nuevo en la app. No recomendado si querés que “lleve directo” al proceso.

**URL de la app:** la que tengan en producción (ej. `https://cleexs.nivel41.com` o el dominio de la app en Vercel).

---

## Menú (Segunda parte – punto 3)

- Cuando el cliente defina las **opciones finales** del menú, en WP: **Apariencia** → **Menús** → elegir el menú del header y añadir/quitar/reordenar enlaces según la lista que den.

---

## FAQ (Segunda parte – punto 4)

- El cliente debe pasar **preguntas y respuestas** (texto).
- En Elementor: en la sección FAQ usar el widget **Icon Box / Acordeón** o **FAQ** (si lo tiene el tema) y cargar cada pregunta como título y cada respuesta como contenido. Pegar los textos que envíe el cliente.

---

## Resumen rápido

| # | Acción en WP |
|---|------------------|
| 1 | Revisar mobile y corregir overflow o script que falle |
| 2 | Sección “Favorita” → Estilo → Fondo azul completo |
| 3 | Reemplazar “aprendE” por “aprendé” |
| 4 | Reducir padding/margen entre menú y “tu marca” y entre “Puede serlo” y “Primer paso” |
| 5 | Input del URL → ancho ~50% o menor |
| 6 | 3 botoncitos → ancho reducido (ej. 180–200px o % menor) |
| 7 | Header/Menú → desactivar Sticky/Fixed |
| 8 | Cambiar imagen por la métrica real de xubio.com |
| 9 | Añadir widget YouTube con la URL del video |
| 10 | En Hostinger: conectar dominio cleexs.net |
| 11 | Optimizar lazy load / animación / imagen de la última caja |
| 12 | Footer: solo “Todos los derechos reservados © 2026” |
| 13 | Botón “Checkear visibilidad” → enlace a app con `?url=dominio` (script o enlace directo) |
| Menú | Definir ítems con el cliente y editarlos en Apariencia → Menús |
| FAQ | Cargar preguntas y respuestas que envíe el cliente en el widget FAQ |

Si en algún paso tu tema o Elementor se ve distinto (nombres de opciones, ubicación), decime qué ves y adaptamos los pasos a tu pantalla.
