import crypto from "crypto";

// Secreto para firmar la cookie de sesión de administrador. Reutiliza un secreto
// de entorno real y de alta entropía (WP_SSO_SECRET está presente tanto en
// desarrollo como en producción). NO hay respaldo hardcodeado: si no existiera
// ningún secreto, firmar lanza error y verificar niega el acceso (falla segura),
// en vez de aceptar cookies firmadas con una constante pública falsificable.
function getSecret(): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.WP_SSO_SECRET ||
    process.env.WORDPRESS_APP_PASSWORD;
  if (!secret) {
    throw new Error(
      "No hay secreto de firma configurado (SESSION_SECRET / WP_SSO_SECRET) para la sesión de administrador",
    );
  }
  return secret;
}

export const ADMIN_SESSION_COOKIE = "admin_session";
export const ADMIN_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// Emite un token firmado (HMAC-SHA256) que prueba, de forma verificable por el
// servidor, que el usuario inició sesión con credenciales válidas. No es
// falsificable sin el secreto del servidor.
export function signAdminSession(userId: number): string {
  const payload = `${userId}.${Date.now() + ADMIN_SESSION_TTL_MS}`;
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

// Verifica el token: firma correcta y no expirado. Devuelve el userId o null.
export function verifyAdminSession(token: string): number | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userIdStr, expStr, sig] = parts;
    const payload = `${userIdStr}.${expStr}`;
    const expected = crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    if (Date.now() > Number(expStr)) return null;
    const userId = Number(userIdStr);
    return Number.isFinite(userId) ? userId : null;
  } catch {
    return null;
  }
}

// Extrae una cookie por nombre del header Cookie (sin depender de cookie-parser).
export function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}
