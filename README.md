# ANPR México - Directorio de Proveedores de Equipamiento Urbano

## Descripción del Proyecto

El Directorio de Proveedores de Equipamiento Urbano es una plataforma web integral de administración empresarial que ofrece un directorio inteligente de proveedores con funcionalidades avanzadas de geolocalización, gestión de membresías y perfiles corporativos detallados.

### Características Principales

- 🏢 **Directorio Empresarial Inteligente**: Búsqueda avanzada por categorías, ubicación y servicios
- 🗺️ **Geolocalización Avanzada**: Integración con mapas interactivos usando Leaflet
- 💳 **Sistema de Membresías**: Planes diferenciados con procesamiento de pagos via Stripe
- 🔐 **Autenticación Segura**: Sistema robusto con Firebase Authentication
- 📊 **Panel Administrativo**: Control total de usuarios, empresas y contenido
- 🎨 **Portafolio de Proyectos**: Gestión completa de proyectos empresariales con galerías
- 📱 **Diseño Responsivo**: Optimizado para todos los dispositivos

## Stack Tecnológico

### Frontend
- **React 18** con TypeScript
- **Vite** como bundler y servidor de desarrollo
- **Tailwind CSS** para estilos responsivos
- **shadcn/ui** como sistema de componentes
- **Wouter** para enrutamiento
- **TanStack Query** para manejo de estado del servidor
- **React Hook Form** con validación Zod

### Backend
- **Node.js** con Express
- **TypeScript** para tipado fuerte
- **PostgreSQL** como base de datos principal
- **Drizzle ORM** para manejo de base de datos
- **Multer** para carga de archivos
- **Express Session** para manejo de sesiones

### Servicios Externos
- **Firebase Authentication** para autenticación de usuarios
- **Stripe** para procesamiento de pagos
- **Google Maps API** para servicios de mapas
- **TinyMCE** para editor de texto enriquecido

### Herramientas de Desarrollo
- **ESLint** y **Prettier** para calidad de código
- **Drizzle Kit** para migraciones de base de datos
- **TypeScript** para desarrollo type-safe

## Requisitos del Sistema

### Requisitos Mínimos
- **Node.js** 18.0 o superior
- **PostgreSQL** 14.0 o superior
- **npm** 8.0 o superior

### Variables de Entorno Requeridas

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Base de Datos
DATABASE_URL=postgresql://username:password@localhost:5432/anpr_db
PGHOST=localhost
PGPORT=5432
PGUSER=username
PGPASSWORD=password
PGDATABASE=anpr_db

# Firebase Authentication
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# Stripe Payments
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# TinyMCE Editor
TINYMCE_API_KEY=your_tinymce_api_key
VITE_TINYMCE_API_KEY=your_tinymce_api_key
```

## Instalación y Configuración

### 1. Clonación del Repositorio
```bash
git clone https://github.com/your-org/anpr-mexico.git
cd anpr-mexico
```

### 2. Instalación de Dependencias
```bash
npm install
```

### 3. Configuración de Base de Datos
```bash
# Crear la base de datos PostgreSQL
createdb anpr_db

# Ejecutar migraciones
npm run db:migrate

# (Opcional) Ejecutar seeders para datos de prueba
npm run db:seed
```

### 4. Configuración de Variables de Entorno
- Copia el archivo `.env.example` a `.env`
- Completa todas las variables de entorno requeridas

### 5. Ejecución en Desarrollo
```bash
# Iniciar servidor de desarrollo
npm run dev

# La aplicación estará disponible en http://localhost:5000
```

## Comandos Principales

### Desarrollo
```bash
npm run dev          # Inicia servidor de desarrollo
npm run build        # Construye la aplicación para producción
npm run preview      # Preview de la build de producción
```

### Base de Datos
```bash
npm run db:generate  # Genera migraciones basadas en cambios de schema
npm run db:migrate   # Ejecuta migraciones pendientes
npm run db:studio    # Abre Drizzle Studio para explorar la BD
npm run db:seed      # Ejecuta seeders de datos de prueba
```

### Calidad de Código
```bash
npm run lint         # Ejecuta ESLint
npm run lint:fix     # Ejecuta ESLint con auto-fix
npm run type-check   # Verifica tipos con TypeScript
```

## Estructura del Proyecto

```
anpr-mexico/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── hooks/          # Custom hooks
│   │   ├── lib/            # Utilidades y configuraciones
│   │   ├── pages/          # Páginas de la aplicación
│   │   └── index.css       # Estilos globales
├── server/                 # Backend Express
│   ├── db.ts              # Configuración de base de datos
│   ├── index.ts           # Punto de entrada del servidor
│   ├── routes.ts          # Definición de rutas API
│   ├── storage.ts         # Capa de acceso a datos
│   └── vite.ts            # Configuración de Vite para SSR
├── shared/                 # Código compartido
│   └── schema.ts          # Esquemas de base de datos y validación
├── uploads/               # Archivos subidos por usuarios
├── docs/                  # Documentación del proyecto
└── package.json           # Dependencias y scripts
```

## URLs Principales

### Frontend (Público)
- `/` - Página principal con directorio
- `/directorio` - Vista completa del directorio
- `/empresa/:id` - Detalles de empresa
- `/planes` - Planes de membresía

### Panel Administrativo
- `/dashboard` - Dashboard principal
- `/empresas` - Gestión de empresas
- `/usuarios` - Gestión de usuarios
- `/categorias` - Gestión de categorías
- `/membresias` - Gestión de membresías

## Contribución

### Flujo de Desarrollo
1. Crear feature branch desde `main`
2. Implementar cambios siguiendo las convenciones
3. Ejecutar tests y verificar linting
4. Crear Pull Request con descripción detallada

### Convenciones de Código
- Usar TypeScript para todo el código nuevo
- Seguir las reglas de ESLint configuradas
- Componentes en PascalCase
- Archivos de utilidades en camelCase
- Commits descriptivos en español

## Soporte y Contacto

Para reportar bugs o solicitar nuevas funcionalidades, crear un issue en el repositorio o contactar al equipo de desarrollo.

## Licencia

Este proyecto está bajo licencia MIT. Ver archivo `LICENSE` para más detalles.

---

**ANPR México** - Conectando la industria mexicana 🇲🇽