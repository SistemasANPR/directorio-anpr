import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { build, type Plugin } from "esbuild";

// Run the real browser auth modules against synthetic Firebase, React and HTTP
// adapters. No live server, database, or real credentials are contacted.
const fixture: any = {
  auth: { currentUser: null, authStateReady: async () => {} },
  state: [],
  effects: [],
  cursor: 0,
  react: {},
  wpIdentity: null,
  wpOverride: false,
  requests: [],
  cookie: false,
  observer: null,
  firebaseSignouts: 0,
};
(globalThis as any).__adminClientFixture = fixture;

const storage = () => {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
    clear: () => entries.clear(),
  };
};
(globalThis as any).localStorage = storage();
(globalThis as any).sessionStorage = storage();
(globalThis as any).window = { location: { pathname: "/exportar-directorio", replace() {} } };

const mocks: Record<string, string> = {
  react: `
    const f = globalThis.__adminClientFixture;
    export function createContext() { return { Provider: ({ value, children }) => { f.value = value; return children; } }; }
    export function useContext() { return f.value; }
    export function useState(initial) {
      const index = f.cursor++;
      if (!(index in f.state)) f.state[index] = typeof initial === "function" ? initial() : initial;
      return [f.state[index], (next) => { f.state[index] = typeof next === "function" ? next(f.state[index]) : next; }];
    }
    export function useRef(initial) {
      const index = f.cursor++;
      if (!(index in f.state)) f.state[index] = { current: initial };
      return f.state[index];
    }
    export function useEffect(effect) { if (!f.rendered) f.effects.push(effect); }
  `,
  "react/jsx-runtime": `
    export function jsx(component, props) { return component(props); }
    export const jsxs = jsx;
  `,
  "firebase/auth": `
    const f = globalThis.__adminClientFixture;
    export const browserSessionPersistence = {};
    export const browserLocalPersistence = {};
    export const EmailAuthProvider = { credential() { return {}; } };
    export const signInWithEmailAndPassword = async () => ({ user: f.auth.currentUser });
    export const createUserWithEmailAndPassword = signInWithEmailAndPassword;
    export const setPersistence = async () => {};
    export const updatePassword = async () => {};
    export const reauthenticateWithCredential = async () => {};
    export function onAuthStateChanged(auth, callback) {
      f.observer = callback;
      queueMicrotask(() => callback(auth.currentUser));
      return () => { f.observer = null; };
    }
    export async function signOut(auth) {
      f.firebaseSignouts++;
      auth.currentUser = null;
      if (f.observer) await f.observer(null);
    }
  `,
  firebase: `export const auth = globalThis.__adminClientFixture.auth;`,
  impersonation: `
    export const TEMP_USER_KEY = "tempUser";
    export const IMPERSONATION_KEY = "impersonatedCompany";
    export const getStoredImpersonatedCompany = () => null;
    export const buildImpersonatedIdentity = () => null;
    export const logImpersonation = () => {};
    export const getEffectiveAuthIdentityHeader = () => localStorage.getItem("tempUser");
  `,
  wordpressSession: `
    const f = globalThis.__adminClientFixture;
    export const getWordPressIdentity = () => f.wpIdentity;
    export const getWordPressToken = () => null;
    export const subscribeWordPressSession = () => () => {};
    export const clearWordPressSession = () => { f.wpIdentity = null; };
    export const isWordPressOverrideSuppressed = () => false;
    export const clearWordPressOverrideSuppression = () => {};
    export const suppressWordPressOverride = () => {};
  `,
  wordpressDetect: `
    export async function detectWordPressSession() {
      const f = globalThis.__adminClientFixture;
      if (f.wpOverride) f.wpIdentity = { id: 8, role: "representante", email: "wp@example.test" };
      return { authenticated: f.wpOverride };
    }
  `,
  wordpressTokenLogin: `
    export const hasWordPressToken = () => false;
    export const processWordPressToken = async () => ({ authenticated: false });
  `,
  "@tanstack/react-query": `export class QueryClient { constructor() {} clear() {} }`,
};
const mockPlugin: Plugin = {
  name: "client-auth-fixtures",
  setup(builder) {
    builder.onResolve({ filter: /^(react(?:\/jsx-runtime)?|firebase\/auth|@tanstack\/react-query|(?:@\/lib\/|\.\/)(?:firebase|impersonation|wordpressSession)|@\/lib\/(?:wordpressDetect|wordpressTokenLogin))$/ }, ({ path }) => {
      const key = path.replace(/^(?:@\/lib\/|\.\/)/, "");
      if (key in mocks) return { path: key, namespace: "fixture" };
      return null;
    });
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
      contents: mocks[path],
      loader: "js",
    }));
  },
};

