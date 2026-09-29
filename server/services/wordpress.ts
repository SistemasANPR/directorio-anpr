import crypto from "crypto";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

/**
 * Servicio de sesión vía WordPress para representantes de empresa.
 *
 * Permite que un usuario ya autenticado en WordPress (anpr.org.mx) sea
 * reconocido en el directorio como REPRESENTANTE de su empresa, SIN crear
 * cuentas ni pedir contraseña. Toda verificación contra WordPress/MemberPress
 * se hace aquí, en el backend, usando las credenciales de aplicación ya
 * configuradas (WORDPRESS_URL / WORDPRESS_USERNAME / WORDPRESS_APP_PASSWORD).
 * Las credenciales NUNCA se exponen al frontend.
 *
 * No usamos JWT porque el proyecto no lo usa: la sesión se materializa como la
 * misma "identidad efectiva" que ya consume toda la app (header x-user-info).
 * Aun así emitimos un token firmado (HMAC-SHA256, mismo patrón que el servicio
 * de recuperación de contraseña) como artefacto verificable con expiración.
 */

// Secreto dedicado para firmar (HMAC) el token de sesión. Debe fallar cerrado:
// reutilizar otros secretos o un literal conocido permitiría falsificar sesiones.
const configuredSigningSecret = process.env.WP_SSO_SECRET;
if (!configuredSigningSecret || configuredSigningSecret.length < 32) {
  throw new Error("WP_SSO_SECRET must be configured with at least 32 characters");
}
const SIGNING_SECRET: string = configuredSigningSecret;

// Expiración del token de sesión. Corta por diseño: la sesión vive en memoria
// en el frontend y se vuelve a derivar en cada recarga re-verificando WordPress.
export const WP_SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 horas

interface WordPressConfig {
  baseUrl: string;
  authString: string; // base64(usuario:appPassword) para Basic Auth
}

/**
 * Resuelve la configuración de WordPress. Primero variables de entorno; si
 * faltan, cae a la tabla integration_settings (mismo patrón que el resto del
 * proyecto). Devuelve null si no hay configuración completa.
 */
export async function getWordPressConfig(): Promise<WordPressConfig | null> {
  let wordpressUrl = process.env.WORDPRESS_URL;
  let apiKey = process.env.WORDPRESS_USERNAME;
  let apiSecret = process.env.WORDPRESS_APP_PASSWORD;

  if (!wordpressUrl || !apiKey || !apiSecret) {
    const settings = await storage.getIntegrationSettings();
    if (settings) {
      wordpressUrl = wordpressUrl || settings.wordpressUrl || undefined;
      apiKey = apiKey || settings.apiKey || undefined;
      apiSecret = apiSecret || settings.apiSecret || undefined;
    }
  }

  if (!wordpressUrl || !apiKey || !apiSecret) {
    console.log("[WP Session] No WordPress configuration found");
    return null;
  }

  return {
    baseUrl: wordpressUrl.replace(/\/$/, ""),
    authString: Buffer.from(`${apiKey}:${apiSecret}`).toString("base64"),
  };
}

/**
 * Verifica con la API de WordPress que `wpUserId` corresponde realmente a
 * `wpEmail`. Esto impide que alguien falsifique el email en el body de la
 * petición: el email se confirma contra WordPress usando context=edit (que solo
 * expone el email con credenciales de aplicación válidas).
 *
 * Devuelve true únicamente si el email de WordPress coincide (case-insensitive)
 * con el recibido.
 */
export async function verifyWordPressIdentity(
  wpUserId: number,
  wpEmail: string,
  config: WordPressConfig,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${config.baseUrl}/wp-json/wp/v2/users/${wpUserId}?context=edit`,
      {
        headers: {
          Authorization: `Basic ${config.authString}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      console.log(
        `[WP Session] WP user lookup failed for id=${wpUserId}: ${response.status}`,
      );
      return false;
    }

    const wpUser: any = await response.json();
    const wpUserEmail = (wpUser?.email || "").trim().toLowerCase();
    const claimedEmail = (wpEmail || "").trim().toLowerCase();

    if (!wpUserEmail || !claimedEmail) return false;
    return wpUserEmail === claimedEmail;
  } catch (error: any) {
    console.error(
      `[WP Session] Error verifying WP identity for id=${wpUserId}:`,
      error?.message,
    );
    return false;
  }
}

/**
 * Determina si el usuario tiene una membresía ACTIVA a la fecha actual.
 *
 * Combina dos señales (cualquiera positiva basta), para ser robusto frente a
 * variaciones de versión de MemberPress:
 *   1. /wp-json/mp/v1/members/{id} → membresías activas declaradas.
 *   2. /wp-json/mp/v1/transactions → transacción válida (complete/confirmed/
 *      active) sin vencer (expires_at en el futuro, o sin fecha de vencimiento).
 */
