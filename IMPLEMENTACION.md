# Cleexs PRIA - Implementación Completa

## ✅ Estado de Implementación

### Backend API (Fastify)
- ✅ Schema Prisma completo (todas las entidades)
- ✅ Endpoints de Tenants (CRUD + jerarquía + consumo)
- ✅ Endpoints de Brands y Competitors
- ✅ Endpoints de Prompts y Versions (con clonación)
- ✅ Endpoints de Runs y Results (con carga manual)
- ✅ Endpoints de Reports (PRIA, Ranking, Comparación)
- ✅ Lógica de cálculo PRIA
- ✅ Parsing de Top 3 (con reglas definidas)
- ✅ Validación de límites de consumo (pool)
- ✅ Sistema de override manual

### Frontend (Next.js 14)
- ✅ Componentes UI básicos (shadcn/ui)
- ✅ Dashboard con Ranking, Tendencia y Detalle
- ✅ Página de Runs con visualización de resultados
- ✅ Página de carga manual de resultados
- ✅ Integración con API
- ✅ Gráficos con Recharts

### Base de Datos
- ✅ Schema completo con multi-tenancy jerárquico
- ✅ Seed inicial con Master Tenant (000)
- ✅ Índices optimizados

## 🚀 Próximos Pasos para Ejecutar

1. **Instalar dependencias:**
```bash
npm install
```

2. **Configurar variables de entorno:**
```bash
cp .env.example .env
# Editar .env con:
# - DATABASE_URL (PostgreSQL)
# - NEXTAUTH_SECRET
# - API_PORT (default: 3001)
```

3. **Generar cliente Prisma:**
```bash
npm run db:generate
```

4. **Ejecutar migraciones:**
```bash
npm run db:migrate
```

5. **Ejecutar seed inicial:**
```bash
npm run db:seed
```

6. **Iniciar desarrollo:**
```bash
npm run dev
```

Esto iniciará:
- Frontend en http://localhost:3000
- API en http://localhost:3001

## 📋 Endpoints API Disponibles

### Tenants
- `GET /api/tenants/:id` - Obtener tenant
- `GET /api/tenants/:id/children` - Obtener hijos
- `POST /api/tenants` - Crear tenant
- `GET /api/tenants/:id/usage` - Consumo y límites

### Brands
- `GET /api/brands?tenantId=...` - Listar marcas
- `GET /api/brands/:id` - Obtener marca
- `POST /api/brands` - Crear marca
- `POST /api/brands/:id/aliases` - Agregar alias
- `POST /api/brands/:id/competitors` - Agregar competidor

### Prompts
- `GET /api/prompts/prompt-versions?tenantId=...` - Listar versiones
- `POST /api/prompts/prompt-versions` - Crear versión
- `POST /api/prompts/prompt-versions/:id/clone` - Clonar versión
- `GET /api/prompts/prompts?versionId=...` - Listar prompts
- `POST /api/prompts/prompts` - Crear prompt

### Runs
- `GET /api/runs?tenantId=...&brandId=...` - Listar runs
- `GET /api/runs/:id` - Obtener run completo
- `POST /api/runs` - Crear run
- `POST /api/runs/:id/results` - Agregar resultado manual
- `POST /api/runs/:id/override` - Override manual de ranking

### Reports
- `GET /api/reports/pria?brandId=...&versionId=...` - PRIA por marca
- `GET /api/reports/ranking?tenantId=...` - Ranking de marcas
- `GET /api/reports/compare?brandId=...&v1=...&v2=...` - Comparar versiones

## 🎯 Funcionalidades Implementadas

### Cálculo PRIA
- Score por posición: #1=1.0, #2=0.7, #3=0.4, No aparece=0
- PRIA total = promedio(scores) * 100
- PRIA por categoría

### Parsing Top 3
- Lista numerada (1., 2., 3.)
- Bullets (•, -, *)
- Secciones/párrafos
- Texto corrido → ambiguous_ranking (requiere override)

### Multi-tenancy
- Jerarquía: ROOT → AGENCY → AGENCY_CLIENT
- Pool de cuotas para agencias
- Validación de límites por plan

### Versionado de Prompts
- Clonación (v1 → v2)
- Múltiples versiones activas
- Comparación entre versiones

## 🔜 Próximas Mejoras (V1.1+)

- [ ] Autenticación completa (NextAuth)
- [ ] Permisos y roles (RBAC)
- [ ] Runner/Worker para automatización
- [ ] Integración con OpenAI API
- [ ] Sub-cuotas asignadas (además de pool)
- [ ] Competidores por categoría
- [ ] Exportación de reportes (PDF/CSV)
- [ ] Notificaciones de límites
- [ ] Dashboard de agencias (vista agregada)

## 📝 Notas

- Los IDs mock en el frontend (`MOCK_TENANT_ID`, etc.) deben reemplazarse con autenticación real
- El límite de evidencia es 100KB por respuesta (se trunca automáticamente)
- El parsing puede requerir override manual en casos ambiguos
- Los runs se marcan como "completed" cuando tienen al menos un resultado (mejorable)
