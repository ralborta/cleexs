# Deploy de la app web (Vercel)

## Si el deploy falla en "Pre deploy command"

La app **web** (Next.js en `apps/web`) **no usa Prisma** en tiempo de build. Solo la API usa Prisma.

1. **Ver el error exacto:** en Vercel → tu proyecto → Deployment fallido → **View logs**. Ahí verás el comando que se ejecutó y el mensaje de error.

2. **Solución habitual:** en **Project Settings** → **Build & Development** (o la sección donde esté "Pre deploy command"):
   - **Dejá vacío** el campo "Pre deploy command", **o**
   - Si tenés algo como `prisma generate` o `npm run db:generate`, quitarlo. Esos comandos están en la raíz del monorepo y fallan cuando el Root Directory es `apps/web`.

3. **Root Directory:** debe ser `apps/web` para este proyecto (app Next.js).

4. **Build / Install:** con el `vercel.json` en `apps/web` se usan `npm run build` e `npm install` desde esa carpeta.
