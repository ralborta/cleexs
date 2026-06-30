#!/usr/bin/env python3
"""
Genera el manual de uso de Email para el cliente (PDF).
Salida: docs/MANUAL-USO-EMAIL-CLIENTE.pdf
Requiere: Google Chrome instalado (headless print-to-pdf).
"""
from __future__ import annotations

import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "docs" / "MANUAL-USO-EMAIL-CLIENTE.html"
PDF_PATH = ROOT / "docs" / "MANUAL-USO-EMAIL-CLIENTE.pdf"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "google-chrome",
    "chromium",
]


def chrome_binary() -> str:
    for candidate in CHROME_CANDIDATES:
        path = Path(candidate)
        if path.is_file():
            return str(path)
        found = subprocess.run(["which", candidate], capture_output=True, text=True)
        if found.returncode == 0 and found.stdout.strip():
            return found.stdout.strip()
    raise RuntimeError("No se encontró Chrome/Chromium para generar el PDF.")


def html_content() -> str:
    today = date.today().strftime("%d/%m/%Y")
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Cleexs — Manual de uso · Email</title>
  <style>
    @page {{ margin: 22mm 18mm; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #1e293b;
      max-width: 780px;
      margin: 0 auto;
      padding: 24px;
    }}
    h1 {{ font-size: 22pt; color: #4c1d95; margin: 0 0 8px; line-height: 1.2; }}
    h2 {{ font-size: 14pt; color: #5b21b6; margin: 28px 0 10px; border-bottom: 2px solid #ede9fe; padding-bottom: 4px; }}
    h3 {{ font-size: 12pt; color: #334155; margin: 18px 0 8px; }}
    p {{ margin: 0 0 10px; }}
    .meta {{ color: #64748b; font-size: 10pt; margin-bottom: 24px; }}
    table {{ width: 100%; border-collapse: collapse; margin: 12px 0 16px; font-size: 10pt; }}
    th, td {{ border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; vertical-align: top; }}
    th {{ background: #f8fafc; color: #475569; font-weight: 600; }}
    ul, ol {{ margin: 8px 0 12px; padding-left: 22px; }}
    li {{ margin-bottom: 6px; }}
    .note {{
      background: #f5f3ff;
      border-left: 4px solid #7c3aed;
      padding: 10px 14px;
      margin: 14px 0;
      font-size: 10pt;
    }}
    .warn {{
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 10px 14px;
      margin: 14px 0;
      font-size: 10pt;
    }}
    code {{
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 9pt;
      background: #f1f5f9;
      padding: 1px 5px;
      border-radius: 4px;
    }}
    .cover {{
      page-break-after: always;
      padding-top: 80px;
    }}
    .cover p {{ font-size: 12pt; }}
    .toc {{ page-break-after: always; }}
    .toc a {{ color: #5b21b6; text-decoration: none; }}
    .toc li {{ margin-bottom: 4px; }}
    footer {{
      margin-top: 40px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 9pt;
      color: #94a3b8;
      text-align: center;
    }}
  </style>
</head>
<body>

<div class="cover">
  <h1>Cleexs</h1>
  <p><strong>Manual de uso — Email</strong></p>
  <p class="meta">Panel admin · app.cleexs.net<br/>Actualizado: {today}</p>
  <p>Guía para operar la sección de <strong>Email</strong> del panel de administración de Cleexs.</p>
</div>

<div class="toc">
  <h2>Índice</h2>
  <ol>
    <li><a href="#intro">Introducción — dos pantallas de email</a></li>
    <li><a href="#secuencia">Email · secuencia</a></li>
    <li><a href="#semanales">Emails semanales</a></li>
    <li><a href="#flujos">Flujos del día a día</a></li>
    <li><a href="#glosario">Glosario</a></li>
    <li><a href="#faq">Preguntas frecuentes</a></li>
  </ol>
</div>

<h2 id="intro">1. Introducción — dos pantallas de email</h2>
<p>URL base del panel: <strong>https://app.cleexs.net/admin</strong></p>
<p>En el menú lateral, sección <strong>Marketing</strong>, hay dos opciones relacionadas con email. Cada una tiene un rol distinto:</p>

<table>
  <thead>
    <tr><th>Pantalla</th><th>Menú</th><th>Para qué sirve</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Email · secuencia</strong></td>
      <td>Marketing → Email · secuencia</td>
      <td>Pruebas puntuales, avisos manuales (broadcast), campañas técnicas y auditoría general.</td>
    </tr>
    <tr>
      <td><strong>Emails semanales</strong></td>
      <td>Marketing → Emails semanales</td>
      <td>Secuencia automática que sale sola cada semana + edición de los 4 mensajes.</td>
    </tr>
  </tbody>
</table>

<h2 id="secuencia">2. Email · secuencia</h2>
<p>Ruta: <code>/admin/email</code></p>
<p>Pantalla de <strong>operación general</strong>: ver números globales, mandar pruebas, hacer un aviso puntual a muchos usuarios y revisar el historial.</p>

<h3>2.1 Resumen superior (tarjetas)</h3>
<ul>
  <li><strong>Campañas configuradas:</strong> cuántas campañas hay en el sistema.</li>
  <li><strong>Enviados (30 días):</strong> correos enviados en el último mes.</li>
  <li><strong>Fallos / Saltados:</strong> envíos que fallaron o se omitieron.</li>
  <li><strong>Logs totales:</strong> historial acumulado de todos los envíos registrados.</li>
</ul>
<p>Usá el botón <strong>Refrescar</strong> (arriba a la derecha) después de cualquier envío para ver datos actualizados.</p>

<h3>2.2 Enviar email de prueba</h3>
<p><strong>Cuándo usarlo:</strong> verificar que el sistema manda correos (canal Resend operativo).</p>
<ol>
  <li>Escribí tu email en <strong>Email destino</strong>.</li>
  <li>Clic en <strong>Enviar prueba</strong>.</li>
  <li>Revisá la bandeja (asunto: <em>Cleexs · prueba de envío (admin interno)</em>).</li>
  <li>El resultado queda en <strong>Auditoría — últimos envíos</strong> (abajo).</li>
</ol>
<div class="note">Si la prueba no llega, revisá spam o avisá al equipo técnico antes de intentar envíos masivos.</div>

<h3>2.3 Broadcast manual</h3>
<p><strong>Cuándo usarlo:</strong> mandar un aviso o promo <strong>puntual</strong> a usuarios registrados (no es la secuencia semanal automática).</p>

<table>
  <thead><tr><th>Campo</th><th>Qué es</th></tr></thead>
  <tbody>
    <tr><td><strong>Asunto</strong></td><td>Título del email.</td></tr>
    <tr><td><strong>Segmento</strong></td><td><code>free</code> = usuarios gratis · <code>premium</code> = pagos · <code>all</code> = todos.</td></tr>
    <tr><td><strong>Límite</strong></td><td>Cantidad máxima de destinatarios (ej. 250).</td></tr>
    <tr><td><strong>Mensaje</strong></td><td>Cuerpo del mail. Podés personalizar con variables (ver abajo).</td></tr>
  </tbody>
</table>

<p><strong>Variables disponibles en el mensaje:</strong></p>
<ul>
  <li><code>{{'{{brandName}}'}}</code> — nombre de la marca del usuario</li>
  <li><code>{{'{{domain}}'}}</code> — dominio analizado</li>
  <li><code>{{'{{score}}'}}</code> — Cleexs Score</li>
  <li><code>{{'{{tip1}}'}}</code> — tip automático según su score</li>
</ul>

<p><strong>Flujo recomendado:</strong></p>
<ol>
  <li>Dejá marcado <strong>Solo prueba (no enviar todavía)</strong>.</li>
  <li>Clic en <strong>Previsualizar destinatarios</strong> → ves cuántos recibirían el mail y una muestra.</li>
  <li>Si está bien, desmarcá la casilla de prueba.</li>
  <li>Clic en <strong>Enviar broadcast</strong>.</li>
</ol>

<h3>2.4 Resend · entregas y engagement</h3>
<p>Métricas de Resend (entregados, abiertos, clics, rebotes). <strong>No es lo mismo</strong> que «enviados» arriba: depende del webhook configurado en el servidor.</p>
<ul>
  <li>Si ves <strong>Webhook configurado</strong> en verde → las métricas de apertura/clic deberían actualizarse solas.</li>
  <li>Si ves aviso amarillo de <strong>Falta secret</strong> → avisá al equipo técnico.</li>
</ul>

<h3>2.5 Campañas (sem × bucket)</h3>
<p>Sección <strong>técnica</strong>. Para el día a día <strong>no hace falta tocarla</strong>, salvo que el equipo técnico lo pida. Desde acá se puede ver/editar plantillas avanzadas, probar una campaña concreta y activar/desactivar campañas.</p>

<h3>2.6 Auditoría — últimos envíos</h3>
<p>Historial de envíos recientes: destinatario, campaña, estado (<code>sent</code>, <code>failed</code>, etc.) y fecha. Útil para confirmar que una prueba o un broadcast salió bien.</p>

<h2 id="semanales">3. Emails semanales</h2>
<p>Ruta: <code>/admin/email/weekly</code></p>
<p>Pantalla para la <strong>secuencia automática</strong>: el mail que sale solo cada semana a usuarios free (por defecto).</p>

<h3>3.1 Resumen (tarjetas superiores)</h3>
<ul>
  <li><strong>Enviados (histórico):</strong> total desde que empezó la secuencia.</li>
  <li><strong>Enviados últimos 7 días / hoy:</strong> actividad reciente.</li>
  <li><strong>Fallos en ventana:</strong> errores en el período elegido.</li>
  <li><strong>Última corrida:</strong> cuándo fue el último envío automático y qué campaña usó.</li>
</ul>
<p><strong>Ventana de tiempo:</strong> selector arriba (7, 30, 90 o 180 días). Si ves pocos datos, probá <strong>7 días</strong> y <strong>Refrescar</strong>.</p>

<h3>3.2 Corridas recientes</h3>
<p>Tabla con cada corrida automática: campaña, fecha, destinatarios, enviados, fallos y % de éxito.</p>

<h3>3.3 Últimos envíos individuales</h3>
<p>Detalle persona por persona: email, campaña, estado y fecha. Sirve para verificar que un usuario concreto recibió (o no) su mail.</p>

<h3>3.4 Configuración del envío automático</h3>
<p>Acá definís <strong>cuándo</strong> sale la secuencia sola.</p>

<table>
  <thead><tr><th>Opción</th><th>Valor de referencia</th><th>Qué hace</th></tr></thead>
  <tbody>
    <tr><td><strong>Día de envío</strong></td><td>Martes</td><td>Día de la semana (muestra equivalente en hora Argentina).</td></tr>
    <tr><td><strong>Hora</strong></td><td>13:00 UTC = 10:00 AR</td><td>Hora exacta del disparo.</td></tr>
    <tr><td><strong>Segmento</strong></td><td>Free</td><td>Quién recibe (free / premium / todos).</td></tr>
    <tr><td><strong>Envío automático activado</strong></td><td>✓</td><td>Si está desmarcado, no sale nada aunque llegue el día.</td></tr>
    <tr><td><strong>Solo simular</strong></td><td>✗</td><td>Si está marcado, simula pero no manda mails reales.</td></tr>
  </tbody>
</table>
<p>Después de cambiar algo → <strong>Guardar cambios</strong>.</p>
<div class="note">El sistema revisa cada hora si coincide día y hora. No hace falta estar logueado el martes a las 10.</div>

<h3>3.5 Disparar una corrida ahora</h3>
<p>Para <strong>probar o adelantar</strong> un envío sin esperar al martes.</p>

<table>
  <thead><tr><th>Campo</th><th>Recomendación</th></tr></thead>
  <tbody>
    <tr><td><strong>Modo</strong></td><td>Empezar siempre en <strong>Simular: no enviar mails</strong>.</td></tr>
    <tr><td><strong>Segmento</strong></td><td>Igual que la config (normalmente Free).</td></tr>
    <tr><td><strong>Semana / mensaje</strong></td><td>Automática, o forzar Semana 1–4 para probar un texto concreto.</td></tr>
    <tr><td><strong>Límite</strong></td><td>50 para prueba; subir solo cuando estés seguro.</td></tr>
  </tbody>
</table>
<ol>
  <li><strong>Simular ahora</strong> → revisás destinatarios, asunto y campaña.</li>
  <li>Si todo OK → cambiá a <strong>Enviar real ahora</strong> (idealmente con límite bajo primero).</li>
</ol>

<h3>3.6 Plantillas semanales (Semanas 1 a 4)</h3>
<p>Los <strong>4 mensajes</strong> que rota la secuencia automática (ciclo de 4 semanas). Para cada semana podés editar: <strong>Asunto</strong>, <strong>Preheader</strong> (texto preview en la bandeja) y <strong>Cuerpo</strong>.</p>
<ol>
  <li>Expandí la semana que querés cambiar.</li>
  <li>Editá el texto.</li>
  <li>Guardá.</li>
  <li>Mandá una simulación o prueba antes del envío real del martes.</li>
</ol>
<div class="warn">Hay campañas w5–w8 en el sistema, pero el cron automático usa el ciclo <strong>1 → 2 → 3 → 4 → 1…</strong></div>

<h2 id="flujos">4. Flujos del día a día</h2>

<h3>Quiero saber si el email funciona</h3>
<ol>
  <li><code>/admin/email</code> → <strong>Enviar prueba</strong> a tu casilla.</li>
  <li>Revisá bandeja + <strong>Auditoría</strong>.</li>
</ol>

<h3>Quiero cambiar el texto del mail semanal</h3>
<ol>
  <li><code>/admin/email/weekly</code> → <strong>Plantillas semanales</strong> → editar Semana X → Guardar.</li>
  <li><strong>Simular ahora</strong> con esa semana forzada.</li>
  <li>Si se ve bien, el martes saldrá solo (con envío automático activado).</li>
</ol>

<h3>Quiero mandar un aviso puntual (promo, novedad)</h3>
<ol>
  <li><code>/admin/email</code> → <strong>Broadcast manual</strong>.</li>
  <li>Simulación primero → luego envío real.</li>
</ol>

<h3>Quiero pausar los mails semanales</h3>
<ol>
  <li><code>/admin/email/weekly</code> → desmarcar <strong>Envío automático activado</strong> → <strong>Guardar</strong>.</li>
</ol>

<h3>Quiero ver cuántos mails salieron esta semana</h3>
<ol>
  <li><code>/admin/email/weekly</code> → ventana <strong>7 días</strong> → <strong>Refrescar</strong>.</li>
  <li>Mirá <strong>Enviados últimos 7 días</strong> y la tabla de corridas.</li>
</ol>

<h2 id="glosario">5. Glosario</h2>
<table>
  <thead><tr><th>Término</th><th>Significado</th></tr></thead>
  <tbody>
    <tr><td><strong>Secuencia semanal</strong></td><td>4 emails que rotan automáticamente cada martes.</td></tr>
    <tr><td><strong>Broadcast</strong></td><td>Email manual puntual a un segmento.</td></tr>
    <tr><td><strong>Dry run / Simular</strong></td><td>Prueba sin mandar correos reales.</td></tr>
    <tr><td><strong>Segmento free</strong></td><td>Usuarios que hicieron el diagnóstico gratis.</td></tr>
    <tr><td><strong>Campaña / slug</strong></td><td>Identificador interno (ej. weekly-seq-w1-all).</td></tr>
    <tr><td><strong>Resend</strong></td><td>Servicio que entrega los correos.</td></tr>
    <tr><td><strong>Log / Auditoría</strong></td><td>Registro de cada intento de envío.</td></tr>
  </tbody>
</table>

<h2 id="faq">6. Preguntas frecuentes</h2>

<p><strong>¿Por qué en una pantalla veo envíos y en otra no?</strong><br/>
<code>/admin/email</code> muestra totales generales (30 días). <code>/admin/email/weekly</code> muestra solo la secuencia automática. Usá ventana de 7 días y Refrescar.</p>

<p><strong>¿Puedo mandar el mail semanal un día que no sea martes?</strong><br/>
Sí: <strong>Disparar una corrida ahora</strong> en <code>/admin/email/weekly</code> (modo real).</p>

<p><strong>¿El broadcast y la secuencia semanal son lo mismo?</strong><br/>
No. Broadcast = aviso manual puntual. Semanal = automatismo del martes.</p>

<p><strong>¿Qué hago si un envío falla?</strong><br/>
Anotá el email y la fecha de <strong>Últimos envíos individuales</strong> y pasalo al equipo técnico.</p>

<footer>Cleexs · Manual de uso Email · {today}</footer>
</body>
</html>"""


def write_html() -> None:
    HTML_PATH.write_text(html_content(), encoding="utf-8")


def html_to_pdf() -> None:
    chrome = chrome_binary()
    file_url = HTML_PATH.resolve().as_uri()
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        f"--print-to-pdf={PDF_PATH}",
        "--print-to-pdf-no-header",
        file_url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0 or not PDF_PATH.is_file():
        raise RuntimeError(
            f"No se pudo generar el PDF.\nstdout: {result.stdout}\nstderr: {result.stderr}"
        )


def main() -> int:
    write_html()
    html_to_pdf()
    print(f"OK → {PDF_PATH}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
