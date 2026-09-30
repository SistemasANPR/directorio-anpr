import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import Stripe from "stripe";
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";
import { eq, like, sql, and, or, asc, desc, inArray, isNull, gte, lte, count } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  users,
  companies,
  categories,
  tags,
  membershipTypes,
  certificates,
  roles,
  opinions,
  membershipPayments,
  systemSettings,
  projects,
  companyLocations,
  integrationSettings,
  pdfSettings,
  stripeConfigurationTable,
  emailConfiguration,
  emailTemplates,
  frontendConfigurationTable
} from "../shared/schema.js";
import nodemailer from "nodemailer";
import path from "path";
import { generateSqlDump, buildDumpFilename } from "../server/services/db-export.js";
import {
  streamFullExport,
  buildPackageFilename,
  collectProjectFiles,
  resolveProjectRoot,
} from "../server/services/project-export.js";
import { verifyAdminSession, parseCookie, ADMIN_SESSION_COOKIE } from "../server/adminSession.js";
import { getFirebaseAdmin } from "../server/firebase-admin.js";
import { verifyWordPressSessionToken } from "../server/services/wordpress.js";
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
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
} from '../shared/image-upload';

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

// Multer memory storage for Cloudinary
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES + 1 },
  fileFilter: (_req, file, callback) => {
    if (isImageMimeType(file.mimetype)) {
      callback(null, true);
    } else {
      callback(new Error('Solo se permiten archivos de imagen'));
    }
  },
});
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function hasOversizedDataUrlImage(body: unknown): boolean {
  if (typeof body === 'string') {
    if (isDataUrl(body)) {
      const declaredAsImage = isImageDataUrl(body);
      const bytes = decodeDataUrl(body);
      if (bytes === null) return true;
      if (isImageBytes(bytes)) return bytes.byteLength > IMAGE_MAX_BYTES;
      return declaredAsImage;
    }
    const trimmed = body.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed !== body && hasOversizedDataUrlImage(parsed);
      } catch {
        return false;
      }
    }
    return false;
  }
  if (Array.isArray(body)) return body.some(hasOversizedDataUrlImage);
  if (body && typeof body === 'object') return Object.values(body).some(hasOversizedDataUrlImage);
  return false;
}

function validateUploadedImages(req: Request, res: Response, next: NextFunction) {
  const files = [
    ...(req.file ? [req.file] : []),
    ...(Array.isArray(req.files) ? req.files : []),
  ];
  if (files.some((file) => file.buffer.byteLength > IMAGE_MAX_BYTES)) {
    return res.status(413).json({ error: IMAGE_TOO_LARGE_MESSAGE });
  }
  next();
}

// Upload to Cloudinary helper
async function uploadToCloudinary(buffer: Buffer, folder: string = 'anpr', resourceType: 'image' | 'raw' | 'auto' = 'image'): Promise<{url: string, publicId: string}> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation: resourceType === 'image' ? [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ] : undefined
      },
      (error, result) => {
        if (error) reject(error);
        else if (result) resolve({ url: result.secure_url, publicId: result.public_id });
        else reject(new Error('No result from Cloudinary'));
      }
    );
    uploadStream.end(buffer);
  });
}

// Database connection
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set");
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
const db = drizzle(pool, { schema });

// Stripe configuration
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" as any })
  : null;

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use((req, res, next) => {
  if (hasOversizedDataUrlImage(req.body)) {
    return res.status(413).json({ error: IMAGE_TOO_LARGE_MESSAGE });
  }
  next();
});

// CORS for Vercel
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Info, X-WordPress-Session');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Extract user info from headers
app.use('/api', (req: any, res, next) => {
  const userHeader = req.headers['x-user-info'];
  if (userHeader) {
    try {
      req.user = JSON.parse(userHeader as string);
    } catch (error) {
      // Continue without user info
    }
  }
  next();
});

// ============ API ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ EXPORTACIÃ“N DE LA BASE DE DATOS ============

const ADMIN_DASHBOARD_PERMISSION = 'admin.dashboard';

