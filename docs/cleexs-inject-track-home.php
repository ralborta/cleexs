<?php
/**
 * ONE-SHOT: inyecta tracking de visitantes Cleexs en la home (index.html).
 *
 * 1) Subí este archivo a public_html (junto a index.html).
 * 2) Abrí: https://cleexs.net/cleexs-inject-track-home.php?key=cleexs-track-20260818
 * 3) Si ves OK: borrá este script.
 */
if (!isset($_GET['key']) || $_GET['key'] !== 'cleexs-track-20260818') {
  http_response_code(403);
  exit('Forbidden');
}

header('Content-Type: text/plain; charset=utf-8');

$path = __DIR__ . '/index.html';
if (!is_file($path)) {
  http_response_code(500);
  exit("ERROR: no existe index.html en " . __DIR__);
}

$html = file_get_contents($path);
if ($html === false) {
  http_response_code(500);
  exit('ERROR: no se pudo leer index.html');
}

$marker = 'track-home.js';
$snippet = '<script src="https://app.cleexs.net/track-home.js" defer></script>';

if (strpos($html, $marker) !== false) {
  echo "OK: tracking ya estaba inyectado\n";
  exit;
}

$replaced = 0;
$html2 = preg_replace('/<\/body>/i', $snippet . "\n</body>", $html, 1, $replaced);
if (!$replaced || $html2 === null) {
  http_response_code(500);
  exit('ERROR: no se encontró </body> para inyectar');
}

if (file_put_contents($path, $html2) === false) {
  http_response_code(500);
  exit('ERROR: no se pudo escribir index.html');
}

echo "OK: tracking inyectado en index.html\n";
echo "Snippet: {$snippet}\n";
echo "Borrá este PHP del servidor.\n";
