// =============================================================================
// Módulo central de impersonación (fuente única de verdad)
// -----------------------------------------------------------------------------
// La impersonación NO crea un segundo "estado paralelo": convierte a la empresa
// impersonada en la IDENTIDAD EFECTIVA de toda la aplicación. Tanto el contexto
// de autenticación (useAuth) como la capa de red (queryClient) leen desde aquí,
// de modo que el backend, las validaciones de permisos, el ruteo y los layouts
// usen siempre el mismo usuario.
// =============================================================================

import { getWordPressIdentity } from "./wordpressSession";

// Clave persistida en localStorage. Sobrevive recargas, navegación y refresh.
export const IMPERSONATION_KEY = "impersonatedCompany";
// Identidad del usuario "temporal" (admin/representante real autenticado).
export const TEMP_USER_KEY = "tempUser";

export interface EffectiveIdentity {
  id: number | null;
  email: string;
  displayName: string;
  role: string;
  roleId?: number;
  companyId?: number;
  photoURL?: string | null;
  impersonated?: boolean;
}

/**
 * Resuelve el ID del usuario representante asociado a una empresa.
 * Prioridad:
 *   1. `userId` explícito ya resuelto y guardado en la empresa impersonada.
 *   2. Primer ID en `representantesVentas` (array de IDs de usuarios).
 * Devuelve null si la empresa no tiene representante vinculado (las llamadas
 * de la app que importan están scopadas por `companyId`, no por usuario).
 */
export function resolveRepresentativeUserId(company: any): number | null {
  if (company?.userId != null) return company.userId;
  const rv = company?.representantesVentas;
  if (Array.isArray(rv) && rv.length > 0 && rv[0] != null) {
    const n = Number(rv[0]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Construye la identidad efectiva del representante a partir de la empresa
 * impersonada. Esta identidad es la que viaja al backend en `x-user-info` y la
 * que consume toda la app durante la impersonación.
 */
export function buildImpersonatedIdentity(company: any): EffectiveIdentity {
  return {
    id: resolveRepresentativeUserId(company),
    email: company?.email1 ?? "",
    displayName: company?.nombreEmpresa ?? "Representante",
    role: "representante", // != admin → fuerza isAdmin = false en toda la app
    roleId: 2,
    companyId: company?.id,
    photoURL: company?.logotipoUrl ?? null,
    impersonated: true,
  };
}

/** Devuelve la empresa impersonada almacenada, o null. */
export function getStoredImpersonatedCompany(): any | null {
  try {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Identidad que debe enviarse en el header `x-user-info` de CADA petición.
 * Se lee en el momento de la petición (no desde un closure de React) para que
 * nunca quede obsoleta. Prioridad:
 *   1. Sesión de representante vía WordPress (solo en memoria) → PRIORITARIA.
 *   2. Impersonación de admin activa → gana el representante impersonado.
 *   3. Usuario manual/Firebase autenticado (tempUser en localStorage).
 *   4. null → visitante.
 * Nota: por regla de negocio, el SSO de WordPress (1) tiene prioridad sobre la
 * sesión local. Cuando NO hay sesión de WordPress activa, `getWordPressIdentity`
 * devuelve null y el orden cae al comportamiento previo (impersonación > local),
 * por lo que el flujo de administración no se ve afectado.
 */
export function getEffectiveAuthIdentityHeader(): string | null {
  const wpIdentity = getWordPressIdentity();
  if (wpIdentity) return JSON.stringify(wpIdentity);

  try {
    const company = getStoredImpersonatedCompany();
    if (company) {
      return JSON.stringify(buildImpersonatedIdentity(company));
    }
  } catch (error) {
    console.error("[impersonation] No se pudo construir el header efectivo:", error);
  }

  const tempUser = localStorage.getItem(TEMP_USER_KEY);
  if (tempUser) return tempUser;

  return null;
}

/**
 * Logger de diagnóstico unificado. Permite rastrear:
 *  - usuario original (admin)
 *  - usuario impersonado (representante)
 *  - estado actual de impersonación
 *  - el momento exacto en que se inicia / detiene / pierde la impersonación
 */
export function logImpersonation(event: string, data: Record<string, any> = {}): void {
  const company = getStoredImpersonatedCompany();
  // eslint-disable-next-line no-console
  console.log(`[impersonation] ${event}`, {
    timestamp: new Date().toISOString(),
    isImpersonating: !!company,
    impersonatedCompanyId: company?.id ?? null,
    impersonatedCompanyName: company?.nombreEmpresa ?? null,
    impersonatedUserId: company?.userId ?? null,
    ...data,
  });
}