// Confirma contra la base de datos que el usuario indicado es administrador.
// Nunca se confÃ­a en el rol enviado por el cliente.
async function isAdminUserId(userId: number): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;
  if (String(user.role).trim().toLowerCase() === 'admin') return true;

  const allRoles = await db.select().from(roles);
  const match = allRoles.find(
    (r) => r.nombre.trim().toLowerCase() === String(user.role ?? '').trim().toLowerCase(),
  );
  const permisos = Array.isArray(match?.permisos) ? (match!.permisos as string[]) : [];
  return permisos.includes(ADMIN_DASHBOARD_PERMISSION);
}

// AutorizaciÃ³n de las herramientas del panel de administraciÃ³n.
//
// Es la MISMA puerta que usa el panel en el cliente: cualquier sesiÃ³n vÃ¡lida
// cuyo rol sea administrador. Acepta las tres identidades FIRMADAS del sistema
// â€”ID token de Firebase, sesiÃ³n de WordPress (SSO) y cookie de administradorâ€”
// y nunca el header x-user-info, que cualquiera puede fabricar desde el
// navegador. Devuelve el id del administrador, o null.
async function getAdminPanelUserId(req: any): Promise<number | null> {
  const authHeader = (req.headers['authorization'] as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    const firebaseAdmin = getFirebaseAdmin();
    if (firebaseAdmin) {
      try {
        const decoded = await firebaseAdmin.auth().verifyIdToken(token);
        const [fbUser] = await db
          .select()
          .from(users)
          .where(eq(users.firebaseUid, decoded.uid))
          .limit(1);
        if (fbUser && (await isAdminUserId(fbUser.id))) return fbUser.id;
      } catch {
        // Token invÃ¡lido: se intenta con las demÃ¡s sesiones firmadas.
      }
    }
  }

  // SesiÃ³n de WordPress: token firmado por el servidor durante el auto-login.
  const wordpressToken = String(req.headers['x-wordpress-session'] || '');
  if (wordpressToken) {
    const payload = verifyWordPressSessionToken(wordpressToken, Date.now());
    if (payload) {
      const [wpUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, payload.wpEmail))
        .limit(1);
      if (wpUser && (await isAdminUserId(wpUser.id))) return wpUser.id;
    }
  }

  const cookieToken = parseCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (cookieToken) {
    const userId = verifyAdminSession(cookieToken);
    if (userId && (await isAdminUserId(userId))) return userId;
  }

  return null;
}

// Explica en el error POR QUÃ‰ fallÃ³, para que un administrador legÃ­timo sepa
// quÃ© hacer en vez de recibir un 401 mudo.
function describeMissingAdminIdentity(req: any): string {
  const hasFirebase = String(req.headers['authorization'] || '').startsWith('Bearer ');
  const hasWordPress = Boolean(req.headers['x-wordpress-session']);
  const hasCookie = Boolean(parseCookie(req.headers.cookie, ADMIN_SESSION_COOKIE));

  if (!hasFirebase && !hasWordPress && !hasCookie) {
    return 'No se recibiÃ³ ninguna sesiÃ³n verificable. Vuelve a iniciar sesiÃ³n en el panel e intÃ©ntalo de nuevo.';
  }
  return 'Tu sesiÃ³n es vÃ¡lida pero la cuenta no tiene rol de administrador, o la sesiÃ³n expirÃ³. Vuelve a iniciar sesiÃ³n.';
}

// Descarga un volcado .sql completo, restaurable en cualquier PostgreSQL
// (incluido un VPS de Hostinger) con:  psql "<DATABASE_URL>" < backup.sql
app.get('/api/admin/database-export', async (req, res) => {
  try {
    const adminId = await getAdminPanelUserId(req);
    if (!adminId) {
      return res.status(401).json({ error: describeMissingAdminIdentity(req) });
    }
    console.log(`[db-export] Solicitado por el usuario ${adminId}`);

    const includeData = req.query.includeData !== 'false';
    const { sql: dump, tableCount, rowCount } = await generateSqlDump(pool, { includeData });
    const filename = buildDumpFilename();

    console.log(
      `[db-export] Respaldo generado: ${tableCount} tablas, ${rowCount} registros, ${dump.length} bytes`,
    );

    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Export-Tables', String(tableCount));
    res.setHeader('X-Export-Rows', String(rowCount));
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Export-Tables, X-Export-Rows');
    res.send(dump);
  } catch (error: any) {
    console.error('Error exportando la base de datos:', error);
    res.status(500).json({ error: error?.message || 'No se pudo exportar la base de datos' });
  }
});

