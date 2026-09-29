import admin from "firebase-admin";

/**
 * Firebase Admin SDK — SOLO para uso del servidor en el flujo de recuperación
 * de contraseña. Permite cambiar la contraseña de un usuario en Firebase
 * Authentication (donde realmente viven las contraseñas) sin tocar el flujo
 * de login del cliente ni la base de datos de usuarios.
 *
 * Se inicializa de forma perezosa y TOLERANTE A FALLOS: si el secret
 * FIREBASE_SERVICE_ACCOUNT no está presente o es inválido, devuelve null y
 * registra el motivo, sin romper el resto de la aplicación.
 */

let initAttempted = false;
let initError: string | null = null;

function init(): typeof admin | null {
  if (initAttempted) {
    return admin.apps.length ? admin : null;
  }
  initAttempted = true;

  // Si ya había una app inicializada (hot reload de tsx), reutilizarla.
  if (admin.apps.length) {
    return admin;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) {
    initError =
      "FIREBASE_SERVICE_ACCOUNT no está configurado en los Secrets. " +
      "El cambio de contraseña en Firebase está deshabilitado hasta cargarlo.";
    console.warn(`[firebase-admin] ${initError}`);
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    console.log(
      `[firebase-admin] Inicializado correctamente para el proyecto: ${serviceAccount.project_id}`
    );
    return admin;
  } catch (error: any) {
    initError = `No se pudo inicializar Firebase Admin: ${error.message}. ` +
      "Verifica que FIREBASE_SERVICE_ACCOUNT contenga el JSON completo de la cuenta de servicio.";
    console.error(`[firebase-admin] ${initError}`);
    return null;
  }
}

/** Devuelve la instancia de admin lista para usar, o null si no está configurada. */
export function getFirebaseAdmin(): typeof admin | null {
  return init();
}

/** Indica si Firebase Admin está disponible (secret cargado y válido). */
export function isFirebaseAdminAvailable(): boolean {
  return init() !== null;
}

/** Último error de inicialización (para diagnósticos/logs). */
export function getFirebaseAdminError(): string | null {
  return initError;
}

/**
 * Verifica que la conexión con Firebase Admin funciona realmente, haciendo una
 * llamada de solo lectura a la API de autenticación. Úsalo antes de operar.
 */
export async function verifyFirebaseAdminConnection(): Promise<{
  ok: boolean;
  message: string;
  projectId?: string;
}> {
  const app = init();
  if (!app) {
    return { ok: false, message: initError || "Firebase Admin no está disponible" };
  }
  try {
    // listUsers(1) es una operación de solo lectura que valida credenciales y permisos.
    await app.auth().listUsers(1);
    const projectId =
      (app.app().options as any)?.projectId ||
      (app.app().options.credential as any)?.projectId;
    return {
      ok: true,
      message: "Conexión con Firebase Admin verificada correctamente.",
      projectId,
    };
  } catch (error: any) {
    return {
      ok: false,
      message: `La conexión con Firebase Admin falló: ${error.message}`,
    };
  }
}

/**
 * Cambia la contraseña de un usuario de Firebase identificado por su email.
 * Es la única operación de escritura: no crea, no borra y no toca a otros
 * usuarios. Si el email no existe en Firebase, devuelve found:false (sin error)
 * para no revelar la existencia de cuentas.
 */
export async function updateFirebasePasswordByEmail(
  email: string,
  newPassword: string
): Promise<{ found: boolean; uid?: string; error?: string }> {
  const app = init();
  if (!app) {
    return { found: false, error: initError || "Firebase Admin no está disponible" };
  }
  try {
    const userRecord = await app.auth().getUserByEmail(email);
    await app.auth().updateUser(userRecord.uid, { password: newPassword });
    return { found: true, uid: userRecord.uid };
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      return { found: false };
    }
    throw error;
  }
}

/**
 * Elimina un usuario de Firebase Authentication por email. Es idempotente:
 * si el email no existe en Firebase, devuelve found:false SIN lanzar error
 * (así reintentar una eliminación ya realizada no falla). Solo lanza si hay
 * un error real de Firebase, para que el llamador aborte antes de tocar la BD.
 */
export async function deleteFirebaseUserByEmail(
  email: string
): Promise<{ found: boolean; uid?: string; error?: string }> {
  const app = init();
  if (!app) {
    return { found: false, error: initError || "Firebase Admin no está disponible" };
  }
  try {
    const userRecord = await app.auth().getUserByEmail(email);
    await app.auth().deleteUser(userRecord.uid);
    return { found: true, uid: userRecord.uid };
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      return { found: false };
    }
    throw error;
  }
}

/** Comprueba si un email existe en Firebase Authentication (uso interno). */
export async function findFirebaseUserByEmail(
  email: string
): Promise<{ exists: boolean; uid?: string; displayName?: string }> {
  const app = init();
  if (!app) return { exists: false };
  try {
    const userRecord = await app.auth().getUserByEmail(email);
    return {
      exists: true,
      uid: userRecord.uid,
      displayName: userRecord.displayName || undefined,
    };
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      return { exists: false };
    }
    throw error;
  }
}
