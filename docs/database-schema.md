# Documentación de Base de Datos - ANPR México

## Visión General del Esquema

La base de datos de ANPR México utiliza PostgreSQL como motor principal, con Drizzle ORM para la gestión de esquemas y migraciones. El diseño sigue principios de normalización para garantizar integridad referencial y eficiencia en las consultas.

## Diagrama de Relaciones Principales

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    users    │────▶│    companies    │────▶│   projects      │
└─────────────┘     └─────────────────┘     └─────────────────┘
                             │                       │
                             ▼                       ▼
                    ┌─────────────────┐     ┌─────────────────┐
                    │ membership_types│     │   categories    │
                    └─────────────────┘     └─────────────────┘
                             │                       │
                             ▼                       ▼
                    ┌─────────────────┐     ┌─────────────────┐
                    │membership_pay...|     │ certificates    │
                    └─────────────────┘     └─────────────────┘
```

## Esquemas de Tablas

### Tabla: users
**Propósito**: Gestión de usuarios del sistema (administradores y representantes)

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  firebaseUid VARCHAR(255) UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) NOT NULL,
  roleId INTEGER REFERENCES roles(id),
  stripeCustomerId VARCHAR(255),
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos Principales**:
- `id`: Identificador único interno
- `firebaseUid`: UID de Firebase para autenticación
- `email`: Email único del usuario
- `username`: Nombre de usuario para display
- `roleId`: Referencia al rol del usuario
- `stripeCustomerId`: ID del cliente en Stripe para pagos
- `isActive`: Estado del usuario (activo/inactivo)

**Relaciones**:
- `roleId` → `roles.id` (Many-to-One)
- Uno a muchos con `companies` (un usuario puede gestionar múltiples empresas)

### Tabla: companies
**Propósito**: Información principal de empresas registradas

```sql
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  nombreEmpresa VARCHAR(255) NOT NULL,
  logotipoUrl TEXT,
  telefono1 VARCHAR(20),
  telefono2 VARCHAR(20),
  email1 VARCHAR(255),
  email2 VARCHAR(255),
  paisesPresencia TEXT[],
  estadosPresencia TEXT[],
  ciudadesPresencia TEXT[],
  ubicacionPrincipal JSONB,
  direccionFisica TEXT,
  ubicacionGeografica JSONB,
  representantesVentas JSONB,
  descripcionEmpresa TEXT,
  galeriaProductosUrls TEXT[],
  categoriesIds INTEGER[],
  redesSociales JSONB,
  catalogoDigitalUrl TEXT,
  videosUrls TEXT[],
  membershipTypeId INTEGER REFERENCES membership_types(id),
  sitioWeb VARCHAR(255),
  certificateIds INTEGER[],
  membershipPeriodicidad VARCHAR(20),
  formaPago VARCHAR(50),
  fechaInicioMembresia DATE,
  fechaFinMembresia DATE,
  notasMembresia TEXT,
  userId INTEGER REFERENCES users(id),
  estado VARCHAR(20) DEFAULT 'activo',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos Principales**:
- `nombreEmpresa`: Nombre comercial de la empresa
- `logotipoUrl`: URL del logo empresarial
- `telefono1/telefono2`: Números de contacto principales
- `paisesPresencia/estadosPresencia/ciudadesPresencia`: Arrays de ubicaciones geográficas
- `ubicacionGeografica`: Coordenadas GPS en formato JSON
- `descripcionEmpresa`: Descripción detallada (HTML permitido)
- `galeriaProductosUrls`: Array de URLs de imágenes
- `categoriesIds`: Array de IDs de categorías
- `membershipTypeId`: Tipo de membresía actual
- `certificateIds`: Array de IDs de certificaciones

**Relaciones**:
- `membershipTypeId` → `membership_types.id` (Many-to-One)
- `userId` → `users.id` (Many-to-One)
- `categoriesIds` → `categories.id[]` (Many-to-Many vía array)
- `certificateIds` → `certificates.id[]` (Many-to-Many vía array)

### Tabla: categories
**Propósito**: Categorización de empresas y servicios

```sql
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  nombreCategoria VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  icono VARCHAR(50),
  iconoUrl TEXT,
  activo BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos Principales**:
- `nombreCategoria`: Nombre único de la categoría
- `descripcion`: Descripción detallada opcional
- `icono`: Nombre de icono de Lucide (si aplica)
- `iconoUrl`: URL de icono personalizado
- `activo`: Estado de la categoría

**Datos de Ejemplo**:
- Mobiliario Urbano
- Iluminación Pública
- Señalización Vial
- Consultoría de Infraestructura

### Tabla: membership_types
**Propósito**: Definición de planes de membresía

```sql
CREATE TABLE membership_types (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2),
  caracteristicas JSONB,
  limiteProjetos INTEGER,
  limiteImagenes INTEGER,
  destacado BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos Principales**:
- `nombre`: Nombre del plan (Básico, Profesional, Premium)
- `precio`: Costo mensual/anual del plan
- `caracteristicas`: JSON con lista de características incluidas
- `limiteProjetos`: Número máximo de proyectos permitidos
- `limiteImagenes`: Número máximo de imágenes por proyecto
- `destacado`: Si el plan debe mostrarse como recomendado

