import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import express from "express";
import bcrypt from "bcrypt";
import firebaseAdmin from "firebase-admin";

// Everything below is synthetic: no production database or backup is contacted.
process.env.DATABASE_URL = "postgresql://fixture:fixture@127.0.0.1:1/fixture";
process.env.WP_SSO_SECRET = "fixture-only-secret-longer-than-thirty-two-characters";
process.env.SESSION_SECRET = "fixture-only-admin-session-secret";
process.env.CLOUDINARY_CLOUD_NAME = "";

const { registerRoutes } = await import("../server/routes");
const { storage } = await import("../server/storage");
const { pool } = await import("../server/db");
const { signAdminSession, ADMIN_SESSION_COOKIE } = await import("../server/adminSession");
const { signWordPressSessionToken } = await import("../server/services/wordpress");

const originalCwd = process.cwd();
const root = mkdtempSync(path.join(tmpdir(), "admin-export-fixture-"));
mkdirSync(path.join(root, "shared"));
writeFileSync(path.join(root, "package.json"), '{"name":"fixture"}');
writeFileSync(path.join(root, "shared", "fixture.txt"), "source fixture");
const users = [
  { id: 1, email: "admin@example.test", firebaseUid: "manual_admin", role: "admin", tempPassword: await bcrypt.hash("correct-secret", 4), stripeSubscriptionId: "expired-fixture", license: null },
  { id: 2, email: "custom@example.test", firebaseUid: "manual_custom", role: "gestion", tempPassword: await bcrypt.hash("correct-secret", 4), stripeSubscriptionId: null, license: null },
  { id: 3, email: "rep@example.test", firebaseUid: "manual_rep", role: "representante", tempPassword: await bcrypt.hash("correct-secret", 4), stripeSubscriptionId: null, license: null },
  { id: 4, email: "firebase@example.test", firebaseUid: "firebase-fixture", role: "admin", tempPassword: null, stripeSubscriptionId: "expired-fixture", license: null },
];
// Membership expiry lives on the company, not on the administrator user.
// User 2 owns no company/license; users 1 and 4 own expired memberships.
const companies = [
  { userId: 1, fechaFinMembresia: "2020-01-01", estado: "inactivo" },
  { userId: 4, fechaFinMembresia: "2020-01-01", estado: "inactivo" },
];
const originals = {
  getUser: storage.getUser,
  getUserByEmail: storage.getUserByEmail,
  getUserByFirebaseUid: storage.getUserByFirebaseUid,
  getAllRoles: storage.getAllRoles,
  query: pool.query,
};
let baseUrl: string;
let server: ReturnType<ReturnType<typeof express>["listen"]>;
let originalVerify: ReturnType<typeof firebaseAdmin.auth>["verifyIdToken"];

