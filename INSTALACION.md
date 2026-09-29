# Instalación del Directorio de Proveedores

Paquete generado el **2026-09-28 23:27 UTC**.
Incluye el código fuente completo y un respaldo de la base de datos con
**21 tablas** y **139 registros** (usuarios,
empresas, membresías/licencias, pagos, reseñas y configuración).

---

## Contenido del paquete

| Ruta | Qué es |
|------|--------|
| `client/` | Aplicación React (panel de administración y directorio público) |
| `server/` | Servidor Express para Node (desarrollo y hosting tradicional) |
| `api/index.ts` | Misma API empaquetada como función serverless de Vercel |
| `shared/schema.ts` | Esquema de la base de datos (Drizzle ORM) |
| `migrations/` | Migraciones SQL |
| `wordpress-plugin/` | Plugin de WordPress: SSO y sincronización de membresías |
| `database/backup.sql` | **Respaldo completo de la base de datos** |
| `.env.example` | Plantilla de variables de entorno |

> El paquete **no** incluye `node_modules`, el archivo `.env` con tus
> secretos reales, ni las imágenes subidas por los usuarios (esas viven en
> Cloudinary).

---

## 1. Crear la base de datos PostgreSQL

### Opción A — VPS de Hostinger (control total)

Conéctate por SSH a tu VPS y ejecuta:

```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib

# Crear usuario y base de datos
sudo -u postgres psql <<'SQL'
CREATE USER directorio_user WITH PASSWORD 'CAMBIA_ESTA_PASSWORD';
CREATE DATABASE directorio OWNER directorio_user;
GRANT ALL PRIVILEGES ON DATABASE directorio TO directorio_user;
SQL
```

Permite conexiones remotas (Vercel se conecta desde fuera):

```bash
# postgresql.conf -> escuchar en todas las interfaces
sudo sed -i "s/^#\?listen_addresses.*/listen_addresses = '*'/" /etc/postgresql/*/main/postgresql.conf

# pg_hba.conf -> exigir contraseña cifrada en conexiones remotas
echo "hostssl all all 0.0.0.0/0 scram-sha-256" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf

sudo systemctl restart postgresql
sudo ufw allow 5432/tcp
```

> **Importante:** activa SSL en PostgreSQL antes de abrir el puerto 5432 a
> Internet, o cualquiera podrá interceptar las credenciales. Hostinger no
> filtra ese puerto por ti.

### Opción B — PostgreSQL gestionado (Neon, Supabase)

Crea el proyecto y copia la cadena de conexión. No hay servidor que mantener.

---

## 2. Restaurar el respaldo

```bash
psql "postgresql://directorio_user:TU_PASSWORD@IP_DEL_VPS:5432/directorio" < database/backup.sql
```

El archivo recrea tablas, datos, índices, claves foráneas y secuencias.
**Elimina (DROP) las tablas existentes**, así que restáuralo únicamente sobre
una base de datos vacía.

---

## 3. Desplegar en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com): **Add New → Project** e importa el repo.
3. Configuración de build:
   - Framework Preset: **Other**
   - Build Command: `npm run build`
   - Output Directory: `dist/public`
4. En **Settings → Environment Variables** carga todas las variables de
   `.env.example` con sus valores reales.
5. **Deploy**.

---

## 4. Ejecutarlo en local

```bash
npm install
cp .env.example .env    # y rellena los valores
npm run dev             # http://localhost:5000
```

Para crear el esquema en una base de datos vacía sin usar el respaldo:

```bash
npm run db:push
```

---

## 5. Plugin de WordPress (membresías y licencias)

La carpeta `wordpress-plugin/` contiene la integración que sincroniza los
usuarios y sus membresías entre WordPress y el directorio.

1. Sube la carpeta a `wp-content/plugins/` y actívalo desde el panel de WordPress.
2. En el plugin, configura la URL del directorio y el mismo valor de
   `WP_SSO_SECRET` que pusiste en Vercel. Si los secretos no coinciden, el
   auto-login falla.
3. Comprueba la integración desde el directorio en
   **Configuración → Integración WordPress**.

---

## Verificación final

- [ ] La página principal carga
- [ ] Puedes iniciar sesión como administrador
- [ ] Aparecen las empresas del directorio
- [ ] Se pueden subir imágenes (Cloudinary configurado)
- [ ] Las membresías/licencias muestran los planes correctos
- [ ] El auto-login desde WordPress funciona
