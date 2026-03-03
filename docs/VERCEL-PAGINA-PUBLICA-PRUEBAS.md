# Página pública para pruebas en Vercel

Objetivo: que **solo** la página de diagnóstico (`/diagnostico/crear`) sea accesible sin contraseña para pruebas, con el resto del sitio protegido por Deployment Protection (contraseña) en Vercel.

En Vercel **no se puede** dejar “solo una ruta” sin contraseña en el mismo dominio: la protección es por dominio/deployment, no por path. Estas son las opciones que sí funcionan.

---

## Opción 1: Subdominio público (recomendada)

En el subdominio la app **solo permite el flujo de diagnóstico**: cualquier otra ruta (settings, planes, dashboard) redirige a `/diagnostico/crear`. Así en ese dominio público solo existe esa página para pruebas.

### Pasos

1. **Añadir el subdominio al proyecto**
   - Vercel → tu proyecto → **Settings** → **Domains**.
   - Añadí un subdominio, por ejemplo:
     - `prueba.cleexs.com`, o
     - `diagnostico.cleexs.com`, o
     - Un dominio de Vercel tipo `pruebas-tu-proyecto.vercel.app` (si usás uno fijo para pruebas).

2. **Quitar la protección solo para ese dominio**
   - **Settings** → **Deployment Protection**.
   - En **Deployment Protection Exceptions** (o “Excepciones”), añadí el dominio del paso 1 (ej. `prueba.cleexs.com`).
   - Ese dominio pasa a ser **público** (sin contraseña). El resto de dominios (ej. `cleexs.com`) siguen protegidos.

3. **Variable de entorno (para que solo esa página funcione en el subdominio)**
   - **Settings** → **Environment Variables**.
   - Añadí: **Name** `PUBLIC_TEST_HOST`, **Value** el subdominio exacto (ej. `prueba.cleexs.com`, sin `https://` ni `/`).
   - Aplicá a Production (y a Preview si querés).

4. **URL para pruebas**
   - Compartí con testers (en ese subdominio solo el diagnóstico; el resto redirige al formulario):
     - `https://prueba.cleexs.com/diagnostico/crear`
     - o `https://prueba.cleexs.com/prueba-gratuita`
   - Esa es la “página en el dominio público” solo para pruebas.

**DNS:** En el registrador del dominio (ej. cleexs.com) tenés que crear un registro CNAME para el subdominio apuntando a `cname.vercel-dns.com` (o lo que indique Vercel al añadir el dominio).

---

## Opción 2: Enlace con bypass (sin subdominio)

Si no querés tocar DNS, podés generar un **enlace con bypass** que evita la contraseña solo para quien tenga el link.

### Pasos

1. **Crear el secret de bypass**
   - Vercel → proyecto → **Settings** → **Deployment Protection**.
   - Buscá **Protection Bypass for Automation** y generá (o copiá) el secret. Vercel lo guarda en `VERCEL_AUTOMATION_BYPASS_SECRET`.

2. **URL para pruebas**
   - La URL pública para pruebas sería:
     ```
     https://tu-dominio.vercel.app/diagnostico/crear?x-vercel-protection-bypass=TU_SECRET
     ```
   - Reemplazá `TU_SECRET` por el valor real y **compartí solo con testers de confianza** (el secret queda en la URL).

**Nota:** Cualquiera que tenga ese enlace puede entrar sin contraseña. No conviene publicarlo en ningún sitio abierto.

---

## Resumen

| Objetivo                         | Opción recomendada |
|----------------------------------|--------------------|
| Página pública solo para pruebas | **Opción 1**: subdominio (ej. `prueba.cleexs.com`) en Exceptions y compartir `https://prueba.cleexs.com/diagnostico/crear`. |
| Rápido sin configurar DNS        | **Opción 2**: enlace con `?x-vercel-protection-bypass=SECRET` (solo para gente de confianza). |

La **ruta** que querés dejar como “página pública para pruebas” es:

- **`/diagnostico/crear`** (formulario de diagnóstico)
- **`/prueba-gratuita`** (redirige al mismo formulario)

Ambas son la misma entrada; la diferencia es solo cómo dejás ese deployment/dominio sin contraseña en Vercel (subdominio en Exceptions o enlace con bypass).
