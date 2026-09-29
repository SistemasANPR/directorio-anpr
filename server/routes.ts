import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import {
  RepresentativeCompanyLimitError,
  RepresentativeCompanyRoleError,
  storage,
} from "./storage";
import { sendWelcomeEmail, sendCancellationEmail, sendRenewalEmail, checkAndSendExpirationNotifications, sendActivationEmail, sendNewReviewNotificationToAdmins } from "./email-service";
import multer from "multer";
import {
  IMAGE_MAX_BYTES,
  IMAGE_TOO_LARGE_MESSAGE,
  decodeDataUrl,
  decodeImageDataUrl,
  isDataUrl,
  isImageDataUrl,
  isImageBytes,
  isImageMimeType,
  isSupportedDocumentBytes,
} from "@shared/image-upload";
import path from "path";
import fs from "fs";
import * as nodeCrypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { insertUserSchema, insertCompanySchema, insertCategorySchema, insertTagSchema, insertMembershipTypeSchema, insertCertificateSchema, insertRoleSchema, insertOpinionSchema, insertMembershipPaymentSchema, insertProjectSchema, insertIntegrationSettingsSchema, insertPdfSettingsSchema, insertEmailConfigurationSchema, insertEmailTemplateSchema, insertFrontendConfigurationSchema, insertCompanyLocationSchema } from "@shared/schema";
import { z } from "zod";
import { uploadFromBuffer, deleteFile as deleteCloudinaryFile } from "./cloudinary";
import bcrypt from "bcrypt";
import {
  generateResetToken,
  hashToken,
  sendPasswordResetEmail,
  RESET_TOKEN_TTL_MINUTES,
} from "./password-reset-service";
import {
  updateFirebasePasswordByEmail,
  findFirebaseUserByEmail,
  deleteFirebaseUserByEmail,
  isFirebaseAdminAvailable,
  verifyFirebaseAdminConnection,
  getFirebaseAdminError,
  getFirebaseAdmin,
} from "./firebase-admin";
import { getStripe, getStripeContext, invalidateStripeCache, getOrCreateRecurringPrice, getInvoiceSubscriptionId, getInvoiceSubscriptionMetadata, getSubscriptionPeriodEnd, getSubscriptionPeriodStart } from "./stripe";
import {
  signAdminSession,
  verifyAdminSession,
  parseCookie,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
} from "./adminSession";
import {
  signWordPressSessionToken,
  verifyWordPressSessionToken,
  WP_SESSION_TTL_SECONDS,
  verifyWordPressJwt,
  isWordPressJwtConfigured,
} from "./services/wordpress";
import { generateSqlDump, buildDumpFilename } from "./services/db-export";
import {
  streamFullExport,
  buildPackageFilename,
  collectProjectFiles,
  resolveProjectRoot,
} from "./services/project-export";
import { pool } from "./db";

const BCRYPT_ROUNDS = 12;

// Elimina campos sensibles (contraseña temporal) antes de enviar un usuario al
// cliente. Nunca debe salir `tempPassword` (hash bcrypt o texto plano legacy).
function sanitizeUser<T extends Record<string, any> | null | undefined>(user: T): T {
  if (!user) return user;
  const { tempPassword, ...safe } = user as any;
  return safe as T;
}

// Permiso que, marcado en la pantalla de Roles, concede a un rol personalizado
// acceso completo al panel de administración (igual que el rol clásico "admin").
const ADMIN_DASHBOARD_PERMISSION = "admin.dashboard";

// Determina si un usuario es administrador. Además del rol clásico "admin"
// (o roleId 1), acepta cualquier rol personalizado que tenga marcado el permiso
// "Acceso al Dashboard de Administración". Los flags accesoAdmin/permisos los
// adjunta attachRoleInfo() a partir de la tabla `roles`.
function isAdminUser(user: any): boolean {
  if (!user) return false;
  if (user.role === "admin" || Number(user.roleId) === 1) return true;
  if (user.accesoAdmin === true) return true;
  const permisos = user.permisos;
  return Array.isArray(permisos) && permisos.includes(ADMIN_DASHBOARD_PERMISSION);
}

// Vincula el usuario (cuyo rol se guarda como TEXTO en users.role) con su rol de
// la tabla `roles` para adjuntar sus permisos y derivar el flag `accesoAdmin`.
// Es lo que permite que un rol personalizado (p. ej. "Administrador") habilite el
// dashboard sin depender del texto exacto "admin". El emparejamiento es por
// nombre, insensible a mayúsculas (users.role guarda el nombre en minúsculas).
async function attachRoleInfo<T extends Record<string, any> | null | undefined>(user: T): Promise<T> {
  if (!user) return user;
  try {
    const roleName = String((user as any).role ?? "").trim().toLowerCase();
    const allRoles = await storage.getAllRoles();
    const match = allRoles.find((r) => r.nombre.trim().toLowerCase() === roleName);
    const permisos = Array.isArray(match?.permisos) ? (match!.permisos as string[]) : [];
    const accesoAdmin = roleName === "admin" || permisos.includes(ADMIN_DASHBOARD_PERMISSION);
    return {
      ...(user as any),
      roleId: match?.id ?? (user as any).roleId,
      permisos,
      accesoAdmin,
    } as T;
  } catch {
    return user;
  }
}

// Monedas admitidas (coinciden con el selector del panel de administración).
const SUPPORTED_CURRENCIES = new Set([
  "usd", "eur", "mxn", "cop", "ars", "clp", "pen", "brl", "cad", "gbp", "jpy", "cny",
]);

// Devuelve la moneda configurada por el administrador (System Settings) en el
// formato que exige Stripe: código ISO en minúsculas (p.ej. "mxn", "usd").
// Se valida contra una lista permitida; si el valor es inválido o falta, usa
// "usd" como respaldo seguro para no provocar errores en Stripe.
async function getConfiguredCurrency(): Promise<string> {
  try {
    const settings = await storage.getSystemSettings();
    const cur = (settings as any)?.currency;
    const normalized = typeof cur === "string" ? cur.trim().toLowerCase() : "";
    return SUPPORTED_CURRENCIES.has(normalized) ? normalized : "usd";
  } catch {
    return "usd";
  }
}

// Normaliza un límite de plan: NULL/undefined/-1 significan "ilimitado" y se
// devuelven como -1. Cualquier otro número se devuelve tal cual. Se usa para
// recortar el contenido en el directorio público (nunca se borra nada).
function normalizePlanLimit(value: number | null | undefined): number {
  if (value === null || value === undefined || value === -1) return -1;
  if (!Number.isInteger(value) || value < -1) return 0;
  return value;
}

function isValidConfiguredProjectLimit(value: unknown): boolean {
  return value === null
    || value === undefined
    || (typeof value === "number" && Number.isInteger(value) && value >= -1);
}

function isRepresentativeRole(role: unknown): boolean {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return normalizedRole === "representante" || normalizedRole === "representative";
}

// Middleware: solo administradores pueden modificar la configuración de Stripe.
// Acepta dos formas de identidad: (1) un ID token de Firebase verificable, o
// (2) la identidad normal de la app (x-user-info), confirmando SIEMPRE el rol
// de administrador contra la base de datos (no se confía en el rol del cliente).
async function requireStripeAdmin(req: any, res: any, next: any) {
  try {
    // Modo 1: token de Firebase verificable (admins que entran por Firebase).
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const firebaseAdmin = getFirebaseAdmin();
      if (firebaseAdmin) {
        try {
          const decoded = await firebaseAdmin.auth().verifyIdToken(token);
          const fbUser = await storage.getUserByFirebaseUid(decoded.uid);
          if (fbUser && isAdminUser(await attachRoleInfo(fbUser))) {
            return next();
          }
        } catch {
          /* token inválido: se intenta con la identidad de la app abajo */
        }
      }
    }

    // Modo 2: cookie de sesión FIRMADA por el servidor, emitida al iniciar
    // sesión con contraseña válida (/api/login-temp). Prueba fuerte y verificable.
    const cookieToken = parseCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
    if (cookieToken) {
      const userId = verifyAdminSession(cookieToken);
      if (userId) {
        const dbUser = await storage.getUser(userId);
        if (dbUser && isAdminUser(await attachRoleInfo(dbUser))) {
          return next();
        }
      }
    }

    // Modo 3: identidad estándar de la app (header x-user-info). Es el MISMO
    // mecanismo con el que el resto del panel de administración autoriza sus
    // acciones (editar usuarios, empresas, etc.). Se refuerza confirmando el rol
    // 'admin' directamente en la base de datos: no se confía en el rol enviado
    // por el cliente, sino en el guardado en la BD para el id indicado.
    const claimed = req.user;
    if (claimed?.id) {
      const dbUser = await storage.getUser(Number(claimed.id));
      if (dbUser && isAdminUser(await attachRoleInfo(dbUser))) {
        return next();
      }
    }

    return res.status(401).json({ error: "Se requiere una cuenta de administrador para esta acción" });
  } catch (error) {
    console.error("Error verificando administrador para configuración de Stripe:", error);
    return res.status(401).json({ error: "No se pudo verificar la cuenta de administrador" });
  }
}

// Variante estricta para cambios de asociación/propiedad. A diferencia de la
// compatibilidad heredada de requireStripeAdmin, NO acepta x-user-info porque
// ese header puede ser construido por el navegador.
async function isStronglyVerifiedAdminRequest(req: any): Promise<boolean> {
  const authHeader = (req.headers["authorization"] as string) || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    const firebaseAdmin = getFirebaseAdmin();
    if (firebaseAdmin) {
      try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(token);
        const fbUser = await storage.getUserByFirebaseUid(decoded.uid);
        if (fbUser && isAdminUser(await attachRoleInfo(fbUser))) return true;
      } catch {
        // Token inválido: todavía puede existir una sesión temporal firmada.
      }
    }
  }

  const cookieToken = parseCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (cookieToken) {
    const userId = verifyAdminSession(cookieToken);
    if (userId) {
      const dbUser = await storage.getUser(userId);
      if (dbUser && isAdminUser(await attachRoleInfo(dbUser))) return true;
    }
  }

  return false;
}

// Resuelve la identidad real del solicitante desde una prueba criptográfica:
// Firebase, sesión WordPress firmada o cookie administrativa firmada. El header
// x-user-info queda únicamente como contexto visual y nunca autentica.
export async function getVerifiedRequestUser(req: any): Promise<any | null> {
  const authHeader = (req.headers["authorization"] as string) || "";
  const firebaseToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (firebaseToken) {
    const firebaseAdmin = getFirebaseAdmin();
    if (firebaseAdmin) {
      try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(firebaseToken);
        const dbUser = await storage.getUserByFirebaseUid(decoded.uid);
        if (dbUser) return attachRoleInfo(dbUser);
      } catch {
        // Se intenta con las sesiones firmadas restantes.
      }
    }
  }

  const wordpressToken = String(req.headers["x-wordpress-session"] || "");
  if (wordpressToken) {
    const payload = verifyWordPressSessionToken(wordpressToken, Date.now());
    if (payload) {
      const dbUser = await storage.getUserByEmail(payload.wpEmail);
      if (dbUser) {
        return {
          ...(await attachRoleInfo(dbUser)),
          companyId: payload.companyId,
          companyIds: payload.companyIds || [payload.companyId],
          source: "wordpress",
        };
      }
    }
  }

  const cookieToken = parseCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (cookieToken) {
    const userId = verifyAdminSession(cookieToken);
    if (userId) {
      const dbUser = await storage.getUser(userId);
      if (dbUser) return attachRoleInfo(dbUser);
    }
  }

  return null;
}

// Autorización de las herramientas del panel de administración (exportaciones).
//
// Es la MISMA puerta que usa el panel en el cliente: cualquier identidad válida
// cuyo rol sea administrador. La diferencia con el cliente es que aquí la
// identidad se resuelve con getVerifiedRequestUser, que solo acepta pruebas
// firmadas —Firebase, sesión de WordPress o cookie de administrador— y nunca el
// header x-user-info, que cualquiera puede fabricar desde el navegador.
//
// Devuelve el usuario verificado, o null si no hay identidad válida de admin.
export async function getAdminPanelUser(req: any): Promise<any | null> {
  const user = await getVerifiedRequestUser(req);
  if (!user) return null;
  return isAdminUser(user) ? user : null;
}

// Explica en el error POR QUÉ falló, para que un administrador legítimo sepa
// qué hacer en vez de recibir un 401 mudo.
function describeMissingAdminIdentity(req: any): string {
  const hasFirebase = String(req.headers["authorization"] || "").startsWith("Bearer ");
  const hasWordPress = Boolean(req.headers["x-wordpress-session"]);
  const hasCookie = Boolean(parseCookie(req.headers.cookie, ADMIN_SESSION_COOKIE));

  if (!hasFirebase && !hasWordPress && !hasCookie) {
    return "No se recibió ninguna sesión verificable. Vuelve a iniciar sesión en el panel e inténtalo de nuevo.";
  }
  return "Tu sesión es válida pero la cuenta no tiene rol de administrador, o la sesión expiró. Vuelve a iniciar sesión.";
}

// Configuración de multer - usa memoria para Cloudinary, disco para local
// Verificar que Cloudinary esté correctamente configurado (no solo que exista el nombre)
const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_CLOUD_NAME.length > 3 &&
  !process.env.CLOUDINARY_CLOUD_NAME.includes(' ')
);

// Usar Cloudinary cuando esté configurado para persistencia en producción
const useCloudinary = cloudinaryConfigured;
console.log(`Storage mode: ${useCloudinary ? 'Cloudinary' : 'Local disk storage'}`);

const imageStorage = multer.memoryStorage();

// Configuración de multer para documentos
const documentStorage = useCloudinary 
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'uploads', 'documents');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    });

const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: IMAGE_MAX_BYTES + 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

// Configuración específica para logotipos PDF
const pdfLogoStorage = multer.memoryStorage();

const uploadPdfLogo = multer({
  storage: pdfLogoStorage,
  limits: {
    fileSize: IMAGE_MAX_BYTES + 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PNG, JPG, JPEG y SVG'));
    }
  }
});

const uploadDocument = multer({
  // Keep the complete upload in memory so an image carried through this
  // mixed document endpoint can be rejected before Cloudinary/local storage.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB for documents
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF, Word o imágenes'));
    }
  }
});

// Configuración mixta para creación de empresas (imágenes + documentos)
const uploadCompanyFiles = multer({
  // Validate every company image in memory before persisting any member of
  // the multipart request. Catalog/doc files retain their larger limit.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    // Para catálogos: permitir PDF, Word e imágenes
    if (file.fieldname === 'catalogoFile') {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Para el catálogo solo se permiten archivos PDF, Word o imágenes'));
      }
    } 
    // Para logos, fotos de portada y galería: solo imágenes
    else if (['logoFile', 'fotoPortadaFile', 'galeriaFiles'].includes(file.fieldname)) {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error(`Para ${file.fieldname} solo se permiten archivos de imagen`));
      }
    }
    else {
      cb(new Error('Campo de archivo no reconocido'));
    }
  }
});

function rejectOversizedImage(res: express.Response): express.Response {
  return res.status(413).json({ error: IMAGE_TOO_LARGE_MESSAGE });
}

function validateUploadedImages(req: express.Request, res: express.Response, next: express.NextFunction): void | express.Response {
  const files = [
    ...(req.file ? [req.file] : []),
    ...(Array.isArray(req.files) ? req.files : Object.values((req.files || {}) as Record<string, Express.Multer.File[]>).flat()),
  ];
  if (files.some((file) => file.size > IMAGE_MAX_BYTES || (file.buffer && file.buffer.byteLength > IMAGE_MAX_BYTES))) {
    for (const file of files) {
      if (file.path) fs.unlink(file.path, () => undefined);
    }
    return rejectOversizedImage(res);
  }
  for (const file of files) {
    const directory = req.path.includes("/pdf-settings/") ? "pdf-logos"
      : req.path.includes("/system-settings/") ? (req.body.type === "favicon" ? "system-favicons" : "system-logos")
      : "images";
    const destination = path.join(process.cwd(), "uploads", directory);
    fs.mkdirSync(destination, { recursive: true });
    const filename = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
    file.path = path.join(destination, filename);
    file.destination = destination;
    file.filename = filename;
    fs.writeFileSync(file.path, file.buffer);
  }
  next();
}

function requestHasOversizedDataUrlImage(body: unknown): boolean {
  if (typeof body === "string") {
    if (isDataUrl(body)) {
      const declaredAsImage = isImageDataUrl(body);
      const bytes = decodeDataUrl(body);
      if (bytes === null) return true;
      if (isImageBytes(bytes)) return bytes.byteLength > IMAGE_MAX_BYTES;
      return declaredAsImage;
    }
    const trimmed = body.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.startsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed !== body && requestHasOversizedDataUrlImage(parsed);
      } catch {
        return false;
      }
    }
    return false;
  }
  if (Array.isArray(body)) return body.some(requestHasOversizedDataUrlImage);
  if (body && typeof body === "object") return Object.values(body).some(requestHasOversizedDataUrlImage);
  return false;
}

