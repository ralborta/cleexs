# Deploy de la app web (Vercel)

## Si el deploy falla en "Pre deploy command"

**Build en verde pero falla en "Deploy > Pre deploy command"?** Ese comando se configura en el **dashboard del proyecto**, no en el repo. Hay que vaciarlo o quitarlo.

### Pasos

1. Entrá al proyecto en Vercel → **Settings** (del proyecto).
2. Buscá la sección **Build & Development** o **Deploy** y el campo **"Pre deploy command"** (a veces "Pre-deploy command" o "Command to run before deploy").
3. **Dejá el campo vacío** o borrá el comando que tenga (ej. `prisma generate`, `npm run db:generate`). La app web no necesita ningún comando previo al deploy.
4. Guardá y volvé a desplegar (o hacé un nuevo push).

Para ver qué comando está fallando: en el deployment fallido → **View logs** → abrí el paso "Pre deploy command" y revisá el error.

### Por qué falla

La app **web** (Next.js en `apps/web`) **no usa Prisma** en tiempo de build. Si en Pre deploy tenés algo como `prisma generate`, ese comando corre con **Root Directory** = `apps/web`, donde no está el schema de Prisma (está en la raíz del monorepo), y falla.

### Config útil

- **Root Directory:** `apps/web`.
- **Build / Install:** el `vercel.json` en `apps/web` ya define `npm run build` e `npm install`.
