# Satélite Cleexs — proyecto activo

**Único stack a usar:** `CleexsTools37` (backend FastAPI + frontend Next.js, analizador AEO all-in-one con herramientas tool1–tool10).

## Requisitos

- **Node.js** 18+ y **npm**
- **Python** 3.10+ y **pip**

## Desarrollo local

**Backend** (por defecto puerto 8000; en Railway usa `$PORT`):

```bash
cd Satelite/CleexsTools37/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend:**

```bash
cd Satelite/CleexsTools37/frontend
npm install
cp .env.example .env.local   # ajusta NEXT_PUBLIC_API_URL si hace falta
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). El frontend debe apuntar al API (ej. `NEXT_PUBLIC_API_URL=http://localhost:8000`).

## Despliegue y repo

Ver **`CleexsTools37/DESPLIEGUE-COMPLETO.md`** y **`CleexsTools37/DEPLOY.md`** (GitHub, Railway, Vercel).

## Legado (no usar para trabajo nuevo)

En esta carpeta pueden existir entregas antiguas (`Project1`, `Project2`, `backendToni`, `frontendToni`, `.rar`). No están alineadas con el producto actual; **no** las uses como referencia ni para despliegue: todo lo nuevo va contra **`CleexsTools37`**.
