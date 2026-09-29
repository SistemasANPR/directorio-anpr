CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre_categoria" text NOT NULL,
	"descripcion" text,
	"icono" text DEFAULT 'Tag',
	"icono_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre_certificado" text NOT NULL,
	"imagen_url" text NOT NULL,
	"descripcion" text,
	"fecha_emision" text,
	"fecha_vencimiento" text,
	"entidad_emisora" text,
	"estado" text DEFAULT 'activo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre_empresa" text NOT NULL,
	"logotipo_url" text,
	"telefono1" text,
	"telefono2" text,
	"email1" text NOT NULL,
	"email2" text,
	"paises_presencia" jsonb,
	"estados_presencia" jsonb,
	"ciudades_presencia" jsonb,
	"ubicacion_principal" text,
	"direccion_fisica" text,
	"ubicacion_geografica" jsonb,
	"representantes_ventas" jsonb,
	"descripcion_empresa" text,
	"galeria_productos_urls" jsonb,
	"categories_ids" jsonb,
	"redes_sociales" jsonb,
	"catalogo_digital_url" text,
	"videos_urls" jsonb,
	"membership_type_id" integer,
	"sitio_web" text,
	"certificate_ids" jsonb,
	"membership_periodicidad" text,
	"forma_pago" text,
	"fecha_inicio_membresia" text,
	"fecha_fin_membresia" text,
	"notas_membresia" text,
	"user_id" integer,
	"estado" text DEFAULT 'activo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_banners" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"titulo" varchar(255),
	"subtitulo" text,
	"imagen_url" text NOT NULL,
	"enlace" text,
	"posicion" varchar(50) DEFAULT 'hero',
	"tipo_enlace" varchar(50) DEFAULT 'interno',
	"orden" integer DEFAULT 0,
	"fecha_inicio" timestamp,
	"fecha_fin" timestamp,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "home_configuration" (
	"id" serial PRIMARY KEY NOT NULL,
	"seccion" varchar(100) NOT NULL,
	"titulo" varchar(255),
	"subtitulo" text,
	"descripcion" text,
	"imagen_url" text,
	"video_url" text,
	"enlace_boton" text,
	"texto_boton" varchar(100),
	"configuracion_json" jsonb,
	"orden" integer DEFAULT 0,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "home_configuration_seccion_unique" UNIQUE("seccion")
);
--> statement-breakpoint
CREATE TABLE "home_highlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"titulo" varchar(255),
	"descripcion" text,
	"imagen_url" text,
	"orden" integer DEFAULT 0,
	"fecha_inicio" timestamp,
	"fecha_fin" timestamp,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "membership_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"membership_type_id" integer NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'mxn' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "membership_payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "membership_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre_plan" text NOT NULL,
	"descripcion_plan" text,
	"opciones_precios" jsonb,
	"beneficios" jsonb,
	"visibilidad" text DEFAULT 'publica' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opinions" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"user_id" integer,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"calificacion" integer NOT NULL,
	"comentario" text NOT NULL,
	"fecha_creacion" timestamp DEFAULT now() NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"fecha_aprobacion" timestamp,
	"aprobado_por" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"nombre_proyecto" text NOT NULL,
	"descripcion_proyecto" text,
	"category_id" integer,
	"fecha_inicio" date,
	"fecha_finalizacion" date,
	"ubicacion_pais" text,
	"ubicacion_estado" text,
	"ubicacion_ciudad" text,
	"cliente_contratante" text,
	"area_superficie" text,
	"servicios_productos" text[],
	"galeria_imagenes" text[],
	"video_url" text,
	"estado" text DEFAULT 'borrador',
	"estado_moderacion" text DEFAULT 'pendiente',
	"vistas" integer DEFAULT 0,
	"consultas" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"permisos" jsonb,
	"es_rol_sistema" boolean DEFAULT false NOT NULL,
	"estado" text DEFAULT 'activo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"site_name" text DEFAULT 'Directorio Industrial' NOT NULL,
	"site_description" text DEFAULT 'Plataforma de administración web para organizaciones',
	"logo_url" text,
	"favicon_url" text,
	"primary_color" text DEFAULT '#2563eb' NOT NULL,
	"secondary_color" text DEFAULT '#f97316' NOT NULL,
	"accent_color" text DEFAULT '#10b981' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"currency_symbol" text DEFAULT '$' NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"timezone" text DEFAULT 'America/Mexico_City' NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"address" text,
	"social_media" jsonb,
	"seo_settings" jsonb,
	"email_settings" jsonb,
	"payment_settings" jsonb,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"registration_enabled" boolean DEFAULT true NOT NULL,
	"max_file_size" integer DEFAULT 10485760 NOT NULL,
	"allowed_file_types" jsonb DEFAULT '["jpg","jpeg","png","pdf","doc","docx"]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"photo_url" text,
	"role" text DEFAULT 'user' NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_firebase_uid_unique" UNIQUE("firebase_uid"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_membership_type_id_membership_types_id_fk" FOREIGN KEY ("membership_type_id") REFERENCES "public"."membership_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_payments" ADD CONSTRAINT "membership_payments_membership_type_id_membership_types_id_fk" FOREIGN KEY ("membership_type_id") REFERENCES "public"."membership_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opinions" ADD CONSTRAINT "opinions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opinions" ADD CONSTRAINT "opinions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opinions" ADD CONSTRAINT "opinions_aprobado_por_users_id_fk" FOREIGN KEY ("aprobado_por") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;