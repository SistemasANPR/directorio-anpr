# Contexto del proyecto para IA (ANPR México – Directorio)

> Documento pensado para **pegarlo a ChatGPT** como contexto antes de pedir cambios.
> Describe qué es el proyecto, su arquitectura, modelo de datos, autenticación,
> pagos y funcionalidades. Al final hay consejos para escribir buenos prompts.

---

## 1. Qué es

Plataforma web tipo **directorio de empresas/proveedores de equipamiento urbano**
para el sector en México (ANPR México). Permite:

- Buscar empresas por categoría, etiquetas y **ubicación geográfica (mapa)**.
- Que cada empresa (representante) gestione su **perfil, proyectos, certificados,
  reseñas y su membresía/plan**.
- Cobrar **membresías de pago** (mensual/anual) con **Stripe**.
- Administración completa (admins) de usuarios, empresas, planes, contenidos,
  configuración visual del sitio, emails y reportes.

Hay **3 roles**: `admin`, `representante` (dueño de empresa) y `user`.

---

## 2. Stack técnico

- **Frontend:** React 18 + TypeScript, **Vite**, **Wouter** (routing),
  **TanStack Query** (estado servidor/caché), **React Hook Form + Zod**,
  **shadcn/ui** (Radix) + **Tailwind CSS**, Framer Motion.
- **Backend:** **Express.js** (Node) + TypeScript. API REST.
- **ORM/DB:** **Drizzle ORM** sobre **PostgreSQL**.
- **Auth:** **Firebase Authentication** (email/password + Google) y un sistema
  propio de “usuario temporal” (login con contraseña validada en backend).
- **Pagos:** **Stripe** (Payment Intents + webhook).
- **Mapas:** Google Maps + Leaflet.
- **Archivos:** **Cloudinary** (producción) o `/uploads` local (desarrollo).
- **Email:** **Nodemailer** (SMTP configurable desde la propia app).
- **Editor de texto:** TinyMCE / TipTap.

### Estructura de carpetas
```
client/    Frontend React (client/src/{pages,components,hooks,lib})
server/    Backend Express (index.ts, routes.ts, storage.ts, db.ts, email-service.ts, cloudinary.ts)
shared/    schema.ts  → tablas Drizzle + tipos + esquemas Zod (compartido front/back)
api/       index.ts   → entrypoint serverless para Vercel
migrations/ migraciones Drizzle
```
Archivos clave por tamaño/relevancia: `server/routes.ts` (~6.700 líneas, ~140
endpoints), `server/storage.ts` (capa de datos), `shared/schema.ts` (modelo),
`client/src/App.tsx` (rutas), `client/src/hooks/useAuth.tsx` (auth + impersonación).

---

## 3. Arranque y flujo de una petición

- `server/index.ts` levanta Express en el **puerto 5000** (sirve API **y** el
  cliente). En desarrollo usa Vite middleware; en producción sirve `dist/`.
- **Middleware de identidad:** en cada petición a `/api`, el backend lee el
  header **`x-user-info`** (un JSON con el usuario) y lo coloca en `req.user`.
- `server/routes.ts` define los endpoints; `server/storage.ts` ejecuta las
  consultas con Drizzle.
- **Lectura:** Componente → `useQuery` → `/api/...` → storage → PostgreSQL → caché → UI.
- **Escritura:** Formulario → `useMutation` → API → DB → invalida caché → refetch.

---

## 4. Autenticación e impersonación (IMPORTANTE)

Hay **dos mecanismos** que conviven:

1. **Firebase Auth** (email/password y Google). Tras loguear, el frontend busca
   el usuario en la BD por `firebaseUid` (`/api/users/firebase/:uid`); si no
   existe, lo crea.
2. **Usuario temporal** (`tempUser` en `localStorage`): cuentas creadas por admin
   o importadas de WordPress. Login por `/api/login-temp` (contraseña validada
   con **bcrypt** en backend), con flag `requirePasswordChange`.

**Cómo se autoriza:** el frontend manda en cada request el header `x-user-info`
con la identidad efectiva. El backend confía en ese header para `req.user`.

**Impersonación (admin “actúa como” una empresa):** centralizada en
`client/src/lib/impersonation.ts` + `useAuth.tsx`. Al impersonar, la empresa
seleccionada se convierte en la **identidad efectiva** de toda la app:
`isAdmin` pasa a `false`, el header `x-user-info` viaja como el representante, y
el estado persiste en `localStorage` hasta pulsar “Dejar de impersonar”.

⚠️ **Debilidad de seguridad conocida (pendiente):** como la autorización se basa
en el header `x-user-info` que envía el cliente, **es falsificable** (cualquiera
podría mandar `{"role":"admin"}`). El backend **no verifica** tokens de Firebase
(`firebase-admin` no está instalado) ni usa sesiones de servidor
(`express-session` está en dependencias pero **no montado**). Endurecer esto es
una tarea pendiente.