export async function hasActiveMembership(
  wpUserId: number,
  config: WordPressConfig,
): Promise<boolean> {
  const now = Date.now();

  // Señal 1: endpoint de miembros de MemberPress.
  try {
    const response = await fetch(
      `${config.baseUrl}/wp-json/mp/v1/members/${wpUserId}`,
      {
        headers: {
          Authorization: `Basic ${config.authString}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      const member: any = await response.json();

      // MemberPress expone las membresías activas de varias formas según versión.
      const active = member?.active_memberships;
      if (Array.isArray(active) && active.length > 0) {
        return true;
      }

      const memberships = member?.memberships;
      if (Array.isArray(memberships)) {
        const anyActive = memberships.some(
          (m: any) =>
            String(m?.status).toLowerCase() === "active" ||
            m?.active === true,
        );
        if (anyActive) return true;
      }

      // Algunas versiones devuelven recent_subscriptions con status.
      const subs = member?.recent_subscriptions;
      if (Array.isArray(subs)) {
        const anyActive = subs.some(
          (s: any) => String(s?.status).toLowerCase() === "active",
        );
        if (anyActive) return true;
      }
    } else {
      console.log(
        `[WP Session] members endpoint returned ${response.status} for id=${wpUserId}; falling back to transactions`,
      );
    }
  } catch (error: any) {
    console.error(
      `[WP Session] Error querying members endpoint for id=${wpUserId}:`,
      error?.message,
    );
  }

  // Señal 2: transacciones de MemberPress (fallback fiable).
  try {
    const response = await fetch(
      `${config.baseUrl}/wp-json/mp/v1/transactions?member=${wpUserId}&per_page=100`,
      {
        headers: {
          Authorization: `Basic ${config.authString}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      console.log(
        `[WP Session] transactions endpoint returned ${response.status} for id=${wpUserId}`,
      );
      return false;
    }

    const transactions: any = await response.json();
    if (!Array.isArray(transactions)) return false;

    const validStatuses = ["complete", "confirmed", "active"];
    return transactions.some((t: any) => {
      if (!validStatuses.includes(String(t?.status).toLowerCase())) return false;
      if (!t?.expires_at) return true; // sin vencimiento → vigente
      const expires = new Date(t.expires_at).getTime();
      // MemberPress usa 0000-00-00 para "sin expiración".
      if (Number.isNaN(expires)) return true;
      return expires > now;
    });
  } catch (error: any) {
    console.error(
      `[WP Session] Error querying transactions for id=${wpUserId}:`,
      error?.message,
    );
    return false;
  }
}

export interface WordPressSessionPayload {
  role: "representative";
  companyId: number;
  // Primary company is retained above for existing consumers; all authorized
  // company IDs allow the session to select another assigned company.
  companyIds?: number[];
  wpEmail: string;
  wpUserId: number;
  source: "wordpress";
}

/**
 * Firma un token de sesión (base64url(payload).firmaHMAC) con expiración.
 * No requiere almacenamiento: es autocontenido y verificable con el secreto.
 */
export function signWordPressSessionToken(
  payload: WordPressSessionPayload,
  nowMs: number,
  ttlSeconds: number = WP_SESSION_TTL_SECONDS,
): string {
  const body = {
    ...payload,
    iat: Math.floor(nowMs / 1000),
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

/**
 * Verifica y decodifica un token de sesión. Devuelve el payload si la firma es
 * válida y no ha expirado; en caso contrario null. Usa comparación en tiempo
 * constante para la firma.
 */
export function verifyWordPressSessionToken(
  token: string,
  nowMs: number,
): (WordPressSessionPayload & { iat: number; exp: number }) | null {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;

    const expected = crypto
      .createHmac("sha256", SIGNING_SECRET)
      .update(encoded)
      .digest("base64url");

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const body = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof body?.exp !== "number" || body.exp * 1000 < nowMs) return null;

    return body;
  } catch {
    return null;
  }
}

// =============================================================================
// SSO por JWT firmado desde WordPress (?wp_token=).
// -----------------------------------------------------------------------------
// Flujo alternativo y autocontenido: WordPress firma un JWT (HS256) con un
// secreto compartido (WP_SSO_SECRET) cuando un miembro logueado llega al
// directorio. El directorio lo verifica AQUÍ y deriva la sesión desde la BD
// LOCAL (tablas users/companies), sin llamar a la API de WordPress y sin crear
// ningún registro. Convive con el flujo por cookie de arriba.
// =============================================================================

/** Secreto compartido con WordPress para firmar/verificar el JWT del SSO. */
const WP_SSO_SECRET = process.env.WP_SSO_SECRET;

/** Payload mínimo que esperamos del JWT emitido por WordPress. */
export interface WordPressJwtPayload {
  email: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Verifica y decodifica el JWT recibido en `?wp_token=`. Devuelve el payload si
 * la firma (HS256 con WP_SSO_SECRET) es válida y NO ha expirado; en cualquier
 * otro caso (secreto sin configurar, firma inválida, token expirado o sin email)
 * devuelve null. `jsonwebtoken.verify` ya rechaza tokens expirados (claim exp).
 */
export function verifyWordPressJwt(token: string): WordPressJwtPayload | null {
  if (!WP_SSO_SECRET) {
    console.log("[WP SSO] WP_SSO_SECRET no configurado: no se puede verificar el token");
    return null;
  }
  if (typeof token !== "string" || token.length === 0) return null;

  try {
    const decoded = jwt.verify(token, WP_SSO_SECRET, { algorithms: ["HS256"] });
    if (typeof decoded !== "object" || decoded === null) return null;

    const email =
      typeof (decoded as any).email === "string"
        ? ((decoded as any).email as string).trim()
        : "";
    if (!email) return null;

    return { ...(decoded as Record<string, unknown>), email } as WordPressJwtPayload;
  } catch (error: any) {
    // Firma inválida, token expirado (TokenExpiredError), malformado, etc.
    console.log(`[WP SSO] Token inválido: ${error?.message}`);
    return null;
  }
}

/** ¿Está configurado el SSO por JWT (existe WP_SSO_SECRET)? */
export function isWordPressJwtConfigured(): boolean {
  return !!WP_SSO_SECRET;
}
