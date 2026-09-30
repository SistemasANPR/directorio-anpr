/**
 * ExportaciÃ³n del proyecto completo (cÃ³digo fuente + base de datos) en un ZIP
 * descargable, listo para desplegarse en Vercel y conectarse a un PostgreSQL
 * propio (por ejemplo, un VPS de Hostinger).
 *
 * El paquete que genera `streamFullExport` contiene:
 *   - Todo el cÃ³digo fuente del directorio (cliente, servidor, API, esquema).
 *   - El plugin de WordPress que integra membresÃ­as/licencias.
 *   - `database/backup.sql`: volcado completo de la base de datos (usuarios,
 *     empresas, membresÃ­as/licencias, pagos, reseÃ±as, configuraciÃ³n...).
 *   - `.env.example` con todas las variables de entorno necesarias.
 *   - `INSTALACION.md` con los pasos de despliegue.
 *
 * Nunca se incluyen secretos reales (.env), `node_modules`, el historial de git
 * ni los archivos subidos por los usuarios.
 */

import archiver from "archiver";
import fs from "fs";
import path from "path";
import type { Response } from "express";
import { generateSqlDump } from "./db-export.js";

/**
 * Carpetas y archivos que NUNCA entran en el paquete.
 *
 * - Pesados o regenerables: node_modules, dist, .cache, uploads, attached_assets
 * - Sensibles: .env, claves de servicio, volcados antiguos con datos reales
 * - EspecÃ­ficos del entorno actual: .git, .replit, .upm, .config, .local
 */
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".cache",
  ".local",
  ".upm",
  ".config",
  ".agents",
  ".claude",
  "dist",
  "uploads",
  "attached_assets",
  ".vercel",
  ".next",
  "coverage",
]);

const EXCLUDED_FILES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "package-lock.json",
  "database_export.sql",
  "production_sync.sql",
  "generated-icon.png",
  "map_section.png",
  ".DS_Store",
]);

/** Extensiones que jamÃ¡s deben viajar en el paquete (credenciales). */
const EXCLUDED_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx"]);

/**
 * Localiza la raÃ­z del proyecto. En el servidor Node es el cwd; en una funciÃ³n
 * serverless de Vercel los archivos incluidos cuelgan de otra ruta, asÃ­ que se
 * prueban varios candidatos y se acepta el primero que tenga `package.json`
 * junto a las carpetas del proyecto.
 */
export function resolveProjectRoot(): string | null {
  const candidates = [
    process.cwd(),
    process.env.PROJECT_ROOT,
    "/var/task",
    path.resolve(process.cwd(), ".."),
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    try {
      if (
        fs.existsSync(path.join(candidate, "package.json")) &&
        fs.existsSync(path.join(candidate, "shared"))
      ) {
        return candidate;
      }
    } catch {
      // Ruta inaccesible: se prueba la siguiente.
    }
  }
  return null;
}

function shouldSkip(entryName: string, isDirectory: boolean): boolean {
  if (isDirectory) return EXCLUDED_DIRS.has(entryName);
  if (EXCLUDED_FILES.has(entryName)) return true;
  if (EXCLUDED_EXTENSIONS.has(path.extname(entryName).toLowerCase())) return true;
  // Cualquier variante de .env que no sea la plantilla de ejemplo.
  if (entryName.startsWith(".env") && entryName !== ".env.example") return true;
  return false;
}

export interface CollectedFile {
  absolutePath: string;
  /** Ruta dentro del ZIP, con separadores "/". */
  archivePath: string;
  size: number;
}

