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

- **Opción segura:** En Railway → servicio API → **Settings** → buscá **Pre-deploy command** y **borrá todo**, dejá el campo vacío. Guardá. Las migraciones ya corren en el Start, no hace falta nada en Pre-deploy.
- **Desde código:** El `railway.toml` define `preDeployCommand = "/bin/true"` para anular el comando del dashboard. Si aun así falla, la única garantía es vaciar el campo en el dashboard.

Las migraciones no van en Pre-deploy; ya se ejecutan en el **Start** (`prisma migrate deploy` dentro de `deploy:api`).

### 3b. Deploys "SKIPPED" o "No changes to watched files"

Si los deploys por CLI (`railway up`) o por GitHub salen **SKIPPED** con "No changes to watched files", Railway tiene **Watch Paths** activos: solo despliega cuando cambian archivos en esas rutas.

**Qué hacer:** Railway → servicio API → **Settings** → buscá **"Watch Paths"** o **"Watchpaths"**. Dejalo **vacío** (o borrá los paths que tenga) para que cualquier push o `railway up` dispare un deploy. Guardá.

### 3c. Forzar deploy desde la terminal

En la raíz del repo:

```bash
npx -y @railway/cli up --detach
```

(Si los deploys siguen en SKIPPED, primero arreglá Watch Paths como en 3b.)

### 4. Variables de entorno

En el servicio API en Railway → **Variables**:

- **DATABASE_URL:** connection string de PostgreSQL (si usás Postgres de Railway, podés referenciar la variable del servicio DB).
- Opcional para diagnóstico público / email: **SMTP_HOST**, **SMTP_PORT**, **SMTP_USER**, **SMTP_PASS**, **FRONTEND_URL**.

### 5. Ver qué falló

En el deployment fallido → **View logs**: ahí ves si falló el build (npm, tsc, turbo) o el Pre-deploy. Con Root Directory vacío, Build command y Start command como arriba, y Pre-deploy vacío o `true`, el deploy debería completar.
