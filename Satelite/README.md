# Proyectos satélite Cleexs

Dos herramientas complementarias: **Crawlability Checker** (Project1) y **Robots.txt & Sitemap Analyzer** (Project2). Cada una incluye backend en Python (FastAPI) y frontend en Next.js.

## Requisitos

- **Node.js** 18+ y **npm**
- **Python** 3.10+
- **pip** (gestor de paquetes de Python)

---

## Project1 – Crawlability Checker

Analiza un sitio web: rastrea páginas, revisa SEO, robots.txt, bots de IA y genera un score de “crawlability”.

### Instalación y ejecución

**Backend (puerto 8000)**

```bash
cd Satelite/Project1/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend**

```bash
cd Satelite/Project1/frontend
npm install
```

Crear archivo `.env.local` (opcional; si no existe, el frontend usa `http://localhost:8000`):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Desarrollo:

```bash
npm run dev
```

Compilar para producción:

```bash
npm run build
npm run start
```

Abrir [http://localhost:3000](http://localhost:3000). El frontend llama al backend en el puerto 8000.

---

## Project2 – Robots.txt & Sitemap Analyzer

Analiza `robots.txt` y sitemap de un dominio: estado de bots de IA y de búsqueda, sugerencias y generación de sitemap/robots recomendado.

### Instalación y ejecución

**Backend (puerto 8001)**

```bash
cd Satelite/Project2/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

**Frontend**

```bash
cd Satelite/Project2/frontend
npm install
```

Crear `.env.local` (opcional; por defecto usa `http://localhost:8001`):

```
NEXT_PUBLIC_API_URL=http://localhost:8001
```

Desarrollo:

```bash
npm run dev
```

Compilar para producción:

```bash
npm run build
npm run start
```

Abrir [http://localhost:3000](http://localhost:3000). El frontend usa el backend en el puerto 8001.

---

## Notas

- **Ejecutar desde la carpeta de cada proyecto:** los frontends usan Next.js 16 y deben tener sus propias dependencias (`npm install` dentro de `Project1/frontend` y `Project2/frontend`). No usar el `node_modules` de la raíz de Cleexs para compilar estos frontends.
- **Puertos:** Project1 API = 8000, Project2 API = 8001. Cada frontend en dev suele usar el puerto 3000; si se levantan los dos a la vez, cambiar el puerto de uno (ej. `npm run dev -- -p 3001`).
