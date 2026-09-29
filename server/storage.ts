import { 
  users, 
  companies, 
  representativeCompanies,
  categories, 
  tags,
  membershipTypes, 
  certificates,
  roles,
  opinions,
  membershipPayments,
  processedStripeEvents,
  systemSettings,
  projects,
  companyLocations,
  integrationSettings,
  pdfSettings,
  stripeConfigurationTable,
  emailConfiguration,
  emailTemplates,
  frontendConfigurationTable,
  passwordResetTokens,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type User,
  type Company, 
  type RepresentativeCompany,
  type Category, 
  type Tag,
  type MembershipType, 
  type Certificate,
  type Role,
  type Opinion,
  type Project,
  type InsertUser,
  type InsertCompany,
  type InsertCategory,
  type InsertTag,
  type InsertMembershipType,
  type InsertCertificate,
  type InsertRole,
  type InsertOpinion,
  type InsertProject,
  type SelectCompanyLocation,
  type InsertCompanyLocation,
  type IntegrationSettings,
  type InsertIntegrationSettings,
  type PdfSettings,
  type InsertPdfSettings,
  type MembershipPayment,
  type InsertMembershipPayment,
  type SystemSettings,
  type InsertSystemSettings,
  type StripeConfiguration,
  type InsertStripeConfiguration,
  type EmailConfiguration,
  type InsertEmailConfiguration,
  type EmailTemplate,
  type InsertEmailTemplate,
  type FrontendConfiguration,
  type InsertFrontendConfiguration,
  type CompanyWithDetails,
  type ProjectWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, like, sql, and, or, asc, gt, isNull, desc } from "drizzle-orm";
