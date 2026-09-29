// =============================================================================
// Sesión de representante vía WordPress — EN MEMORIA + PERSISTIDA POR PESTAÑA.
// -----------------------------------------------------------------------------
// Cuando un visitante ya está logueado en WordPress y cumple las condiciones
// (membresía activa + empresa asignada), el backend devuelve una identidad de
// "representante". Esa identidad se guarda AQUÍ, en memoria del módulo, y además
// se replica en `sessionStorage` para que SOBREVIVA a una recarga de la página
// (F5) dentro de la misma pestaña. Sin esa persistencia, al recargar se perdía
// la sesión porque la re-detección por cookie cruzada de dominios (anpr.org.mx →
// directorio.anpr.org.mx) suele fallar (cookies de terceros bloqueadas), y el
// usuario terminaba deslogueado. Se usa sessionStorage (no localStorage) para
// que la sesión siga atada a la pestaña: al cerrarla se limpia y, en una nueva
// visita, WordPress vuelve a ser la fuente de verdad vía el puente de SSO.
//
// La capa de red (queryClient) lee esta identidad en tiempo de petición a través
// de `getEffectiveAuthIdentityHeader`, igual que hace con la impersonación.
// =============================================================================

// Identidad efectiva del representante (misma forma que viaja en x-user-info).
export interface WordPressIdentity {
  id: number | null;
  email: string;
  displayName: string;
  role: string; // "representante" → fuerza isAdmin = false en toda la app
  roleId?: number;
  companyId?: number;
  // `companyId` se conserva como la empresa principal por compatibilidad con
  // sesiones previas. WordPress también puede entregar todas las asignaciones.
  companyIds?: number[];
  companies?: Array<{
    id: number;
    nombreEmpresa?: string;
    [key: string]: unknown;
  }>;
  photoURL?: string | null;
  source?: string;
}

// Clave en sessionStorage donde se replica la sesión para sobrevivir a recargas.
const WP_SESSION_KEY = "wpSession";

// Vida máxima de la sesión persistida (8 horas). Como la re-validación de la
// sesión de WordPress entre dominios no es fiable (la cookie de anpr.org.mx no
// viaja a directorio.anpr.org.mx y /me suele dar 401), este TTL acota la ventana
// en la que el directorio podría seguir activo tras un logout en WordPress.
// Cubre con holgura una jornada de trabajo en la misma pestaña; al expirar, el
// representante vuelve a entrar por el puente de SSO (que reemite la sesión).
const WP_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Persiste (o limpia) la sesión en sessionStorage. Nunca lanza.
function persistSession(
  identity: WordPressIdentity | null,
  token: string | null,
): void {
  try {
    if (identity) {
      sessionStorage.setItem(
        WP_SESSION_KEY,
        JSON.stringify({ identity, token, expiresAt: Date.now() + WP_SESSION_TTL_MS }),
      );
    } else {
      sessionStorage.removeItem(WP_SESSION_KEY);
    }
  } catch {
    /* sessionStorage no disponible: la sesión seguirá viviendo solo en memoria */
  }
}

// Rehidrata la sesión guardada (si la hay) al cargar el módulo, de modo que una
// recarga de la página (F5) no deslogue al representante. Si la sesión expiró
// (TTL), se descarta y se limpia para que WordPress vuelva a ser la fuente.
function loadPersistedSession(): {
  identity: WordPressIdentity | null;
  token: string | null;
} {
  try {
    const raw = sessionStorage.getItem(WP_SESSION_KEY);
    if (!raw) return { identity: null, token: null };
    const parsed = JSON.parse(raw);
    const expired =
      typeof parsed?.expiresAt === "number" && Date.now() > parsed.expiresAt;
    if (expired) {
      sessionStorage.removeItem(WP_SESSION_KEY);
      return { identity: null, token: null };
    }
    if (parsed?.identity?.email) {
      return { identity: parsed.identity, token: parsed.token ?? null };
    }
  } catch {
    /* dato corrupto o sessionStorage no disponible: sin sesión persistida */
  }
  return { identity: null, token: null };
}

const _restored = loadPersistedSession();
let wpIdentity: WordPressIdentity | null = _restored.identity;
let wpToken: string | null = _restored.token;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* noop */
    }
  });
}

/** Establece la sesión de representante de WordPress (memoria + sessionStorage). */
export function setWordPressSession(
  identity: WordPressIdentity,
  token: string | null,
): void {
  wpIdentity = identity;
  wpToken = token;
  persistSession(identity, token);
  emit();
}

/** Limpia la sesión de WordPress (p. ej. al cerrar sesión o expirar). */
export function clearWordPressSession(): void {
  if (wpIdentity === null && wpToken === null) return;
  wpIdentity = null;
  wpToken = null;
  persistSession(null, null);
  emit();
}

/** Identidad efectiva actual del representante de WordPress, o null. */
export function getWordPressIdentity(): WordPressIdentity | null {
  return wpIdentity;
}

/** Token firmado de la sesión de WordPress (en memoria), o null. */
export function getWordPressToken(): string | null {
  return wpToken;
}

/** Suscribe un callback a los cambios de la sesión de WordPress. */
export function subscribeWordPressSession(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// =============================================================================
// Supresión del override automático de WordPress.
// -----------------------------------------------------------------------------
// Por regla de negocio, el SSO de WordPress tiene prioridad sobre cualquier
// sesión local AL CARGAR (override automático). La excepción es un login MANUAL
// explícito: en ese caso el usuario eligió entrar con su cuenta y debe ganar,
// incluso si tiene cookie de WordPress. Como el login manual recarga la página,
// necesitamos una señal que sobreviva esa recarga (sessionStorage, por pestaña)
// para que el override no vuelva a tomar el control. La señal se limpia al
// cerrar sesión, momento en el que WordPress puede volver a tener prioridad.
// =============================================================================

const WP_OVERRIDE_SUPPRESS_KEY = "wpSsoSuppressed";

/** Marca que un login explícito debe ganar sobre el SSO de WordPress. */
export function suppressWordPressOverride(): void {
  try {
    sessionStorage.setItem(WP_OVERRIDE_SUPPRESS_KEY, "1");
  } catch {
    /* sessionStorage no disponible: el override simplemente seguirá activo */
  }
}

/** ¿Hay un login explícito que debe tener prioridad sobre WordPress? */
export function isWordPressOverrideSuppressed(): boolean {
  try {
    return sessionStorage.getItem(WP_OVERRIDE_SUPPRESS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Limpia la supresión (p. ej. al cerrar sesión) para rehabilitar el SSO WP. */
export function clearWordPressOverrideSuppression(): void {
  try {
    sessionStorage.removeItem(WP_OVERRIDE_SUPPRESS_KEY);
  } catch {
    /* noop */
  }
}
