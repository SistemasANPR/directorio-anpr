# Guía de Despliegue en Vercel - ANPR México

## Opciones de Base de Datos

La aplicación usa **PostgreSQL**. Tienes estas opciones:

### Opción 1: Neon (RECOMENDADO - Gratis)
- **Gratis** hasta 0.5 GB de almacenamiento
- Compatible al 100% con el código existente
- Sin necesidad de cambios
- URL: [neon.tech](https://neon.tech)

### Opción 2: Supabase (Gratis)
- **Gratis** con límites generosos
- PostgreSQL completo
- URL: [supabase.com](https://supabase.com)

### Opción 3: Railway (Barato)
- $5/mes aproximadamente
- PostgreSQL gestionado
- URL: [railway.app](https://railway.app)

### Opción 4: Hostinger MySQL (NO RECOMENDADO)
⚠️ **Requiere reescribir gran parte del código**
- La app está construida para PostgreSQL
- Migrar a MySQL toma mucho tiempo y tiene riesgos

---

## Paso 1: Crear Base de Datos en Neon (Gratis)

1. Ve a [neon.tech](https://neon.tech) y crea una cuenta
2. Click en **"Create Project"**
3. Elige un nombre para tu proyecto (ej: `anpr-mexico`)
4. Selecciona la región más cercana a México: `US West (Oregon)`
5. Click en **"Create Project"**
6. Una vez creado, ve a **"Dashboard"** → **"Connection Details"**
7. Copia la **Connection String** (empieza con `postgresql://...`)

Tu URL se verá así:
```
postgresql://neondb_owner:abc123@ep-example.us-west-2.aws.neon.tech/neondb?sslmode=require
```

---

## Paso 2: Crear Cuenta en Cloudinary

1. Ve a [cloudinary.com](https://cloudinary.com) y crea una cuenta gratuita
2. Una vez registrado, ve al **Dashboard**
3. Anota los siguientes datos:
   - **Cloud Name**: tu nombre de cloud (ej: `dxxx1234`)
   - **API Key**: tu clave API
   - **API Secret**: tu secreto API

---

## Paso 3: Subir el Proyecto a GitHub

1. Crea un repositorio en GitHub
2. Sube tu código:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

---

## Paso 4: Conectar con Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub
2. Click en **"Add New..."** → **"Project"**
3. Selecciona tu repositorio
4. Configura el proyecto:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist/public`

---

## Paso 5: Configurar Variables de Entorno en Vercel

En **Environment Variables**, agrega TODAS estas:

### Base de Datos (OBLIGATORIO)
| Variable | Valor |
|----------|-------|
| `DATABASE_URL` | Tu URL de Neon (postgresql://...) |

### Cloudinary (OBLIGATORIO para uploads)
| Variable | Valor |
|----------|-------|
| `CLOUDINARY_CLOUD_NAME` | Tu Cloud Name |
| `CLOUDINARY_API_KEY` | Tu API Key |
| `CLOUDINARY_API_SECRET` | Tu API Secret |

### Stripe (para pagos)
| Variable | Valor |
|----------|-------|
| `STRIPE_SECRET_KEY` | sk_live_... o sk_test_... |
| `STRIPE_PUBLISHABLE_KEY` | pk_live_... o pk_test_... |
| `VITE_STRIPE_PUBLISHABLE_KEY` | (igual que arriba) |

### Firebase (para autenticación)
| Variable | Valor |
|----------|-------|
| `VITE_FIREBASE_API_KEY` | Tu API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | tu-proyecto.firebaseapp.com |
| `VITE_FIREBASE_PROJECT_ID` | tu-proyecto |

### Google Maps (para mapas)
| Variable | Valor |
|----------|-------|
| `VITE_GOOGLE_MAPS_API_KEY` | Tu API key |

### General
| Variable | Valor |
|----------|-------|
| `NODE_ENV` | production |

---

## Paso 6: Migrar la Base de Datos

Después de configurar Vercel, necesitas crear las tablas en Neon.

### Opción A: Desde Replit (más fácil)
1. En Replit, abre la terminal (Shell)
2. Configura temporalmente la URL de Neon:
```bash
export DATABASE_URL="tu-url-de-neon-aqui"
```
3. Ejecuta la migración:
```bash
npm run db:push
```

### Opción B: Importar datos existentes
Si tienes datos en Replit que quieres conservar:

1. Exporta los datos de Replit:
```bash
pg_dump $DATABASE_URL --no-owner --no-acl > backup.sql
```

2. Importa en Neon usando su consola SQL o:
```bash
psql "tu-url-de-neon" < backup.sql
```

---

## Paso 7: Desplegar

1. Click en **"Deploy"** en Vercel
2. Espera 2-5 minutos
3. Tu app estará en `tu-proyecto.vercel.app`

---

## Verificación Final

Comprueba que funciona:
- ✅ Página principal carga
- ✅ Puedes iniciar sesión
- ✅ Las empresas aparecen
- ✅ Puedes subir imágenes
- ✅ El mapa funciona

---

## Solución de Problemas

### Error de Base de Datos
- Verifica que `DATABASE_URL` esté correcta
- Asegúrate de incluir `?sslmode=require` al final

### Las imágenes no suben
- Verifica las 3 variables de Cloudinary
- Revisa los logs en Vercel

### Error 500 en APIs
- Ve a Vercel → Tu proyecto → Deployments → Functions → Logs

### La página no carga
- Verifica que `vercel.json` esté en la raíz del proyecto
- Revisa que `api/index.ts` exista

---

## Dominio Personalizado (Opcional)

1. En Vercel, ve a **Settings** → **Domains**
2. Agrega tu dominio (ej: `directorio.anpr.org.mx`)
3. Configura los DNS de tu dominio:
   - Tipo: CNAME
   - Nombre: @ o www
   - Valor: cname.vercel-dns.com

---

## Costos Estimados

| Servicio | Costo |
|----------|-------|
| Vercel | Gratis (hobby) o $20/mes (pro) |
| Neon (PostgreSQL) | Gratis hasta 0.5GB |
| Cloudinary | Gratis hasta 25GB de bandwidth |
| Firebase Auth | Gratis hasta 50k usuarios |
| **Total mínimo** | **$0/mes** |

---

## Soporte

Si tienes problemas:
1. Revisa los logs en Vercel
2. Verifica las variables de entorno
3. Asegúrate de que la base de datos esté migrada
