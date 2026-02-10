# Deploy de la API en Railway

La API (Fastify + Prisma) va en **Railway**. Es un monorepo: el servicio debe construirse desde la **raíz** del repo para que Prisma y los workspaces estén disponibles.

## Si el deploy falla o no se hace

### 1. Root Directory

En Railway → tu **proyecto** → servicio **API** → **Settings**:

- **Root Directory:** dejalo **vacío** (o `.`). No pongas `apps/api`.
- Si tenés `apps/api`, Railway construye solo esa carpeta, no ve `prisma/` ni el `package.json` de la raíz, y fallan build o migraciones.

### 2. Build y Start (ya en código)

El `railway.toml` en la raíz del repo define:

- **Build:** `npm install && npm run build` (desde raíz; Turbo construye shared + API).
- **Start:** `npm run deploy:api` → `prisma migrate deploy` + `node apps/api/dist/index.js`.
- **Pre-deploy:** `true` (no-op) para que no falle si tenés algo configurado en el dashboard.

Si en **Settings** tenés **Build Command** o **Start Command** custom, los valores del `railway.toml` los **sobreescriben** en cada deploy (config in code gana sobre el dashboard).

### 3. Pre-deploy que falla

Si el deploy llega a **Build** en verde y falla en **Deploy > Pre deploy command**:

- En **Settings** del servicio, buscá **Pre-deploy command** y **dejalo vacío**, **o**
- El `railway.toml` ya pone `preDeployCommand = "true"` para anular un comando malo del dashboard. Hacé push de ese cambio y volvé a desplegar.

Las migraciones no van en Pre-deploy; ya se ejecutan en el **Start** (`prisma migrate deploy` dentro de `deploy:api`).

### 4. Variables de entorno

En el servicio API en Railway → **Variables**:

- **DATABASE_URL:** connection string de PostgreSQL (si usás Postgres de Railway, podés referenciar la variable del servicio DB).
- Opcional para diagnóstico público / email: **SMTP_HOST**, **SMTP_PORT**, **SMTP_USER**, **SMTP_PASS**, **FRONTEND_URL**.

### 5. Ver qué falló

En el deployment fallido → **View logs**: ahí ves si falló el build (npm, tsc, turbo) o el Pre-deploy. Con Root Directory vacío, Build command y Start command como arriba, y Pre-deploy vacío o `true`, el deploy debería completar.