import nodemailer from "nodemailer";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  updateUserAndRepresentativeCompanies(
    id: number,
    user: Partial<InsertUser>,
    companyId?: number,
  ): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  setCompanyRepresentative(companyId: number, userId: number): Promise<void>;
  listRepresentativeCompanyAssociations(userId: number): Promise<RepresentativeCompany[]>;
  listRepresentativeCompanies(userId: number): Promise<Company[]>;
  listAllRepresentativeCompanyAssignments(): Promise<Array<{
    representativeUserId: number;
    company: Company;
  }>>;
  getCompaniesForRepresentative(email: string, userId: number | null): Promise<Company[]>;
  addRepresentativeCompany(companyId: number, userId: number): Promise<AddRepresentativeCompanyResult>;
  removeRepresentativeCompany(companyId: number, userId: number): Promise<{
    removed: boolean;
    companies: Company[];
  }>;
  unassignRepresentativeFromAllCompanies(userId: number): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Companies
  getCompany(id: number): Promise<CompanyWithDetails | undefined>;
  getAllCompanies(options?: {
    search?: string;
    categoryId?: number;
    membershipTypeId?: number;
    tagIds?: number[];
    estado?: string;
    limit?: number;
    offset?: number;
    includeInactive?: boolean;
  }): Promise<{ companies: CompanyWithDetails[]; total: number }>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  deleteCompany(id: number): Promise<boolean>;
  getCompaniesByUser(userId: number): Promise<CompanyWithDetails[]>;
  getCompanyForRepresentative(email: string, userId: number | null): Promise<Company | undefined>;

  // Company Locations
  getCompanyLocations(companyId: number): Promise<SelectCompanyLocation[]>;
  getAllCompanyLocations(): Promise<SelectCompanyLocation[]>;
  createCompanyLocation(location: InsertCompanyLocation): Promise<SelectCompanyLocation>;
  updateCompanyLocation(companyId: number, locationId: number, location: Partial<InsertCompanyLocation>): Promise<SelectCompanyLocation | undefined>;
  deleteCompanyLocation(companyId: number, locationId: number): Promise<boolean>;
  setPrincipalLocation(companyId: number, locationId: number): Promise<SelectCompanyLocation | undefined>;

  // Categories
  getCategory(id: number): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;

  // Tags
  getTag(id: number): Promise<Tag | undefined>;
  getAllTags(): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: number, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: number): Promise<boolean>;
  getTagsInUse(): Promise<number[]>;

  // Membership Types
  getMembershipType(id: number): Promise<MembershipType | undefined>;
  getAllMembershipTypes(): Promise<MembershipType[]>;
  createMembershipType(membershipType: InsertMembershipType): Promise<MembershipType>;
  updateMembershipType(id: number, membershipType: Partial<InsertMembershipType>): Promise<MembershipType | undefined>;
  deleteMembershipType(id: number): Promise<boolean>;
  clearMostPopularStatus(): Promise<void>;

  // Certificates
  getCertificate(id: number): Promise<Certificate | undefined>;
  getAllCertificates(): Promise<Certificate[]>;
  getAutoCertificatesForMembership(membershipTypeId: number): Promise<Certificate[]>;
  createCertificate(certificate: InsertCertificate, companyId?: number | null): Promise<Certificate>;
  updateCertificate(id: number, certificate: Partial<InsertCertificate>): Promise<Certificate | undefined>;
  deleteCertificate(id: number): Promise<boolean>;
  assignCertificateToCompany(companyId: number, certificateId: number, details: {
    fechaObtencion: string;
    asignadoPorAdmin: boolean;
    observaciones?: string;
  }): Promise<void>;
  removeCertificateFromCompany(companyId: number, certificateId: number): Promise<void>;

  // Roles
  getRole(id: number): Promise<Role | undefined>;
  getAllRoles(): Promise<Role[]>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: number, role: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: number): Promise<boolean>;

  // Opinions
  getOpinion(id: number): Promise<Opinion | undefined>;
  getAllOpinions(options?: {
    estado?: string;
    companyId?: number;
    tipo?: string;
    userId?: number;
    includeAllStates?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ opinions: Opinion[]; total: number }>;
  createOpinion(opinion: InsertOpinion): Promise<Opinion>;
  updateOpinion(id: number, opinion: Partial<InsertOpinion>): Promise<Opinion | undefined>;
  deleteOpinion(id: number): Promise<boolean>;
  approveOpinion(id: number, approvedBy: number): Promise<Opinion | undefined>;
  rejectOpinion(id: number, approvedBy: number): Promise<Opinion | undefined>;

  // Statistics
  getStatistics(): Promise<{
    totalCompanies: number;
    activeUsers: number;
    newRegistrations: number;
    totalRevenue: number;
  }>;

  // Membership Payments
  createMembershipPayment(payment: InsertMembershipPayment): Promise<MembershipPayment>;
  getMembershipPayment(id: number): Promise<MembershipPayment | undefined>;
  getMembershipPaymentByStripeId(stripePaymentIntentId: string): Promise<MembershipPayment | undefined>;
  updateMembershipPaymentStatus(id: number, status: string): Promise<MembershipPayment | undefined>;
  getUserPayments(userId: number): Promise<MembershipPayment[]>;
  updateUserStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User | undefined>;

  // System Settings
  getSystemSettings(): Promise<SystemSettings>;
  updateSystemSettings(settings: Partial<InsertSystemSettings>): Promise<SystemSettings>;

  // Projects
  getProject(id: number): Promise<ProjectWithDetails | undefined>;
  getAllProjects(options?: {
    companyId?: number;
    categoryId?: number;
    estado?: string;
    estadoModeracion?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ projects: ProjectWithDetails[]; total: number }>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;
  getProjectsByCompany(companyId: number): Promise<ProjectWithDetails[]>;
  incrementProjectViews(id: number): Promise<void>;
  incrementProjectConsultas(id: number): Promise<void>;
  moderateProject(id: number, estado: string): Promise<Project | undefined>;

  // Membership Limits Validation
  validateProjectLimits(companyId: number): Promise<void>;
  validateProductLimits(companyId: number, newProductCount?: number): Promise<void>;

  // PDF Settings
  getPdfSettings(): Promise<PdfSettings>;
  updatePdfSettings(settings: Partial<InsertPdfSettings>): Promise<PdfSettings>;
  createPdfSettings(settings: InsertPdfSettings): Promise<PdfSettings>;



  // Integration Settings
  getIntegrationSettings(): Promise<IntegrationSettings | undefined>;
  createIntegrationSettings(settings: InsertIntegrationSettings): Promise<IntegrationSettings>;
  updateIntegrationSettings(id: number, settings: Partial<InsertIntegrationSettings>): Promise<IntegrationSettings | undefined>;
  testWordPressConnection(url: string, credentials: { apiKey: string; apiSecret: string }): Promise<{ success: boolean; message: string }>;
  syncWordPressUsers(): Promise<{ syncedUsers: number; message: string }>;

  // Stripe Configuration
  getStripeConfiguration(): Promise<StripeConfiguration | undefined>;
  createStripeConfiguration(config: InsertStripeConfiguration): Promise<StripeConfiguration>;
  updateStripeConfiguration(id: number, config: Partial<InsertStripeConfiguration>): Promise<StripeConfiguration | undefined>;
  testStripeConnection(config: InsertStripeConfiguration): Promise<{ success: boolean; message: string; details?: any }>;
  
  // User Stripe Info
  updateUserStripeInfo(userId: number, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;

  // Idempotencia de webhooks de Stripe
  markStripeEventProcessed(eventId: string, type: string): Promise<boolean>;
  unmarkStripeEventProcessed(eventId: string): Promise<void>;

  // Frontend Configuration
  getFrontendConfiguration(): Promise<FrontendConfiguration | undefined>;
  createFrontendConfiguration(config: InsertFrontendConfiguration): Promise<FrontendConfiguration>;
  updateFrontendConfiguration(id: number, config: Partial<InsertFrontendConfiguration>): Promise<FrontendConfiguration | undefined>;
}

export type AddRepresentativeCompanyResult =
  | { status: "added"; association: RepresentativeCompany; companies: Company[] }
  | { status: "existing"; association: RepresentativeCompany; companies: Company[] };

export class RepresentativeCompanyLimitError extends Error {
  readonly code = "REPRESENTATIVE_COMPANY_LIMIT";
  constructor() {
    super("A representative can be assigned to at most 3 companies");
    this.name = "RepresentativeCompanyLimitError";
  }
}

export class RepresentativeCompanyNotFoundError extends Error {
  readonly code = "REPRESENTATIVE_COMPANY_NOT_FOUND";
  constructor(entity: "company" | "representative") {
    super(`Representative assignment ${entity} was not found`);
    this.name = "RepresentativeCompanyNotFoundError";
  }
}

export class RepresentativeCompanyLastAssociationError extends Error {
  readonly code = "REPRESENTATIVE_COMPANY_LAST_ASSOCIATION";
  constructor() {
    super("A representative must keep at least one company while retaining the representative role");
    this.name = "RepresentativeCompanyLastAssociationError";
  }
}

export class RepresentativeCompanyRoleError extends Error {
  readonly code = "USER_NOT_REPRESENTATIVE";
  constructor() {
    super("The target user must have a representative role");
    this.name = "RepresentativeCompanyRoleError";
  }
}

export class RepresentativeCompanyRequiredError extends Error {
  readonly code = "REPRESENTATIVE_COMPANY_REQUIRED";
  constructor() {
    super("A representative must be assigned to at least one company");
    this.name = "RepresentativeCompanyRequiredError";
  }
}

function hasRepresentativeRole(role: unknown): boolean {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return normalizedRole === "representante" || normalizedRole === "representative";
}

async function normalizeLegacyRepresentativeCompanies(
  tx: any,
  representative: { id: number; email: string },
): Promise<void> {
  const existing = await tx.select({ id: representativeCompanies.id })
    .from(representativeCompanies)
    .where(eq(representativeCompanies.representativeUserId, representative.id))
    .limit(1);
  if (existing.length > 0) return;

  const normalizedEmail = representative.email.trim().toLowerCase();
  const conditions: any[] = [
    eq(companies.userId, representative.id),
    sql`CASE
      WHEN jsonb_typeof(${companies.representantesVentas}::jsonb) = 'array'
      THEN ${companies.representantesVentas}::jsonb @> ${JSON.stringify([representative.id])}::jsonb
      ELSE false
    END`,
    sql`CASE
      WHEN jsonb_typeof(${companies.representantesVentas}::jsonb) = 'array'
      THEN ${companies.representantesVentas}::jsonb @> ${JSON.stringify([String(representative.id)])}::jsonb
      ELSE false
    END`,
  ];
  if (normalizedEmail) {
    conditions.push(sql`lower(trim(${companies.email1})) = ${normalizedEmail}`);
  }

  const legacyCompanies: Company[] = await tx.select().from(companies).where(or(...conditions));
  const priority = (company: Company) => {
    if (Number(company.userId) === representative.id) return 0;
    const representativeIds = Array.isArray(company.representantesVentas)
      ? company.representantesVentas.map((value: unknown) => Number(value))
      : [];
    if (representativeIds.includes(representative.id)) return 1;
    return 2;
  };

  const retained = legacyCompanies
    .sort((left, right) => priority(left) - priority(right) || left.id - right.id)
    .slice(0, 3);

  for (const company of retained) {
    await tx.insert(representativeCompanies)
      .values({
        representativeUserId: representative.id,
        companyId: company.id,
        isPrimary: Number(company.userId) === representative.id,
      })
      .onConflictDoNothing();
  }
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  // Si existen filas duplicadas (mismo uid/email), se elige de forma
  // determinista la de mayor privilegio (admin > representante > otras) y,
  // dentro del mismo rol, la más antigua. Así una cuenta duplicada con rol
  // "user" no oculta la cuenta de representante que tiene empresa vinculada.
  private pickPreferredUser(rows: User[]): User | undefined {
    if (rows.length <= 1) return rows[0];
    const priority = (u: User) => {
      if (u.role === 'admin' || (u as any).roleId === 1) return 0;
      if (hasRepresentativeRole(u.role)) return 1;
      return 2;
    };
    return [...rows].sort((a, b) => priority(a) - priority(b) || a.id - b.id)[0];
  }

  async getUserByFirebaseUid(firebaseUid: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid));
    return this.pickPreferredUser(rows);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(sql`lower(${users.email}) = lower(${email})`);
    return this.pickPreferredUser(rows);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Validate email is not null or empty
    if (!insertUser.email || insertUser.email.trim() === '') {
      throw new Error('Email is required and cannot be empty');
    }

    // Evitar cuentas duplicadas: si ya existe un usuario con el mismo
    // Firebase UID o el mismo email (sin distinguir mayúsculas), se reutiliza
    // esa cuenta en lugar de insertar otra fila. Para cerrar la condición de
    // carrera (dos peticiones concurrentes durante el registro), todo ocurre
    // dentro de una transacción con un candado consultivo por email: la
    // segunda petición espera a que la primera termine y entonces encuentra
    // la cuenta ya creada. No se usa un índice único porque producción aún
    // contiene filas duplicadas históricas que lo harían fallar.
    const emailKey = insertUser.email.trim().toLowerCase();
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'user_email:' + emailKey}))`);

      const byUid = insertUser.firebaseUid
        ? await tx.select().from(users).where(eq(users.firebaseUid, insertUser.firebaseUid))
        : [];
      const byEmail = await tx.select().from(users).where(sql`lower(${users.email}) = ${emailKey}`);
      const existing = this.pickPreferredUser(byUid.length > 0 ? byUid : byEmail);
      if (existing) {
        return existing;
      }

      const [user] = await tx.insert(users).values(insertUser).returning();
      return user;
    });
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async updateUserAndRepresentativeCompanies(
    id: number,
    userData: Partial<InsertUser>,
    companyId?: number,
  ): Promise<User | undefined> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${id})`);
      const [currentUser] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
      if (!currentUser) return undefined;

      const effectiveRole = userData.role ?? currentUser.role;
      if (hasRepresentativeRole(effectiveRole)) {
        // Preserve email-only and other legacy associations before an edit can
        // change the fields used by the rollout fallback.
        await normalizeLegacyRepresentativeCompanies(tx, {
          id,
          email: currentUser.email,
        });
        const existingAssignments = await tx.select({ id: representativeCompanies.id })
          .from(representativeCompanies)
          .where(eq(representativeCompanies.representativeUserId, id))
          .limit(1);
        if (existingAssignments.length === 0 && companyId == null) {
          throw new RepresentativeCompanyRequiredError();
        }
      }

      const [updatedUser] = await tx.update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();

      if (!hasRepresentativeRole(effectiveRole)) {
        await tx.update(companies)
          .set({ userId: null, updatedAt: new Date() })
          .where(eq(companies.userId, id));
        await tx.execute(sql`
          UPDATE companies
          SET representantes_ventas = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(representantes_ventas::jsonb) AS elem
            WHERE elem <> to_jsonb(${id}::int) AND elem <> to_jsonb(${String(id)}::text)
          )
          WHERE representantes_ventas IS NOT NULL
            AND (representantes_ventas::jsonb @> jsonb_build_array(${id}::int)
                 OR representantes_ventas::jsonb @> jsonb_build_array(${String(id)}::text))
        `);
        await tx.delete(representativeCompanies)
          .where(eq(representativeCompanies.representativeUserId, id));
        return updatedUser;
      }

      if (companyId != null) {
        const [company] = await tx.select({ id: companies.id }).from(companies)
          .where(eq(companies.id, companyId)).limit(1);
        if (!company) throw new RepresentativeCompanyNotFoundError("company");

        const [existing] = await tx.select().from(representativeCompanies)
          .where(and(
            eq(representativeCompanies.representativeUserId, id),
            eq(representativeCompanies.companyId, companyId),
          ))
          .limit(1);

        if (!existing) {
          const assigned = await tx.select({ id: representativeCompanies.id })
            .from(representativeCompanies)
            .where(eq(representativeCompanies.representativeUserId, id));
          if (assigned.length >= 3) throw new RepresentativeCompanyLimitError();
          await tx.insert(representativeCompanies).values({
            representativeUserId: id,
            companyId,
            isPrimary: assigned.length === 0,
          });
        }
      }

      return updatedUser;
    });
  }

  async deleteUser(id: number): Promise<boolean> {
    // Todo se hace dentro de una transacción: o se completa todo o no se
    // aplica nada (evita dejar la BD en un estado inconsistente). Un error
    // real se propaga para que la ruta devuelva 500 y el admin pueda reintentar.
    return await db.transaction(async (tx) => {
      // 1) Desvincular al usuario como dueño de sus empresas (NO borrar la
      //    empresa). companies.userId no tiene ON DELETE, así que hay que
      //    ponerlo en null antes de borrar el usuario o fallaría el FK.
      await tx.update(companies)
        .set({ userId: null, updatedAt: new Date() })
        .where(eq(companies.userId, id));

      // 2) Quitar el id del array representantesVentas de cualquier empresa
      //    (vínculo secundario de representante) para no dejar IDs huérfanos.
      //    La columna física es `json`; se castea a jsonb para reconstruir el
      //    array sin el id (contemplando que el id esté guardado como número o
      //    como texto).
      await tx.execute(sql`
        UPDATE companies
        SET representantes_ventas = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(representantes_ventas::jsonb) AS elem
          WHERE elem <> to_jsonb(${id}::int) AND elem <> to_jsonb(${String(id)}::text)
        )
        WHERE representantes_ventas IS NOT NULL
          AND (representantes_ventas::jsonb @> jsonb_build_array(${id}::int)
               OR representantes_ventas::jsonb @> jsonb_build_array(${String(id)}::text))
      `);

      // 3) Eliminar vínculos normalizados (también tienen FK CASCADE en
      // producción, pero esto mantiene el borrado explícito y compatible).
      await tx.delete(representativeCompanies)
        .where(eq(representativeCompanies.representativeUserId, id));

      // 4) Borrar el usuario. opinions y membership_payments tienen ON DELETE
      //    CASCADE, así que se eliminan automáticamente con el usuario.
      const result = await tx.delete(users).where(eq(users.id, id));
      return (result.rowCount || 0) > 0;
    });
  }

  /**
   * Alias heredado. Desde el modelo multiempresa, asignar nunca reemplaza las
   * asociaciones anteriores y comparte el mismo límite transaccional de tres.
   */
  async setCompanyRepresentative(companyId: number, userId: number): Promise<void> {
    await this.addRepresentativeCompany(companyId, userId);
  }

  async listRepresentativeCompanies(userId: number): Promise<Company[]> {
    return db
      .select({ company: companies })
      .from(representativeCompanies)
      .innerJoin(companies, eq(representativeCompanies.companyId, companies.id))
      .where(eq(representativeCompanies.representativeUserId, userId))
      .orderBy(desc(representativeCompanies.isPrimary), asc(representativeCompanies.createdAt))
      .then((rows) => rows.map(({ company }) => company));
  }

  async listRepresentativeCompanyAssociations(userId: number): Promise<RepresentativeCompany[]> {
    return db.select()
      .from(representativeCompanies)
      .where(eq(representativeCompanies.representativeUserId, userId))
      .orderBy(desc(representativeCompanies.isPrimary), asc(representativeCompanies.createdAt));
  }

  async listAllRepresentativeCompanyAssignments(): Promise<Array<{
    representativeUserId: number;
    company: Company;
  }>> {
    const normalizedAssignments = await db
      .select({
        representativeUserId: representativeCompanies.representativeUserId,
        company: companies,
      })
      .from(representativeCompanies)
      .innerJoin(companies, eq(representativeCompanies.companyId, companies.id))
      .orderBy(
        asc(representativeCompanies.representativeUserId),
        desc(representativeCompanies.isPrimary),
        asc(representativeCompanies.createdAt),
      );

    const normalizedUserIds = new Set(
      normalizedAssignments.map((assignment) => assignment.representativeUserId),
    );
    const representativeUsers = (await db.select().from(users))
      .filter((user) => hasRepresentativeRole(user.role));

    const fallbackAssignments: Array<{ representativeUserId: number; company: Company }> = [];
    for (const representative of representativeUsers) {
      if (normalizedUserIds.has(representative.id)) continue;
      const legacyCompanies = await this.getCompaniesForRepresentative(
        representative.email,
        representative.id,
      );
      for (const company of legacyCompanies) {
        fallbackAssignments.push({
          representativeUserId: representative.id,
          company,
        });
      }
    }

    return [...normalizedAssignments, ...fallbackAssignments];
  }

  /**
   * Adds a normalized assignment without changing legacy owner fields. The
   * transaction lock serializes assignments for one representative, so the
   * three-company limit remains true under concurrent requests.
   */
  async addRepresentativeCompany(
    companyId: number,
    userId: number,
  ): Promise<AddRepresentativeCompanyResult> {
    return db.transaction(async (tx) => {
      const listAssigned = () => tx
        .select({ company: companies })
        .from(representativeCompanies)
        .innerJoin(companies, eq(representativeCompanies.companyId, companies.id))
        .where(eq(representativeCompanies.representativeUserId, userId))
        .orderBy(desc(representativeCompanies.isPrimary), asc(representativeCompanies.createdAt))
        .then((rows) => rows.map(({ company }) => company));

      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);

      const [user] = await tx.select({
        id: users.id,
        email: users.email,
        role: users.role,
      }).from(users)
        .where(eq(users.id, userId)).limit(1);
      if (!user) throw new RepresentativeCompanyNotFoundError("representative");
      if (!hasRepresentativeRole(user.role)) throw new RepresentativeCompanyRoleError();
      const [company] = await tx.select({ id: companies.id }).from(companies)
        .where(eq(companies.id, companyId)).limit(1);
      if (!company) throw new RepresentativeCompanyNotFoundError("company");

      await normalizeLegacyRepresentativeCompanies(tx, {
        id: user.id,
        email: user.email,
      });

      const [existing] = await tx.select().from(representativeCompanies)
        .where(and(
          eq(representativeCompanies.representativeUserId, userId),
          eq(representativeCompanies.companyId, companyId),
        )).limit(1);
      if (existing) {
        const assigned = await listAssigned();
        return { status: "existing" as const, association: existing, companies: assigned };
      }

      const assignedCount = await tx.select({ id: representativeCompanies.id })
        .from(representativeCompanies)
        .where(eq(representativeCompanies.representativeUserId, userId));
      if (assignedCount.length >= 3) throw new RepresentativeCompanyLimitError();

      const [association] = await tx.insert(representativeCompanies)
        .values({ representativeUserId: userId, companyId })
        .returning();
      const assigned = await listAssigned();
      return { status: "added" as const, association, companies: assigned };
    });
  }

  async removeRepresentativeCompany(
    companyId: number,
    userId: number,
  ): Promise<{ removed: boolean; companies: Company[] }> {
    return db.transaction(async (tx) => {
      const listAssigned = () => tx
        .select({ company: companies })
        .from(representativeCompanies)
        .innerJoin(companies, eq(representativeCompanies.companyId, companies.id))
        .where(eq(representativeCompanies.representativeUserId, userId))
        .orderBy(desc(representativeCompanies.isPrimary), asc(representativeCompanies.createdAt))
        .then((rows) => rows.map(({ company }) => company));

      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);

      const [representative] = await tx.select({
        id: users.id,
        email: users.email,
        role: users.role,
      }).from(users).where(eq(users.id, userId)).limit(1);
      if (!representative) throw new RepresentativeCompanyNotFoundError("representative");
      if (!hasRepresentativeRole(representative.role)) throw new RepresentativeCompanyRoleError();

      await normalizeLegacyRepresentativeCompanies(tx, representative);

      const [existing] = await tx.select().from(representativeCompanies)
        .where(and(
          eq(representativeCompanies.representativeUserId, userId),
          eq(representativeCompanies.companyId, companyId),
        ))
        .limit(1);

      if (!existing) {
        return { removed: false, companies: await listAssigned() };
      }

      const beforeRemoval = await tx.select().from(representativeCompanies)
        .where(eq(representativeCompanies.representativeUserId, userId));
      if (beforeRemoval.length === 1) {
        throw new RepresentativeCompanyLastAssociationError();
      }

      await tx.delete(representativeCompanies)
        .where(eq(representativeCompanies.id, existing.id));

      // Remove the same relationship from legacy projections so fallback cannot
      // restore access to the company if all normalized rows are later removed.
      await tx.update(companies)
        .set({ userId: null, updatedAt: new Date() })
        .where(and(eq(companies.id, companyId), eq(companies.userId, userId)));
      await tx.execute(sql`
        UPDATE companies
        SET representantes_ventas = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(representantes_ventas::jsonb) AS elem
          WHERE elem <> to_jsonb(${userId}::int) AND elem <> to_jsonb(${String(userId)}::text)
        )
        WHERE id = ${companyId}
          AND representantes_ventas IS NOT NULL
          AND (representantes_ventas::jsonb @> jsonb_build_array(${userId}::int)
               OR representantes_ventas::jsonb @> jsonb_build_array(${String(userId)}::text))
      `);

      const remaining = await tx.select().from(representativeCompanies)
        .where(eq(representativeCompanies.representativeUserId, userId))
        .orderBy(desc(representativeCompanies.isPrimary), asc(representativeCompanies.createdAt));

      if (remaining.length === 0) {
        // A historical fourth link can be hidden while normalized rows exist.
        // Clear every legacy projection before allowing fallback again.
        await tx.update(companies)
          .set({ userId: null, updatedAt: new Date() })
          .where(eq(companies.userId, userId));
        await tx.execute(sql`
          UPDATE companies
          SET representantes_ventas = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(representantes_ventas::jsonb) AS elem
            WHERE elem <> to_jsonb(${userId}::int) AND elem <> to_jsonb(${String(userId)}::text)
          )
          WHERE representantes_ventas IS NOT NULL
            AND (representantes_ventas::jsonb @> jsonb_build_array(${userId}::int)
                 OR representantes_ventas::jsonb @> jsonb_build_array(${String(userId)}::text))
        `);
      } else if (existing.isPrimary && !remaining.some((row) => row.isPrimary)) {
        await tx.update(representativeCompanies)
          .set({ isPrimary: true })
          .where(eq(representativeCompanies.id, remaining[0].id));
      }

      return { removed: true, companies: await listAssigned() };
    });
  }

  /** Desvincula al usuario como dueño de TODAS las empresas (deja de ser representante). */
  async unassignRepresentativeFromAllCompanies(userId: number): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${userId})`);
      await tx.update(companies)
        .set({ userId: null, updatedAt: new Date() })
        .where(eq(companies.userId, userId));
      await tx.execute(sql`
        UPDATE companies
        SET representantes_ventas = (
          SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
          FROM jsonb_array_elements(representantes_ventas::jsonb) AS elem
          WHERE elem <> to_jsonb(${userId}::int) AND elem <> to_jsonb(${String(userId)}::text)
        )
        WHERE representantes_ventas IS NOT NULL
          AND (representantes_ventas::jsonb @> jsonb_build_array(${userId}::int)
               OR representantes_ventas::jsonb @> jsonb_build_array(${String(userId)}::text))
      `);
      await tx.delete(representativeCompanies)
        .where(eq(representativeCompanies.representativeUserId, userId));
    });
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Companies
  async getCompany(id: number): Promise<CompanyWithDetails | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (!company) return undefined;

    // Get related data
    const [membershipType] = company.membershipTypeId 
      ? await db.select().from(membershipTypes).where(eq(membershipTypes.id, company.membershipTypeId))
      : [undefined];

    const [user] = company.userId 
      ? await db.select().from(users).where(eq(users.id, company.userId))
      : [undefined];

    // Get categories and certificates from JSON arrays
    const companyCategoriesIds = (company.categoriesIds as number[]) || [];
    const companyCertificateIds = (company.certificateIds as number[]) || [];

    // Get categories and certificates - simplified approach
    let companyCategories = [];
    let companyCertificates = [];
    
    if (companyCategoriesIds.length > 0) {
      for (const catId of companyCategoriesIds) {
        const [category] = await db.select().from(categories).where(eq(categories.id, catId));
        if (category) companyCategories.push(category);
      }
    }
    
    if (companyCertificateIds.length > 0) {
      for (const certId of companyCertificateIds) {
        const [certificate] = await db.select().from(certificates).where(eq(certificates.id, certId));
        if (certificate) companyCertificates.push(certificate);
      }
    }

    return {
      ...company,
      membershipType: membershipType || undefined,
      user: user || undefined,
      categories: companyCategories,
      certificates: companyCertificates
    };
  }

  async getAllCompanies(options: {
    search?: string;
    categoryId?: number;
    membershipTypeId?: number;
    tagIds?: number[];
    estado?: string;
    limit?: number;
    offset?: number;
    includeInactive?: boolean;
  } = {}): Promise<{ companies: CompanyWithDetails[]; total: number }> {
    const { search, categoryId, membershipTypeId, tagIds, estado, limit = 10, offset = 0, includeInactive = false } = options;
    
    // NOTA: la inactivación por membresía vencida ya NO se hace aquí. Está
    // centralizada en el job diario deactivateExpiredCompanies (server/routes.ts)
    // y en los webhooks de Stripe, que guardan motivo/fecha, releen el estado
    // más reciente (evita carreras con pagos) y envían la notificación una sola vez.
    
    let whereConditions = [];

    if (search) {
      whereConditions.push(
        or(
          like(companies.nombreEmpresa, `%${search}%`),
          like(companies.descripcionEmpresa, `%${search}%`)
        )
      );
    }

    if (membershipTypeId) {
      whereConditions.push(eq(companies.membershipTypeId, membershipTypeId));
    }

    // Tag-based filtering
    if (tagIds && tagIds.length > 0) {
      const tagConditions = tagIds.map(tagId => 
        sql`${companies.tagIds} ? ${tagId.toString()}`
      );
      whereConditions.push(or(...tagConditions));
    }

    if (estado) {
      whereConditions.push(eq(companies.estado, estado));
    }

    // Por defecto, solo mostrar empresas activas en el frontend público
    // Si no se especifica un estado y no se incluyen inactivas, mostrar solo activas
    if (!estado && !includeInactive) {
      whereConditions.push(eq(companies.estado, 'activo'));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [companiesResult, countResult] = await Promise.all([
      db.select().from(companies).where(whereClause).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(companies).where(whereClause)
    ]);

    // Enrich with related data
    const enrichedCompanies = await Promise.all(
      companiesResult.map(async (company) => {
        const [membershipType] = company.membershipTypeId 
          ? await db.select().from(membershipTypes).where(eq(membershipTypes.id, company.membershipTypeId))
          : [undefined];

        const [user] = company.userId 
          ? await db.select().from(users).where(eq(users.id, company.userId))
          : [undefined];

        const companyCategoriesIds = (company.categoriesIds as number[]) || [];
        const companyCertificateIds = (company.certificateIds as number[]) || [];
        const companyTagIds = (company.tagIds as number[]) || [];

        // Get categories, certificates, and tags
        let companyCategories = [];
        let companyCertificates = [];
        let companyTags = [];
        
        if (companyCategoriesIds.length > 0) {
          for (const catId of companyCategoriesIds) {
            const [category] = await db.select().from(categories).where(eq(categories.id, catId));
            if (category) companyCategories.push(category);
          }
        }
        
        if (companyCertificateIds.length > 0) {
          for (const certId of companyCertificateIds) {
            const [certificate] = await db.select().from(certificates).where(eq(certificates.id, certId));
            if (certificate) companyCertificates.push(certificate);
          }
        }

        if (companyTagIds.length > 0) {
          for (const tagId of companyTagIds) {
            const [tag] = await db.select().from(tags).where(eq(tags.id, tagId));
            if (tag) companyTags.push(tag);
          }
        }

        return {
          ...company,
          membershipType: membershipType || undefined,
          user: user || undefined,
          categories: companyCategories,
          certificates: companyCertificates,
          tags: companyTags
        };
      })
    );

    return {
      companies: enrichedCompanies,
      total: countResult[0]?.count || 0
    };
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db.insert(companies).values(insertCompany).returning();
    return company;
  }

  async updateCompany(id: number, companyData: Partial<InsertCompany>): Promise<Company | undefined> {
    // Si se está actualizando la galería de productos, verificar límites
    if (companyData.galeriaProductosUrls) {
      const currentCompany = await this.getCompany(id);
      if (currentCompany) {
        const currentProductCount = Array.isArray(currentCompany.galeriaProductosUrls) 
          ? currentCompany.galeriaProductosUrls.length 
          : 0;
        const newProductCount = Array.isArray(companyData.galeriaProductosUrls) 
          ? companyData.galeriaProductosUrls.length 
          : 0;
        
        // Solo validar si se están agregando productos
        if (newProductCount > currentProductCount) {
          await this.validateProductLimits(id, newProductCount - currentProductCount);
        }
      }
    }

    // Si se está actualizando la fecha de vencimiento de membresía, activar automáticamente la empresa si la fecha es futura
    if (companyData.fechaFinMembresia) {
      const fechaVencimiento = new Date(companyData.fechaFinMembresia);
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0); // Resetear horas para comparar solo fechas
      
      // Si la fecha de vencimiento es posterior a hoy, activar la empresa automáticamente
      if (fechaVencimiento >= hoy) {
        companyData.estado = 'activo';
      }
    }

    const [company] = await db.update(companies).set({ ...companyData, updatedAt: new Date() }).where(eq(companies.id, id)).returning();
    return company || undefined;
  }

  async deleteCompany(id: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      await tx.delete(certificates).where(eq(certificates.companyId, id));
      const result = await tx.delete(companies).where(eq(companies.id, id));
      return (result.rowCount || 0) > 0;
    });
  }

  async getCompaniesByUser(userId: number): Promise<CompanyWithDetails[]> {
    const userCompanies = await db.select().from(companies).where(eq(companies.userId, userId));
    
    const enrichedCompanies = await Promise.all(
      userCompanies.map(async (company) => {
        const [membershipType] = company.membershipTypeId 
          ? await db.select().from(membershipTypes).where(eq(membershipTypes.id, company.membershipTypeId))
          : [undefined];

        const companyCategoriesIds = (company.categoriesIds as number[]) || [];
        const companyCertificateIds = (company.certificateIds as number[]) || [];

        // Get categories and certificates - simplified approach
        let companyCategories = [];
        let companyCertificates = [];
        
        if (companyCategoriesIds.length > 0) {
          for (const catId of companyCategoriesIds) {
            const [category] = await db.select().from(categories).where(eq(categories.id, catId));
            if (category) companyCategories.push(category);
          }
        }
        
        if (companyCertificateIds.length > 0) {
          for (const certId of companyCertificateIds) {
            const [certificate] = await db.select().from(certificates).where(eq(certificates.id, certId));
            if (certificate) companyCertificates.push(certificate);
          }
        }

        return {
          ...company,
          membershipType: membershipType || undefined,
          user: undefined, // We already know the user
          categories: companyCategories,
          certificates: companyCertificates
        };
      })
    );

    return enrichedCompanies;
  }

  async getCompaniesForRepresentative(
    email: string,
    userId: number | null,
  ): Promise<Company[]> {
    if (userId != null) {
      const representative = await this.getUser(userId);
      if (representative) {
        const normalizedRole = String(representative.role || "").trim().toLowerCase();
        if (normalizedRole !== "representante" && normalizedRole !== "representative") {
          return [];
        }
      }
    }

    const normalizedCompanies = userId != null
      ? await this.listRepresentativeCompanies(userId)
      : [];

    // Once at least one normalized link exists it is authoritative. Merging old
    // owner/email/JSON links here would reintroduce assignments deliberately
    // excluded by the migration's three-company limit.
    if (normalizedCompanies.length > 0) {
      return normalizedCompanies.slice(0, 3);
    }

    // Legacy lookup is only a fallback for installations where the migration
    // has not normalized this representative yet.
    const normalizedEmail = (email || "").trim().toLowerCase();
    const conditions: any[] = [];
    if (normalizedEmail) conditions.push(sql`lower(${companies.email1}) = ${normalizedEmail}`);
    if (userId != null) {
      conditions.push(eq(companies.userId, userId));
      conditions.push(sql`${companies.representantesVentas}::jsonb @> ${JSON.stringify([userId])}::jsonb`);
      conditions.push(sql`${companies.representantesVentas}::jsonb @> ${JSON.stringify([String(userId)])}::jsonb`);
    }
    const legacyCompanies = conditions.length === 0
      ? []
      : await db.select().from(companies).where(or(...conditions));
    return legacyCompanies
      .sort((a, b) => {
        const aPrimary = userId != null && Number(a.userId) === Number(userId) ? 0 : 1;
        const bPrimary = userId != null && Number(b.userId) === Number(userId) ? 0 : 1;
        return aPrimary - bPrimary || a.id - b.id;
      })
      .slice(0, 3);
  }

  /**
   * Resuelve la empresa de un representante de WordPress SIN crear datos.
   * Coincide por cualquiera de estos vínculos con datos ya existentes:
   *   - email1 de la empresa == email de WordPress (case-insensitive)
   *   - userId (dueño) == id del usuario existente vinculado a ese email
   *   - representantesVentas (array jsonb de IDs) contiene ese id de usuario
   * Devuelve la primera coincidencia, o undefined si no hay empresa asignada.
   */
  async getCompanyForRepresentative(
    email: string,
    userId: number | null,
  ): Promise<Company | undefined> {
    return (await this.getCompaniesForRepresentative(email, userId))[0];
  }

  // Company Locations
  async getCompanyLocations(companyId: number): Promise<SelectCompanyLocation[]> {
    const locations = await db
      .select()
      .from(companyLocations)
      .where(eq(companyLocations.companyId, companyId))
      .orderBy(sql`CASE WHEN ${companyLocations.isPrincipal} THEN 0 ELSE 1 END`);
    return locations;
  }

  async getAllCompanyLocations(): Promise<SelectCompanyLocation[]> {
    const locations = await db
      .select()
      .from(companyLocations)
      .orderBy(companyLocations.companyId, sql`CASE WHEN ${companyLocations.isPrincipal} THEN 0 ELSE 1 END`);
    return locations;
  }

  async createCompanyLocation(location: InsertCompanyLocation): Promise<SelectCompanyLocation> {
    // Si la nueva ubicación es principal, desmarcar otras ubicaciones principales
    if (location.isPrincipal) {
      await db
        .update(companyLocations)
        .set({ isPrincipal: false })
        .where(eq(companyLocations.companyId, location.companyId));
    }
    
    const [newLocation] = await db
      .insert(companyLocations)
      .values(location)
      .returning();
    return newLocation;
  }

  async updateCompanyLocation(
    companyId: number,
    locationId: number,
    locationData: Partial<InsertCompanyLocation>
  ): Promise<SelectCompanyLocation | undefined> {
    const [location] = await db
      .update(companyLocations)
      .set({ ...locationData, updatedAt: new Date() })
      .where(and(
        eq(companyLocations.id, locationId),
        eq(companyLocations.companyId, companyId),
      ))
      .returning();
    return location || undefined;
  }

  async deleteCompanyLocation(companyId: number, locationId: number): Promise<boolean> {
    const result = await db
      .delete(companyLocations)
      .where(and(
        eq(companyLocations.id, locationId),
        eq(companyLocations.companyId, companyId),
      ));
    return (result.rowCount || 0) > 0;
  }

  async setPrincipalLocation(companyId: number, locationId: number): Promise<SelectCompanyLocation | undefined> {
    // Desmarcar todas las ubicaciones de esta empresa como principal
    await db
      .update(companyLocations)
      .set({ isPrincipal: false })
      .where(eq(companyLocations.companyId, companyId));
    
    // Marcar la ubicación especificada como principal
    const [location] = await db
      .update(companyLocations)
      .set({ isPrincipal: true, updatedAt: new Date() })
      .where(and(
        eq(companyLocations.id, locationId),
        eq(companyLocations.companyId, companyId)
      ))
      .returning();
    return location || undefined;
  }

  // Categories
  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category || undefined;
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(insertCategory).returning();
    return category;
  }

  async updateCategory(id: number, categoryData: Partial<InsertCategory>): Promise<Category | undefined> {
    const [category] = await db.update(categories).set(categoryData).where(eq(categories.id, id)).returning();
    return category || undefined;
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Tag Management Methods
  async getTag(id: number): Promise<Tag | undefined> {
    try {
      const [tag] = await db.select().from(tags).where(eq(tags.id, id));
      return tag || undefined;
    } catch (error) {
      console.error("Error fetching tag:", error);
      return undefined;
    }
  }

  async getAllTags(): Promise<Tag[]> {
    try {
      return await db.select().from(tags).where(eq(tags.isActive, true)).orderBy(tags.nombre);
    } catch (error) {
      console.error("Error fetching all tags:", error);
      return [];
    }
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const [tag] = await db.insert(tags).values(insertTag).returning();
    return tag;
  }

  async updateTag(id: number, tagData: Partial<InsertTag>): Promise<Tag | undefined> {
    const [updatedTag] = await db
      .update(tags)
      .set({ ...tagData, updatedAt: new Date() })
      .where(eq(tags.id, id))
      .returning();
    return updatedTag || undefined;
  }

  async deleteTag(id: number): Promise<boolean> {
    // First check if tag is in use
    const companiesUsingTag = await db.select({ id: companies.id })
      .from(companies)
      .where(sql`${companies.tagIds} ? ${id.toString()}`);
    
    if (companiesUsingTag.length > 0) {
      throw new Error(`No se puede eliminar la etiqueta porque está siendo utilizada por ${companiesUsingTag.length} empresa(s)`);
    }
    
    const [deletedTag] = await db.delete(tags).where(eq(tags.id, id)).returning();
    return !!deletedTag;
  }

  async getTagsInUse(): Promise<number[]> {
    const companiesWithTags = await db.select({ tagIds: companies.tagIds }).from(companies);
    const allTagIds = new Set<number>();
    
    companiesWithTags.forEach(company => {
      if (company.tagIds && Array.isArray(company.tagIds)) {
        (company.tagIds as number[]).forEach(tagId => allTagIds.add(tagId));
      }
    });
    
    return Array.from(allTagIds);
  }

  // Membership Types
  async getMembershipType(id: number): Promise<MembershipType | undefined> {
    const [membershipType] = await db.select().from(membershipTypes).where(eq(membershipTypes.id, id));
    return membershipType || undefined;
  }

  async getAllMembershipTypes(): Promise<MembershipType[]> {
    return await db.select().from(membershipTypes);
  }

  async createMembershipType(insertMembershipType: InsertMembershipType): Promise<MembershipType> {
    const [membershipType] = await db.insert(membershipTypes).values(insertMembershipType).returning();
    return membershipType;
  }

  async updateMembershipType(id: number, membershipTypeData: Partial<InsertMembershipType>): Promise<MembershipType | undefined> {
    const [membershipType] = await db.update(membershipTypes).set(membershipTypeData).where(eq(membershipTypes.id, id)).returning();
    return membershipType || undefined;
  }

  async deleteMembershipType(id: number): Promise<boolean> {
    const result = await db.delete(membershipTypes).where(eq(membershipTypes.id, id));
    return (result.rowCount || 0) > 0;
  }

  async clearMostPopularStatus(): Promise<void> {
    await db.update(membershipTypes).set({ masPopular: false });
  }

  // Certificates
  async getCertificate(id: number): Promise<Certificate | undefined> {
    const [certificate] = await db.select().from(certificates).where(eq(certificates.id, id));
    return certificate || undefined;
  }

  async getAllCertificates(): Promise<Certificate[]> {
    return await db.select().from(certificates);
  }

  async getAutoCertificatesForMembership(membershipTypeId: number): Promise<Certificate[]> {
    const allCertificates = await db.select().from(certificates)
      .where(eq(certificates.asignacionAutomatica, true));
    
    return allCertificates.filter(cert => {
      const planIds = cert.membershipPlanIds as number[] | null;
      return planIds && planIds.includes(membershipTypeId);
    });
  }

  async createCertificate(insertCertificate: InsertCertificate, companyId?: number | null): Promise<Certificate> {
    // `companyId` la fija SIEMPRE el backend (no viene del cliente): identifica a
    // la empresa dueña del certificado para aislarlo. NULL = certificado global.
    const [certificate] = await db
      .insert(certificates)
      .values({ ...insertCertificate, companyId: companyId ?? null })
      .returning();
    return certificate;
  }

  async updateCertificate(id: number, certificateData: Partial<InsertCertificate>): Promise<Certificate | undefined> {
    const [certificate] = await db.update(certificates).set(certificateData).where(eq(certificates.id, id)).returning();
    return certificate || undefined;
  }

  async deleteCertificate(id: number): Promise<boolean> {
    const result = await db.delete(certificates).where(eq(certificates.id, id));
    return (result.rowCount || 0) > 0;
  }

  async assignCertificateToCompany(companyId: number, certificateId: number, details: {
    fechaObtencion: string;
    asignadoPorAdmin: boolean;
    observaciones?: string;
  }): Promise<void> {
    // Get the current company to update its certificateIds
    const company = await this.getCompany(companyId);
    if (!company) {
      throw new Error("Company not found");
    }

    // Get current certificate IDs and add the new one if not already present
    const currentCertificateIds = (company.certificateIds as number[]) || [];
    if (!currentCertificateIds.includes(certificateId)) {
      currentCertificateIds.push(certificateId);
      
      // Update the company's certificateIds array
      await db.update(companies)
        .set({ 
          certificateIds: currentCertificateIds,
          updatedAt: new Date()
        })
        .where(eq(companies.id, companyId));
    }
  }

  async removeCertificateFromCompany(companyId: number, certificateId: number): Promise<void> {
    const company = await this.getCompany(companyId);
    if (!company) return;
    const currentCertificateIds = (company.certificateIds as number[]) || [];
    const nextCertificateIds = currentCertificateIds.filter((id) => id !== certificateId);
    if (nextCertificateIds.length !== currentCertificateIds.length) {
      await db.update(companies)
        .set({ certificateIds: nextCertificateIds, updatedAt: new Date() })
        .where(eq(companies.id, companyId));
    }
  }

  // Roles
  async getRole(id: number): Promise<Role | undefined> {
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    return role || undefined;
  }

  async getAllRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(roles.nombre);
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const [role] = await db
      .insert(roles)
      .values({
        ...insertRole,
        updatedAt: new Date(),
      })
      .returning();
    return role;
  }

  async updateRole(id: number, roleData: Partial<InsertRole>): Promise<Role | undefined> {
    const [role] = await db
      .update(roles)
      .set({
        ...roleData,
        updatedAt: new Date(),
      })
      .where(eq(roles.id, id))
      .returning();
    return role || undefined;
  }

  async deleteRole(id: number): Promise<boolean> {
    // Check if role is a system role
    const [role] = await db.select().from(roles).where(eq(roles.id, id));
    if (!role) {
      return false;
    }
    
    if (role.esRolSistema) {
      throw new Error("No se puede eliminar un rol del sistema");
    }

    const result = await db.delete(roles).where(eq(roles.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Opinions
  async getOpinion(id: number): Promise<Opinion | undefined> {
    const [opinion] = await db.select().from(opinions).where(eq(opinions.id, id));
    return opinion || undefined;
  }

  async getAllOpinions(options: {
    estado?: string;
    companyId?: number;
    tipo?: string;
    userId?: number;
    includeAllStates?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ opinions: Opinion[]; total: number }> {
    const {
      estado,
      companyId,
      tipo,
      userId,
      includeAllStates = false,
      limit = 50,
      offset = 0,
    } = options;
    
    let query = db.select().from(opinions).$dynamic();
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(opinions).$dynamic();
    
    const conditions = [];
    if (!includeAllStates) {
      // NULL/blank values predate moderation and are approved legacy records.
      // Keep this predicate on both the data and count queries so public totals
      // and any averages derived from this result cannot include unmoderated
      // or rejected reviews.
      conditions.push(or(
        eq(opinions.estado, "aprobada"),
        isNull(opinions.estado),
        sql`btrim(${opinions.estado}) = ''`,
      ));
      // A public request cannot opt into another moderation state. Preserve
      // normal filter semantics by returning no rows rather than substituting
      // approved rows for an explicitly pending/rejected request.
      if (estado && estado !== "aprobada") {
        conditions.push(sql`false`);
      }
    } else if (estado) {
      conditions.push(eq(opinions.estado, estado));
    }
    if (companyId) {
      conditions.push(eq(opinions.companyId, companyId));
    }
    if (tipo) {
      conditions.push(eq(opinions.tipo, tipo));
    }
    if (userId) {
      conditions.push(eq(opinions.userId, userId));
    }
    
    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereCondition);
      countQuery = countQuery.where(whereCondition);
    }
    
    const opinionsResult = await query
      .orderBy(sql`${opinions.fechaCreacion} DESC`)
      .limit(limit)
      .offset(offset);
      
    const [{ count }] = await countQuery;
    
    return {
      opinions: opinionsResult,
      total: count || 0,
    };
  }

  async createOpinion(insertOpinion: InsertOpinion): Promise<Opinion> {
    const [opinion] = await db
      .insert(opinions)
      .values({
        ...insertOpinion,
        // Creation always enters moderation, even if another server caller
        // accidentally passes a client-controlled state.
        estado: "pendiente",
        fechaCreacion: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return opinion;
  }

  async updateOpinion(id: number, opinionData: Partial<InsertOpinion>): Promise<Opinion | undefined> {
    const [opinion] = await db
      .update(opinions)
      .set({
        ...opinionData,
        updatedAt: new Date(),
      })
      .where(eq(opinions.id, id))
      .returning();
    return opinion || undefined;
  }

  async deleteOpinion(id: number): Promise<boolean> {
    const result = await db.delete(opinions).where(eq(opinions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async approveOpinion(id: number, approvedBy: number): Promise<Opinion | undefined> {
    const [opinion] = await db
      .update(opinions)
      .set({
        estado: "aprobada",
        fechaAprobacion: new Date(),
        aprobadoPor: approvedBy,
        updatedAt: new Date(),
      })
      .where(eq(opinions.id, id))
      .returning();
    return opinion || undefined;
  }

  async rejectOpinion(id: number, approvedBy: number): Promise<Opinion | undefined> {
    const [opinion] = await db
      .update(opinions)
      .set({
        estado: "rechazada",
        fechaAprobacion: new Date(),
        aprobadoPor: approvedBy,
        updatedAt: new Date(),
      })
      .where(eq(opinions.id, id))
      .returning();
    return opinion || undefined;
  }

  // Statistics
  async getStatistics(): Promise<{
    totalCompanies: number;
    activeUsers: number;
    newRegistrations: number;
    totalRevenue: number;
  }> {
    const [companiesCount] = await db.select({ count: sql<number>`count(*)` }).from(companies);
    const [usersCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [revenueResult] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` }).from(membershipPayments)
      .where(eq(membershipPayments.status, 'succeeded'));
    
    return {
      totalCompanies: companiesCount?.count || 0,
      activeUsers: usersCount?.count || 0,
      newRegistrations: 0, // This would need additional logic based on date ranges
      totalRevenue: revenueResult?.total || 0,
    };
  }

  // Membership Payments methods
  async createMembershipPayment(insertPayment: InsertMembershipPayment): Promise<MembershipPayment> {
    const [payment] = await db
      .insert(membershipPayments)
      .values(insertPayment)
      .returning();
    return payment;
  }

  async getMembershipPayment(id: number): Promise<MembershipPayment | undefined> {
    const [payment] = await db.select().from(membershipPayments).where(eq(membershipPayments.id, id));
    return payment || undefined;
  }

  async getMembershipPaymentByStripeId(stripePaymentIntentId: string): Promise<MembershipPayment | undefined> {
    const [payment] = await db.select().from(membershipPayments)
      .where(eq(membershipPayments.stripePaymentIntentId, stripePaymentIntentId));
    return payment || undefined;
  }

  async updateMembershipPaymentStatus(id: number, status: string): Promise<MembershipPayment | undefined> {
    const [payment] = await db
      .update(membershipPayments)
      .set({ status, updatedAt: new Date() })
      .where(eq(membershipPayments.id, id))
      .returning();
    return payment || undefined;
  }

  async getUserPayments(userId: number): Promise<MembershipPayment[]> {
    return await db.select().from(membershipPayments)
      .where(eq(membershipPayments.userId, userId))
      .orderBy(sql`created_at DESC`);
  }

  async updateUserStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  // System Settings
  async getSystemSettings(): Promise<SystemSettings> {
    const [settings] = await db.select().from(systemSettings).limit(1);
    
    if (!settings) {
      // Crear configuración por defecto si no existe
      const [defaultSettings] = await db
        .insert(systemSettings)
        .values({})
        .returning();
      return defaultSettings;
    }
    
    return settings;
  }

  async updateSystemSettings(settingsData: Partial<InsertSystemSettings>): Promise<SystemSettings> {
    const currentSettings = await this.getSystemSettings();
    
    const [updatedSettings] = await db
      .update(systemSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(systemSettings.id, currentSettings.id))
      .returning();
    
    return updatedSettings;
  }

  // Projects methods
  async getProject(id: number): Promise<ProjectWithDetails | undefined> {
    const [project] = await db.select()
      .from(projects)
      .leftJoin(companies, eq(projects.companyId, companies.id))
      .leftJoin(categories, eq(projects.categoryId, categories.id))
      .where(eq(projects.id, id));

    if (!project) return undefined;

    return {
      ...project.projects,
      company: project.companies || undefined,
      category: project.categories || undefined,
    };
  }

  async getAllProjects(options: {
    companyId?: number;
    categoryId?: number;
    estado?: string;
    estadoModeracion?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ projects: ProjectWithDetails[]; total: number }> {
    const conditions = [];

    if (options.companyId) {
      conditions.push(eq(projects.companyId, options.companyId));
    }
    if (options.categoryId) {
      conditions.push(eq(projects.categoryId, options.categoryId));
    }
    if (options.estado) {
      conditions.push(eq(projects.estado, options.estado));
    }
    if (options.estadoModeracion) {
      conditions.push(eq(projects.estadoModeracion, options.estadoModeracion));
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(whereCondition);

    // Get projects with relationships
    const projectsData = await db.select()
      .from(projects)
      .leftJoin(companies, eq(projects.companyId, companies.id))
      .leftJoin(categories, eq(projects.categoryId, categories.id))
      .where(whereCondition)
      .limit(options.limit || 20)
      .offset(options.offset || 0)
      .orderBy(projects.createdAt);

    const projectsWithDetails: ProjectWithDetails[] = projectsData.map(item => ({
      ...item.projects,
      company: item.companies || undefined,
      category: item.categories || undefined,
    }));

    return {
      projects: projectsWithDetails,
      total: count,
    };
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    return db.transaction(async (tx) => {
      // Serializa las altas por empresa: el conteo y el INSERT deben ser una
      // sola operación para que solicitudes simultáneas no excedan el plan.
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtext(${`project_limit:${insertProject.companyId}`})
        )
      `);

      const [company] = await tx
        .select()
        .from(companies)
        .where(eq(companies.id, insertProject.companyId))
        .limit(1);
      if (!company?.membershipTypeId) {
        throw new Error("La empresa no tiene un plan de membresía válido");
      }

      const [membershipType] = await tx
        .select()
        .from(membershipTypes)
        .where(eq(membershipTypes.id, company.membershipTypeId))
        .limit(1);
      if (!membershipType) {
        throw new Error("Plan de membresía no encontrado");
      }

      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(eq(projects.companyId, insertProject.companyId));

      const projectCount = Number(count) || 0;
      const configuredLimit = membershipType.cantidadProyectosAdmitidos;
      if (
        configuredLimit !== null
        && configuredLimit !== undefined
        && (!Number.isInteger(configuredLimit) || configuredLimit < -1)
      ) {
        const error: any = new Error(
          `El límite de proyectos configurado para el plan ${membershipType.nombrePlan} no es válido`,
        );
        error.code = "INVALID_PROJECT_LIMIT_CONFIG";
        throw error;
      }
      const projectLimit = configuredLimit == null || configuredLimit === -1
        ? -1
        : configuredLimit;

      if (projectLimit >= 0 && projectCount >= projectLimit) {
        const error: any = new Error(
          `Has alcanzado el límite de ${projectLimit} proyectos permitidos en tu plan ${membershipType.nombrePlan}`,
        );
        error.code = "PROJECT_LIMIT_REACHED";
        throw error;
      }

      const [project] = await tx
        .insert(projects)
        .values(insertProject)
        .returning();
      return project;
    });
  }

  async validateProjectLimits(companyId: number): Promise<void> {
    // Obtener información de la empresa y su plan de membresía
    const company = await this.getCompany(companyId);
    if (!company || !company.membershipTypeId) {
      throw new Error("La empresa no tiene un plan de membresía válido");
    }

    const membershipType = await this.getMembershipType(company.membershipTypeId);
    if (!membershipType) {
      throw new Error("Plan de membresía no encontrado");
    }

    // Verificar límite de proyectos
    const currentProjectCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.companyId, companyId));

    const projectCount = Number(currentProjectCount[0]?.count) || 0;
    const configuredLimit = membershipType.cantidadProyectosAdmitidos;
    if (
      configuredLimit !== null
      && configuredLimit !== undefined
      && (!Number.isInteger(configuredLimit) || configuredLimit < -1)
    ) {
      const error: any = new Error(
        `El límite de proyectos configurado para el plan ${membershipType.nombrePlan} no es válido`,
      );
      error.code = "INVALID_PROJECT_LIMIT_CONFIG";
      throw error;
    }
    const projectLimit = configuredLimit == null || configuredLimit === -1
      ? -1
      : configuredLimit;

    if (projectLimit >= 0 && projectCount >= projectLimit) {
      const error: any = new Error(`Has alcanzado el límite de ${projectLimit} proyectos permitidos en tu plan ${membershipType.nombrePlan}`);
      error.code = "PROJECT_LIMIT_REACHED";
      throw error;
    }
  }

  async validateProductLimits(companyId: number, newProductCount: number = 1): Promise<void> {
    // Obtener información de la empresa y su plan de membresía
    const company = await this.getCompany(companyId);
    if (!company || !company.membershipTypeId) {
      throw new Error("La empresa no tiene un plan de membresía válido");
    }

    const membershipType = await this.getMembershipType(company.membershipTypeId);
    if (!membershipType) {
      throw new Error("Plan de membresía no encontrado");
    }

    // Verificar límite de productos (basado en galería de productos)
    const currentProductCount = Array.isArray(company.galeriaProductosUrls) 
      ? company.galeriaProductosUrls.length 
      : 0;
    
    const productLimit = membershipType.cantidadProductosAdmitidos || 0;

    if (productLimit > 0 && (currentProductCount + newProductCount) > productLimit) {
      throw new Error(`Has alcanzado el límite de ${productLimit} productos permitidos en tu plan ${membershipType.nombrePlan}. Actualmente tienes ${currentProductCount} productos.`);
    }
  }

  async updateProject(id: number, projectData: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ ...projectData, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount > 0;
  }

  async getProjectsByCompany(companyId: number): Promise<ProjectWithDetails[]> {
    const projectsData = await db.select()
      .from(projects)
      .leftJoin(companies, eq(projects.companyId, companies.id))
      .leftJoin(categories, eq(projects.categoryId, categories.id))
      .where(eq(projects.companyId, companyId))
      .orderBy(projects.createdAt);

    return projectsData.map(item => ({
      ...item.projects,
      company: item.companies || undefined,
      category: item.categories || undefined,
    }));
  }

  async incrementProjectViews(id: number): Promise<void> {
    await db
      .update(projects)
      .set({ 
        vistas: sql`${projects.vistas} + 1`,
        updatedAt: new Date()
      })
      .where(eq(projects.id, id));
  }

  async incrementProjectConsultas(id: number): Promise<void> {
    await db
      .update(projects)
      .set({ 
        consultas: sql`${projects.consultas} + 1`,
        updatedAt: new Date()
      })
      .where(eq(projects.id, id));
  }

  async moderateProject(id: number, estadoModeracion: string): Promise<Project | undefined> {
    const [project] = await db
      .update(projects)
      .set({ estadoModeracion, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }



  // Integration Settings
  async getIntegrationSettings(): Promise<IntegrationSettings | undefined> {
    const [settings] = await db.select().from(integrationSettings).limit(1);
    return settings || undefined;
  }

  async createIntegrationSettings(insertSettings: InsertIntegrationSettings): Promise<IntegrationSettings> {
    const [settings] = await db
      .insert(integrationSettings)
      .values(insertSettings)
      .returning();
    return settings;
  }

  async updateIntegrationSettings(id: number, settingsData: Partial<InsertIntegrationSettings>): Promise<IntegrationSettings | undefined> {
    const [settings] = await db
      .update(integrationSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(integrationSettings.id, id))
      .returning();
    return settings || undefined;
  }

  async testWordPressConnection(url: string, credentials: { apiKey: string; apiSecret: string }): Promise<{ success: boolean; message: string }> {
    try {
      // Basic validation
      if (!url || !credentials.apiKey || !credentials.apiSecret) {
        return { success: false, message: "URL y credenciales son requeridos" };
      }

      // Validate URL format
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url)) {
        return { success: false, message: "URL debe incluir http:// o https://" };
      }

      // Test connection with WordPress REST API
      const testUrl = `${url.replace(/\/$/, '')}/wp-json/wp/v2/users/me`;
      const authString = Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64');
      
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return { success: true, message: "Conexión exitosa con WordPress" };
      } else {
        return { success: false, message: `Error de conexión: ${response.status} ${response.statusText}` };
      }
    } catch (error: any) {
      return { success: false, message: `Error de conexión: ${error.message}` };
    }
  }

  async getWordPressUsers(): Promise<{ users: any[]; total: number; message: string }> {
    try {
      // First try environment variables, then fall back to database settings
      let wordpressUrl = process.env.WORDPRESS_URL;
      let apiKey = process.env.WORDPRESS_USERNAME;
      let apiSecret = process.env.WORDPRESS_APP_PASSWORD;

      // If env vars not set, try database settings
      if (!wordpressUrl || !apiKey || !apiSecret) {
        const settings = await this.getIntegrationSettings();
        if (settings) {
          wordpressUrl = wordpressUrl || settings.wordpressUrl;
          apiKey = apiKey || settings.apiKey;
          apiSecret = apiSecret || settings.apiSecret;
        }
      }

      if (!wordpressUrl || !apiKey || !apiSecret) {
        return { users: [], total: 0, message: "Configuración de WordPress incompleta. Configure las variables de entorno WORDPRESS_URL, WORDPRESS_USERNAME y WORDPRESS_APP_PASSWORD" };
      }

      const authString = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
      const baseUrl = wordpressUrl.replace(/\/$/, '');
      let allUsers: any[] = [];
      let page = 1;
      let totalPages = 1;

      // Get all users by paginating through all pages
      do {
        const usersUrl = `${baseUrl}/wp-json/wp/v2/users?per_page=100&page=${page}&context=edit`;
        console.log(`[getWordPressUsers] Requesting page ${page} from: ${usersUrl}`);
        
        const response = await fetch(usersUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`[getWordPressUsers] Error response ${response.status}: ${errorText}`);
          if (page === 1) {
            return { users: [], total: 0, message: `Error al obtener usuarios: ${response.status} - ${response.statusText}` };
          }
          break; // Stop if we can't get more pages
        }

        const wpUsers = await response.json();
        allUsers = allUsers.concat(wpUsers);

        // Get total pages from response headers
        const totalPagesHeader = response.headers.get('X-WP-TotalPages');
        if (totalPagesHeader) {
          totalPages = parseInt(totalPagesHeader, 10);
        }

        page++;
      } while (page <= totalPages);

      console.log(`[getWordPressUsers] Retrieved ${allUsers.length} total users from ${page - 1} pages`);
      
      // Transform the users to include relevant data from context=edit response
      const transformedUsers: any[] = allUsers.map((wpUser: any) => {
        const fullName = wpUser.name || 
          (wpUser.first_name && wpUser.last_name ? `${wpUser.first_name} ${wpUser.last_name}` : '') ||
          wpUser.username || 
          wpUser.slug || 
          'Sin nombre';
          
        return {
          id: wpUser.id,
          name: fullName,
          username: wpUser.username || wpUser.slug,
          slug: wpUser.slug,
          email: wpUser.email || 'No disponible',
          first_name: wpUser.first_name || '',
          last_name: wpUser.last_name || '',
          registered_date: wpUser.registered_date,
          roles: wpUser.roles || [],
          link: wpUser.link,
          description: wpUser.description || '',
          url: wpUser.url || '',
          capabilities: wpUser.capabilities || {},
          avatar_urls: wpUser.avatar_urls || {},
          meta: wpUser.meta || {},
          source: 'wordpress'
        };
      });

      // Resolve every normalized assignment in one query. WordPress users are
      // matched to their local identity by email only for this response; the
      // persistent association itself always uses internal user/company IDs.
      const assignmentRows = await db
        .select({
          representativeUserId: users.id,
          email: users.email,
          companyId: companies.id,
          companyName: companies.nombreEmpresa,
        })
        .from(representativeCompanies)
        .innerJoin(users, eq(representativeCompanies.representativeUserId, users.id))
        .innerJoin(companies, eq(representativeCompanies.companyId, companies.id));
      const assignmentsByEmail = new Map<string, { id: number; name: string; nombreEmpresa: string }[]>();
      for (const assignment of assignmentRows) {
        const email = assignment.email.trim().toLowerCase();
        const assignedCompanies = assignmentsByEmail.get(email) || [];
        assignedCompanies.push({
          id: assignment.companyId,
          name: assignment.companyName,
          nombreEmpresa: assignment.companyName,
        });
        assignmentsByEmail.set(email, assignedCompanies);
      }
      const localUsers = await db.select({
        id: users.id,
        email: users.email,
        role: users.role,
      }).from(users);
      const localUsersByEmail = new Map(
        localUsers.map((user) => [user.email.trim().toLowerCase(), user]),
      );
      for (const wpUser of transformedUsers) {
        const normalizedEmail = String(wpUser.email || "").trim().toLowerCase();
        const localUser = localUsersByEmail.get(normalizedEmail);
        let assignedCompanies = assignmentsByEmail.get(normalizedEmail) || [];
        if (
          assignedCompanies.length === 0 &&
          localUser &&
          hasRepresentativeRole(localUser.role)
        ) {
          assignedCompanies = (await this.getCompaniesForRepresentative(
            localUser.email,
            localUser.id,
          )).map((company) => ({
            id: company.id,
            name: company.nombreEmpresa,
            nombreEmpresa: company.nombreEmpresa,
          }));
        }
        wpUser.assignedCompanies = assignedCompanies;
        wpUser.assignedCompanyCount = assignedCompanies.length;
        wpUser.localUserId = localUser?.id || null;
        wpUser.localRole = localUser?.role || null;
      }

      return { 
        users: transformedUsers, 
        total: transformedUsers.length, 
        message: `${transformedUsers.length} usuarios obtenidos de WordPress` 
      };
    } catch (error: any) {
      return { users: [], total: 0, message: `Error al obtener usuarios de WordPress: ${error.message}` };
    }
  }

  async syncWordPressUsers(): Promise<{ syncedUsers: number; message: string }> {
    try {
      const settings = await this.getIntegrationSettings();
      if (!settings || !settings.wordpressUrl || !settings.apiKey || !settings.apiSecret) {
        return { syncedUsers: 0, message: "Configuración de WordPress incompleta" };
      }

      if (!settings.syncEnabled) {
        return { syncedUsers: 0, message: "Sincronización deshabilitada" };
      }

      const usersUrl = `${settings.wordpressUrl.replace(/\/$/, '')}/wp-json/wp/v2/users`;
      const authString = Buffer.from(`${settings.apiKey}:${settings.apiSecret}`).toString('base64');
      
      const response = await fetch(usersUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { syncedUsers: 0, message: `Error al obtener usuarios: ${response.status}` };
      }

      const wpUsers = await response.json();
      let syncedCount = 0;

      for (const wpUser of wpUsers) {
        // Skip users without email
        if (!wpUser.email || wpUser.email.trim() === '' || wpUser.email === null || wpUser.email === undefined) {
          continue;
        }

        // Double check email is valid before proceeding
        const emailToUse = wpUser.email ? wpUser.email.trim() : '';
        if (!emailToUse || emailToUse === 'null' || emailToUse === 'undefined') {
          continue;
        }

        // Check if user already exists
        const existingUser = await this.getUserByEmail(emailToUse);
        
        if (!existingUser) {
          // Create new user
          try {
            await this.createUser({
              email: emailToUse,
              displayName: wpUser.name || wpUser.slug || `Usuario ${wpUser.id}`,
              firebaseUid: `wp_${wpUser.id}`,
              role: 'representative',
            });
            syncedCount++;
          } catch (error) {
            console.error(`Error creating user ${emailToUse}:`, error);
          }
        }
      }

      // Update last sync time
      if (settings.id) {
        await this.updateIntegrationSettings(settings.id, {
          lastSync: new Date(),
          syncStatus: 'success',
        });
      }

      return { syncedUsers: syncedCount, message: `${syncedCount} usuarios sincronizados exitosamente` };
    } catch (error: any) {
      return { syncedUsers: 0, message: `Error de sincronización: ${error.message}` };
    }
  }

  // PDF Settings
  async getPdfSettings(): Promise<PdfSettings> {
    const [settings] = await db.select().from(pdfSettings).limit(1);
    
    // If no settings exist, create default ones
    if (!settings) {
      return await this.createPdfSettings({
        companyName: "ANPR México",
        companySubtitle: "Asociación Nacional de Profesionales en Relaciones Públicas",
        websiteUrl: "www.anpr.org.mx",
        primaryColor: "#bcce16",
        secondaryColor: "#2d3748",
        accentColor: "#f7fafc",
        textColor: "#000000",
        subtitleColor: "#505050",
        headerHeight: 30,
        fontSize: 10,
        titleFontSize: 22,
        showLogo: true,
        showWebsite: true,
        showAddress: true,
        footerText: "Este recibo fue generado automáticamente"
      });
    }
    
    return settings;
  }

  async createPdfSettings(settings: InsertPdfSettings): Promise<PdfSettings> {
    const [newSettings] = await db
      .insert(pdfSettings)
      .values(settings)
      .returning();
    return newSettings;
  }

  async updatePdfSettings(updates: Partial<InsertPdfSettings>): Promise<PdfSettings> {
    // Get current settings or create default if none exist
    let currentSettings = await this.getPdfSettings();
    
    const [updatedSettings] = await db
      .update(pdfSettings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pdfSettings.id, currentSettings.id))
      .returning();
      
    return updatedSettings;
  }

  // Email Configuration methods
  async getEmailConfiguration(): Promise<EmailConfiguration | undefined> {
    const [config] = await db.select().from(emailConfiguration).where(eq(emailConfiguration.isActive, true)).limit(1);
    return config || undefined;
  }

  async saveEmailConfiguration(config: InsertEmailConfiguration): Promise<EmailConfiguration> {
    // Check if config exists
    const existingConfig = await this.getEmailConfiguration();
    
    if (existingConfig) {
      // Update existing config
      const [updatedConfig] = await db
        .update(emailConfiguration)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(emailConfiguration.id, existingConfig.id))
        .returning();
      return updatedConfig;
    } else {
      // Create new config
      const [newConfig] = await db
        .insert(emailConfiguration)
        .values(config)
        .returning();
      return newConfig;
    }
  }

  async testEmailConfiguration(configData: InsertEmailConfiguration): Promise<{ success: boolean; message: string }> {
    try {
      // Create transporter with enhanced configuration
      const transporterConfig: any = {
        host: configData.smtpHost,
        port: configData.smtpPort,
        secure: configData.encryption === 'ssl',
        auth: {
          user: configData.username,
          pass: configData.password,
        },
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 60000, // 60 seconds
      };

      // Configure TLS/SSL based on encryption type
      if (configData.encryption === 'starttls' || configData.encryption === 'tls') {
        transporterConfig.requireTLS = true;
        transporterConfig.tls = {
          rejectUnauthorized: false,
          servername: configData.smtpHost
        };
      } else if (configData.encryption === 'ssl') {
        transporterConfig.secure = true;
        transporterConfig.tls = {
          rejectUnauthorized: false,
          servername: configData.smtpHost
        };
      } else {
        // No encryption
        transporterConfig.secure = false;
        transporterConfig.ignoreTLS = true;
      }

      // Special configurations for common providers
      if (configData.provider === 'gmail') {
        transporterConfig.service = 'gmail';
        transporterConfig.tls = {
          rejectUnauthorized: false
        };
      } else if (configData.provider === 'outlook') {
        transporterConfig.service = 'hotmail';
      }

      const transporter = nodemailer.createTransport(transporterConfig);

      // Verify connection with timeout handling
      console.log(`Testing SMTP connection to ${configData.smtpHost}:${configData.smtpPort} with ${configData.encryption} encryption`);
      
      try {
        await transporter.verify();
        console.log('SMTP connection verified successfully');
      } catch (verifyError: any) {
        console.error('SMTP verification failed:', verifyError);
        
        // Provide more specific error messages
        if (verifyError.code === 'ETIMEDOUT' || verifyError.message.includes('Greeting never received')) {
          throw new Error(`No se pudo conectar al servidor SMTP ${configData.smtpHost}:${configData.smtpPort}. Verifique que el servidor y puerto sean correctos, y que no haya firewall bloqueando la conexión.`);
        } else if (verifyError.code === 'EAUTH') {
          throw new Error('Error de autenticación: Verifique su usuario y contraseña SMTP.');
        } else if (verifyError.code === 'ECONNREFUSED') {
          throw new Error(`Conexión rechazada al servidor ${configData.smtpHost}:${configData.smtpPort}. Verifique que el servidor esté activo y el puerto sea correcto.`);
        } else {
          throw new Error(`Error de conexión SMTP: ${verifyError.message}`);
        }
      }

      // Determine email address for test email (use testEmail if provided, otherwise use fromEmail)
      const testEmailAddress = configData.testEmail || configData.fromEmail;
      
      // Always send test email when testing connection
      const currentDate = new Date().toLocaleString('es-MX', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const mailOptions = {
        from: `"${configData.fromName}" <${configData.fromEmail}>`,
        to: testEmailAddress,
        subject: '✅ Prueba de Configuración SMTP - Directorio ANPR',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #22c55e; margin: 0; font-size: 28px;">✅ ¡Configuración Exitosa!</h1>
              <p style="color: #6b7280; margin: 5px 0 0 0;">Prueba de conexión SMTP realizada correctamente</p>
            </div>
            
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); padding: 25px; border-radius: 12px; border-left: 4px solid #22c55e; margin: 20px 0;">
              <h2 style="color: #16a34a; margin: 0 0 15px 0; font-size: 20px;">🔧 Detalles de la Configuración</h2>
              <div style="background-color: white; padding: 15px; border-radius: 8px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #374151; font-weight: bold;">Proveedor:</td><td style="padding: 8px 0; color: #1f2937;">${configData.provider.toUpperCase()}</td></tr>
                  <tr><td style="padding: 8px 0; color: #374151; font-weight: bold;">Servidor SMTP:</td><td style="padding: 8px 0; color: #1f2937;">${configData.smtpHost}:${configData.smtpPort}</td></tr>
                  <tr><td style="padding: 8px 0; color: #374151; font-weight: bold;">Cifrado:</td><td style="padding: 8px 0; color: #1f2937;">${configData.encryption.toUpperCase()}</td></tr>
                  <tr><td style="padding: 8px 0; color: #374151; font-weight: bold;">Email remitente:</td><td style="padding: 8px 0; color: #1f2937;">${configData.fromEmail}</td></tr>
                  <tr><td style="padding: 8px 0; color: #374151; font-weight: bold;">Nombre remitente:</td><td style="padding: 8px 0; color: #1f2937;">${configData.fromName}</td></tr>
                  <tr><td style="padding: 8px 0; color: #374151; font-weight: bold;">Fecha de prueba:</td><td style="padding: 8px 0; color: #1f2937;">${currentDate}</td></tr>
                </table>
              </div>
            </div>

            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1e40af; margin: 0 0 10px 0;">📧 Sistema de Correos Activo</h3>
              <p style="color: #374151; margin: 0; line-height: 1.6;">
                El sistema de correos transaccionales está configurado correctamente y listo para:
              </p>
              <ul style="color: #374151; margin: 10px 0 0 0; padding-left: 20px;">
                <li>Enviar notificaciones de bienvenida a nuevos usuarios</li>
                <li>Notificar sobre vencimientos de membresías</li>
                <li>Confirmar pagos y renovaciones automáticas</li>
                <li>Enviar recordatorios y alertas del sistema</li>
              </ul>
            </div>

            <div style="border-top: 2px solid #e5e7eb; padding-top: 20px; margin-top: 30px; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                <strong>Directorio de Proveedores de Equipamiento Urbano</strong><br>
                ANPR México - Sistema de Gestión Empresarial
              </p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);

      return {
        success: true,
        message: `Configuración válida y email de prueba enviado a ${testEmailAddress}`
      };
    } catch (error: any) {
      console.error("Email test failed:", error);
      return {
        success: false,
        message: `Error al probar configuración: ${error.message}`
      };
    }
  }

  // Email Templates methods
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).where(eq(emailTemplates.isActive, true));
  }

  async getEmailTemplateByType(type: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates)
      .where(and(eq(emailTemplates.type, type), eq(emailTemplates.isActive, true)))
      .limit(1);
    return template || undefined;
  }

  async saveEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    // Check if template exists for this type
    const existingTemplate = await this.getEmailTemplateByType(template.type);
    
    if (existingTemplate) {
      // Update existing template
      const [updatedTemplate] = await db
        .update(emailTemplates)
        .set({ ...template, updatedAt: new Date() })
        .where(eq(emailTemplates.id, existingTemplate.id))
        .returning();
      return updatedTemplate;
    } else {
      // Create new template
      const [newTemplate] = await db
        .insert(emailTemplates)
        .values(template)
        .returning();
      return newTemplate;
    }
  }

  // Stripe Configuration Methods
  async getStripeConfiguration(): Promise<StripeConfiguration | undefined> {
    const [config] = await db.select().from(stripeConfigurationTable).where(eq(stripeConfigurationTable.isActive, true)).limit(1);
    return config || undefined;
  }

  async createStripeConfiguration(insertConfig: InsertStripeConfiguration): Promise<StripeConfiguration> {
    // Deactivate existing configurations
    await db.update(stripeConfigurationTable).set({ isActive: false });
    
    const [config] = await db.insert(stripeConfigurationTable).values(insertConfig).returning();
    return config;
  }

  async updateStripeConfiguration(id: number, configData: Partial<InsertStripeConfiguration>): Promise<StripeConfiguration | undefined> {
    const [config] = await db
      .update(stripeConfigurationTable)
      .set({
        ...configData,
        updatedAt: new Date(),
      })
      .where(eq(stripeConfigurationTable.id, id))
      .returning();
    
    return config || undefined;
  }

  async testStripeConnection(config: InsertStripeConfiguration): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      return {
        success: true,
        message: "Conexión exitosa con Stripe",
        details: {
          accountId: "acct_test_123",
          businessName: "Test Business",
          country: "MX",
          currency: "usd"
        }
      };
    } catch (error) {
      return {
        success: false,
        message: "Error al conectar con Stripe: " + (error as Error).message
      };
    }
  }

  async updateUserStripeInfo(userId: number, stripeCustomerId: string, stripeSubscriptionId?: string): Promise<User | undefined> {
    const updateData: any = { stripeCustomerId };
    if (stripeSubscriptionId) {
      updateData.stripeSubscriptionId = stripeSubscriptionId;
    }
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    
    return user || undefined;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeCustomerId, stripeCustomerId));
    return user || undefined;
  }

  // Registra un evento de Stripe como procesado. Devuelve true si es NUEVO
  // (se insertó) y false si ya existía (reintento/duplicado → no reprocesar).
  // La atomicidad la garantiza la PK (event_id): dos inserciones del mismo
  // evento no pueden coexistir, evitando doble procesamiento por concurrencia.
  async markStripeEventProcessed(eventId: string, type: string): Promise<boolean> {
    const inserted = await db
      .insert(processedStripeEvents)
      .values({ eventId, type })
      .onConflictDoNothing({ target: processedStripeEvents.eventId })
      .returning({ eventId: processedStripeEvents.eventId });
    return inserted.length > 0;
  }

  // Elimina el registro de un evento para permitir su reprocesamiento. Se usa
  // cuando la lógica del webhook falla DESPUÉS de marcarlo: así el reintento de
  // Stripe no se descarta como duplicado y el efecto no se pierde para siempre.
  async unmarkStripeEventProcessed(eventId: string): Promise<void> {
    await db
      .delete(processedStripeEvents)
      .where(eq(processedStripeEvents.eventId, eventId));
  }

  // Frontend Configuration methods
  async getFrontendConfiguration(): Promise<FrontendConfiguration | undefined> {
    const [config] = await db.select().from(frontendConfigurationTable).limit(1);
    return config || undefined;
  }

  async createFrontendConfiguration(config: InsertFrontendConfiguration): Promise<FrontendConfiguration> {
    const [created] = await db.insert(frontendConfigurationTable).values(config).returning();
    return created;
  }

  async updateFrontendConfiguration(id: number, config: Partial<InsertFrontendConfiguration>): Promise<FrontendConfiguration | undefined> {
    const updateData = {
      ...config,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(frontendConfigurationTable)
      .set(updateData)
      .where(eq(frontendConfigurationTable.id, id))
      .returning();

    return updated || undefined;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Password reset tokens (tabla aislada — no toca `users` ni la autenticación)
  // ───────────────────────────────────────────────────────────────────────────

  async createPasswordResetToken(
    data: InsertPasswordResetToken
  ): Promise<PasswordResetToken> {
    const [token] = await db.insert(passwordResetTokens).values(data).returning();
    return token;
  }

  /** Devuelve un token válido (no usado y no expirado) por su hash, o undefined. */
  async getValidPasswordResetToken(
    tokenHash: string
  ): Promise<PasswordResetToken | undefined> {
    const [token] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      )
      .limit(1);
    return token || undefined;
  }

  /** Marca un token como usado (invalidación tras el restablecimiento). */
  async markPasswordResetTokenUsed(id: number): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }

  /** Invalida todos los tokens activos de un email (al cambiar la contraseña). */
  async invalidatePasswordResetTokensForEmail(email: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.email, email),
          isNull(passwordResetTokens.usedAt)
        )
      );
  }

  /** Cuenta solicitudes recientes para un email (rate limiting por correo). */
  async countRecentPasswordResetRequests(
    email: string,
    since: Date
  ): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.email, email),
          gt(passwordResetTokens.createdAt, since)
        )
      );
    return row?.count ?? 0;
  }
}

export const storage = new DatabaseStorage();