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

## Variables / credenciales

- **API URL**: base de la API (ej. `https://tu-api.railway.app`). En el nodo "HTTP Request" la URL es `{{ $env.CLEEXS_API_URL || 'http://localhost:3001' }}/api/public/diagnostic`. Definí `CLEEXS_API_URL` en n8n (Settings → Variables) o reemplazá la URL a mano en el nodo.
- **Frontend URL** (para el link en la respuesta): si querés que el flujo devuelva el link listo para abrir, configurá también la URL del front (ej. `https://tu-app.vercel.app`). En el nodo "Armar link resultado" está como expresión.

## Ejemplo de uso desde webhook

Si usás el trigger "Webhook" en lugar de "Manual Trigger":

1. Activá el workflow en n8n.
2. n8n te da una URL de webhook (ej. `https://tu-n8n.com/webhook/xxx`).
3. Enviá un POST con body JSON: `{ "brandName": "YPF Estaciones de Servicio", "url": "https://www.ypf.com" }`.
4. La respuesta incluye `diagnosticId` y `linkResultado` para que el usuario abra el resultado.

## Extender

Podés sumar nodos después de "Crear diagnóstico", por ejemplo:

- **Wait** + **HTTP Request** en loop: hacer GET a `/api/public/diagnostic/{{ $json.diagnosticId }}` hasta que `status === 'completed'`, luego enviar el resultado a Slack/Sheets o guardar el email con PATCH.
