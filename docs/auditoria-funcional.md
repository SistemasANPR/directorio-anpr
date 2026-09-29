# Auditoría funcional ANPR México

Fecha: 2026-06-16 · Alcance: registro, login, empresas, pagos Stripe, manejo de
errores, backend, seguridad. Método: lectura de código (4 auditorías paralelas) +
verificación manual de cada hallazgo accionado.

> Nota operativa: el servidor corre con `tsx` (sin watch). Los cambios de backend
> requieren **reiniciar** el servidor (en Replit: Stop → Run) para tomar efecto.
> Los cambios ya están en el código y compilan (`tsc --noEmit` = 0 errores).

---

## A. Problemas encontrados (priorizados)

### CRÍTICOS
1. **Auth falsificable (escalada de privilegios total).** `server/index.ts:20` arma
   `req.user` parseando el header `x-user-info` que envía el cliente, sin verificar
   token ni firma. `curl -H 'x-user-info:{"role":"admin"}'` = admin.
2. **Endpoints sensibles sin verificación de rol.** `DELETE /api/users/:id`,
   `POST /api/users` (puede crear admins), `PUT /api/users/:id` (puede subir el rol
   propio a admin), `GET /api/users/:userId/payments` (IDOR), borrados de empresas/
   planes/roles/certificados, `change-plan`, `auto-renewal` — sin auth real.
3. **Toma de cuentas en `change-temp-password`.** Si no se enviaba `currentPassword`,
   se saltaba la validación y se reescribía la contraseña de cualquier `userId`.
4. **`reset-user-password` y `activate-wordpress-account` sin auth** → toma de cuentas
   (incluido admin) vinculando un `firebaseUid` propio a un `userId` ajeno.
5. **Webhook de Stripe roto/falsificable.** `express.json()` global (`index.ts:6`)
   parsea el body antes del webhook; `constructEvent` necesita el **raw Buffer**, así
   que la verificación de firma siempre falla → los pagos por webhook nunca se
   registran. Si se desactiva la verificación, queda abierto a falsificación.
6. **`complete-registration` no verifica el pago en Stripe.** Confía en el
   `paymentIntentId` que manda el cliente y marca `status:"succeeded"` a mano → se
   puede obtener cuenta + empresa activa + certificado **sin pagar**.
7. **`create-payment-intent` cobra siempre el precio ANUAL.** Ignora la periodicidad
   (`routes.ts:~2544`) → sobrecobro a quien elige mensual; además el monto cobrado
   no coincide con el registrado.
8. **Webhook sin idempotencia y con FKs inválidas** (`userId:0`/`companyId:0` para
   nuevas membresías) → inserciones que violan constraints y reintentos infinitos.
9. **`tempPassword` (hash bcrypt / texto plano legacy) expuesto** en `GET /api/users`
   y `/api/users/:id` (sin auth) → robo de credenciales/ataque offline.
10. **`server/index.ts` error handler relanzaba el error** (`throw err`) tras
    responder → excepción no capturada que puede **tumbar el proceso**.

### ALTOS
11. **`complete-registration` no es transaccional.** Si falla un paso intermedio tras
    el cobro, quedan usuario/empresa a medias y el reintento se bloquea por email
    duplicado → cliente que pagó sin cuenta.
12. **Colisión de `stripePaymentIntentId` (UNIQUE)** entre webhook y
    `complete-registration` (doble insert) → 500 sin mensaje claro.
13. **`storage.getCertificates()` no existe** (`routes.ts:~4192`) y
    `assignCertificateToCompany` se llamaba sin el 3er argumento → crash latente.
14. **`/api/users/me` eclipsado por `/api/users/:id`** → `parseInt("me")=NaN` → roto.
15. **Contraseña en texto plano** en la respuesta de `complete-registration`
    (`user.password`) y `ANPR2024!` hardcodeada como tempPassword global.
16. **`change-plan` actualiza la BD aunque Stripe falle** → estado inconsistente.
17. **`autoRenewal` definido pero sin lógica de renovación real.**
18. **`useAuth.tsx` cleanup de `useEffect` retorna una Promise** (no la función de
    desuscripción) → listener de Firebase nunca se limpia (memory leak).

### MEDIOS / BAJOS
19. Formatos de error inconsistentes (`{error}` vs `{message}` vs `{error,userMessage}`)
    y exposición de `error.message` crudo en varios 500.
20. `parseInt(req.params.id)` sin validar NaN en la mayoría de endpoints.
21. Persistencia de sesión ignora `rememberMe` para usuarios tempUser.
22. CSP eliminado en todas las respuestas (también en producción).
23. Logs de PII/identidad (`x-user-info`, emails, bodies) en cada request.
24. Redirecciones a rutas inexistentes en `ActivarCuenta` (`/admin/dashboard`).
25. Código muerto/duplicado (lógica WordPress duplicada, constraint inexistente,
    `testStripeConnection` mock, `RepresentativeDashboard*` múltiples).

