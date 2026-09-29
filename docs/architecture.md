# Guía de Arquitectura - ANPR México

## Visión General de la Arquitectura

ANPR México sigue una arquitectura de aplicación web full-stack moderna con separación clara entre frontend y backend, implementando patrones de diseño escalables y mantenibles.

## Arquitectura del Sistema

### Diagrama de Alto Nivel

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend     │    │   Base de Datos │
│   (React/Vite)  │◄──►│  (Express/Node) │◄──►│  (PostgreSQL)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Servicios       │    │ APIs Externas   │    │ Almacenamiento  │
│ Externos        │    │ - Stripe        │    │ de Archivos     │
│ - Firebase      │    │ - Google Maps   │    │ - /uploads      │
│ - TinyMCE       │    │ - TinyMCE       │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Arquitectura Frontend

### Estructura de Componentes

```
client/src/
├── components/          # Componentes reutilizables
│   ├── ui/             # Componentes base (shadcn/ui)
│   ├── forms/          # Componentes de formularios
│   ├── modals/         # Modales y dialogs
│   └── layout/         # Componentes de layout
├── pages/              # Páginas de la aplicación
├── hooks/              # Custom hooks de React
├── lib/                # Utilidades y configuraciones
└── types/              # Definiciones de tipos TypeScript
```

### Patrones de Diseño Frontend

#### 1. **Compound Component Pattern**
- Utilizado en componentes complejos como formularios
- Permite composición flexible de elementos UI

#### 2. **Custom Hooks Pattern**
- `useAuth` - Manejo de autenticación
- `useToast` - Sistema de notificaciones
- `useLocalStorage` - Persistencia local

#### 3. **Container/Presentational Pattern**
- Separación entre lógica de negocio y presentación
- Componentes contenedores manejan estado y lógica
- Componentes presentacionales solo renderizan UI

### Gestión de Estado

#### Estado del Servidor (TanStack Query)
```typescript
// Queries para datos del servidor
const { data: companies } = useQuery({
  queryKey: ['/api/companies'],
  queryFn: fetchCompanies
});

// Mutaciones para operaciones de escritura
const mutation = useMutation({
  mutationFn: createCompany,
  onSuccess: () => {
    queryClient.invalidateQueries(['/api/companies']);
  }
});
```

#### Estado Local (React useState/useReducer)
- Estados de formularios
- Estados de UI (modales, loading, etc.)
- Preferencias de usuario temporales

### Routing Strategy

```typescript
// Routing con Wouter
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/directorio" component={Directory} />
      <Route path="/empresa/:id" component={CompanyDetails} />
      <Route path="/dashboard" component={Dashboard} />
    </Switch>
  );
}
```

## Arquitectura Backend

### Estructura en Capas

```
server/
├── routes.ts           # Capa de rutas (Controllers)
├── storage.ts          # Capa de acceso a datos (DAL)
├── db.ts              # Configuración de base de datos
└── middleware/        # Middlewares personalizados
```

### Patrón Repository

```typescript
// Interface de abstracción
export interface IStorage {
  getCompany(id: number): Promise<Company | undefined>;
  getAllCompanies(options?: CompanyFilters): Promise<CompanyList>;
  createCompany(company: InsertCompany): Promise<Company>;
}

// Implementación concreta
export class DatabaseStorage implements IStorage {
  async getCompany(id: number): Promise<Company | undefined> {
    // Implementación con Drizzle ORM
  }
}
```

### Middleware Pipeline

```typescript
app.use(express.json());           // Parsing JSON
app.use(express.static());         // Archivos estáticos
app.use(sessionMiddleware);        // Gestión de sesiones
app.use(authMiddleware);           // Autenticación
app.use(errorHandler);             // Manejo de errores
```

## Arquitectura de Base de Datos

### Patrón de Esquema

```typescript
// Definición con Drizzle
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  nombreEmpresa: varchar("nombre_empresa", { length: 255 }).notNull(),
  // ... otros campos
});

// Relaciones
export const companiesRelations = relations(companies, ({ one, many }) => ({
  membershipType: one(membershipTypes),
  categories: many(categories),
  projects: many(projects),
}));
```

### Estrategia de Migraciones

