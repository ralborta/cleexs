# Envío de PDF por email (diagnóstico)

## Situación actual
- El email envía un link a `/ver-resultado?diagnosticId=...`
- Si el link no se ve o el cliente prefiere algo descargable, un PDF adjunto ayudaría

## Opciones para generar PDF

### 1. Puppeteer (HTML → PDF)
- Renderizar la página de resultado en headless Chrome
- Guardar como PDF
- **Pros**: Fiel al diseño actual
- **Contras**: Más peso (Puppeteer), tiempo de generación ~2-5 s

### 2. @react-pdf/renderer
- Componentes React específicos para PDF
- **Pros**: Ligero, control total del layout
- **Contras**: Hay que recrear el layout del reporte (no se reutiliza el HTML)

### 3. html-pdf-node o similar
- Pasar HTML string → PDF
- **Pros**: Simple si ya tenés el HTML
- **Contras**: Depende de Chromium/puppeteer por debajo

### 4. jspdf + html2canvas (frontend)
- El usuario en "ver resultado" puede "Descargar PDF"
- Luego n8n/envío manual podría adjuntar
- **Pros**: Sin cambios en backend
- **Contras**: Para email automático necesitás generar server-side

## Recomendación
- **Corto plazo**: Mantener el link. Mejorar el email para que el link sea más visible (botón grande, URL en texto).
- **Mediano plazo**: Endpoint `GET /api/public/diagnostic/:id/pdf` que devuelve PDF. Usar Puppeteer o @react-pdf. n8n podría llamar ese endpoint y adjuntar al email.

## Esfuerzo estimado
- Con Puppeteer: 1-2 días (setup + template + endpoint)
- Con @react-pdf: 2-3 días (recrear layout del reporte)
