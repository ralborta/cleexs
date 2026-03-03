# Flujos n8n para Cleexs

Workflows de [n8n](https://n8n.io) para automatizar acciones con la API de Cleexs (crear diagnóstico, obtener resultado, etc.).

## Dónde está cada flujo

Los flujos se guardan como **JSON** en esta carpeta. Podés importarlos en n8n desde:

- **n8n → menú (⋮) → Import from File** y elegir el `.json`
- O **Import from URL** si los subís a un repo (ej. `https://raw.githubusercontent.com/ralborta/cleexs/main/docs/n8n/cleexs-crear-diagnostico.json`)

Después de importar, configurá en cada nodo la **URL base de tu API** (variable de entorno en n8n o literal), por ejemplo: `https://tu-api.railway.app` o `http://localhost:3001`.

## Flujos incluidos

| Archivo | Descripción |
|---------|-------------|
| `cleexs-crear-diagnostico.json` | Crea un diagnóstico público (marca + URL opcional) y devuelve el `diagnosticId` y el link para ver el resultado. Trigger: manual o webhook. |
| `cleexs-corridas-semanal.json` | Corridas programadas **semanalmente**. Trigger: cron (ej. lunes 8:00). Llama a `GET /api/cron/scheduled-runs?frequency=semanal`, luego crea y ejecuta un run por cada marca con esa frecuencia. |
| `cleexs-corridas-quincenal.json` | Corridas **quincenales**. Trigger: cron (ej. días 1 y 16 a las 8:00). |
| `cleexs-corridas-mensual.json` | Corridas **mensuales**. Trigger: cron (ej. día 1 de cada mes a las 8:00). |

La frecuencia por marca se configura en la app Cleexs: **Configuración → paso "Corridas programadas"**. Solo las marcas con frecuencia asignada aparecen en cada flujo.

## Variables / credenciales

- **CLEEXS_API_URL**: base de la API (ej. `https://tu-api.railway.app`). Definí `CLEEXS_API_URL` en n8n (Settings → Variables) o reemplazá la URL a mano en cada nodo HTTP.
- **CRON_SECRET**: mismo valor que la variable de entorno `CRON_SECRET` en la API de Cleexs. Se envía en el header `X-Cron-Secret` al llamar a `/api/cron/scheduled-runs`. Sin esto, el endpoint devuelve 401.
- **CLEEXS_FRONTEND_URL** (opcional): para el flujo de diagnóstico público, si querés que el flujo devuelva el link listo para abrir (ej. `https://tu-app.vercel.app`).

## Ejemplo de uso desde webhook

Si usás el trigger "Webhook" en lugar de "Manual Trigger":

1. Activá el workflow en n8n.
2. n8n te da una URL de webhook (ej. `https://tu-n8n.com/webhook/xxx`).
3. Enviá un POST con body JSON: `{ "brandName": "YPF Estaciones de Servicio", "url": "https://www.ypf.com" }`.
4. La respuesta incluye `diagnosticId` y `linkResultado` para que el usuario abra el resultado.

## Corridas programadas (cron)

En la API de Cleexs definí la variable de entorno **CRON_SECRET**. En n8n definí la misma valor en Variables como **CRON_SECRET**. Los flujos semanal/quincenal/mensual hacen:

1. **GET** `{{CLEEXS_API_URL}}/api/cron/scheduled-runs?frequency=semanal` (o `quincenal` / `mensual`) con header `X-Cron-Secret: {{CRON_SECRET}}`.
2. La API devuelve `{ items: [{ brandId, tenantId, brandName, periodStart, periodEnd }], ... }`.
3. El nodo "Un ítem por marca" (Split Out) divide `items` en un ítem por marca.
4. Por cada ítem: **POST** `/api/runs` (crear run) y **POST** `/api/runs/:id/execute` (ejecutar).

Si tras importar el trigger o el Split Out no coinciden con tu versión de n8n, configurá el cron y el campo a dividir desde la UI.

Más contexto: [PRUEBA-GRATUITA-Y-CORRIDAS.md](../PRUEBA-GRATUITA-Y-CORRIDAS.md).

## Extender

Podés sumar nodos después de "Crear diagnóstico", por ejemplo:

- **Wait** + **HTTP Request** en loop: hacer GET a `/api/public/diagnostic/{{ $json.diagnosticId }}` hasta que `status === 'completed'`, luego enviar el resultado a Slack/Sheets o guardar el email con PATCH.
