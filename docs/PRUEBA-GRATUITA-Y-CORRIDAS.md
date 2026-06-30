# Prueba gratuita y corridas programadas (n8n)

## 1. Prueba gratuita separada

- **Objetivo:** Tener un link directo desde el website de Cleexs que lleve a la pantalla de “prueba gratuita” (formulario de diagnóstico).
- **Implementado:**
  - Ruta **`/prueba-gratuita`** → redirige a **`/diagnostico/crear`** (misma pantalla del formulario).
  - El website puede enlazar a: `https://tu-app.vercel.app/prueba-gratuita` o `.../prueba-gratuita?tier=gold`.
- **Flujo freemium:** Corre solo (una ejecución por solicitud del usuario). No requiere n8n para la prueba gratuita; el flujo actual de crear diagnóstico y ver resultado sigue igual.

---

## 2. Configuración (admin) y corridas por cliente

- **Objetivo:** El administrador entra a **Configuración** (`/settings`) y puede definir **por cliente** (tenant o marca) la frecuencia de las corridas: **semanal**, **quincenal**, **mensual**.
- **Freemium:** La prueba gratuita “corre sola” (una vez por uso). Las corridas programadas son para clientes que tienen frecuencia configurada.
- **Qué falta por implementar:**
  1. **Modelo de datos:** Guardar por cliente (tenant o brand) la frecuencia de corrida: `semanal` | `quincenal` | `mensual` | `null` (sin programación). Por ejemplo un campo `runSchedule` en Tenant o una tabla `run_schedules` (tenantId, brandId?, frequency).
  2. **API:**  
     - Endpoint para que el admin guarde/cambie la frecuencia (ej. `PATCH /api/tenants/:id` o `PUT /api/settings/run-schedule`).  
     - Endpoint para n8n: listar “quién debe correr hoy” según la frecuencia (ej. `GET /api/cron/scheduled-runs?frequency=semanal` o por día de la semana/mes).
  3. **Pantalla de configuración:** En `/settings`, sección “Corridas programadas” (o “Configuración de corridas”): por cada cliente/marca, selector de frecuencia (Ninguna / Semanal / Quincenal / Mensual). Conectar con la API anterior.
  4. **Ejecución de la corrida:** Un endpoint que n8n llame para “disparar” una corrida para un tenant/brand (ej. `POST /api/cron/run-scheduled` con `tenantId`, `brandId`, `periodStart`, `periodEnd`), o reutilizar la lógica actual de creación de runs por marca.

---

## 3. Flujos n8n necesarios

Sí, hacen falta flujos en n8n para las corridas programadas.

### 3.1 Flujo ya existente (prueba gratuita / bajo demanda)

- **`cleexs-crear-diagnostico.json`**: Crear diagnóstico público (marca + URL). Se usa manual o por webhook. No depende de cron.

### 3.2 Flujos a crear (corridas programadas)

Cada flujo se dispara por **Schedule Trigger** (cron) y llama a la API de Cleexs para ejecutar las corridas de los clientes que correspondan a esa frecuencia.

| Flujo | Trigger (ejemplo) | Acción |
|-------|--------------------|--------|
| **Corridas semanales** | Cron: lunes 8:00 | GET clientes con frecuencia `semanal` → para cada uno POST ejecutar run (periodo última semana). |
| **Corridas quincenales** | Cron: 1º y 16 de cada mes | GET clientes con frecuencia `quincenal` → para cada uno POST ejecutar run (periodo 15 días). |
| **Corridas mensuales** | Cron: día 1 de cada mes | GET clientes con frecuencia `mensual` → para cada uno POST ejecutar run (periodo mes anterior). |

Requisitos en la API (a implementar):

- **GET** algo como `/api/cron/scheduled-runs?frequency=semanal` (o por `date=YYYY-MM-DD`) que devuelva la lista de tenant/brand que deben correr ese día.
- **POST** algo como `/api/cron/execute-run` con `tenantId`, `brandId`, `periodStart`, `periodEnd` (o el contrato que ya usen los runs internos) para ejecutar una corrida.

Las variables de n8n (`CLEEXS_API_URL`, opcionalmente `CLEEXS_CRON_SECRET` para autorizar el cron) se documentan en `docs/n8n/README.md`.

---

## 4. Orden sugerido de implementación

1. **Hecho:** Ruta `/prueba-gratuita` y doc de plan.
2. **Siguiente:** Modelo + migración para frecuencia de corrida (por tenant o por brand).
3. **Después:** Endpoints de API para guardar frecuencia (admin) y para listar/ejecutar corridas (cron/n8n).
4. **Después:** En `/settings`, sección “Corridas programadas” con selector por cliente.
5. **Por último:** Exportar e importar en n8n los 3 flujos JSON (semanal, quincenal, mensual) que llamen a esos endpoints.

Cuando tengas definido si la frecuencia es por **tenant** o por **marca** (brand), se puede bajar esto a nombres de tablas/campos y contratos exactos de API.
