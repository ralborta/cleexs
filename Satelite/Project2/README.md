# Project2 – Cleexs Robots.txt & Sitemap Analyzer

Herramienta para analizar `robots.txt` y sitemap de un dominio: estado de bots de IA y de búsqueda, sugerencias de mejora, generación de sitemap y robots recomendado.

## Requisitos

- Node.js 18+ y npm
- Python 3.10+ y pip

## Instalación

### Backend (Python / FastAPI)

```bash
cd Satelite/Project2/backend
pip install -r requirements.txt
```

### Frontend (Next.js)

```bash
cd Satelite/Project2/frontend
npm install
```

## Variables de entorno (frontend)

Opcional. Crear `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8001
```

Si no se define, el frontend usa por defecto `http://localhost:8001`.

## Ejecución

1. **Levantar la API** (en una terminal):

```bash
cd Satelite/Project2/backend
uvicorn main:app --host 0.0.0.0 --port 8001
```

2. **Levantar el frontend** (en otra terminal):

```bash
cd Satelite/Project2/frontend
npm run dev
```

3. Abrir [http://localhost:3000](http://localhost:3000), ingresar una URL y ejecutar el análisis.

## Compilar para producción

**Backend:** no requiere compilación; ejecutar con `uvicorn` como arriba (o con gunicorn en producción).

**Frontend:**

```bash
cd Satelite/Project2/frontend
npm run build
npm run start
```

## Estructura

- `backend/` – API FastAPI (`main.py`), analizador (`analyzer.py`), `requirements.txt`
- `frontend/` – Next.js 16, React 19, Tailwind 4; página única que llama a `POST /api/analyze`, `POST /api/generate-robots`, `POST /api/download-sitemap`
