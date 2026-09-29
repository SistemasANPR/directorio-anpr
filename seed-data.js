import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "./shared/schema.js";

neonConfig.webSocketConstructor = ws;

// Usar la misma configuración de la base de datos
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

const { users, companies, categories, membershipTypes, certificates, roles, opinions } = schema;

const seedData = async () => {
  console.log("Iniciando creación de datos de prueba...");

  try {
    // 1. Limpiar datos existentes (opcional)
    console.log("Limpiando datos existentes...");
    await db.delete(opinions);
    await db.delete(companies);
    await db.delete(users).where(schema.ne(users.id, 1)); // Mantener usuario admin existente
    await db.delete(certificates);
    await db.delete(membershipTypes);
    await db.delete(categories);
    await db.delete(roles);

    // 2. Crear roles del sistema
    console.log("Creando roles...");
    await db.insert(roles).values([
      {
        nombre: "admin",
        descripcion: "Administrador del sistema con acceso completo",
        permisos: ["users.read", "users.write", "companies.read", "companies.write", "categories.read", "categories.write", "memberships.read", "memberships.write", "certificates.read", "certificates.write", "opinions.read", "opinions.write", "roles.read", "roles.write", "statistics.read"],
        estado: "activo"
      },
      {
        nombre: "representante",
        descripcion: "Representante de empresa que puede gestionar su compañía y comentarios",
        permisos: ["companies.read", "companies.write", "opinions.read", "opinions.write"],
        estado: "activo"
      },
      {
        nombre: "user",
        descripcion: "Usuario básico con permisos de lectura",
        permisos: ["companies.read", "opinions.read"],
        estado: "activo"
      }
    ]);

    // 3. Crear categorías de empresas
    console.log("Creando categorías...");
    await db.insert(categories).values([
      {
        nombre: "Equipamiento Urbano",
        descripcion: "Mobiliario y equipamiento para espacios públicos urbanos",
        icono: "building",
        estado: "activo"
      },
      {
        nombre: "Señalización Vial",
        descripcion: "Sistemas de señalización para tráfico vehicular y peatonal",
        icono: "traffic-cone",
        estado: "activo"
      },
      {
        nombre: "Iluminación LED",
        descripcion: "Soluciones de iluminación LED para espacios públicos",
        icono: "lightbulb",
        estado: "activo"
      },
      {
        nombre: "Equipamiento Deportivo",
        descripcion: "Instalaciones y equipos para actividades deportivas",
        icono: "dumbbell",
        estado: "activo"
      },
      {
        nombre: "Mobiliario Urbano",
        descripcion: "Bancas, kioscos, pergolas y estructuras urbanas",
        icono: "armchair",
        estado: "activo"
      },
      {
        nombre: "Sistemas de Seguridad",
        descripcion: "Cámaras, barreras y sistemas de control de acceso",
        icono: "shield",
        estado: "activo"
      }
    ]);

    // 4. Crear tipos de membresía
    console.log("Creando tipos de membresía...");
    await db.insert(membershipTypes).values([
      {
        nombre: "Básica",
        descripcion: "Membresía básica con funcionalidades esenciales",
        precio: 99.00,
        duracionMeses: 12,
        beneficios: ["Listado en directorio", "Información básica de contacto", "1 imagen de producto"],
        limitesCaracteristicas: { imagenes: 1, videos: 0, categorias: 1 },
        estado: "activo"
      },
      {
        nombre: "Premium",
        descripcion: "Membresía premium con características avanzadas",
        precio: 299.00,
        duracionMeses: 12,
        beneficios: ["Listado destacado", "Galería de productos", "Videos promocionales", "Ubicación en mapa", "Múltiples categorías"],
        limitesCaracteristicas: { imagenes: 10, videos: 3, categorias: 3 },
        estado: "activo"
      },
      {
        nombre: "Enterprise",
        descripcion: "Solución empresarial completa",
        precio: 599.00,
        duracionMeses: 12,
        beneficios: ["Posición premium", "Galería ilimitada", "Videos ilimitados", "Soporte prioritario", "Análiticas avanzadas"],
        limitesCaracteristicas: { imagenes: -1, videos: -1, categorias: -1 },
        estado: "activo"
      }
    ]);

    // 5. Crear certificados
    console.log("Creando certificados...");
    await db.insert(certificates).values([
      {
        nombre: "ISO 9001:2015",
        descripcion: "Certificación de Sistema de Gestión de Calidad",
        entidadCertificadora: "Bureau Veritas",
        fechaEmision: new Date("2023-01-15"),
        fechaVencimiento: new Date("2026-01-15"),
        estado: "activo"
      },
      {
        nombre: "ISO 14001:2015",
        descripcion: "Certificación de Sistema de Gestión Ambiental",
        entidadCertificadora: "SGS",
        fechaEmision: new Date("2023-03-20"),
        fechaVencimiento: new Date("2026-03-20"),
        estado: "activo"
      },
      {
        nombre: "OHSAS 18001",
        descripcion: "Certificación de Seguridad y Salud Ocupacional",
        entidadCertificadora: "TÜV Rheinland",
        fechaEmision: new Date("2023-05-10"),
        fechaVencimiento: new Date("2026-05-10"),
        estado: "activo"
      },
      {
        nombre: "NMX-CC-9001-IMNC-2008",
        descripcion: "Norma Mexicana de Calidad",
        entidadCertificadora: "EMA",
        fechaEmision: new Date("2023-02-28"),
        fechaVencimiento: new Date("2026-02-28"),
        estado: "activo"
      }
    ]);

    // 6. Crear usuarios representantes
    console.log("Creando usuarios representantes...");
    await db.insert(users).values([
      {
        firebaseUid: "rep_001_maria",
        email: "maria.garcia@playtech.mx",
        displayName: "María García Rodríguez",
        photoURL: "https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=150&h=150&fit=crop&crop=face",
        role: "representante",
        estado: "activo"
      },
      {
        firebaseUid: "rep_002_juan",
        email: "juan.martinez@senalizacion.com",
        displayName: "Juan Carlos Martínez",
        photoURL: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
        role: "representante",
        estado: "activo"
      },
      {
        firebaseUid: "rep_003_ana",
        email: "ana.lopez@iluminacion.mx",
        displayName: "Ana López Fernández",
        photoURL: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
        role: "representante",
        estado: "activo"
      },
      {
        firebaseUid: "rep_004_pedro",
        email: "pedro.sanchez@deportes.com",
        displayName: "Pedro Sánchez Villa",
        photoURL: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
        role: "representante",
        estado: "activo"
      },
      {
        firebaseUid: "user_001_laura",
        email: "laura.cliente@email.com",
        displayName: "Laura Cliente Municipal",
        photoURL: "https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=150&h=150&fit=crop&crop=face",
        role: "user",
        estado: "activo"
      }
    ]);

    // 7. Crear empresas con ubicaciones reales en México
    console.log("Creando empresas...");
    await db.insert(companies).values([
      {
        nombreEmpresa: "PlayTech Equipamiento Urbano",
        logotipoUrl: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=200&h=200&fit=crop",
        telefono1: "+52-55-1234-5678",
        telefono2: "+52-55-1234-5679",
        email1: "ventas@playtech.mx",
        email2: "info@playtech.mx",
        paisesPresencia: ["México"],
        estadosPresencia: ["Ciudad de México", "Estado de México", "Jalisco"],
        ciudadesPresencia: ["Ciudad de México", "Guadalajara", "Monterrey"],
        direccionFisica: "Av. Insurgentes Sur 1647, Del Valle Norte, 03103 Ciudad de México, CDMX",
        ubicacionGeografica: { lat: 19.3887, lng: -99.1577 },
        representantesVentas: "María García - Gerente de Ventas",
        descripcionEmpresa: "Empresa líder en equipamiento urbano con más de 15 años de experiencia. Especialistas en juegos infantiles, gimnasios al aire libre y mobiliario urbano de alta calidad.",
        galeriaProductosUrls: [
          "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1594736797933-d0c2d95d5bb5?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=400&h=300&fit=crop"
        ],
        categoriesIds: [1, 4],
        redesSociales: {
          facebook: "https://facebook.com/playtech.mx",
          instagram: "https://instagram.com/playtech_mx",
          linkedin: "https://linkedin.com/company/playtech-mx"
        },
        catalogoDigitalUrl: "https://playtech.mx/catalogo",
        videoUrl1: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        membershipTypeId: 3,
        sitioWeb: "https://playtech.mx",
        certificateIds: [1, 2],
        userId: 2,
        estado: "activo"
      },
      {
        nombreEmpresa: "Señalización Total México",
        logotipoUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&h=200&fit=crop",
        telefono1: "+52-33-3456-7890",
        email1: "ventas@senalizaciontotal.com",
        paisesPresencia: ["México"],
        estadosPresencia: ["Jalisco", "Michoacán", "Colima"],
        ciudadesPresencia: ["Guadalajara", "Morelia", "Colima"],
        direccionFisica: "Av. López Mateos Sur 2077, Chapalita, 44500 Guadalajara, Jal.",
        ubicacionGeografica: { lat: 20.6597, lng: -103.3496 },
        descripcionEmpresa: "Especialistas en señalización vial y urbana con tecnología de última generación. Ofrecemos soluciones integrales para mejorar la seguridad vial y la movilidad urbana.",
        galeriaProductosUrls: [
          "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1534536281715-e28d76689b4d?w=400&h=300&fit=crop"
        ],
        categoriesIds: [2],
        redesSociales: {
          facebook: "https://facebook.com/senalizaciontotal",
          linkedin: "https://linkedin.com/company/senalizacion-total"
        },
        catalogoDigitalUrl: "https://senalizaciontotal.com/productos",
        membershipTypeId: 2,
        sitioWeb: "https://senalizaciontotal.com",
        certificateIds: [1],
        userId: 3,
        estado: "activo"
      },
      {
        nombreEmpresa: "Iluminación Verde Sustentable",
        logotipoUrl: "https://images.unsplash.com/photo-1573164713714-d95e436ab8d6?w=200&h=200&fit=crop",
        telefono1: "+52-55-4567-8901",
        email1: "info@iluminacionverde.mx",
        paisesPresencia: ["México"],
        estadosPresencia: ["Estado de México", "Puebla", "Hidalgo"],
        ciudadesPresencia: ["Toluca", "Puebla", "Pachuca"],
        direccionFisica: "Blvd. Aeropuerto 208, Las Arboledas, 50110 Toluca de Lerdo, Méx.",
        ubicacionGeografica: { lat: 19.3176, lng: -99.6651 },
        descripcionEmpresa: "Empresa innovadora en sistemas de iluminación LED y energía solar. Comprometidos con la sustentabilidad y la eficiencia energética en espacios públicos y privados.",
        galeriaProductosUrls: [
          "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1509635022432-0220ac12960b?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1544550285-f813152fb2fd?w=400&h=300&fit=crop"
        ],
        categoriesIds: [3],
        redesSociales: {
          instagram: "https://instagram.com/iluminacion_verde",
          linkedin: "https://linkedin.com/company/iluminacion-verde"
        },
        videoUrl1: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        membershipTypeId: 2,
        sitioWeb: "https://iluminacionverde.mx",
        certificateIds: [1, 3],
        userId: 4,
        estado: "activo"
      },
      {
        nombreEmpresa: "Deportes y Recreación Monterrey",
        logotipoUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop",
        telefono1: "+52-81-5678-9012",
        email1: "contacto@deportesrecreacion.com",
        paisesPresencia: ["México"],
        estadosPresencia: ["Nuevo León", "Coahuila", "Tamaulipas"],
        ciudadesPresencia: ["Monterrey", "Saltillo", "Tampico"],
        direccionFisica: "Av. Constitución 654, Centro, 64000 Monterrey, N.L.",
        ubicacionGeografica: { lat: 25.6866, lng: -100.3161 },
        descripcionEmpresa: "Especialistas en equipamiento deportivo y recreativo para parques, escuelas y centros comunitarios. Promovemos el deporte y la vida saludable en las comunidades.",
        galeriaProductosUrls: [
          "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?w=400&h=300&fit=crop"
        ],
        categoriesIds: [4],
        redesSociales: {
          facebook: "https://facebook.com/deportesrecreacion",
          instagram: "https://instagram.com/deportes_recreacion"
        },
        membershipTypeId: 1,
        sitioWeb: "https://deportesrecreacion.com",
        userId: 5,
        estado: "activo"
      },
      {
        nombreEmpresa: "Mobiliario Urbano Innovador",
        logotipoUrl: "https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=200&h=200&fit=crop",
        telefono1: "+52-55-7890-1234",
        email1: "ventas@mobiliariourbano.mx",
        paisesPresencia: ["México"],
        estadosPresencia: ["Ciudad de México", "Querétaro", "Guanajuato"],
        ciudadesPresencia: ["Ciudad de México", "Querétaro", "León"],
        direccionFisica: "Calz. de Tlalpan 1670, Country Club, 04220 Ciudad de México, CDMX",
        ubicacionGeografica: { lat: 19.3475, lng: -99.1879 },
        descripcionEmpresa: "Diseño y fabricación de mobiliario urbano contemporáneo. Bancas, kioscos, pergolas y estructuras que transforman los espacios públicos en lugares más atractivos y funcionales.",
        galeriaProductosUrls: [
          "https://images.unsplash.com/photo-1562159278-1253a58da141?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1586953208457-b95a79798f07?w=400&h=300&fit=crop"
        ],
        categoriesIds: [5],
        redesSociales: {
          linkedin: "https://linkedin.com/company/mobiliario-urbano-innovador"
        },
        membershipTypeId: 2,
        sitioWeb: "https://mobiliariourbano.mx",
        certificateIds: [1],
        userId: 2,
        estado: "activo"
      },
      {
        nombreEmpresa: "Seguridad Inteligente CDMX",
        logotipoUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=200&fit=crop",
        telefono1: "+52-55-9012-3456",
        email1: "info@seguridadinteligente.mx",
        paisesPresencia: ["México"],
        estadosPresencia: ["Ciudad de México", "Estado de México"],
        ciudadesPresencia: ["Ciudad de México", "Naucalpan", "Ecatepec"],
        direccionFisica: "Av. Paseo de la Reforma 350, Juárez, 06600 Ciudad de México, CDMX",
        ubicacionGeografica: { lat: 19.4326, lng: -99.1652 },
        descripcionEmpresa: "Soluciones integrales de seguridad urbana. Cámaras de videovigilancia, sistemas de control de acceso y tecnología de monitoreo para espacios públicos y privados.",
        galeriaProductosUrls: [
          "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
          "https://images.unsplash.com/photo-1516542076529-1ea3854896f2?w=400&h=300&fit=crop"
        ],
        categoriesIds: [6],
        redesSociales: {
          linkedin: "https://linkedin.com/company/seguridad-inteligente-cdmx"
        },
        membershipTypeId: 3,
        sitioWeb: "https://seguridadinteligente.mx",
        certificateIds: [1, 2, 3],
        userId: 3,
        estado: "activo"
      }
    ]);

    // 8. Crear opiniones de usuarios
    console.log("Creando opiniones...");
    await db.insert(opinions).values([
      {
        nombreUsuario: "Roberto Méndez",
        emailUsuario: "roberto.mendez@email.com",
        calificacion: 5,
        comentario: "Excelente calidad en sus juegos infantiles. Los instalaron en nuestro parque municipal y han sido muy resistentes al clima. Los niños los disfrutan mucho y los padres estamos tranquilos por la seguridad.",
        companyId: 1,
        estado: "aprobado",
        approvedBy: 1
      },
      {
        nombreUsuario: "Ing. Carmen Delgado",
        emailUsuario: "carmen.delgado@gobierno.mx",
        calificacion: 5,
        comentario: "Trabajamos con ellos en un proyecto de señalización vial para toda la zona metropolitana. Su profesionalismo y calidad de productos es excepcional. Cumplieron con todos los tiempos acordados.",
        companyId: 2,
        estado: "aprobado",
        approvedBy: 1
      },
      {
        nombreUsuario: "Arq. Miguel Torres",
        emailUsuario: "miguel.torres@arquitectos.com",
        calificacion: 4,
        comentario: "Sus soluciones de iluminación LED transformaron completamente nuestro proyecto. El ahorro energético es notable y el mantenimiento es mínimo. Muy recomendable para proyectos urbanos.",
        companyId: 3,
        estado: "aprobado",
        approvedBy: 1
      },
      {
        nombreUsuario: "Director Escuela Primaria",
        emailUsuario: "director@escuelaprimaria.edu.mx",
        calificacion: 5,
        comentario: "Instalaron un gimnasio al aire libre en nuestra escuela. Los equipos son de excelente calidad y muy seguros para los estudiantes. El servicio post-venta también es muy bueno.",
        companyId: 4,
        estado: "aprobado",
        approvedBy: 1
      },
      {
        nombreUsuario: "Urbanista Patricia Ruiz",
        emailUsuario: "patricia.ruiz@urbanismo.gob.mx",
        calificacion: 4,
        comentario: "Su mobiliario urbano tiene diseños muy modernos y funcionales. Han mejorado considerablemente la imagen de nuestros espacios públicos. La calidad de los materiales es muy buena.",
        companyId: 5,
        estado: "pendiente"
      }
    ]);

    console.log("✅ Datos de prueba creados exitosamente!");
    console.log("📊 Resumen:");
    console.log("   - 3 roles del sistema");
    console.log("   - 6 categorías de empresas");
    console.log("   - 3 tipos de membresía");
    console.log("   - 4 certificados");
    console.log("   - 5 usuarios nuevos (4 representantes, 1 usuario)");
    console.log("   - 6 empresas con ubicaciones reales en México");
    console.log("   - 5 opiniones de usuarios");

  } catch (error) {
    console.error("Error al crear datos de prueba:", error);
    throw error;
  }
};

// Ejecutar el seeding
seedData().catch(console.error).finally(() => {
  process.exit(0);
});