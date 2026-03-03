# Cómo configurar la página de pruebas en Vercel (paso a paso)

Guía para dejar **solo** la página de diagnóstico accesible sin contraseña, usando el dominio que ya te da Vercel (sin tocar DNS).

---

## Opción A: Usar el dominio que ya te da Vercel (más fácil)

Si no tenés dominio propio (ej. cleexs.com), usá el que tiene tu proyecto en Vercel.

### 1. Ver qué dominio tenés

1. Entrá a [vercel.com](https://vercel.com) e iniciá sesión.
2. Abrí tu **proyecto** (el que tiene la app Cleexs).
3. Andá a **Settings** (Configuración) en el menú del proyecto.
4. En el menú lateral, entrá a **Domains**.
5. Ahí vas a ver algo como:
   - `tu-proyecto.vercel.app` (asignado por Vercel), o
   - Si ya agregaste un dominio: `tudominio.com`.

**Anotá ese dominio exacto** (ej. `cleexs-xyz.vercel.app`). Lo vas a usar en los pasos siguientes.

---

### 2. Dejar ese dominio sin contraseña (para que sea público)

1. En el mismo proyecto, en el menú lateral andá a **Deployment Protection** (o **Security** → **Deployment Protection**).
2. Si tenés **Password Protection** o **Vercel Authentication** activado, vas a ver la opción **Deployment Protection Exceptions** (o “Excepciones” / “Unprotected Domains”).
3. Clic en **Add Domain** (o “Add Exception” / “Añadir dominio”).
4. Escribí el dominio **exacto** del paso 1, por ejemplo: `tu-proyecto.vercel.app` (sin `https://`, sin `/`, sin path).
5. Confirmá según te pida Vercel (a veces pide escribir de nuevo el dominio o “unprotect my domain”).
6. Ese dominio queda **público** (sin contraseña). El resto de la configuración de protección sigue igual para otros dominios si los tenés.

---

### 3. Decirle a la app que en ese dominio solo muestre la página de diagnóstico

1. En el mismo proyecto, en el menú lateral andá a **Environment Variables** (Variables de entorno).
2. Clic en **Add New** (o “Add” / “Añadir”).
3. Completá:
   - **Key (Nombre):** `PUBLIC_TEST_HOST`
   - **Value (Valor):** el mismo dominio del paso 1, por ejemplo: `tu-proyecto.vercel.app` (igual que antes: sin `https://`, sin `/`).
4. Marcá para qué entorno aplica (por lo menos **Production**). Si querés lo mismo en previews, marcá también **Preview**.
5. Guardá (Save).

---

### 4. Aplicar los cambios (redeploy)

Las variables de entorno se aplican en el **próximo deploy**. Si no cambiaste código:

1. Andá a la pestaña **Deployments** del proyecto.
2. En el último deployment, clic en los tres puntos (⋮).
3. Elegí **Redeploy** y confirmá.

O hacé un cambio mínimo en el repo y volvé a hacer push para que se genere un deploy nuevo.

---

### 5. URL para compartir con testers

Cuando el deploy termine, la URL pública para pruebas es:

```
https://TU-DOMINIO/diagnostico/crear
```

Reemplazá `TU-DOMINIO` por el que configuraste (ej. `tu-proyecto.vercel.app`).

Ejemplo: si tu dominio es `cleexs-abc123.vercel.app`, la URL es:

**`https://cleexs-abc123.vercel.app/diagnostico/crear`**

En ese dominio solo funciona el flujo de diagnóstico; si alguien intenta entrar a `/settings`, `/planes`, etc., la app lo redirige al formulario de diagnóstico.

---

## Opción B: Usar un subdominio propio (ej. prueba.cleexs.com)

Cuando tengas el dominio Cleexs (o otro):

### 1. Agregar el dominio en Vercel

1. **Settings** → **Domains** → **Add**.
2. Escribí el subdominio, ej. `prueba.cleexs.com`.
3. Vercel te va a indicar qué registro DNS crear (normalmente un CNAME de `prueba` apuntando a `cname.vercel-dns.com`).
4. En el panel de tu registrador de dominio (donde compraste cleexs.com), creá ese CNAME y esperá a que se propague (puede tardar unos minutos).

### 2. Excepción de protección y variable

- Repetí los pasos **2 y 3** de la Opción A, pero usando `prueba.cleexs.com` como dominio y como valor de `PUBLIC_TEST_HOST`.

### 3. URL para pruebas

```
https://prueba.cleexs.com/diagnostico/crear
```

---

## Resumen rápido

| Paso | Dónde en Vercel | Qué hacer |
|------|------------------|-----------|
| 1 | **Settings** → **Domains** | Anotar el dominio (ej. `tu-proyecto.vercel.app`). |
| 2 | **Settings** → **Deployment Protection** → **Exceptions** | Agregar ese dominio para que no pida contraseña. |
| 3 | **Settings** → **Environment Variables** | Crear `PUBLIC_TEST_HOST` = ese mismo dominio. |
| 4 | **Deployments** | Redeploy para que tome la variable. |
| 5 | — | Compartir `https://TU-DOMINIO/diagnostico/crear`. |

Si algo no coincide con tu pantalla (por ejemplo Vercel cambió los nombres), buscá en Settings: **Domains**, **Deployment Protection** / **Security**, y **Environment Variables**.
