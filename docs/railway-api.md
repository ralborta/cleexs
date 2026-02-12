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

### 3b. Deploys "SKIPPED" — "No changes to watched files" (IMPORTANTE)

Si los deploys salen **SKIPPED** con "No changes to watched files", Railway está usando **Watch Paths** del **dashboard**. Esa decisión se toma **antes** de leer `railway.toml`, así que **no se puede arreglar desde el repo**: tenés que vaciar Watch Paths en la interfaz de Railway.

**Pasos (hay que hacerlos una sola vez):**

1. Entrá a **https://railway.app** → tu proyecto → servicio **@cleexs/api**.
2. Arriba, pestaña **Settings** (junto a Deployments, Variables, Metrics).
3. Bajá hasta la sección **Build** (o "Build & Deploy").
4. Buscá el campo **"Watch Paths"** (o "Watchpaths" / "Paths to watch"). Suele ser un cuadro de texto con una o más rutas (ej. `apps/api/**`).
5. **Seleccioná todo** el contenido del campo y **borralo**. Dejá el campo completamente vacío.
6. Clic en **Save** o **Update** (o el botón que guarde los cambios del servicio).

Después de eso, el próximo `git push` o `npx -y @railway/cli up --detach` debería **ejecutar** el deploy en lugar de marcarlo SKIPPED.

### 3c. Forzar deploy desde la terminal

En la raíz del repo:

```bash
npx -y @railway/cli up --detach
```

(Si los deploys siguen en SKIPPED, primero arreglá Watch Paths como en 3b.)

### 4. Variables de entorno

En el servicio API en Railway → **Variables**:

- **DATABASE_URL:** connection string de PostgreSQL (si usás Postgres de Railway, podés referenciar la variable del servicio DB).
- **Para que se envíe el correo del diagnóstico público** (link al resultado), en **Variables** del servicio API definí: **SMTP_HOST**, **SMTP_PORT** (ej. 587), **SMTP_USER**, **SMTP_PASS**. Opcional: **SMTP_FROM** o **SMTP_FROM_EMAIL** (email remitente), **SMTP_FROM_NAME** (nombre del remitente), **SMTP_SECURE** (true si usás 465), **FRONTEND_URL** (URL del front para el link). Si SMTP no está configurado, el diagnóstico se marca listo pero el correo no se envía (en los logs verás "Error al enviar email" o "SMTP no configurado").

### 5. Error 500 en diagnóstico público

Si al iniciar un diagnóstico ves "Internal Server Error":

1. **Migraciones pendientes:** Ejecutá las migraciones:
   ```bash
   railway run npx prisma migrate deploy
   ```
2. **Seed no ejecutado:** Si el mensaje dice "Configuración del sistema incompleta", el tenant root no existe. Ejecutá el seed:
   ```bash
   railway run npx prisma db seed
   ```

### 6. Ver qué falló

En el deployment fallido → **View logs**: ahí ves si falló el build (npm, tsc, turbo) o el Pre-deploy. Con Root Directory vacío, Build command y Start command como arriba, y Pre-deploy vacío o `true`, el deploy debería completar.

### 7. Deploy lento (5–40 min)

Si el deploy queda en "Deploying" mucho rato:

1. **Healthcheck:** El `railway.toml` define `healthcheckPath = "/health"` y `healthcheckTimeout = 60`. Railway espera a que `/health` devuelva 200; si no lo hace en 60 s, falla el deploy (antes eran 5 min por defecto). Revisá los **Deploy logs** para ver si aparece `[Cleexs API] Servidor activo` — eso indica que la app levantó bien.
2. **Conexión a la DB:** La API usa `connect_timeout=15` en la URL de Prisma. Si la DB tarda, el arranque falla en ~15 s en lugar de colgarse.
3. **Build:** Si la demora está en el **Build** (antes de "Deploying"), puede ser por npm install o turbo en el monorepo. Revisá en qué fase se queda más tiempo.
