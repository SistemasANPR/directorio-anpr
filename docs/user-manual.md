# Manual de Usuario - Directorio de Proveedores de Equipamiento Urbano

## Introducción

El Directorio de Proveedores de Equipamiento Urbano es una plataforma integral que conecta empresas y facilita la búsqueda de proveedores especializados. Este manual cubre todas las funcionalidades disponibles para los diferentes tipos de usuarios.

## Tipos de Usuario

### 1. **Visitantes (Público General)**
- Búsqueda y exploración del directorio
- Visualización de perfiles de empresas
- Acceso a información de contacto
- Consulta de proyectos y portafolios

### 2. **Representantes de Empresas**
- Gestión completa del perfil empresarial
- Administración de proyectos y portafolios
- Control de membresía y pagos
- Gestión de opiniones y reseñas

### 3. **Administradores del Sistema**
- Control total de usuarios y empresas
- Gestión de categorías y certificaciones
- Moderación de contenido
- Análisis y reportes del sistema

---

## Guía para Visitantes

### Navegación Principal

#### Página de Inicio
- **Búsqueda Rápida**: Utiliza la barra de búsqueda principal para encontrar empresas por nombre o servicios
- **Filtros por Categoría**: Selecciona categorías específicas como "Mobiliario Urbano", "Iluminación", etc.
- **Filtros por Ubicación**: Filtra empresas por estados donde tienen presencia
- **Empresas Destacadas**: Visualiza un carrusel con las empresas más relevantes

#### Directorio Completo (`/directorio`)
- **Vista de Lista**: Explora todas las empresas registradas
- **Filtros Avanzados**: Combina múltiples criterios de búsqueda
- **Mapa Interactivo**: Visualiza ubicaciones de empresas en el mapa
- **Resultados Paginados**: Navega a través de múltiples páginas de resultados

### Perfiles de Empresas

#### Información General
- **Datos de Contacto**: Teléfonos, emails, dirección física
- **Descripción**: Información detallada sobre la empresa y sus servicios
- **Categorías**: Áreas de especialización
- **Certificaciones**: Certificados y acreditaciones
- **Membresía**: Tipo de plan activo

#### Portafolio de Proyectos
- **Galería de Proyectos**: Visualiza hasta 5 proyectos destacados por empresa
- **Detalles del Proyecto**: 
  - Nombre y descripción completa
  - Galería de imágenes
  - Videos demostrativos
  - Categoría del proyecto
  - Estado (activo/inactivo)

#### Ubicaciones y Presencia
- **Mapa Interactivo**: Visualiza ubicaciones de oficinas y áreas de servicio
- **Presencia Geográfica**: Estados y ciudades donde opera la empresa
- **Información de Contacto por Ubicación**: Datos específicos de cada oficina

### Proceso de Consulta

1. **Búsqueda**: Utiliza filtros para encontrar empresas relevantes
2. **Evaluación**: Revisa perfiles, proyectos y certificaciones
3. **Contacto**: Utiliza la información de contacto para comunicarte directamente
4. **Ubicación**: Consulta el mapa para verificar proximidad y áreas de servicio

---

## Guía para Representantes de Empresas

### Registro y Acceso

#### Proceso de Registro (`/registro-representante`)
1. **Información Personal**: Nombre, email, teléfono
2. **Verificación**: Confirma tu email y número de teléfono
3. **Información de Empresa**: Datos básicos de la organización
4. **Selección de Membresía**: Elige el plan que mejor se adapte a tus necesidades

#### Inicio de Sesión (`/login-representante`)
- Utiliza tu email y contraseña registrados
- Opción de "Recordar sesión" para acceso automático
- Recuperación de contraseña disponible

### Dashboard del Representante

#### Panel Principal (`/dashboard-representante`)
- **Resumen de Empresa**: Estado actual del perfil
- **Estadísticas**: Visualizaciones, consultas, proyectos activos
- **Membresía Actual**: Información del plan y fecha de vencimiento
- **Acciones Rápidas**: Enlaces directos a funciones principales

### Gestión del Perfil Empresarial

#### Información Básica
- **Datos de Empresa**: 
  - Nombre comercial
  - Logo empresarial
  - Información de contacto (teléfonos, emails)
  - Sitio web oficial

#### Descripción y Servicios
- **Descripción Detallada**: Editor enriquecido para crear contenido atractivo
- **Categorías de Servicio**: Selecciona hasta múltiples categorías
- **Certificaciones**: Adjunta certificados y acreditaciones relevantes

#### Presencia Geográfica
- **Estados de Operación**: Selecciona todos los estados donde opera tu empresa
- **Ciudades Específicas**: Define ciudades donde tienes presencia física
- **Dirección Principal**: Establece tu oficina matriz
- **Ubicación en Mapa**: Confirma coordenadas geográficas precisas

#### Galería de Productos/Servicios
- **Imágenes Principales**: Sube hasta 10 imágenes representativas
- **Videos Promocionales**: Añade enlaces a videos de YouTube o Vimeo
- **Catálogo Digital**: Sube archivo PDF con catálogo completo de productos
- **Optimización**: Las imágenes se optimizan automáticamente para web