before(async () => {
  process.chdir(root);
  if (!firebaseAdmin.apps.length) firebaseAdmin.initializeApp({ projectId: "fixture" });
  const auth = firebaseAdmin.auth();
  originalVerify = auth.verifyIdToken;
  auth.verifyIdToken = (async (token: string) => {
    if (token === "valid-fixture-token") return { uid: "firebase-fixture" };
    if (token === "valid-custom-token") return { uid: "manual_custom" };
    if (token === "representative-token") return { uid: "manual_rep" };
    throw new Error("invalid fixture token");
  }) as typeof auth.verifyIdToken;
  storage.getUser = (async (id: number) => users.find((u) => u.id === id)) as typeof storage.getUser;
  storage.getUserByEmail = (async (email: string) => users.find((u) => u.email === email)) as typeof storage.getUserByEmail;
  storage.getUserByFirebaseUid = (async (uid: string) => users.find((u) => u.firebaseUid === uid)) as typeof storage.getUserByFirebaseUid;
  storage.getAllRoles = (async () => [
    { id: 1, nombre: "admin", permisos: ["admin.dashboard"] },
    { id: 5, nombre: "gestion", permisos: ["admin.dashboard"] },
    { id: 2, nombre: "representante", permisos: [] },
  ]) as typeof storage.getAllRoles;
  pool.query = (async (sql: string) => {
    if (sql.includes("FROM pg_attribute a") || (sql.includes("JOIN pg_attribute a") && sql.includes("format_type"))) {
      return { rows: [{ table_name: "fixture", column_name: "id", col_type: "integer", not_null: true, col_default: null }] };
    }
    if (sql.includes("c.relkind = 'r'")) return { rows: [{ table_name: "fixture" }] };
    if (sql.includes("count(*)")) return { rows: [{ c: 1 }] };
    if (sql.includes("row_literal")) return { rows: [{ row_literal: "'42'" }] };
    return { rows: [] };
  }) as typeof pool.query;
  // The fixture only registers routes. Suppress the production daily scheduler.
  const originalTimeout = globalThis.setTimeout;
  const originalInterval = globalThis.setInterval;
  globalThis.setTimeout = ((fn: any, ms?: number, ...args: any[]) =>
    ms === 60_000 ? { unref() {} } : originalTimeout(fn, ms, ...args)) as typeof setTimeout;
  globalThis.setInterval = (() => ({ unref() {} })) as unknown as typeof setInterval;
  try {
    const app = express();
    app.use(express.json());
    await registerRoutes(app);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as any).port}`;
  } finally {
    globalThis.setTimeout = originalTimeout;
    globalThis.setInterval = originalInterval;
  }
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  firebaseAdmin.auth().verifyIdToken = originalVerify;
  storage.getUser = originals.getUser;
  storage.getUserByEmail = originals.getUserByEmail;
  storage.getUserByFirebaseUid = originals.getUserByFirebaseUid;
  storage.getAllRoles = originals.getAllRoles;
  pool.query = originals.query;
  process.chdir(originalCwd);
  rmSync(root, { recursive: true, force: true });
});

const cookie = (id: number, value = signAdminSession(id)) => `${ADMIN_SESSION_COOKIE}=${value}`;
const get = (route: string, headers: Record<string, string> = {}) => fetch(`${baseUrl}${route}`, { headers });
const routes = [
  "/api/admin/export-info",
  "/api/admin/database-export",
  "/api/admin/project-export",
  "/api/admin/project-export?includeDatabase=false",
  "/api/admin/project-export?includeSource=false",
];
const wpToken = (email: string, now = Date.now(), ttlSeconds?: number) =>
  signWordPressSessionToken({ role: "representative", companyId: 9, wpEmail: email, wpUserId: 8, source: "wordpress" }, now, ttlSeconds);

// Read ZIP central directory, then inflate the referenced local entries.
// Archiver may use data descriptors, so local-header lengths alone are not reliable.
function unzipFixture(buffer: Buffer): Map<string, string> {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  assert.notEqual(eocd, -1, "ZIP central directory missing");
  const files = new Map<string, string>();
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = buffer.readUInt16LE(eocd + 10);
  for (let i = 0; i < entries; i++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    assert.equal(buffer.readUInt32LE(localOffset), 0x04034b50);
    const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const compressed = buffer.subarray(start, start + compressedSize);
    const data = method === 8 ? inflateRawSync(compressed) : compressed;
    assert.ok(method === 8 || method === 0, `unsupported ZIP compression: ${method}`);
    files.set(name, data.toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

async function assertDenied(headers: Record<string, string>, sessionStatus: number, label: string) {
  const session = await get("/api/admin/session", headers);
  assert.equal(session.status, sessionStatus, `${label} session`);
  assert.equal(session.headers.get("cache-control"), "no-store");
  for (const route of routes) {
    const response = await get(route, headers);
    assert.equal(response.status, 401, `${label}: ${route}`);
    assert.doesNotMatch(response.headers.get("content-type") || "", /application\/(sql|zip)/);
  }
}

async function assertGranted(headers: Record<string, string>, label: string) {
  const session = await get("/api/admin/session", headers);
  assert.equal(session.status, 200, `${label} session`);
  assert.equal(session.headers.get("cache-control"), "no-store");
  const { user } = await session.json();
  assert.equal(user.accesoAdmin, true, label);
  assert.equal("tempPassword" in user, false, label);
  const summary = await get(routes[0], headers);
  assert.equal(summary.status, 200, `${label} summary`);
  assert.deepEqual((await summary.json()).tables, [{ name: "fixture", approxRows: 1 }]);
  const sql = await get(routes[1], headers);
  assert.equal(sql.status, 200, `${label} SQL`);
  assert.match(sql.headers.get("content-type") || "", /application\/sql/);
  assert.match(sql.headers.get("content-disposition") || "", /attachment; filename="backup-[^"]+\.sql"/);
  assert.match(await sql.text(), /INSERT INTO "fixture" \("id"\) VALUES\s+\('42'\);/);
  const modes = [
    { route: routes[2], name: "directorio-completo", source: true, database: true },
    { route: routes[3], name: "directorio-codigo", source: true, database: false },
    { route: routes[4], name: "directorio-base-de-datos", source: false, database: true },
  ];
  for (const mode of modes) {
    const zip = await get(mode.route, headers);
    assert.equal(zip.status, 200, `${label}: ${mode.route}`);
    assert.match(zip.headers.get("content-type") || "", /application\/zip/);
    assert.match(zip.headers.get("content-disposition") || "", new RegExp(`attachment; filename="${mode.name}-[^"]+\\.zip"`));
    const files = unzipFixture(Buffer.from(await zip.arrayBuffer()));
    assert.equal(files.has("directorio/database/backup.sql"), mode.database);
    assert.equal(files.has("directorio/shared/fixture.txt"), mode.source);
    assert.equal(files.has("directorio/INSTALACION.md"), mode.source);
    assert.equal(files.has("directorio/.env.example"), mode.source);
    if (mode.database) assert.match(files.get("directorio/database/backup.sql")!, /INSERT INTO "fixture"/);
    if (mode.source) {
      assert.equal(files.get("directorio/shared/fixture.txt"), "source fixture");
      assert.match(files.get("directorio/INSTALACION.md")!, /PostgreSQL/);
    }
  }
}

