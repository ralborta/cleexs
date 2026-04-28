/**
 * Recordatorio de variables para el portal multiusuario (sesión por login, sin UUID en el front).
 *
 * API (Railway): PORTAL_JWT_SECRET (obligatorio para login).
 * Web: NEXT_PUBLIC_API_URL = URL HTTPS de la API.
 *
 * Alta de usuario + contraseña:
 *   npm run db:provision:account -- --email=... --domain=... --password=...
 */
console.log(`
Portal Cleexs (multiusuario)
===========================

1) API — definir en Railway (servicio API):
   PORTAL_JWT_SECRET=<cadena larga aleatoria, misma en todos los deploys de esa API>

2) Web — definir en Railway (servicio Next):
   NEXT_PUBLIC_API_URL=https://tu-api.up.railway.app

3) Crear o actualizar usuario con contraseña de portal:
   DATABASE_URL="postgresql://..." npm run db:provision:account -- \\
     --email=tu@empresa.com --domain=empresa.com --password=TuClaveSegura123

4) Entrar en /portal-crecimiento con email + contraseña.

Opcional (solo dev): ALLOW_USAGE_ACTOR_QUERY=true en la API para llamadas con ?tenantId= sin Bearer.
`);
