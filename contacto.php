<?php
/* =============================================================================
   ROTOR — receptor del formulario
   -----------------------------------------------------------------------------
   Hostinger (y casi cualquier alojamiento compartido con Apache) ejecuta PHP
   sin configurar nada: basta con subir este archivo junto al resto.

   ⚠️  ÚNICO CAMBIO OBLIGATORIO ANTES DE PUBLICAR:
       pon tu dirección real en $DESTINATARIO.

   El formulario de la web envía aquí por fetch y espera un JSON. Si el envío
   falla, la web muestra un aviso y ofrece el correo directo: nunca finge que
   se ha enviado algo que no ha salido.
   ========================================================================== */

$DESTINATARIO = 'hola@rotor.es';          // ⚠️ Cambiar.
$ASUNTO       = 'Nueva solicitud desde la web';

// -----------------------------------------------------------------------------

header('Content-Type: application/json; charset=utf-8');

function salir($ok, $error = null, $codigo = 200) {
    http_response_code($codigo);
    echo json_encode(['ok' => $ok, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    salir(false, 'Método no permitido', 405);
}

// Trampa para robots: el campo `web` está oculto, una persona no lo rellena.
if (!empty(trim($_POST['web'] ?? ''))) {
    salir(true);   // Se responde bien y no se envía nada.
}

function campo($clave, $max = 500) {
    $v = trim((string) ($_POST[$clave] ?? ''));
    $v = str_replace(["\r", "\0"], '', $v);
    return mb_substr($v, 0, $max);
}

$nombre      = campo('nombre', 80);
$empresa     = campo('empresa', 80);
$email       = campo('email', 120);
$sector      = campo('sector', 60);
$objetivo    = campo('objetivo', 140);
$presupuesto = campo('presupuesto', 60);
$mensaje     = campo('mensaje', 2000);

$funcionalidades = $_POST['funcionalidades'] ?? [];
if (!is_array($funcionalidades)) $funcionalidades = [$funcionalidades];
$funcionalidades = array_map(static fn($f) => mb_substr(trim((string) $f), 0, 60), $funcionalidades);
$funcionalidades = array_slice($funcionalidades, 0, 20);

// Validación en servidor. La del navegador es comodidad, no seguridad.
if ($nombre === '' || mb_strlen($nombre) < 2)      salir(false, 'Falta el nombre', 422);
if (!filter_var($email, FILTER_VALIDATE_EMAIL))    salir(false, 'Correo no válido', 422);
if ($sector === '')                                salir(false, 'Falta el tipo de negocio', 422);
if (mb_strlen($mensaje) < 12)                      salir(false, 'Falta la descripción', 422);

// Cortafuegos contra inyección de cabeceras.
if (preg_match('/[\r\n]/', $email . $nombre)) salir(false, 'Datos no válidos', 422);

$cuerpo = implode("\n", [
    'Nombre:          ' . $nombre,
    'Empresa:         ' . ($empresa ?: '—'),
    'Email:           ' . $email,
    'Tipo de negocio: ' . $sector,
    'Objetivo:        ' . ($objetivo ?: '—'),
    'Presupuesto:     ' . ($presupuesto ?: '—'),
    'Funcionalidades: ' . ($funcionalidades ? implode(', ', $funcionalidades) : '—'),
    '',
    '--- Descripción ---',
    $mensaje,
    '',
    '-------------------',
    'Enviado desde ' . ($_SERVER['HTTP_HOST'] ?? 'la web') . ' el ' . date('d/m/Y H:i'),
]);

$cabeceras = implode("\r\n", [
    'From: Web ROTOR <no-reply@' . preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? 'localhost') . '>',
    'Reply-To: ' . $email,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
]);

$enviado = @mail(
    $DESTINATARIO,
    '=?UTF-8?B?' . base64_encode($ASUNTO . ' · ' . $nombre) . '?=',
    $cuerpo,
    $cabeceras
);

if (!$enviado) {
    // Copia de seguridad en disco: mejor un archivo que perder el contacto.
    @file_put_contents(
        __DIR__ . '/solicitudes.log',
        "==== " . date('c') . " ====\n" . $cuerpo . "\n\n",
        FILE_APPEND | LOCK_EX
    );
    salir(false, 'El servidor no pudo enviar el correo', 500);
}

salir(true);