test("every export mode denies visitors, forged identities, expired credentials and representatives", async () => {
  const originalNow = Date.now;
  Date.now = () => originalNow() - 40 * 24 * 60 * 60 * 1000;
  let expired: string;
  try {
    expired = signAdminSession(1);
  } finally {
    Date.now = originalNow;
  }
  const cases: Array<[string, Record<string, string>, number]> = [
    ["visitor", {}, 401],
    ["forged admin header", { "x-user-info": JSON.stringify({ id: 1, role: "admin" }) }, 401],
    ["forged cookie", { cookie: cookie(1, `${signAdminSession(1)}tampered`) }, 401],
    ["expired cookie", { cookie: cookie(1, expired) }, 401],
    ["representative cookie", { cookie: cookie(3) }, 403],
    ["representative WordPress", { "x-wordpress-session": wpToken("rep@example.test") }, 403],
    ["expired WordPress", { "x-wordpress-session": wpToken("admin@example.test", Date.now() - 100_000, 1) }, 401],
    ["forged WordPress", { "x-wordpress-session": `${wpToken("admin@example.test")}tampered` }, 401],
    ["forged Firebase", { authorization: "Bearer invalid-token" }, 401],
    ["representative Firebase", { authorization: "Bearer representative-token" }, 403],
  ];
  for (const [label, headers, status] of cases) await assertDenied(headers, status, label);
});

test("manual login sets a signed cookie only for valid credentials, and logout clears it", async () => {
  const wrong = await fetch(`${baseUrl}/api/login-temp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password: "wrong" }) });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get("set-cookie"), null);
  const login = await fetch(`${baseUrl}/api/login-temp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "custom@example.test", password: "correct-secret" }) });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie") || "", /admin_session=.*HttpOnly/i);
  const session = await get("/api/admin/session", { cookie: login.headers.get("set-cookie")!.split(";")[0] });
  assert.equal(session.status, 200);
  const { user } = await session.json();
  assert.equal(user.accesoAdmin, true);
  assert.equal(user.license, null);
  assert.equal("tempPassword" in user, false);
  const logout = await fetch(`${baseUrl}/api/admin/logout`, { method: "POST", headers: { cookie: cookie(2) } });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") || "", /admin_session=;/);
});

test("verified admins with expired or missing memberships can download every export mode", async () => {
  assert.equal(companies.some((company) => company.userId === 2), false);
  assert.ok(companies.filter((company) => [1, 4].includes(company.userId)).every(
    (company) => company.fechaFinMembresia < new Date().toISOString().slice(0, 10),
  ));
  const cases: Array<[string, Record<string, string>]> = [
    ["standard admin, expired membership, manual cookie", { cookie: cookie(1) }],
    ["custom admin, no license, manual cookie", { cookie: cookie(2) }],
    ["standard admin, expired membership, WordPress", { "x-wordpress-session": wpToken("admin@example.test") }],
    ["custom admin, no license, WordPress", { "x-wordpress-session": wpToken("custom@example.test") }],
    ["standard admin, expired membership, Firebase", { authorization: "Bearer valid-fixture-token" }],
    ["custom admin, no license, Firebase", { authorization: "Bearer valid-custom-token" }],
  ];
  for (const [label, headers] of cases) {
    await assertGranted(headers, label);
  }
});