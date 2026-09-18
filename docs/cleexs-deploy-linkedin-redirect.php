<?php
/**
 * ONE-SHOT: /linkedin → redirect a /meta
 * SiteGround: subir a raíz y abrir
 * https://cleexs.net/cleexs-deploy-linkedin-redirect.php?key=cleexs-li-redirect-20260825
 */
if (!isset($_GET['key']) || $_GET['key'] !== 'cleexs-li-redirect-20260825') {
  http_response_code(403);
  exit('Forbidden');
}
header('Content-Type: text/plain; charset=utf-8');
$dir = __DIR__ . '/linkedin';
if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
  http_response_code(500);
  exit("ERROR mkdir\n");
}
$bytes = file_put_contents($dir . '/index.html', <<<'HTML'
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, follow" />
  <title>Redirigiendo… | Cleexs</title>
  <link rel="canonical" href="https://cleexs.net/meta" />
  <meta http-equiv="refresh" content="0;url=/meta/" />
  <script>
    (function () {
      var q = window.location.search || '';
      var hash = window.location.hash || '';
      window.location.replace('/meta/' + q + hash);
    })();
  </script>
</head>
<body>
  <p style="font-family: system-ui, sans-serif; padding: 2rem; color: #0f172a">
    Esta campaña ahora vive en <a href="/meta/">cleexs.net/meta</a>.
  </p>
</body>
</html>

HTML);
echo "OK: /linkedin ahora redirige a /meta ($bytes bytes).\n";
echo "Borrá este PHP.\n";
