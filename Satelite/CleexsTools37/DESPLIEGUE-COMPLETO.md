# Guía completa: GitHub + Railway + Vercel

Esta guía te lleva paso a paso desde crear el repositorio en GitHub hasta tener el proyecto desplegado en Railway (backend) y Vercel (frontend).

---

## Parte 1: Crear repositorio en GitHub

### Opción A: Repositorio nuevo solo para CleexsTools37 (recomendado)

Si quieres un repo independiente para este proyecto:

1. **Crea el repo en GitHub:**
   - Ve a [github.com/new](https://github.com/new)
   - Nombre sugerido: `cleexs-tools` o `CleexsTools37`
   - Descripción: "Analizador AEO All-in-One - Frontend Next.js + Backend FastAPI"
   - Elige **Public** o **Private**
   - **No** marques "Add a README" (ya tienes código)

2. **Sube el código desde tu terminal:**

```bash
cd /Users/ralborta/Cleexs/Satelite/CleexsTools37

# Crea un repo git local si no existe
git init

# Añade todos los archivos
git add .
git commit -m "Initial commit: Cleexs Tools AEO Analyzer"

# Conecta con GitHub (reemplaza TU_USUARIO y NOMBRE_REPO con los tuyos)
git remote add origin https://github.com/TU_USUARIO/NOMBRE_REPO.git

# Sube la rama main
git branch -M main
git push -u origin main
```

### Opción B: Usar el repositorio Cleexs existente

Si prefieres mantener todo en el repo `Cleexs`:

1. Asegúrate de que el código esté commiteado y subido:
```bash
cd /Users/ralborta/Cleexs
git add Satelite/CleexsTools37
git commit -m "Add CleexsTools37 project"
git push origin main
```

2. Al configurar Railway y Vercel, usa **Root Directory**:
   - **Railway backend:** `Satelite/CleexsTools37/backend`
   - **Vercel frontend:** `Satelite/CleexsTools37/frontend`

---

## Parte 2: Backend en Railway

### 2.1 Crear proyecto

1. Entra en [railway.app](https://railway.app) e inicia sesión (con GitHub).
2. **New Project** → **Deploy from GitHub repo**.
3. Selecciona tu repositorio (`cleexs-tools` o `Cleexs`).
4. **Root Directory:** 
   - Si usaste Opción A: deja vacío o `backend`
   - Si usaste Opción B: `Satelite/CleexsTools37/backend`
5. Railway detectará Python y usará `railway.toml`.

### 2.2 Añadir MySQL

1. En el mismo proyecto: **+ New** → **Database** → **MySQL**.
2. Railway crea el servicio y expone variables automáticamente.
3. En el servicio **backend**, ve a **Variables** → **Add variable** → **Add variable reference**.
4. Enlaza las variables de MySQL: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` (referenciando el servicio MySQL).

### 2.3 Variables de entorno del backend

En **Variables** del servicio backend, añade:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key de OpenAI | sk-... |
| `GEMINI_API_KEY` | API key de Google AI (Gemini) | ... |
| `PERPLEXITY_API_KEY` | API key de Perplexity | pplx-... |
| `SERP_API_KEY` | API key de SerpAPI | ... |
| `MYSQL_HOST` | Referencia al add-on MySQL | (variable reference) |
| `MYSQL_PORT` | Puerto MySQL | 3306 |
| `MYSQL_DATABASE` | Nombre de la base | railway |
| `MYSQL_USER` | Usuario MySQL | root |
| `MYSQL_PASSWORD` | Contraseña MySQL | (variable reference) |

### 2.4 Dominio público

1. En el servicio backend: **Settings** → **Networking** → **Generate Domain**.
2. Copia la URL (ej. `https://cleexs-tools-backend.up.railway.app`).
3. **Guárdala** — la necesitarás para Vercel.

---

## Parte 3: Frontend en Vercel

### 3.1 Conectar repositorio

1. Entra en [vercel.com](https://vercel.com) e inicia sesión (con GitHub).
2. **Add New** → **Project**.
3. Importa tu repositorio.
4. **Root Directory:** 
   - Si usaste Opción A: `frontend` (o la carpeta donde está el frontend)
   - Si usaste Opción B: `Satelite/CleexsTools37/frontend`
5. **Framework Preset:** Next.js (detectado automáticamente).

### 3.2 Variable de entorno

En **Environment Variables**:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_API_URL` | La URL del backend en Railway (ej. `https://cleexs-tools-backend.up.railway.app`) |

⚠️ **Sin barra final** en la URL.

Aplícala a **Production** y **Preview** si quieres.

### 3.3 Deploy

1. Haz clic en **Deploy**.
2. Cuando termine, tendrás una URL como `https://cleexs-tools.vercel.app`.

---

## Parte 4: Verificación

1. Abre la URL de Vercel.
2. Pega una URL (ej. `https://ejemplo.com`) y pulsa **Analizar todo**.
3. Si todo está bien, verás los resultados del análisis.
4. Si falla: abre DevTools (F12) → pestaña Network y comprueba que las peticiones vayan a la URL del backend y no den errores CORS o 5xx.

---

## Resumen de URLs

| Servicio | URL |
|----------|-----|
| **Frontend** | `https://tu-proyecto.vercel.app` |
| **Backend** | `https://xxx.up.railway.app` |
| **Variable en Vercel** | `NEXT_PUBLIC_API_URL` = URL del backend |

---

## Troubleshooting

- **CORS:** El backend permite `*`. Si quieres restringir en producción, edita `allow_origins` en `backend/main.py`.
- **MySQL en Railway:** Si la base no existe, el backend la crea automáticamente al iniciar.
- **Build falla en Railway:** Revisa que `requirements.txt` y `railway.toml` estén en la raíz del backend.
- **Frontend no conecta al backend:** Verifica que `NEXT_PUBLIC_API_URL` en Vercel sea exactamente la URL del backend (sin `/` final).