### Gestión de Proyectos

#### Crear Nuevo Proyecto
1. **Información Básica**:
   - Nombre del proyecto
   - Descripción detallada con editor enriquecido
   - Categoría del proyecto
   - Estado (activo/completado)

2. **Galería Visual**:
   - Sube hasta 10 imágenes por proyecto
   - Organiza imágenes con drag & drop
   - Añade descripciones a cada imagen
   - Establece imagen principal

3. **Contenido Multimedia**:
   - Videos demostrativos
   - Enlaces a portfolios externos
   - Documentos técnicos (opcional)

#### Gestión de Proyectos Existentes
- **Edición**: Modifica cualquier aspecto del proyecto
- **Reorganización**: Cambia el orden de presentación
- **Estado**: Activa o desactiva proyectos según relevancia
- **Eliminación**: Proceso de confirmación para evitar pérdidas accidentales

### Sistema de Membresías

#### Tipos de Membresía
1. **Plan Básico**:
   - Perfil empresarial completo
   - Hasta 2 proyectos en portafolio
   - Información de contacto básica
   - Aparición en búsquedas

2. **Plan Profesional**:
   - Todo lo del Plan Básico
   - Hasta 5 proyectos en portafolio
   - Galería extendida de imágenes
   - Videos promocionales
   - Certificaciones destacadas

3. **Plan Premium**:
   - Todo lo del Plan Profesional
   - Proyectos ilimitados
   - Posicionamiento preferencial
   - Catálogo digital
   - Estadísticas avanzadas
   - Soporte prioritario

#### Proceso de Pago (`/checkout-plan/:membershipTypeId`)
1. **Selección de Plan**: Revisa características y precios
2. **Información de Facturación**: Datos fiscales para facturación
3. **Método de Pago**: Tarjeta de crédito/débito vía Stripe
4. **Confirmación**: Recibe confirmación por email
5. **Activación**: El plan se activa inmediatamente

#### Gestión de Suscripción
- **Renovación Automática**: Las suscripciones se renuevan automáticamente
- **Cambio de Plan**: Upgrade o downgrade disponible en cualquier momento
- **Historial de Pagos**: Acceso completo a facturas anteriores
- **Cancelación**: Proceso simple desde el dashboard

### Opiniones y Reseñas

#### Gestión de Opiniones Recibidas
- **Visualización**: Ve todas las opiniones sobre tu empresa
- **Respuestas**: Responde públicamente a comentarios
- **Reportes**: Reporta opiniones inapropiadas para moderación
- **Estadísticas**: Analiza tendencias en feedback recibido

### Configuración de Cuenta

#### Preferencias de Notificaciones
- **Email**: Configurar qué notificaciones recibir por correo
- **Frecuencia**: Diaria, semanal o inmediata
- **Tipos**: Nuevas consultas, vencimiento de membresía, nuevas opiniones

#### Seguridad de Cuenta
- **Cambio de Contraseña**: Proceso seguro con verificación
- **Verificación en Dos Pasos**: Activación opcional para mayor seguridad
- **Historial de Acceso**: Revisa inicios de sesión recientes

---

## Guía para Administradores

### Panel de Administración

#### Dashboard Principal (`/dashboard`)
- **Métricas Clave**: 
  - Total de empresas registradas
  - Usuarios activos
  - Registros del mes
  - Ingresos totales
- **Gráficas y Estadísticas**: Visualización de tendencias y crecimiento
- **Alertas del Sistema**: Notificaciones importantes que requieren atención
- **Acciones Rápidas**: Enlaces directos a tareas administrativas frecuentes

### Gestión de Empresas (`/empresas`)

#### Listado de Empresas
- **Vista Completa**: Todas las empresas con información resumida
- **Filtros Avanzados**: Por estado, categoría, tipo de membresía, fecha de registro
- **Búsqueda**: Por nombre de empresa o representante
- **Acciones en Lote**: Operaciones sobre múltiples empresas simultáneamente

#### Acciones por Empresa
- **Edición Completa**: Modificar cualquier aspecto del perfil
- **Cambio de Estado**: Activar/desactivar empresas
- **Gestión de Membresía**: Cambiar planes, extender vencimientos
- **Moderación**: Aprobar/rechazar contenido pendiente
- **Comunicación**: Enviar mensajes directos a representantes

#### Moderación de Contenido
- **Proyectos Pendientes**: Revisar y aprobar nuevos proyectos
- **Imágenes y Videos**: Verificar contenido multimedia apropiado
- **Descripciones**: Validar textos y información empresarial
- **Reportes**: Atender reportes de contenido inapropiado

### Gestión de Usuarios (`/usuarios`)

#### Administración de Cuentas
- **Usuarios Registrados**: Lista completa con roles y estados
- **Creación Manual**: Crear cuentas para casos especiales
- **Gestión de Roles**: Asignar permisos de administrador o representante
- **Suspensión de Cuentas**: Bloquear usuarios problemáticos temporalmente

