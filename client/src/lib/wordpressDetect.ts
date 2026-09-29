// =============================================================================
// Detección SILENCIOSA de sesión de WordPress.
// -----------------------------------------------------------------------------
// Se ejecuta en segundo plano al cargar la app, sin loaders ni mensajes. Si el
// visitante ya está logueado en WordPress y cumple las condiciones de negocio
// (verificadas en el backend), queda autenticado como representante de su
// empresa. En cualquier otro caso (no logueado, sin empresa, membresía vencida,
// error de red o CORS) NO ocurre nada visible: sigue siendo un visitante.
// =============================================================================

import {
  setWordPressSession,
  type WordPressIdentity,
} from "./wordpressSession";

// Base URL pública de WordPress. Configurable por entorno; por defecto el
// dominio raíz que comparte cookies con el directorio (subdominios).
const WP_PUBLIC_URL =
  ((import.meta as any).env?.VITE_WORDPRESS_PUBLIC_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) || "https://anpr.org.mx";

// Endpoint propio expuesto por el mu-plugin "ANPR Directorio SSO" en WordPress.
// Debe devolver una afirmación JWT firmada del usuario con sesión activa. Los
// campos id/email por sí solos no prueban identidad y nunca se intercambian por
// una sesión del directorio.
const WP_ME_ENDPOINT = `${WP_PUBLIC_URL}/wp-json/anpr/v1/me`;

export interface WordPressDetectResult {
  authenticated: boolean;
  identity?: WordPressIdentity;
}

/**
 * Intenta detectar y materializar la sesión de representante vía WordPress.
 * NUNCA lanza: ante cualquier problema devuelve { authenticated:false }.
 *
 * Flujo:
 *   1. GET {WP}/wp-json/anpr/v1/me con credentials:'include' (cookies WP).
 *   2. Si 200 → extrae la afirmación JWT firmada por WordPress.
 *   3. POST /api/auth/wordpress-sso al backend del directorio.
 *   4. Si el backend autentica → guarda la identidad en memoria (no storage).
 */
export async function detectWordPressSession(): Promise<WordPressDetectResult> {
  try {
    const meRes = await fetch(WP_ME_ENDPOINT, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });

    // 401 o cualquier error → no logueado en WordPress: visitante.
    if (!meRes.ok) return { authenticated: false };

    const me: any = await meRes.json();
    const assertion =
      typeof me?.ssoToken === "string"
        ? me.ssoToken
        : typeof me?.token === "string"
          ? me.token
          : "";
    if (!assertion) return { authenticated: false };

    const res = await fetch("/api/auth/wordpress-sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: assertion }),
    });
    if (!res.ok) return { authenticated: false };

    const data: any = await res.json();
    if (!data?.authenticated || typeof data?.token !== "string") {
      return { authenticated: false };
    }

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
    setWordPressSession(identity, data.token);
    return { authenticated: true, identity };
  } catch {
    // Silencioso por diseño: red caída, CORS, JSON inválido, etc. = visitante.
    return { authenticated: false };
  }
}
