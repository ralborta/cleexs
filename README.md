# Cleexs - PRIA Platform

Plataforma SaaS para medir qué tan recomendado aparece una marca en ChatGPT frente a un set estable de consultas y competidores.

## 🎯 Qué es Cleexs

Cleexs es una plataforma que mide, de forma **repetible, comparable y auditable**, qué tan recomendado aparece una **marca** en **ChatGPT** frente a un set estable de consultas ("prompts") y frente a sus competidores.

El resultado es un **índice 0–100** (PRIA) con evidencia trazable por prompt, por período y por versión de prompts.

## ✨ Características Principales

- 📊 **Dashboard interactivo** con rankings, tendencias y análisis detallados
- 🔄 **Multi-tenancy jerárquico** para agencias y clientes directos
- 📈 **Cálculo automático de PRIA** basado en posición en Top 3
- 🔍 **Parsing inteligente** de respuestas de ChatGPT
- 📝 **Versionado de prompts** para mantener series históricas
- ✅ **Override manual** para casos ambiguos
- 💾 **Evidencia completa** y auditable por cada resultado

## 🛠 Stack Tecnológico

### Frontend
- **Next.js 14** + React + TypeScript
- **Tailwind CSS** + shadcn/ui
- **Recharts** para visualizaciones

### Backend
- **Node.js** + TypeScript
- **Fastify** (API REST)
- **Prisma** (ORM)

### Base de Datos
- **PostgreSQL** con JSONB para evidencia

### Infraestructura
- **Vercel** (frontend)
- **Railway** (backend/DB)
- **Redis** (Upstash) + BullMQ (para automatización futura)

## 📁 Estructura del Proyecto

```
cleexs/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Fastify backend
├── packages/
│   └── shared/       # Tipos y utilidades compartidas
└── prisma/           # Schema y migraciones
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- PostgreSQL
- npm o yarn

### Instalación

1. **Clonar el repositorio:**
```bash
git clone https://github.com/tu-usuario/cleexs.git
cd cleexs
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Configurar variables de entorno:**
```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/cleexs?schema=public"
NEXTAUTH_SECRET="your-secret-key"
API_PORT=3001
```

4. **Generar cliente Prisma:**
```bash
npm run db:generate
```

5. **Ejecutar migraciones:**
```bash
npm run db:migrate
```

6. **Seed inicial (crea Master Tenant 000):**
```bash
npm run db:seed
```

7. **Iniciar desarrollo:**
```bash
npm run dev
```

Esto iniciará:
- Frontend en http://localhost:3000
- API en http://localhost:3001

## 📚 Documentación

### Modelo de Datos

El sistema utiliza multi-tenancy jerárquico:
- **ROOT** (000): Cleexs master
- **AGENCY**: Revendedores
- **DIRECT_CLIENT**: Clientes directos
- **AGENCY_CLIENT**: Clientes de agencias

### Cálculo PRIA

El score se basa en la posición en el Top 3:
- **#1** → 1.0
- **#2** → 0.7
- **#3** → 0.4
- **No aparece** → 0

PRIA = promedio(scores) × 100

### API Endpoints

Ver [IMPLEMENTACION.md](./IMPLEMENTACION.md) para documentación completa de endpoints.

## 🧪 Scripts Disponibles

- `npm run dev` - Inicia todos los servicios en modo desarrollo
- `npm run build` - Build de producción
- `npm run lint` - Ejecuta linter
- `npm run db:generate` - Genera cliente Prisma
- `npm run db:migrate` - Ejecuta migraciones
- `npm run db:studio` - Abre Prisma Studio
- `npm run db:seed` - Ejecuta seed inicial

## 📖 Documentación Adicional

- [IMPLEMENTACION.md](./IMPLEMENTACION.md) - Detalles de implementación y endpoints
- [Núcleo del Modelo](./docs/nucleo-modelo.md) - Arquitectura y reglas de negocio

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto es privado y propietario.

## 👥 Autores

- Cleexs Team

---

**Cleexs** - AI Recommendation Index Platform