// Resumen previo a la descarga: cuÃ¡ntos archivos y tablas se exportarÃ­an.
app.get('/api/admin/export-info', async (req, res) => {
  try {
    if (!(await getAdminPanelUserId(req))) {
      return res.status(401).json({ error: describeMissingAdminIdentity(req) });
    }

    const root = resolveProjectRoot();
    const files = root ? collectProjectFiles(root) : [];
    const sourceBytes = files.reduce((total, file) => total + file.size, 0);

    // Conteo EXACTO por tabla: pg_stat_user_tables.n_live_tup devuelve 0 si el
    // recolector de estadÃ­sticas aÃºn no ha pasado, y el resumen mentirÃ­a.
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
    console.error('Error obteniendo el resumen de exportaciÃ³n:', error);
    res.status(500).json({ error: error?.message || 'No se pudo obtener el resumen' });
  }
});

// Paquete ZIP: cÃ³digo fuente + respaldo de la base de datos + guÃ­a de instalaciÃ³n.
app.get('/api/admin/project-export', async (req, res) => {
  try {
    const adminId = await getAdminPanelUserId(req);
    if (!adminId) {
      return res.status(401).json({ error: describeMissingAdminIdentity(req) });
    }
    console.log(`[project-export] Solicitado por el usuario ${adminId}`);

    const includeDatabase = req.query.includeDatabase !== 'false';
    const includeSource = req.query.includeSource !== 'false';
    if (!includeDatabase && !includeSource) {
      return res.status(400).json({
        error: 'Debes incluir al menos el cÃ³digo fuente o la base de datos',
      });
    }

    const prefix = !includeSource
      ? 'directorio-base-de-datos'
      : !includeDatabase
        ? 'directorio-codigo'
        : 'directorio-completo';
    const filename = buildPackageFilename(prefix);

    console.log(`[project-export] Generando paquete ${filename}`);
    await streamFullExport(res, pool, filename, { includeDatabase, includeSource });
  } catch (error: any) {
    console.error('Error exportando el proyecto:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error?.message || 'No se pudo exportar el proyecto' });
    }
  }
});

// ============ COMPANIES ============
app.get('/api/companies', async (req, res) => {
  try {
    const { search, categoryId, membershipTypeId, estado, limit = 50, offset = 0, includeInactive } = req.query;
    
    let query = db.select().from(companies);
    const conditions: any[] = [];

    if (!includeInactive) {
      conditions.push(eq(companies.estado, "activo"));
    }

    if (search) {
      conditions.push(
        or(
          like(companies.nombreEmpresa, `%${search}%`),
          like(companies.descripcionEmpresa, `%${search}%`)
        )
      );
    }

    if (categoryId) {
      conditions.push(sql`${companies.categoriesIds} @> '[${parseInt(categoryId as string)}]'::jsonb`);
    }

    if (estado) {
      conditions.push(eq(companies.estado, estado as string));
    }

    if (membershipTypeId) {
      conditions.push(eq(companies.membershipTypeId, parseInt(membershipTypeId as string)));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    
    const companiesResult = await db
      .select()
      .from(companies)
      .where(whereCondition)
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string))
      .orderBy(desc(companies.id));

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(companies)
      .where(whereCondition);

    // Enrich with categories and membership types
    const enrichedCompanies = await Promise.all(
      companiesResult.map(async (company) => {
        const catIds = company.categoriesIds as number[] | null;
        const companyCategories = catIds && Array.isArray(catIds) && catIds.length > 0
          ? await db.select().from(categories).where(inArray(categories.id, catIds))
          : [];
        
        const membershipType = company.membershipTypeId
          ? await db.select().from(membershipTypes).where(eq(membershipTypes.id, company.membershipTypeId)).then(r => r[0])
          : null;

        return {
          ...company,
          categories: companyCategories,
          membershipType
        };
      })
    );

    res.json({ 
      companies: enrichedCompanies, 
      total: Number(countResult[0]?.count || 0)
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ message: 'Error fetching companies' });
  }
});

app.get('/api/companies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const company = await db.select().from(companies).where(eq(companies.id, id)).then(r => r[0]);
    
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    const catIds = company.categoriesIds as number[] | null;
    const companyCategories = catIds && Array.isArray(catIds) && catIds.length > 0
      ? await db.select().from(categories).where(inArray(categories.id, catIds))
      : [];
    
    const membershipType = company.membershipTypeId
      ? await db.select().from(membershipTypes).where(eq(membershipTypes.id, company.membershipTypeId)).then(r => r[0])
      : null;

    const locations = await db.select().from(companyLocations).where(eq(companyLocations.companyId, id));

    res.json({
      ...company,
      categories: companyCategories,
      membershipType,
      locations
    });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ message: 'Error fetching company' });
  }
});