async function readImageResponseWithinLimit(response: globalThis.Response): Promise<Buffer> {
  if (!response.body) throw new Error("Avatar response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > IMAGE_MAX_BYTES) {
      await reader.cancel();
      throw new Error("WordPress avatar exceeds 2 MiB");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function validateAndPersistCompanyFiles(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void | express.Response {
  const groupedFiles = (req.files || {}) as { [fieldname: string]: Express.Multer.File[] };
  const files = Object.values(groupedFiles).flat();
  const imageFields = new Set(['logoFile', 'fotoPortadaFile', 'galeriaFiles']);
  const persistedPaths: string[] = [];

  if (files.some((file) =>
    (imageFields.has(file.fieldname) ||
      isImageBytes(file.buffer) ||
      !isSupportedDocumentBytes(file.buffer)) &&
    file.buffer.byteLength > IMAGE_MAX_BYTES
  )) {
    return rejectOversizedImage(res);
  }

  try {
    // Existing company handlers expect disk paths. Persist only after all
    // files have passed validation, so a bad gallery member writes nothing.
    for (const file of files) {
      const directory = file.fieldname === 'catalogoFile' ? 'documents' : 'images';
      const uploadPath = path.join(process.cwd(), 'uploads', directory);
      fs.mkdirSync(uploadPath, { recursive: true });
      const filename = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
      const filePath = path.join(uploadPath, filename);
      fs.writeFileSync(filePath, file.buffer);
      persistedPaths.push(filePath);
      file.filename = filename;
      file.path = filePath;
      file.destination = uploadPath;
    }
    next();
  } catch (error) {
    // A failed write must not leave earlier members of this multipart request.
    // (Files only become visible after the whole batch has validated.)
    try {
      persistedPaths.forEach((filePath) => fs.unlinkSync(filePath));
    } catch { /* best-effort rollback */ }
    next(error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // JSON mutations can carry inline images without touching Multer. Enforce the
  // same authoritative rule before any route can persist them.
  app.use((req, res, next) => {
    if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
    next();
  });

  // Servir archivos estáticos desde la carpeta uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  
  // Servir archivos estáticos desde la carpeta attached_assets
  app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets')));

  // Ruta para subir una sola imagen
  app.post("/api/upload-image", uploadImage.single('image'), validateUploadedImages, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No se recibió ningún archivo" });
      }
      
      let imageUrl: string;
      if (useCloudinary && req.file.buffer) {
        const result = await uploadFromBuffer(req.file.buffer, 'anpr/images', 'image');
        imageUrl = result.url;
        console.log("Image upload to Cloudinary successful:", imageUrl);
      } else {
        imageUrl = `/uploads/images/${req.file.filename}`;
        console.log("Image upload to local storage successful:", imageUrl);
      }
      
      res.json({ 
        success: true, 
        imageUrl,
        filename: req.file.filename || path.basename(imageUrl)
      });
    } catch (error) {
      console.error("Error al subir imagen:", error);
      res.status(500).json({ error: "Error al procesar la imagen" });
    }
  });

  // Ruta para subir múltiples imágenes
  app.post("/api/upload-images", uploadImage.array('images', 10), validateUploadedImages, async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: "No se recibieron archivos" });
      }
      
      const imageUrls = await Promise.all(req.files.map(async (file) => {
        if (useCloudinary && file.buffer) {
          const result = await uploadFromBuffer(file.buffer, 'anpr/images', 'image');
          return { imageUrl: result.url, filename: path.basename(result.url) };
        } else {
          return { imageUrl: `/uploads/images/${file.filename}`, filename: file.filename };
        }
      }));
      
      console.log(`Multiple images upload successful (${useCloudinary ? 'Cloudinary' : 'local'}):`, imageUrls.length, "files");
      res.json({ 
        success: true, 
        images: imageUrls
      });
    } catch (error) {
      console.error("Error al subir imágenes:", error);
      res.status(500).json({ error: "Error al procesar las imágenes" });
    }
  });

  // Ruta para subir documentos PDF
  app.post("/api/upload-document", uploadDocument.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No se recibió ningún archivo" });
      }
      if (req.file.buffer.byteLength > IMAGE_MAX_BYTES &&
        (isImageBytes(req.file.buffer) || !isSupportedDocumentBytes(req.file.buffer))) {
        return rejectOversizedImage(res);
      }
      
      let documentUrl: string;
      if (useCloudinary && req.file.buffer) {
        const result = await uploadFromBuffer(req.file.buffer, 'anpr/documents', 'raw');
        documentUrl = result.url;
        console.log("Document upload to Cloudinary successful:", documentUrl);
      } else {
        const filename = `${uuidv4()}_${Date.now()}${path.extname(req.file.originalname)}`;
        const uploadPath = path.join(process.cwd(), 'uploads', 'documents');
        fs.mkdirSync(uploadPath, { recursive: true });
        fs.writeFileSync(path.join(uploadPath, filename), req.file.buffer);
        req.file.filename = filename;
        documentUrl = `/uploads/documents/${filename}`;
        console.log("Document upload to local storage successful:", documentUrl);
      }
      
      res.json({ 
        success: true, 
        documentUrl,
        filename: req.file.filename || path.basename(documentUrl)
      });
    } catch (error) {
      console.error("Error al subir documento:", error);
      res.status(500).json({ error: "Error al procesar el documento" });
    }
  });

  // Ruta para subir imagen de perfil (usado por configuración de cuenta)
  app.post("/api/upload", uploadImage.single('file'), validateUploadedImages, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No se recibió ningún archivo" });
      }
      
      let imageUrl: string;
      if (useCloudinary && req.file.buffer) {
        const result = await uploadFromBuffer(req.file.buffer, 'anpr/profiles', 'image');
        imageUrl = result.url;
        console.log("Profile image upload to Cloudinary successful:", imageUrl);
      } else {
        imageUrl = `/uploads/images/${req.file.filename}`;
        console.log("Profile image upload to local storage successful:", imageUrl);
      }
      
      res.json({ 
        success: true, 
        url: imageUrl,
        filename: req.file.filename || path.basename(imageUrl)
      });
    } catch (error: any) {
      console.error("Error al subir imagen de perfil:", error);
      res.status(500).json({ error: "Error al procesar la imagen de perfil" });
    }
  });

  // Ruta para eliminar imagen - Almacenamiento local
  app.delete("/api/delete-image/:filename", async (req, res) => {
    try {
      const { filename } = req.params;
      
      // Eliminación de archivo local
      const filePath = path.join(process.cwd(), 'uploads', 'images', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("Image deleted:", filePath);
        res.json({ success: true, message: "Imagen eliminada correctamente" });
      } else {
        res.status(404).json({ error: "Imagen no encontrada" });
      }
    } catch (error) {
      console.error("Error al eliminar imagen:", error);
      res.status(500).json({ error: "Error al eliminar la imagen" });
    }
  });

  // Users API
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(sanitizeUser));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res, next) => {
    // "/api/users/me" debe ser atendido por su handler dedicado (definido más
    // abajo). Sin esto, ":id" lo captura y parseInt("me")=NaN rompe la consulta.
    if (req.params.id === "me") return next();
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(await attachRoleInfo(sanitizeUser(user)));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/users/firebase/:uid", async (req, res) => {
    try {
      const user = await storage.getUserByFirebaseUid(req.params.uid);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(await attachRoleInfo(sanitizeUser(user)));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      if (isRepresentativeRole(userData.role)) {
        return res.status(409).json({
          error: "Un representante debe crearse con una empresa inicial",
          code: "REPRESENTATIVE_COMPANY_REQUIRED",
        });
      }
      const user = await storage.createUser(userData);
      res.status(201).json(sanitizeUser(user));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(401).json({ error: "Se requiere una cuenta de administrador verificada" });
      }

      const id = parseInt(req.params.id);
      
      // Extract companyId if present in request body
      const { companyId, ...userData } = req.body;
      
      // Validate the user data (excluding companyId since it's not in the user schema)
      const validatedUserData = insertUserSchema.partial().parse(userData);
      
      // Get current user to determine effective role
      const currentUser = await storage.getUser(id);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Use role from request data or fall back to current user role
      const effectiveRole = validatedUserData.role || currentUser.role;
      
      let parsedCompanyId: number | undefined;
      if (companyId !== undefined && companyId) {
        parsedCompanyId = Number(companyId);
        if (!Number.isInteger(parsedCompanyId) || parsedCompanyId <= 0) {
          return res.status(400).json({ error: "Invalid company ID format" });
        }
      }

      // El rol y sus asociaciones cambian en una sola transacción. Para
      // representantes, companyId solo agrega y nunca reemplaza.
      const user = await storage.updateUserAndRepresentativeCompanies(
        id,
        validatedUserData,
        isRepresentativeRole(effectiveRole) ? parsedCompanyId : undefined,
      );
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(sanitizeUser(user));
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error?.code === "REPRESENTATIVE_COMPANY_LIMIT") {
        return res.status(409).json({
          error: "Este representante ya tiene el máximo de 3 empresas asignadas",
          code: error.code,
          maxCompanies: 3,
        });
      }
      if (error?.code === "REPRESENTATIVE_COMPANY_NOT_FOUND") {
        return res.status(404).json({ error: error.message, code: error.code });
      }
      if (error?.code === "USER_NOT_REPRESENTATIVE") {
        return res.status(409).json({ error: error.message, code: error.code });
      }
      if (error?.code === "REPRESENTATIVE_COMPANY_REQUIRED") {
        return res.status(409).json({
          error: "Debes asignar una empresa al convertir al usuario en representante",
          code: error.code,
        });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.get("/api/admin/representative-company-associations", async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(401).json({ error: "Se requiere una cuenta de administrador verificada" });
      }

      const assignments = await storage.listAllRepresentativeCompanyAssignments();
      return res.json({ assignments });
    } catch (error) {
      console.error("Error listing representative company associations:", error);
      return res.status(500).json({ error: "No se pudieron obtener las asociaciones" });
    }
  });

  app.get("/api/admin/users/:userId/companies", async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(401).json({ error: "Se requiere una cuenta de administrador verificada" });
      }

      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: "ID de usuario inválido" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ error: "Usuario no encontrado" });
      if (!isRepresentativeRole(targetUser.role)) {
        return res.status(409).json({
          error: "El usuario debe tener rol de representante para administrar empresas",
          code: "USER_NOT_REPRESENTATIVE",
        });
      }

      const companies = await storage.getCompaniesForRepresentative(
        targetUser.email,
        targetUser.id,
      );
      return res.json({ userId, companies, count: companies.length, maxCompanies: 3 });
    } catch (error) {
      console.error("Error listing representative companies:", error);
      return res.status(500).json({ error: "No se pudieron obtener las empresas del representante" });
    }
  });

  app.post("/api/admin/users/:userId/companies", async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(401).json({ error: "Se requiere una cuenta de administrador verificada" });
      }

      const userId = Number(req.params.userId);
      const companyId = Number(req.body?.companyId);
      if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(companyId) || companyId <= 0) {
        return res.status(400).json({ error: "Usuario o empresa inválidos" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ error: "Usuario no encontrado" });
      if (!isRepresentativeRole(targetUser.role)) {
        return res.status(409).json({
          error: "El usuario debe tener rol de representante para asignar empresas",
          code: "USER_NOT_REPRESENTATIVE",
        });
      }

      const result = await storage.addRepresentativeCompany(companyId, userId);
      return res.status(result.status === "added" ? 201 : 200).json({
        ...result,
        count: result.companies.length,
        maxCompanies: 3,
      });
    } catch (error: any) {
      if (error?.code === "REPRESENTATIVE_COMPANY_LIMIT") {
        return res.status(409).json({
          error: "Este representante ya tiene el máximo de 3 empresas asignadas",
          code: error.code,
          maxCompanies: 3,
        });
      }
      if (error?.code === "REPRESENTATIVE_COMPANY_NOT_FOUND") {
        return res.status(404).json({ error: error.message, code: error.code });
      }
      if (error?.code === "USER_NOT_REPRESENTATIVE") {
        return res.status(409).json({ error: error.message, code: error.code });
      }
      console.error("Error assigning representative company:", error);
      return res.status(500).json({ error: "No se pudo asignar la empresa" });
    }
  });

  app.delete("/api/admin/users/:userId/companies/:companyId", async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(401).json({ error: "Se requiere una cuenta de administrador verificada" });
      }

      const userId = Number(req.params.userId);
      const companyId = Number(req.params.companyId);
      if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(companyId) || companyId <= 0) {
        return res.status(400).json({ error: "Usuario o empresa inválidos" });
      }

      const targetUser = await storage.getUser(userId);
      if (!targetUser) return res.status(404).json({ error: "Usuario no encontrado" });
      if (!isRepresentativeRole(targetUser.role)) {
        return res.status(409).json({
          error: "El usuario debe tener rol de representante para retirar empresas",
          code: "USER_NOT_REPRESENTATIVE",
        });
      }

      const result = await storage.removeRepresentativeCompany(companyId, userId);
      return res.json({
        ...result,
        count: result.companies.length,
        maxCompanies: 3,
      });
    } catch (error) {
      if ((error as any)?.code === "REPRESENTATIVE_COMPANY_LAST_ASSOCIATION") {
        return res.status(409).json({
          error: "Un representante debe conservar al menos una empresa. Para retirar la última, cambia primero su rol.",
          code: (error as any).code,
        });
      }
      console.error("Error removing representative company:", error);
      return res.status(500).json({ error: "No se pudo retirar la empresa" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(401).json({ error: "Se requiere una cuenta de administrador verificada" });
      }

      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "ID de usuario inválido" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // 1) Eliminar primero de Firebase Authentication (el "portero" del login).
      //    Es idempotente: si el email no existe en Firebase, no es error.
      //    Si Firebase no está operativo (excepción o Admin no disponible),
      //    abortamos ANTES de tocar la BD: así no se elimina nada y no se deja
      //    una cuenta que aún podría iniciar sesión en el proveedor.
      let firebaseDeleted = false;
      if (user.email) {
        try {
          const fb = await deleteFirebaseUserByEmail(user.email);
          if (fb.error) {
            // Firebase Admin no está disponible/configurado: bloqueamos.
            console.error("Firebase Admin no disponible al eliminar usuario:", fb.error);
            return res.status(502).json({
              error:
                "El proveedor de autenticación (Firebase) no está disponible, por lo que no se puede eliminar la cuenta de forma segura. No se eliminó nada; inténtalo más tarde.",
            });
          }
          firebaseDeleted = fb.found;
        } catch (fbError) {
          console.error("Error eliminando de Firebase Authentication:", fbError);
          return res.status(502).json({
            error:
              "No se pudo eliminar la cuenta del proveedor de autenticación (Firebase). No se eliminó nada; inténtalo de nuevo.",
          });
        }
      }

      // 2) Eliminar de la base de datos de forma atómica (transacción):
      //    desvincula empresas (sin borrarlas), limpia representantesVentas y
      //    borra el usuario (opiniones y pagos se eliminan por CASCADE).
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json({
        success: true,
        firebaseDeleted,
        message: "Cuenta eliminada correctamente.",
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "No se pudo eliminar el usuario" });
    }
  });

  // Current user API endpoints
  app.get("/api/users/me", async (req: any, res) => {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(currentUser.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/me", async (req: any, res) => {
    try {
      const currentUser = req.user;
      if (!currentUser) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Validate the update data (only allow certain fields to be updated)
      const updateSchema = z.object({
        displayName: z.string().min(1).max(100).optional(),
        photoURL: z.string().refine(
          (val) => val === "" || val.startsWith("/") || z.string().url().safeParse(val).success,
          { message: "photoURL must be a valid URL or a relative path starting with /" }
        ).optional().or(z.literal("")),
        email: z.string().email().optional(),
      }).partial();
      
      const validatedData = updateSchema.parse(req.body);
      
      const user = await storage.updateUser(currentUser.id, validatedData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating current user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Companies API
  app.get("/api/companies", async (req, res) => {
    try {
      const { search, categoryId, membershipTypeId, estado, page = "1", limit = "10", premiumOnly } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      console.log("Fetching companies with params:", { search, categoryId, membershipTypeId, estado, pageNum, limitNum, offset, premiumOnly });

      // If premiumOnly is true, we need to filter for premium and enterprise memberships
      let effectiveMembershipTypeId = membershipTypeId ? parseInt(membershipTypeId as string) : undefined;
      
      if (premiumOnly === 'true') {
        // Get all membership types to find premium and enterprise IDs
        const membershipTypes = await storage.getAllMembershipTypes();
        const premiumTypes = membershipTypes.filter(mt => 
          mt.nombrePlan?.toLowerCase().includes('premium') || 
          mt.nombrePlan?.toLowerCase().includes('empresarial') ||
          mt.nombrePlan?.toLowerCase().includes('enterprise')
        );
        
        if (premiumTypes.length > 0) {
          // For now, we'll need to handle multiple membership types in the storage layer
          // or make multiple queries. Let's modify the approach.
          const allResults = await Promise.all(
            premiumTypes.map(pt => storage.getAllCompanies({
              search: search as string,
              categoryId: categoryId ? parseInt(categoryId as string) : undefined,
              membershipTypeId: pt.id,
              estado: estado as string,
              limit: 1000, // Get all for filtering
              offset: 0
            }))
          );
          
          // Combine and deduplicate results
          const allCompanies = allResults.reduce((acc, result) => {
            result.companies.forEach(company => {
              if (!acc.find(c => c.id === company.id)) {
                acc.push(company);
              }
            });
            return acc;
          }, []);
          
          // Apply pagination to combined results
          const total = allCompanies.length;
          const paginatedCompanies = allCompanies.slice(offset, offset + limitNum);
          
          return res.json({
            companies: paginatedCompanies,
            total: total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum)
          });
        }
      }

      const result = await storage.getAllCompanies({
        search: search as string,
        categoryId: categoryId ? parseInt(categoryId as string) : undefined,
        membershipTypeId: effectiveMembershipTypeId,
        estado: estado as string,
        limit: limitNum,
        offset
      });

      console.log("Companies result:", result);

      res.json({
        companies: result.companies,
        total: result.total,
        page: pageNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ error: "Failed to fetch companies", details: error.message });
    }
  });

  // Admin route to get all companies including inactive ones
  app.get("/api/admin/companies", async (req, res) => {
    try {
      const { search, categoryId, membershipTypeId, estado, page = "1", limit = "10" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      // For admin route, we don't filter by default - show all companies
      const result = await storage.getAllCompanies({
        search: search as string,
        categoryId: categoryId ? parseInt(categoryId as string) : undefined,
        membershipTypeId: membershipTypeId ? parseInt(membershipTypeId as string) : undefined,
        estado: estado as string, // This will include inactive if specified
        limit: limitNum,
        offset,
        includeInactive: true // Add this flag to the storage method
      });

      res.json({
        companies: result.companies,
        total: result.total,
        page: pageNum,
        totalPages: Math.ceil(result.total / limitNum)
      });
    } catch (error) {
      console.error("Error fetching admin companies:", error);
      res.status(500).json({ error: "Failed to fetch companies", details: error.message });
    }
  });

  app.get("/api/companies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Directorio PÚBLICO (solo cuando ?view=public): recortar la galería de
      // productos al límite del plan ACTIVO sin borrar datos. El excedente solo se
      // oculta y reaparece si el plan vuelve a permitirlo. Los flujos privados
      // (dashboard/administración) NO pasan ese parámetro y siguen viendo todo.
      if (req.query.view === "public") {
        const membershipType = company.membershipTypeId
          ? await storage.getMembershipType(company.membershipTypeId)
          : null;
        const productLimit = normalizePlanLimit(membershipType?.cantidadProductosAdmitidos as any);
        if (productLimit >= 0 && Array.isArray(company.galeriaProductosUrls)) {
          (company as any).galeriaProductosUrls = company.galeriaProductosUrls.slice(0, productLimit);
        }
      }

      res.json(company);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch company" });
    }
  });

  app.get("/api/companies/user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const companies = await storage.getCompaniesByUser(userId);
      res.json(companies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user companies" });
    }
  });

  app.get("/api/companies/by-user/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const companies = await storage.getCompaniesByUser(userId);
      if (companies.length === 0) {
        return res.status(404).json({ error: "No company found for this user" });
      }
      res.json(companies[0]); // Return the first company associated with the user
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user company" });
    }
  });

  // Helper function to get user transactions from WordPress/MemberPress
  async function getUserTransactions(wordpressUserId: string, includeAll: boolean = false): Promise<any[]> {
    try {
      // First try environment variables, then fall back to database settings
      let wordpressUrl = process.env.WORDPRESS_URL;
      let apiKey = process.env.WORDPRESS_USERNAME;
      let apiSecret = process.env.WORDPRESS_APP_PASSWORD;

      // If env vars not set, try database settings
      if (!wordpressUrl || !apiKey || !apiSecret) {
        const settings = await storage.getIntegrationSettings();
        if (settings) {
          wordpressUrl = wordpressUrl || settings.wordpressUrl || undefined;
          apiKey = apiKey || settings.apiKey || undefined;
          apiSecret = apiSecret || settings.apiSecret || undefined;
        }
      }

      if (!wordpressUrl || !apiKey || !apiSecret) {
        console.log('[User Transactions] No WordPress configuration found');
        return [];
      }

      const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const baseUrl = wordpressUrl.replace(/\/$/, '');

      // Obtener transacciones del usuario desde MemberPress
      const transactionsResponse = await fetch(`${baseUrl}/wp-json/mp/v1/transactions?member=${wordpressUserId}&per_page=100`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (!transactionsResponse.ok) {
        console.log(`[User Transactions] Failed to get transactions for user ${wordpressUserId}: ${transactionsResponse.status}`);
        return [];
      }

      const transactions = await transactionsResponse.json();
      
      if (!Array.isArray(transactions)) {
        console.log(`[User Transactions] Invalid response format for user ${wordpressUserId}`);
        return [];
      }

      console.log(`[User Transactions] Raw transactions count for user ${wordpressUserId}: ${transactions.length}`);
      
      // Log all transaction statuses found for debugging
      const statuses = [...new Set(transactions.map((t: any) => t.status))];
      console.log(`[User Transactions] Statuses found: ${statuses.join(', ')}`);

      // Filtrar transacciones - incluir más estados válidos
      // Estados válidos: complete, confirmed, pending (para mostrar), active
      const validStatuses = includeAll 
        ? ['complete', 'confirmed', 'pending', 'active', 'refunded', 'failed']
        : ['complete', 'confirmed', 'active'];
      
      const validTransactions = transactions
        .filter((t: any) => validStatuses.includes(t.status))
        .sort((a: any, b: any) => {
          // Ordenar por fecha de vencimiento primero (más reciente primero)
          if (a.expires_at && b.expires_at) {
            return new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime();
          }
          // Si no hay expires_at, ordenar por created_at
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      console.log(`[User Transactions] Found ${validTransactions.length} valid transactions for user ${wordpressUserId}`);
      
      // Log details of first transaction for debugging
      if (validTransactions.length > 0) {
        const first = validTransactions[0];
        console.log(`[User Transactions] Most recent transaction: ID=${first.id}, Status=${first.status}, Gateway=${first.gateway}, Expires=${first.expires_at}`);
      }
      
      return validTransactions;

    } catch (error: any) {
      console.error(`[User Transactions] Error getting transactions for user ${wordpressUserId}:`, error.message);
      return [];
    }
  }

  // Helper function to get transaction expiration date from WordPress/MemberPress
  async function getTransactionExpirationDate(wordpressUserId: string): Promise<string | null> {
    try {
      // First try environment variables, then fall back to database settings
      let wordpressUrl = process.env.WORDPRESS_URL;
      let apiKey = process.env.WORDPRESS_USERNAME;
      let apiSecret = process.env.WORDPRESS_APP_PASSWORD;

      // If env vars not set, try database settings
      if (!wordpressUrl || !apiKey || !apiSecret) {
        const settings = await storage.getIntegrationSettings();
        if (settings) {
          wordpressUrl = wordpressUrl || settings.wordpressUrl || undefined;
          apiKey = apiKey || settings.apiKey || undefined;
          apiSecret = apiSecret || settings.apiSecret || undefined;
        }
      }

      if (!wordpressUrl || !apiKey || !apiSecret) {
        console.log('[Transaction Expiration] No WordPress configuration found');
        return null;
      }

      const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const baseUrl = wordpressUrl.replace(/\/$/, '');

      // Obtener transacciones del usuario desde MemberPress
      const transactionsResponse = await fetch(`${baseUrl}/wp-json/mp/v1/transactions?member=${wordpressUserId}`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (!transactionsResponse.ok) {
        console.log(`[Transaction Expiration] Failed to get transactions for user ${wordpressUserId}`);
        return null;
      }

      const transactions = await transactionsResponse.json();
      
      if (!Array.isArray(transactions) || transactions.length === 0) {
        console.log(`[Transaction Expiration] No transactions found for user ${wordpressUserId}`);
        return null;
      }

      // Buscar transacciones exitosas con fechas de vencimiento
      const successfulTransactions = transactions
        .filter((t: any) => t.status === 'complete' || t.status === 'confirmed')
        .filter((t: any) => t.expires_at)
        .sort((a: any, b: any) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime());

      if (successfulTransactions.length > 0) {
        const latestExpirationDate = successfulTransactions[0].expires_at;
        console.log(`[Transaction Expiration] Found expiration date for user ${wordpressUserId}: ${latestExpirationDate}`);
        return latestExpirationDate;
      }

      console.log(`[Transaction Expiration] No valid expiration dates found for user ${wordpressUserId}`);
      return null;

    } catch (error: any) {
      console.error(`[Transaction Expiration] Error getting expiration date for user ${wordpressUserId}:`, error.message);
      return null;
    }
  }

  // Nueva ruta POST para crear empresas con archivos
  app.post("/api/companies/with-files", uploadCompanyFiles.fields([
    { name: 'logoFile', maxCount: 1 },
    { name: 'fotoPortadaFile', maxCount: 1 },
    { name: 'catalogoFile', maxCount: 1 },
    { name: 'galeriaFiles', maxCount: 20 }
  ]), (req, res, next) => {
    if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
    next();
  }, validateAndPersistCompanyFiles, async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(403).json({
          error: "Solo un administrador puede crear empresas",
        });
      }

      // TODO: Restaurar validación de administrador una vez que se arregle el header
      // console.log("Debug - req.user:", JSON.stringify(req.user, null, 2));
      // const isAdmin = req.user?.role === 'admin' || req.user?.roleId === 1;
      // console.log("Debug - isAdmin check:", isAdmin, "role:", req.user?.role, "roleId:", req.user?.roleId);
      // if (!isAdmin) {
      //   return res.status(403).json({ 
      //     error: "Acceso denegado", 
      //     message: "Solo los administradores pueden crear empresas" 
      //   });
      // }
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      // Procesar los datos del formulario
      let companyData: any = {};
      
      // Procesar campos normales del formulario
      for (const [key, value] of Object.entries(req.body)) {
        if (key !== 'logoFile' && key !== 'fotoPortadaFile' && key !== 'catalogoFile' && key !== 'galeriaFiles') {
          try {
            // Intentar parsear como JSON para arrays y objetos
            companyData[key] = JSON.parse(value as string);
            // DEBUG: Log ubicacionGeografica parsing specifically
            if (key === 'ubicacionGeografica') {
              console.log('[DEBUG] Server - ubicacionGeografica received:', {
                rawValue: value,
                parsedValue: companyData[key],
                type: typeof companyData[key]
              });
            }
          } catch {
            // Si no es JSON válido, usar como string
            companyData[key] = value;
            // DEBUG: Log failed JSON parsing for ubicacionGeografica
            if (key === 'ubicacionGeografica') {
              console.log('[DEBUG] Server - ubicacionGeografica JSON parse failed:', {
                rawValue: value,
                fallbackValue: companyData[key],
                type: typeof companyData[key]
              });
            }
          }
        }
      }
      
      // Procesar archivos de logo
      if (files?.logoFile?.[0]) {
        if (useCloudinary) {
          const fileBuffer = fs.readFileSync(files.logoFile[0].path);
          const result = await uploadFromBuffer(fileBuffer, 'anpr/logos', 'image');
          companyData.logotipoUrl = result.url;
          fs.unlinkSync(files.logoFile[0].path); // Eliminar archivo local después de subir
        } else {
          companyData.logotipoUrl = `/uploads/images/${files.logoFile[0].filename}`;
        }
      }
      
      // Procesar archivos de foto de portada
      if (files?.fotoPortadaFile?.[0]) {
        if (useCloudinary) {
          const fileBuffer = fs.readFileSync(files.fotoPortadaFile[0].path);
          const result = await uploadFromBuffer(fileBuffer, 'anpr/portadas', 'image');
          companyData.fotoPortadaUrl = result.url;
          fs.unlinkSync(files.fotoPortadaFile[0].path);
        } else {
          companyData.fotoPortadaUrl = `/uploads/images/${files.fotoPortadaFile[0].filename}`;
        }
      }
      
      // Procesar archivos de catálogo
      if (files?.catalogoFile?.[0]) {
        if (useCloudinary) {
          const fileBuffer = fs.readFileSync(files.catalogoFile[0].path);
          const result = await uploadFromBuffer(fileBuffer, 'anpr/catalogos', 'raw');
          companyData.catalogoDigitalUrl = result.url;
          fs.unlinkSync(files.catalogoFile[0].path);
        } else {
          companyData.catalogoDigitalUrl = `/uploads/documents/${files.catalogoFile[0].filename}`;
        }
      }
      
      // Procesar archivos de galería
      if (files?.galeriaFiles?.length > 0) {
        if (useCloudinary) {
          const uploadPromises = files.galeriaFiles.map(async (file) => {
            const fileBuffer = fs.readFileSync(file.path);
            const result = await uploadFromBuffer(fileBuffer, 'anpr/galeria', 'image');
            fs.unlinkSync(file.path);
            return result.url;
          });
          companyData.galeriaProductosUrls = await Promise.all(uploadPromises);
        } else {
          companyData.galeriaProductosUrls = files.galeriaFiles.map(file => `/uploads/images/${file.filename}`);
        }
      }

      const { wordpressUser, ...companyDataToSave } = companyData;

      // Asegurar que telefono1 y telefono2 sean strings (pueden venir como números del FormData)
      if (companyDataToSave.telefono1 !== undefined && companyDataToSave.telefono1 !== null) {
        companyDataToSave.telefono1 = String(companyDataToSave.telefono1);
      }
      if (companyDataToSave.telefono2 !== undefined && companyDataToSave.telefono2 !== null) {
        companyDataToSave.telefono2 = String(companyDataToSave.telefono2);
      }
      
      const parsedCompanyData = insertCompanySchema.parse(companyDataToSave);
      
      let userId = null;
      let transactionExpirationDate = null;
      let newUserInfo: { email: string; tempPassword: string; displayName: string } | null = null;
      let existingRepresentativeCompanyCount = 0;

      // Si se seleccionó un usuario de WordPress, crear/obtener usuario representante
      if (wordpressUser && wordpressUser.email && wordpressUser.username) {
        try {
          // Obtener fecha de caducidad de transacción desde WordPress
          if (wordpressUser.id) {
            transactionExpirationDate = await getTransactionExpirationDate(wordpressUser.id.toString());
          }

          // Verificar si el usuario ya existe en el sistema por email
          let existingUser = await storage.getUserByEmail(wordpressUser.email);
          
          if (!existingUser) {
            // Generar contraseña temporal criptográficamente segura
            const crypto = nodeCrypto;
            const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
            
            // Crear nuevo usuario representante con datos de WordPress
            // NOTA DE SEGURIDAD: tempPassword se almacena en texto plano por limitaciones del sistema actual
            // Esta es una limitación conocida - idealmente debería hashearse antes de almacenar
            // La contraseña DEBE cambiarse en el primer inicio de sesión (requirePasswordChange: true)
            const newUserData = {
              firebaseUid: `wp_${wordpressUser.id}_${Date.now()}`,
              email: wordpressUser.email,
              displayName: wordpressUser.name || wordpressUser.username,
              role: "representante",
              photoURL: null,
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              autoRenewal: false,
              tempPassword: tempPassword,
              requirePasswordChange: true
            };
            
            existingUser = await storage.createUser(newUserData);
            
            // Guardar información del nuevo usuario para incluirla en la respuesta
            // Esta es la ÚNICA vez que la contraseña se envía - el admin debe comunicarla al usuario
            newUserInfo = {
              email: wordpressUser.email,
              tempPassword: tempPassword,
              displayName: wordpressUser.name || wordpressUser.username
            };
            
            // Enviar email de activación al usuario
            try {
              const baseUrl = process.env.REPLIT_DEV_DOMAIN 
                ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
                : (process.env.REPLIT_APP_URL || 'https://directorio.anpr.org.mx');
              const activationUrl = `${baseUrl}/activar-cuenta`;
              await sendActivationEmail(
                wordpressUser.email,
                wordpressUser.name || wordpressUser.username,
                tempPassword,
                activationUrl
              );
              console.log(`[WordPress User Creation] Activation email sent to ${wordpressUser.email}`);
            } catch (emailError) {
              console.error(`[WordPress User Creation] Error sending activation email:`, emailError);
            }
            
            console.log(`[WordPress User Creation] New representative account created for ${wordpressUser.email}`);
            console.log(`[WordPress User Creation] User must activate account on first login`);
            
            // Descargar y guardar imagen de perfil de WordPress/PeepSo si está disponible
            if (wordpressUser.avatar_urls) {
              try {
                const avatarUrl = wordpressUser.avatar_urls['96'] || wordpressUser.avatar_urls['48'] || wordpressUser.avatar_urls['24'];
                if (avatarUrl) {
                  console.log(`[WordPress User Creation] Downloading profile picture from: ${avatarUrl}`);
                  const avatarResponse = await fetch(avatarUrl);
                  if (avatarResponse.ok) {
                    const contentLength = Number(avatarResponse.headers.get("content-length") || 0);
                    if (contentLength > IMAGE_MAX_BYTES) throw new Error("WordPress avatar exceeds 2 MiB");
                    const avatarBytes = await readImageResponseWithinLimit(avatarResponse);
                    if (avatarBytes.byteLength > IMAGE_MAX_BYTES || !isImageBytes(avatarBytes)) {
                      console.warn("[WordPress User Creation] Avatar omitted: invalid image or exceeds 2 MiB");
                      throw new Error("Invalid WordPress avatar");
                    }
                    const avatarFileName = `avatar_${existingUser.id}_${Date.now()}.jpg`;
                    
                    const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
                    if (!fs.existsSync(uploadsDir)) {
                      fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const avatarPath = path.join(uploadsDir, avatarFileName);
                    fs.writeFileSync(avatarPath, avatarBytes);
                    
                    const avatarImageUrl = `/uploads/images/${avatarFileName}`;
                    
                    // Actualizar usuario con la URL de la imagen
                    await storage.updateUser(existingUser.id, { photoURL: avatarImageUrl });
                    console.log(`[WordPress User Creation] Profile picture saved: ${avatarImageUrl}`);
                  }
                }
              } catch (avatarError) {
                console.error(`[WordPress User Creation] Error downloading profile picture:`, avatarError);
              }
            }
          }

          if (existingUser && !isRepresentativeRole(existingUser.role)) {
            throw new RepresentativeCompanyRoleError();
          }
          
          userId = existingUser?.id || null;
          if (userId != null) {
            existingRepresentativeCompanyCount = (
              await storage.getCompaniesForRepresentative(wordpressUser.email, userId)
            ).length;
            if (existingRepresentativeCompanyCount >= 3) {
              throw new RepresentativeCompanyLimitError();
            }
          }
        } catch (userError) {
          console.error("Error creating/updating representative user:", userError);
          if (
            userError instanceof RepresentativeCompanyLimitError ||
            userError instanceof RepresentativeCompanyRoleError
          ) {
            throw userError;
          }
        }
      }
      
      // Crear la empresa con el userId del representante si se pudo crear/encontrar
      let companyWithUser = {
        ...parsedCompanyData,
        userId: userId
      };

      // Si se obtuvo una fecha de caducidad de transacción, actualizar las fechas de vencimiento del plan
      if (transactionExpirationDate) {
        try {
          const expirationDate = new Date(transactionExpirationDate);
          const startDate = new Date(expirationDate);
          startDate.setFullYear(startDate.getFullYear() - 1);
          
          companyWithUser.fechaInicioMembresia = startDate.toISOString().split('T')[0];
          companyWithUser.fechaFinMembresia = expirationDate.toISOString().split('T')[0];
        } catch (dateError) {
          console.error('[Company Creation] Error processing transaction expiration date:', dateError);
        }
      }
      
      // Lógica automática para empresas con ubicación: asegurar que aparezcan en el mapa
      if (companyWithUser.ubicacionGeografica && (!companyWithUser.fechaFinMembresia || companyWithUser.fechaFinMembresia === '')) {
        const today = new Date();
        const oneYearFromNow = new Date(today);
        oneYearFromNow.setFullYear(today.getFullYear() + 1);
        
        companyWithUser.fechaInicioMembresia = today.toISOString().split('T')[0];
        companyWithUser.fechaFinMembresia = oneYearFromNow.toISOString().split('T')[0];
        companyWithUser.estado = 'activo';
        
        console.log(`[Auto-Activation] Company with location will be automatically activated:`);
        console.log(`[Auto-Activation] Start: ${companyWithUser.fechaInicioMembresia}`);
        console.log(`[Auto-Activation] End: ${companyWithUser.fechaFinMembresia}`);
      }
      
      if (requestHasOversizedDataUrlImage(companyWithUser)) return rejectOversizedImage(res);
      const company = await storage.createCompany(companyWithUser);

      // La creación de empresa también debe proyectar el vínculo normalizado.
      // Si una carrera alcanza el límite entre la prevalidación y este punto,
      // se revierte la empresa recién creada para no dejar un cuarto vínculo
      // únicamente en companies.userId.
      if (userId != null) {
        try {
          await storage.addRepresentativeCompany(company.id, userId);
        } catch (assignmentError) {
          await storage.deleteCompany(company.id);
          throw assignmentError;
        }
      }
      
      // Asignar certificados automáticamente si la empresa tiene un membershipTypeId
      if (company.membershipTypeId) {
        try {
          const autoCertificates = await storage.getAutoCertificatesForMembership(company.membershipTypeId);
          console.log(`[Auto-Certificate] Found ${autoCertificates.length} certificates for membership type ${company.membershipTypeId}`);
          
          for (const cert of autoCertificates) {
            await storage.assignCertificateToCompany(company.id, cert.id, {
              fechaObtencion: new Date().toISOString().split('T')[0],
              asignadoPorAdmin: false,
              observaciones: 'Asignado automáticamente al crear la empresa'
            });
            console.log(`[Auto-Certificate] Assigned certificate ${cert.nombreCertificado} (ID: ${cert.id}) to company ${company.id}`);
          }
        } catch (certError) {
          console.error('[Auto-Certificate] Error assigning certificates:', certError);
        }
      }
      
      // Si se creó un nuevo usuario, incluir su información en la respuesta
      if (newUserInfo) {
        res.status(201).json({
          ...company,
          newUserCreated: newUserInfo
        });
      } else {
        res.status(201).json(company);
      }
    } catch (error) {
      console.error("Error creating company with files:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof RepresentativeCompanyLimitError) {
        return res.status(409).json({
          error: "Este representante ya tiene el máximo de 3 empresas asignadas",
          code: error.code,
          maxCompanies: 3,
        });
      }
      if (error instanceof RepresentativeCompanyRoleError) {
        return res.status(409).json({
          error: "La cuenta existente no tiene rol de representante",
          code: error.code,
        });
      }
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(403).json({
          error: "Solo un administrador puede crear empresas",
        });
      }

      // TODO: Restaurar validación de administrador una vez que se arregle el header
      // console.log("Debug - req.user:", JSON.stringify(req.user, null, 2));
      // const isAdmin = req.user?.role === 'admin' || req.user?.roleId === 1;
      // console.log("Debug - isAdmin check:", isAdmin, "role:", req.user?.role, "roleId:", req.user?.roleId);
      // if (!isAdmin) {
      //   return res.status(403).json({ 
      //     error: "Acceso denegado", 
      //     message: "Solo los administradores pueden crear empresas" 
      //   });
      // }
      const { wordpressUser, ...companyData } = req.body;
      const parsedCompanyData = insertCompanySchema.parse(companyData);
      
      let userId = null;
      let normalizedRepresentativeUserId: number | null = null;
      
      let transactionExpirationDate = null;

      // Si se seleccionó un usuario de WordPress, crear/obtener usuario representante
      if (wordpressUser && wordpressUser.email && wordpressUser.username) {
        try {
          // Obtener fecha de caducidad de transacción desde WordPress
          if (wordpressUser.id) {
            transactionExpirationDate = await getTransactionExpirationDate(wordpressUser.id.toString());
          }

          // Verificar si el usuario ya existe en el sistema por email
          let existingUser = await storage.getUserByEmail(wordpressUser.email);
          
          if (!existingUser) {
            // Generar contraseña temporal única
            const crypto = nodeCrypto;
            const tempPassword = crypto.randomBytes(8).toString('base64').slice(0, 12);
            
            // Crear nuevo usuario representante con datos de WordPress
            const newUserData = {
              firebaseUid: `wp_${wordpressUser.id}_${Date.now()}`, // UID único temporal para WordPress
              email: wordpressUser.email,
              displayName: wordpressUser.name || wordpressUser.username,
              role: "representante",
              photoURL: null,
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              autoRenewal: false,
              tempPassword: tempPassword,
              requirePasswordChange: true
            };
            
            existingUser = await storage.createUser(newUserData);
            
            // Enviar email de activación al usuario
            try {
              const baseUrl = process.env.REPLIT_DEV_DOMAIN 
                ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
                : (process.env.REPLIT_APP_URL || 'https://directorio.anpr.org.mx');
              const activationUrl = `${baseUrl}/activar-cuenta`;
              await sendActivationEmail(
                wordpressUser.email,
                wordpressUser.name || wordpressUser.username,
                tempPassword,
                activationUrl
              );
              console.log(`[WordPress User Creation] Activation email sent to ${wordpressUser.email}`);
            } catch (emailError) {
              console.error(`[WordPress User Creation] Error sending activation email:`, emailError);
            }
            
            console.log(`[WordPress User Creation] New representative account created for ${wordpressUser.email}`);
            console.log(`[WordPress User Creation] User must activate account on first login`);
            
            // Descargar y guardar imagen de perfil de WordPress/PeepSo si está disponible
            if (wordpressUser.avatar_urls) {
              try {
                const avatarUrl = wordpressUser.avatar_urls['96'] || wordpressUser.avatar_urls['48'] || wordpressUser.avatar_urls['24'];
                if (avatarUrl) {
                  console.log(`[WordPress User Creation] Downloading profile picture from: ${avatarUrl}`);
                  const avatarResponse = await fetch(avatarUrl);
                  if (avatarResponse.ok) {
                    const contentLength = Number(avatarResponse.headers.get("content-length") || 0);
                    if (contentLength > IMAGE_MAX_BYTES) throw new Error("WordPress avatar exceeds 2 MiB");
                    const avatarBytes = await readImageResponseWithinLimit(avatarResponse);
                    if (avatarBytes.byteLength > IMAGE_MAX_BYTES || !isImageBytes(avatarBytes)) {
                      console.warn("[WordPress User Creation] Avatar omitted: invalid image or exceeds 2 MiB");
                      throw new Error("Invalid WordPress avatar");
                    }
                    const avatarFileName = `avatar_${existingUser.id}_${Date.now()}.jpg`;
                    
                    // Guardar imagen usando fs (fs y path ya están importados a nivel de módulo)
                    const uploadsDir = path.join(process.cwd(), 'uploads', 'images');
                    if (!fs.existsSync(uploadsDir)) {
                      fs.mkdirSync(uploadsDir, { recursive: true });
                    }
                    
                    const avatarPath = path.join(uploadsDir, avatarFileName);
                    fs.writeFileSync(avatarPath, avatarBytes);
                    
                    const avatarImageUrl = `/uploads/images/${avatarFileName}`;
                    
                    // Actualizar usuario con la URL de la imagen
                    await storage.updateUser(existingUser.id, { photoURL: avatarImageUrl });
                    console.log(`[WordPress User Creation] Profile picture saved: ${avatarImageUrl}`);
                  }
                }
              } catch (avatarError) {
                console.error(`[WordPress User Creation] Error downloading profile picture:`, avatarError);
              }
            }
            
            // TODO: Implementar creación automática en Firebase con contraseña por defecto
            // await createFirebaseUserWithPassword(wordpressUser.email, '12345678');
          } else if (existingUser && !isRepresentativeRole(existingUser.role)) {
            throw new RepresentativeCompanyRoleError();
          }
          
          userId = existingUser?.id || null;
          normalizedRepresentativeUserId = userId;
          if (normalizedRepresentativeUserId != null) {
            const assignedCompanies = await storage.getCompaniesForRepresentative(
              wordpressUser.email,
              normalizedRepresentativeUserId,
            );
            if (assignedCompanies.length >= 3) {
              throw new RepresentativeCompanyLimitError();
            }
          }
        } catch (userError) {
          console.error("Error creating/updating representative user:", userError);
          if (userError instanceof RepresentativeCompanyLimitError) {
            throw userError;
          }
          throw userError;
        }
      }
      
      // Si NO se seleccionó un usuario de WordPress pero la empresa tiene email1, crear usuario automáticamente
      if (!userId && parsedCompanyData.email1) {
        try {
          // Verificar si ya existe un usuario con ese email
          let existingUser = await storage.getUserByEmail(parsedCompanyData.email1);
          
          if (!existingUser) {
            // Crear nuevo usuario representante automáticamente
            const newUserData = {
              firebaseUid: `pending_${Date.now()}_${parsedCompanyData.email1}`,
              email: parsedCompanyData.email1,
              displayName: parsedCompanyData.nombreEmpresa || parsedCompanyData.email1,
              role: "representante",
              photoURL: null,
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              autoRenewal: false,
              tempPassword: "ANPR2024!",
              requirePasswordChange: true
            };
            
            existingUser = await storage.createUser(newUserData);
            
            console.log(`[Auto User Creation] New representative account created for ${parsedCompanyData.email1}`);
            console.log(`[Auto User Creation] Temporary password: ANPR2024!`);
            console.log(`[Auto User Creation] User must activate account on first login`);
          } else if (!isRepresentativeRole(existingUser.role)) {
            throw new RepresentativeCompanyRoleError();
          }
          
          userId = existingUser?.id || null;
          normalizedRepresentativeUserId = userId;
          if (normalizedRepresentativeUserId != null) {
            const assignedCompanies = await storage.getCompaniesForRepresentative(
              parsedCompanyData.email1,
              normalizedRepresentativeUserId,
            );
            if (assignedCompanies.length >= 3) {
              throw new RepresentativeCompanyLimitError();
            }
          }
        } catch (autoUserError) {
          console.error("[Auto User Creation] Error creating automatic user:", autoUserError);
          if (autoUserError instanceof RepresentativeCompanyLimitError) {
            throw autoUserError;
          }
          throw autoUserError;
        }
      }
      
      // Crear la empresa con el userId del representante si se pudo crear/encontrar
      let companyWithUser = {
        ...parsedCompanyData,
        userId: userId
      };

      // Si se obtuvo una fecha de caducidad de transacción, actualizar las fechas de vencimiento del plan
      if (transactionExpirationDate) {
        try {
          // Convertir la fecha de WordPress a formato que acepta nuestra base de datos
          const expirationDate = new Date(transactionExpirationDate);
          
          // Calcular fecha de inicio (un año antes de la caducidad)
          const startDate = new Date(expirationDate);
          startDate.setFullYear(startDate.getFullYear() - 1);
          
          companyWithUser.fechaInicioMembresia = startDate.toISOString().split('T')[0];
          companyWithUser.fechaFinMembresia = expirationDate.toISOString().split('T')[0];
          
          console.log(`[Company Creation] Updated membership dates from transaction:`);
          console.log(`[Company Creation] Start: ${companyWithUser.fechaInicioMembresia}`);
          console.log(`[Company Creation] End: ${companyWithUser.fechaFinMembresia}`);
          console.log(`[Company Creation] Source: WordPress transaction expiration`);
          
        } catch (dateError) {
          console.error('[Company Creation] Error processing transaction expiration date:', dateError);
          // Continuar con las fechas originales si hay error
        }
      }
      
      // Lógica automática para empresas con ubicación: asegurar que aparezcan en el mapa
      if (companyWithUser.ubicacionGeografica && (!companyWithUser.fechaFinMembresia || companyWithUser.fechaFinMembresia === '')) {
        const today = new Date();
        const oneYearFromNow = new Date(today);
        oneYearFromNow.setFullYear(today.getFullYear() + 1);
        
        companyWithUser.fechaInicioMembresia = today.toISOString().split('T')[0];
        companyWithUser.fechaFinMembresia = oneYearFromNow.toISOString().split('T')[0];
        companyWithUser.estado = 'activo';
        
        console.log(`[Auto-Activation] Company with location will be automatically activated:`);
        console.log(`[Auto-Activation] Start: ${companyWithUser.fechaInicioMembresia}`);
        console.log(`[Auto-Activation] End: ${companyWithUser.fechaFinMembresia}`);
      }
      
      const company = await storage.createCompany(companyWithUser);

      if (normalizedRepresentativeUserId != null) {
        try {
          await storage.addRepresentativeCompany(company.id, normalizedRepresentativeUserId);
        } catch (assignmentError) {
          await storage.deleteCompany(company.id);
          throw assignmentError;
        }
      }
      
      // Asignar certificados automáticamente si la empresa tiene un membershipTypeId
      if (company.membershipTypeId) {
        try {
          const autoCertificates = await storage.getAutoCertificatesForMembership(company.membershipTypeId);
          console.log(`[Auto-Certificate] Found ${autoCertificates.length} certificates for membership type ${company.membershipTypeId}`);
          
          for (const cert of autoCertificates) {
            await storage.assignCertificateToCompany(company.id, cert.id, {
              fechaObtencion: new Date().toISOString().split('T')[0],
              asignadoPorAdmin: false,
              observaciones: 'Asignado automáticamente al crear la empresa'
            });
            console.log(`[Auto-Certificate] Assigned certificate ${cert.nombreCertificado} (ID: ${cert.id}) to company ${company.id}`);
          }
        } catch (certError) {
          console.error('[Auto-Certificate] Error assigning certificates:', certError);
        }
      }
      
      res.status(201).json(company);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      if (error instanceof RepresentativeCompanyLimitError) {
        return res.status(409).json({
          error: "Este representante ya tiene el máximo de 3 empresas asignadas",
          code: error.code,
          maxCompanies: 3,
        });
      }
      if (error instanceof RepresentativeCompanyRoleError) {
        return res.status(409).json({
          error: "La cuenta existente no tiene rol de representante",
          code: error.code,
        });
      }
      console.error("Error creating company:", error);
      res.status(500).json({ error: "Failed to create company" });
    }
  });

  // ============================================================================
  // PATCH /api/companies/:id - Actualización segura de empresas
  // Esta implementación protege datos existentes y maneja errores de forma robusta
  // ============================================================================
  app.patch("/api/companies/:id", uploadCompanyFiles.fields([
    { name: 'logoFile', maxCount: 1 },
    { name: 'fotoPortadaFile', maxCount: 1 },
    { name: 'catalogoFile', maxCount: 1 },
    { name: 'galeriaFiles', maxCount: 20 }
  ]), (req, res, next) => {
    if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
    next();
  }, validateAndPersistCompanyFiles, async (req, res) => {
    const id = parseInt(req.params.id);
    
    // Validar ID
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid company ID" });
    }

    try {
      const existingCompany = await storage.getCompany(id);
      if (!existingCompany) {
        return res.status(404).json({ error: "Company not found" });
      }
      if (!(await verifyCompanyAccess(req, res, existingCompany))) {
        return;
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      let updateData: Record<string, any> = {};
      const fileUploadErrors: string[] = [];

      // ========================================
      // PASO 1: Procesar campos del formulario
      // ========================================
      for (const [key, value] of Object.entries(req.body)) {
        // Ignorar campos de archivos
        if (['logoFile', 'fotoPortadaFile', 'catalogoFile', 'galeriaFiles'].includes(key)) {
          continue;
        }
        
        // Mantener campos de teléfono como strings
        if (key === 'telefono1' || key === 'telefono2') {
          updateData[key] = value;
        } else {
          try {
            updateData[key] = JSON.parse(value as string);
          } catch {
            updateData[key] = value;
          }
        }
      }

      // ========================================
      // PASO 1.5: Vincular usuario de WordPress como representante (si se seleccionó)
      // wordpressUser no es un campo de la tabla companies: se extrae del payload,
      // se crea/obtiene el usuario representante local y se asigna su userId a la empresa.
      // ========================================
      const wordpressUser = updateData.wordpressUser;
      delete updateData.wordpressUser;
      // Los vínculos de representantes solo se modifican mediante el flujo
      // normalizado y validado; nunca desde campos genéricos de la empresa.
      delete updateData.userId;
      delete updateData.representantesVentas;
      let representativeAssignment: Awaited<ReturnType<typeof storage.addRepresentativeCompany>> | null = null;

      if (wordpressUser && wordpressUser.email && wordpressUser.username) {
        // Vincular representantes de WordPress exige un token Firebase
        // verificable o una cookie de administrador firmada por el servidor.
        if (!(await isStronglyVerifiedAdminRequest(req))) {
          return res.status(403).json({
            error: "Solo un administrador puede asignar representantes de WordPress",
          });
        }

        try {
          // Obtener fecha de caducidad de transacción desde WordPress
          let transactionExpirationDate: string | null = null;
          if (wordpressUser.id) {
            transactionExpirationDate = await getTransactionExpirationDate(wordpressUser.id.toString());
          }

          // Verificar si el usuario ya existe en el sistema por email
          let existingUser = await storage.getUserByEmail(wordpressUser.email);

          if (!existingUser) {
            // Generar contraseña temporal criptográficamente segura
            const crypto = nodeCrypto;
            const tempPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);

            const newUserData = {
              firebaseUid: `wp_${wordpressUser.id}_${Date.now()}`,
              email: wordpressUser.email,
              displayName: wordpressUser.name || wordpressUser.username,
              role: "representante",
              photoURL: null,
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              autoRenewal: false,
              tempPassword: tempPassword,
              requirePasswordChange: true
            };

            existingUser = await storage.createUser(newUserData);
            console.log(`[PATCH /api/companies/:id] Created new representative user from WordPress: ${existingUser.email}`);

            // Enviar email de activación al usuario
            try {
              const baseUrl = process.env.REPLIT_DEV_DOMAIN
                ? `https://${process.env.REPLIT_DEV_DOMAIN}`
                : (process.env.REPLIT_APP_URL || 'https://directorio.anpr.org.mx');
              await sendActivationEmail(
                wordpressUser.email,
                wordpressUser.name || wordpressUser.username,
                tempPassword,
                `${baseUrl}/activar-cuenta`
              );
              console.log(`[PATCH /api/companies/:id] Activation email sent to ${wordpressUser.email}`);
            } catch (emailError) {
              console.error(`[PATCH /api/companies/:id] Error sending activation email:`, emailError);
            }
          } else if (!isRepresentativeRole(existingUser.role)) {
            return res.status(409).json({
              error: "La cuenta existente debe tener rol de representante",
              code: "USER_NOT_REPRESENTATIVE",
            });
          }

          // La asignación de WordPress es acumulativa: no modifica userId ni
          // reemplaza las otras empresas del representante.
          if (existingUser) {
            representativeAssignment = await storage.addRepresentativeCompany(id, existingUser.id);
          }

          // Actualizar fechas de membresía desde la transacción de WordPress
          if (transactionExpirationDate) {
            try {
              const expirationDate = new Date(transactionExpirationDate);
              const startDate = new Date(expirationDate);
              startDate.setFullYear(startDate.getFullYear() - 1);
              updateData.fechaInicioMembresia = startDate.toISOString().split('T')[0];
              updateData.fechaFinMembresia = expirationDate.toISOString().split('T')[0];
            } catch (dateError) {
              console.error('[PATCH /api/companies/:id] Error processing transaction expiration date:', dateError);
            }
          }
        } catch (userError: any) {
          console.error("[PATCH /api/companies/:id] Error linking WordPress representative:", userError);
          if (userError?.code === "REPRESENTATIVE_COMPANY_LIMIT") {
            return res.status(409).json({
              error: "Este representante ya tiene el máximo de 3 empresas asignadas",
              code: userError.code,
              maxCompanies: 3,
            });
          }
          if (userError?.code === "REPRESENTATIVE_COMPANY_NOT_FOUND") {
            return res.status(404).json({ error: userError.message, code: userError.code });
          }
          return res.status(500).json({
            error: "Failed to assign WordPress representative",
            details: userError instanceof Error ? userError.message : "Unexpected representative association error",
            code: userError?.code || "REPRESENTATIVE_COMPANY_ASSIGNMENT_FAILED",
          });
        }
      }

      // ========================================
      // PASO 2: Procesar archivos (con manejo de errores individual)
      // ========================================
      
      // Logo
      if (files?.logoFile?.[0]) {
        try {
          if (useCloudinary) {
            const fileBuffer = fs.readFileSync(files.logoFile[0].path);
            const result = await uploadFromBuffer(fileBuffer, 'anpr/logos', 'image');
            updateData.logotipoUrl = result.url;
            fs.unlinkSync(files.logoFile[0].path);
          } else {
            updateData.logotipoUrl = `/uploads/images/${files.logoFile[0].filename}`;
          }
        } catch (err) {
          console.error('[PATCH] Error uploading logo:', err);
          fileUploadErrors.push('logo');
          // Limpiar archivo temporal si existe
          try { fs.unlinkSync(files.logoFile[0].path); } catch {}
        }
      }

      // Foto de portada
      if (files?.fotoPortadaFile?.[0]) {
        try {
          if (useCloudinary) {
            const fileBuffer = fs.readFileSync(files.fotoPortadaFile[0].path);
            const result = await uploadFromBuffer(fileBuffer, 'anpr/portadas', 'image');
            updateData.fotoPortadaUrl = result.url;
            fs.unlinkSync(files.fotoPortadaFile[0].path);
          } else {
            updateData.fotoPortadaUrl = `/uploads/images/${files.fotoPortadaFile[0].filename}`;
          }
        } catch (err) {
          console.error('[PATCH] Error uploading cover photo:', err);
          fileUploadErrors.push('fotoPortada');
          try { fs.unlinkSync(files.fotoPortadaFile[0].path); } catch {}
        }
      }

      // Catálogo
      if (files?.catalogoFile?.[0]) {
        try {
          if (useCloudinary) {
            const fileBuffer = fs.readFileSync(files.catalogoFile[0].path);
            const result = await uploadFromBuffer(fileBuffer, 'anpr/catalogos', 'raw');
            updateData.catalogoDigitalUrl = result.url;
            fs.unlinkSync(files.catalogoFile[0].path);
          } else {
            updateData.catalogoDigitalUrl = `/uploads/documents/${files.catalogoFile[0].filename}`;
          }
        } catch (err) {
          console.error('[PATCH] Error uploading catalog:', err);
          fileUploadErrors.push('catalogo');
          try { fs.unlinkSync(files.catalogoFile[0].path); } catch {}
        }
      } else if (updateData.catalogoDigitalUrl === "") {
        // Borrar catálogo explícitamente
        updateData.catalogoDigitalUrl = null;
      }

      // Galería
      if (files?.galeriaFiles?.length > 0) {
        try {
          let newImages: string[] = [];
          if (useCloudinary) {
            for (const file of files.galeriaFiles) {
              try {
                const fileBuffer = fs.readFileSync(file.path);
                const result = await uploadFromBuffer(fileBuffer, 'anpr/galeria', 'image');
                newImages.push(result.url);
                fs.unlinkSync(file.path);
              } catch (err) {
                console.error('[PATCH] Error uploading gallery image:', err);
                try { fs.unlinkSync(file.path); } catch {}
              }
            }
          } else {
            newImages = files.galeriaFiles.map(file => `/uploads/images/${file.filename}`);
          }
          
          if (newImages.length > 0) {
            if (updateData.galeriaProductosUrls && Array.isArray(updateData.galeriaProductosUrls)) {
              updateData.galeriaProductosUrls = [...updateData.galeriaProductosUrls, ...newImages];
            } else {
              updateData.galeriaProductosUrls = newImages;
            }
          }
        } catch (err) {
          console.error('[PATCH] Error processing gallery:', err);
          fileUploadErrors.push('galeria');
        }
      }

      // ========================================
      // PASO 3: Limpiar payload - Proteger datos existentes
      // ========================================
      
      // Convertir cadenas vacías a null para campos específicos
      if (updateData.membershipPeriodicidad === "") {
        updateData.membershipPeriodicidad = null;
      }
      if (updateData.formaPago === "") {
        updateData.formaPago = null;
      }

      // PROTECCIÓN DE COORDENADAS: No sobrescribir ubicacionGeografica si no hay coordenadas válidas
      if ('ubicacionGeografica' in updateData) {
        const ubicacion = updateData.ubicacionGeografica;
        const hasValidCoordinates = ubicacion && 
          typeof ubicacion === 'object' && 
          typeof ubicacion.lat === 'number' && 
          typeof ubicacion.lng === 'number' &&
          !isNaN(ubicacion.lat) && 
          !isNaN(ubicacion.lng);
        
        if (!hasValidCoordinates) {
          delete updateData.ubicacionGeografica;
          console.log('[PATCH /api/companies/:id] Preserved existing ubicacionGeografica - no valid coordinates');
        }
      }

      // PROTECCIÓN DE URLs DE IMÁGENES: No sobrescribir si vienen vacías o inválidas
      const urlFields = ['logotipoUrl', 'fotoPortadaUrl'];
      for (const field of urlFields) {
        if (field in updateData) {
          const value = updateData[field];
          // Si es string vacío, null, undefined o no es una URL válida, eliminar del update
          if (!value || value === '' || value === 'null' || value === 'undefined') {
            delete updateData[field];
            console.log(`[PATCH /api/companies/:id] Preserved existing ${field} - empty/invalid value`);
          }
        }
      }

      // PROTECCIÓN DE ARRAYS: No sobrescribir si vienen vacíos cuando no deberían
      const arrayFields = ['galeriaProductosUrls', 'videosUrls', 'redesSociales'];
      for (const field of arrayFields) {
        if (field in updateData) {
          const value = updateData[field];
          // Si es un string "[object Object]" o similar, eliminar
          if (typeof value === 'string' && value.includes('[object')) {
            delete updateData[field];
            console.log(`[PATCH /api/companies/:id] Removed malformed ${field}`);
          }
        }
      }

      // Eliminar campos undefined del payload
      for (const key of Object.keys(updateData)) {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      }

      // ========================================
      // PASO 4: Verificar si hay cambios reales
      // ========================================
      const fieldCount = Object.keys(updateData).length;
      
      if (fieldCount === 0) {
        // No hay campos para actualizar - devolver empresa actual sin hacer UPDATE
        const existingCompany = await storage.getCompany(id);
        if (!existingCompany) {
          return res.status(404).json({ error: "Company not found" });
        }
        
        console.log('[PATCH /api/companies/:id] No changes to apply, returning current data');
        return res.status(200).json({ 
          ...existingCompany, 
          _message: "No changes applied",
          _fileUploadErrors: fileUploadErrors.length > 0 ? fileUploadErrors : undefined,
          assignedCompanies: representativeAssignment?.companies,
          assignedCompanyIds: representativeAssignment?.companies.map((company) => company.id),
          assignedCompanyCount: representativeAssignment?.companies.length,
        });
      }

      // ========================================
      // PASO 5: Validar y actualizar
      // ========================================
      console.log(`[PATCH /api/companies/:id] Updating ${fieldCount} fields for company ${id}`);
      
      const parsedData = insertCompanySchema.partial().parse(updateData);
      if (requestHasOversizedDataUrlImage(parsedData)) return rejectOversizedImage(res);
      const company = await storage.updateCompany(id, parsedData);
      
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // ========================================
      // PASO 6: Asignar certificados automáticamente (opcional)
      // ========================================
      if (company.membershipTypeId) {
        try {
          const autoCertificates = await storage.getAutoCertificatesForMembership(company.membershipTypeId);
          const currentCertIds = (company.certificateIds as number[]) || [];
          
          for (const cert of autoCertificates) {
            if (!currentCertIds.includes(cert.id)) {
              await storage.assignCertificateToCompany(company.id, cert.id, {
                fechaObtencion: new Date().toISOString().split('T')[0],
                asignadoPorAdmin: false,
                observaciones: 'Asignado automáticamente al actualizar la empresa'
              });
            }
          }
        } catch (certError) {
          console.error('[Auto-Certificate] Error:', certError);
        }
      }

      // Incluir advertencias de archivos si hubo errores
      const response: any = { ...company };
      if (representativeAssignment) {
        response.assignedCompanies = representativeAssignment.companies;
        response.assignedCompanyIds = representativeAssignment.companies.map((company) => company.id);
        response.assignedCompanyCount = representativeAssignment.companies.length;
        response.representativeAssignmentStatus = representativeAssignment.status;
      }
      if (fileUploadErrors.length > 0) {
        response._fileUploadWarnings = `Some files failed to upload: ${fileUploadErrors.join(', ')}`;
      }

      res.json(response);
      
    } catch (error) {
      console.error("[PATCH /api/companies/:id] Error:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
        });
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        error: "Failed to update company",
        details: errorMessage
      });
    }
  });

  app.put("/api/companies/:id", async (req, res) => {
    try {
      if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
      const id = parseInt(req.params.id);
      const existingCompany = await storage.getCompany(id);
      if (!existingCompany) {
        return res.status(404).json({ error: "Company not found" });
      }
      if (!(await verifyCompanyAccess(req, res, existingCompany))) {
        return;
      }

      const { wordpressUser, ...companyData } = req.body;
      // Evitar que la ruta heredada altere asociaciones fuera del flujo
      // normalizado, autenticado y limitado a tres empresas.
      delete companyData.userId;
      delete companyData.representantesVentas;
      const parsedCompanyData = insertCompanySchema.partial().parse(companyData);
      
      let updatedData = { ...parsedCompanyData };
      let transactionExpirationDate = null;
      let representativeAssignment: Awaited<ReturnType<typeof storage.addRepresentativeCompany>> | null = null;

      // La ruta heredada conserva compatibilidad, pero usa exactamente el mismo
      // flujo seguro y acumulativo que PATCH: nunca reemplaza companies.userId.
      if (wordpressUser && wordpressUser.email && wordpressUser.username) {
        if (!(await isStronglyVerifiedAdminRequest(req))) {
          return res.status(403).json({
            error: "Solo un administrador puede asignar representantes de WordPress",
          });
        }

        try {
          // Obtener fecha de caducidad de transacción desde WordPress
          if (wordpressUser.id) {
            transactionExpirationDate = await getTransactionExpirationDate(wordpressUser.id.toString());
          }

          // Verificar si el usuario ya existe en el sistema por email
          let existingUser = await storage.getUserByEmail(wordpressUser.email);
          
          if (!existingUser) {
            // Crear nuevo usuario representante con datos de WordPress
            const newUserData = {
              firebaseUid: `wp_${wordpressUser.id}_${Date.now()}`, // UID único temporal para WordPress
              email: wordpressUser.email,
              displayName: wordpressUser.name || wordpressUser.username,
              role: "representante",
              photoURL: null,
              stripeCustomerId: null,
              stripeSubscriptionId: null,
              autoRenewal: false
            };
            
            existingUser = await storage.createUser(newUserData);
            console.log(`[Update Company] Created new representative user from WordPress: ${existingUser.email}`);
          } else if (existingUser && !isRepresentativeRole(existingUser.role)) {
            return res.status(409).json({
              error: "La cuenta existente debe tener rol de representante",
              code: "USER_NOT_REPRESENTATIVE",
            });
          }
          
          // Asignar el usuario a la empresa
          if (existingUser) {
            representativeAssignment = await storage.addRepresentativeCompany(id, existingUser.id);
          }

        } catch (userError) {
          console.error("[Update Company] Error creating/updating representative user:", userError);
          if (userError instanceof RepresentativeCompanyLimitError) {
            return res.status(409).json({
              error: "Este representante ya tiene el máximo de 3 empresas asignadas",
              code: userError.code,
              maxCompanies: 3,
            });
          }
          throw userError;
        }
      }

      // Si se obtuvo una fecha de caducidad de transacción, actualizar las fechas de vencimiento del plan
      if (transactionExpirationDate) {
        try {
          // Convertir la fecha de WordPress a formato que acepta nuestra base de datos
          const expirationDate = new Date(transactionExpirationDate);
          
          // Calcular fecha de inicio (un año antes de la caducidad)
          const startDate = new Date(expirationDate);
          startDate.setFullYear(startDate.getFullYear() - 1);
          
          updatedData.fechaInicioMembresia = startDate.toISOString().split('T')[0];
          updatedData.fechaFinMembresia = expirationDate.toISOString().split('T')[0];
          
          console.log(`[Update Company] Updated membership dates from transaction:`);
          console.log(`[Update Company] Start: ${updatedData.fechaInicioMembresia}`);
          console.log(`[Update Company] End: ${updatedData.fechaFinMembresia}`);
          console.log(`[Update Company] Source: WordPress transaction expiration`);
          
        } catch (dateError) {
          console.error('[Update Company] Error processing transaction expiration date:', dateError);
          // Continuar con las fechas originales si hay error
        }
      }

      const company = await storage.updateCompany(id, updatedData);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      
      // Asignar certificados automáticamente si la empresa tiene un membershipTypeId
      if (company.membershipTypeId) {
        try {
          const autoCertificates = await storage.getAutoCertificatesForMembership(company.membershipTypeId);
          console.log(`[Auto-Certificate] Found ${autoCertificates.length} certificates for membership type ${company.membershipTypeId}`);
          
          // Obtener certificados actuales
          const currentCertIds = (company.certificateIds as number[]) || [];
          
          for (const cert of autoCertificates) {
            // Solo asignar si no está ya asignado
            if (!currentCertIds.includes(cert.id)) {
              await storage.assignCertificateToCompany(company.id, cert.id, {
                fechaObtencion: new Date().toISOString().split('T')[0],
                asignadoPorAdmin: false,
                observaciones: 'Asignado automáticamente al actualizar la empresa'
              });
              console.log(`[Auto-Certificate] Assigned certificate ${cert.nombreCertificado} (ID: ${cert.id}) to company ${company.id}`);
            }
          }
        } catch (certError) {
          console.error('[Auto-Certificate] Error assigning certificates:', certError);
        }
      }
      
      const response: any = { ...company };
      if (representativeAssignment) {
        response.assignedCompanies = representativeAssignment.companies;
        response.assignedCompanyIds = representativeAssignment.companies.map(
          (assignedCompany) => assignedCompany.id,
        );
        response.assignedCompanyCount = representativeAssignment.companies.length;
        response.representativeAssignmentStatus = representativeAssignment.status;
      }
      res.json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update company" });
    }
  });

  app.delete("/api/companies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const company = await storage.getCompany(id);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }
      if (!(await verifyCompanyAccess(req, res, company))) {
        return;
      }
      const deleted = await storage.deleteCompany(id);
      if (!deleted) {
        return res.status(404).json({ error: "Company not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete company" });
    }
  });

  // Company Locations API
  // Obtener todas las ubicaciones de todas las empresas
  app.get("/api/companies/locations/all", async (req, res) => {
    try {
      const allLocations = await storage.getAllCompanyLocations();
      res.json(allLocations);
    } catch (error) {
      console.error("Error fetching all company locations:", error);
      res.status(500).json({ error: "Failed to fetch all company locations" });
    }
  });

  app.get("/api/companies/:id/locations", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const locations = await storage.getCompanyLocations(companyId);
      res.json(locations);
    } catch (error) {
      console.error("Error fetching company locations:", error);
      res.status(500).json({ error: "Failed to fetch company locations" });
    }
  });

  app.post("/api/companies/:id/locations", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (!(await verifyCompanyAccess(req, res, company))) return;

      const validatedData = insertCompanyLocationSchema.parse({
        ...req.body,
        companyId
      });
      const location = await storage.createCompanyLocation(validatedData);
      res.json(location);
    } catch (error) {
      console.error("Error creating company location:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create company location" });
    }
  });

  app.put("/api/companies/:id/locations/:locationId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (!(await verifyCompanyAccess(req, res, company))) return;

      const locationId = parseInt(req.params.locationId);
      const validatedData = insertCompanyLocationSchema.partial().parse(req.body);
      const location = await storage.updateCompanyLocation(companyId, locationId, validatedData);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      console.error("Error updating company location:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update company location" });
    }
  });

  app.delete("/api/companies/:id/locations/:locationId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (!(await verifyCompanyAccess(req, res, company))) return;

      const locationId = parseInt(req.params.locationId);
      const deleted = await storage.deleteCompanyLocation(companyId, locationId);
      if (!deleted) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company location:", error);
      res.status(500).json({ error: "Failed to delete company location" });
    }
  });

  // Payment receipt redirect - redirects to dashboard with receipt download trigger
  app.get("/api/companies/:id/payment-receipt", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        return res.status(404).send(`
          <html>
            <head><title>Recibo no encontrado</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
              <h1>Empresa no encontrada</h1>
              <p>El enlace de recibo no es válido.</p>
              <a href="/">Ir al inicio</a>
            </body>
          </html>
        `);
      }
      
      // Redirect to dashboard with receipt download parameter
      res.redirect(`/dashboard?download_receipt=true&company=${companyId}`);
    } catch (error) {
      console.error("Error with payment receipt redirect:", error);
      res.status(500).send(`
        <html>
          <head><title>Error</title></head>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>Error al procesar el recibo</h1>
            <p>Por favor, intenta nuevamente más tarde.</p>
            <a href="/">Ir al inicio</a>
          </body>
        </html>
      `);
    }
  });

  app.put("/api/companies/:id/locations/:locationId/set-principal", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);
      if (!company) return res.status(404).json({ error: "Company not found" });
      if (!(await verifyCompanyAccess(req, res, company))) return;

      const locationId = parseInt(req.params.locationId);
      const location = await storage.setPrincipalLocation(companyId, locationId);
      if (!location) {
        return res.status(404).json({ error: "Location not found" });
      }
      res.json(location);
    } catch (error) {
      console.error("Error setting principal location:", error);
      res.status(500).json({ error: "Failed to set principal location" });
    }
  });

  // Categories API
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // Tags API
  app.get("/api/tags", async (req, res) => {
    try {
      const tags = await storage.getAllTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.get("/api/tags/in-use", async (req, res) => {
    try {
      const tagsInUse = await storage.getTagsInUse();
      res.json(tagsInUse);
    } catch (error) {
      console.error("Error fetching tags in use:", error);
      res.status(500).json({ error: "Failed to fetch tags in use" });
    }
  });

  app.post("/api/tags", async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(validatedData);
      res.json(tag);
    } catch (error) {
      console.error("Error creating tag:", error);
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  app.put("/api/tags/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertTagSchema.parse(req.body);
      const tag = await storage.updateTag(id, validatedData);
      res.json(tag);
    } catch (error) {
      console.error("Error updating tag:", error);
      res.status(500).json({ error: "Failed to update tag" });
    }
  });

  app.delete("/api/tags/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTag(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting tag:", error);
      res.status(500).json({ error: error.message || "Failed to delete tag" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
      const id = parseInt(req.params.id);
      const categoryData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(id, categoryData);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCategory(id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Membership Types API
  app.get("/api/membership-types", async (req: any, res) => {
    try {
      const membershipTypes = await storage.getAllMembershipTypes();
      
      // Check if user is admin - if not, filter out private memberships
      const isAdmin = isAdminUser(req.user);
      
      if (!isAdmin) {
        // Filter out private memberships for non-admin users
        const publicMemberships = membershipTypes.filter((membership: any) => 
          !membership.visibilidad || membership.visibilidad === "publica"
        );
        res.json(publicMemberships);
      } else {
        // Admin users can see all memberships
        res.json(membershipTypes);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch membership types" });
    }
  });

  // Endpoint para obtener solo membresías públicas (para usuarios no administradores)
  app.get("/api/membership-types/public", async (req, res) => {
    try {
      const membershipTypes = await storage.getAllMembershipTypes();
      // Filtrar solo las membresías públicas
      const publicMemberships = membershipTypes.filter((membership: any) => 
        !membership.visibilidad || membership.visibilidad === "publica"
      );
      res.json(publicMemberships);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch public membership types" });
    }
  });

  app.get("/api/membership-types/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const membershipType = await storage.getMembershipType(id);
      if (!membershipType) {
        return res.status(404).json({ error: "Membership type not found" });
      }
      res.json(membershipType);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch membership type" });
    }
  });

  app.post("/api/membership-types", async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(403).json({ error: "Se requiere una cuenta de administrador verificada" });
      }
      if (!isValidConfiguredProjectLimit(req.body?.cantidadProyectosAdmitidos)) {
        return res.status(400).json({
          error: "El límite de proyectos debe ser un entero mayor o igual a 0, -1 o null para ilimitado",
        });
      }
      const membershipTypeData = insertMembershipTypeSchema.parse(req.body);
      const membershipType = await storage.createMembershipType(membershipTypeData);
      res.status(201).json(membershipType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create membership type" });
    }
  });

  app.put("/api/membership-types/:id", async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(403).json({ error: "Se requiere una cuenta de administrador verificada" });
      }
      if (!isValidConfiguredProjectLimit(req.body?.cantidadProyectosAdmitidos)) {
        return res.status(400).json({
          error: "El límite de proyectos debe ser un entero mayor o igual a 0, -1 o null para ilimitado",
        });
      }
      const id = parseInt(req.params.id);
      const membershipTypeData = insertMembershipTypeSchema.partial().parse(req.body);
      
      // If marking this plan as most popular, unmark all others
      if (membershipTypeData.masPopular === true) {
        await storage.clearMostPopularStatus();
      }
      
      const membershipType = await storage.updateMembershipType(id, membershipTypeData);
      if (!membershipType) {
        return res.status(404).json({ error: "Membership type not found" });
      }
      res.json(membershipType);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update membership type" });
    }
  });

  app.delete("/api/membership-types/:id", async (req, res) => {
    try {
      if (!(await isStronglyVerifiedAdminRequest(req))) {
        return res.status(403).json({ error: "Se requiere una cuenta de administrador verificada" });
      }
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteMembershipType(id);
      if (!deleted) {
        return res.status(404).json({ error: "Membership type not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete membership type" });
    }
  });

  // Certificates API
  // Determina si el solicitante es administrador y a qué empresa está delimitado.
  // El aislamiento de certificados por empresa se basa en la empresa del usuario
  // autenticado (companyId de su identidad), no en datos enviados libremente en el
  // cuerpo de la petición.
  type CertificateRequesterScope = {
    requester: any;
    isAdmin: boolean;
    scopedCompanyId: number | null;
    scopedCompanyIds: number[];
    invalidRequestedCompany: boolean;
  };

  const getCertificateRequesterScope = (req: any): CertificateRequesterScope => {
    const requester = req.user;
    const isAdmin = isAdminUser(requester);
    const scopedCompanyId =
      requester?.companyId != null && !isNaN(Number(requester.companyId))
        ? Number(requester.companyId)
        : null;
    return {
      requester,
      isAdmin,
      scopedCompanyId,
      scopedCompanyIds: scopedCompanyId != null ? [scopedCompanyId] : [],
      invalidRequestedCompany: false,
    };
  };

  // Igual que getCertificateRequesterScope, pero si la identidad del
  // representante NO trae companyId (p. ej. login normal con Firebase, cuya
  // identidad de usuario no incluye empresa), la empresa se resuelve en el
  // servidor por sus vínculos reales (dueño por userId, representantesVentas
  // o email de la empresa). Así el representante original tiene el mismo
  // alcance que cuando el admin lo impersona.
  const resolveCertificateRequesterScope = async (
    req: any,
  ): Promise<CertificateRequesterScope> => {
    const verifiedRequester = await getVerifiedRequestUser(req);
    const base = getCertificateRequesterScope({ ...req, user: verifiedRequester });
    if (!base.isAdmin && base.requester?.id != null) {
      try {
        const companies = await storage.getCompaniesForRepresentative(
          base.requester?.email || "",
          Number(base.requester.id),
        );
        if (companies.length > 0) {
          const scopedCompanyIds = companies.map((company) => company.id);
          const rawRequestedCompanyId =
            req.body?.companyId ?? req.query?.companyId ?? req.headers?.["x-company-id"];
          const requestedCompanyId =
            rawRequestedCompanyId != null && rawRequestedCompanyId !== ""
              ? Number(rawRequestedCompanyId)
              : null;

          if (
            requestedCompanyId !== null &&
            (!Number.isInteger(requestedCompanyId) || !scopedCompanyIds.includes(requestedCompanyId))
          ) {
            return {
              ...base,
              scopedCompanyId: null,
              scopedCompanyIds,
              invalidRequestedCompany: true,
            };
          }

          const fallbackCompanyId =
            base.scopedCompanyId != null && scopedCompanyIds.includes(base.scopedCompanyId)
              ? base.scopedCompanyId
              : companies[0].id;
          return {
            ...base,
            scopedCompanyId: requestedCompanyId ?? fallbackCompanyId,
            scopedCompanyIds,
            invalidRequestedCompany: false,
          };
        }
      } catch {
        /* sin empresa resoluble: el scope queda sin companyId */
      }
    }
    return base;
  };

  // Verifica en el servidor que una empresa está dentro del alcance resuelto
  // para el solicitante. Storage aplica asociaciones normalizadas como única
  // autoridad y solo usa vínculos heredados si todavía no existe ninguna.
  const companyBelongsToRequester = async (company: any, requester: any): Promise<boolean> => {
    if (!company || requester?.id == null) return false;
    const associatedCompanies = await storage.getCompaniesForRepresentative(
      requester.email || "",
      Number(requester.id),
    );
    return associatedCompanies.some((associated) => associated.id === company.id);
  };

  app.get("/api/certificates", async (req: any, res) => {
    try {
      const certificates = await storage.getAllCertificates();
      const { requester, isAdmin, scopedCompanyId, scopedCompanyIds = [] } =
        await resolveCertificateRequesterScope(req);

      // Admin: ve todos los certificados.
      if (isAdmin) {
        return res.json(certificates);
      }

      // Representante autenticado con empresa: SOLO los certificados de SU empresa
      // (más los reconocimientos globales del administrador, que son compartidos).
      if (requester && scopedCompanyId != null) {
        const filtered = certificates.filter(
          (cert) =>
            (cert as any).creadoPorAdmin === true ||
            (cert as any).companyId === scopedCompanyId ||
            scopedCompanyIds.includes((cert as any).companyId)
        );
        return res.json(filtered);
      }

      // Sin sesión válida: solo certificados globales del administrador (nunca los
      // de empresas concretas), para no filtrar datos entre empresas.
      const publicOnly = certificates.filter(
        (cert) => (cert as any).creadoPorAdmin === true
      );
      res.json(publicOnly);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch certificates" });
    }
  });

  app.get("/api/certificates/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const certificate = await storage.getCertificate(id);
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }

      const { isAdmin, scopedCompanyId, scopedCompanyIds = [] } =
        await resolveCertificateRequesterScope(req);
      const certCompanyId = (certificate as any).companyId as number | null;
      const isAdminCert = (certificate as any).creadoPorAdmin === true;

      // Admin: acceso total. Certificados globales del admin: visibles para todos.
      // Certificados de empresa: solo la empresa dueña.
      if (
        isAdmin ||
        isAdminCert ||
        (scopedCompanyId != null && certCompanyId === scopedCompanyId) ||
        (certCompanyId != null && scopedCompanyIds.includes(certCompanyId))
      ) {
        return res.json(certificate);
      }

      return res.status(403).json({ error: "No autorizado para ver este certificado" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch certificate" });
    }
  });

  app.post("/api/certificates", uploadImage.single('imageFile'), validateUploadedImages, async (req, res) => {
    try {
      console.log("Datos recibidos para certificado:", req.body);
      console.log("Archivo recibido:", req.file);
      
      let certificateData: any = {};
      if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
      
      // Si hay archivo de imagen, procesarlo
      if (req.file) {
        certificateData.imagenUrl = `/uploads/images/${req.file.filename}`;
      }
      
      // Procesar los demás campos del formulario
      Object.entries(req.body).forEach(([key, value]) => {
        if (key !== 'imageFile' && key !== 'companyId') {
          if (key === 'membershipPlanIds' || key === 'planesMembresia') {
            try {
              let parsed = JSON.parse(value as string);
              // Forzar que siempre sea un array
              certificateData.membershipPlanIds = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
              // Si no se puede parsear, tratar como array
              certificateData.membershipPlanIds = Array.isArray(value) ? value : [value];
            }
          } else if (key === 'asignacionAutomatica') {
            // Manejar tanto boolean (JSON) como string (FormData)
            certificateData[key] = typeof value === 'boolean' ? value : value === 'true';
          } else {
            certificateData[key] = value;
          }
        }
      });
      
      const {
        requester,
        isAdmin,
        scopedCompanyId: resolvedCompanyId,
        invalidRequestedCompany,
      } =
        await resolveCertificateRequesterScope(req as any);

      // Se requiere sesión: sin usuario no se puede determinar la empresa dueña.
      if (!requester?.id && !isAdmin) {
        return res.status(401).json({ error: "No autenticado" });
      }

      // Determinar la empresa DUEÑA del certificado.
      // - Representante: SIEMPRE su propia empresa (tomada de su identidad
      //   autenticada). Nunca se acepta un companyId enviado por el cliente, así
      //   un certificado no puede asociarse a una empresa ajena.
      // - Administrador: puede crear certificados globales (companyId nulo, p.ej.
      //   reconocimientos ANPR con asignación automática) o específicos de una
      //   empresa si envía companyId.
      let ownerCompanyId: number | null = null;

      if (isAdmin) {
        const rawCompanyId = (req.body as any)?.companyId;
        const parsed = rawCompanyId ? parseInt(rawCompanyId as string) : NaN;
        if (!isNaN(parsed)) {
          const targetCompany = await storage.getCompany(parsed);
          if (!targetCompany) {
            return res.status(404).json({ error: "Empresa no encontrada" });
          }
          ownerCompanyId = parsed;
        }
      } else {
        if (invalidRequestedCompany) {
          return res.status(403).json({
            error: "No autorizado para crear certificados en esta empresa.",
          });
        }
        // Representante: la empresa se obtiene de la sesión y se valida que exista
        // y que realmente le pertenezca (dueño por userId o delimitado por su
        // identidad de empresa). Se ignora cualquier companyId del cuerpo.
        if (resolvedCompanyId == null) {
          return res.status(403).json({
            error: "Tu usuario no tiene una empresa asociada para crear certificados.",
          });
        }
        const ownCompany = await storage.getCompany(resolvedCompanyId);
        if (!ownCompany || !(await companyBelongsToRequester(ownCompany, requester))) {
          return res.status(403).json({
            error: "No autorizado para crear certificados en esta empresa.",
          });
        }
        ownerCompanyId = resolvedCompanyId;

        // Un representante nunca crea certificados globales ni de asignación
        // automática: se fuerzan aislados a su propia empresa.
        certificateData.creadoPorAdmin = false;
        certificateData.asignacionAutomatica = false;
        certificateData.membershipPlanIds = [];
      }

      // Validar los datos (companyId NO forma parte del esquema: lo fija el backend)
      const validatedData = insertCertificateSchema.parse(certificateData);
      console.log("Datos validados:", validatedData);

      const certificate = await storage.createCertificate(validatedData, ownerCompanyId);

      // Vincular el certificado a su empresa dueña mediante el arreglo
      // `certificateIds` para que aparezca en su panel y perfil público. Los
      // certificados globales del admin (sin empresa) se asignan por otros flujos.
      if (ownerCompanyId != null) {
        try {
          await storage.assignCertificateToCompany(ownerCompanyId, certificate.id, {
            fechaObtencion: new Date().toISOString().split("T")[0],
            asignadoPorAdmin: !!isAdmin,
          });
        } catch (linkError) {
          console.error("No se pudo vincular el certificado a la empresa:", linkError);
        }
      }

      res.status(201).json(certificate);
    } catch (error) {
      console.error("Error al crear certificado:", error);
      if (error instanceof z.ZodError) {
        console.error("Errores de validación:", error.errors);
        return res.status(400).json({ 
          error: "Validation error", 
          details: error.errors,
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      res.status(500).json({ 
        error: "Failed to create certificate",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Autoriza operaciones de escritura (editar/eliminar) sobre un certificado.
  // Admin: siempre. Representante: solo si el certificado pertenece a SU empresa
  // y no es un certificado global del administrador. Devuelve el certificado si
  // está autorizado, o un objeto con el código de error a responder.
  const authorizeCertificateWrite = async (
    req: any,
    id: number,
  ): Promise<{ ok: true; certificate: any } | { ok: false; status: number; error: string }> => {
    const certificate = await storage.getCertificate(id);
    if (!certificate) {
      return { ok: false, status: 404, error: "Certificate not found" };
    }
    const { requester, isAdmin, scopedCompanyId, scopedCompanyIds = [] } =
      await resolveCertificateRequesterScope(req);
    if (isAdmin) {
      return { ok: true, certificate };
    }
    if (!requester?.id) {
      return { ok: false, status: 401, error: "No autenticado" };
    }
    const certCompanyId = (certificate as any).companyId as number | null;
    const isAdminCert = (certificate as any).creadoPorAdmin === true;
    if (isAdminCert) {
      return { ok: false, status: 403, error: "Este certificado es de ANPR y no puede modificarse." };
    }
    if (
      (scopedCompanyId == null || certCompanyId !== scopedCompanyId) &&
      !(certCompanyId != null && scopedCompanyIds.includes(certCompanyId))
    ) {
      return { ok: false, status: 403, error: "No autorizado: este certificado pertenece a otra empresa." };
    }
    return { ok: true, certificate };
  };

  // Ruta PUT para actualizar certificados con archivos de imagen
  app.put("/api/certificates/:id", uploadImage.single('imageFile'), validateUploadedImages, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);

      // Validar propiedad antes de modificar.
      const authz = await authorizeCertificateWrite(req, id);
      if (!authz.ok) {
        return res.status(authz.status).json({ error: authz.error });
      }

      let updateData: any = {};
      if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
      
      console.log('=== PUT Certificate Debug ===');
      console.log('Request body:', req.body);
      console.log('Has file:', !!req.file);
      console.log('Content-Type:', req.get('content-type'));
      
      // Si hay archivo de imagen, procesarlo
      if (req.file) {
        updateData.imagenUrl = `/uploads/images/${req.file.filename}`;
      }
      
      // Detectar si la request es FormData o JSON
      const isFormData = req.get('content-type')?.includes('multipart/form-data');
      
      if (isFormData) {
        // Procesar campos de FormData (cuando hay archivo)
        Object.entries(req.body).forEach(([key, value]) => {
          if (key !== 'imageFile') {
            if (key === 'membershipPlanIds' || key === 'planesMembresia') {
              try {
                let parsed = JSON.parse(value as string);
                // Forzar que siempre sea un array
                updateData.membershipPlanIds = Array.isArray(parsed) ? parsed : [parsed];
              } catch (e) {
                updateData.membershipPlanIds = Array.isArray(value) ? value : [value];
              }
            } else if (key === 'asignacionAutomatica') {
              updateData[key] = value === 'true';
            } else {
              updateData[key] = value;
            }
          }
        });
      } else {
        // Procesar datos JSON (cuando no hay archivo)
        Object.entries(req.body).forEach(([key, value]) => {
          if (key !== 'imageFile') {
            if (key === 'asignacionAutomatica') {
              // Convertir a boolean si viene como string o ya es boolean
              updateData[key] = typeof value === 'string' ? value === 'true' : Boolean(value);
            } else if (key === 'membershipPlanIds' || key === 'planesMembresia') {
              // Forzar que siempre sea un array
              updateData.membershipPlanIds = Array.isArray(value) ? value : (value ? [value] : []);
            } else {
              updateData[key] = value;
            }
          }
        });
      }
      
      console.log('Processed updateData:', updateData);
      
      // Validar los datos
      const certificateData = insertCertificateSchema.partial().parse(updateData);
      console.log('Validated certificateData:', certificateData);
      
      // Actualizar certificado
      const certificate = await storage.updateCertificate(id, certificateData);
      if (!certificate) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      
      console.log('Updated certificate:', certificate);
      res.json(certificate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation errors:", error.errors);
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("Error updating certificate:", error);
      res.status(500).json({ error: "Failed to update certificate" });
    }
  });

  app.delete("/api/certificates/:id", async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);

      // Validar propiedad antes de eliminar.
      const authz = await authorizeCertificateWrite(req, id);
      if (!authz.ok) {
        return res.status(authz.status).json({ error: authz.error });
      }

      // Desvincular el certificado de su empresa dueña para no dejar referencias
      // colgadas en `certificateIds`.
      const certCompanyId = (authz.certificate as any).companyId as number | null;
      if (certCompanyId != null) {
        try {
          await storage.removeCertificateFromCompany(certCompanyId, id);
        } catch (cleanupError) {
          console.error("No se pudo desvincular el certificado de la empresa:", cleanupError);
        }
      }

      const deleted = await storage.deleteCertificate(id);
      if (!deleted) {
        return res.status(404).json({ error: "Certificate not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete certificate" });
    }
  });

  // Roles API
  app.get("/api/roles", async (req, res) => {
    try {
      const roles = await storage.getAllRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = await storage.getRole(id);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", async (req, res) => {
    try {
      const roleData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(roleData);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  app.put("/api/roles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const roleData = insertRoleSchema.partial().parse(req.body);
      const role = await storage.updateRole(id, roleData);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteRole(id);
      if (!deleted) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      if (error.message === "No se puede eliminar un rol del sistema") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // Opinions API
  app.get("/api/opinions", async (req, res) => {
    try {
      const { estado, companyId, tipo, userId, page = "1", limit = "50" } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
      const verifiedUser = await getVerifiedRequestUser(req);
      const requestedUserId = userId ? parseInt(userId as string) : undefined;
      const verifiedAdmin = !!verifiedUser && isAdminUser(verifiedUser);
      const verifiedPlatformOwner = !!verifiedUser
        && tipo === "plataforma"
        && requestedUserId === Number(verifiedUser.id);
      
      const options = {
        estado: estado as string,
        companyId: companyId ? parseInt(companyId as string) : undefined,
        tipo: tipo as string,
        userId: requestedUserId,
        // General/public requests are always restricted in storage. A verified
        // owner may see every state of only their own platform review, while a
        // verified administrator may use the full moderation listing.
        includeAllStates: verifiedAdmin || verifiedPlatformOwner,
        limit: limitNum,
        offset,
      };
      
      const result = await storage.getAllOpinions(options);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch opinions" });
    }
  });

  app.get("/api/opinions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const opinion = await storage.getOpinion(id);
      if (!opinion) {
        return res.status(404).json({ error: "Opinion not found" });
      }
      const verifiedUser = await getVerifiedRequestUser(req);
      const canSeeNonPublic = !!verifiedUser && (
        isAdminUser(verifiedUser)
        || (opinion.tipo === "plataforma" && Number(opinion.userId) === Number(verifiedUser.id))
      );
      const isPublic = opinion.estado === "aprobada"
        || opinion.estado === null
        || String(opinion.estado).trim() === "";
      if (!isPublic && !canSeeNonPublic) {
        return res.status(404).json({ error: "Opinion not found" });
      }
      res.json(opinion);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch opinion" });
    }
  });

  app.post("/api/opinions", async (req, res) => {
    try {
      const opinionData = insertOpinionSchema.parse(req.body);
      // Neither company nor platform review creation can self-approve.
      opinionData.estado = "pendiente";

      // Las reseñas de plataforma requieren un usuario autenticado real.
      // La identidad se toma del servidor (header procesado por el middleware),
      // NUNCA de los campos que envía el cliente, y se limita a una reseña por
      // usuario para evitar abuso del correo de notificación a los admins.
      if (opinionData.tipo === "plataforma") {
        const verifiedUser = await getVerifiedRequestUser(req);
        const requesterId = Number(verifiedUser?.id);
        if (!requesterId || isNaN(requesterId)) {
          return res.status(401).json({ error: "Debes iniciar sesión para enviar una reseña" });
        }
        const dbUser = await storage.getUser(requesterId);
        if (!dbUser) {
          return res.status(401).json({ error: "Usuario no válido" });
        }
        const existing = await storage.getAllOpinions({
          tipo: "plataforma",
          userId: dbUser.id,
          includeAllStates: true,
          limit: 1,
        });
        if (existing.total > 0) {
          return res.status(409).json({ error: "Ya tienes una reseña registrada. Edita la existente." });
        }
        opinionData.userId = dbUser.id;
        opinionData.nombre = dbUser.displayName || dbUser.email;
        opinionData.email = dbUser.email;
        opinionData.companyId = null;
      }

      const opinion = await storage.createOpinion(opinionData);

      // Notificar a los administradores por correo cuando llega una reseña de
      // plataforma pendiente de moderación (sin bloquear la respuesta).
      if (opinion.tipo === "plataforma" && opinion.estado === "pendiente") {
        sendNewReviewNotificationToAdmins({
          nombre: opinion.nombre,
          email: opinion.email,
          calificacion: opinion.calificacion,
          comentario: opinion.comentario,
        }).catch((err) => console.error("Error notifying admins of new review:", err));
      }

      res.status(201).json(opinion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create opinion" });
    }
  });

  // Solo el dueño de una reseña de plataforma (o un admin) puede modificarla
  // o borrarla. Devuelve el error a responder, o null si está permitido.
  const opinionWriteGuard = async (req: any, id: number) => {
    const existing = await storage.getOpinion(id);
    if (!existing) return { status: 404, error: "Opinion not found" };
    const verifiedUser = await getVerifiedRequestUser(req);
    const requesterId = Number(verifiedUser?.id);
    const isAdmin = !!verifiedUser && isAdminUser(verifiedUser);
    if (isAdmin) return null;
    if (
      existing.tipo !== "plataforma"
      || !requesterId
      || isNaN(requesterId)
      || Number(existing.userId) !== requesterId
    ) {
      return { status: 403, error: "No tienes permiso sobre esta reseña" };
    }
    return null;
  };

  app.put("/api/opinions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const guardError = await opinionWriteGuard(req, id);
      if (guardError) {
        return res.status(guardError.status).json({ error: guardError.error });
      }
      const opinionData = insertOpinionSchema.partial().parse(req.body);
      // El cliente no puede reasignar la reseña ni cambiar su tipo o estado
      // de aprobación al editar: una edición siempre vuelve a moderación.
      delete (opinionData as any).userId;
      delete (opinionData as any).tipo;
      delete (opinionData as any).companyId;
      const verifiedUser = await getVerifiedRequestUser(req);
      if (!verifiedUser || !isAdminUser(verifiedUser)) {
        opinionData.estado = "pendiente";
      }
      const opinion = await storage.updateOpinion(id, opinionData);
      if (!opinion) {
        return res.status(404).json({ error: "Opinion not found" });
      }
      res.json(opinion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update opinion" });
    }
  });

  app.delete("/api/opinions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const guardError = await opinionWriteGuard(req, id);
      if (guardError) {
        return res.status(guardError.status).json({ error: guardError.error });
      }
      const deleted = await storage.deleteOpinion(id);
      if (!deleted) {
        return res.status(404).json({ error: "Opinion not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete opinion" });
    }
  });

  const requireVerifiedOpinionAdmin = async (req: any, res: any, next: any) => {
    const verifiedUser = await getVerifiedRequestUser(req);
    if (!verifiedUser || !isAdminUser(verifiedUser)) {
      return res.status(403).json({ error: "Se requiere una cuenta de administrador verificada" });
    }
    req.verifiedOpinionAdmin = verifiedUser;
    next();
  };

  app.post("/api/opinions/:id/approve", requireVerifiedOpinionAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const approvedBy = Number(req.verifiedOpinionAdmin.id);
      const opinion = await storage.approveOpinion(id, approvedBy);
      if (!opinion) {
        return res.status(404).json({ error: "Opinion not found" });
      }
      res.json(opinion);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve opinion" });
    }
  });

  app.post("/api/opinions/:id/reject", requireVerifiedOpinionAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const approvedBy = Number(req.verifiedOpinionAdmin.id);
      const opinion = await storage.rejectOpinion(id, approvedBy);
      if (!opinion) {
        return res.status(404).json({ error: "Opinion not found" });
      }
      res.json(opinion);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject opinion" });
    }
  });

  // Moderate opinion endpoint (handles both approve and reject)
  app.patch("/api/opinions/:id/moderate", requireVerifiedOpinionAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { estado, comentarioModerador } = req.body;
      const approvedBy = Number(req.verifiedOpinionAdmin.id);
      
      let opinion;
      if (estado === "aprobada") {
        opinion = await storage.approveOpinion(id, approvedBy);
      } else if (estado === "rechazada") {
        opinion = await storage.rejectOpinion(id, approvedBy);
      } else {
        return res.status(400).json({ error: "Invalid estado. Must be 'aprobada' or 'rechazada'" });
      }
      
      if (!opinion) {
        return res.status(404).json({ error: "Opinion not found" });
      }
      
      res.json(opinion);
    } catch (error) {
      res.status(500).json({ error: "Failed to moderate opinion" });
    }
  });

  // Statistics API
  app.get("/api/statistics", async (req, res) => {
    try {
      const statistics = await storage.getStatistics();
      res.json(statistics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // Check if email exists
  app.post("/api/check-email", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      
      return res.json({ exists: !!existingUser });
    } catch (error) {
      console.error("Error checking email:", error);
      res.status(500).json({ error: "Failed to check email" });
    }
  });

  // Stripe Payment Routes for Memberships
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { membershipTypeId, companyId, selectedPeriod } = req.body;
      
      if (!membershipTypeId) {
        return res.status(400).json({ error: "Missing membershipTypeId" });
      }

      // Get membership type to get the price
      const membershipType = await storage.getMembershipType(membershipTypeId);
      if (!membershipType) {
        return res.status(404).json({ error: "Membership type not found" });
      }

      // Get company to verify it exists (only if companyId is provided)
      let company = null;
      if (companyId) {
        company = await storage.getCompany(companyId);
        if (!company) {
          return res.status(404).json({ error: "Company not found" });
        }
      }

      // Extract the cost from pricing options
      let amount = 0;
      let selectedPricingOption: any = null;
      
      if (membershipType.opcionesPrecios && Array.isArray(membershipType.opcionesPrecios) && membershipType.opcionesPrecios.length > 0) {
        // Prefer the pricing option matching the requested period; fall back to annual or the first option
        if (selectedPeriod) {
          selectedPricingOption = membershipType.opcionesPrecios.find((option: any) =>
            option.periodicidad && option.periodicidad.toLowerCase() === selectedPeriod.toString().toLowerCase()
          ) || null;
        }
        if (!selectedPricingOption) {
          selectedPricingOption = membershipType.opcionesPrecios.find((option: any) => 
            option.periodicidad && option.periodicidad.toLowerCase() === 'anual'
          ) || membershipType.opcionesPrecios[0];
        }
        
        amount = parseFloat(selectedPricingOption?.costo?.toString() || "0") || 0;
      }

      if (amount <= 0) {
        return res.status(400).json({ error: "Invalid membership cost configuration. No valid pricing found." });
      }

      // Prepare metadata
      const metadata: any = {
        membershipTypeId: membershipTypeId.toString(),
        isNewMembership: companyId ? "false" : "true",
      };

      if (selectedPricingOption?.periodicidad) {
        metadata.selectedPeriod = selectedPricingOption.periodicidad.toString();
      }
      
      if (companyId && company) {
        metadata.companyId = companyId.toString();
        metadata.userId = (company.userId || 0).toString();
      }

      const stripe = await getStripe();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: await getConfiguredCurrency(),
        metadata,
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id 
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  // Webhook endpoint for Stripe events
  // Aplica el cambio de plan PROGRAMADO de una empresa: mueve el próximo plan a
  // plan activo, actualiza las fechas del nuevo período, registra el pago y
  // limpia los campos del cambio pendiente. Se usa tanto en la renovación pagada
  // de Stripe (webhook) como en la tarea diaria para empresas sin suscripción.
  async function applyPendingPlanChange(
    company: any,
    opts: {
      periodEndUnix?: number | null;
      stripePaymentIntentId?: string | null;
      amount?: number | string | null;
      currency?: string | null;
      recordPayment?: boolean;
    } = {}
  ) {
    if (!company?.pendingMembershipTypeId) return;

    const newPlanId = company.pendingMembershipTypeId;
    const periodicidad = (company.pendingMembershipPeriodicidad ||
      company.membershipPeriodicidad ||
      "anual") as "mensual" | "anual";

    // Fecha de inicio = hoy. Fecha fin = período de Stripe si viene, si no se
    // calcula según la periodicidad del nuevo plan.
    const startDate = new Date();
    let endDate = new Date(startDate);
    if (opts.periodEndUnix) {
      endDate = new Date(opts.periodEndUnix * 1000);
    } else if (periodicidad === "mensual") {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    await storage.updateCompany(company.id, {
      membershipTypeId: newPlanId,
      membershipPeriodicidad: periodicidad,
      fechaInicioMembresia: startDate.toISOString().split("T")[0],
      fechaFinMembresia: endDate.toISOString().split("T")[0],
      // El cambio se aplicó tras pago confirmado: limpiar el pendiente y sus estados.
      pendingMembershipTypeId: null,
      pendingMembershipPeriodicidad: null,
      pendingMembershipPrice: null,
      pendingChangeEffectiveDate: null,
      pendingStripeScheduleId: null,
      pendingChangeStatus: null,
      pendingPaymentStatus: null,
    });

    if (opts.recordPayment && company.userId) {
      try {
        await storage.createMembershipPayment({
          userId: company.userId,
          companyId: company.id,
          membershipTypeId: newPlanId,
          // Debe ser único; si no hay pago de Stripe usamos un id sintético.
          stripePaymentIntentId:
            opts.stripePaymentIntentId ||
            `manual-renewal-${company.id}-${Date.now()}`,
          amount:
            opts.amount != null
              ? String(opts.amount)
              : company.pendingMembershipPrice || "0",
          currency: opts.currency || (await getConfiguredCurrency()),
          status: "succeeded",
        });
      } catch (paymentError) {
        console.error("Error registrando pago de renovación:", paymentError);
      }
    }

    console.log(
      `Cambio de plan APLICADO para empresa ${company.id}: -> plan ${newPlanId} (${periodicidad})`
    );
  }

  app.post("/api/stripe-webhook", async (req, res) => {
    let processedEventId: string | null = null;
    try {
      const sig = req.headers['stripe-signature'];
      let event;

      const { stripe, webhookSecret } = await getStripeContext();
      if (!webhookSecret) {
        console.error('Webhook secret no configurado (panel de Stripe o STRIPE_WEBHOOK_SECRET).');
        return res.status(400).send('Webhook secret not configured.');
      }

      try {
        event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed.');
        return res.status(400).send('Webhook signature verification failed.');
      }

      // IDEMPOTENCIA: registrar el event.id ANTES de procesar. Si ya existe
      // (reintento de Stripe o entrega duplicada), respondemos 200 sin volver a
      // aplicar cobros/cambios. La atomicidad la garantiza la PK de la tabla.
      // Si la lógica posterior falla, el catch libera este id para reintento.
      const isNewEvent = await storage.markStripeEventProcessed(event.id, event.type);
      if (!isNewEvent) {
        console.log(`Evento de Stripe duplicado ignorado: ${event.id} (${event.type})`);
        return res.json({ received: true, duplicate: true });
      }
      processedEventId = event.id;

      // Helper: registrar un pago sin violar la restricción unique (idempotente).
      const recordPaymentSafe = async (payment: {
        userId: number;
        companyId: number;
        membershipTypeId: number;
        stripePaymentIntentId: string;
        amount: string;
        currency: string;
        status: string;
      }) => {
        const existing = await storage.getMembershipPaymentByStripeId(payment.stripePaymentIntentId);
        if (existing) return;
        await storage.createMembershipPayment(payment as any);
      };

      // Helper: resolver la empresa objetivo de una factura/suscripción.
      // Prioriza subscription.metadata.companyId; si no, usa la única empresa
      // del usuario dueño del customer (si tiene exactamente una).
      const resolveTargetCompany = async (
        subscription: any,
        customerId: string | undefined
      ): Promise<any | null> => {
        const metaCompanyId = subscription?.metadata?.companyId
          ? parseInt(subscription.metadata.companyId)
          : null;
        if (metaCompanyId) {
          const c = await storage.getCompany(metaCompanyId);
          if (c) return c;
        }
        if (customerId) {
          const u = await storage.getUserByStripeCustomerId(customerId);
          if (u) {
            const companies = await storage.getCompaniesByUser(u.id);
            if (companies.length === 1) return companies[0];
          }
        }
        return null;
      };

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          // Los PaymentIntents ligados a una factura (invoice) los maneja el
          // flujo de suscripción (invoice.payment_succeeded). Aquí solo tratamos
          // cobros ÚNICOS independientes para no duplicar registros/fechas.
          if ((paymentIntent as any).invoice) {
            console.log('PaymentIntent de suscripción (tiene invoice); manejado por invoice.payment_succeeded.');
            break;
          }

          // Record the payment in database
          const membershipTypeId = parseInt(paymentIntent.metadata.membershipTypeId);
          const isNewMembership = paymentIntent.metadata.isNewMembership === "true";

          if (!paymentIntent.metadata.membershipTypeId) {
            console.log('PaymentIntent sin membershipTypeId; se ignora.');
            break;
          }

          if (isNewMembership) {
            // Handle new membership payment (without specific company)
            await recordPaymentSafe({
              userId: 0, // For new memberships, we don't have a user yet
              companyId: 0, // For new memberships, we don't have a company yet
              membershipTypeId,
              stripePaymentIntentId: paymentIntent.id,
              amount: (paymentIntent.amount / 100).toString(),
              currency: paymentIntent.currency,
              status: 'succeeded',
            });
          } else {
            // Handle company membership update
            const companyId = parseInt(paymentIntent.metadata.companyId);
            const userId = parseInt(paymentIntent.metadata.userId);

            await recordPaymentSafe({
              userId,
              companyId,
              membershipTypeId,
              stripePaymentIntentId: paymentIntent.id,
              amount: (paymentIntent.amount / 100).toString(),
              currency: paymentIntent.currency,
              status: 'succeeded',
            });

            // Update company's membership type. Un pago exitoso confirmado
            // también reactiva la empresa si estaba inactiva por falta de pago.
            await storage.updateCompany(companyId, {
              membershipTypeId,
              estado: 'activo',
              inactiveReason: null,
              inactivatedAt: null,
            });
          }

          console.log('PaymentIntent was successful!');
          break;
        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object as Stripe.PaymentIntent;
          
          // Update payment status to failed
          const existingPayment = await storage.getMembershipPaymentByStripeId(failedPayment.id);
          if (existingPayment) {
            await storage.updateMembershipPaymentStatus(existingPayment.id, 'failed');
          }
          
          console.log('PaymentIntent failed.');
          break;
        case 'invoice.payment_succeeded': {
          // Factura de suscripción pagada. Dos casos:
          //  - subscription_create: PRIMERA factura → activar membresía y fijar fechas.
          //  - subscription_cycle: RENOVACIÓN → extender fecha fin (y aplicar cambio
          //    de plan programado si corresponde a esta suscripción).
          const invoice = event.data.object as Stripe.Invoice;
          const billingReason = invoice.billing_reason || '';

          const customerId = typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;

          const invoiceSubscriptionId = getInvoiceSubscriptionId(invoice);

          // Solo procesamos facturas de SUSCRIPCIÓN aquí.
          if (!invoiceSubscriptionId) {
            console.log(`Invoice ${invoice.id} sin suscripción; se ignora en este handler.`);
            break;
          }

          let subscription: any = null;
          try {
            subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId);
          } catch (subErr) {
            console.warn('No se pudo recuperar la suscripción de la factura:', subErr);
          }

          // Metadata de la suscripción. Si la recuperación falló (o viene vacía),
          // usamos la metadata embebida en la factura (basil la expone en
          // invoice.parent.subscription_details.metadata) para no perder el mapeo.
          const subMetadata: Record<string, string> =
            (subscription?.metadata && Object.keys(subscription.metadata).length)
              ? subscription.metadata
              : (getInvoiceSubscriptionMetadata(invoice) || {});

          const invoiceScheduleId = subscription
            ? (typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule?.id || null)
            : null;

          const periodEndUnix = (invoice.lines?.data?.[0] as any)?.period?.end
            || getSubscriptionPeriodEnd(subscription)
            || null;
          const periodEndDate = periodEndUnix
            ? new Date(periodEndUnix * 1000).toISOString().split('T')[0]
            : null;
          const invoicePaymentIntentId = typeof (invoice as any).payment_intent === 'string'
            ? (invoice as any).payment_intent
            : (invoice as any).payment_intent?.id || `invoice-${invoice.id}`;

          // --- PRIMERA factura (alta): activar la membresía y fijar fechas. ---
          if (billingReason === 'subscription_create') {
            const company = await resolveTargetCompany({ metadata: subMetadata }, customerId);
            if (!company) {
              console.log(`Invoice ${invoice.id} (create): empresa aún no localizable; la activa complete-registration.`);
              break;
            }
            await storage.updateCompany(company.id, {
              estado: 'activo',
              inactiveReason: null,
              inactivatedAt: null,
              ...(subMetadata.membershipTypeId
                ? { membershipTypeId: parseInt(subMetadata.membershipTypeId) }
                : {}),
              ...(subMetadata.selectedPeriod
                ? { membershipPeriodicidad: subMetadata.selectedPeriod as "mensual" | "anual" }
                : {}),
              ...(periodEndDate ? { fechaFinMembresia: periodEndDate } : {}),
            });
            await recordPaymentSafe({
              userId: company.userId ?? 0,
              companyId: company.id,
              membershipTypeId: company.membershipTypeId ?? 0,
              stripePaymentIntentId: invoicePaymentIntentId,
              amount: ((invoice.amount_paid ?? 0) / 100).toString(),
              currency: invoice.currency,
              status: 'succeeded',
            });
            console.log(`Invoice payment succeeded (alta activada, empresa ${company.id}).`);
            break;
          }

          // --- RENOVACIÓN (subscription_cycle) o cualquier factura recurrente. ---
          const invoiceUser = customerId ? await storage.getUserByStripeCustomerId(customerId) : null;
          const userCompanies = invoiceUser ? await storage.getCompaniesByUser(invoiceUser.id) : [];

          // 1) Empresas con cambio de plan programado que coincide con esta suscripción.
          const pendingCompanies = invoiceScheduleId
            ? userCompanies.filter((c) => c.pendingMembershipTypeId && c.pendingStripeScheduleId === invoiceScheduleId)
            : [];

          for (const c of pendingCompanies) {
            await applyPendingPlanChange(c, {
              periodEndUnix,
              stripePaymentIntentId: `${invoicePaymentIntentId}-${c.id}`,
              amount: (invoice.amount_paid ?? 0) / 100,
              currency: invoice.currency,
              recordPayment: true,
            });
          }

          // 2) Renovación normal SIN cambio programado: extender la fecha fin de la
          //    empresa objetivo (para que el dashboard refleje el nuevo periodo).
          const pendingIds = new Set(pendingCompanies.map((c) => c.id));
          const targetCompany = await resolveTargetCompany({ metadata: subMetadata }, customerId);
          if (targetCompany && !pendingIds.has(targetCompany.id)) {
            if (periodEndDate) {
              // Pago de renovación confirmado: reactivar la empresa si estaba
              // inactiva por falta de pago y limpiar motivo/fecha de inactivación.
              await storage.updateCompany(targetCompany.id, {
                estado: 'activo',
                fechaFinMembresia: periodEndDate,
                membershipCancelled: false,
                inactiveReason: null,
                inactivatedAt: null,
              });
            }
            await recordPaymentSafe({
              userId: targetCompany.userId ?? 0,
              companyId: targetCompany.id,
              membershipTypeId: targetCompany.membershipTypeId ?? 0,
              stripePaymentIntentId: `${invoicePaymentIntentId}-${targetCompany.id}`,
              amount: ((invoice.amount_paid ?? 0) / 100).toString(),
              currency: invoice.currency,
              status: 'succeeded',
            });

            // Notificar por correo al representante que su membresía se renovó.
            try {
              const renewalUser = targetCompany.userId ? await storage.getUser(targetCompany.userId) : invoiceUser;
              const planName = targetCompany.membershipType?.nombrePlan
                || (targetCompany.membershipTypeId
                  ? (await storage.getMembershipType(targetCompany.membershipTypeId))?.nombrePlan
                  : undefined);
              if (renewalUser?.email && periodEndDate) {
                await sendRenewalEmail(
                  renewalUser.email,
                  renewalUser.displayName || renewalUser.email,
                  targetCompany.nombreEmpresa,
                  planName || 'Membresía',
                  new Date(`${periodEndDate}T12:00:00`)
                );
              }
            } catch (renewalEmailError) {
              console.error('Error sending renewal email:', renewalEmailError);
            }
          }

          console.log(
            `Invoice payment succeeded (renovación: ${pendingCompanies.length} con cambio, ` +
            `${targetCompany && !pendingIds.has(targetCompany.id) ? 1 : 0} extensión normal).`
          );
          break;
        }
        case 'customer.subscription.updated': {
          // Cambios de estado de la suscripción (p.ej. cancelación programada o
          // reanudación). Sincronizamos autoRenewal (usuario) y membershipCancelled.
          const subscription = event.data.object as any;
          const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;
          if (!customerId) break;

          const subUser = await storage.getUserByStripeCustomerId(customerId);
          if (subUser) {
            await storage.updateUser(subUser.id, { autoRenewal: !subscription.cancel_at_period_end });
          }

          const targetCompany = await resolveTargetCompany(subscription, customerId);
          if (targetCompany) {
            await storage.updateCompany(targetCompany.id, {
              membershipCancelled: !!subscription.cancel_at_period_end,
            });
          }

          console.log(
            `Subscription updated (${subscription.id}): cancel_at_period_end=${subscription.cancel_at_period_end}.`
          );
          break;
        }
        case 'customer.subscription.deleted': {
          // La suscripción terminó definitivamente: sin renovación automática y la
          // membresía queda marcada como cancelada/inactiva.
          const subscription = event.data.object as any;
          const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;
          if (!customerId) break;

          const subUser = await storage.getUserByStripeCustomerId(customerId);
          if (subUser) {
            await storage.updateUser(subUser.id, { autoRenewal: false });
          }

          const targetCompany = await resolveTargetCompany(subscription, customerId);
          if (targetCompany) {
            // Solo inactivar si el periodo YA pagado terminó. Si aún quedan días
            // vigentes (p. ej. cancelación inmediata en Stripe), la empresa sigue
            // activa hasta fechaFinMembresia y el job diario la inactivará después.
            const todayStr = new Date().toISOString().split('T')[0];
            const stillVigente = targetCompany.fechaFinMembresia && targetCompany.fechaFinMembresia >= todayStr;
            await storage.updateCompany(targetCompany.id, {
              membershipCancelled: true,
              ...(stillVigente ? {} : {
                estado: 'inactivo',
                inactiveReason: 'Membresía vencida sin renovación pagada (suscripción finalizada)',
                inactivatedAt: new Date(),
              }),
            });
            console.log(
              `Subscription deleted (${subscription.id}); empresa ${targetCompany.id} ` +
              (stillVigente ? 'sigue activa hasta fin de periodo.' : 'inactivada.')
            );
          } else {
            console.log(`Subscription deleted (${subscription.id}); sin empresa asociada localizable.`);
          }
          break;
        }
        case 'checkout.session.completed': {
          // No usamos Checkout Sessions (usamos PaymentElement + suscripciones),
          // así que solo lo registramos para trazabilidad.
          console.log('checkout.session.completed recibido (no-op).');
          break;
        }
        case 'invoice.payment_failed': {
          // El pago de la renovación falló: NO activar el plan pendiente. El plan
          // actual se conserva EXACTAMENTE igual; el cambio programado permanece y
          // se marca su estado de pago como "fallido" (Stripe reintentará el cobro).
          const failedInvoice = event.data.object as Stripe.Invoice;

          try {
            const failedSubscriptionId = getInvoiceSubscriptionId(failedInvoice);

            let failedScheduleId: string | null = null;
            if (failedSubscriptionId) {
              try {
                const sub = await stripe.subscriptions.retrieve(failedSubscriptionId);
                failedScheduleId = typeof (sub as any).schedule === 'string'
                  ? (sub as any).schedule
                  : (sub as any).schedule?.id || null;
              } catch (subErr) {
                console.warn('No se pudo recuperar la suscripción de la factura fallida:', subErr);
              }
            }

            const failedCustomerId = typeof failedInvoice.customer === 'string'
              ? failedInvoice.customer
              : failedInvoice.customer?.id;

            if (failedScheduleId && failedCustomerId) {
              const failedUser = await storage.getUserByStripeCustomerId(failedCustomerId);
              if (failedUser) {
                const failedUserCompanies = await storage.getCompaniesByUser(failedUser.id);
                for (const c of failedUserCompanies) {
                  if (c.pendingMembershipTypeId && c.pendingStripeScheduleId === failedScheduleId) {
                    await storage.updateCompany(c.id, {
                      pendingChangeStatus: "fallido",
                      pendingPaymentStatus: "fallido",
                    });
                  }
                }
              }
            }
          } catch (markErr) {
            console.error('No se pudo marcar el estado de pago fallido:', markErr);
          }

          console.log(
            `Invoice payment failed (${failedInvoice.id}); el cambio de plan NO se aplica, se conserva el plan actual.`
          );
          break;
        }
        default:
          console.log(`Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      // La lógica falló DESPUÉS de marcar el evento como procesado. Liberamos el
      // registro para que el reintento de Stripe (por el 500) NO se descarte como
      // duplicado y el efecto (cobro/renovación/estado) no se pierda para siempre.
      if (processedEventId) {
        try {
          await storage.unmarkStripeEventProcessed(processedEventId);
        } catch (unmarkErr) {
          console.error("No se pudo liberar el evento para reintento:", unmarkErr);
        }
      }
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  // Get user's payment history
  app.get("/api/users/:userId/payments", async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);

      // Autorización: solo el propio usuario o un admin (rol confirmado en BD).
      const claimed = req.user;
      if (!claimed?.id) {
        return res.status(401).json({ error: "No autenticado" });
      }
      if (Number(claimed.id) !== userId) {
        const dbUser = await storage.getUser(Number(claimed.id));
        if (!dbUser || dbUser.role !== "admin") {
          return res.status(403).json({ error: "No autorizado" });
        }
      }

      const payments = await storage.getUserPayments(userId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching user payments:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Create or get Stripe customer
  app.post("/api/create-stripe-customer", async (req, res) => {
    try {
      const { userId, email, name } = req.body;
      
      if (!userId || !email) {
        return res.status(400).json({ error: "Missing userId or email" });
      }

      // Check if user already has a Stripe customer ID
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const stripe = await getStripe();

      if (user.stripeCustomerId) {
        // Return existing customer
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        return res.json({ customerId: customer.id });
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        name: name || user.displayName || email,
      });

      // Update user with Stripe customer ID
      await storage.updateUserStripeCustomerId(userId, customer.id);

      res.json({ customerId: customer.id });
    } catch (error: any) {
      console.error("Error creating Stripe customer:", error);
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  // Crea una SUSCRIPCIÓN RECURRENTE real de Stripe (renovación automática).
  // Reemplaza al cobro único (PaymentIntent) para membresías. Devuelve el
  // clientSecret de la PRIMERA factura para confirmar el pago con PaymentElement.
  // Soporta:
  //  - Empresa existente (companyId) o usuario logueado (userId): vincula la
  //    suscripción al usuario en la BD de inmediato.
  //  - Alta nueva (email/name, sin usuario todavía): crea el customer y devuelve
  //    subscriptionId + customerId para vincularlos luego en complete-registration.
  app.post("/api/create-subscription", async (req, res) => {
    try {
      const {
        membershipTypeId,
        planId,
        selectedPeriod,
        periodicidad,
        companyId,
        userId,
        email,
        name,
        autoRenewal,
      } = req.body;

      const planIdResolved = parseInt(membershipTypeId ?? planId);
      if (!planIdResolved || Number.isNaN(planIdResolved)) {
        return res.status(400).json({ error: "Missing membershipTypeId/planId" });
      }

      const membershipType = await storage.getMembershipType(planIdResolved);
      if (!membershipType) {
        return res.status(404).json({ error: "Membership type not found" });
      }

      // Resolver el periodo y el precio recurrente.
      const periodInput = (selectedPeriod ?? periodicidad ?? "").toString();
      let pricingOption: any = null;
      if (
        membershipType.opcionesPrecios &&
        Array.isArray(membershipType.opcionesPrecios) &&
        membershipType.opcionesPrecios.length > 0
      ) {
        if (periodInput) {
          pricingOption = membershipType.opcionesPrecios.find(
            (o: any) => o.periodicidad && o.periodicidad.toLowerCase() === periodInput.toLowerCase()
          ) || null;
        }
        if (!pricingOption) {
          pricingOption = membershipType.opcionesPrecios.find(
            (o: any) => o.periodicidad && o.periodicidad.toLowerCase() === "anual"
          ) || membershipType.opcionesPrecios[0];
        }
      }

      const amount = parseFloat(pricingOption?.costo?.toString() || "0") || 0;
      if (amount <= 0) {
        return res.status(400).json({ error: "Invalid membership cost configuration. No valid pricing found." });
      }

      const period = (pricingOption?.periodicidad || periodInput || "anual").toString();
      const interval: "month" | "year" = period.toLowerCase() === "mensual" ? "month" : "year";
      const currency = await getConfiguredCurrency();

      const stripe = await getStripe();

      // Determinar / crear el customer de Stripe y (si existe) el usuario local.
      let customerId: string | null = null;
      let localUser: any = null;
      let resolvedCompanyId: number | null = null;

      if (companyId) {
        const company = await storage.getCompany(parseInt(companyId));
        if (!company) return res.status(404).json({ error: "Company not found" });
        resolvedCompanyId = company.id;
        if (company.userId) localUser = await storage.getUser(company.userId);
      } else if (userId) {
        localUser = await storage.getUser(parseInt(userId));
      }

      if (localUser) {
        if (localUser.stripeCustomerId) {
          customerId = localUser.stripeCustomerId;
        } else {
          const customer = await stripe.customers.create({
            email: localUser.email || email,
            name: name || localUser.displayName || localUser.email,
          });
          customerId = customer.id;
          await storage.updateUserStripeCustomerId(localUser.id, customer.id);
        }
      } else {
        // Alta nueva: aún no existe el usuario en la BD; solo se necesita el email.
        if (!email) {
          return res.status(400).json({ error: "Missing email for new subscription" });
        }
        const customer = await stripe.customers.create({ email, name: name || email });
        customerId = customer.id;
      }

      const price = await getOrCreateRecurringPrice(stripe, {
        productName: `${membershipType.nombrePlan} - ${period}`,
        unitAmount: Math.round(amount * 100),
        currency,
        interval,
        lookupKey: `plan_${planIdResolved}_${period}_${Math.round(amount * 100)}_${currency}`.toLowerCase(),
      });

      const metadata: Record<string, string> = {
        membershipTypeId: planIdResolved.toString(),
        selectedPeriod: period,
      };
      if (resolvedCompanyId) metadata.companyId = resolvedCompanyId.toString();
      if (localUser) metadata.userId = localUser.id.toString();

      const subscription = await stripe.subscriptions.create({
        customer: customerId!,
        items: [{ price: price.id }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        metadata,
        ...(autoRenewal === false ? { cancel_at_period_end: true } : {}),
      });

      // Si el usuario ya existe, vincular la suscripción de inmediato.
      if (localUser) {
        await storage.updateUserStripeInfo(localUser.id, customerId!, subscription.id);
        await storage.updateUser(localUser.id, { autoRenewal: autoRenewal !== false });
      }

      const latestInvoice = subscription.latest_invoice as any;
      const clientSecret = latestInvoice?.payment_intent?.client_secret || null;

      if (!clientSecret) {
        console.error("Suscripción creada sin client_secret de la primera factura:", subscription.id);
        return res.status(500).json({ error: "No se pudo inicializar el pago de la suscripción." });
      }

      res.json({
        clientSecret,
        subscriptionId: subscription.id,
        customerId,
      });
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ error: "Failed to create subscription" });
    }
  });

  // Resumen de lo que contendría la exportación. Lo usa la pantalla
  // "Exportar Directorio" para mostrar el tamaño y el contenido antes de
  // iniciar una descarga que puede tardar.
  app.get("/api/admin/session", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const user = await getVerifiedRequestUser(req);
      if (!user) {
        return res.status(401).json({ error: describeMissingAdminIdentity(req) });
      }
      if (!isAdminUser(user)) {
        return res.status(403).json({ error: "Se requiere una cuenta de administrador para esta acción" });
      }
      return res.json({ user: sanitizeUser(user) });
    } catch (error) {
      console.error("Error restaurando sesión de administrador:", error);
      return res.status(500).json({ error: "No se pudo restaurar la sesión de administrador" });
    }
  });

  app.post("/api/admin/logout", (_req, res) => {
    res.clearCookie(ADMIN_SESSION_COOKIE, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return res.json({ success: true });
  });

  app.get("/api/admin/export-info", async (req, res) => {
    try {
      if (!(await getAdminPanelUser(req))) {
        return res.status(401).json({ error: describeMissingAdminIdentity(req) });
      }

      const root = resolveProjectRoot();
      const files = root ? collectProjectFiles(root) : [];
      const sourceBytes = files.reduce((total, file) => total + file.size, 0);

      // Conteo EXACTO por tabla. No se usa pg_stat_user_tables.n_live_tup porque
      // depende de que el recolector de estadísticas haya pasado: en una base
      // recién creada o recién restaurada devuelve 0 y el resumen mentiría.
      const { rows: tableRows } = await pool.query(`
        SELECT c.relname AS table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY c.relname
      `);

      const rows: Array<{ table_name: string; approx_rows: number }> = [];
      for (const { table_name } of tableRows) {
        const counted = await pool.query(
          `SELECT count(*)::int AS c FROM "${String(table_name).replace(/"/g, '""')}"`,
        );
        rows.push({ table_name, approx_rows: Number(counted.rows[0]?.c ?? 0) });
      }

      res.json({
        sourceAvailable: Boolean(root),
        fileCount: files.length,
        sourceBytes,
        tableCount: rows.length,
        approxRows: rows.reduce((total: number, row: any) => total + Number(row.approx_rows || 0), 0),
        tables: rows.map((row: any) => ({
          name: row.table_name,
          approxRows: Number(row.approx_rows || 0),
        })),
      });
    } catch (error: any) {
      console.error("Error obteniendo el resumen de exportación:", error);
      res.status(500).json({ error: error?.message || "No se pudo obtener el resumen" });
    }
  });

  // Exportación completa de la base de datos a un archivo .sql descargable.
  //
  // El volcado contiene TODOS los datos (hashes de contraseña, correos y
  // configuración de pasarelas de pago), así que la identidad debe venir
  // firmada. Se acepta cualquiera de las tres sesiones válidas del panel
  // (Firebase, WordPress o cookie), nunca el header x-user-info.
  app.get("/api/admin/database-export", async (req, res) => {
    try {
      const admin = await getAdminPanelUser(req);
      if (!admin) {
        return res.status(401).json({ error: describeMissingAdminIdentity(req) });
      }
      console.log(`[db-export] Solicitado por ${admin.email || admin.id}`);

      const includeData = req.query.includeData !== "false";
      const { sql, tableCount, rowCount } = await generateSqlDump(pool, { includeData });
      const filename = buildDumpFilename();

      console.log(
        `[db-export] Respaldo generado: ${tableCount} tablas, ${rowCount} registros, ${sql.length} bytes`,
      );

      res.setHeader("Content-Type", "application/sql; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Export-Tables", String(tableCount));
      res.setHeader("X-Export-Rows", String(rowCount));
      res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Export-Tables, X-Export-Rows");
      res.send(sql);
    } catch (error: any) {
      console.error("Error exportando la base de datos:", error);
      res.status(500).json({ error: error?.message || "No se pudo exportar la base de datos" });
    }
  });

  // Exportación del proyecto completo en un ZIP: código fuente + respaldo de la
  // base de datos + .env.example + guía de instalación. Es el paquete que se
  // sube a GitHub/Vercel y se restaura contra un PostgreSQL propio.
  app.get("/api/admin/project-export", async (req, res) => {
    try {
      const admin = await getAdminPanelUser(req);
      if (!admin) {
        return res.status(401).json({ error: describeMissingAdminIdentity(req) });
      }
      console.log(`[project-export] Solicitado por ${admin.email || admin.id}`);

      const includeDatabase = req.query.includeDatabase !== "false";
      const includeSource = req.query.includeSource !== "false";
      if (!includeDatabase && !includeSource) {
        return res.status(400).json({
          error: "Debes incluir al menos el código fuente o la base de datos",
        });
      }

      const prefix = !includeSource
        ? "directorio-base-de-datos"
        : !includeDatabase
          ? "directorio-codigo"
          : "directorio-completo";
      const filename = buildPackageFilename(prefix);

      console.log(`[project-export] Generando paquete ${filename}`);
      await streamFullExport(res, pool, filename, { includeDatabase, includeSource });
    } catch (error: any) {
      console.error("Error exportando el proyecto:", error);
      // Si el stream ya comenzó, las cabeceras están enviadas y streamFullExport
      // se encarga de cortar la conexión.
      if (!res.headersSent) {
        res.status(500).json({ error: error?.message || "No se pudo exportar el proyecto" });
      }
    }
  });

  // System Settings routes
  app.get("/api/system-settings", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public endpoint that exposes ONLY the configured currency, so public pages
  // (e.g. membership plans) can display prices without leaking the full
  // settings object (which contains email/payment configuration).
  app.get("/api/public/currency", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json({
        currency: (settings as any)?.currency || "USD",
        currencySymbol: (settings as any)?.currencySymbol || "$",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/system-settings", async (req, res) => {
    try {
      if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
      // Skip authentication check for now - allow system settings updates
      // TODO: Implement proper authentication middleware

      // TODO: Add admin role verification here

      const settings = await storage.updateSystemSettings(req.body);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Projects API routes
  app.get("/api/projects", async (req, res) => {
    try {
      const { companyId, categoryId, estado, estadoModeracion, limit, offset } = req.query;
      
      const options = {
        companyId: companyId ? parseInt(companyId as string) : undefined,
        categoryId: categoryId ? parseInt(categoryId as string) : undefined,
        estado: estado as string,
        estadoModeracion: estadoModeracion as string,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
      };

      const result = await storage.getAllProjects(options);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Proyecto no encontrado" });
      }

      // Incrementar vistas
      await storage.incrementProjectViews(id);
      
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/companies/:companyId/projects", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      let projects = await storage.getProjectsByCompany(companyId);

      // Directorio PÚBLICO (?view=public): recortar proyectos al límite del plan
      // ACTIVO y las fotos de cada proyecto al límite por proyecto, sin borrar
      // datos. El dashboard privado (sin este parámetro) sigue viendo todo.
      if (req.query.view === "public") {
        const company = await storage.getCompany(companyId);
        const membershipType = company?.membershipTypeId
          ? await storage.getMembershipType(company.membershipTypeId)
          : null;
        const projectLimit = normalizePlanLimit(membershipType?.cantidadProyectosAdmitidos as any);
        const photoLimit = normalizePlanLimit(membershipType?.cantidadFotosPorProyecto as any);

        if (projectLimit >= 0) {
          projects = projects.slice(0, projectLimit);
        }
        if (photoLimit >= 0) {
          projects = projects.map((p: any) => ({
            ...p,
            galeriaImagenes: Array.isArray(p.galeriaImagenes)
              ? p.galeriaImagenes.slice(0, photoLimit)
              : p.galeriaImagenes,
          }));
        }
      }

      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get company membership limits and current usage
  app.get("/api/companies/:companyId/limits", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }

      if (!company.membershipTypeId) {
        return res.status(400).json({ error: "La empresa no tiene un plan de membresía asignado" });
      }

      const membershipType = await storage.getMembershipType(company.membershipTypeId);
      if (!membershipType) {
        return res.status(404).json({ error: "Plan de membresía no encontrado" });
      }

      // Get current usage
      const projects = await storage.getProjectsByCompany(companyId);
      const currentProjectCount = projects.length;
      const currentProductCount = Array.isArray(company.galeriaProductosUrls) 
        ? company.galeriaProductosUrls.length 
        : 0;

      // "Ilimitado" se representa con NULL (nuevo) o -1 (legacy). En ambos casos
      // devolvemos -1, que es lo que el frontend interpreta como "Sin límite".
      const projectLimit = normalizePlanLimit(membershipType.cantidadProyectosAdmitidos);
      const productLimit = (membershipType.cantidadProductosAdmitidos === null || membershipType.cantidadProductosAdmitidos === undefined)
        ? -1
        : membershipType.cantidadProductosAdmitidos;

      const limits = {
        planName: membershipType.nombrePlan,
        projects: {
          limit: projectLimit,
          current: currentProjectCount,
          available: projectLimit === -1 ? -1 : Math.max(0, projectLimit - currentProjectCount)
        },
        products: {
          limit: productLimit,
          current: currentProductCount,
          available: productLimit === -1 ? -1 : Math.max(0, productLimit - currentProductCount)
        }
      };

      res.json(limits);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sube las imágenes de proyecto al almacenamiento activo y devuelve sus URLs.
  // Con Cloudinary configurado multer usa memoria (file.filename NO existe),
  // por eso hay que subir el buffer; en disco local sí hay filename.
  async function uploadProjectImages(files: Express.Multer.File[] | undefined): Promise<string[]> {
    if (!files || files.length === 0) return [];
    const urls: string[] = [];
    for (const file of files) {
      if (useCloudinary) {
        const result = await uploadFromBuffer(file.buffer, 'anpr/proyectos', 'image');
        urls.push(result.url);
      } else {
        urls.push(`/uploads/images/${file.filename}`);
      }
    }
    return urls;
  }

  app.post("/api/projects", uploadImage.array('galeriaImagenes', 20), validateUploadedImages, async (req, res) => {
    try {
      console.log("Request body:", req.body);
      console.log("Request files:", req.files);
      console.log("Content-Type:", req.headers['content-type']);

      // Validar que companyId esté presente y sea válido
      if (!req.body.companyId || isNaN(parseInt(req.body.companyId))) {
        return res.status(400).json({ error: "Company ID es requerido y debe ser un número válido" });
      }

      const companyId = parseInt(req.body.companyId);

      // Empresa inactiva (membresía vencida sin pago): no puede usar funciones
      // protegidas como crear proyectos. Debe renovar/pagar primero.
      const projectCompany = await storage.getCompany(companyId);
      if (!projectCompany) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }
      // Solo admin o el dueño/representante vinculado a ESTA empresa puede
      // crear proyectos (verificado contra la BD, no contra el header).
      if (!(await verifyCompanyAccess(req, res, projectCompany))) {
        return;
      }
      if (projectCompany.estado === "inactivo") {
        return res.status(403).json({
          error: "Tu empresa está inactiva por falta de pago o membresía vencida. Renueva tu membresía para volver a crear proyectos.",
          code: "COMPANY_INACTIVE",
        });
      }

      // Comprobación temprana para no subir archivos cuando el límite ya está
      // agotado. createProject repite la validación de forma atómica.
      await storage.validateProjectLimits(companyId);

      // Procesar imágenes subidas (Cloudinary en producción, disco en dev)
      const files = req.files as Express.Multer.File[];
      const imageUrls = await uploadProjectImages(files);

      // Clean up and filter the project data, excluding removed fields
      const allowedFields = [
        'companyId', 'nombreProyecto', 'descripcionProyecto', 'ubicacionPais', 
        'ubicacionEstado', 'ubicacionCiudad', 'clienteContratante', 
        'areaSuperficie', 'serviciosProductos', 'videoUrl', 'estado', 'estadoModeracion'
      ];

      const filteredBody = Object.fromEntries(
        Object.entries(req.body).filter(([key, value]) => 
          allowedFields.includes(key) && value !== undefined && value !== null && value !== ""
        )
      );

      const projectData = {
        ...filteredBody,
        companyId: parseInt(req.body.companyId),
        galeriaImagenes: imageUrls,
        serviciosProductos: req.body.serviciosProductos ? JSON.parse(req.body.serviciosProductos) : [],
      };

      console.log("Processed project data:", projectData);

      const validatedData = insertProjectSchema.parse(projectData);
      console.log("Validated data:", validatedData);
      
      const project = await storage.createProject(validatedData);
      
      res.status(201).json(project);
    } catch (error: any) {
      console.error("Project creation error:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      if (error.code === "PROJECT_LIMIT_REACHED" || error.code === "INVALID_PROJECT_LIMIT_CONFIG") {
        return res.status(409).json({
          error: error.message,
          code: error.code,
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id", uploadImage.array('galeriaImagenes', 20), validateUploadedImages, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existingProject = await storage.getProject(id);
      
      if (!existingProject) {
        return res.status(404).json({ error: "Proyecto no encontrado" });
      }

      // Solo admin o el dueño/representante vinculado a la empresa del proyecto
      // puede editarlo (verificado contra la BD, no contra el header).
      const projectCompany = await storage.getCompany(existingProject.companyId);
      if (!projectCompany) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }
      if (!(await verifyCompanyAccess(req, res, projectCompany))) {
        return;
      }

      let updateData: Record<string, any> = { ...req.body };

      // El proyecto no se puede mover de empresa. Además, el formulario puede
      // enviar companyId duplicado (llega como array) o como string; se ignora.
      delete updateData.companyId;
      delete updateData.existingImages;

      // Galería: conservar las imágenes existentes que el usuario mantuvo
      // (existingImages) y agregar las nuevas subidas. Si no se envía
      // existingImages ni archivos, la galería no se toca.
      const files = req.files as Express.Multer.File[];
      const hasFiles = !!files && files.length > 0;
      const currentImages: string[] = Array.isArray(existingProject.galeriaImagenes)
        ? existingProject.galeriaImagenes
        : [];

      let keptImages: string[] | null = null;
      if (req.body.existingImages !== undefined) {
        try {
          const parsed = JSON.parse(req.body.existingImages);
          if (Array.isArray(parsed)) {
            // Solo se pueden "conservar" URLs que ya pertenecen al proyecto.
            keptImages = parsed.filter((url: any) => typeof url === 'string' && currentImages.includes(url));
          }
        } catch {
          return res.status(400).json({ error: "existingImages debe ser un arreglo JSON válido" });
        }
      }

      if (keptImages !== null || hasFiles) {
        const base = keptImages !== null ? keptImages : currentImages;
        const newImageUrls = await uploadProjectImages(files);
        const finalImages = [...base, ...newImageUrls];

        // Respetar el límite de fotos por proyecto del plan (NULL o -1 = ilimitado).
        const membershipType = projectCompany.membershipTypeId
          ? await storage.getMembershipType(projectCompany.membershipTypeId)
          : null;
        const photoLimit = membershipType?.cantidadFotosPorProyecto;
        if (photoLimit != null && photoLimit > 0 && finalImages.length > photoLimit) {
          return res.status(400).json({
            error: `Tu plan permite un máximo de ${photoLimit} imágenes por proyecto (intentaste guardar ${finalImages.length}).`,
          });
        }

        updateData.galeriaImagenes = finalImages;
      }

      if (req.body.serviciosProductos) {
        updateData.serviciosProductos = JSON.parse(req.body.serviciosProductos);
      }

      const validatedData = insertProjectSchema.partial().parse(updateData);
      const project = await storage.updateProject(id, validatedData);
      
      res.json(project);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const projectToDelete = await storage.getProject(id);
      if (!projectToDelete) {
        return res.status(404).json({ error: "Proyecto no encontrado" });
      }
      // Solo admin o el dueño/representante vinculado a la empresa del proyecto.
      const delCompany = await storage.getCompany(projectToDelete.companyId);
      if (!delCompany) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }
      if (!(await verifyCompanyAccess(req, res, delCompany))) {
        return;
      }

      const deleted = await storage.deleteProject(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Proyecto no encontrado" });
      }
      
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects/:id/consulta", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.incrementProjectConsultas(id);
      res.status(200).json({ message: "Consulta registrada" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin routes for project moderation
  app.patch("/api/admin/projects/:id/moderate", async (req, res) => {
    try {
      // Skip authentication check for now - allow project moderation
      // TODO: Implement proper authentication middleware

      // TODO: Add admin role verification here

      const id = parseInt(req.params.id);
      const { estadoModeracion } = req.body;
      
      if (!['pendiente', 'aprobado', 'rechazado'].includes(estadoModeracion)) {
        return res.status(400).json({ error: "Estado de moderación inválido" });
      }

      const project = await storage.moderateProject(id, estadoModeracion);
      
      if (!project) {
        return res.status(404).json({ error: "Proyecto no encontrado" });
      }
      
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });



  // WordPress/MemberPress Integration API endpoints
  app.get("/api/integration-settings", async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings();
      res.json(settings || {});
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/integration-settings", async (req, res) => {
    try {
      const validatedData = insertIntegrationSettingsSchema.parse(req.body);
      const settings = await storage.createIntegrationSettings(validatedData);
      res.status(201).json(settings);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // PUT endpoint without ID - creates or updates automatically
  app.put("/api/integration-settings", async (req, res) => {
    try {
      const validatedData = insertIntegrationSettingsSchema.partial().parse(req.body);
      
      // Check if settings already exist
      const existingSettings = await storage.getIntegrationSettings();
      
      let settings;
      if (existingSettings) {
        // Update existing settings
        settings = await storage.updateIntegrationSettings(existingSettings.id, validatedData);
      } else {
        // Create new settings
        const completeData = insertIntegrationSettingsSchema.parse(req.body);
        settings = await storage.createIntegrationSettings(completeData);
      }
      
      res.json(settings);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/integration-settings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertIntegrationSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateIntegrationSettings(id, validatedData);
      
      if (!settings) {
        return res.status(404).json({ error: "Configuración no encontrada" });
      }
      
      res.json(settings);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/integration-settings/test-connection", async (req, res) => {
    try {
      const { wordpressUrl, apiKey, apiSecret } = req.body;
      
      if (!wordpressUrl || !apiKey || !apiSecret) {
        return res.status(400).json({ error: "URL de WordPress y credenciales son requeridos" });
      }

      const result = await storage.testWordPressConnection(wordpressUrl, { apiKey, apiSecret });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/integration-settings/sync-users", async (req, res) => {
    try {
      const result = await storage.syncWordPressUsers();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/wordpress-users", async (req, res) => {
    try {
      const { search } = req.query;
      const result = await storage.getWordPressUsers();
      
      if (search && typeof search === 'string') {
        const filtered = result.users.filter((user: any) => 
          user.username?.toLowerCase().includes(search.toLowerCase()) ||
          user.name?.toLowerCase().includes(search.toLowerCase()) ||
          user.email?.toLowerCase().includes(search.toLowerCase())
        );
        return res.json({ ...result, users: filtered });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/debug-wordpress", async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings();
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.json({ error: "Configuración de WordPress incompleta" });
      }

      const urls = [
        `${settings.wordpressUrl}/wp-json/wp/v2/users?per_page=10`,
        `${settings.wordpressUrl}/wp-json/wp/v2/users?per_page=10&context=edit`,
        `${settings.wordpressUrl}/wp-json/wp/v2/users?per_page=10&roles=all`,
      ];

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const results = {};

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });
          
          const data = await response.json();
          results[`test_${i + 1}_${response.status}`] = {
            url,
            status: response.status,
            count: Array.isArray(data) ? data.length : 'Not array',
            first_user: Array.isArray(data) && data.length > 0 ? data[0] : null,
            error: !response.ok ? data : null
          };
        } catch (error: any) {
          results[`test_${i + 1}_error`] = {
            url,
            error: error.message
          };
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para obtener información detallada de membresía de un usuario específico de WordPress
  // Endpoint para obtener transacciones de un usuario específico
  app.get("/api/wordpress-user-transactions/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const includeAll = req.query.includeAll === 'true';
      const transactions = await getUserTransactions(userId, includeAll);
      
      // Mapear gateways a nombres legibles
      const gatewayNames: Record<string, string> = {
        'stripe': 'Stripe (Tarjeta de crédito/débito)',
        'paypal': 'PayPal',
        'manual': 'Pago manual',
        'free': 'Membresía gratuita',
        'offline': 'Pago fuera de línea',
        'bank_transfer': 'Transferencia bancaria',
        'cash': 'Efectivo',
        'check': 'Cheque',
        'artificial': 'Creado manualmente',
        'oxxo': 'OXXO Pay',
        'spei': 'SPEI',
      };

      // Procesar transacciones con información más completa
      const processedTransactions = transactions.map(t => {
        // Determinar fecha de inicio de membresía
        // Primero intentar con created_at de la transacción
        // Si hay subscription, usar subscription.created_at
        let startDate = t.created_at;
        if (t.subscription && t.subscription.created_at) {
          startDate = t.subscription.created_at;
        }
        
        // Determinar el método de pago
        const gateway = t.gateway || t.payment_method || 'unknown';
        const paymentMethodName = gatewayNames[gateway.toLowerCase()] || gateway;
        
        // Verificar si la transacción está activa (no expirada)
        const now = new Date();
        const expiresAt = t.expires_at ? new Date(t.expires_at) : null;
        const isActive = expiresAt ? expiresAt > now : false;
        
        return {
          id: t.id,
          status: t.status,
          amount: t.amount,
          total: t.total,
          currency: t.currency || 'MXN',
          created_at: t.created_at,
          expires_at: t.expires_at,
          starts_at: startDate,
          is_active: isActive,
          membership_name: t.membership?.title || t.product?.title || 'Sin plan',
          membership_id: t.membership?.id || t.product_id,
          transaction_id: t.trans_num || t.transaction_id || t.id,
          gateway: gateway,
          payment_method: paymentMethodName,
          subscription_id: t.subscription_id || null,
          coupon: t.coupon_code || null,
          prorated: t.prorated || false,
          tax_amount: t.tax_amount || 0,
          tax_rate: t.tax_rate || 0,
        };
      });
      
      // Encontrar la transacción activa más relevante
      const activeTransaction = processedTransactions.find(t => t.is_active && t.expires_at);
      
      if (transactions.length === 0) {
        return res.json({ 
          message: "No se encontraron transacciones para este usuario",
          transactions: [],
          count: 0,
          active_transaction: null
        });
      }

      res.json({ 
        transactions: processedTransactions,
        count: processedTransactions.length,
        active_transaction: activeTransaction || null,
        has_active_membership: !!activeTransaction
      });

    } catch (error: any) {
      console.error(`Error fetching user transactions:`, error);
      res.status(500).json({ 
        error: "Error al obtener transacciones del usuario",
        details: error.message 
      });
    }
  });

  app.get("/api/wordpress-user-membership/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      // Obtener información básica del usuario
      const userResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users/${userId}?context=edit`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        return res.status(404).json({ error: `Usuario no encontrado: ${userResponse.status}` });
      }

      const userData = await userResponse.json();

      // Endpoints específicos de MemberPress
      const memberPressEndpoints = [
        // MemberPress API endpoints principales
        `${baseUrl}/wp-json/mp/v1/members/${userId}`,
        `${baseUrl}/wp-json/mp/v1/subscriptions?member=${userId}`,
        `${baseUrl}/wp-json/mp/v1/transactions?member=${userId}`,
        // Endpoints alternativos de MemberPress
        `${baseUrl}/wp-json/memberpress/v1/members/${userId}`,
        `${baseUrl}/wp-json/memberpress/v1/subscriptions?member_id=${userId}`,
        // Endpoint de metadatos del usuario que puede contener info de MemberPress
        `${baseUrl}/wp-json/wp/v2/users/${userId}/meta`,
      ];

      const membershipData: any = {};
      
      for (const [index, endpoint] of memberPressEndpoints.entries()) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            const endpointNames = [
              'MemberPress Member Info',
              'MemberPress Subscriptions',
              'MemberPress Transactions',
              'MemberPress Alt Member Info',
              'MemberPress Alt Subscriptions',
              'User Meta (MemberPress data)'
            ];
            
            membershipData[`memberpress_${index + 1}`] = {
              url: endpoint,
              status: response.status,
              data: data,
              endpoint_name: endpointNames[index],
              has_data: Array.isArray(data) ? data.length > 0 : Object.keys(data || {}).length > 0
            };
          } else {
            membershipData[`memberpress_${index + 1}`] = {
              url: endpoint,
              status: response.status,
              error: response.statusText,
              endpoint_name: ['MemberPress Member Info', 'MemberPress Subscriptions', 'MemberPress Transactions', 'MemberPress Alt Member Info', 'MemberPress Alt Subscriptions', 'User Meta'][index]
            };
          }
        } catch (error: any) {
          membershipData[`memberpress_${index + 1}`] = {
            url: endpoint,
            error: error.message,
            endpoint_name: ['MemberPress Member Info', 'MemberPress Subscriptions', 'MemberPress Transactions', 'MemberPress Alt Member Info', 'MemberPress Alt Subscriptions', 'User Meta'][index]
          };
        }
      }

      // Verificar roles y capabilities del usuario que podrían indicar membresía
      const userRoles = userData.roles || [];
      const userCapabilities = userData.capabilities || {};
      
      // Analizar metadatos específicos de MemberPress
      const membershipMetaFields = userData.meta || {};
      
      // Campos específicos de MemberPress
      const memberPressFields = Object.keys(membershipMetaFields).filter(key => 
        key.includes('mepr') || 
        key.includes('memberpress') ||
        key.includes('mp_') ||
        key.startsWith('_mepr')
      );
      
      // Campos generales de membresía
      const generalMembershipFields = Object.keys(membershipMetaFields).filter(key => 
        key.includes('member') || 
        key.includes('subscription') || 
        key.includes('plan') || 
        key.includes('level') ||
        key.includes('expire') ||
        key.includes('status')
      );
      
      // Extraer información específica de MemberPress
      const memberPressAnalysis = {
        active_memberships: membershipMetaFields['_mepr_active_memberships'] || [],
        inactive_memberships: membershipMetaFields['_mepr_inactive_memberships'] || [],
        expired_memberships: membershipMetaFields['_mepr_expired_memberships'] || [],
        member_status: membershipMetaFields['mepr_member_status'] || null,
        subscription_ids: membershipMetaFields['_mepr_subscription_ids'] || [],
        transaction_ids: membershipMetaFields['_mepr_transaction_ids'] || [],
        last_login: membershipMetaFields['mepr_last_login_date'] || null,
        registration_date: membershipMetaFields['mepr_reg_date'] || null,
      };

      res.json({
        user_basic_info: {
          id: userData.id,
          username: userData.username,
          name: userData.name,
          email: userData.email,
          roles: userRoles,
          capabilities: userCapabilities
        },
        memberpress_analysis: memberPressAnalysis,
        membership_metadata: {
          memberpress_fields: memberPressFields.reduce((acc, field) => {
            acc[field] = membershipMetaFields[field];
            return acc;
          }, {} as any),
          general_membership_fields: generalMembershipFields.reduce((acc, field) => {
            acc[field] = membershipMetaFields[field];
            return acc;
          }, {} as any),
          roles_analysis: {
            has_member_role: userRoles.some((role: string) => role.includes('member')),
            has_subscriber_role: userRoles.includes('subscriber'),
            custom_roles: userRoles.filter((role: string) => !['subscriber', 'contributor', 'author', 'editor', 'administrator'].includes(role))
          }
        },
        memberpress_api_responses: membershipData,
        summary: {
          has_active_memberships: Array.isArray(memberPressAnalysis.active_memberships) ? memberPressAnalysis.active_memberships.length > 0 : false,
          has_expired_memberships: Array.isArray(memberPressAnalysis.expired_memberships) ? memberPressAnalysis.expired_memberships.length > 0 : false,
          has_subscriptions: Array.isArray(memberPressAnalysis.subscription_ids) ? memberPressAnalysis.subscription_ids.length > 0 : false,
          member_status: memberPressAnalysis.member_status,
          total_memberpress_fields: memberPressFields.length,
          api_endpoints_working: Object.values(membershipData).filter((response: any) => response.status === 200).length
        },
        recommendations: {
          note: "Este análisis está optimizado para MemberPress. Los datos mostrados incluyen información específica de membresías activas, expiradas y suscripciones.",
          next_steps: [
            "Verificar las respuestas de la API de MemberPress para obtener datos detallados",
            "Analizar los metadatos del usuario para encontrar información de membresías",
            "Usar los subscription_ids y transaction_ids para obtener más detalles si es necesario"
          ]
        }
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para buscar usuario por username y obtener su información de membresía
  app.get("/api/find-user-membership/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      // Buscar usuario por username (slug) o por email si contiene @
      let searchResponse;
      let users;
      
      if (username.includes('@')) {
        // Si contiene @, buscar por email
        searchResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users?search=${encodeURIComponent(username)}&context=edit`, {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
        });
      } else {
        // Si no contiene @, buscar por slug (username)
        searchResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users?slug=${username}&context=edit`, {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
        });
      }

      if (!searchResponse.ok) {
        return res.status(404).json({ error: `Error buscando usuario: ${searchResponse.status}` });
      }

      users = await searchResponse.json();
      
      // Si es búsqueda por email y no encontramos exacto, filtrar por email exacto
      if (username.includes('@') && Array.isArray(users)) {
        users = users.filter((user: any) => user.email === username);
      }
      
      if (!Array.isArray(users) || users.length === 0) {
        return res.status(404).json({ error: `Usuario '${username}' no encontrado` });
      }

      const userData = users[0]; // Tomar el primer usuario encontrado
      const meta = userData.meta || {};

      // Extraer información específica de MemberPress
      const membershipStatus = {
        user_id: userData.id,
        username: userData.username,
        name: userData.name,
        email: userData.email,
        active_memberships: meta['_mepr_active_memberships'] || [],
        inactive_memberships: meta['_mepr_inactive_memberships'] || [],
        expired_memberships: meta['_mepr_expired_memberships'] || [],
        subscription_ids: meta['_mepr_subscription_ids'] || [],
        transaction_ids: meta['_mepr_transaction_ids'] || [],
        member_status: meta['mepr_member_status'] || 'inactive',
        last_login: meta['mepr_last_login_date'] || null,
        registration_date: meta['mepr_reg_date'] || userData.date_registered,
        has_active_membership: Array.isArray(meta['_mepr_active_memberships']) && meta['_mepr_active_memberships'].length > 0,
        is_member: userData.roles?.includes('member') || false,
        roles: userData.roles || [],
        // Información adicional de MemberPress
        memberpress_meta: Object.keys(meta).filter(key => 
          key.includes('mepr') || key.includes('memberpress') || key.startsWith('_mepr')
        ).reduce((acc, key) => {
          acc[key] = meta[key];
          return acc;
        }, {} as any)
      };

      res.json(membershipStatus);

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para obtener usuarios con membresías activas en MemberPress
  app.get("/api/users-with-memberships", async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      // Obtener usuarios con metadatos específicos de MemberPress
      const response = await fetch(`${baseUrl}/wp-json/wp/v2/users?per_page=50&context=edit&meta_key=_mepr_active_memberships`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return res.status(404).json({ error: `Error obteniendo usuarios: ${response.status}` });
      }

      const users = await response.json();
      
      // Filtrar usuarios que tengan metadatos de MemberPress
      const usersWithMemberships = users.filter((user: any) => {
        const meta = user.meta || {};
        return Object.keys(meta).some(key => 
          key.includes('mepr') || key.includes('memberpress') || key.startsWith('_mepr')
        );
      }).map((user: any) => {
        const meta = user.meta || {};
        return {
          user_id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          roles: user.roles,
          has_active_memberships: Array.isArray(meta['_mepr_active_memberships']) && meta['_mepr_active_memberships'].length > 0,
          active_memberships_count: meta['_mepr_active_memberships']?.length || 0,
          subscription_ids_count: meta['_mepr_subscription_ids']?.length || 0,
          transaction_ids_count: meta['_mepr_transaction_ids']?.length || 0,
          member_status: meta['mepr_member_status'] || 'inactive'
        };
      });

      res.json({ 
        total: usersWithMemberships.length, 
        users: usersWithMemberships 
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para obtener una muestra de usuarios existentes (para pruebas)
  app.get("/api/sample-users", async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      // Obtener los primeros 20 usuarios para mostrar ejemplos
      const response = await fetch(`${baseUrl}/wp-json/wp/v2/users?per_page=20&context=edit`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return res.status(404).json({ error: `Error obteniendo usuarios: ${response.status}` });
      }

      const users = await response.json();
      
      // Mapear información básica de usuarios para ejemplos
      const sampleUsers = users.map((user: any) => ({
        user_id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        roles: user.roles
      }));

      res.json({ 
        total: sampleUsers.length, 
        users: sampleUsers 
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint simplificado para obtener solo el estado de membresía de MemberPress
  app.get("/api/memberpress-status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      // Obtener información del usuario con metadatos
      const userResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users/${userId}?context=edit`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        return res.status(404).json({ error: `Usuario no encontrado: ${userResponse.status}` });
      }

      const userData = await userResponse.json();
      const meta = userData.meta || {};

      // Extraer información específica de MemberPress del metadatos
      const membershipStatus = {
        user_id: userData.id,
        username: userData.username,
        email: userData.email,
        active_memberships: meta['_mepr_active_memberships'] || [],
        inactive_memberships: meta['_mepr_inactive_memberships'] || [],
        expired_memberships: meta['_mepr_expired_memberships'] || [],
        subscription_ids: meta['_mepr_subscription_ids'] || [],
        transaction_ids: meta['_mepr_transaction_ids'] || [],
        member_status: meta['mepr_member_status'] || 'inactive',
        last_login: meta['mepr_last_login_date'] || null,
        registration_date: meta['mepr_reg_date'] || userData.date_registered,
        has_active_membership: Array.isArray(meta['_mepr_active_memberships']) && meta['_mepr_active_memberships'].length > 0,
        is_member: userData.roles?.includes('member') || false,
      };

      res.json(membershipStatus);

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Complete registration endpoint
  app.post("/api/complete-registration", async (req, res) => {
    try {
      const { userData, companyData, membershipTypeId, selectedPeriod, paymentIntentId, firebaseUid, subscriptionId, stripeCustomerId } = req.body;

      if (!userData || !companyData || !membershipTypeId || !paymentIntentId) {
        return res.status(400).json({ 
          error: "Faltan datos requeridos para completar el registro",
          userMessage: "Por favor, completa todos los campos requeridos e intenta nuevamente."
        });
      }

      // Require firebaseUid for secure registration
      if (!firebaseUid) {
        return res.status(400).json({ 
          error: "Firebase UID requerido",
          userMessage: "Error de autenticación. Por favor, recarga la página e intenta nuevamente."
        });
      }

      // Log locations for debugging
      console.log("Complete Registration - locations received:", companyData.locations);
      console.log("Complete Registration - firebaseUid received:", firebaseUid);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ 
          error: "El correo electrónico ya está registrado",
          userMessage: "Ya existe una cuenta con este correo electrónico. Si ya tienes una cuenta, inicia sesión en lugar de registrarte nuevamente. Si necesitas ayuda, contacta a soporte."
        });
      }

      // Create user account with valid Firebase UID from frontend
      const user = await storage.createUser({
        email: userData.email,
        displayName: userData.nombre,
        photoURL: userData.photoURL || "",
        firebaseUid: firebaseUid, // Use the real Firebase UID from frontend
        role: 'representante',
      });

      // Vincular la suscripción de Stripe al usuario recién creado y, si es
      // posible, calcular la fecha fin EXACTA desde el ciclo de la suscripción
      // (current_period_end) en vez de sumar días manualmente.
      let subscriptionPeriodEnd: Date | null = null;
      if (subscriptionId && stripeCustomerId) {
        try {
          await storage.updateUserStripeInfo(user.id, stripeCustomerId, subscriptionId);
          await storage.updateUser(user.id, { autoRenewal: true });
          const stripe = await getStripe();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const periodEnd = getSubscriptionPeriodEnd(subscription);
          if (periodEnd) {
            subscriptionPeriodEnd = new Date(periodEnd * 1000);
          }
        } catch (subErr) {
          console.error("Error vinculando suscripción en complete-registration:", subErr);
          // No abortamos el registro: el webhook corregirá fechas si es necesario.
        }
      }

      const fechaFinCalculada = subscriptionPeriodEnd
        ? subscriptionPeriodEnd.toISOString().split('T')[0]
        : new Date(Date.now() + (selectedPeriod === 'anual' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Create company (ubicacionGeografica deprecated, using locations table now)
      const company = await storage.createCompany({
        nombreEmpresa: companyData.nombreEmpresa,
        email1: companyData.email1,
        telefono1: companyData.telefono1,
        direccionFisica: companyData.direccionFisica,
        descripcionEmpresa: companyData.descripcionEmpresa,
        sitioWeb: companyData.sitioWeb,
        logotipoUrl: companyData.logotipoUrl || null, // Company logo
        fotoPortadaUrl: companyData.fotoPortadaUrl || null, // Company banner/cover photo
        ubicacionGeografica: null, // Deprecated field
        membershipTypeId: membershipTypeId,
        membershipPeriodicidad: selectedPeriod,
        formaPago: "tarjeta",
        fechaInicioMembresia: new Date().toISOString().split('T')[0],
        fechaFinMembresia: fechaFinCalculada,
        userId: user.id,
        estado: "activo"
      });

      // Grabar companyId/userId en la metadata de la suscripción para que el
      // webhook (renovaciones, cancelaciones) pueda localizar la empresa exacta.
      if (subscriptionId) {
        try {
          const stripe = await getStripe();
          await stripe.subscriptions.update(subscriptionId, {
            metadata: {
              membershipTypeId: membershipTypeId.toString(),
              selectedPeriod: selectedPeriod || "",
              companyId: company.id.toString(),
              userId: user.id.toString(),
            },
          });
        } catch (metaErr) {
          console.error("Error actualizando metadata de la suscripción:", metaErr);
        }
      }

      // Create company locations
      if (companyData.locations && Array.isArray(companyData.locations)) {
        for (const location of companyData.locations) {
          await storage.createCompanyLocation({
            companyId: company.id,
            address: location.address,
            lat: location.lat,
            lng: location.lng,
            isPrincipal: location.isPrincipal || false
          });
        }
      }

      // Get membership type for amount
      const membershipType = await storage.getMembershipType(membershipTypeId);
      if (!membershipType) {
        throw new Error("Membership type not found");
      }

      // Calculate amount
      let amount = 0;
      if (membershipType.opcionesPrecios && Array.isArray(membershipType.opcionesPrecios)) {
        const pricingOption = membershipType.opcionesPrecios.find((option: any) => 
          option.periodicidad && option.periodicidad.toLowerCase() === selectedPeriod.toLowerCase()
        ) || membershipType.opcionesPrecios[0];
        amount = parseFloat(pricingOption?.costo?.toString() || "0") || 0;
      }

      // Create payment record
      await storage.createMembershipPayment({
        userId: user.id,
        companyId: company.id,
        membershipTypeId: membershipTypeId,
        stripePaymentIntentId: paymentIntentId,
        amount: amount.toString(),
        currency: await getConfiguredCurrency(),
        status: "succeeded"
      });

      // Automatically assign ANPR certificate for business memberships
      try {
        // Find the "Miembro Oficial ANPR México 2025" certificate
        const certificates = await storage.getAllCertificates();
        const anprCertificate = certificates.find((cert: any) => 
          cert.nombreCertificado === "Miembro Oficial ANPR México 2025"
        );

        if (anprCertificate) {
          // Create company-certificate association
          await storage.assignCertificateToCompany(company.id, anprCertificate.id, {
            fechaObtencion: new Date().toISOString().split('T')[0],
            asignadoPorAdmin: true,
            observaciones: `Certificado asignado automáticamente por membresía ${membershipType.nombrePlan}`
          });
          
          console.log(`ANPR certificate automatically assigned to company ${company.id}`);
        } else {
          console.warn("ANPR certificate not found - skipping automatic assignment");
        }
      } catch (certificateError) {
        console.error("Error assigning ANPR certificate:", certificateError);
        // Don't fail the registration if certificate assignment fails
      }

      // Send notification emails to configured admin emails
      try {
        const systemSettings = await storage.getSystemSettings();
        const notificationEmails = systemSettings.notificationEmails as string[] || [];
        
        if (notificationEmails.length > 0) {
          const emailConfig = await storage.getEmailConfiguration();
          
          if (emailConfig) {
            const nodemailer = await import('nodemailer');
            
            const transporterConfig: any = {
              host: emailConfig.smtpHost,
              port: emailConfig.smtpPort,
              secure: emailConfig.encryption === 'ssl',
              auth: {
                user: emailConfig.username,
                pass: emailConfig.password,
              },
            };
            
            if (emailConfig.encryption === 'tls') {
              transporterConfig.requireTLS = true;
              transporterConfig.tls = { rejectUnauthorized: false };
            } else if (emailConfig.encryption === 'ssl') {
              transporterConfig.secure = true;
              transporterConfig.tls = { rejectUnauthorized: false };
            }
            
            const transporter = nodemailer.default.createTransport(transporterConfig);
            
            const htmlContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0f2161; border-bottom: 2px solid #bcce16; padding-bottom: 10px;">
                  🎉 Nueva Empresa Registrada
                </h2>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #333; margin-top: 0;">Datos de la Empresa</h3>
                  <p><strong>Nombre:</strong> ${company.nombreEmpresa}</p>
                  <p><strong>Email:</strong> ${companyData.email1}</p>
                  <p><strong>Teléfono:</strong> ${companyData.telefono1 || 'No proporcionado'}</p>
                  <p><strong>Dirección:</strong> ${companyData.direccionFisica || 'No proporcionada'}</p>
                </div>
                <div style="background-color: #e6f7e6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                  <h3 style="color: #333; margin-top: 0;">💳 Información del Pago</h3>
                  <p><strong>Plan contratado:</strong> ${membershipType.nombrePlan}</p>
                  <p><strong>Periodicidad:</strong> ${selectedPeriod === 'anual' ? 'Anual (12 meses)' : selectedPeriod === 'mensual' ? 'Mensual' : selectedPeriod}</p>
                  <p><strong>Monto pagado:</strong> $${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${(await getConfiguredCurrency()).toUpperCase()}</p>
                  <p><strong>Forma de pago:</strong> Tarjeta de crédito/débito</p>
                  <p><strong>Vigencia:</strong> ${new Date().toLocaleDateString('es-MX')} - ${new Date(Date.now() + (selectedPeriod === 'anual' ? 365 : 30) * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX')}</p>
                </div>
                <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #333; margin-top: 0;">Datos del Representante</h3>
                  <p><strong>Nombre:</strong> ${userData.nombre}</p>
                  <p><strong>Email:</strong> ${userData.email}</p>
                </div>
                <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
                  Este es un correo automático generado por el sistema de registro de ANPR México.
                </p>
              </div>
            `;
            
            // Send to all notification emails
            for (const email of notificationEmails) {
              try {
                await transporter.sendMail({
                  from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
                  to: email,
                  subject: `Nueva Empresa Registrada: ${company.nombreEmpresa}`,
                  html: htmlContent,
                });
                console.log(`Registration notification sent to ${email}`);
              } catch (sendError) {
                console.error(`Failed to send notification to ${email}:`, sendError);
              }
            }
          }
        }
      } catch (notificationError) {
        console.error("Error sending registration notifications:", notificationError);
        // Don't fail the registration if notification sending fails
      }

      // Send welcome email to the new user using the template
      try {
        const welcomeResult = await sendWelcomeEmail(
          userData.email,
          userData.nombre,
          company.nombreEmpresa,
          membershipType.nombrePlan,
          company.id,
          `$${amount.toFixed(2)} ${(await getConfiguredCurrency()).toUpperCase()}`,
          selectedPeriod
        );
        if (welcomeResult.success) {
          console.log(`Welcome email sent to ${userData.email}`);
        } else {
          console.log(`Failed to send welcome email: ${welcomeResult.message}`);
        }
      } catch (welcomeError) {
        console.error("Error sending welcome email:", welcomeError);
        // Don't fail the registration if welcome email fails
      }

      res.json({
        success: true,
        user: { id: user.id, email: user.email },
        company: { id: company.id, nombre: company.nombreEmpresa }
      });
    } catch (error: any) {
      console.error("Error completing registration:", error);
      
      // Provide specific user-friendly error messages
      let userMessage = "Hubo un problema al procesar tu registro. Por favor, intenta nuevamente.";
      let statusCode = 500;
      
      if (error.code === '23505') { // Unique constraint violation
        if (error.constraint === 'users_email_unique') {
          userMessage = "Ya existe una cuenta con este correo electrónico. Si ya tienes una cuenta, inicia sesión en lugar de registrarte nuevamente.";
          statusCode = 400;
        } else if (error.constraint === 'companies_nombre_empresa_unique') {
          userMessage = "Ya existe una empresa registrada con este nombre. Por favor, utiliza un nombre diferente.";
          statusCode = 400;
        }
      } else if (error.code === '23503') { // Foreign key constraint
        userMessage = "Algunos datos seleccionados no son válidos. Por favor, verifica tu información e intenta nuevamente.";
        statusCode = 400;
      } else if (error.message?.includes('payment')) {
        userMessage = "Hubo un problema al procesar el pago. Por favor, verifica los datos de tu tarjeta e intenta nuevamente.";
        statusCode = 400;
      } else if (error.message?.includes('Stripe')) {
        userMessage = "Error en el procesamiento del pago. Por favor, contacta a soporte si el problema persiste.";
        statusCode = 400;
      }
      
      res.status(statusCode).json({ 
        error: error.message,
        userMessage: userMessage,
        supportContact: "Para obtener ayuda adicional, contacta a soporte en soporte@anpr.org.mx"
      });
    }
  });

  // Temporary login endpoint for manually-created accounts (admin-created users with manual_ firebaseUid)
  app.post("/api/login-temp", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log("Login attempt for:", email);

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      console.log("Found user:", user ? { id: user.id, email: user.email, firebaseUid: user.firebaseUid, role: user.role } : null);
      
      if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      // Only allow this endpoint for manually-created accounts
      // These have firebaseUid starting with "manual_" or "admin-created-"
      // Real Firebase users must authenticate through Firebase
      const isManualUser = user.firebaseUid && (
        user.firebaseUid.startsWith("manual_") ||
        user.firebaseUid.startsWith("admin-created-")
      );
      if (!isManualUser) {
        return res.status(400).json({ error: "Please use Firebase login" });
      }

      // Manual users MUST have a stored password — never allow access without one
      if (!user.tempPassword) {
        console.log("Login blocked: manual user has no stored password");
        return res.status(401).json({ error: "Cuenta no activada. Contacte al administrador." });
      }

      // Validate password: support both bcrypt hashes and legacy plain-text temp passwords
      const isBcryptHash = user.tempPassword.startsWith("$2b$") || user.tempPassword.startsWith("$2a$");
      let passwordValid = false;

      if (isBcryptHash) {
        passwordValid = await bcrypt.compare(password, user.tempPassword);
      } else {
        // Legacy plain-text comparison (for accounts not yet changed)
        passwordValid = user.tempPassword === password;
      }

      if (!passwordValid) {
        console.log("Login blocked: invalid password for user", user.id);
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      // Emitir cookie de sesión firmada (HttpOnly): prueba verificable por el
      // servidor de que este usuario se autenticó con credenciales válidas.
      // Se usa para autorizar acciones sensibles (p. ej. configuración de Stripe).
      res.cookie(ADMIN_SESSION_COOKIE, signAdminSession(user.id), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: ADMIN_SESSION_TTL_MS,
        path: "/",
      });

      // Return user data for successful login (never expose the stored password).
      // Se adjuntan permisos/roleId/accesoAdmin desde la tabla `roles` para que un
      // rol personalizado con "Acceso al Dashboard de Administración" habilite el panel.
      console.log("Login successful for user:", user.id);
      const roleInfo = await attachRoleInfo(user as any);
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.role,
          roleId: roleInfo?.roleId,
          permisos: roleInfo?.permisos ?? [],
          accesoAdmin: roleInfo?.accesoAdmin ?? false,
          firebaseUid: user.firebaseUid,
          requirePasswordChange: user.requirePasswordChange,
          tempPassword: null,
          stripeCustomerId: user.stripeCustomerId,
          stripeSubscriptionId: user.stripeSubscriptionId,
          autoRenewal: user.autoRenewal,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      });
    } catch (error: any) {
      console.error("Error in temp login:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // El antiguo intercambio de id/email de WordPress no demostraba que el
  // solicitante fuera dueño de esa sesión. Se conserva la ruta para que clientes
  // anteriores fallen explícitamente y migren al SSO JWT firmado.
  app.post("/api/auth/wordpress-session", (_req, res) => {
    return res.status(401).json({
      authenticated: false,
      reason: "signed_assertion_required",
    });
  });

  // ---------------------------------------------------------------------------
  // SSO por JWT firmado desde WordPress (?wp_token=).
  // ---------------------------------------------------------------------------
  // WordPress firma un JWT (HS256 con WP_SSO_SECRET) cuando un miembro logueado
  // llega al directorio. Aquí lo verificamos y derivamos la sesión de
  // representante desde la BD LOCAL (users/companies). SOLO LECTURA: no se crea
  // ni modifica ningún registro.
  app.post("/api/auth/wordpress-sso", async (req, res) => {
    try {
      const { token } = req.body ?? {};

      if (typeof token !== "string" || token.trim().length === 0) {
        return res
          .status(400)
          .json({ authenticated: false, reason: "invalid_request" });
      }

      if (!isWordPressJwtConfigured()) {
        // Sin secreto configurado no podemos verificar: degradar a visitante.
        return res.status(200).json({ authenticated: false, reason: "error" });
      }

      // Paso 1: verificar firma y expiración del JWT, y extraer el email.
      const payload = verifyWordPressJwt(token.trim());
      if (!payload) {
        return res
          .status(401)
          .json({ authenticated: false, reason: "invalid_token" });
      }

      const email = payload.email.toLowerCase();

      // Paso 2: buscar el usuario local por email (sin crear nada).
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res
          .status(200)
          .json({ authenticated: false, reason: "no_company" });
      }

      // Paso 3: localizar todas las empresas asignadas al representante.
      const companies = await storage.getCompaniesForRepresentative(user.email, user.id);
      const company = companies.find((c) => c.userId === user.id) ?? companies[0];
      if (!company) {
        return res
          .status(200)
          .json({ authenticated: false, reason: "no_company" });
      }

      // Paso 4: verificar que la membresía siga vigente (fechaFinMembresia > hoy).
      // fechaFinMembresia es texto "YYYY-MM-DD"; comparamos como fechas.
      const today = new Date().toISOString().split("T")[0];
      const fin = company.fechaFinMembresia;
      if (!fin || fin < today) {
        return res
          .status(200)
          .json({ authenticated: false, reason: "membership_expired" });
      }

      const sessionToken = signWordPressSessionToken(
        {
          role: "representative",
          companyId: company.id,
          companyIds: companies.map((associated) => associated.id),
          wpEmail: user.email,
          wpUserId: user.id,
          source: "wordpress",
        },
        Date.now(),
        WP_SESSION_TTL_SECONDS,
      );

      // Todo válido → sesión de representante verificable.
      return res.status(200).json({
        authenticated: true,
        token: sessionToken,
        expiresIn: WP_SESSION_TTL_SECONDS,
        source: "wordpress",
        companyId: company.id,
        companyIds: companies.map((associated) => associated.id),
        companies,
        companyName: company.nombreEmpresa,
        userId: user.id,
        displayName: user.displayName ?? company.nombreEmpresa,
        email: user.email,
      });
    } catch (error: any) {
      console.error("[WP SSO] Error in wordpress-sso:", error?.message);
      // Nunca exponemos un error al visitante: degradamos a "no autenticado".
      return res.status(200).json({ authenticated: false, reason: "error" });
    }
  });

  // Public endpoint to self-register an administrator account.
  // NOTE: This is intentionally unprotected per product request — anyone who can
  // reach this endpoint can create an admin account. Consider gating it behind a
  // secret code or a "bootstrap-only" check before going to production.
  app.post("/api/register-admin", async (req, res) => {
    try {
      const { email, password, displayName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email y contraseña son requeridos" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ error: "Email inválido" });
      }

      if (String(password).length < 6) {
        return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      }

      // Reject if an account with this email already exists
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ error: "Ya existe una cuenta con este email" });
      }

      // Hash the password so it can be validated by /api/login-temp
      const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Manual account UID so the login flow routes it through /api/login-temp
      const generatedFirebaseUid = `admin-created-${uuidv4()}`;

      const user = await storage.createUser({
        email: normalizedEmail,
        displayName: displayName?.trim() || normalizedEmail.split("@")[0],
        photoURL: "",
        firebaseUid: generatedFirebaseUid,
        role: "admin",
        tempPassword: hashedPassword,
        requirePasswordChange: false,
      });

      console.log("Admin account self-registered:", user.id, user.email);

      return res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      });
    } catch (error: any) {
      console.error("Error registering admin:", error);
      res.status(500).json({ error: "No se pudo crear la cuenta de administrador" });
    }
  });

  // Change temporary password endpoint
  app.post("/api/change-temp-password", async (req, res) => {
    try {
      const { userId, currentPassword, newPassword } = req.body;
      console.log("Changing password for user:", userId);

      if (!userId || !newPassword) {
        return res.status(400).json({ error: "User ID and new password are required" });
      }

      // Find user by ID
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // La contraseña actual es OBLIGATORIA para cuentas con contraseña temporal.
      // Sin esto, cualquiera podía cambiar la contraseña de otra cuenta enviando
      // solo { userId, newPassword } (toma de cuentas).
      if (user.tempPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: "La contraseña actual es requerida" });
        }
        const isBcryptHash = user.tempPassword.startsWith("$2b$") || user.tempPassword.startsWith("$2a$");
        const currentPasswordValid = isBcryptHash
          ? await bcrypt.compare(currentPassword, user.tempPassword)
          : user.tempPassword === currentPassword;
        if (!currentPasswordValid) {
          return res.status(401).json({ error: "Contraseña actual incorrecta" });
        }
      }

      // Hash the new password with bcrypt before storing
      const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      // Update user: store bcrypt hash and mark password change complete
      const updatedUser = await storage.updateUser(userId, {
        requirePasswordChange: false,
        tempPassword: hashedPassword
      });

      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to update user" });
      }

      console.log("Password changed successfully for user:", userId);
      return res.json({ 
        success: true, 
        message: "Contraseña actualizada exitosamente",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          photoURL: updatedUser.photoURL,
          role: updatedUser.role,
          requirePasswordChange: updatedUser.requirePasswordChange
        }
      });
    } catch (error: any) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RECUPERACIÓN DE CONTRASEÑA (vía Firebase Admin + SMTP fijo Sistemas@anpr.org.mx)
  // No modifica el flujo de login ni la tabla users. Usa una tabla aislada de tokens.
  // ═══════════════════════════════════════════════════════════════════════════

  // Rate limiting en memoria por IP (complementa el límite por correo en BD).
  const RESET_IP_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
  const RESET_IP_MAX = 10; // máx. solicitudes por IP en la ventana
  const RESET_EMAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
  const RESET_EMAIL_MAX = 3; // máx. correos por dirección en la ventana
  const resetIpHits = new Map<string, number[]>();

  function ipRateLimited(ip: string): boolean {
    const now = Date.now();
    const hits = (resetIpHits.get(ip) || []).filter((t) => now - t < RESET_IP_WINDOW_MS);
    hits.push(now);
    resetIpHits.set(ip, hits);
    return hits.length > RESET_IP_MAX;
  }

  function getClientIp(req: any): string {
    const fwd = (req.headers["x-forwarded-for"] as string) || "";
    return fwd.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
  }

  function getBaseUrl(req: any): string {
    if (process.env.REPLIT_APP_URL) return process.env.REPLIT_APP_URL.replace(/\/$/, "");
    const host =
      (req.headers["x-forwarded-host"] as string) || (req.headers["host"] as string);
    if (host) {
      const proto = (req.headers["x-forwarded-proto"] as string) || "https";
      return `${proto}://${host}`;
    }
    if (process.env.REPLIT_DOMAINS) {
      return `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`;
    }
    return "https://directorio.anpr.org.mx";
  }

  // Política de contraseñas existente del sistema (mínimo 8 caracteres).
  const resetPasswordSchema = z
    .object({
      token: z.string().min(20, "Token inválido"),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
      confirmPassword: z.string().min(8, "Confirma tu contraseña"),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: "Las contraseñas no coinciden",
      path: ["confirmPassword"],
    });

  // ── Paso 1: solicitar recuperación ────────────────────────────────────────
  app.post("/api/forgot-password", async (req, res) => {
    const ip = getClientIp(req);
    try {
      const emailRaw = (req.body?.email || "").toString().trim().toLowerCase();
      console.log(`[password-reset] Solicitud de recuperación para "${emailRaw}" desde ${ip}`);

      // Validación de formato.
      const emailValid = z.string().email().safeParse(emailRaw).success;
      if (!emailValid) {
        return res.status(400).json({ success: false, error: "Email inválido" });
      }

      // Rate limit por IP.
      if (ipRateLimited(ip)) {
        console.warn(`[password-reset] Rate limit por IP alcanzado: ${ip}`);
        return res.status(429).json({
          success: false,
          error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
        });
      }

      // Rate limit por correo (BD).
      const since = new Date(Date.now() - RESET_EMAIL_WINDOW_MS);
      const recent = await storage.countRecentPasswordResetRequests(emailRaw, since);
      if (recent >= RESET_EMAIL_MAX) {
        console.warn(`[password-reset] Rate limit por correo alcanzado: ${emailRaw}`);
        return res.status(429).json({
          success: false,
          error: "Demasiados intentos para este correo. Espera unos minutos e inténtalo de nuevo.",
        });
      }

      // Buscar el usuario en Firebase (fuente de verdad). Si Admin no está
      // disponible, intentamos resolver el nombre desde la BD como respaldo.
      let exists = false;
      let uid: string | undefined;
      let displayName: string | undefined;

      if (isFirebaseAdminAvailable()) {
        const fb = await findFirebaseUserByEmail(emailRaw);
        exists = fb.exists;
        uid = fb.uid;
        displayName = fb.displayName;
      } else {
        console.error(
          `[password-reset] Firebase Admin no disponible: ${getFirebaseAdminError()}`
        );
      }

      // Respaldo en BD: las cuentas creadas manualmente (administradores y
      // representantes con firebaseUid "admin-created-*" / "manual_*") NO viven
      // en Firebase, sino en la base de datos local. Si Firebase no las encontró
      // (o Admin no está disponible), buscarlas en la BD para que también
      // reciban su correo de recuperación.
      if (!exists) {
        const dbUser = await storage.getUserByEmail(emailRaw);
        if (dbUser) {
          exists = true;
          displayName = displayName || dbUser.displayName || undefined;
        }
      } else if (!displayName) {
        // Completar el nombre desde la BD si Firebase no lo trae.
        const dbUser = await storage.getUserByEmail(emailRaw);
        displayName = dbUser?.displayName || undefined;
      }

      if (!exists) {
        // Avisar explícitamente que el correo no está registrado (a petición del
        // negocio). NOTA: esto permite enumerar qué correos existen en el sistema.
        console.log(`[password-reset] Email NO registrado: ${emailRaw}`);
        return res.status(404).json({
          success: false,
          notFound: true,
          error: "Correo no encontrado. Verifica que esté escrito correctamente o regístrate.",
        });
      }

      // Generar token firmado + guardar su hash con expiración de 60 min.
      const { rawToken, tokenHash } = generateResetToken();
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
      await storage.createPasswordResetToken({
        email: emailRaw,
        firebaseUid: uid || null,
        tokenHash,
        expiresAt,
        requestIp: ip,
      });

      const resetLink = `${getBaseUrl(req)}/restablecer-contrasena?token=${rawToken}`;
      const sendResult = await sendPasswordResetEmail(emailRaw, resetLink, displayName);

      if (sendResult.success) {
        console.log(`[password-reset] Correo de recuperación ENVIADO a ${emailRaw}`);
        return res.json({
          success: true,
          message:
            "Te enviamos un correo con un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada (y spam). El enlace caduca en 60 minutos.",
        });
      }

      // El correo existe pero el envío SMTP falló: avisar del error real.
      console.error(`[password-reset] ERROR de envío a ${emailRaw}: ${sendResult.message}`);
      return res.status(502).json({
        success: false,
        error:
          "No pudimos enviar el correo en este momento. Inténtalo de nuevo en unos minutos o contacta a soporte.",
      });
    } catch (error: any) {
      console.error("[password-reset] Error en /api/forgot-password:", error?.message || error);
      return res.status(500).json({
        success: false,
        error: "Ocurrió un error al procesar la solicitud. Inténtalo más tarde.",
      });
    }
  });

  // ── Validar token (para que la UI muestre el formulario o "enlace expirado") ─
  app.get("/api/reset-password/validate", async (req, res) => {
    try {
      const token = (req.query?.token || "").toString();
      if (!token || token.length < 20) {
        return res.json({ valid: false });
      }
      const tokenRecord = await storage.getValidPasswordResetToken(hashToken(token));
      return res.json({ valid: !!tokenRecord });
    } catch (error: any) {
      console.error("[password-reset] Error validando token:", error?.message || error);
      return res.json({ valid: false });
    }
  });

  // ── Paso 2: restablecer la contraseña ──────────────────────────────────────
  app.post("/api/reset-password", async (req, res) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg = parsed.error.errors[0]?.message || "Datos inválidos";
        return res.status(400).json({ error: msg });
      }
      const { token, password } = parsed.data;

      // Buscar token válido (no usado y no expirado).
      const tokenRecord = await storage.getValidPasswordResetToken(hashToken(token));
      if (!tokenRecord) {
        console.warn("[password-reset] Token inválido o expirado en /api/reset-password");
        return res.status(400).json({
          error: "El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.",
        });
      }

      // ¿Dónde vive la contraseña de este usuario? Las cuentas creadas
      // manualmente (administradores y representantes con firebaseUid
      // "admin-created-*" / "manual_*") guardan su contraseña en la BD local
      // (tempPassword, hash bcrypt), no en Firebase. Misma lógica que usa
      // /api/login-temp para decidir cómo validar el acceso.
      const dbUser = await storage.getUserByEmail(tokenRecord.email);
      const isManualAccount =
        !!dbUser?.firebaseUid &&
        (dbUser.firebaseUid.startsWith("manual_") ||
          dbUser.firebaseUid.startsWith("admin-created-"));

      if (isManualAccount) {
        // Actualizar la contraseña en la BD (hash bcrypt) y limpiar el flag de
        // cambio obligatorio: el usuario acaba de definir su propia contraseña.
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await storage.updateUser(dbUser!.id, {
          tempPassword: hashedPassword,
          requirePasswordChange: false,
        });

        await storage.markPasswordResetTokenUsed(tokenRecord.id);
        await storage.invalidatePasswordResetTokensForEmail(tokenRecord.email);

        console.log(
          `[password-reset] RESTABLECIMIENTO EXITOSO (cuenta local) para ${tokenRecord.email} (id ${dbUser!.id})`
        );

        return res.json({
          success: true,
          message: "Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión.",
        });
      }

      // Firebase Admin es obligatorio para aplicar el cambio donde vive la contraseña.
      if (!isFirebaseAdminAvailable()) {
        const detail = getFirebaseAdminError();
        console.error(`[password-reset] Firebase Admin no disponible al restablecer: ${detail}`);
        return res.status(503).json({
          error:
            "El servicio de recuperación no está disponible temporalmente. Intenta más tarde o contacta a soporte.",
        });
      }

      // Cambiar la contraseña en Firebase Authentication.
      const result = await updateFirebasePasswordByEmail(tokenRecord.email, password);
      if (!result.found) {
        if (result.error) {
          console.error(`[password-reset] Error al actualizar en Firebase: ${result.error}`);
          return res.status(503).json({
            error: "No se pudo actualizar la contraseña en este momento. Intenta más tarde.",
          });
        }
        // El usuario ya no existe en Firebase: invalidar token y mensaje genérico.
        await storage.markPasswordResetTokenUsed(tokenRecord.id);
        console.warn(
          `[password-reset] Usuario ${tokenRecord.email} no encontrado en Firebase al restablecer`
        );
        return res.status(400).json({
          error: "El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo.",
        });
      }

      // Invalidar el token usado y cualquier otro token activo del mismo email.
      await storage.markPasswordResetTokenUsed(tokenRecord.id);
      await storage.invalidatePasswordResetTokensForEmail(tokenRecord.email);

      console.log(
        `[password-reset] RESTABLECIMIENTO EXITOSO para ${tokenRecord.email} (uid ${result.uid})`
      );

      return res.json({
        success: true,
        message: "Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión.",
      });
    } catch (error: any) {
      console.error("[password-reset] Error en /api/reset-password:", error?.message || error);
      return res.status(500).json({ error: "No se pudo restablecer la contraseña. Intenta más tarde." });
    }
  });

  // ── Diagnóstico: verificar conexión con Firebase Admin (solo lectura) ───────
  app.get("/api/password-reset/health", async (_req, res) => {
    const result = await verifyFirebaseAdminConnection();
    res.status(result.ok ? 200 : 503).json(result);
  });

  // Admin endpoint to reset password for a manually-created user
  app.post("/api/admin/reset-user-password", async (req, res) => {
    try {
      const { userId, newPassword } = req.body;

      if (!userId || !newPassword) {
        return res.status(400).json({ error: "User ID and new password are required" });
      }

      const user = await storage.getUser(parseInt(userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Only manual users can have their password reset this way
      const isManualUser = user.firebaseUid && (
        user.firebaseUid.startsWith("manual_") ||
        user.firebaseUid.startsWith("admin-created-")
      );
      if (!isManualUser) {
        return res.status(400).json({ error: "This endpoint is only for manually-created accounts" });
      }

      // Hash the new password with bcrypt
      const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      const updatedUser = await storage.updateUser(parseInt(userId), {
        tempPassword: hashedPassword,
        requirePasswordChange: true,
      });

      if (!updatedUser) {
        return res.status(500).json({ error: "Failed to reset password" });
      }

      console.log("Password reset successfully for user:", userId);
      return res.json({ success: true, message: "Contraseña restablecida exitosamente" });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Admin endpoint to create a user with company (free membership).
  // Autorización: cualquier administrador verificado (rol confirmado en BD)
  // puede crear usuarios; se usa el mismo middleware de verificación de admin
  // que el resto del panel (Firebase token, cookie firmada o x-user-info + BD).
  app.post("/api/admin/create-user-with-company", requireStripeAdmin, async (req, res) => {
    let createdUserId: number | null = null;
    let createdCompanyId: number | null = null;
    try {
      const { userData, companyData, membershipTypeId, membershipPeriodicidad } = req.body;

      if (!userData?.email || !userData?.displayName) {
        return res.status(400).json({ error: "Email and name are required" });
      }
      const requestedRole = userData.role || "representante";
      if (isRepresentativeRole(requestedRole) && !companyData?.nombreEmpresa?.trim()) {
        return res.status(409).json({
          error: "Un representante debe crearse con una empresa inicial",
          code: "REPRESENTATIVE_COMPANY_REQUIRED",
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "Ya existe un usuario con este correo electrónico" });
      }

      // Generate a unique Firebase UID for admin-created users
      const { v4: uuidv4 } = await import('uuid');
      const generatedFirebaseUid = `admin-created-${uuidv4()}`;
      
      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();

      // Create user
      const user = await storage.createUser({
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL || "",
        firebaseUid: generatedFirebaseUid,
        role: requestedRole,
        tempPassword: tempPassword,
        requirePasswordChange: true,
      });
      if (user.firebaseUid !== generatedFirebaseUid) {
        return res.status(409).json({ error: "Ya existe un usuario con este correo electrónico" });
      }
      createdUserId = user.id;

      let company = null;
      
      // Create company if company data is provided
      if (companyData?.nombreEmpresa) {
        // Calculate dates
        const startDate = new Date().toISOString().split('T')[0];
        let endDate = startDate;
        if (membershipPeriodicidad === 'anual') {
          endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (membershipPeriodicidad === 'mensual') {
          endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }

        company = await storage.createCompany({
          nombreEmpresa: companyData.nombreEmpresa,
          email1: companyData.email1 || userData.email,
          telefono1: companyData.telefono1 || "",
          direccionFisica: companyData.direccionFisica || "",
          descripcionEmpresa: companyData.descripcionEmpresa || "",
          sitioWeb: companyData.sitioWeb || "",
          logotipoUrl: null,
          fotoPortadaUrl: null,
          ubicacionGeografica: null,
          membershipTypeId: membershipTypeId || null,
          membershipPeriodicidad: membershipPeriodicidad || null,
          formaPago: "admin",
          fechaInicioMembresia: startDate,
          fechaFinMembresia: endDate,
          userId: user.id,
          estado: "activo"
        });
        createdCompanyId = company.id;

        if (isRepresentativeRole(user.role)) {
          await storage.addRepresentativeCompany(company.id, user.id);
        }

        // Create company locations if provided
        if (companyData.locations && Array.isArray(companyData.locations)) {
          for (const location of companyData.locations) {
            await storage.createCompanyLocation({
              companyId: company.id,
              address: location.address,
              lat: location.lat,
              lng: location.lng,
              isPrincipal: location.isPrincipal || false
            });
          }
        }

        // Assign certificates from membership plan if applicable
        if (membershipTypeId) {
          const certificates = await storage.getAllCertificates();
          const membershipCertificates = certificates.filter(cert => {
            if (!cert.membershipPlanIds) return false;
            try {
              let planIds = [];
              if (typeof cert.membershipPlanIds === 'string') {
                planIds = JSON.parse(cert.membershipPlanIds);
              } else if (Array.isArray(cert.membershipPlanIds)) {
                planIds = cert.membershipPlanIds;
              }
              return planIds.includes(membershipTypeId);
            } catch (error) {
              return false;
            }
          });

          for (const cert of membershipCertificates) {
            await storage.assignCertificateToCompany(company.id, cert.id, {
              fechaObtencion: new Date().toISOString().split('T')[0],
              asignadoPorAdmin: true,
            });
          }
        }
      }

      console.log(`Admin created user ${user.id} with company ${company?.id || 'none'}`);
      createdUserId = null;
      createdCompanyId = null;

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          tempPassword: tempPassword,
        },
        company: company ? {
          id: company.id,
          nombreEmpresa: company.nombreEmpresa,
        } : null,
      });
    } catch (error: any) {
      console.error("Error in admin create user:", error);
      if (createdCompanyId != null) {
        await storage.deleteCompany(createdCompanyId).catch((cleanupError) => {
          console.error("Error cleaning up failed admin-created company:", cleanupError);
        });
      }
      if (createdUserId != null) {
        await storage.deleteUser(createdUserId).catch((cleanupError) => {
          console.error("Error cleaning up failed admin-created user:", cleanupError);
        });
      }
      res.status(500).json({ error: error.message || "Failed to create user" });
    }
  });

  // Verify temporary password for WordPress users (before creating Firebase account)
  app.post("/api/verify-temp-password", async (req, res) => {
    try {
      const { email, tempPassword } = req.body;

      if (!email || !tempPassword) {
        return res.status(400).json({ error: "Email and temporary password are required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify temporary password matches (support both plain text and bcrypt hashes)
      if (!user.tempPassword) {
        return res.status(401).json({ error: "Invalid temporary password" });
      }
      const isBcryptHash = user.tempPassword.startsWith("$2b$") || user.tempPassword.startsWith("$2a$");
      const tempPasswordValid = isBcryptHash
        ? await bcrypt.compare(tempPassword, user.tempPassword)
        : user.tempPassword === tempPassword;
      if (!tempPasswordValid) {
        return res.status(401).json({ error: "Invalid temporary password" });
      }

      // Return user info if verification successful
      res.json({ 
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          requirePasswordChange: user.requirePasswordChange
        }
      });
    } catch (error: any) {
      console.error("Error verifying temp password:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Update Firebase UID after account creation (called from client after creating Firebase account)
  app.post("/api/activate-wordpress-account", async (req, res) => {
    try {
      const { userId, firebaseUid } = req.body;

      if (!userId || !firebaseUid) {
        return res.status(400).json({ error: "User ID and Firebase UID are required" });
      }

      // Update user with new Firebase UID and clear temp password
      const updatedUser = await storage.updateUser(parseInt(userId), {
        firebaseUid: firebaseUid,
        tempPassword: null,
        requirePasswordChange: false
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ 
        success: true,
        message: "Account activated successfully",
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          role: updatedUser.role
        }
      });
    } catch (error: any) {
      console.error("Error activating account:", error);
      res.status(500).json({ error: "Failed to activate account" });
    }
  });

  // Auto-renewal toggle endpoint
  app.patch("/api/users/:userId/auto-renewal", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const { autoRenewal, subscriptionId } = req.body;

      // Update user auto-renewal preference
      const updatedUser = await storage.updateUser(userId, { autoRenewal });
      
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // If there's a Stripe subscription, update it
      if (subscriptionId) {
        const stripe = await getStripe();

        await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: !autoRenewal,
        });
      }

      res.json({ 
        autoRenewal: updatedUser.autoRenewal,
        message: autoRenewal ? "Auto-renewal enabled" : "Auto-renewal disabled"
      });
    } catch (error) {
      console.error("Error updating auto-renewal:", error);
      res.status(500).json({ error: "Failed to update auto-renewal setting" });
    }
  });

  // Representative dashboard data
  app.get("/api/representative/dashboard/:userId", async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);

      // Autorización: solo el propio usuario o un admin (rol confirmado en BD,
      // no se confía en los claims del header del cliente).
      const verifiedRequester = await getVerifiedRequestUser(req);
      if (!verifiedRequester?.id) {
        return res.status(401).json({ error: "No autenticado" });
      }
      if (Number(verifiedRequester.id) !== userId) {
        if (!isAdminUser(verifiedRequester)) {
          return res.status(403).json({ error: "No autorizado" });
        }
      } else {
        const dbUser = await storage.getUser(userId);
        if (!dbUser) {
          return res.status(401).json({ error: "No autenticado" });
        }
      }
      
      // Get normalized assignments first, with legacy links as rollout fallback.
      const basicCompanies = await storage.getCompaniesForRepresentative(
        (await storage.getUser(userId))?.email || "",
        userId,
      );
      const companies = (await Promise.all(
        basicCompanies.map((company) => storage.getCompany(company.id)),
      )).filter((company): company is NonNullable<typeof company> => !!company);
      console.log("Found companies:", companies.length);
      
      // Get payment history
      const payments = await storage.getUserPayments(userId);
      console.log("Found payments:", payments.length);
      
      // Get current membership info
      let currentMembership = null;
      if (companies.length > 0 && companies[0].membershipTypeId) {
        currentMembership = await storage.getMembershipType(companies[0].membershipTypeId);
      }

      const dashboardData = {
        companies: companies || [],
        payments: payments || [],
        currentMembership,
        stats: {
          totalCompanies: companies?.length || 0,
          activePayments: payments?.filter(p => p.status === 'succeeded').length || 0,
          nextRenewal: companies[0]?.fechaFinMembresia || null
        }
      };

      console.log("Sending dashboard data:", JSON.stringify(dashboardData, null, 2));
      res.json(dashboardData);
    } catch (error: any) {
      console.error("Dashboard error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // PDF Settings API endpoints
  app.get("/api/pdf-settings", async (req, res) => {
    try {
      const settings = await storage.getPdfSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/pdf-settings", async (req, res) => {
    try {
      if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
      const validatedData = insertPdfSettingsSchema.partial().parse(req.body);
      const settings = await storage.updatePdfSettings(validatedData);
      res.json(settings);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Datos inválidos", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Upload PDF logo endpoint
  app.post("/api/pdf-settings/upload-logo", uploadPdfLogo.single('logo'), validateUploadedImages, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No se seleccionó ningún archivo" });
      }

      // Validate file exists and is accessible
      const filePath = path.join(process.cwd(), 'uploads', 'pdf-logos', req.file.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(500).json({ error: "Error al guardar el archivo" });
      }

      res.json({
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        path: `/uploads/pdf-logos/${req.file.filename}`
      });
    } catch (error: any) {
      console.error("Error uploading PDF logo:", error);
      res.status(500).json({ error: error.message || "Error al subir el logotipo" });
    }
  });

  // System Settings image upload configuration
  // Keep system images in memory until validateUploadedImages accepts them.
  const systemImageStorage = multer.memoryStorage();

  const uploadSystemImages = multer({
    storage: systemImageStorage,
    limits: {
      fileSize: IMAGE_MAX_BYTES + 1
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/svg+xml'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos PNG, JPG, JPEG o SVG'));
      }
    }
  });

  // System Settings image upload endpoint
  app.post("/api/system-settings/upload-image", uploadSystemImages.single('file'), validateUploadedImages, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No se recibió ningún archivo" });
      }

      // Validate file exists and is accessible
      const type = req.body.type || 'logo';
      const uploadDir = type === 'logo' ? 'uploads/system-logos' : 'uploads/system-favicons';
      const filePath = path.join(process.cwd(), uploadDir, req.file.filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(500).json({ error: "Error al guardar el archivo" });
      }

      res.json({
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        type: type,
        path: `/${uploadDir}/${req.file.filename}`
      });
    } catch (error: any) {
      console.error("Error uploading system image:", error);
      res.status(500).json({ error: error.message || "Error al subir la imagen" });
    }
  });

  // Email Configuration Routes
  app.get("/api/email-config", async (req, res) => {
    try {
      const config = await storage.getEmailConfiguration();
      res.json(config);
    } catch (error) {
      console.error("Error fetching email config:", error);
      res.status(500).json({ error: "Failed to fetch email configuration" });
    }
  });

  app.post("/api/email-config", async (req, res) => {
    try {
      const validatedData = insertEmailConfigurationSchema.parse(req.body);
      const config = await storage.saveEmailConfiguration(validatedData);
      res.json(config);
    } catch (error) {
      console.error("Error saving email config:", error);
      res.status(500).json({ error: "Failed to save email configuration" });
    }
  });

  app.post("/api/email-config/test", async (req, res) => {
    try {
      const validatedData = insertEmailConfigurationSchema.parse(req.body);
      const result = await storage.testEmailConfiguration(validatedData);
      res.json(result);
    } catch (error) {
      console.error("Error testing email config:", error);
      res.status(500).json({ error: "Failed to test email configuration" });
    }
  });

  // Test notification emails endpoint
  app.post("/api/test-notification-emails", async (req, res) => {
    try {
      const systemSettings = await storage.getSystemSettings();
      const notificationEmails = systemSettings.notificationEmails as string[] || [];
      
      if (notificationEmails.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "No hay correos de notificación configurados. Agrega al menos un correo y guarda la configuración antes de probar." 
        });
      }
      
      const emailConfig = await storage.getEmailConfiguration();
      
      if (!emailConfig) {
        return res.status(400).json({ 
          success: false, 
          error: "No hay configuración de correo SMTP. Configura el servidor de correo primero en la sección de Email." 
        });
      }
      
      const nodemailer = await import('nodemailer');
      
      const transporterConfig: any = {
        host: emailConfig.smtpHost,
        port: emailConfig.smtpPort,
        secure: emailConfig.encryption === 'ssl',
        auth: {
          user: emailConfig.username,
          pass: emailConfig.password,
        },
      };
      
      if (emailConfig.encryption === 'tls') {
        transporterConfig.requireTLS = true;
        transporterConfig.tls = { rejectUnauthorized: false };
      } else if (emailConfig.encryption === 'ssl') {
        transporterConfig.secure = true;
        transporterConfig.tls = { rejectUnauthorized: false };
      }
      
      const transporter = nodemailer.default.createTransport(transporterConfig);
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f2161; border-bottom: 2px solid #bcce16; padding-bottom: 10px;">
            🧪 Correo de Prueba - Notificaciones de Registro
          </h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">¡La configuración funciona!</h3>
            <p>Este es un correo de prueba para verificar que las notificaciones de nuevos registros están funcionando correctamente.</p>
            <p><strong>Fecha de prueba:</strong> ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</p>
          </div>
          <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Ejemplo de Datos de Empresa</h3>
            <p><strong>Nombre:</strong> Empresa de Prueba S.A. de C.V.</p>
            <p><strong>Email:</strong> prueba@empresa.com</p>
            <p><strong>Teléfono:</strong> +52 55 1234 5678</p>
            <p><strong>Plan:</strong> Membresía Empresarial</p>
            <p><strong>Periodicidad:</strong> Anual</p>
          </div>
          <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Ejemplo de Representante</h3>
            <p><strong>Nombre:</strong> Juan Pérez García</p>
            <p><strong>Email:</strong> juan.perez@empresa.com</p>
          </div>
          <p style="color: #666; font-size: 12px; text-align: center; margin-top: 30px;">
            Este es un correo de prueba generado desde la configuración del sistema ANPR México.
          </p>
        </div>
      `;
      
      const results: { email: string; success: boolean; error?: string }[] = [];
      
      // Send to all notification emails
      for (const email of notificationEmails) {
        try {
          await transporter.sendMail({
            from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
            to: email,
            subject: `🧪 Prueba de Notificación - ANPR México`,
            html: htmlContent,
          });
          console.log(`Test notification sent to ${email}`);
          results.push({ email, success: true });
        } catch (sendError: any) {
          console.error(`Failed to send test notification to ${email}:`, sendError);
          results.push({ email, success: false, error: sendError.message });
        }
      }
      
      const allSuccessful = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;
      
      if (successCount === 0) {
        // All failed - likely SMTP configuration issue
        const firstError = results[0]?.error || "Error desconocido";
        let userFriendlyError = "Error de conexión SMTP. ";
        
        if (firstError.includes('ETIMEDOUT') || firstError.includes('Greeting never received')) {
          userFriendlyError += `No se pudo conectar al servidor de correo (${emailConfig.smtpHost}:${emailConfig.smtpPort}). Verifica que el host, puerto y tipo de encriptación sean correctos en la configuración de Email.`;
        } else if (firstError.includes('AUTH') || firstError.includes('authentication')) {
          userFriendlyError += "Las credenciales de autenticación son incorrectas. Verifica el usuario y contraseña SMTP.";
        } else if (firstError.includes('certificate') || firstError.includes('SSL')) {
          userFriendlyError += "Error de certificado SSL/TLS. Intenta cambiar el tipo de encriptación en la configuración.";
        } else {
          userFriendlyError += firstError;
        }
        
        return res.json({ 
          success: false,
          message: userFriendlyError,
          smtpConfig: {
            host: emailConfig.smtpHost,
            port: emailConfig.smtpPort,
            encryption: emailConfig.encryption
          },
          results 
        });
      }
      
      res.json({ 
        success: allSuccessful,
        message: allSuccessful 
          ? `Correos de prueba enviados exitosamente a ${successCount} destinatario(s)` 
          : `Se enviaron ${successCount} de ${results.length} correos. Algunos fallaron.`,
        results 
      });
    } catch (error: any) {
      console.error("Error testing notification emails:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Error al enviar correos de prueba" 
      });
    }
  });

  // Email Templates Routes
  app.get("/api/email-templates", async (req, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ error: "Failed to fetch email templates" });
    }
  });

  app.post("/api/email-templates", async (req, res) => {
    try {
      const validatedData = insertEmailTemplateSchema.parse(req.body);
      const template = await storage.saveEmailTemplate(validatedData);
      res.json(template);
    } catch (error) {
      console.error("Error saving email template:", error);
      res.status(500).json({ error: "Failed to save email template" });
    }
  });

  app.get("/api/email-templates/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const template = await storage.getEmailTemplateByType(type);
      res.json(template);
    } catch (error) {
      console.error("Error fetching email template:", error);
      res.status(500).json({ error: "Failed to fetch email template" });
    }
  });

  // Test email template endpoint - sends a test email with the specified template
  app.post("/api/email-templates/test/:type", async (req, res) => {
    try {
      const { type } = req.params;
      const { testEmail } = req.body;
      
      // Get email configuration
      const emailConfig = await storage.getEmailConfiguration();
      if (!emailConfig) {
        return res.status(400).json({ 
          success: false, 
          error: "No hay configuración de correo SMTP. Configura el servidor de correo primero." 
        });
      }
      
      // Determine destination email
      const destinationEmail = testEmail || emailConfig.testEmail || emailConfig.fromEmail;
      
      // Get the template if it exists
      const template = await storage.getEmailTemplateByType(type);
      
      // Template names and sample data
      const templateNames: Record<string, string> = {
        welcome: "Bienvenida",
        renewal: "Renovación",
        cancellation: "Cancelación",
        notification: "Notificación de Vencimiento",
        admin_notification: "Notificación de Nuevo Registro"
      };
      
      // Sample data for testing
      const sampleData: Record<string, string> = {
        nombre_usuario: "Usuario de Prueba",
        nombre_empresa: "Empresa Demo S.A.",
        email_empresa: "contacto@empresademo.com",
        telefono_empresa: "+52 55 1234 5678",
        direccion_empresa: "Av. Reforma 123, Col. Centro, CDMX",
        plan_nombre: "Plan Empresarial",
        periodicidad: "Anual",
        monto_pagado: `$12,000.00 ${(await getConfiguredCurrency()).toUpperCase()}`,
        fecha_inicio: new Date().toLocaleDateString('es-MX'),
        fecha_vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-MX'),
        fecha_cancelacion: new Date().toLocaleDateString('es-MX'),
        dias_restantes: "30",
        nombre_representante: "Juan Pérez García",
        email_representante: "juan.perez@empresademo.com"
      };
      
      // Use custom template or generate a default one
      let subject = `🧪 Prueba de Plantilla: ${templateNames[type] || type}`;
      let htmlContent = "";
      
      if (template) {
        // Replace variables in template
        subject = template.subject;
        htmlContent = template.htmlContent;
        for (const [key, value] of Object.entries(sampleData)) {
          const regex = new RegExp(`{{${key}}}`, 'g');
          subject = subject.replace(regex, value);
          htmlContent = htmlContent.replace(regex, value);
        }
      } else {
        // Generate default test email
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb; margin: 0; font-size: 24px;">🧪 Correo de Prueba</h1>
              <p style="color: #6b7280; margin: 10px 0 0 0;">Plantilla: ${templateNames[type] || type}</p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
              <p style="color: #92400e; margin: 0;">
                <strong>⚠️ Plantilla no configurada</strong><br>
                Esta plantilla aún no ha sido personalizada. Configure el contenido en la sección "Plantillas de Correo".
              </p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1e40af; margin: 0 0 15px 0;">📋 Datos de Ejemplo</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #374151;"><strong>Usuario:</strong></td><td style="color: #1f2937;">${sampleData.nombre_usuario}</td></tr>
                <tr><td style="padding: 6px 0; color: #374151;"><strong>Empresa:</strong></td><td style="color: #1f2937;">${sampleData.nombre_empresa}</td></tr>
                <tr><td style="padding: 6px 0; color: #374151;"><strong>Plan:</strong></td><td style="color: #1f2937;">${sampleData.plan_nombre}</td></tr>
                <tr><td style="padding: 6px 0; color: #374151;"><strong>Fecha inicio:</strong></td><td style="color: #1f2937;">${sampleData.fecha_inicio}</td></tr>
                <tr><td style="padding: 6px 0; color: #374151;"><strong>Fecha vencimiento:</strong></td><td style="color: #1f2937;">${sampleData.fecha_vencimiento}</td></tr>
              </table>
            </div>
            
            <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                <strong>Directorio de Proveedores de Equipamiento Urbano</strong><br>
                ANPR México - Sistema de Gestión Empresarial
              </p>
            </div>
          </div>
        `;
      }
      
      const nodemailer = await import('nodemailer');
      
      const transporterConfig: any = {
        host: emailConfig.smtpHost,
        port: emailConfig.smtpPort,
        secure: emailConfig.encryption === 'ssl',
        auth: {
          user: emailConfig.username,
          pass: emailConfig.password,
        },
      };
      
      if (emailConfig.encryption === 'tls' || emailConfig.encryption === 'starttls') {
        transporterConfig.requireTLS = true;
        transporterConfig.tls = { rejectUnauthorized: false };
      } else if (emailConfig.encryption === 'ssl') {
        transporterConfig.secure = true;
        transporterConfig.tls = { rejectUnauthorized: false };
      }
      
      const transporter = nodemailer.default.createTransport(transporterConfig);
      
      await transporter.sendMail({
        from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
        to: destinationEmail,
        subject: `🧪 [PRUEBA] ${subject}`,
        html: htmlContent,
      });
      
      console.log(`Test email template '${type}' sent to ${destinationEmail}`);
      
      res.json({ 
        success: true, 
        message: `Correo de prueba "${templateNames[type] || type}" enviado a ${destinationEmail}`,
        templateConfigured: !!template
      });
    } catch (error: any) {
      console.error("Error testing email template:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Error al enviar correo de prueba" 
      });
    }
  });

  // Scheduled task endpoint for expiration notifications
  // This can be called by an external cron service or manually from admin panel
  app.post("/api/scheduled-tasks/expiration-notifications", async (req, res) => {
    try {
      console.log("Running scheduled expiration notifications check...");
      const result = await checkAndSendExpirationNotifications();
      
      console.log(`Expiration notifications: ${result.sent} sent, ${result.errors} errors`);
      
      res.json({
        success: true,
        sent: result.sent,
        errors: result.errors,
        details: result.details,
        executedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error running expiration notifications:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Error al ejecutar notificaciones de vencimiento"
      });
    }
  });

  // Manual trigger for testing expiration notifications
  app.get("/api/scheduled-tasks/expiration-notifications/status", async (req, res) => {
    try {
      const template = await storage.getEmailTemplateByType('notification');
      const timing = template?.notificationTiming as { enabled?: boolean; value?: number; unit?: string } | null;
      
      res.json({
        enabled: timing?.enabled || false,
        daysBeforeExpiration: timing?.value || 7,
        unit: timing?.unit || 'days',
        templateConfigured: !!template
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Llave pública de Stripe (segura para el frontend): usa la del panel si está
  // activa, con respaldo a la de los Secretos del proyecto.
  app.get("/api/stripe-public-key", async (req, res) => {
    try {
      const { publicKey } = await getStripeContext();
      res.json({ publicKey: publicKey || null });
    } catch (error) {
      res.json({ publicKey: null });
    }
  });

  // Stripe Configuration Routes
  app.get("/api/stripe-configuration", async (req, res) => {
    try {
      const config = await storage.getStripeConfiguration();
      if (!config) {
        return res.json(null);
      }
      
      // Nunca enviar secretos al frontend (ni la llave secreta ni el webhook secret)
      const { secretKey, webhookSecret, ...safeConfig } = config;
      res.json({ ...safeConfig, hasWebhookSecret: !!webhookSecret });
    } catch (error) {
      console.error("Error fetching Stripe configuration:", error);
      res.status(500).json({ error: "Failed to fetch configuration" });
    }
  });

  app.post("/api/stripe-configuration", requireStripeAdmin, async (req, res) => {
    try {
      const configSchema = z.object({
        publicKey: z.string().min(1),
        secretKey: z.string().min(1),
        webhookSecret: z.string().optional(),
        environment: z.enum(["test", "live"]),
        isActive: z.boolean(),
      });

      const validatedData = configSchema.parse(req.body);

      // Si el campo llega vacío, no sobrescribir el webhook secret guardado
      if (!validatedData.webhookSecret) {
        delete validatedData.webhookSecret;
      }

      const existingConfig = await storage.getStripeConfiguration();
      let config;
      
      if (existingConfig) {
        config = await storage.updateStripeConfiguration(existingConfig.id, validatedData);
      } else {
        config = await storage.createStripeConfiguration(validatedData);
      }

      // Los cobros usan esta configuración: refrescar la instancia de Stripe
      invalidateStripeCache();
      
      // Nunca enviar secretos de vuelta al frontend
      const { secretKey, webhookSecret, ...safeConfig } = config!;
      res.json({ ...safeConfig, hasWebhookSecret: !!webhookSecret });
    } catch (error) {
      console.error("Error saving Stripe configuration:", error);
      res.status(500).json({ error: "Failed to save configuration" });
    }
  });

  app.post("/api/stripe-configuration/test", requireStripeAdmin, async (req, res) => {
    try {
      const configSchema = z.object({
        publicKey: z.string().min(1),
        secretKey: z.string().min(1),
        webhookSecret: z.string().optional(),
        environment: z.enum(["test", "live"]),
        isActive: z.boolean(),
      });

      const validatedData = configSchema.parse(req.body);
      
      // Test connection with Stripe
      try {
        const testStripe = new Stripe(validatedData.secretKey, {
          apiVersion: "2023-10-16",
        });

        const account = await testStripe.accounts.retrieve();
        
        res.json({
          success: true,
          message: "Conexión exitosa con Stripe",
          details: {
            accountId: account.id,
            businessName: account.business_profile?.name || "N/A",
            country: account.country,
            currency: account.default_currency
          }
        });
      } catch (stripeError: any) {
        res.json({
          success: false,
          message: `Error de Stripe: ${stripeError.message}`,
        });
      }
    } catch (error) {
      console.error("Error testing Stripe connection:", error);
      res.status(500).json({ error: "Failed to test connection" });
    }
  });

  app.post("/api/stripe-configuration/sync-products", requireStripeAdmin, async (req, res) => {
    try {
      const config = await storage.getStripeConfiguration();
      if (!config) {
        return res.status(400).json({ error: "No Stripe configuration found" });
      }

      const syncStripe = new Stripe(config.secretKey, {
        apiVersion: "2023-10-16",
      });

      // Get all membership types
      const membershipTypes = await storage.getAllMembershipTypes();
      let syncedCount = 0;

      for (const membership of membershipTypes) {
        try {
          // Create or update product in Stripe
          let product;
          if (membership.stripeProductId) {
            // Update existing product
            product = await syncStripe.products.update(membership.stripeProductId, {
              name: membership.nombrePlan,
              description: membership.descripcionPlan || undefined,
              metadata: {
                membershipTypeId: membership.id.toString(),
              },
            });
          } else {
            // Create new product
            product = await syncStripe.products.create({
              name: membership.nombrePlan,
              description: membership.descripcionPlan || undefined,
              metadata: {
                membershipTypeId: membership.id.toString(),
              },
            });
          }

          // Create or update price for each pricing option
          if (membership.opcionesPrecios && Array.isArray(membership.opcionesPrecios)) {
            for (const option of membership.opcionesPrecios as any[]) {
              // Always recreate prices to ensure correct periodicidad
              const periodicidad = option.periodicidad.toLowerCase();
              const interval = periodicidad === "mensual" ? "month" :
                             periodicidad === "trimestral" ? "month" :
                             periodicidad === "semestral" ? "month" :
                             "year";
              
              const intervalCount = periodicidad === "trimestral" ? 3 :
                                   periodicidad === "semestral" ? 6 : 1;

              // Archive old price if it exists
              if (option.stripePriceId) {
                try {
                  await syncStripe.prices.update(option.stripePriceId, {
                    active: false
                  });
                  console.log(`Archived old price: ${option.stripePriceId}`);
                } catch (archiveError) {
                  console.log(`Could not archive price ${option.stripePriceId}, creating new one`);
                }
              }

              const price = await syncStripe.prices.create({
                product: product.id,
                unit_amount: Math.round(Number(option.costo) * 100), // Convert to cents
                currency: await getConfiguredCurrency(),
                recurring: {
                  interval: interval as any,
                  interval_count: intervalCount,
                },
                metadata: {
                  membershipTypeId: membership.id.toString(),
                  periodicidad: option.periodicidad,
                },
              });
              
              // Update the pricing option with new Stripe price ID
              option.stripePriceId = price.id;
              console.log(`Created new price for ${membership.nombrePlan} - ${option.periodicidad} (${interval}${intervalCount > 1 ? ` x${intervalCount}` : ''}): ${price.id}`);
            }
          }

          // Update membership type with Stripe IDs
          await storage.updateMembershipType(membership.id, {
            stripeProductId: product.id,
            opcionesPrecios: membership.opcionesPrecios,
          });

          syncedCount++;
        } catch (error) {
          console.error(`Error syncing membership ${membership.id}:`, error);
        }
      }

      res.json({
        success: true,
        synced: syncedCount,
        message: `Se sincronizaron ${syncedCount} productos con Stripe`,
      });
    } catch (error) {
      console.error("Error syncing products:", error);
      res.status(500).json({ error: "Failed to sync products" });
    }
  });

  // Frontend Configuration Routes
  app.get("/api/frontend-config", async (req, res) => {
    try {
      const config = await storage.getFrontendConfiguration();
      if (!config) {
        // Return default configuration if none exists
        res.json({
          id: 0,
          headerBackgroundColor: "#ffffff",
          headerTextColor: "#000000",
          siteName: "Directorio de Proveedores de Equipamiento Urbano",
          menuBackgroundColor: "#ffffff",
          menuTextColor: "#000000",
          menuHoverColor: "#3B82F6",
          showLoginButton: true,
          showRegisterButton: true,
          footerBackgroundColor: "#1e3a8a",
          footerTextColor: "#ffffff",
          showFooterLogo: true,
          companyName: "ANPR México",
          primaryColor: "#3B82F6",
          secondaryColor: "#10B981",
          accentColor: "#F59E0B",
          copyrightText: "© 2025 Todos los derechos reservados",
          menuItems: [
            { id: "1", label: "Inicio", href: "/", icon: "Home", isVisible: true, order: 1 },
            { id: "2", label: "Directorio", href: "/directorio", icon: "Building2", isVisible: true, order: 2 },
            { id: "3", label: "Planes", href: "/planes", icon: "CreditCard", isVisible: true, order: 3 }
          ],
          socialMediaConfig: [
            { id: "1", platform: "Facebook", url: "https://facebook.com/anprmexico", icon: "facebook", isVisible: true, order: 1 },
            { id: "2", platform: "Twitter", url: "https://twitter.com/anprmexico", icon: "twitter", isVisible: true, order: 2 },
            { id: "3", platform: "Instagram", url: "https://instagram.com/anprmexico", icon: "instagram", isVisible: true, order: 3 },
            { id: "4", platform: "YouTube", url: "https://youtube.com/anprmexico", icon: "youtube", isVisible: true, order: 4 },
            { id: "5", platform: "Spotify", url: "https://open.spotify.com/user/anprmexico", icon: "spotify", isVisible: true, order: 5 },
            { id: "6", platform: "WhatsApp", url: "https://wa.me/5299994440600", icon: "whatsapp", isVisible: true, order: 6 }
          ]
        });
      } else {
        res.json(config);
      }
    } catch (error) {
      console.error("Error fetching frontend configuration:", error);
      res.status(500).json({ error: "Failed to fetch frontend configuration" });
    }
  });

  app.post("/api/frontend-config", async (req, res) => {
    try {
      if (requestHasOversizedDataUrlImage(req.body)) return rejectOversizedImage(res);
      // Check if configuration exists
      const existingConfig = await storage.getFrontendConfiguration();
      
      if (existingConfig) {
        // Update existing configuration
        const updatedConfig = await storage.updateFrontendConfiguration(existingConfig.id, req.body);
        res.json(updatedConfig);
      } else {
        // Create new configuration
        const newConfig = await storage.createFrontendConfiguration(req.body);
        res.json(newConfig);
      }
    } catch (error) {
      console.error("Error saving frontend configuration:", error);
      res.status(500).json({ error: "Failed to save frontend configuration" });
    }
  });

  // Upload endpoints for frontend assets
  app.post("/api/frontend-config/upload-header-image", uploadImage.single('file'), validateUploadedImages, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }
      
      const imageUrl = `/uploads/images/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error("Error uploading header image:", error);
      res.status(500).json({ error: "Failed to upload header image" });
    }
  });

  app.post("/api/frontend-config/upload-footer-image", uploadImage.single('file'), validateUploadedImages, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image uploaded" });
      }
      
      const imageUrl = `/uploads/images/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error("Error uploading footer image:", error);
      res.status(500).json({ error: "Failed to upload footer image" });
    }
  });

  app.post("/api/frontend-config/upload-logo", uploadImage.single('file'), validateUploadedImages, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No logo uploaded" });
      }
      
      const logoUrl = `/uploads/images/${req.file.filename}`;
      res.json({ logoUrl });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ error: "Failed to upload logo" });
    }
  });

  // Endpoint para consultar transacciones específicas de MemberPress
  app.get("/api/memberpress-transaction/:transactionId", async (req, res) => {
    try {
      const { transactionId } = req.params;
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      // Intentar obtener la transacción desde diferentes endpoints de MemberPress
      const endpoints = [
        `/wp-json/mp/v1/transactions/${transactionId}`,
        `/wp-json/wp/v2/mp_transaction/${transactionId}`,
        `/wp-json/memberpress/v1/transactions/${transactionId}`
      ];

      let transactionData = null;
      let successfulEndpoint = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            transactionData = await response.json();
            successfulEndpoint = endpoint;
            break;
          }
        } catch (error) {
          // Continuar con el siguiente endpoint
          continue;
        }
      }

      if (!transactionData) {
        return res.status(404).json({ 
          error: `Transacción ${transactionId} no encontrada`,
          attempted_endpoints: endpoints
        });
      }

      res.json({
        transaction_id: transactionId,
        endpoint_used: successfulEndpoint,
        transaction_data: transactionData
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para buscar transacciones por usuario
  app.get("/api/user-transactions/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      // Buscar transacciones del usuario
      const endpoints = [
        `/wp-json/mp/v1/transactions?user=${userId}`,
        `/wp-json/memberpress/v1/transactions?user_id=${userId}`,
        `/wp-json/wp/v2/mp_transaction?author=${userId}`
      ];

      let transactionsData = [];
      let successfulEndpoint = null;

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
              transactionsData = data;
              successfulEndpoint = endpoint;
              break;
            }
          }
        } catch (error) {
          continue;
        }
      }

      res.json({
        user_id: userId,
        endpoint_used: successfulEndpoint,
        transactions_found: transactionsData.length,
        transactions: transactionsData
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para obtener información completa de membresías incluyendo fechas de vencimiento
  app.get("/api/memberpress-memberships/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      // Buscar membresías del usuario en diferentes endpoints de MemberPress
      const membershipEndpoints = [
        `/wp-json/mp/v1/members/${userId}`,
        `/wp-json/mp/v1/subscriptions?user=${userId}`,
        `/wp-json/memberpress/v1/members/${userId}`,
        `/wp-json/wp/v2/mp_member?user=${userId}`
      ];

      let membershipData = {};
      let subscriptions = [];
      let memberData = null;

      // Intentar obtener datos de membresía desde diferentes endpoints
      for (const endpoint of membershipEndpoints) {
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            
            if (endpoint.includes('members')) {
              memberData = data;
            }
            
            if (endpoint.includes('subscriptions')) {
              subscriptions = Array.isArray(data) ? data : [data];
            }
            
            membershipData[endpoint] = { status: response.status, data };
          }
        } catch (error) {
          continue;
        }
      }

      // También obtener información de productos/niveles de membresía
      let membershipProducts = [];
      try {
        const productsResponse = await fetch(`${baseUrl}/wp-json/mp/v1/memberships`, {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (productsResponse.ok) {
          membershipProducts = await productsResponse.json();
        }
      } catch (error) {
        // Continuar sin productos si falla
      }

      // Obtener información del usuario con metadatos de MemberPress
      let userWithMeta = null;
      try {
        const userResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users/${userId}?context=edit`, {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (userResponse.ok) {
          userWithMeta = await userResponse.json();
        }
      } catch (error) {
        // Continuar sin metadatos si falla
      }

      // Procesar y estructurar la información de membresía
      const processedMembership = {
        user_id: userId,
        user_info: userWithMeta ? {
          name: userWithMeta.name,
          email: userWithMeta.email,
          username: userWithMeta.username
        } : null,
        
        // Información de membresía activa
        active_memberships: [],
        expired_memberships: [],
        subscriptions: subscriptions,
        
        // Metadatos relevantes de MemberPress
        memberpress_metadata: userWithMeta?.meta ? Object.keys(userWithMeta.meta)
          .filter(key => key.includes('mepr') || key.includes('memberpress'))
          .reduce((acc, key) => {
            acc[key] = userWithMeta.meta[key];
            return acc;
          }, {}) : {},
          
        // Información de productos disponibles
        available_membership_products: membershipProducts,
        
        // Respuestas de endpoints consultados
        api_responses: membershipData
      };

      // Procesar fechas de vencimiento si están disponibles en metadatos
      if (userWithMeta?.meta) {
        const meta = userWithMeta.meta;
        
        // Buscar fechas de vencimiento en diferentes campos
        const expirationFields = [
          'mepr_expires_at',
          '_mepr_expires_at',
          'memberpress_expires',
          'membership_expires',
          'mepr_expiration'
        ];
        
        for (const field of expirationFields) {
          if (meta[field]) {
            processedMembership.expiration_date = meta[field];
            processedMembership.expiration_source = field;
            break;
          }
        }
        
        // Buscar IDs de membresías activas y mapear con productos
        if (meta['_mepr_active_memberships']) {
          const activeMembershipIds = Array.isArray(meta['_mepr_active_memberships']) 
            ? meta['_mepr_active_memberships'] 
            : [meta['_mepr_active_memberships']];
            
          processedMembership.active_memberships = activeMembershipIds.map(id => {
            const product = membershipProducts.find(p => p.id == id);
            return {
              membership_id: id,
              product_info: product || null
            };
          });
        }
      }

      res.json(processedMembership);

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para listar todas las membresías/productos disponibles en MemberPress
  app.get("/api/memberpress-products", async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      console.log('[MemberPress Products] Consultando productos disponibles...');

      // Endpoints para obtener productos de membresía
      const productEndpoints = [
        '/wp-json/mp/v1/memberships',
        '/wp-json/mp/v1/products',
        '/wp-json/memberpress/v1/memberships',
        '/wp-json/wp/v2/mp_membership',
        '/wp-json/wp/v2/posts?post_type=memberpressproduct'
      ];

      const allProducts = {};
      let consolidatedProducts = [];

      // Consultar todos los endpoints disponibles
      for (const endpoint of productEndpoints) {
        try {
          console.log(`[MemberPress Products] Consultando: ${baseUrl}${endpoint}`);
          
          const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`[MemberPress Products] Éxito en ${endpoint}:`, Array.isArray(data) ? `${data.length} items` : 'objeto');
            
            allProducts[endpoint] = {
              status: response.status,
              data: data,
              count: Array.isArray(data) ? data.length : 1
            };

            // Consolidar productos únicos
            if (Array.isArray(data)) {
              consolidatedProducts = [...consolidatedProducts, ...data];
            } else if (data && typeof data === 'object') {
              consolidatedProducts.push(data);
            }
          } else {
            console.log(`[MemberPress Products] Error ${response.status} en ${endpoint}`);
            allProducts[endpoint] = {
              status: response.status,
              error: await response.text()
            };
          }
        } catch (error: any) {
          console.log(`[MemberPress Products] Excepción en ${endpoint}:`, error.message);
          allProducts[endpoint] = {
            error: error.message
          };
        }
      }

      // También consultar transacciones para ver qué productos se han vendido
      let transactionProducts = [];
      try {
        console.log('[MemberPress Products] Consultando transacciones...');
        const transResponse = await fetch(`${baseUrl}/wp-json/mp/v1/transactions?per_page=50`, {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
        });

        if (transResponse.ok) {
          const transactions = await transResponse.json();
          console.log(`[MemberPress Products] Encontradas ${transactions.length} transacciones`);
          
          // Extraer IDs de productos únicos de las transacciones
          const productIds = [...new Set(transactions.map((t: any) => t.product_id || t.membership_id).filter(Boolean))];
          transactionProducts = productIds.map((id: any) => ({ 
            id, 
            source: 'transaction',
            found_in_transactions: transactions.filter((t: any) => (t.product_id || t.membership_id) == id).length 
          }));
        }
      } catch (error: any) {
        console.log('[MemberPress Products] Error consultando transacciones:', error.message);
      }

      // Deduplicar productos por ID
      const uniqueProducts = consolidatedProducts.reduce((acc: any[], product: any) => {
        const existingIndex = acc.findIndex(p => p.id === product.id);
        if (existingIndex === -1) {
          acc.push(product);
        } else {
          // Mergear información si el producto ya existe
          acc[existingIndex] = { ...acc[existingIndex], ...product };
        }
        return acc;
      }, []);

      console.log(`[MemberPress Products] Total productos únicos encontrados: ${uniqueProducts.length}`);

      const result = {
        summary: {
          total_unique_products: uniqueProducts.length,
          endpoints_queried: productEndpoints.length,
          successful_endpoints: Object.values(allProducts).filter((p: any) => p.status === 200).length,
          transaction_product_ids: transactionProducts.length
        },
        products: uniqueProducts,
        products_from_transactions: transactionProducts,
        raw_api_responses: allProducts,
        endpoints_attempted: productEndpoints
      };

      res.json(result);

    } catch (error: any) {
      console.error('[MemberPress Products] Error general:', error.message);
      res.status(500).json({ error: error.message, details: error.stack });
    }
  });

  // Endpoint para acceder directamente a la API de MemberPress para membresías específicas de usuario
  app.get("/api/memberpress-direct/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      console.log(`[MemberPress Direct] Consultando membresías directas para usuario ${userId}`);

      // Endpoints específicos de MemberPress para membresías de usuario
      const membershipEndpoints = [
        `/wp-json/mp/v1/members/${userId}`,
        `/wp-json/mp/v1/subscriptions?member=${userId}`,
        `/wp-json/mp/v1/transactions?member=${userId}`,
        `/wp-json/mp/v1/members/${userId}/subscriptions`,
        `/wp-json/mp/v1/members/${userId}/transactions`,
      ];

      const results = {};
      
      // Consultar cada endpoint específico de MemberPress
      for (const endpoint of membershipEndpoints) {
        try {
          console.log(`[MemberPress Direct] Consultando: ${baseUrl}${endpoint}`);
          
          const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`[MemberPress Direct] Éxito en ${endpoint}:`, Array.isArray(data) ? `${data.length} items` : 'objeto');
            
            results[endpoint] = {
              status: response.status,
              data: data,
              count: Array.isArray(data) ? data.length : 1
            };
          } else {
            const errorText = await response.text();
            console.log(`[MemberPress Direct] Error ${response.status} en ${endpoint}:`, errorText);
            results[endpoint] = {
              status: response.status,
              error: errorText
            };
          }
        } catch (error: any) {
          console.log(`[MemberPress Direct] Excepción en ${endpoint}:`, error.message);
          results[endpoint] = {
            error: error.message
          };
        }
      }

      // También intentar obtener información de membresía a través de metadatos del usuario
      let userMetadata = null;
      try {
        console.log(`[MemberPress Direct] Obteniendo metadatos del usuario ${userId}`);
        const userResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users/${userId}?context=edit`, {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          userMetadata = {
            basic_info: {
              id: userData.id,
              name: userData.name,
              email: userData.email,
              username: userData.username
            },
            memberpress_meta: Object.keys(userData.meta || {})
              .filter(key => key.includes('mepr') || key.includes('memberpress'))
              .reduce((acc: any, key) => {
                acc[key] = userData.meta[key];
                return acc;
              }, {}),
            all_meta: userData.meta
          };
        }
      } catch (error: any) {
        console.log('[MemberPress Direct] Error obteniendo metadatos del usuario:', error.message);
      }

      // Consolidar información de membresía encontrada
      const consolidatedInfo = {
        user_id: userId,
        user_metadata: userMetadata,
        
        // Información de membresía directa de MemberPress
        member_info: results[`/wp-json/mp/v1/members/${userId}`]?.data || null,
        subscriptions: results[`/wp-json/mp/v1/subscriptions?member=${userId}`]?.data || [],
        transactions: results[`/wp-json/mp/v1/transactions?member=${userId}`]?.data || [],
        
        // Respuestas completas de todos los endpoints
        raw_responses: results,
        
        // Análisis de datos encontrados
        analysis: {
          has_member_record: !!results[`/wp-json/mp/v1/members/${userId}`]?.data,
          subscription_count: Array.isArray(results[`/wp-json/mp/v1/subscriptions?member=${userId}`]?.data) 
            ? results[`/wp-json/mp/v1/subscriptions?member=${userId}`].data.length : 0,
          transaction_count: Array.isArray(results[`/wp-json/mp/v1/transactions?member=${userId}`]?.data) 
            ? results[`/wp-json/mp/v1/transactions?member=${userId}`].data.length : 0,
          endpoints_successful: Object.values(results).filter((r: any) => r.status === 200).length,
          endpoints_failed: Object.values(results).filter((r: any) => r.status !== 200).length
        }
      };

      // Extraer fechas de vencimiento de múltiples fuentes
      if (consolidatedInfo.member_info) {
        const memberData = consolidatedInfo.member_info;
        if (memberData.expires_at) {
          consolidatedInfo.analysis.expiration_date = memberData.expires_at;
          consolidatedInfo.analysis.expiration_source = 'member_record';
        }
      }

      // Extraer fechas de vencimiento de suscripciones
      if (consolidatedInfo.subscriptions && consolidatedInfo.subscriptions.length > 0) {
        consolidatedInfo.subscriptions.forEach((subscription: any, index: number) => {
          if (subscription.expires_at) {
            consolidatedInfo.analysis[`subscription_${index}_expires`] = subscription.expires_at;
          }
          if (subscription.next_billing_at) {
            consolidatedInfo.analysis[`subscription_${index}_next_billing`] = subscription.next_billing_at;
          }
          if (subscription.status) {
            consolidatedInfo.analysis[`subscription_${index}_status`] = subscription.status;
          }
        });
      }

      // Analizar transacciones para extraer información de productos y fechas
      if (consolidatedInfo.transactions && consolidatedInfo.transactions.length > 0) {
        consolidatedInfo.analysis.transaction_analysis = consolidatedInfo.transactions.map((transaction: any) => {
          return {
            id: transaction.id,
            status: transaction.status,
            amount: transaction.amount,
            created_at: transaction.created_at,
            expires_at: transaction.expires_at,
            product_id: transaction.product_id,
            membership_id: transaction.membership_id,
            // Extraer información del producto si está disponible
            product_title: transaction.product?.post_title || transaction.title || null,
            product_name: transaction.product?.post_name || transaction.name || null,
            product_content: transaction.product?.post_content || null,
            // Información de fechas importantes
            gateway: transaction.gateway,
            subscription_id: transaction.subscription_id
          };
        });

        // Encontrar la transacción más reciente exitosa para fecha de vencimiento
        const successfulTransactions = consolidatedInfo.transactions
          .filter((t: any) => t.status === 'complete' || t.status === 'confirmed')
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (successfulTransactions.length > 0) {
          const latestTransaction = successfulTransactions[0];
          if (latestTransaction.expires_at) {
            consolidatedInfo.analysis.latest_transaction_expires = latestTransaction.expires_at;
            consolidatedInfo.analysis.latest_transaction_id = latestTransaction.id;
            consolidatedInfo.analysis.latest_transaction_amount = latestTransaction.amount;
            consolidatedInfo.analysis.latest_transaction_created = latestTransaction.created_at;
          }
        }

        // Buscar todas las transacciones con fechas de vencimiento válidas
        const transactionsWithExpiration = consolidatedInfo.transactions
          .filter((t: any) => t.expires_at && (t.status === 'complete' || t.status === 'confirmed'))
          .sort((a: any, b: any) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime());

        if (transactionsWithExpiration.length > 0) {
          consolidatedInfo.analysis.active_transaction_expires = transactionsWithExpiration[0].expires_at;
          consolidatedInfo.analysis.active_transaction_id = transactionsWithExpiration[0].id;
        }
      }

      // Buscar fechas de vencimiento en metadatos del usuario
      if (userMetadata?.memberpress_meta) {
        const meta = userMetadata.memberpress_meta;
        const expirationFields = ['mepr_expires_at', '_mepr_expires_at', 'memberpress_expires', 'mepr_expiration', '_mepr_expiration'];
        
        for (const field of expirationFields) {
          if (meta[field]) {
            consolidatedInfo.analysis.meta_expiration_date = meta[field];
            consolidatedInfo.analysis.meta_expiration_source = field;
            break;
          }
        }
      }

      // Buscar fechas en metadatos generales que podrían contener información de vencimiento
      if (userMetadata?.all_meta) {
        const allMeta = userMetadata.all_meta;
        const additionalExpirationFields = [
          'membership_expires', 'membership_expiry', 'member_expires', 
          'expires', 'expiry_date', 'expiration_date'
        ];
        
        for (const field of additionalExpirationFields) {
          if (allMeta[field]) {
            consolidatedInfo.analysis[`meta_${field}`] = allMeta[field];
          }
        }
      }

      console.log(`[MemberPress Direct] Análisis completo para usuario ${userId}:`, consolidatedInfo.analysis);

      res.json(consolidatedInfo);

    } catch (error: any) {
      console.error('[MemberPress Direct] Error general:', error.message);
      res.status(500).json({ error: error.message, details: error.stack });
    }
  });

  // Endpoint específico para buscar membresías por términos específicos
  app.get("/api/memberpress-search-memberships", async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      console.log(`[MemberPress Search] Buscando membresías específicas...`);

      // Búsquedas específicas para encontrar las membresías que necesitamos
      const searchQueries = [
        { term: "profesional", endpoint: "/wp-json/wp/v2/posts?search=profesional&per_page=100" },
        { term: "empresarial", endpoint: "/wp-json/wp/v2/posts?search=empresarial&per_page=100" },
        { term: "institucional", endpoint: "/wp-json/wp/v2/posts?search=institucional&per_page=100" },
        { term: "membresía", endpoint: "/wp-json/wp/v2/posts?search=membresía&per_page=100" },
        { term: "membership", endpoint: "/wp-json/wp/v2/posts?search=membership&per_page=100" },
      ];

      // También buscar en tipos de post específicos
      const postTypeEndpoints = [
        "/wp-json/wp/v2/posts?post_type=memberpressproduct&per_page=100",
        "/wp-json/wp/v2/posts?post_type=product&per_page=100", 
        "/wp-json/wp/v2/posts?per_page=100",
        "/wp-json/mp/v1/memberships",
      ];

      const searchResults = {};
      const foundMemberships = [];

      // Buscar por términos específicos
      for (const query of searchQueries) {
        try {
          console.log(`[MemberPress Search] Buscando "${query.term}": ${baseUrl}${query.endpoint}`);
          
          const response = await fetch(`${baseUrl}${query.endpoint}`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`[MemberPress Search] "${query.term}" encontró ${Array.isArray(data) ? data.length : 1} resultados`);
            
            searchResults[query.term] = {
              endpoint: query.endpoint,
              status: response.status,
              results: Array.isArray(data) ? data : [data],
              count: Array.isArray(data) ? data.length : 1
            };

            // Analizar resultados para membresías específicas
            const results = Array.isArray(data) ? data : [data];
            for (const item of results) {
              const title = item.title?.rendered || item.title || item.name || '';
              const content = item.content?.rendered || item.content || '';
              const excerpt = item.excerpt?.rendered || item.excerpt || '';
              
              // Buscar en título y contenido
              const searchText = `${title} ${content} ${excerpt}`.toLowerCase();
              
              if (searchText.includes('profesional') || 
                  searchText.includes('empresarial') || 
                  searchText.includes('institucional')) {
                
                foundMemberships.push({
                  id: item.id,
                  title: title,
                  content: content.substring(0, 200),
                  type: item.type || 'post',
                  status: item.status,
                  date: item.date,
                  price: item.meta?._price || item.price,
                  membership_type: searchText.includes('profesional') ? 'Profesional' :
                                   searchText.includes('empresarial') ? 'Empresarial' :
                                   searchText.includes('institucional') ? 'Institucional' : 'Otra',
                  found_in_search: query.term,
                  link: item.link
                });
              }
            }
          } else {
            console.log(`[MemberPress Search] Error ${response.status} en "${query.term}"`);
            searchResults[query.term] = {
              endpoint: query.endpoint,
              status: response.status,
              error: await response.text()
            };
          }
        } catch (error: any) {
          console.log(`[MemberPress Search] Excepción en "${query.term}":`, error.message);
          searchResults[query.term] = {
            endpoint: query.endpoint,
            error: error.message
          };
        }
      }

      // Buscar en endpoints de tipos de post específicos
      for (const endpoint of postTypeEndpoints) {
        try {
          console.log(`[MemberPress Search] Consultando tipo de post: ${baseUrl}${endpoint}`);
          
          const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`[MemberPress Search] Tipo de post encontró ${Array.isArray(data) ? data.length : 1} resultados`);
            
            const key = endpoint.split('/').pop() || 'unknown';
            searchResults[key] = {
              endpoint: endpoint,
              status: response.status,
              results: Array.isArray(data) ? data : [data],
              count: Array.isArray(data) ? data.length : 1
            };

            // Analizar estos resultados también
            const results = Array.isArray(data) ? data : [data];
            for (const item of results) {
              const title = item.title?.rendered || item.title || item.name || '';
              const content = item.content?.rendered || item.content || '';
              
              const searchText = `${title} ${content}`.toLowerCase();
              
              if ((searchText.includes('profesional') || 
                   searchText.includes('empresarial') || 
                   searchText.includes('institucional')) &&
                  !foundMemberships.find(m => m.id === item.id)) {
                
                foundMemberships.push({
                  id: item.id,
                  title: title,
                  content: content.substring(0, 200),
                  type: item.type || 'membership',
                  status: item.status,
                  date: item.date,
                  price: item.meta?._price || item.price,
                  membership_type: searchText.includes('profesional') ? 'Profesional' :
                                   searchText.includes('empresarial') ? 'Empresarial' :
                                   searchText.includes('institucional') ? 'Institucional' : 'Otra',
                  found_in_endpoint: endpoint,
                  link: item.link
                });
              }
            }
          }
        } catch (error: any) {
          console.log(`[MemberPress Search] Error en endpoint ${endpoint}:`, error.message);
        }
      }

      // Crear resumen de resultados
      const summary = {
        total_searches: searchQueries.length + postTypeEndpoints.length,
        successful_searches: Object.values(searchResults).filter((r: any) => r.status === 200).length,
        specific_memberships_found: foundMemberships.length,
        profesional_found: foundMemberships.filter(m => m.membership_type === 'Profesional').length,
        empresarial_found: foundMemberships.filter(m => m.membership_type === 'Empresarial').length,
        institucional_found: foundMemberships.filter(m => m.membership_type === 'Institucional').length
      };

      console.log(`[MemberPress Search] Resumen: ${JSON.stringify(summary)}`);

      res.json({
        summary,
        found_memberships: foundMemberships,
        search_results: searchResults,
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('[MemberPress Search] Error general:', error.message);
      res.status(500).json({ error: error.message, details: error.stack });
    }
  });

  // Endpoint para obtener perfil de PeepSo de un usuario de WordPress
  app.get("/api/peepso-profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      console.log(`[PeepSo Profile] Obteniendo perfil de PeepSo para usuario ${userId}`);

      // Obtener información básica del usuario
      const userResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users/${userId}?context=edit`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        return res.status(404).json({ error: `Usuario no encontrado: ${userResponse.status}` });
      }

      const userData = await userResponse.json();
      console.log(`[PeepSo Profile] Usuario básico obtenido: ${userData.username}`);

      // Intentar obtener datos de PeepSo a través de diferentes endpoints posibles
      const peepsoEndpoints = [
        // Endpoint directo de PeepSo (si existe)
        `${baseUrl}/wp-json/peepso/v1/users/${userId}`,
        `${baseUrl}/wp-json/peepso/v1/profile/${userId}`,
        // Endpoints alternativos
        `${baseUrl}/wp-json/peepso-api/v1/users/${userId}`,
        `${baseUrl}/wp-json/peepso-api/v1/profile/${userId}`,
      ];

      let peepsoData = null;
      let successfulEndpoint = null;

      for (const endpoint of peepsoEndpoints) {
        try {
          console.log(`[PeepSo Profile] Intentando endpoint: ${endpoint}`);
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            peepsoData = data;
            successfulEndpoint = endpoint;
            console.log(`[PeepSo Profile] Datos obtenidos exitosamente de: ${endpoint}`);
            break;
          }
        } catch (error) {
          console.log(`[PeepSo Profile] Error en endpoint ${endpoint}:`, error.message);
        }
      }

      // Si no se pudieron obtener datos de PeepSo, buscar en los metadatos del usuario
      const userMeta = userData.meta || {};
      const peepsoFields = Object.keys(userMeta).filter(key => 
        key.includes('peepso') || key.includes('ps_') || key.startsWith('_peepso')
      );

      // Campos comunes de perfil social que PeepSo podría usar
      const socialFields = Object.keys(userMeta).filter(key => 
        key.includes('facebook') || key.includes('twitter') || key.includes('instagram') || 
        key.includes('linkedin') || key.includes('social') || key.includes('profile')
      );

      const peepsoProfile = {
        user_id: userData.id,
        username: userData.username,
        display_name: userData.name,
        email: userData.email,
        avatar_url: userData.avatar_urls ? userData.avatar_urls['96'] || userData.avatar_urls['48'] : null,
        profile_url: `${baseUrl}/profile/${userData.username}`, // URL típica de perfil en PeepSo
        peepso_api_data: peepsoData,
        successful_endpoint: successfulEndpoint,
        // Metadatos de PeepSo encontrados
        peepso_metadata: peepsoFields.reduce((acc, field) => {
          acc[field] = userMeta[field];
          return acc;
        }, {} as any),
        // Campos sociales generales
        social_metadata: socialFields.reduce((acc, field) => {
          acc[field] = userMeta[field];
          return acc;
        }, {} as any),
        // Información adicional que podría ser útil
        bio: userMeta['description'] || userMeta['bio'] || userMeta['user_description'] || null,
        website: userData.link || userMeta['website'] || null,
        location: userMeta['location'] || userMeta['user_location'] || null,
        // URLs de redes sociales extraídos de metadatos
        social_links: {
          facebook: userMeta['facebook'] || userMeta['_facebook'] || userMeta['peepso_facebook'] || null,
          twitter: userMeta['twitter'] || userMeta['_twitter'] || userMeta['peepso_twitter'] || null,
          instagram: userMeta['instagram'] || userMeta['_instagram'] || userMeta['peepso_instagram'] || null,
          linkedin: userMeta['linkedin'] || userMeta['_linkedin'] || userMeta['peepso_linkedin'] || null,
        }
      };

      res.json({
        success: true,
        profile: peepsoProfile,
        debug_info: {
          peepso_fields_found: peepsoFields.length,
          social_fields_found: socialFields.length,
          api_data_available: !!peepsoData,
          successful_api_endpoint: successfulEndpoint
        }
      });

    } catch (error: any) {
      console.error(`[PeepSo Profile] Error general:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para obtener el perfil de PeepSo del representante asociado a una empresa
  app.get("/api/companies/:companyId/representative-peepso-profile", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      console.log(`[Company PeepSo Profile] Obteniendo perfil del representante para empresa ${companyId}`);

      // Obtener la empresa con detalles del representante
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }

      if (!company.user || !company.userId) {
        console.log(`[Company PeepSo Profile] La empresa ${companyId} no tiene representante asociado`);
        return res.json({
          success: true,
          profile: null,
          message: "La empresa no tiene un representante asociado"
        });
      }

      console.log(`[Company PeepSo Profile] Representante encontrado: ${company.user.email} (ID: ${company.user.id})`);

      // Verificar si el representante es de WordPress (tiene firebaseUid que empieza con 'wp_')
      if (!company.user.firebaseUid?.startsWith('wp_')) {
        console.log(`[Company PeepSo Profile] El representante no es de WordPress: ${company.user.firebaseUid}`);
        return res.json({
          success: true,
          profile: null,
          message: "El representante no está asociado con WordPress/MemberPress"
        });
      }

      // Extraer el ID de WordPress del firebaseUid (formato: wp_{wordpressId}_{timestamp})
      const wordpressIdMatch = company.user.firebaseUid.match(/^wp_(\d+)_/);
      if (!wordpressIdMatch) {
        console.log(`[Company PeepSo Profile] No se pudo extraer ID de WordPress de: ${company.user.firebaseUid}`);
        return res.json({
          success: true,
          profile: null,
          message: "No se pudo determinar el ID de WordPress del representante"
        });
      }

      const wordpressUserId = wordpressIdMatch[1];
      console.log(`[Company PeepSo Profile] ID de WordPress extraído: ${wordpressUserId}`);

      // Intentar obtener el perfil de PeepSo usando nuestro endpoint interno
      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.status(400).json({ error: "Configuración de WordPress incompleta" });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      // Obtener información básica del usuario de WordPress
      const userResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users/${wordpressUserId}?context=edit`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userResponse.ok) {
        console.log(`[Company PeepSo Profile] Usuario de WordPress no encontrado: ${wordpressUserId}`);
        return res.json({
          success: true,
          profile: null,
          message: "Usuario no encontrado en WordPress"
        });
      }

      const userData = await userResponse.json();
      console.log(`[Company PeepSo Profile] Usuario de WordPress obtenido: ${userData.username}`);

      // Intentar obtener datos de PeepSo
      const peepsoEndpoints = [
        `${baseUrl}/wp-json/peepso/v1/users/${wordpressUserId}`,
        `${baseUrl}/wp-json/peepso/v1/profile/${wordpressUserId}`,
        `${baseUrl}/wp-json/peepso-api/v1/users/${wordpressUserId}`,
        `${baseUrl}/wp-json/peepso-api/v1/profile/${wordpressUserId}`,
      ];

      let peepsoData = null;
      let successfulEndpoint = null;

      for (const endpoint of peepsoEndpoints) {
        try {
          console.log(`[Company PeepSo Profile] Intentando endpoint: ${endpoint}`);
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            peepsoData = data;
            successfulEndpoint = endpoint;
            console.log(`[Company PeepSo Profile] Datos de PeepSo obtenidos de: ${endpoint}`);
            break;
          }
        } catch (error) {
          console.log(`[Company PeepSo Profile] Error en endpoint ${endpoint}:`, error.message);
        }
      }

      // Procesar metadatos del usuario para campos sociales
      const userMeta = userData.meta || {};
      const peepsoFields = Object.keys(userMeta).filter(key => 
        key.includes('peepso') || key.includes('ps_') || key.startsWith('_peepso')
      );

      const socialFields = Object.keys(userMeta).filter(key => 
        key.includes('facebook') || key.includes('twitter') || key.includes('instagram') || 
        key.includes('linkedin') || key.includes('social') || key.includes('profile')
      );

      const representativeProfile = {
        // Información básica del representante del sistema local
        company_id: companyId,
        company_name: company.nombreEmpresa,
        representative: {
          local_id: company.user.id,
          local_email: company.user.email,
          local_display_name: company.user.displayName,
          local_role: company.user.role,
        },
        // Información de WordPress/PeepSo
        wordpress_profile: {
          user_id: userData.id,
          username: userData.username,
          display_name: userData.name,
          email: userData.email,
          avatar_url: userData.avatar_urls ? userData.avatar_urls['96'] || userData.avatar_urls['48'] : null,
          profile_url: `${baseUrl}/profile/${userData.username}`,
          website: userData.link || userMeta['website'] || null,
          bio: userMeta['description'] || userMeta['bio'] || userMeta['user_description'] || null,
          location: userMeta['location'] || userMeta['user_location'] || null,
        },
        // Datos específicos de PeepSo (si están disponibles)
        peepso_data: peepsoData,
        // Enlaces de redes sociales extraídos de metadatos
        social_links: {
          facebook: userMeta['facebook'] || userMeta['_facebook'] || userMeta['peepso_facebook'] || null,
          twitter: userMeta['twitter'] || userMeta['_twitter'] || userMeta['peepso_twitter'] || null,
          instagram: userMeta['instagram'] || userMeta['_instagram'] || userMeta['peepso_instagram'] || null,
          linkedin: userMeta['linkedin'] || userMeta['_linkedin'] || userMeta['peepso_linkedin'] || null,
        },
        // Metadatos de PeepSo encontrados
        peepso_metadata: peepsoFields.reduce((acc, field) => {
          acc[field] = userMeta[field];
          return acc;
        }, {} as any),
        // Campos sociales adicionales
        social_metadata: socialFields.reduce((acc, field) => {
          acc[field] = userMeta[field];
          return acc;
        }, {} as any),
      };

      // Filtrar enlaces sociales vacíos
      const filteredSocialLinks = Object.fromEntries(
        Object.entries(representativeProfile.social_links).filter(([key, value]) => value)
      );

      res.json({
        success: true,
        profile: {
          ...representativeProfile,
          social_links: filteredSocialLinks
        },
        debug_info: {
          wordpress_user_id: wordpressUserId,
          peepso_fields_found: peepsoFields.length,
          social_fields_found: socialFields.length,
          peepso_api_available: !!peepsoData,
          successful_endpoint: successfulEndpoint,
          social_links_found: Object.keys(filteredSocialLinks).length
        }
      });

    } catch (error: any) {
      console.error(`[Company PeepSo Profile] Error general:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para verificar URLs de PeepSo por emails
  app.post("/api/emails/peepso-profiles", async (req, res) => {
    try {
      const { emails } = req.body;
      
      if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ error: "Se requiere una lista de emails" });
      }

      console.log(`[Email PeepSo Profiles] Verificando URLs de PeepSo para emails:`, emails);

      const settings = await storage.getIntegrationSettings();
      
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return res.json({
          success: true,
          profiles: {},
          message: "Configuración de WordPress incompleta"
        });
      }

      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      const baseUrl = settings.wordpressUrl.replace(/\/$/, '');

      const emailProfiles = {};

      // Verificar cada email
      for (const email of emails) {
        if (!email || email.trim() === '') continue;

        try {
          console.log(`[Email PeepSo Profiles] Buscando usuario de WordPress con email: ${email}`);

          // Buscar usuario por email en WordPress
          const userSearchResponse = await fetch(`${baseUrl}/wp-json/wp/v2/users?search=${encodeURIComponent(email)}&context=edit`, {
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
            },
          });

          if (!userSearchResponse.ok) {
            console.log(`[Email PeepSo Profiles] No se pudo buscar usuario para email: ${email}`);
            continue;
          }

          const users = await userSearchResponse.json();
          const matchingUser = users.find((user: any) => user.email === email);

          if (!matchingUser) {
            console.log(`[Email PeepSo Profiles] No se encontró usuario de WordPress con email: ${email}`);
            continue;
          }

          console.log(`[Email PeepSo Profiles] Usuario encontrado: ${matchingUser.username} (ID: ${matchingUser.id})`);

          // Construir la URL del perfil de PeepSo usando el username
          // PeepSo usa el formato: /profile-2/?username
          const peepsoProfileUrl = `${baseUrl}/profile-2/?${matchingUser.slug || matchingUser.username}`;
          
          console.log(`[Email PeepSo Profiles] URL de perfil PeepSo para ${email}: ${peepsoProfileUrl}`);
          
          emailProfiles[email] = {
            wordpress_user_id: matchingUser.id,
            username: matchingUser.username,
            display_name: matchingUser.name,
            avatar_url: matchingUser.avatar_urls ? matchingUser.avatar_urls['96'] || matchingUser.avatar_urls['48'] : null,
            profile_url: peepsoProfileUrl,
            has_peepso_profile: true
          };

        } catch (error) {
          console.log(`[Email PeepSo Profiles] Error al procesar email ${email}:`, error.message);
        }
      }

      res.json({
        success: true,
        profiles: emailProfiles,
        debug_info: {
          emails_checked: emails.length,
          profiles_found: Object.keys(emailProfiles).length,
          profiles_with_urls: Object.values(emailProfiles).filter((profile: any) => profile.has_peepso_profile).length
        }
      });

    } catch (error: any) {
      console.error(`[Email PeepSo Profiles] Error general:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint para geocodificación usando OpenStreetMap Nominatim API (gratuito, sin API key)
  app.post("/api/geocode", async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address || typeof address !== 'string' || address.trim().length < 5) {
        return res.status(400).json({ error: 'Dirección inválida' });
      }

      // Usar OpenStreetMap Nominatim API (alternativa gratuita)
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(address.trim())}`;
      
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'ANPR-Directory-App/1.0 (contact@anpr.org.mx)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error en Nominatim API: ${response.status}`);
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        
        // Transformar respuesta de Nominatim a formato compatible con Google Maps API
        const transformedResult = {
          formatted_address: result.display_name,
          geometry: {
            location: {
              lat: parseFloat(result.lat),
              lng: parseFloat(result.lon)
            }
          },
          address_components: [] as any[]
        };

        // Agregar componentes de dirección si están disponibles
        if (result.address) {
          const addr = result.address;
          if (addr.country) {
            transformedResult.address_components.push({
              long_name: addr.country,
              short_name: addr.country_code?.toUpperCase() || addr.country,
              types: ['country', 'political']
            });
          }
          if (addr.state) {
            transformedResult.address_components.push({
              long_name: addr.state,
              short_name: addr.state,
              types: ['administrative_area_level_1', 'political']
            });
          }
          if (addr.city || addr.town || addr.municipality) {
            const cityName = addr.city || addr.town || addr.municipality;
            transformedResult.address_components.push({
              long_name: cityName,
              short_name: cityName,
              types: ['locality', 'political']
            });
          }
        }

        res.json({
          results: [transformedResult],
          status: 'OK'
        });
      } else {
        res.json({
          results: [],
          status: 'ZERO_RESULTS',
          error_message: `No se encontraron resultados para: ${address}`
        });
      }

    } catch (error: any) {
      console.error('Error en geocodificación:', error);
      res.status(500).json({ 
        status: 'ERROR',
        error_message: error.message || 'Error interno del servidor' 
      });
    }
  });

  // Endpoint para PROGRAMAR un cambio de plan de membresía.
  // El plan actual (nombre, beneficios, límites y fechas) permanece intacto
  // hasta la próxima facturación. Solo se guarda UN cambio pendiente: cada nueva
  // solicitud sobrescribe la anterior (el último elegido gana). El cambio se
  // aplica realmente en la renovación tras confirmarse el pago (ver webhook).
  app.post("/api/companies/:id/change-plan", async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { targetPlanId, periodicidad } = req.body;

      if (!companyId || !targetPlanId || !periodicidad) {
        return res.status(400).json({ error: "Faltan parámetros requeridos" });
      }

      if (!["mensual", "anual"].includes(periodicidad)) {
        return res.status(400).json({ error: "Periodicidad debe ser 'mensual' o 'anual'" });
      }

      // Obtener la empresa
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }

      // Autorización: solo admin o el dueño/representante REAL de la empresa,
      // confirmado contra la base de datos (no se confía en claims del cliente).
      if (!(await verifyCompanyAccess(req, res, company))) {
        return;
      }

      const currentPlan = company.membershipTypeId
        ? await storage.getMembershipType(company.membershipTypeId)
        : null;
      const currentPlanName = String(currentPlan?.nombrePlan ?? "").toLowerCase();
      const isEnterpriseMember = ["empresarial", "enterprise", "premium"].some((term) =>
        currentPlanName.includes(term),
      );
      if (isEnterpriseMember) {
        return res.status(403).json({
          error: "Los miembros empresariales no pueden cambiar de plan.",
          code: "ENTERPRISE_PLAN_CHANGE_FORBIDDEN",
        });
      }

      // Obtener el usuario (propietario de la empresa)
      const user = await storage.getUser(company.userId!);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      // Obtener el plan objetivo
      const targetPlan = await storage.getMembershipType(targetPlanId);
      if (!targetPlan) {
        return res.status(404).json({ error: "Plan objetivo no encontrado" });
      }

      // Rechazar elegir el mismo plan + periodicidad que el plan ACTIVO
      if (
        company.membershipTypeId === targetPlanId &&
        (company.membershipPeriodicidad || "").toLowerCase() === periodicidad.toLowerCase()
      ) {
        return res.status(400).json({
          error: "Ya tienes ese plan y periodicidad activos actualmente.",
        });
      }

      // Obtener el precio según la periodicidad
      const opcionesPrecios = Array.isArray(targetPlan.opcionesPrecios)
        ? targetPlan.opcionesPrecios
        : [];

      const precioOption = opcionesPrecios.find((op: any) =>
        op.periodicidad?.toLowerCase() === periodicidad.toLowerCase()
      );

      if (!precioOption) {
        return res.status(400).json({
          error: `No se encontró precio para periodicidad ${periodicidad}`,
        });
      }

      // La fecha efectiva del cambio es el fin del período actual (vencimiento).
      const effectiveDate = company.fechaFinMembresia || null;

      // Atomicidad con Stripe: si hay una suscripción activa, programar el cambio
      // para el próximo período. Si ya existía un schedule pendiente, se ACTUALIZA
      // en sitio (sin release+create) para no dejar el schedule vigente huérfano si
      // algo falla. Si Stripe falla, NO persistimos el cambio local (se responde 502).
      let newScheduleId: string | null = company.pendingStripeScheduleId || null;
      if (user.stripeSubscriptionId) {
        try {
          const stripe = await getStripe();
          const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

          if (subscription.status === "active") {
            // Periodos actuales (compatibles con basil: viven en items[0]).
            const subPeriodStart = getSubscriptionPeriodStart(subscription);
            const subPeriodEnd = getSubscriptionPeriodEnd(subscription);
            // La fase que continúa el plan ACTUAL hasta el final del período.
            const currentPhaseItems = subscription.items.data.map(item => ({
              price: item.price.id,
              quantity: item.quantity,
            }));
            // La nueva fase con el plan objetivo, a partir del próximo período.
            const newPhase = {
              start_date: subPeriodEnd as number,
              items: [
                {
                  price_data: {
                    // Usar la moneda de la suscripción existente para evitar
                    // errores de "monedas mezcladas" en un mismo schedule.
                    currency: subscription.currency || (await getConfiguredCurrency()),
                    product_data: {
                      name: `${targetPlan.nombrePlan} - ${periodicidad}`,
                    },
                    unit_amount: Math.round(precioOption.costo * 100),
                    recurring: {
                      interval: periodicidad === "anual" ? "year" : "month",
                    },
                  },
                  quantity: 1,
                },
              ],
            };

            if (company.pendingStripeScheduleId) {
              // Reemplazo ATÓMICO: actualizar el schedule existente en lugar de
              // release + create. Así, si algo falla, el schedule vigente sigue
              // intacto (no queda un pendiente local sin schedule en Stripe).
              const existing = await stripe.subscriptionSchedules.retrieve(
                company.pendingStripeScheduleId
              );
              const currentPhaseStart =
                existing.phases?.[0]?.start_date ?? subPeriodStart;
              const updatedSchedule = await stripe.subscriptionSchedules.update(
                company.pendingStripeScheduleId,
                {
                  phases: [
                    {
                      start_date: currentPhaseStart as number,
                      end_date: subPeriodEnd as number,
                      items: currentPhaseItems,
                    },
                    newPhase,
                  ],
                }
              );
              newScheduleId = updatedSchedule.id;
              console.log("Subscription Schedule actualizado (reemplazo atómico):", newScheduleId);
            } else {
              // No hay schedule previo: crear uno nuevo desde la suscripción.
              const subscriptionSchedule = await stripe.subscriptionSchedules.create({
                from_subscription: user.stripeSubscriptionId,
                phases: [
                  {
                    start_date: subPeriodStart as number,
                    end_date: subPeriodEnd as number,
                    items: currentPhaseItems,
                  },
                  newPhase,
                ],
              });
              newScheduleId = subscriptionSchedule.id;
              console.log("Subscription Schedule creado:", newScheduleId);
            }
          } else {
            // La suscripción existe pero NO está activa (trialing, past_due,
            // unpaid, canceled, etc.). No se puede programar el cambio en Stripe,
            // así que NO persistimos un pendiente que jamás se aplicaría (el webhook
            // exige schedule y la tarea diaria omite empresas con Stripe). Se rechaza
            // explícitamente para evitar cambios "atorados" indefinidamente.
            console.warn(
              `Cambio de plan rechazado para empresa ${companyId}: suscripción Stripe en estado "${subscription.status}" (no activa).`
            );
            return res.status(409).json({
              error:
                "Tu suscripción no está activa en este momento (puede haber un pago pendiente o en revisión). Regulariza tu suscripción antes de programar un cambio de plan.",
            });
          }
        } catch (stripeError: any) {
          console.error("Error programando cambio en Stripe:", stripeError);
          return res.status(502).json({
            error: "No se pudo programar el cambio con el procesador de pagos. Intenta de nuevo.",
          });
        }
      }

      // Persistir el ÚNICO cambio pendiente (sobrescribe el anterior). El plan
      // actual NO se toca; solo se guardan los campos del cambio programado.
      const updatedCompany = await storage.updateCompany(companyId, {
        pendingMembershipTypeId: targetPlanId,
        pendingMembershipPeriodicidad: periodicidad as "mensual" | "anual",
        pendingMembershipPrice: String(precioOption.costo),
        pendingChangeEffectiveDate: effectiveDate,
        pendingStripeScheduleId: newScheduleId,
        // Estado explícito: cambio en espera de la próxima facturación; pago aún
        // no confirmado. El plan ACTIVO no se toca hasta el webhook de pago exitoso.
        pendingChangeStatus: "pendiente",
        pendingPaymentStatus: "pendiente",
      });

      console.log(
        `Cambio de plan PROGRAMADO para empresa ${companyId}: ${company.membershipTypeId} -> ${targetPlanId} (${periodicidad}), efectivo ${effectiveDate}`
      );

      res.json({
        success: true,
        pendingPlanName: targetPlan.nombrePlan,
        periodicidad,
        price: precioOption.costo,
        effectiveDate,
        company: updatedCompany,
      });
    } catch (error: any) {
      console.error("Error programando cambio de plan:", error);
      res.status(500).json({ error: error.message || "Error interno del servidor" });
    }
  });

  // Cancelar el cambio de plan PROGRAMADO: borra los campos del próximo plan y
  // libera el schedule de Stripe para que la suscripción siga renovando el plan
  // actual. Misma autorización y atomicidad que programar.
  app.post("/api/companies/:id/cancel-scheduled-change", async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }

      // Autorización: solo admin o el dueño/representante REAL de la empresa,
      // confirmado contra la base de datos (no se confía en claims del cliente).
      if (!(await verifyCompanyAccess(req, res, company))) {
        return;
      }

      if (!company.pendingMembershipTypeId) {
        return res.status(400).json({ error: "No hay ningún cambio de plan programado." });
      }

      // Liberar el schedule de Stripe (si existe). Si Stripe falla, no persistir.
      if (company.pendingStripeScheduleId) {
        try {
          const stripe = await getStripe();
          await stripe.subscriptionSchedules.release(company.pendingStripeScheduleId);
        } catch (stripeError: any) {
          console.error("Error liberando schedule en Stripe:", stripeError);
          return res.status(502).json({
            error: "No se pudo cancelar el cambio con el procesador de pagos. Intenta de nuevo.",
          });
        }
      }

      const updatedCompany = await storage.updateCompany(companyId, {
        pendingMembershipTypeId: null,
        pendingMembershipPeriodicidad: null,
        pendingMembershipPrice: null,
        pendingChangeEffectiveDate: null,
        pendingStripeScheduleId: null,
        pendingChangeStatus: null,
        pendingPaymentStatus: null,
      });

      res.json({
        success: true,
        message: "Cambio de plan cancelado. Seguirás con tu plan actual.",
        company: updatedCompany,
      });
    } catch (error: any) {
      console.error("Error cancelando cambio programado:", error);
      res.status(500).json({ error: error.message || "Error interno del servidor" });
    }
  });

  // Cancelar la renovación de la membresía de una empresa.
  // El plan permanece ACTIVO hasta la fecha de vencimiento; solo se detiene la
  // renovación automática. Se marca la empresa como cancelada para reflejarlo
  // en el dashboard y, si existe suscripción en Stripe, se programa el fin.
  app.post("/api/companies/:id/cancel-membership", async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }

      // Autorización: solo admin o el dueño/representante REAL de la empresa,
      // confirmado contra la base de datos (no se confía en claims del cliente).
      if (!(await verifyCompanyAccess(req, res, company))) {
        return;
      }

      // Sincronizar con Stripe si hay suscripción activa del propietario.
      // Si Stripe falla, NO persistir el cambio local para evitar
      // inconsistencias entre el estado de la suscripción y la BD.
      if (company.userId) {
        const user = await storage.getUser(company.userId);
        if (user?.stripeSubscriptionId) {
          try {
            const stripe = await getStripe();
            await stripe.subscriptions.update(user.stripeSubscriptionId, {
              cancel_at_period_end: true,
            });
          } catch (stripeError: any) {
            console.error("Error cancelando suscripción en Stripe:", stripeError);
            return res.status(502).json({
              error: "No se pudo cancelar la renovación con el procesador de pagos. Intenta de nuevo.",
            });
          }
          await storage.updateUser(user.id, { autoRenewal: false });
        }
      }

      const updatedCompany = await storage.updateCompany(companyId, {
        membershipCancelled: true,
      });

      res.json({
        success: true,
        message: "Renovación cancelada. Tu plan seguirá activo hasta la fecha de vencimiento.",
        company: updatedCompany,
      });
    } catch (error: any) {
      console.error("Error cancelando membresía:", error);
      res.status(500).json({ error: error.message || "Error interno del servidor" });
    }
  });

  // Reanudar la renovación de la membresía de una empresa previamente cancelada.
  app.post("/api/companies/:id/resume-membership", async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }

      // Autorización: solo admin o el dueño/representante REAL de la empresa,
      // confirmado contra la base de datos (no se confía en claims del cliente).
      if (!(await verifyCompanyAccess(req, res, company))) {
        return;
      }

      // Sincronizar con Stripe si hay suscripción activa del propietario.
      // Si Stripe falla, NO persistir el cambio local.
      if (company.userId) {
        const user = await storage.getUser(company.userId);
        if (user?.stripeSubscriptionId) {
          try {
            const stripe = await getStripe();
            await stripe.subscriptions.update(user.stripeSubscriptionId, {
              cancel_at_period_end: false,
            });
          } catch (stripeError: any) {
            console.error("Error reanudando suscripción en Stripe:", stripeError);
            return res.status(502).json({
              error: "No se pudo reanudar la renovación con el procesador de pagos. Intenta de nuevo.",
            });
          }
          await storage.updateUser(user.id, { autoRenewal: true });
        }
      }

      const updatedCompany = await storage.updateCompany(companyId, {
        membershipCancelled: false,
      });

      res.json({
        success: true,
        message: "Renovación reanudada. Tu plan continuará renovándose normalmente.",
        company: updatedCompany,
      });
    } catch (error: any) {
      console.error("Error reanudando membresía:", error);
      res.status(500).json({ error: error.message || "Error interno del servidor" });
    }
  });

  // Verificación estricta de acceso a una empresa: solo admin o el
  // dueño/representante REAL de la empresa. IMPORTANTE: NO se confía en el rol
  // ni en companyId enviados por el cliente (header x-user-info); todo se
  // confirma contra la base de datos con el id de usuario reclamado.
  // Escribe la respuesta de error y devuelve false si no está autorizado.
  async function verifyCompanyAccess(req: any, res: any, company: any): Promise<boolean> {
    const verifiedRequester = await getVerifiedRequestUser(req);
    if (!verifiedRequester?.id) {
      res.status(401).json({ error: "No autenticado" });
      return false;
    }
    const dbUser = await storage.getUser(Number(verifiedRequester.id));
    if (!dbUser) {
      res.status(401).json({ error: "No autenticado" });
      return false;
    }
    const isAdmin = dbUser.role === "admin";
    let isOwner = false;
    if (!isAdmin) {
      const repCompanies = await storage.getCompaniesForRepresentative(dbUser.email, dbUser.id);
      isOwner = repCompanies.some((assignedCompany) => assignedCompany.id === company.id);
    }
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: "No autorizado" });
      return false;
    }
    return true;
  }

  // --- Método de pago de la suscripción (ver tarjeta y cambiarla) ---

  // Autorización compartida: solo admin o el dueño/representante de la empresa.
  async function authorizeCompanyOwner(req: any, res: any): Promise<{ company: any; owner: any } | null> {
    const companyId = parseInt(req.params.id);
    const company = await storage.getCompany(companyId);
    if (!company) {
      res.status(404).json({ error: "Empresa no encontrada" });
      return null;
    }
    if (!(await verifyCompanyAccess(req, res, company))) {
      return null;
    }
    const owner = company.userId ? await storage.getUser(company.userId) : null;
    if (!owner?.stripeCustomerId) {
      res.status(404).json({ error: "Esta empresa no tiene pagos con tarjeta configurados" });
      return null;
    }
    return { company, owner };
  }

  // Ver la tarjeta con la que se paga el plan (marca, últimos 4 dígitos, vencimiento).
  app.get("/api/companies/:id/payment-method", async (req: any, res) => {
    try {
      const auth = await authorizeCompanyOwner(req, res);
      if (!auth) return;
      const { owner, company } = auth;

      // Contexto de membresía para que la UI muestre estado, vencimiento y
      // renovación sin llamadas extra.
      const membership = {
        fechaFinMembresia: company.fechaFinMembresia || null,
        autoRenewal: !!owner.autoRenewal && !company.membershipCancelled,
        membershipCancelled: !!company.membershipCancelled,
        companyEstado: company.estado,
        inactiveReason: company.inactiveReason || null,
      };

      const stripe = await getStripe();

      // 1) Preferir el método de pago por defecto de la SUSCRIPCIÓN.
      let pmId: string | null = null;
      if (owner.stripeSubscriptionId) {
        try {
          const subscription: any = await stripe.subscriptions.retrieve(owner.stripeSubscriptionId);
          pmId = typeof subscription.default_payment_method === "string"
            ? subscription.default_payment_method
            : subscription.default_payment_method?.id || null;
        } catch (e) {
          console.warn("No se pudo recuperar la suscripción para el método de pago:", e);
        }
      }

      // 2) Si no, el del CLIENTE (invoice_settings.default_payment_method).
      if (!pmId) {
        const customer: any = await stripe.customers.retrieve(owner.stripeCustomerId);
        if (!customer || customer.deleted) {
          return res.json({ card: null, membership });
        }
        pmId = typeof customer.invoice_settings?.default_payment_method === "string"
          ? customer.invoice_settings.default_payment_method
          : customer.invoice_settings?.default_payment_method?.id || null;
      }

      // 3) Último recurso: la primera tarjeta guardada del cliente.
      let paymentMethod: any = null;
      if (pmId) {
        paymentMethod = await stripe.paymentMethods.retrieve(pmId);
      } else {
        const list = await stripe.paymentMethods.list({
          customer: owner.stripeCustomerId,
          type: "card",
          limit: 1,
        });
        paymentMethod = list.data[0] || null;
      }

      if (!paymentMethod?.card) {
        return res.json({ card: null, membership });
      }

      res.json({
        card: {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
        },
        membership,
      });
    } catch (error: any) {
      console.error("Error obteniendo método de pago:", error);
      res.status(500).json({ error: "No se pudo obtener la tarjeta registrada" });
    }
  });

  // Iniciar el cambio de tarjeta: crea un SetupIntent para capturar la nueva tarjeta.
  app.post("/api/companies/:id/payment-method/setup-intent", async (req: any, res) => {
    try {
      const auth = await authorizeCompanyOwner(req, res);
      if (!auth) return;
      const { owner } = auth;

      const stripe = await getStripe();
      const setupIntent = await stripe.setupIntents.create({
        customer: owner.stripeCustomerId,
        usage: "off_session",
        payment_method_types: ["card"],
      });

      res.json({ clientSecret: setupIntent.client_secret });
    } catch (error: any) {
      console.error("Error creando SetupIntent:", error);
      res.status(500).json({ error: "No se pudo iniciar el cambio de tarjeta" });
    }
  });

  // Confirmar el cambio de tarjeta: fija la nueva tarjeta como método por defecto
  // del cliente y de la suscripción (los próximos cobros usan esta tarjeta).
  app.post("/api/companies/:id/payment-method", async (req: any, res) => {
    try {
      const auth = await authorizeCompanyOwner(req, res);
      if (!auth) return;
      const { owner } = auth;

      const { paymentMethodId } = req.body || {};
      if (!paymentMethodId || typeof paymentMethodId !== "string") {
        return res.status(400).json({ error: "Falta el identificador de la nueva tarjeta" });
      }

      const stripe = await getStripe();

      // Verificar que el método de pago pertenece a ESTE cliente (el SetupIntent
      // ya lo adjunta; esto evita fijar tarjetas de otros clientes).
      const pm: any = await stripe.paymentMethods.retrieve(paymentMethodId);
      const pmCustomer = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
      if (pmCustomer !== owner.stripeCustomerId) {
        return res.status(403).json({ error: "La tarjeta no corresponde a esta cuenta" });
      }

      await stripe.customers.update(owner.stripeCustomerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      if (owner.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(owner.stripeSubscriptionId, {
            default_payment_method: paymentMethodId,
          });
        } catch (e) {
          console.warn("No se pudo fijar la tarjeta en la suscripción (se usará la del cliente):", e);
        }
      }

      res.json({ success: true, message: "Tarjeta actualizada correctamente" });
    } catch (error: any) {
      console.error("Error actualizando método de pago:", error);
      res.status(500).json({ error: "No se pudo actualizar la tarjeta" });
    }
  });

  // Eliminar/desvincular la tarjeta registrada. NO cancela el periodo ya pagado:
  // la empresa sigue activa hasta fechaFinMembresia. Solo se desactiva la
  // renovación automática (sin tarjeta no hay forma de cobrar). Es idempotente:
  // si ya no hay tarjeta, responde éxito igualmente.
  app.delete("/api/companies/:id/payment-method", async (req: any, res) => {
    try {
      const auth = await authorizeCompanyOwner(req, res);
      if (!auth) return;
      const { owner, company } = auth;

      const stripe = await getStripe();

      // 1) Desvincular TODAS las tarjetas guardadas del cliente en Stripe.
      let detached = 0;
      try {
        const list = await stripe.paymentMethods.list({
          customer: owner.stripeCustomerId,
          type: "card",
          limit: 20,
        });
        for (const pm of list.data) {
          try {
            await stripe.paymentMethods.detach(pm.id);
            detached++;
          } catch (detachErr: any) {
            // Si ya estaba desvinculada en Stripe, lo tratamos como éxito.
            if (detachErr?.code !== "payment_method_unattached") {
              throw detachErr;
            }
          }
        }
      } catch (stripeErr: any) {
        console.error("Error desvinculando tarjetas en Stripe:", stripeErr?.message);
        return res.status(502).json({
          error: "No se pudo desvincular la tarjeta con el procesador de pagos. Intenta de nuevo.",
        });
      }

      // 2) Limpiar el método por defecto del cliente.
      try {
        await stripe.customers.update(owner.stripeCustomerId, {
          invoice_settings: { default_payment_method: "" as any },
        });
      } catch (e) {
        console.warn("No se pudo limpiar el método por defecto del cliente:", e);
      }

      // 3) Sin tarjeta no hay renovación posible: programar el fin de la
      //    suscripción al término del periodo YA pagado (la membresía vigente
      //    NO se toca; Stripe emitirá subscription.deleted al vencer).
      if (owner.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.update(owner.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        } catch (e: any) {
          // Suscripción ya cancelada/inexistente: comportamiento idempotente.
          console.warn("No se pudo programar el fin de la suscripción:", e?.message);
        }
      }

      // 4) Estado local: renovación automática deshabilitada. La empresa y su
      //    fecha de fin de membresía NO cambian aquí.
      await storage.updateUser(owner.id, { autoRenewal: false });
      await storage.updateCompany(company.id, { membershipCancelled: true });

      let actorId = "?";
      try {
        actorId = JSON.parse(req.headers["x-user-info"] || "{}").id ?? "?";
      } catch {}
      console.log(
        `[PaymentMethod] Tarjeta eliminada por user ${actorId} ` +
        `para empresa ${company.id} (${detached} método(s) desvinculado(s) en Stripe).`
      );

      res.json({
        success: true,
        detached,
        message: detached > 0
          ? "Tarjeta eliminada. Tu membresía sigue vigente hasta su fecha de vencimiento."
          : "No había tarjeta registrada.",
        membership: {
          fechaFinMembresia: company.fechaFinMembresia || null,
          autoRenewal: false,
          membershipCancelled: true,
          companyEstado: company.estado,
        },
      });
    } catch (error: any) {
      console.error("Error eliminando método de pago:", error);
      res.status(500).json({ error: "No se pudo eliminar la tarjeta" });
    }
  });

  // Aplica los cambios de plan PROGRAMADOS de empresas SIN suscripción de Stripe
  // cuyo período ya venció. Las empresas con suscripción de Stripe se aplican vía
  // webhook (invoice.payment_succeeded) tras confirmarse el pago.
  async function applyExpiredPendingChanges() {
    const today = new Date().toISOString().split("T")[0];
    const { companies: allCompanies } = await storage.getAllCompanies({
      includeInactive: true,
      limit: 100000,
    });

    let applied = 0;
    for (const company of allCompanies) {
      if (!company.pendingMembershipTypeId) continue;

      // Solo aplicar cuando el período actual ya venció. Criterio unificado con
      // el resto del sistema: la membresía es vigente mientras fin >= hoy, así
      // que el cambio pendiente se aplica hasta el día SIGUIENTE al vencimiento.
      const fin = company.pendingChangeEffectiveDate || company.fechaFinMembresia;
      if (!fin || fin >= today) continue;

      // Si el dueño tiene suscripción de Stripe, el cambio lo aplica el webhook.
      if (company.userId) {
        const owner = await storage.getUser(company.userId);
        if (owner?.stripeSubscriptionId) continue;
      }

      await applyPendingPlanChange(company, { recordPayment: true });
      applied++;
    }

    if (applied > 0) {
      console.log(`Cambios de plan programados aplicados (sin Stripe): ${applied}`);
    }
  }

  // Job de vencimiento: inactiva empresas cuya membresía YA venció y no tiene
  // una renovación pagada. No toca: empresas vigentes, ya inactivas, sin fecha
  // de fin (planes manuales/vitalicios) ni planes gratuitos (sin costo).
  async function deactivateExpiredCompanies() {
    const today = new Date().toISOString().split("T")[0];
    const { companies: allCompanies } = await storage.getAllCompanies({
      includeInactive: true,
      limit: 100000,
    });

    const freePlanCache = new Map<number, boolean>();
    const isFreePlan = async (membershipTypeId: number | null): Promise<boolean> => {
      if (!membershipTypeId) return true; // sin plan asignado: no inactivar por pago
      if (freePlanCache.has(membershipTypeId)) return freePlanCache.get(membershipTypeId)!;
      const mt = await storage.getMembershipType(membershipTypeId);
      const precios = Array.isArray(mt?.opcionesPrecios) ? (mt!.opcionesPrecios as any[]) : [];
      const free = !precios.some((p) => Number(p?.costo) > 0);
      freePlanCache.set(membershipTypeId, free);
      return free;
    };

    let deactivated = 0;
    for (const company of allCompanies) {
      if (company.estado !== "activo") continue; // ya inactiva o pendiente
      if (!company.fechaFinMembresia) continue; // sin fecha fin: manual/vitalicia
      if (company.fechaFinMembresia >= today) continue; // aún vigente (incluye hoy)
      if (await isFreePlan(company.membershipTypeId)) continue; // plan gratuito/exento

      // Releer el estado MÁS reciente justo antes de inactivar: un webhook de
      // pago pudo haber extendido la membresía mientras corría este job.
      const fresh = await storage.getCompany(company.id);
      if (!fresh || fresh.estado !== "activo") continue;
      if (!fresh.fechaFinMembresia || fresh.fechaFinMembresia >= today) continue;

      await storage.updateCompany(fresh.id, {
        estado: "inactivo",
        inactiveReason: "Membresía vencida sin pago o sin método de pago registrado",
        inactivatedAt: new Date(),
      });
      deactivated++;
      console.log(
        `[ExpirationJob] Empresa ${fresh.id} (${fresh.nombreEmpresa}) inactivada: ` +
        `membresía venció el ${fresh.fechaFinMembresia} sin renovación pagada.`
      );

      // Aviso por correo al dueño (una vez, al momento de inactivar).
      try {
        if (fresh.userId) {
          const owner = await storage.getUser(fresh.userId);
          if (owner?.email) {
            const mt = fresh.membershipTypeId
              ? await storage.getMembershipType(fresh.membershipTypeId)
              : null;
            await sendCancellationEmail(
              owner.email,
              owner.displayName || owner.email,
              fresh.nombreEmpresa,
              mt?.nombrePlan || "Membresía"
            );
          }
        }
      } catch (emailErr) {
        console.error(`[ExpirationJob] Error enviando aviso de inactivación (empresa ${fresh.id}):`, emailErr);
      }
    }

    if (deactivated > 0) {
      console.log(`[ExpirationJob] Empresas inactivadas por vencimiento: ${deactivated}`);
    }
  }

  const httpServer = createServer(app);
  
  // Set up daily scheduler for expiration notifications
  // Runs every 24 hours (at server start and then every 24h)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  
  // Initial check after 1 minute (to let server fully start)
  setTimeout(async () => {
    console.log("Running initial expiration notifications check...");
    try {
      const result = await checkAndSendExpirationNotifications();
      console.log(`Initial expiration check: ${result.sent} sent, ${result.errors} errors`);
    } catch (error) {
      console.error("Error in initial expiration check:", error);
    }
    try {
      await applyExpiredPendingChanges();
    } catch (error) {
      console.error("Error applying expired pending plan changes:", error);
    }
    try {
      await deactivateExpiredCompanies();
    } catch (error) {
      console.error("Error deactivating expired companies:", error);
    }
  }, 60 * 1000);
  
  // Then run every 24 hours
  setInterval(async () => {
    console.log("Running scheduled expiration notifications check...");
    try {
      const result = await checkAndSendExpirationNotifications();
      console.log(`Scheduled expiration check: ${result.sent} sent, ${result.errors} errors`);
    } catch (error) {
      console.error("Error in scheduled expiration check:", error);
    }
    try {
      await applyExpiredPendingChanges();
    } catch (error) {
      console.error("Error applying expired pending plan changes:", error);
    }
    try {
      await deactivateExpiredCompanies();
    } catch (error) {
      console.error("Error deactivating expired companies:", error);
    }
  }, TWENTY_FOUR_HOURS);
  
  console.log("Email notification scheduler configured (daily at server start time)");
  
  return httpServer;
}