### Tabla: projects
**Propósito**: Portafolio de proyectos de las empresas

```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  companyId INTEGER NOT NULL REFERENCES companies(id),
  categoryId INTEGER REFERENCES categories(id),
  imagenesUrls TEXT[],
  videosUrls TEXT[],
  fechaInicio DATE,
  fechaFin DATE,
  ubicacion VARCHAR(255),
  clienteProyecto VARCHAR(255),
  montoInversion DECIMAL(12,2),
  estado VARCHAR(20) DEFAULT 'activo',
  estadoModeracion VARCHAR(20) DEFAULT 'pendiente',
  vistas INTEGER DEFAULT 0,
  consultas INTEGER DEFAULT 0,
  orden INTEGER DEFAULT 0,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Campos Principales**:
- `nombre`: Título del proyecto
- `descripcion`: Descripción detallada con HTML
- `companyId`: Empresa propietaria del proyecto
- `categoryId`: Categoría del proyecto
- `imagenesUrls`: Array de URLs de imágenes del proyecto
- `estadoModeracion`: Estado de aprobación (pendiente/aprobado/rechazado)
- `vistas/consultas`: Métricas de engagement

**Relaciones**:
- `companyId` → `companies.id` (Many-to-One)
- `categoryId` → `categories.id` (Many-to-One)

### Tabla: certificates
**Propósito**: Catálogo de certificaciones disponibles

```sql
CREATE TABLE certificates (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  entidadEmisora VARCHAR(255),
  tipoDocumento VARCHAR(50),
  vigencia INTEGER, -- meses de validez
  iconoUrl TEXT,
  activo BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: opinions
**Propósito**: Sistema de reseñas y opiniones

```sql
CREATE TABLE opinions (
  id SERIAL PRIMARY KEY,
  companyId INTEGER NOT NULL REFERENCES companies(id),
  nombreCliente VARCHAR(255) NOT NULL,
  emailCliente VARCHAR(255),
  calificacion INTEGER CHECK (calificacion >= 1 AND calificacion <= 5),
  comentario TEXT,
  proyectoRelacionado VARCHAR(255),
  estado VARCHAR(20) DEFAULT 'pendiente',
  moderadoPor INTEGER REFERENCES users(id),
  fechaModeracion TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: membership_payments
**Propósito**: Historial de pagos de membresías

```sql
CREATE TABLE membership_payments (
  id SERIAL PRIMARY KEY,
  userId INTEGER NOT NULL REFERENCES users(id),
  membershipTypeId INTEGER NOT NULL REFERENCES membership_types(id),
  monto DECIMAL(10,2) NOT NULL,
  moneda VARCHAR(3) DEFAULT 'MXN',
  stripePaymentIntentId VARCHAR(255),
  estado VARCHAR(20) DEFAULT 'pendiente',
  fechaPago TIMESTAMP,
  metodoPago VARCHAR(50),
  datosFacturacion JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla: roles
**Propósito**: Control de roles y permisos

```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  descripcion TEXT,
  permisos JSONB,
  activo BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Roles Predefinidos**:
- `admin`: Administrador del sistema
- `representative`: Representante de empresa
- `moderator`: Moderador de contenido

### Tabla: system_settings
**Propósito**: Configuraciones globales del sistema

```sql
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  clave VARCHAR(100) NOT NULL UNIQUE,
  valor TEXT,
  tipo VARCHAR(20) DEFAULT 'string',
  descripcion TEXT,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Índices Principales

### Índices de Performance
```sql
-- Búsquedas frecuentes en empresas
CREATE INDEX idx_companies_nombre ON companies USING gin(to_tsvector('spanish', nombreEmpresa));
CREATE INDEX idx_companies_estado ON companies(estado);
CREATE INDEX idx_companies_membership ON companies(membershipTypeId);
CREATE INDEX idx_companies_categories ON companies USING gin(categoriesIds);

-- Geolocalización
CREATE INDEX idx_companies_estados ON companies USING gin(estadosPresencia);
CREATE INDEX idx_companies_ciudades ON companies USING gin(ciudadesPresencia);

-- Proyectos
CREATE INDEX idx_projects_company ON projects(companyId);
CREATE INDEX idx_projects_category ON projects(categoryId);
CREATE INDEX idx_projects_estado ON projects(estado, estadoModeracion);

-- Usuarios y autenticación
CREATE INDEX idx_users_firebase ON users(firebaseUid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(isActive);

-- Pagos y membresías
CREATE INDEX idx_payments_user ON membership_payments(userId);
CREATE INDEX idx_payments_stripe ON membership_payments(stripePaymentIntentId);
CREATE INDEX idx_payments_fecha ON membership_payments(fechaPago);

-- Opiniones
CREATE INDEX idx_opinions_company ON opinions(companyId);
CREATE INDEX idx_opinions_estado ON opinions(estado);
```

### Índices de Texto Completo
```sql
-- Búsqueda de texto en empresas
CREATE INDEX idx_companies_fulltext ON companies 
USING gin(to_tsvector('spanish', nombreEmpresa || ' ' || COALESCE(descripcionEmpresa, '')));

-- Búsqueda en proyectos
CREATE INDEX idx_projects_fulltext ON projects 
USING gin(to_tsvector('spanish', nombre || ' ' || COALESCE(descripcion, '')));
```

## Constraints y Validaciones

### Constraints de Integridad
```sql
-- Estados válidos para empresas
ALTER TABLE companies ADD CONSTRAINT chk_company_estado 
CHECK (estado IN ('activo', 'inactivo', 'pendiente', 'suspendido'));

-- Estados de moderación para proyectos
ALTER TABLE projects ADD CONSTRAINT chk_project_moderacion 
CHECK (estadoModeracion IN ('pendiente', 'aprobado', 'rechazado'));

-- Calificaciones válidas en opiniones
ALTER TABLE opinions ADD CONSTRAINT chk_opinion_calificacion 
CHECK (calificacion >= 1 AND calificacion <= 5);

-- Emails válidos
ALTER TABLE users ADD CONSTRAINT chk_user_email 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Precios no negativos
ALTER TABLE membership_types ADD CONSTRAINT chk_membership_precio 
CHECK (precio >= 0);
```

### Triggers para Auditoría
```sql
-- Actualización automática de timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updatedAt = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar a todas las tablas relevantes
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Tipos de Datos JSON

### ubicacionGeografica (companies)
```json
{
  "lat": 19.432608,
  "lng": -99.133209,
  "address": "Ciudad de México, CDMX, México",
  "formatted_address": "Ciudad de México, CDMX, México"
}
```

### redesSociales (companies)
```json
{
  "facebook": "https://facebook.com/empresa",
  "instagram": "https://instagram.com/empresa",
  "linkedin": "https://linkedin.com/company/empresa",
  "twitter": "https://twitter.com/empresa",
  "youtube": "https://youtube.com/empresa"
}
```

### representantesVentas (companies)
```json
[
  {
    "nombre": "Juan Pérez",
    "cargo": "Director Comercial",
    "telefono": "+52 555 123 4567",
    "email": "juan.perez@empresa.com",
    "region": "Norte"
  }
]
```

### caracteristicas (membership_types)
```json
{
  "proyectos_maximos": 5,
  "imagenes_por_proyecto": 10,
  "videos_incluidos": true,
  "catalogo_digital": true,
  "posicionamiento_premium": false,
  "soporte_prioritario": true,
  "estadisticas_avanzadas": false
}
```

## Estrategias de Backup

### Backup Diario
```bash
# Backup completo diario
pg_dump -h localhost -U postgres -d anpr_db -f backup_$(date +%Y%m%d).sql

# Backup comprimido
pg_dump -h localhost -U postgres -d anpr_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Backup Incremental
```bash
# Configurar WAL archiving para backups incrementales
# En postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = 'cp %p /path/to/archive/%f'
```

### Restauración
```bash
# Restaurar desde backup
psql -h localhost -U postgres -d anpr_db_new < backup_20240101.sql

# Restaurar con cleanup
dropdb anpr_db_old
createdb anpr_db_new
psql -h localhost -U postgres -d anpr_db_new < backup_20240101.sql
```

## Migraciones con Drizzle

### Estructura de Migraciones
```typescript
// Generar migración desde cambios en schema
npm run db:generate

// Aplicar migraciones pendientes
npm run db:migrate

// Ver estado de migraciones
npm run db:studio
```

### Ejemplo de Migración
```sql
-- 0001_initial_schema.sql
CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "firebaseUid" varchar(255),
  "email" varchar(255) NOT NULL,
  "username" varchar(100) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_firebase_uid_unique" ON "users" ("firebaseUid");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");
```

## Monitoreo y Mantenimiento

### Consultas de Monitoreo
```sql
-- Tamaño de tablas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::text)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::text) DESC;

-- Actividad de conexiones
SELECT 
  datname,
  numbackends,
  xact_commit,
  xact_rollback
FROM pg_stat_database 
WHERE datname = 'anpr_db';

-- Queries lentas
SELECT 
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
```

### Mantenimiento Rutinario
```sql
-- Análisis de estadísticas
ANALYZE;

-- Vacuum para recuperar espacio
VACUUM ANALYZE;

-- Reindexación periódica
REINDEX DATABASE anpr_db;
```

## Consideraciones de Seguridad

### Acceso a Datos
- Conexiones cifradas (SSL/TLS requerido)
- Autenticación por certificados en producción
- Principio de menor privilegio para roles de BD
- Auditoría de accesos administrativos

### Protección de Datos Sensibles
- Contraseñas hasheadas (nunca en texto plano)
- Información de pago tokenizada vía Stripe
- Logs de aplicación sin datos sensibles
- Backups encriptados en reposo

### Compliance
- Cumplimiento con LFPDPPP (Ley Federal de Protección de Datos)
- Políticas de retención de datos
- Derecho al olvido (eliminación de datos)
- Registro de procesamiento de datos personales

Esta documentación de base de datos proporciona una referencia completa para desarrolladores y administradores del sistema ANPR México.