/** Recorre el proyecto y devuelve la lista de archivos que se van a empaquetar. */
export function collectProjectFiles(root: string): CollectedFile[] {
  const files: CollectedFile[] = [];

  const walk = (dir: string, relative: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // Carpeta ilegible: se ignora en vez de romper la exportaciÃ³n.
    }

    for (const entry of entries) {
      if (shouldSkip(entry.name, entry.isDirectory())) continue;

      const absolutePath = path.join(dir, entry.name);
      const archivePath = relative ? `${relative}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        walk(absolutePath, archivePath);
      } else if (entry.isFile()) {
        try {
          files.push({ absolutePath, archivePath, size: fs.statSync(absolutePath).size });
        } catch {
          // Archivo desaparecido o sin permisos: se omite.
        }
      }
      // Los enlaces simbÃ³licos se ignoran deliberadamente: podrÃ­an apuntar
      // fuera del proyecto (por ejemplo a node_modules o a secretos).
    }
  };

  walk(root, "");
  return files;
}

/** Plantilla de variables de entorno, sin ningÃºn valor real. */
function buildEnvExample(): string {
  return `# ===================================================================
# Variables de entorno del Directorio de Proveedores
# ===================================================================
# Copia este archivo como ".env" (desarrollo local) o carga estas
# variables en Vercel: Settings -> Environment Variables.
# NUNCA subas el archivo .env real a GitHub.

# --- BASE DE DATOS (OBLIGATORIO) -----------------------------------
# PostgreSQL. Si la instalaste en un VPS de Hostinger:
#   postgresql://usuario:password@IP_DEL_VPS:5432/directorio?sslmode=require
DATABASE_URL=postgresql://usuario:password@host:5432/directorio?sslmode=require

# --- SEGURIDAD (OBLIGATORIO) ---------------------------------------
# Secreto para firmar las sesiones de administrador.
# Genera uno con: openssl rand -hex 32
SESSION_SECRET=

# Secreto compartido con WordPress para el auto-login (SSO).
WP_SSO_SECRET=

# --- CLOUDINARY (obligatorio para subir imÃ¡genes) ------------------
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# --- STRIPE (pagos de membresÃ­as/licencias) ------------------------
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# --- FIREBASE (autenticaciÃ³n) --------------------------------------
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
# Credencial de servicio (JSON en una sola lÃ­nea) para firebase-admin:
FIREBASE_SERVICE_ACCOUNT=

# --- GOOGLE MAPS ---------------------------------------------------
VITE_GOOGLE_MAPS_API_KEY=

# --- CORREO (SMTP) -------------------------------------------------
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=

# --- WORDPRESS (membresÃ­as / licencias) ----------------------------
WORDPRESS_URL=
WORDPRESS_USER=
WORDPRESS_APP_PASSWORD=

# --- ENTORNO -------------------------------------------------------
NODE_ENV=production
`;
}

/** GuÃ­a de instalaciÃ³n que se incluye dentro del ZIP. */
function buildInstallGuide(meta: { generatedAt: string; tableCount: number; rowCount: number }): string {
  return `# InstalaciÃ³n del Directorio de Proveedores

Paquete generado el **${meta.generatedAt}**.
Incluye el cÃ³digo fuente completo y un respaldo de la base de datos con
**${meta.tableCount} tablas** y **${meta.rowCount} registros** (usuarios,
empresas, membresÃ­as/licencias, pagos, reseÃ±as y configuraciÃ³n).

---

## Contenido del paquete

| Ruta | QuÃ© es |
|------|--------|
| \`client/\` | AplicaciÃ³n React (panel de administraciÃ³n y directorio pÃºblico) |
| \`server/\` | Servidor Express para Node (desarrollo y hosting tradicional) |
| \`api/index.ts\` | Misma API empaquetada como funciÃ³n serverless de Vercel |
| \`shared/schema.ts\` | Esquema de la base de datos (Drizzle ORM) |
| \`migrations/\` | Migraciones SQL |
| \`wordpress-plugin/\` | Plugin de WordPress: SSO y sincronizaciÃ³n de membresÃ­as |
| \`database/backup.sql\` | **Respaldo completo de la base de datos** |
| \`.env.example\` | Plantilla de variables de entorno |

> El paquete **no** incluye \`node_modules\`, el archivo \`.env\` con tus
> secretos reales, ni las imÃ¡genes subidas por los usuarios (esas viven en
> Cloudinary).

---

## 1. Crear la base de datos PostgreSQL

### OpciÃ³n A â€” VPS de Hostinger (control total)

ConÃ©ctate por SSH a tu VPS y ejecuta:

\`\`\`bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib

# Crear usuario y base de datos
sudo -u postgres psql <<'SQL'
CREATE USER directorio_user WITH PASSWORD 'CAMBIA_ESTA_PASSWORD';
CREATE DATABASE directorio OWNER directorio_user;
GRANT ALL PRIVILEGES ON DATABASE directorio TO directorio_user;
SQL
\`\`\`

Permite conexiones remotas (Vercel se conecta desde fuera):

\`\`\`bash
# postgresql.conf -> escuchar en todas las interfaces
sudo sed -i "s/^#\\?listen_addresses.*/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf

# pg_hba.conf -> exigir contraseÃ±a cifrada en conexiones remotas
echo "hostssl all all 0.0.0.0/0 scram-sha-256" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf

sudo systemctl restart postgresql
sudo ufw allow 5432/tcp
\`\`\`

> **Importante:** activa SSL en PostgreSQL antes de abrir el puerto 5432 a
> Internet, o cualquiera podrÃ¡ interceptar las credenciales. Hostinger no
> filtra ese puerto por ti.

### OpciÃ³n B â€” PostgreSQL gestionado (Neon, Supabase)

Crea el proyecto y copia la cadena de conexiÃ³n. No hay servidor que mantener.

---

## 2. Restaurar el respaldo

\`\`\`bash
psql "postgresql://directorio_user:TU_PASSWORD@IP_DEL_VPS:5432/directorio" < database/backup.sql
\`\`\`

El archivo recrea tablas, datos, Ã­ndices, claves forÃ¡neas y secuencias.
**Elimina (DROP) las tablas existentes**, asÃ­ que restÃ¡uralo Ãºnicamente sobre
una base de datos vacÃ­a.

---

## 3. Desplegar en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com): **Add New â†’ Project** e importa el repo.
3. ConfiguraciÃ³n de build:
   - Framework Preset: **Other**
   - Build Command: \`npm run build\`
   - Output Directory: \`dist/public\`
4. En **Settings â†’ Environment Variables** carga todas las variables de
   \`.env.example\` con sus valores reales.
5. **Deploy**.

---

## 4. Ejecutarlo en local

\`\`\`bash
npm install
cp .env.example .env    # y rellena los valores
npm run dev             # http://localhost:5000
\`\`\`

Para crear el esquema en una base de datos vacÃ­a sin usar el respaldo:

\`\`\`bash
npm run db:push
\`\`\`

---

## 5. Plugin de WordPress (membresÃ­as y licencias)

La carpeta \`wordpress-plugin/\` contiene la integraciÃ³n que sincroniza los
usuarios y sus membresÃ­as entre WordPress y el directorio.

1. Sube la carpeta a \`wp-content/plugins/\` y actÃ­valo desde el panel de WordPress.
2. En el plugin, configura la URL del directorio y el mismo valor de
   \`WP_SSO_SECRET\` que pusiste en Vercel. Si los secretos no coinciden, el
   auto-login falla.
3. Comprueba la integraciÃ³n desde el directorio en
   **ConfiguraciÃ³n â†’ IntegraciÃ³n WordPress**.

---

## VerificaciÃ³n final

- [ ] La pÃ¡gina principal carga
- [ ] Puedes iniciar sesiÃ³n como administrador
- [ ] Aparecen las empresas del directorio
- [ ] Se pueden subir imÃ¡genes (Cloudinary configurado)
- [ ] Las membresÃ­as/licencias muestran los planes correctos
- [ ] El auto-login desde WordPress funciona
`;
}

export interface FullExportOptions {
  /** Incluir el volcado de la base de datos dentro del ZIP. */
  includeDatabase?: boolean;
  /** Incluir el cÃ³digo fuente dentro del ZIP. */
  includeSource?: boolean;
}

interface QueryablePool {
  query(text: string, values?: any[]): Promise<{ rows: any[] }>;
}

/**
 * Construye el ZIP y lo envÃ­a por streaming a la respuesta HTTP.
 *
 * Se transmite mientras se comprime, asÃ­ que no se mantiene el paquete completo
 * en memoria. Las cabeceras se escriben antes de empezar; si algo falla a mitad
 * del stream ya no se puede cambiar el cÃ³digo de estado, por lo que el error se
 * registra y se aborta la conexiÃ³n para que el cliente no reciba un ZIP
 * truncado creyendo que estÃ¡ completo.
 */
export async function streamFullExport(
  res: Response,
  pool: QueryablePool,
  filename: string,
  options: FullExportOptions = {},
): Promise<void> {
  const includeDatabase = options.includeDatabase !== false;
  const includeSource = options.includeSource !== false;

  // El volcado SQL se genera ANTES de abrir el stream: si la base de datos
  // falla, todavÃ­a se puede responder con un error JSON limpio.
  let dump: { sql: string; tableCount: number; rowCount: number } | null = null;
  if (includeDatabase) {
    dump = await generateSqlDump(pool);
  }

  let root: string | null = null;
  let files: CollectedFile[] = [];
  if (includeSource) {
    root = resolveProjectRoot();
    if (!root) {
      throw new Error(
        "No se encontrÃ³ el cÃ³digo fuente del proyecto en este servidor. " +
          "La exportaciÃ³n del cÃ³digo solo estÃ¡ disponible desde el servidor de la aplicaciÃ³n.",
      );
    }
    files = collectProjectFiles(root);
    if (!files.length) {
      throw new Error("No se encontrÃ³ ningÃºn archivo de cÃ³digo para exportar.");
    }
  }

  const archive = archiver("zip", { zlib: { level: 9 } });

  archive.on("warning", (err: any) => {
    // ENOENT: un archivo desapareciÃ³ durante el recorrido. No es fatal.
    if (err?.code === "ENOENT") {
      console.warn("[project-export] Aviso al comprimir:", err.message);
    } else {
      archive.emit("error", err);
    }
  });

  archive.on("error", (err: any) => {
    console.error("[project-export] Error al comprimir:", err);
    // Las cabeceras ya se enviaron: cortar la conexiÃ³n es la Ãºnica forma de
    // seÃ±alar al cliente que el ZIP estÃ¡ incompleto.
    res.destroy(err);
  });

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Disposition, X-Export-Tables, X-Export-Rows, X-Export-Files",
  );
  if (dump) {
    res.setHeader("X-Export-Tables", String(dump.tableCount));
    res.setHeader("X-Export-Rows", String(dump.rowCount));
  }
  res.setHeader("X-Export-Files", String(files.length));

  archive.pipe(res);

  // 1. CÃ³digo fuente
  for (const file of files) {
    archive.file(file.absolutePath, { name: `directorio/${file.archivePath}` });
  }

  // 2. Respaldo de la base de datos
  if (dump) {
    archive.append(dump.sql, { name: "directorio/database/backup.sql" });
  }

  // 3. Plantilla de variables de entorno y guÃ­a de instalaciÃ³n
  if (includeSource) {
    archive.append(buildEnvExample(), { name: "directorio/.env.example" });
    archive.append(
      buildInstallGuide({
        generatedAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
        tableCount: dump?.tableCount ?? 0,
        rowCount: dump?.rowCount ?? 0,
      }),
      { name: "directorio/INSTALACION.md" },
    );
  }

  await archive.finalize();
}

/** Nombre sugerido: directorio-completo-2026-09-24-1530.zip */
export function buildPackageFilename(prefix = "directorio-completo", date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
  return `${prefix}-${stamp}.zip`;
}


