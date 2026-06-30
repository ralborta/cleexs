# Cambios cleexs.net (WordPress) vs app Cleexs (este repo)

Resumen para el cliente: qué se hace en cada lado.

---

## PRIMERA PARTE

### Hecho en este repo (app Cleexs – Next.js / Vercel)

- **13. Conectar “Checkear visibilidad”**  
  Cuando en cleexs.net (o cualquier sitio) pongan un enlace con el dominio en la URL, el usuario cae en nuestro diagnóstico con el campo ya cargado.  
  **Cómo:** El botón “Checkear visibilidad” en WP debe apuntar a:
  `https://app.cleexs.net/diagnostico/crear?url=dominio.com`  
  (ej. `https://app.cleexs.net/diagnostico/crear?url=xubio.com`).  
  La app ya acepta `?url=` y rellena el campo; el usuario solo tiene que apretar “Iniciar diagnóstico”.

- **10. Plan Crecimiento**  
  En la página de planes de la app (`/planes`) se agregó el plan **Crecimiento** con:
  - Cleexs Score **semanal** (no mensual)
  - 4 motores: ChatGPT (OpenAI), Gemini (Google), Perplexity, Claude (Anthropic)
  - Texto listo para ajustar si quieren otros nombres de motores.

---

### Hacer en WordPress (cleexs.net)

Todo lo que ves y tocás en cleexs.net (diseño, textos, menú, footer) se cambia en WordPress/Elementor:

| # | Cambio | Dónde |
|---|--------|--------|
| 1 | Diseño final para hostear en Cleexs.net (luego Cleexs.com, Cleexs.com.br) | WP / DNS |
| 2 | Errores en mobile; fondo azul en “Favorita” (todo azul); “aprendE” sin mayúscula | WP / Elementor |
| 3 | Menos “aire”: entre menú y “tu marca…”; entre “Puede serlo” y “Primer paso” | WP / Elementor |
| 4 | Caja del URL más chica (ej. mitad de ancho) | WP / Elementor |
| 5 | Los 3 botoncitos debajo de la caja de búsqueda: achicar ancho | WP / Elementor |
| 6 | Menú: que no sea barra fija flotante | WP / Elementor |
| 7 | Imagen: cambiar por una real; métrica para xubio.com | WP / Elementor |
| 8 | Video de YouTube embebido: `https://www.youtube.com/watch?v=iaIckB8k7R0&t=37s` | WP / Elementor |
| 9 | Hostear en vivo en cleexs.net (aunque no esté terminado) | Hostinger / DNS |
| 11 | Optimizar carga (lazy load) de la última caja “la IA ya menciona tus competidores” | WP / tema o plugins |
| 12 | Footer: reemplazar texto por “Todos los derechos reservados © 2026” | WP / Elementor o tema |

**Conectar con nuestra app (item 13):**  
En el botón/link “Checkear visibilidad” del formulario, poner como destino:
`https://app.cleexs.net/diagnostico/crear?url=` + valor del input del dominio.  
Ejemplo en WP: si el usuario escribe `xubio.com`, el enlace puede ser:  
`https://app.cleexs.net/diagnostico/crear?url=xubio.com`

---

## SEGUNDA PARTE

- **3. Menú**  
  Opciones finales del menú: definir en WP (Inicio, Funcionalidades, Pricing, FAQ, etc.).

- **4. FAQ**  
  Agregar preguntas y respuestas en la sección FAQ en WP.

---

## Resumen

- **App Cleexs (este repo):** ya soporta `?url=` en `/diagnostico/crear` y tiene el plan Crecimiento con Cleexs Score semanal y 4 motores.
- **cleexs.net (WordPress):** todos los cambios de diseño, textos, menú, footer, video, imagen y hosting se hacen ahí; solo hay que configurar el botón “Checkear visibilidad” para que lleve a nuestra app con `?url=dominio`.