---

## 5. Modelo de datos (tablas principales, en `shared/schema.ts`)

- **users**: `firebaseUid`, `email`, `displayName`, `role` (`admin`/`representante`/`user`),
  `tempPassword`, `requirePasswordChange`, datos de Stripe (`stripeCustomerId`,
  `stripeSubscriptionId`), `autoRenewal`.
- **companies**: perfil de empresa: nombre, logo, portada, teléfonos, emails,
  `direccionFisica`, `ubicacionGeografica`, `representantesVentas` (array de IDs),
  galería, `categoriesIds`, `tagIds`, `certificateIds`, redes sociales, catálogo,
  videos, `membershipTypeId`, **campos de membresía** (`membershipPeriodicidad`
  mensual/anual, `formaPago`, `fechaInicioMembresia`, `fechaFinMembresia`),
  `userId` (dueño), `estado`.
- **membershipTypes** (planes): `nombrePlan`, `opcionesPrecios` (JSON:
  `[{periodicidad, costo}]`), `beneficios`, `visibilidad` (pública/privada),
  `stripePriceId`/`stripeProductId`, **límites**: `cantidadProductosAdmitidos`,
  `cantidadProyectosAdmitidos`, `cantidadFotosPorProyecto`, `masPopular`.
- **membershipPayments**: `userId`, `companyId`, `membershipTypeId`,
  `stripePaymentIntentId` (único), `amount`, `currency`, `status`.
- **projects**: proyectos del portafolio de la empresa (con `estadoModeracion`).
- **companyLocations**: múltiples ubicaciones por empresa (`lat`, `lng`, `address`,
  `isPrincipal`).
- **certificates**, **categories**, **tags**, **roles**, **opinions**
  (opiniones de empresa + testimonios de plataforma, con moderación
  `pendiente/aprobada/rechazada`).
- **Configuración:** `systemSettings`, `frontendConfiguration` (header/menú/footer/
  colores/CSS personalizables), `pdfSettings` (recibos PDF), `emailConfiguration`
  + `emailTemplates`, `stripeConfiguration` (llaves Stripe en BD),
  `integrationSettings` (WordPress/MemberPress).

---

## 6. Pagos con Stripe (flujo completo)

Stripe se inicializa con `STRIPE_SECRET_KEY` (variable de entorno); también existe
una tabla `stripeConfiguration` y página de admin para gestionar llaves
(test/live) y sincronizar productos.

### A) Pago de membresía para una empresa existente
1. Frontend pide `POST /api/create-payment-intent` con `{ membershipTypeId, companyId }`.
2. Backend calcula el **monto** desde `membershipType.opcionesPrecios` (busca la
   opción `anual`, o la primera) y crea un **PaymentIntent** en Stripe (monto en
   centavos, `currency: usd`) con metadata `{ membershipTypeId, companyId, userId,
   isNewMembership: "false" }`. Devuelve `clientSecret`.
3. El frontend confirma el pago con Stripe (Stripe Elements / `@stripe/react-stripe-js`).
4. Stripe llama al **webhook** `POST /api/stripe-webhook` (firma verificada con
   `STRIPE_WEBHOOK_SECRET`):
   - `payment_intent.succeeded` → crea registro en `membershipPayments` y
     **actualiza `membershipTypeId` de la empresa**.
   - `payment_intent.payment_failed` → marca el pago como `failed`.

### B) Registro nuevo + pago (público, página “Registrar Empresa”)
1. Usuario elige plan en `/planes` → flujo de checkout. Se crea PaymentIntent con
   `isNewMembership: "true"` (sin company aún).
2. Tras pagar, el frontend (con el usuario ya creado en Firebase) llama
   `POST /api/complete-registration` con `{ userData, companyData,
   membershipTypeId, selectedPeriod, paymentIntentId, firebaseUid }`.
3. Backend: valida que no exista el email, **crea el user** (`role: representante`,
   con el `firebaseUid` real), **crea la company** con fechas de membresía
   calculadas (`+30` o `+365` días según periodo), crea las **ubicaciones**,
   registra el **pago** y **asigna automáticamente el certificado** “Miembro
   Oficial ANPR México”. Suele enviar **email de bienvenida**.

### C) Cambio de plan
- `POST /api/companies/:id/change-plan` para cambiar la membresía de una empresa.

### D) Recibos
- `GET /api/companies/:id/payment-receipt` y `pdfSettings` generan **recibos PDF**
  con branding configurable (jsPDF).

### Límites por plan
- `GET /api/companies/:companyId/limits` calcula y devuelve los límites del plan
  (productos/proyectos/fotos) que el frontend muestra y el backend valida.

---

## 7. Integración WordPress / MemberPress