app.post('/api/companies', async (req, res) => {
  try {
    const companyData = req.body;
    const newCompany = await db.insert(companies).values(companyData).returning();
    res.status(201).json(newCompany[0]);
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ message: 'Error creating company' });
  }
});

app.patch('/api/companies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = req.body;
    const updated = await db.update(companies).set(updateData).where(eq(companies.id, id)).returning();
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ message: 'Error updating company' });
  }
});

app.delete('/api/companies/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(companies).where(eq(companies.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ message: 'Error deleting company' });
  }
});

// ============ CATEGORIES ============
app.get('/api/categories', async (req, res) => {
  try {
    const allCategories = await db.select().from(categories).orderBy(asc(categories.nombreCategoria));
    res.json(allCategories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    if (hasOversizedDataUrlImage(req.body)) return res.status(413).json({ error: IMAGE_TOO_LARGE_MESSAGE });
    const newCategory = await db.insert(categories).values(req.body).returning();
    res.status(201).json(newCategory[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Error creating category' });
  }
});

app.patch('/api/categories/:id', async (req, res) => {
  try {
    if (hasOversizedDataUrlImage(req.body)) return res.status(413).json({ error: IMAGE_TOO_LARGE_MESSAGE });
    const id = parseInt(req.params.id);
    const updated = await db.update(categories).set(req.body).where(eq(categories.id, id)).returning();
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Error updating category' });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(categories).where(eq(categories.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Error deleting category' });
  }
});

// ============ MEMBERSHIP TYPES ============
app.get('/api/membership-types', async (req, res) => {
  try {
    const allTypes = await db.select().from(membershipTypes).orderBy(asc(membershipTypes.id));
    res.json(allTypes);
  } catch (error) {
    console.error('Error fetching membership types:', error);
    res.status(500).json({ message: 'Error fetching membership types' });
  }
});

app.post('/api/membership-types', async (req, res) => {
  try {
    const newType = await db.insert(membershipTypes).values(req.body).returning();
    res.status(201).json(newType[0]);
  } catch (error) {
    console.error('Error creating membership type:', error);
    res.status(500).json({ message: 'Error creating membership type' });
  }
});

app.patch('/api/membership-types/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await db.update(membershipTypes).set(req.body).where(eq(membershipTypes.id, id)).returning();
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating membership type:', error);
    res.status(500).json({ message: 'Error updating membership type' });
  }
});

