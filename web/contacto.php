<?php
// Recibe el formulario "Solicitar cotización" del sitio público y lo envía por
// correo. Corre en el mismo Hostinger que sirve el sitio — sin base de datos ni
// servicios externos: las solicitudes se manejan directo desde la bandeja.

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Método no permitido']);
    exit;
}

$DESTINO = 'acastro@ktvworkingdrone.com.co';

// El formulario manda JSON, no multipart.
$payload = json_decode(file_get_contents('php://input'), true);
if (!is_array($payload)) {
    $payload = $_POST;
}

function campo(array $src, string $clave, int $max = 500): string
{
    $valor = isset($src[$clave]) ? trim((string) $src[$clave]) : '';
    // Sin saltos de línea en los campos de una sola línea: es el vector con el
    // que se inyectan cabeceras extra (CC/BCC) en el correo.
    $valor = str_replace(["\r", "\n"], ' ', $valor);
    return mb_substr($valor, 0, $max);
}

$nombre   = campo($payload, 'nombre', 120);
$compania = campo($payload, 'compania', 120);
$email    = campo($payload, 'email', 160);
$telefono = campo($payload, 'telefono', 60);
// El mensaje sí conserva sus saltos de línea — va en el cuerpo, no en cabeceras.
$mensaje  = mb_substr(trim((string) ($payload['mensaje'] ?? '')), 0, 4000);

if ($nombre === '' || $email === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Nombre y correo son obligatorios']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'El correo no es válido']);
    exit;
}

$asunto = 'Solicitud de cotización — ' . $nombre . ($compania !== '' ? ' (' . $compania . ')' : '');

$cuerpo = "Nueva solicitud desde ktvworkingdrone.com.co\n\n"
    . "Nombre:    " . $nombre . "\n"
    . "Compañía:  " . ($compania !== '' ? $compania : '—') . "\n"
    . "Correo:    " . $email . "\n"
    . "WhatsApp:  " . ($telefono !== '' ? $telefono : '—') . "\n\n"
    . "Mensaje:\n" . ($mensaje !== '' ? $mensaje : '—') . "\n\n"
    . "---\n"
    . "Recibido: " . date('Y-m-d H:i:s') . " (hora del servidor)\n"
    . "IP: " . ($_SERVER['REMOTE_ADDR'] ?? '—') . "\n";

// From con el dominio propio para que no lo marquen como spam; el correo del
// interesado va en Reply-To para poder responderle con un simple "Responder".
$cabeceras = [
    'From: KTV Working Drone <no-reply@ktvworkingdrone.com.co>',
    'Reply-To: ' . $nombre . ' <' . $email . '>',
    'Content-Type: text/plain; charset=utf-8',
    'X-Mailer: PHP/' . phpversion(),
];

$enviado = @mail($DESTINO, '=?UTF-8?B?' . base64_encode($asunto) . '?=', $cuerpo, implode("\r\n", $cabeceras));

if (!$enviado) {
    // Si el correo falla, dejamos rastro en disco para no perder al interesado.
    @file_put_contents(
        __DIR__ . '/solicitudes-fallidas.log',
        date('c') . ' | ' . str_replace("\n", ' / ', $cuerpo) . "\n",
        FILE_APPEND | LOCK_EX
    );
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo enviar el correo']);
    exit;
}

echo json_encode(['ok' => true]);
