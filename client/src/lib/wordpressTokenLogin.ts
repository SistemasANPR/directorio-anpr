// =============================================================================
// Auto-login por JWT de WordPress (?wp_token=).
// -----------------------------------------------------------------------------
// Cuando un miembro logueado en WordPress llega al directorio, WordPress añade
// un JWT firmado como `?wp_token=` en la URL. Aquí lo detectamos al cargar la
// app, lo enviamos al backend para verificarlo y, si es válido, materializamos
// la sesión de representante EN MEMORIA (mismo store que el SSO por cookie).
//
// Es SILENCIOSO y NO redirige: el usuario permanece en la página a la que llegó,
// pero ya autenticado (el navbar pasa de "Acceder" a su nombre/avatar). El
// parámetro wp_token se elimina de la URL con history.replaceState, sin recargar.
// =============================================================================

import {
  setWordPressSession,
  type WordPressIdentity,
} from "./wordpressSession";

const WP_TOKEN_PARAM = "wp_token";

export interface WordPressTokenResult {
  authenticated: boolean;
  identity?: WordPressIdentity;
}

/** ¿Hay un wp_token en la URL actual? */
export function hasWordPressToken(): boolean {
  try {
    return new URLSearchParams(window.location.search).has(WP_TOKEN_PARAM);
  } catch {
    return false;
  }
}

/** Elimina ?wp_token= de la URL sin recargar la página. */
function stripTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(WP_TOKEN_PARAM)) return;
    url.searchParams.delete(WP_TOKEN_PARAM);
    const newSearch = url.searchParams.toString();
    const newUrl =
      url.pathname + (newSearch ? `?${newSearch}` : "") + url.hash;
    window.history.replaceState(window.history.state, "", newUrl);
  } catch {
    /* noop: si falla, el token simplemente queda en la URL */
  }
}

/**
 * Procesa el wp_token de la URL (si existe). NUNCA lanza.
 *
 * Flujo:
 *   1. Lee ?wp_token=. Si no hay, devuelve { authenticated:false }.
 *   2. POST /api/auth/wordpress-sso con { token }.
 *   3. Si authenticated:true → guarda la identidad en memoria (representante).
 *   4. Limpia el token de la URL en TODOS los casos.
 */
export async function processWordPressToken(): Promise<WordPressTokenResult> {
  let token = "";
  try {
    token =
      new URLSearchParams(window.location.search).get(WP_TOKEN_PARAM) ?? "";
  } catch {
    return { authenticated: false };
  }

  if (!token) return { authenticated: false };

  // Limpia el token de la URL INMEDIATAMENTE, antes de la verificación: así no
  // queda expuesto en la barra de direcciones, el historial ni se reenvía si el
  // usuario recarga o comparte el enlace, pase lo que pase con la verificación.
  stripTokenFromUrl();

  try {
    const res = await fetch("/api/auth/wordpress-sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data: any = res.ok ? await res.json() : null;

    if (!data?.authenticated) {
      // Visitante: token inválido, sin empresa o membresía caducada.
      return { authenticated: false };
    }

    // Identidad efectiva con la MISMA forma que consume el resto de la app
    // (header x-user-info). role "representante" → isAdmin = false siempre.
    const identity: WordPressIdentity = {
      id: typeof data.userId === "number" ? data.userId : null,
      email: data.email,
      displayName: data.displayName ?? data.companyName ?? "Representante",
      role: "representante",
      roleId: 2,
      companyId: data.companyId,
      companyIds: Array.isArray(data.companyIds) ? data.companyIds : undefined,
      companies: Array.isArray(data.companies) ? data.companies : undefined,
      photoURL: null,
      source: "wordpress",
    };

    if (typeof data.token !== "string" || data.token.length === 0) {
      return { authenticated: false };
    }

    setWordPressSession(identity, data.token);
    return { authenticated: true, identity };
  } catch {
    // Red caída, JSON inválido, etc.: visitante. El token ya se limpió arriba.
    return { authenticated: false };
  }
}
