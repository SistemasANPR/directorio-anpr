import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getEffectiveAuthIdentityHeader } from "./impersonation";
import { auth } from "./firebase";
import { getWordPressToken } from "./wordpressSession";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Intentar extraer la razón legible del cuerpo JSON ({ error } o { message })
    // para que los toasts muestren el motivo real y no el JSON crudo.
    let reason = text;
    try {
      const parsed = JSON.parse(text);
      const base = parsed?.error || parsed?.message;
      if (typeof base === "string" && base.trim()) {
        reason = base;
        if (Array.isArray(parsed?.details) && parsed.details.length) {
          const detail = parsed.details
            .map((d: any) => d?.message || (typeof d === "string" ? d : null))
            .filter(Boolean)
            .join("; ");
          if (detail) reason = `${base}: ${detail}`;
        }
      }
    } catch {
      // El cuerpo no era JSON; usamos el texto tal cual.
    }
    throw new ApiError(reason || `Error ${res.status}`, res.status);
  }
}

async function getFirebaseAuthorization(): Promise<string | null> {
  if (!auth) return null;
  // currentUser is null until Firebase has rehydrated its persisted session.
  // Waiting here also covers requests triggered immediately after a reload.
  await auth.authStateReady();
  const currentUser = auth.currentUser;
  return currentUser ? `Bearer ${await currentUser.getIdToken()}` : null;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const isFormData = data instanceof FormData;

  // Identidad EFECTIVA: si hay impersonación activa, se envía la identidad del
  // representante; en caso contrario, la del usuario real (tempUser). Se lee en
  // tiempo de petición para que nunca quede obsoleta.
  const effectiveIdentity = getEffectiveAuthIdentityHeader();
  const headers: Record<string, string> = {};

  // Always add user info header if available
  if (effectiveIdentity) {
    headers["x-user-info"] = effectiveIdentity;
  }
  const wordpressToken = getWordPressToken();
  if (wordpressToken) {
    headers["x-wordpress-session"] = wordpressToken;
  }

  // Las operaciones administrativas sensibles validan un ID token real en el
  // servidor. Firebase conserva internamente el token, así que adjuntarlo aquí
  // no cambia los consumidores de apiRequest ni expone credenciales a la app.
  try {
    const authorization = await getFirebaseAuthorization();
    if (authorization) headers["Authorization"] = authorization;
  } catch {
    // Las sesiones temporales de administrador usan una cookie firmada.
  }

  // Only set Content-Type for JSON data, let browser handle FormData Content-Type
  if (data && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? data : (data ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Identidad EFECTIVA (representante si hay impersonación; si no, el usuario real).
    const effectiveIdentity = getEffectiveAuthIdentityHeader();
    const headers: Record<string, string> = {};

    if (effectiveIdentity) {
      headers["x-user-info"] = effectiveIdentity;
    }
    const wordpressToken = getWordPressToken();
    if (wordpressToken) {
      headers["x-wordpress-session"] = wordpressToken;
    }
    try {
      const authorization = await getFirebaseAuthorization();
      if (authorization) headers["Authorization"] = authorization;
    } catch {
      // La sesión WordPress firmada o la cookie temporal pueden autenticar.
    }

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