#### Reportes de Actividad
- **Estadísticas de Uso**: Frecuencia de acceso y actividad por usuario
- **Últimos Accesos**: Monitoreo de actividad reciente
- **Patrones de Uso**: Análisis de comportamiento de usuarios

### Gestión de Categorías (`/categorias`)

#### Administración de Categorías
- **Crear Nuevas**: Añadir categorías para nuevos tipos de servicios
- **Edición**: Modificar nombres, descripciones e iconos
- **Ordenamiento**: Establecer orden de aparición en filtros
- **Activación/Desactivación**: Controlar disponibilidad en formularios

#### Iconografía
- **Iconos Personalizados**: Subir iconos específicos para cada categoría
- **Iconos de Lucide**: Usar biblioteca de iconos predefinidos
- **Optimización**: Asegurar carga rápida y buena visualización

### Gestión de Membresías (`/membresias`)

#### Configuración de Planes
- **Características**: Definir qué incluye cada tipo de membresía
- **Precios**: Establecer costos y promociones
- **Periodicidad**: Configurar opciones mensuales, anuales
- **Métodos de Pago**: Configurar formas de pago aceptadas

#### Seguimiento Financiero
- **Ingresos por Período**: Reportes detallados de facturación
- **Proyecciones**: Estimaciones de ingresos futuros
- **Análisis de Conversión**: Tasas de conversión por tipo de plan
- **Gestión de Cobranza**: Seguimiento a pagos pendientes

### Gestión de Certificaciones (`/certificaciones`)

#### Catálogo de Certificaciones
- **Crear Nuevas**: Añadir tipos de certificaciones reconocidas
- **Validación**: Establecer procesos de verificación
- **Categorización**: Organizar por industria o tipo
- **Vigencia**: Configurar períodos de validez

### Moderación de Opiniones (`/opiniones`)

#### Revisión de Contenido
- **Opiniones Pendientes**: Cola de moderación para nuevas reseñas
- **Criterios de Aprobación**: Filtros automáticos y revisión manual
- **Gestión de Reportes**: Atender reportes de usuarios sobre contenido
- **Respuestas**: Facilitar comunicación entre empresas y clientes

### Configuración del Sistema (`/configuracion`)

#### Parámetros Generales
- **Información de la Plataforma**: Nombre, logos, información de contacto
- **Políticas**: Términos de servicio, política de privacidad
- **Límites del Sistema**: Tamaños de archivo, límites de proyectos
- **Integraciones**: Configuración de APIs externas

#### Mantenimiento
- **Respaldos**: Programación y gestión de backups
- **Actualizaciones**: Control de versiones y deploy
- **Monitoreo**: Alertas de performance y disponibilidad
- **Logs del Sistema**: Acceso a registros para debugging

---

## Resolución de Problemas Comunes

### Para Todos los Usuarios

#### Problemas de Acceso
- **Error de Login**: Verificar credenciales, resetear contraseña si es necesario
- **Página No Carga**: Limpiar cache del navegador, verificar conexión
- **Sesión Expirada**: Volver a iniciar sesión

#### Problemas de Navegación
- **Filtros No Funcionan**: Verificar selección de criterios, limpiar filtros
- **Búsqueda Sin Resultados**: Ampliar criterios, verificar ortografía
- **Mapa No Carga**: Verificar permisos de ubicación, actualizar navegador

### Para Representantes de Empresas

#### Problemas de Perfil
- **Imágenes No Suben**: Verificar formato y tamaño de archivo
- **Cambios No Se Guardan**: Verificar conexión, completar campos obligatorios
- **Proyectos No Aparecen**: Verificar estado activo, esperar tiempo de moderación

#### Problemas de Pago
- **Pago Rechazado**: Verificar datos de tarjeta, contactar banco emisor
- **Factura No Recibida**: Revisar carpeta de spam, contactar soporte
- **Membresía No Activada**: Esperar confirmación, contactar administrador

### Para Administradores

#### Problemas del Sistema
- **Dashboard Lento**: Verificar carga del servidor, optimizar consultas
- **Reportes No Generan**: Verificar rangos de fecha, permisos de base de datos
- **Usuarios No Pueden Registrarse**: Verificar configuración de email, servicios externos

---

## Contacto y Soporte

### Canales de Soporte
- **Email**: soporte@anpr.org.mx
- **Teléfono**: +52 777 012 3456
- **Horario**: Lunes a Viernes, 9:00 AM - 6:00 PM (Zona Centro)

### Recursos Adicionales
- **Videos Tutoriales**: Disponibles en el canal de YouTube de ANPR
- **Base de Conocimientos**: Artículos detallados sobre funcionalidades específicas
- **Webinars**: Sesiones de entrenamiento para nuevos usuarios

### Reportar Problemas
Cuando reportes un problema, incluye:
- Descripción detallada del issue
- Pasos para reproducir el problema
- Capturas de pantalla si es aplicable
- Información del navegador y dispositivo utilizado

---

Este manual se actualiza regularmente. Para obtener la versión más reciente, visita la sección de ayuda en la plataforma.