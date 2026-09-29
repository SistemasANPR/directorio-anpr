# Auditoría y corrección de la impersonación (Impersonate User)

Fecha: 2026-06-16

## 1. Resumen del problema

La impersonación iniciaba correctamente, pero al navegar entre páginas, usar el
menú principal/lateral o cambiar de sección, la aplicación "volvía" al
administrador original sin pulsar **"Dejar de impersonar"**.

## 2. Causa raíz

La impersonación estaba implementada como un **estado paralelo de solo lectura**
(`impersonatedCompany`) superpuesto al usuario admin, **sin reemplazar nunca la
identidad efectiva**. Esto producía tres fallos estructurales:

1. **`isAdmin` seguía siendo `true` durante la impersonación.**
   `isAdmin` se derivaba de `user` (el admin), que nunca se sustituía. Como el
   ruteo y los layouts dependen de `isAdmin`:
   - `AppLayout` (`App.tsx`) renderiza `isAdmin ? <Sidebar/> : <RepresentativeSidebar/>`.
   - `MainNavigation` enlaza el dashboard según `isAdmin`.
   - `ProtectedRoute requireAdmin` deja pasar al admin.

   Resultado: al salir de `/representative-dashboard` hacia cualquier otra ruta,
   se volvía a ver la interfaz de administrador → "se perdió la impersonación".

2. **La capa de red ignoraba por completo la impersonación.**
   `queryClient.ts` (`apiRequest` y `getQueryFn`) construía el header
   `x-user-info` leyendo **exclusivamente** `localStorage['tempUser']`, es decir,
   la identidad del **admin**. El backend (`server/index.ts`, middleware `/api`)
   confía en ese header para poblar `req.user`. Por tanto, **todas** las
   peticiones se ejecutaban como administrador, aunque la UI dijera "Modo
   Representante". La identidad impersonada nunca fue la fuente de verdad.

3. **Solo 3 componentes conocían la impersonación.**
   `MyCompany`, `RepresentativeDashboardComplete` y los banners de los sidebars
   leían `impersonatedCompany`. El resto de la app (permisos, datos, menús,
   ruteo) seguía operando como admin.

> Nota: el valor `impersonatedCompany` **sí** persistía en `localStorage` y
> sobrevivía a recargas. El problema no era la persistencia del dato, sino que
> la identidad efectiva nunca se conmutaba.

### Conflictos revisados (cookies / JWT / contextos / guards)

- **No hay JWT ni sesiones de servidor reales para auth**: aunque
  `express-session` está presente, la autorización es **header-based** vía
  `x-user-info`. No existía conflicto cookie/JWT; el único origen de identidad
  relevante es `localStorage` + el `AuthContext`.
- **No se usa Zustand/Redux**: el estado global es el `AuthContext`.
- El conflicto real era **interno al `AuthContext`**: dos fuentes de identidad
  (`user` admin y `impersonatedCompany`) que no se unificaban.

## 3. Solución (estructural)

Se convierte a la empresa impersonada en la **identidad efectiva** de toda la
aplicación, con una **fuente única de verdad** compartida por el contexto de
auth y la capa de red. El admin se conserva por separado como `originalUser` y
solo se restaura al pulsar explícitamente "Dejar de impersonar".

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `client/src/lib/impersonation.ts` | **(nuevo)** Módulo central: claves de storage, `buildImpersonatedIdentity()`, `getEffectiveAuthIdentityHeader()`, `getStoredImpersonatedCompany()` y `logImpersonation()` (diagnóstico). |
| `client/src/lib/queryClient.ts` | `apiRequest` y `getQueryFn` ahora envían en `x-user-info` la **identidad efectiva** (representante si hay impersonación; si no, el usuario real). Se lee en tiempo de petición → nunca obsoleta. |
| `client/src/hooks/useAuth.tsx` | Reescritura del contexto: `originalUser` (real) vs `user` (efectivo = impersonado ?? real). `isAdmin` se deriva del usuario **efectivo** (→ `false` durante impersonación, consistente en ruteo/layouts/guards). Limpieza de caché de React Query al iniciar/detener. Logs de diagnóstico. Se expone `originalUser`. |
| `client/src/components/RepresentativeSidebar.tsx` | El banner muestra el admin real vía `originalUser` (porque `user` ahora es el representante). |
| `client/src/pages/Users.tsx` | Al impersonar desde *Usuarios* se pasa el `userId` explícito del representante seleccionado a `impersonateCompany(company, u.id)`. |