Bloque grande de endpoints (`/api/wordpress-*`, `/api/memberpress-*`,
`/api/peepso-*`) que sincronizan usuarios y **membresías** desde un WordPress
externo. Al asignar un representante de WordPress a una empresa, se traen las
**fechas de expiración de transacciones de MemberPress** y se actualizan las
fechas de membresía de la empresa. Config en `integrationSettings`.

---

## 8. Emails

`server/email-service.ts` con Nodemailer (SMTP configurable en
`emailConfiguration`). Plantillas en `emailTemplates` (bienvenida, renovación,
cancelación, notificación). Funciones: `sendWelcomeEmail`,
`sendCancellationEmail`, `sendActivationEmail`,
`checkAndSendExpirationNotifications` (avisos de expiración, vía
`/api/scheduled-tasks/expiration-notifications`).

---

## 9. Frontend: rutas y layouts (`client/src/App.tsx`)

- **PublicLayout** (nav + footer): `/`, `/directorio`, `/empresa/:id`, `/planes`,
  `/registro-y-pago`, checkout, login de representante.
- **AppLayout** (sidebar admin): `/dashboard`, `/empresas`, `/usuarios`,
  `/categorias`, `/membresias`, `/certificados`, `/reportes`, `/configuracion*`,
  etc. Protegidas con `<ProtectedRoute requireAdmin>`.
- **RepresentativeLayout**: `/representative-dashboard` (perfil, proyectos,
  certificados, reseña, plan, pagos del representante).

---

## 10. Despliegue

- **Desarrollo (Replit):** `npm run dev` → Express + Vite en puerto 5000.
- **Producción (Vercel):** `api/index.ts` como función serverless + frontend
  estático (`vite build` → `dist/`). Ver `VERCEL_DEPLOYMENT.md` y `vercel.json`.
- Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run check` (tsc),
  `npm run db:push` (Drizzle).

### Variables de entorno relevantes
`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`,
`VITE_FIREBASE_*` (config cliente de Firebase), SMTP (en BD).

---

## 11. Deuda técnica y problemas conocidos

1. **Seguridad de auth:** autorización por header `x-user-info` falsificable; sin
   verificación de token Firebase (no hay `firebase-admin`) ni sesiones de
   servidor montadas. **Riesgo de escalada de privilegios.**
2. **Bug de orden de rutas:** `GET /api/users/me` queda capturado por
   `GET /api/users/:id` (definida antes) → error 500. Mover `/me` antes de `/:id`.
3. **`/api/admin/create-user-with-company`** depende de `req.session.userId`, pero
   `express-session` no está montado → **siempre 401** (endpoint roto).
4. **Archivos duplicados/legacy:** múltiples variantes (`RepresentativeDashboard*`,
   `EditCompanyModal*`), `planes.tsx` vacío, scripts sueltos (`debug_membership.py`,
   `temp_helper_functions.js`). Conviene limpiar.
5. **`console.log` de depuración** en producción (middleware imprime cada request).
6. **CSP deshabilitado** explícitamente en `server/index.ts`.

---

## 12. Cómo escribir buenos prompts (para ChatGPT o Claude)

- **Da contexto y ubicación:** menciona el archivo y, si puedes, la función/línea
  (p. ej. “en `server/routes.ts`, endpoint `POST /api/create-payment-intent`”).
- **Sé específico con el objetivo y el criterio de éxito** (“que el monto se
  calcule según `selectedPeriod`, no siempre el anual”).
- **Indica el stack** (React + TanStack Query + Drizzle + Express) para que no
  proponga librerías ajenas.
- **Pide cambios acotados** (un endpoint o una página por vez) y di si quieres
  “solo el plan” antes de tocar código.
- **Menciona restricciones:** no romper el login, no cambiar el modelo de datos,
  mantener Drizzle, etc.
- **Para bugs:** describe el síntoma, los pasos para reproducir y qué esperabas.
- **Recuerda la debilidad de auth** si el cambio toca permisos/seguridad.

---

## 13. Bloque corto listo para pegar (resumen de 1 párrafo)

> App full-stack (monorepo) “Directorio ANPR México”: React 18 + TypeScript +
> Vite + TanStack Query + Wouter + shadcn/Tailwind en el frontend; Express +
> Drizzle ORM + PostgreSQL en el backend; auth con Firebase + login temporal por
> header `x-user-info`; pagos con Stripe (Payment Intents + webhook
> `/api/stripe-webhook`); archivos en Cloudinary; emails con Nodemailer;
> integración WordPress/MemberPress. Roles: admin, representante, user. Backend
> en `server/routes.ts` (~140 endpoints) y `server/storage.ts`; modelo en
> `shared/schema.ts`. Nota: la autorización por header es falsificable (deuda de
> seguridad pendiente).