let client: any;
before(async () => {
  const output = await build({
    stdin: {
      contents: `
        export { apiRequest, getQueryFn, ApiError } from "./client/src/lib/queryClient";
        export { signOutUser } from "./client/src/lib/auth";
        export { AuthProvider } from "./client/src/hooks/useAuth";
      `,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    plugins: [mockPlugin],
  });
  const module = { exports: {} as any };
  const require = createRequire(import.meta.url);
  new Function("require", "module", "exports", output.outputFiles[0].text)(require, module, module.exports);
  client = module.exports;
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fixture.auth.currentUser = null;
  fixture.auth.authStateReady = async () => {};
  fixture.state = [];
  fixture.effects = [];
  fixture.cursor = 0;
  fixture.rendered = false;
  fixture.wpIdentity = null;
  fixture.wpOverride = false;
  fixture.requests = [];
  fixture.cookie = false;
  fixture.observer = null;
  fixture.firebaseSignouts = 0;
  globalThis.fetch = (async (url: string, options: any = {}) => {
    fixture.requests.push({ url, options });
    if (url === "/api/admin/session") {
      return Response.json(
        fixture.cookie
          ? { user: { id: 15, role: "admin", email: "verified@example.test", firebaseUid: "manual_verified" } }
          : { error: "Sesión no verificada" },
        { status: fixture.cookie && options.credentials === "include" ? 200 : 401 },
      );
    }
    if (url === "/api/admin/logout") {
      fixture.cookie = false;
      return Response.json({ success: true });
    }
    if (url.startsWith("/api/users/firebase/")) {
      return Response.json({ id: 22, role: "admin", email: "firebase@example.test", firebaseUid: "fixture-uid" });
    }
    return Response.json({ success: true });
  }) as typeof fetch;
});

async function renderAfterAuth() {
  fixture.cursor = 0;
  client.AuthProvider({ children: null });
  fixture.rendered = true;
  for (const effect of fixture.effects.splice(0)) effect();
  // The Firebase observer and the verified-session fetch each enqueue work.
  for (let i = 0; i < 12; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.cursor = 0;
  client.AuthProvider({ children: null });
  return fixture.value;
}

test("Firebase rehydration supplies authorization before transport sends request", async () => {
  let resolveReady!: () => void;
  fixture.auth.authStateReady = () => new Promise<void>((resolve) => { resolveReady = resolve; });
  const request = client.apiRequest("GET", "/api/admin/session");
  await Promise.resolve();
  assert.equal(fixture.requests.length, 0);
  fixture.auth.currentUser = { getIdToken: async () => "fixture-firebase-token" };
  resolveReady();
  await assert.rejects(request, (error: any) => error.status === 401);
  assert.equal(fixture.requests[0].options.headers.Authorization, "Bearer fixture-firebase-token");
  assert.equal(fixture.requests[0].options.credentials, "include");
});

test("React Query transport also waits for Firebase readiness", async () => {
  let resolveReady!: () => void;
  fixture.auth.authStateReady = () => new Promise<void>((resolve) => { resolveReady = resolve; });
  const request = client.getQueryFn({ on401: "throw" })({ queryKey: ["/api/admin/session"] });
  await Promise.resolve();
  assert.equal(fixture.requests.length, 0);
  fixture.auth.currentUser = { getIdToken: async () => "fixture-query-token" };
  resolveReady();
  await assert.rejects(request, (error: any) => error.status === 401);
  assert.equal(fixture.requests[0].options.headers.Authorization, "Bearer fixture-query-token");
});

test("forged persisted admin without signed cookie is rejected on reload", async () => {
  localStorage.setItem("tempUser", JSON.stringify({ id: 15, role: "admin", firebaseUid: "manual_verified" }));
  const context = await renderAfterAuth();
  assert.equal(context.loading, false);
  assert.equal(context.user, null);
  assert.equal(localStorage.getItem("tempUser"), null);
  assert.equal(fixture.requests[0].options.credentials, "include");
});

test("signed manual admin cookie restores identity even without localStorage", async () => {
  fixture.cookie = true;
  const context = await renderAfterAuth();
  assert.equal(context.loading, false);
  assert.equal(context.user.id, 15);
  assert.equal(context.user.email, "verified@example.test");
  assert.equal(JSON.parse(localStorage.getItem("tempUser")!).email, "verified@example.test");
});

test("explicit logout revokes cookie before Firebase null observer can restore admin", async () => {
  fixture.cookie = true;
  fixture.auth.currentUser = { getIdToken: async () => "fixture-token" };
  await renderAfterAuth();
  fixture.requests = [];
  const normalFetch = globalThis.fetch;
  let finishLogout!: () => void;
  globalThis.fetch = ((url: string, options: any) => {
    if (url !== "/api/admin/logout") return normalFetch(url, options);
    fixture.requests.push({ url, options });
    return new Promise<Response>((resolve) => {
      finishLogout = () => {
        fixture.cookie = false;
        resolve(Response.json({ success: true }));
      };
    });
  }) as typeof fetch;
  const logout = client.signOutUser();
  await Promise.resolve();
  assert.equal(fixture.cookie, true);
  assert.equal(fixture.firebaseSignouts, 0);
  finishLogout();
  await logout;
  assert.equal(fixture.cookie, false);
  assert.equal(fixture.firebaseSignouts, 1);
  assert.equal(fixture.requests[0].url, "/api/admin/logout");
  assert.equal(fixture.requests[0].options.credentials, "include");
  assert.equal(fixture.requests.find((request: any) => request.url === "/api/admin/session")?.options.credentials, "include");
  fixture.cursor = 0;
  client.AuthProvider({ children: null });
  assert.equal(fixture.value.user, null);
});

test("WordPress auto-override signs out Firebase only, without revoking manual cookie", async () => {
  fixture.wpOverride = true;
  fixture.cookie = true;
  fixture.auth.currentUser = { getIdToken: async () => "fixture-token" };
  await renderAfterAuth();
  assert.equal(fixture.cookie, true);
  assert.equal(fixture.requests.some((request: any) => request.url === "/api/admin/logout"), false);
  assert.equal(fixture.firebaseSignouts, 1);
});