### Hallazgo en datos (verificación)

En los datos actuales **ninguna empresa tiene `userId` ni `representantesVentas`
poblados**, por lo que la identidad del representante no siempre se puede derivar
desde la empresa. Por eso `buildImpersonatedIdentity()` resuelve el `id` con
prioridad **userId explícito → `company.userId` → `representantesVentas[0]`**, y
al impersonar desde *Usuarios* se envía el `userId` exacto. Cuando no hay
representante vinculado, las vistas relevantes siguen funcionando porque están
scopadas por `companyId` (p. ej. `/api/companies/:id`).

### Verificación realizada

- `vite build` y `tsc --noEmit`: OK / 0 errores.
- Servidor arranca y responde (HMR aplica los cambios del cliente).
- Se confirmó que el backend respeta `x-user-info`: una petición con la
  identidad del representante (id 3) devuelve a ese representante; con la del
  admin, al admin. La impersonación, por tanto, cambia realmente la identidad
  efectiva en el servidor.
- **Bug preexistente detectado (fuera de alcance):** `GET /api/users/me` queda
  capturado por `GET /api/users/:id` (definida antes), por lo que `:id="me"`
  produce error 500. No afecta a la impersonación.

### Por qué es robusto

- **Una sola fuente de verdad** (`impersonatedCompany` en `localStorage`) leída
  de forma consistente por el contexto y por la red.
- **`isAdmin` efectivo**: ruteo, layouts, `ProtectedRoute` y menús conmutan
  automáticamente a modo representante sin lógica condicional dispersa.
- **Persistencia total**: el header se calcula en cada petición leyendo
  `localStorage`, por lo que sobrevive a recargas, refresh, navegación interna,
  redirecciones y cambios de módulo.
- **Aislamiento de datos**: `queryClient.clear()` al iniciar/detener evita que
  datos cacheados del admin se filtren a la vista del representante (y viceversa).
- **Salida explícita únicamente**: la impersonación solo se limpia en
  `stopImpersonation()` (botón "Dejar de impersonar"/"Volver al panel admin") y
  en `signOut()`.

## 4. Diagnóstico (logs)

Todos los eventos se registran con el prefijo `[impersonation]` e incluyen
timestamp, usuario original, empresa/usuario impersonado y estado actual:

- `auth:init (tempUser|firebase)` — identidad real cargada.
- `start` — inicio de impersonación.
- `start:denied (no admin)` — intento bloqueado (no es admin).
- `stop (explicit)` — salida por botón.
- `signOut (clears impersonation)` — cierre de sesión.

## 5. Flujo final de impersonación

1. Un **admin** pulsa "Impersonar" en `Empresas`/`Usuarios`.
2. `impersonateCompany(company)`:
   - valida que `originalUser` sea admin,
   - guarda `impersonatedCompany` en `localStorage`,
   - limpia la caché de React Query,
   - registra el evento.
3. A partir de ese momento, **en toda la app**:
   - `user` = representante; `isAdmin = false`.
   - `AppLayout`/`MainNavigation`/`ProtectedRoute` operan en modo representante.
   - cada petición envía en `x-user-info` la identidad del representante →
     el backend responde como ese representante.
4. La identidad sobrevive a navegación, recargas, refresh y redirecciones
   porque se reconstruye desde `localStorage`.
5. Al pulsar **"Dejar de impersonar"** → `stopImpersonation()` elimina la clave,
   limpia la caché y restaura a `originalUser` (admin).

## 6. Verificación

- `tsc --noEmit`: **0 errores**.
- Rutas usadas por el representante durante la impersonación
  (`PATCH /api/companies/:id`, `POST /api/projects`, `/limits`, etc.) **no
  exigen rol admin**, por lo que enviar la identidad del representante no
  introduce regresiones.

## 7. Deuda relacionada (fuera de alcance, recomendada)

La autorización por header `x-user-info` es **falsificable** desde el cliente.
Para endurecer la seguridad sin cambiar este flujo, se recomienda validar en el
backend el ID token de Firebase y derivar el rol/usuario en el servidor,
tratando la impersonación como una afirmación firmada del admin.
