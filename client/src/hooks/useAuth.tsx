import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChange, getOrCreateUser } from "@/lib/auth";
import { apiRequest, ApiError, queryClient } from "@/lib/queryClient";
import { auth } from "@/lib/firebase";
import {
  IMPERSONATION_KEY,
  TEMP_USER_KEY,
  buildImpersonatedIdentity,
  getStoredImpersonatedCompany,
  logImpersonation,
} from "@/lib/impersonation";
import {
  getWordPressIdentity,
  subscribeWordPressSession,
  clearWordPressSession,
  isWordPressOverrideSuppressed,
  clearWordPressOverrideSuppression,
  suppressWordPressOverride,
} from "@/lib/wordpressSession";
import { detectWordPressSession } from "@/lib/wordpressDetect";
import {
  hasWordPressToken,
  processWordPressToken,
} from "@/lib/wordpressTokenLogin";
import type { User } from "@shared/schema";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  /** Usuario EFECTIVO: el representante si hay impersonación, si no el usuario real. */
  user: User | null;
  /** Usuario real autenticado (el admin), independientemente de la impersonación. */
  originalUser: User | null;
  loading: boolean;
  isAdmin: boolean;
  /** true cuando la sesión efectiva proviene del SSO de WordPress. */
  isWordPressSession: boolean;
  impersonatedCompany: any | null;
  isImpersonating: boolean;
  requirePasswordChange: boolean;
  impersonateCompany: (company: any, representativeUserId?: number | null) => void;
  stopImpersonation: () => void;
  signOut: () => void;
  refreshUser: (updatedUserData?: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// Determina si una identidad corresponde a un administrador.
// Además del rol clásico "admin" (o roleId 1), reconoce cualquier rol
// personalizado que tenga marcado el permiso "Acceso al Dashboard de
// Administración" (admin.dashboard). El backend adjunta `accesoAdmin`/`permisos`
// al objeto usuario a partir de la tabla `roles`.
const computeIsAdmin = (u: any): boolean =>
  u?.role === "admin" ||
  u?.roleId === 1 ||
  u?.accesoAdmin === true ||
  (Array.isArray(u?.permisos) && u.permisos.includes("admin.dashboard")) ||
  (typeof u?.role === "object" && u?.role?.nombre === "admin");

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  // originalUser = usuario REAL autenticado (admin). Nunca se sobreescribe por
  // la impersonación; solo cambia al iniciar/cerrar sesión real.
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Garantiza que la detección de WordPress se intente una sola vez por carga.
  const wpDetectionAttempted = useRef(false);
  // Marca cuándo terminó la resolución inicial de auth. Sirve para distinguir un
  // login de Firebase EXPLÍCITO (posterior a la carga, debe ganar sobre WP) de
  // la rehidratación de una sesión persistida al cargar (no debe ganar sobre WP).
  const initialLoadDone = useRef(false);

  // La impersonación se persiste en localStorage para que sobreviva a recargas,
  // navegación interna, cambio de módulos y refresh del navegador.
  const [impersonatedCompany, setImpersonatedCompany] = useState<any | null>(
    () => getStoredImpersonatedCompany()
  );

  // Representante autenticado vía WordPress. Vive SOLO en memoria (nunca storage):
  // se deriva del store de sesión de WordPress y se pierde al recargar, momento
  // en el que se vuelve a detectar en silencio.
  const [wordpressUser, setWordpressUser] = useState<User | null>(
    () => (getWordPressIdentity() as unknown as User) ?? null
  );

  // Mantiene la identidad de WordPress (memoria) sincronizada con el estado de
  // React para que el ruteo, los layouts y los permisos reaccionen al detectarla.
  useEffect(() => {
    return subscribeWordPressSession(() => {
      setWordpressUser((getWordPressIdentity() as unknown as User) ?? null);
    });
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Sesión local previa (login manual): mostrarla de inmediato. Puede ser
        // sustituida por el override de WordPress más abajo.
        const tempUserData = localStorage.getItem(TEMP_USER_KEY);
        if (tempUserData) {
          try {
            const tempUser = JSON.parse(tempUserData);
            // A persisted admin object is only a hint. Do not render the
            // administration UI until Firebase or the signed cookie confirms it.
            if (!computeIsAdmin(tempUser)) setOriginalUser(tempUser);
            logImpersonation("auth:init (tempUser)", {
              originalUserId: tempUser?.id,
              originalUserEmail: tempUser?.email,
            });
          } catch {
            /* tempUser corrupto: ignorar */
          }
        }

        // Override automático por WordPress: se intenta UNA sola vez por carga.
        // Por regla de negocio el SSO de WordPress tiene prioridad sobre CUALQUIER
        // sesión local al cargar. Excepción: un login explícito activó la supresión
        // (debe ganar la cuenta elegida por el usuario).
        if (!wpDetectionAttempted.current && !isWordPressOverrideSuppressed()) {
          wpDetectionAttempted.current = true;

          // Limpia toda sesión local activa cuando WordPress toma el control.
          const clearLocalForWordPress = () => {
            localStorage.removeItem(TEMP_USER_KEY);
            localStorage.removeItem(IMPERSONATION_KEY);
            setImpersonatedCompany(null);
            setOriginalUser(null);
            // Cerrar la sesión de Firebase si existiera (no afecta si no hay).
            // WordPress's automatic override is not an explicit admin logout:
            // do not revoke the signed manual cookie as a side effect.
            import("@/lib/auth")
              .then(({ signOutFirebaseOnly }) => signOutFirebaseOnly())
              .catch((error) => console.error("No se pudo cerrar la sesión de Firebase:", error));
          };

          if (hasWordPressToken()) {
            // Auto-login por JWT (?wp_token=). SILENCIOSO y SIN redirección: el
            // usuario permanece donde llegó, ya autenticado. Tiene prioridad
            // sobre el SSO por cookie (no se intenta este último si hay token).
            processWordPressToken()
              .then((result) => {
                if (result.authenticated) {
                  clearLocalForWordPress();
                  logImpersonation("auth:init (wordpress token)", {});
                  // La identidad WP ya quedó en memoria (subscribeWordPressSession).
                  // No se redirige: el navbar reacciona y muestra la sesión activa.
                }
              })
              .catch(() => {
                /* silencioso: el visitante/usuario local sigue igual */
              });
          } else {
            detectWordPressSession()
              .then((result) => {
                if (result.authenticated) {
                  // WordPress gana: desloguear toda sesión local activa.
                  clearLocalForWordPress();
                  logImpersonation("auth:init (wordpress override)", {});
                  // La identidad WP ya quedó en memoria (subscribeWordPressSession).
                  // Lleva al representante a su dashboard solo si está en la página
                  // de acceso/inicio; nunca interrumpe un deep-link.
                  const path = window.location.pathname;
                  if (path === "/" || path === "/login") {
                    window.location.replace(
                      "/representative-dashboard?tab=overview",
                    );
                  }
                }
              })
              .catch(() => {
                /* silencioso: el visitante/usuario local sigue igual */
              });
          }
        }

        // Firebase: sesión persistida (al cargar) o login explícito posterior.
        const unsubscribe = onAuthStateChange(async (fbUser) => {
          try {
            setFirebaseUser(fbUser);

            if (fbUser) {
              // Un login de Firebase DESPUÉS de la carga inicial es explícito:
              // debe ganar sobre WordPress (vía de escape para admins/usuarios).
              if (initialLoadDone.current) {
                suppressWordPressOverride();
                clearWordPressSession();
                setWordpressUser(null);
              }
              const dbUser = await getOrCreateUser(fbUser);
              setOriginalUser(dbUser);
              // Persistir la identidad para que TODAS las peticiones lleven el
              // header x-user-info (la capa de red lo lee de localStorage). Sin
              // esto, un representante autenticado con Firebase viaja como
              // visitante y el backend responde 401 en acciones protegidas.
              try {
                localStorage.setItem(TEMP_USER_KEY, JSON.stringify(dbUser));
              } catch {
                /* almacenamiento no disponible: la sesión sigue en memoria */
              }
              logImpersonation("auth:init (firebase)", {
                originalUserId: dbUser?.id,
                originalUserEmail: dbUser?.email,
              });
            } else if (getWordPressIdentity()) {
              // Override de WordPress en curso: no hay sesión local.
              setOriginalUser(null);
            } else {
              // Sin Firebase ni WordPress: conservar la sesión manual si existe.
              // Si el tempUser proviene de una cuenta de Firebase real (no
              // manual) y Firebase ya no tiene sesión, se descarta para no
              // dejar una identidad zombi tras expirar/cerrar la sesión.
              const stillTemp = localStorage.getItem(TEMP_USER_KEY);
              let parsedTemp: any = null;
              try {
                parsedTemp = stillTemp ? JSON.parse(stillTemp) : null;
              } catch {
                parsedTemp = null;
              }
              const uid = parsedTemp?.firebaseUid as string | undefined;
              const isManualAccount =
                !!uid &&
                (uid.startsWith("manual_") || uid.startsWith("admin-created-"));
              if (parsedTemp && uid && !isManualAccount) {
                localStorage.removeItem(TEMP_USER_KEY);
                parsedTemp = null;
              }
              // A local tempUser proves nothing: an expired/revoked cookie must
              // not resurrect a manual admin after refreshing the browser.
              // The endpoint derives identity solely from signed credentials.
              if (!parsedTemp || computeIsAdmin(parsedTemp)) {
                try {
                  const response = await apiRequest("GET", "/api/admin/session");
                  const { user: verifiedAdmin } = await response.json();
                  if (!verifiedAdmin || !computeIsAdmin(verifiedAdmin)) {
                    throw new Error("La sesión no pertenece a un administrador");
                  }
                  if (!auth?.currentUser && !getWordPressIdentity()) {
                    localStorage.setItem(TEMP_USER_KEY, JSON.stringify(verifiedAdmin));
                    setOriginalUser(verifiedAdmin);
                  }
                } catch (error) {
                  // Preserve existing representative sessions (403), but remove
                  // a forged/stale local admin when its signed session is absent.
                  if (parsedTemp && !auth?.currentUser && !getWordPressIdentity()
                      && error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                    localStorage.removeItem(TEMP_USER_KEY);
                    setOriginalUser(null);
                  } else if (!auth?.currentUser && !getWordPressIdentity()) {
                    if (parsedTemp) console.error("No se pudo verificar la sesión administrativa:", error);
                    setOriginalUser(null);
                  }
                }
              } else {
                setOriginalUser(parsedTemp);
              }
            }
          } catch (error) {
            console.error("Error handling auth state change:", error);
            setOriginalUser(null);
          } finally {
            initialLoadDone.current = true;
            setLoading(false);
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error("Error checking auth:", error);
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // -------------------------------------------------------------------------
  // Identidad EFECTIVA derivada (la fuente de verdad para permisos y UI).
  // -------------------------------------------------------------------------
  const impersonatedUser: User | null = impersonatedCompany
    ? (buildImpersonatedIdentity(impersonatedCompany) as unknown as User)
    : null;

  // El usuario efectivo que ve y "es" la aplicación. Orden de prioridad:
  // representante WP (SSO prioritario) > impersonación de admin > usuario real.
  // El SSO de WordPress gana sobre la sesión local por regla de negocio; cuando
  // no hay sesión WP, el orden cae al comportamiento previo (impersonación > local).
  const user: User | null = wordpressUser ?? impersonatedUser ?? originalUser;
  const isImpersonating = !!impersonatedCompany;
  // La sesión efectiva proviene de WordPress cuando hay identidad WP en memoria
  // (y, por tanto, es la identidad efectiva). Se usa para ocultar el logout: el
  // único cierre de sesión válido es desde WordPress.
  const isWordPressSession = !!wordpressUser;

  // Permisos basados SIEMPRE en la identidad efectiva:
  // durante la impersonación, isAdmin = false en toda la app (ruteo, layouts,
  // guards, menús), por lo que se comporta como representante de forma consistente.
  const isAdmin = computeIsAdmin(user);
  const isOriginalAdmin = computeIsAdmin(originalUser);

  const impersonateCompany = (company: any, representativeUserId?: number | null) => {
    // Solo un administrador real puede iniciar impersonación.
    if (!isOriginalAdmin) {
      logImpersonation("start:denied (no admin)", {});
      return;
    }
    // Resuelve y estampa el userId del representante para que la identidad
    // efectiva sea precisa (explícito > userId existente > representantesVentas).
    const resolvedUserId =
      representativeUserId ??
      company?.userId ??
      (Array.isArray(company?.representantesVentas) ? company.representantesVentas[0] : null) ??
      null;
    const normalizedCompany = { ...company, userId: resolvedUserId };
    localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(normalizedCompany));
    setImpersonatedCompany(normalizedCompany);
    // Limpia el cache de React Query para que ningún dato cacheado del admin
    // se filtre a la vista del representante (consistencia de la fuente de verdad).
    queryClient.clear();
    logImpersonation("start", {
      originalUserId: originalUser?.id,
      originalUserEmail: originalUser?.email,
      impersonatedCompanyId: company?.id,
      impersonatedCompanyName: company?.nombreEmpresa,
      impersonatedUserId: resolvedUserId,
    });
  };

  const stopImpersonation = () => {
    logImpersonation("stop (explicit)", {
      originalUserId: originalUser?.id,
      originalUserEmail: originalUser?.email,
    });
    localStorage.removeItem(IMPERSONATION_KEY);
    setImpersonatedCompany(null);
    // Limpia el cache para volver a cargar los datos como administrador.
    queryClient.clear();
  };

  const refreshUser = async (updatedUserData?: Partial<User>) => {
    // If we have updated user data provided, use it directly
    if (updatedUserData) {
      const currentUser = originalUser;
      if (currentUser) {
        const mergedUser = { ...currentUser, ...updatedUserData } as User;
        setOriginalUser(mergedUser);

        // Update localStorage if using temp user
        const tempUserData = localStorage.getItem(TEMP_USER_KEY);
        if (tempUserData) {
          localStorage.setItem(TEMP_USER_KEY, JSON.stringify(mergedUser));
        }
        return;
      }
    }

    // Force refresh of user data from database
    const tempUserData = localStorage.getItem(TEMP_USER_KEY);
    if (tempUserData) {
      const tempUser = JSON.parse(tempUserData);

      // Fetch updated user data from API
      try {
        const response = await fetch(`/api/users/${tempUser.id}`, {
          headers: {
            "x-user-info": JSON.stringify(tempUser),
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const updatedUser = await response.json();
          // Update localStorage with fresh data
          localStorage.setItem(TEMP_USER_KEY, JSON.stringify(updatedUser));
          setOriginalUser(updatedUser);
        } else {
          // Fallback to localStorage if API fails
          setOriginalUser(tempUser);
        }
      } catch (error) {
        console.error("Error refreshing user data:", error);
        // Fallback to localStorage if API fails
        setOriginalUser(tempUser);
      }
    }
  };

  const signOut = () => {
    logImpersonation("signOut (clears impersonation)", {
      originalUserId: originalUser?.id,
    });
    // Clear temporary user data
    localStorage.removeItem(TEMP_USER_KEY);
    // Clear any active impersonation
    localStorage.removeItem(IMPERSONATION_KEY);
    // Clear any in-memory WordPress representative session.
    clearWordPressSession();
    setWordpressUser(null);
    // Rehabilitar el SSO de WordPress: tras un logout explícito, una próxima
    // carga puede volver a tomar la sesión de WordPress como prioritaria.
    clearWordPressOverrideSuppression();
    setImpersonatedCompany(null);
    setOriginalUser(null);
    setFirebaseUser(null);
    queryClient.clear();
    // Revoke the server-issued HttpOnly cookie even for manual accounts.
    import("@/lib/auth").then(({ signOutUser }) => signOutUser()).catch((error) => {
      console.error("No se pudo cerrar la sesión del servidor:", error);
    });
  };

  // El cambio de contraseña aplica al usuario REAL autenticado, no al
  // representante impersonado.
  const requirePasswordChange = (originalUser as any)?.requirePasswordChange || false;

  const value = {
    firebaseUser,
    user,
    originalUser,
    loading,
    isAdmin,
    isWordPressSession,
    impersonatedCompany,
    isImpersonating,
    requirePasswordChange,
    impersonateCompany,
    stopImpersonation,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