// ============ USERS ============
app.get('/api/users', async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

app.get('/api/users/firebase/:firebaseUid', async (req, res) => {
  try {
    const user = await db.select().from(users).where(eq(users.firebaseUid, req.params.firebaseUid)).then(r => r[0]);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const newUser = await db.insert(users).values(req.body).returning();
    res.status(201).json(newUser[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

app.patch('/api/users/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await db.update(users).set(req.body).where(eq(users.id, id)).returning();
    res.json(updated[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// ============ CERTIFICATES ============
app.get('/api/certificates', async (req, res) => {
  try {
    const allCertificates = await db.select().from(certificates);
    res.json(allCertificates);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ message: 'Error fetching certificates' });
  }
});

// ============ OPINIONS ============
app.get('/api/opinions', async (req, res) => {
  try {
    const { companyId, estado } = req.query;
    let query = db.select().from(opinions);
    const conditions: any[] = [];

    if (companyId) {
      conditions.push(eq(opinions.companyId, parseInt(companyId as string)));
    }
    if (estado) {
      conditions.push(eq(opinions.estado, estado as string));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;
    const allOpinions = await db.select().from(opinions).where(whereCondition);
    res.json(allOpinions);
  } catch (error) {
    console.error('Error fetching opinions:', error);
    res.status(500).json({ message: 'Error fetching opinions' });
  }
});

app.post('/api/opinions', async (req, res) => {
  try {
    const newOpinion = await db.insert(opinions).values(req.body).returning();
    res.status(201).json(newOpinion[0]);
  } catch (error) {
    console.error('Error creating opinion:', error);
    res.status(500).json({ message: 'Error creating opinion' });
  }
});

// ============ PROJECTS ============
app.get('/api/projects', async (req, res) => {
  try {
    const { companyId } = req.query;
    let allProjects;
    if (companyId) {
      allProjects = await db.select().from(projects).where(eq(projects.companyId, parseInt(companyId as string)));
    } else {
      allProjects = await db.select().from(projects);
    }
    res.json(allProjects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Error fetching projects' });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const newProject = await db.insert(projects).values(req.body).returning();
    res.status(201).json(newProject[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ message: 'Error creating project' });
  }
});

// ============ SYSTEM SETTINGS ============
app.get('/api/system-settings', async (req, res) => {
  try {
    const settings = await db.select().from(systemSettings).then(r => r[0]);
    res.json(settings || {});
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ message: 'Error fetching system settings' });
  }
});

app.patch('/api/system-settings', async (req, res) => {
  try {
    const existing = await db.select().from(systemSettings).then(r => r[0]);
    if (existing) {
      const updated = await db.update(systemSettings).set(req.body).where(eq(systemSettings.id, existing.id)).returning();
      res.json(updated[0]);
    } else {
      const created = await db.insert(systemSettings).values(req.body).returning();
      res.json(created[0]);
    }
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({ message: 'Error updating system settings' });
  }
});

// ============ FRONTEND CONFIGURATION ============
app.get('/api/frontend-configuration', async (req, res) => {
  try {
    const config = await db.select().from(frontendConfigurationTable).then(r => r[0]);
    res.json(config || {});
  } catch (error) {
    console.error('Error fetching frontend configuration:', error);
    res.status(500).json({ message: 'Error fetching frontend configuration' });
  }
});

// ============ TAGS ============
app.get('/api/tags', async (req, res) => {
  try {
    const allTags = await db.select().from(tags);
    res.json(allTags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ message: 'Error fetching tags' });
  }
});

// ============ COMPANY LOCATIONS ============
app.get('/api/company-locations', async (req, res) => {
  try {
    const { companyId } = req.query;
    if (companyId) {
      const locations = await db.select().from(companyLocations).where(eq(companyLocations.companyId, parseInt(companyId as string)));
      res.json(locations);
    } else {
      const locations = await db.select().from(companyLocations);
      res.json(locations);
    }
  } catch (error) {
    console.error('Error fetching company locations:', error);
    res.status(500).json({ message: 'Error fetching company locations' });
  }
});

// ============ MEMBERSHIP PAYMENTS ============
app.get('/api/membership-payments', async (req, res) => {
  try {
    const payments = await db.select().from(membershipPayments).orderBy(desc(membershipPayments.createdAt));
    res.json(payments);
  } catch (error) {
    console.error('Error fetching membership payments:', error);
    res.status(500).json({ message: 'Error fetching membership payments' });
  }
});

app.post('/api/membership-payments', async (req, res) => {
  try {
    const newPayment = await db.insert(membershipPayments).values(req.body).returning();
    res.status(201).json(newPayment[0]);
  } catch (error) {
    console.error('Error creating membership payment:', error);
    res.status(500).json({ message: 'Error creating membership payment' });
  }
});

// ============ STRIPE ENDPOINTS ============
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: 'Stripe not configured' });
    }

    const { priceId, membershipTypeId, companyData, successUrl, cancelUrl } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${req.headers.origin}/cancel`,
      metadata: {
        membershipTypeId: membershipTypeId?.toString(),
        companyData: JSON.stringify(companyData)
      }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/create-payment-intent', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ message: 'Stripe not configured' });
    }

    const { amount, currency = 'usd', metadata } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============ STRIPE CONFIGURATION ============
app.get('/api/stripe-configuration', async (req, res) => {
  try {
    const config = await db.select().from(stripeConfigurationTable).then(r => r[0]);
    res.json(config || {});
  } catch (error) {
    console.error('Error fetching stripe configuration:', error);
    res.status(500).json({ message: 'Error fetching stripe configuration' });
  }
});

// ============ INTEGRATION SETTINGS ============
app.get('/api/integration-settings', async (req, res) => {
  try {
    const settings = await db.select().from(integrationSettings).then(r => r[0]);
    res.json(settings || {});
  } catch (error) {
    console.error('Error fetching integration settings:', error);
    res.status(500).json({ message: 'Error fetching integration settings' });
  }
});

// ============ EMAILS ============
app.post('/api/emails/send', async (req, res) => {
  try {
    const emailConfig = await db.select().from(emailConfiguration).then(r => r[0]);
    
    if (!emailConfig) {
      return res.status(500).json({ message: 'Email not configured' });
    }

    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpPort === 465,
      auth: {
        user: emailConfig.username,
        pass: emailConfig.password
      }
    });

    const { to, subject, html, text } = req.body;

    await transporter.sendMail({
      from: emailConfig.fromEmail,
      to,
      subject,
      html,
      text
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Error sending email' });
  }
});

// ============ ROLES ============
app.get('/api/roles', async (req, res) => {
  try {
    const allRoles = await db.select().from(roles);
    res.json(allRoles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ message: 'Error fetching roles' });
  }
});

// ============ UPLOAD ENDPOINTS ============
app.post('/api/upload-image', imageUpload.single('image'), validateUploadedImages, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibiÃ³ ningÃºn archivo' });
    }
    
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary no estÃ¡ configurado' });
    }
    
    const result = await uploadToCloudinary(req.file.buffer, 'anpr/images', 'image');
    res.json({ 
      success: true, 
      imageUrl: result.url,
      publicId: result.publicId,
      filename: result.publicId
    });
  } catch (error) {
    console.error('Error al subir imagen:', error);
    res.status(500).json({ error: 'Error al procesar la imagen' });
  }
});

app.post('/api/upload-images', imageUpload.array('images', 10), validateUploadedImages, async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos' });
    }
    
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary no estÃ¡ configurado' });
    }
    
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file.buffer, 'anpr/images', 'image')
    );
    const results = await Promise.all(uploadPromises);
    const imageUrls = results.map(result => ({
      imageUrl: result.url,
      publicId: result.publicId,
      filename: result.publicId
    }));
    
    res.json({ success: true, images: imageUrls });
  } catch (error) {
    console.error('Error al subir imÃ¡genes:', error);
    res.status(500).json({ error: 'Error al procesar las imÃ¡genes' });
  }
});

app.post('/api/upload-document', documentUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibiÃ³ ningÃºn archivo' });
    }
    if (req.file.buffer.byteLength > IMAGE_MAX_BYTES &&
      (isImageBytes(req.file.buffer) || !isSupportedDocumentBytes(req.file.buffer))) {
      return res.status(413).json({ error: IMAGE_TOO_LARGE_MESSAGE });
    }
    
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary no estÃ¡ configurado' });
    }
    
    const result = await uploadToCloudinary(req.file.buffer, 'anpr/documents', 'raw');
    res.json({ 
      success: true, 
      documentUrl: result.url,
      publicId: result.publicId,
      filename: result.publicId
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ error: 'Error al procesar el documento' });
  }
});

app.post('/api/upload', imageUpload.single('file'), validateUploadedImages, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibiÃ³ ningÃºn archivo' });
    }
    
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary no estÃ¡ configurado' });
    }
    
    const result = await uploadToCloudinary(req.file.buffer, 'anpr/profiles', 'image');
    res.json({ 
      success: true, 
      url: result.url,
      publicId: result.publicId,
      filename: result.publicId
    });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

app.delete('/api/delete-image/:publicId(*)', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ error: 'Cloudinary no estÃ¡ configurado' });
    }
    
    const result = await cloudinary.uploader.destroy(publicId);
    if (result.result === 'ok') {
      res.json({ success: true, message: 'Imagen eliminada correctamente' });
    } else {
      res.status(404).json({ error: 'Imagen no encontrada' });
    }
  } catch (error) {
    console.error('Error al eliminar imagen:', error);
    res.status(500).json({ error: 'Error al eliminar la imagen' });
  }
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  if (err?.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: err.field === 'document'
        ? 'El documento supera el tamaÃ±o mÃ¡ximo permitido de 20 MB. Selecciona un archivo mÃ¡s ligero.'
        : IMAGE_TOO_LARGE_MESSAGE,
    });
  }
  if (err?.name === 'MulterError' && (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE')) {
    return res.status(400).json({ error: 'Se excediÃ³ el nÃºmero mÃ¡ximo de archivos permitidos.' });
  }
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

// Export for Vercel
export default app;