- Migraciones versionadas con Drizzle Kit
- Rollback automático en caso de errores
- Validación de esquema antes de aplicar cambios

## Patrones de Diseño Implementados

### 1. **Model-View-Controller (MVC)**
- **Model**: Esquemas de Drizzle y tipos TypeScript
- **View**: Componentes React
- **Controller**: Rutas de Express

### 2. **Data Access Object (DAO)**
- Abstracción de acceso a datos en `storage.ts`
- Interface común para diferentes fuentes de datos
- Facilita testing y mantenimiento

### 3. **Factory Pattern**
- Creación de instancias de storage
- Configuración de clientes de API externos
- Inicialización de servicios

### 4. **Observer Pattern**
- Sistema de eventos con TanStack Query
- Invalidación automática de cache
- Actualizaciones reactivas de UI

### 5. **Command Pattern**
- Mutaciones como comandos encapsulados
- Operaciones reversibles (undo/redo potential)
- Logging y auditoría de acciones

## Flujo de Datos

### Flujo de Lectura (Query)
```
Component → useQuery → API Call → Database → Response → Cache → UI Update
```

### Flujo de Escritura (Mutation)
```
User Action → Form Submit → useMutation → API Call → Database → 
Response → Cache Invalidation → Refetch → UI Update
```

### Manejo de Estados

```typescript
// Estados de carga
const { data, isLoading, error } = useQuery(...);

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
return <DataComponent data={data} />;
```

## Decisiones Arquitectónicas Importantes

### 1. **Single Page Application (SPA)**
- **Decisión**: Usar React SPA en lugar de SSR
- **Razón**: Mayor interactividad, mejor UX para dashboard
- **Trade-off**: SEO inicial vs. experiencia de usuario

### 2. **Monorepo vs. Separación**
- **Decisión**: Frontend y backend en mismo repositorio
- **Razón**: Facilita desarrollo y deployment
- **Beneficio**: Shared types y código común

### 3. **ORM vs. Query Builder**
- **Decisión**: Drizzle ORM
- **Razón**: Type safety, performance, flexibilidad
- **Alternativa considerada**: Prisma (menos flexible)

### 4. **State Management**
- **Decisión**: TanStack Query + React State
- **Razón**: Server state vs. client state separation
- **Alternativa**: Redux (overkill para este proyecto)

### 5. **Autenticación**
- **Decisión**: Firebase Auth
- **Razón**: Manejo robusto, escalabilidad, providers múltiples
- **Beneficio**: Seguridad enterprise-grade

## Escalabilidad y Performance

### Frontend Optimizations
- Code splitting por rutas
- Lazy loading de componentes pesados
- Memoización con React.memo y useMemo
- Optimistic updates para mejor UX

### Backend Optimizations
- Connection pooling para PostgreSQL
- Pagination en queries grandes
- Caching con Redis (futuro)
- Rate limiting para APIs

### Database Optimizations
- Índices en campos de búsqueda frecuente
- Foreign keys para integridad referencial
- Partitioning para tablas grandes (futuro)

## Consideraciones de Seguridad

### Frontend Security
- Sanitización de inputs
- Validación con Zod schemas
- Secure token storage
- HTTPS only en producción

### Backend Security
- Input validation en todas las rutas
- SQL injection prevention con ORM
- Session security
- File upload restrictions

### Database Security
- Role-based access control
- Encrypted connections
- Regular security updates
- Backup encryption

## Monitoreo y Logging

### Error Tracking
- Error boundaries en React
- Centralized error handling en backend
- User-friendly error messages
- Development vs. production error levels

### Performance Monitoring
- Query performance tracking
- API response times
- Database connection monitoring
- Frontend bundle size tracking

## Futuras Mejoras Arquitectónicas

### Microservicios (Consideración Futura)
- Separación de servicios por dominio
- API Gateway para routing
- Service discovery
- Containerización con Docker

### Caching Strategy
- Redis para session storage
- CDN para assets estáticos
- Application-level caching
- Database query caching

### Real-time Features
- WebSocket implementation
- Real-time notifications
- Live updates para dashboard
- Collaborative editing

Esta arquitectura proporciona una base sólida, escalable y mantenible para el crecimiento futuro de ANPR México.