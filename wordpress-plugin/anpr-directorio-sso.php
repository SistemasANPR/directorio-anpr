<?php
/**
 * Plugin Name: ANPR Directorio SSO
 * Description: Inicia sesion automaticamente en el Directorio ANPR a los miembros logueados en WordPress (SSO por token JWT y, opcionalmente, por cookie).
 * Version: 1.0.0
 * Author: ANPR
 */

if (!defined('ABSPATH')) {
    exit; // Acceso directo no permitido.
}

/* =========================================================================
 * CONFIGURACION  ->  EDITA SOLO ESTAS DOS LINEAS
 * -------------------------------------------------------------------------
 * 1) ANPR_SSO_SECRET: debe ser EXACTAMENTE el mismo valor que guardaste en
 *    el Directorio como el secreto "WP_SSO_SECRET".
 * 2) ANPR_DIRECTORIO_URL: la direccion publica del Directorio, SIN barra
 *    final (ejemplo: https://directorio.anpr.org.mx)
 * ========================================================================= */
if (!defined('ANPR_SSO_SECRET')) {
    define('ANPR_SSO_SECRET', 'PEGA-AQUI-EL-MISMO-SECRETO-DEL-DIRECTORIO');
}
if (!defined('ANPR_DIRECTORIO_URL')) {
    define('ANPR_DIRECTORIO_URL', 'https://directorio.anpr.org.mx');
}

/* ========================================================================= */

/** Codifica en Base64 "URL-safe" (sin +, /, ni =) como exige el formato JWT. */
function anpr_sso_b64url($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

/** Genera un JWT HS256 firmado con el secreto compartido. Caduca en 5 minutos. */
function anpr_sso_make_jwt($email) {
    $header  = array('alg' => 'HS256', 'typ' => 'JWT');
    $now     = time();
    $payload = array(
        'email' => $email,
        'iat'   => $now,
        'exp'   => $now + 300, // 5 minutos de validez (suficiente para el salto).
    );

    $segments = array(
        anpr_sso_b64url(wp_json_encode($header)),
        anpr_sso_b64url(wp_json_encode($payload)),
    );
    $signing_input = implode('.', $segments);
    $signature     = hash_hmac('sha256', $signing_input, ANPR_SSO_SECRET, true);
    $segments[]    = anpr_sso_b64url($signature);

    return implode('.', $segments);
}

/* -------------------------------------------------------------------------
 * PUENTE DE ENTRADA AL DIRECTORIO
 * -------------------------------------------------------------------------
 * Enlaza tu menu/boton "Directorio" a esta direccion (admin-ajax NUNCA se
 * cachea, asi que el plugin siempre se ejecuta):
 *
 *   https://anpr.org.mx/web/wp-admin/admin-ajax.php?action=anpr_go_directorio
 *
 * Si el visitante esta logueado en WordPress, genera un token y lo manda al
 * Directorio con ?wp_token=... (queda autenticado como representante).
 * Si no esta logueado, lo manda al Directorio como visitante normal.
 *
 * Tambien se mantiene el puente clasico por ?anpr_go_directorio=1 como
 * respaldo (puede fallar si la pagina esta cacheada).
 * ------------------------------------------------------------------------- */
function anpr_sso_bridge_redirect() {
    $base = rtrim(ANPR_DIRECTORIO_URL, '/');

    if (is_user_logged_in()) {
        $user  = wp_get_current_user();
        $email = isset($user->user_email) ? $user->user_email : '';
        if (!empty($email)) {
            $token = anpr_sso_make_jwt($email);
            wp_redirect($base . '/?wp_token=' . rawurlencode($token));
            exit;
        }
    }

    // No logueado o sin email: entra al Directorio como visitante.
    wp_redirect($base);
    exit;
}

// Via principal: admin-ajax (no se cachea). Funciona logueado y como visitante.
add_action('wp_ajax_anpr_go_directorio', 'anpr_sso_bridge_redirect');
add_action('wp_ajax_nopriv_anpr_go_directorio', 'anpr_sso_bridge_redirect');

// Via de respaldo: ?anpr_go_directorio=1 en cualquier pagina del front.
add_action('init', function () {
    if (!isset($_GET['anpr_go_directorio'])) {
        return;
    }
    anpr_sso_bridge_redirect();
});

/* -------------------------------------------------------------------------
 * (OPCIONAL) Endpoint por cookie: /wp-json/anpr/v1/me
 * -------------------------------------------------------------------------
 * El Directorio tambien sabe detectar la sesion llamando a esta direccion.
 * Funciona solo si el navegador permite cookies entre dominios distintos
 * (a menudo bloqueadas); por eso la via principal es el token de arriba.
 * ------------------------------------------------------------------------- */
add_action('rest_api_init', function () {
    register_rest_route('anpr/v1', '/me', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'callback'            => function () {
            if (!is_user_logged_in()) {
                return new WP_REST_Response(array('error' => 'not_logged_in'), 401);
            }
            $u = wp_get_current_user();
            return array(
                'id'    => $u->ID,
                'email' => $u->user_email,
            );
        },
    ));
});

/* -------------------------------------------------------------------------
 * (OPCIONAL) CORS para el endpoint /me, necesario para el flujo por cookie.
 * Permite que el Directorio llame al endpoint con credenciales.
 * ------------------------------------------------------------------------- */
add_action('rest_api_init', function () {
    add_filter('rest_pre_serve_request', function ($served, $result, $request) {
        // Solo agregamos cabeceras CORS para la ruta /anpr/v1/me, no para todo
        // el REST API de WordPress.
        if (strpos($request->get_route(), '/anpr/v1/me') !== 0) {
            return $served;
        }
        $origin = rtrim(ANPR_DIRECTORIO_URL, '/');
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
        return $served;
    }, 15, 3);
}, 15);