---

## B. Problemas corregidos en esta sesión (seguros y aislados)

| # | Archivo | Cambio | Por qué |
|---|---------|--------|---------|
| 10 | `server/index.ts` | El error handler ya no hace `throw err`; loguea y añade guard `res.headersSent`. | Evita caída del proceso por excepción no capturada. |
| 9 | `server/routes.ts` | Nuevo `sanitizeUser()` aplicado a `GET /api/users`, `/:id`, `/firebase/:uid`, `/me`, `POST /api/users`, `PUT /api/users/:id`. | Deja de filtrar `tempPassword` al cliente. No rompe el alta admin (usa su propio tempPassword cliente). |
| 14 | `server/routes.ts` | `GET /api/users/:id` delega `me` con `next()` y valida NaN. | `/api/users/me` vuelve a funcionar. |
| 15 | `server/routes.ts` | Se elimina `password` de la respuesta de `complete-registration`. | No exponer la contraseña en red/logs. |
| 13 | `server/routes.ts` | `getCertificates()`→`getAllCertificates()` y se pasa el objeto `details` a `assignCertificateToCompany`. | Corrige crash latente. |
| 3 | `server/routes.ts` | `change-temp-password` exige `currentPassword` cuando la cuenta tiene `tempPassword`. | Cierra la toma de cuentas. Ambos clientes ya envían `currentPassword`. |

Verificación: `tsc --noEmit` = 0 errores. Revisado que ningún cliente dependía de
los campos/comportamientos eliminados.

---

## C. Problemas PENDIENTES (estructurales — requieren trabajo dedicado y pruebas)

Estos NO se aplicaron porque tocan dinero/identidad en una app en producción y
exigen decisiones de infraestructura o pruebas con Stripe/Firebase reales. Hacerlos
"a medias" es más peligroso que el estado actual.

1. **Modelo de auth verificado (críticos 1, 2, 4).** Sustituir la confianza en
   `x-user-info` por identidad verificada en servidor (Firebase Admin `verifyIdToken`
   o sesión firmada con `express-session` —ya instalado—). Luego añadir middleware
   `requireAuth`/`requireAdmin`/ownership a todos los endpoints sensibles. *Requiere
   credenciales de service account (Firebase Admin) o montar sesiones.*
2. **Webhook Stripe (críticos 5, 8).** Montar `express.raw` solo para
   `/api/stripe-webhook` antes del `json()` global; añadir idempotencia
   (`getMembershipPaymentByStripeId`/`event.id`); arreglar FKs `0`; manejar refunds,
   disputas e invoices/suscripciones.
3. **Registro seguro (críticos 6, altos 11, 12).** En `complete-registration`:
   `stripe.paymentIntents.retrieve()` y exigir `status==='succeeded'` + montos/metadata
   coincidentes; envolver las escrituras en `db.transaction()`; usar el monto real del
   PaymentIntent; evitar el doble insert de pago.
4. **Cobro por periodicidad (crítico 7).** `create-payment-intent` debe recibir y
   respetar la periodicidad elegida, y el frontend pasarla.
5. **`change-plan` (alto 16)** y **`autoRenewal` (alto 17):** no tocar la BD si Stripe
   falla; implementar renovación vía suscripciones + webhook.
6. **`useAuth` cleanup (alto 18)** y limpieza de código muerto/logs/CSP (medios/bajos).

---

## D. Casos de prueba ejecutados

- `tsc --noEmit`: 0 errores tras los cambios.
- `vite build`: OK previamente (sin romper el cliente).
- Backend vivo respondiendo 200 en endpoints de arranque.
- Verificación manual de que el backend lee `x-user-info` (petición con identidad de
  representante devuelve a ese usuario) — base del hallazgo de auth.
- Revisado que `AddUserModal` y el flujo admin de "mostrar contraseña temporal" NO
  dependen de los campos saneados (no se rompen).

Pendiente de prueba en vivo (requiere reinicio del servidor): `/api/users/me`,
saneo de `tempPassword`, rechazo de `change-temp-password` sin `currentPassword`.

---

## E. Riesgos restantes

- **Altísimo:** mientras el modelo de auth siga basado en `x-user-info`, cualquier
  control de rol es eludible. Los fixes de esta sesión reducen fugas y tomas de
  cuenta puntuales, pero NO cierran la escalada de privilegios global.
- **Alto:** el flujo de pago puede otorgar membresías sin pago confirmado y el
  webhook no registra pagos (firma). Riesgo de fraude y descuadre contable.

---

## F. Recomendaciones (orden sugerido)

1. Auth verificado en servidor + middleware de autorización (base de todo).
2. Webhook Stripe con raw body + idempotencia (arreglar el flujo de dinero).
3. `complete-registration` con verificación de pago + transacción.
4. Cobro por periodicidad correcto.
5. Limpieza: formato único de errores, validación de IDs, CSP en prod, logs sin PII,
   eliminar código muerto.
