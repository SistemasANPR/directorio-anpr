import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { build, type Plugin } from "esbuild";

// Compile the actual page and login components, replacing only UI hooks,
// network, browser APIs and third-party widgets with deterministic fixtures.
const f: any = { states: [], cursor: 0, queries: {}, opts: {}, toasts: [], requests: [] };
(globalThis as any).__exportPageFixture = f;
const items = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => items.get(key) ?? null,
  setItem: (key: string, value: string) => { items.set(key, value); },
  removeItem: (key: string) => { items.delete(key); },
  clear: () => items.clear(),
};

const mocks: Record<string, string> = {
  react: `
    export function useState(initial) {
      const f = globalThis.__exportPageFixture, index = f.cursor++;
      if (!(index in f.states)) f.states[index] = initial;
      return [f.states[index], next => { f.states[index] = typeof next === "function" ? next(f.states[index]) : next; }];
    }
  `,
  "react/jsx-runtime": `
    export function jsx(type, props) {
      if (typeof type === "function") return type(props || {});
      return { type, props: props || {} };
    }
    export const jsxs = jsx;
    export const Fragment = ({ children }) => children;
  `,
  "@tanstack/react-query": `
    export function useQuery(options) {
      const f = globalThis.__exportPageFixture, key = options.queryKey[0];
      f.opts[key] = options;
      return f.queries[key] || { data: undefined, isLoading: false, error: null, refetch: async () => {} };
    }
  `,
  "components": `
    export const Card = ({ children }) => ({ type: "card", props: { children } });
    export const CardContent = Card, CardDescription = Card, CardHeader = Card, CardTitle = Card;
    export const Button = ({ children, ...props }) => ({ type: "button", props: { children, ...props } });
    export const Input = ({ children, ...props }) => ({ type: "input", props: { children, ...props } });
    export const Form = ({ children }) => ({ type: "form-wrapper", props: { children } });
    export const FormControl = Form, FormField = Form, FormItem = Form, FormLabel = Form, FormMessage = Form;
    export const Checkbox = () => null;
  `,
  toast: `export function useToast() { return { toast: event => globalThis.__exportPageFixture.toasts.push(event) }; }`,
  queryClient: `
    export class ApiError extends Error {
      constructor(message, status) { super(message); this.status = status; }
    }
    export function apiRequest(method, url) {
      const f = globalThis.__exportPageFixture;
      f.requests.push({ method, url });
      return f.apiRequest(method, url);
    }
  `,
  authHook: `export function useAuth() { return globalThis.__exportPageFixture.authContext; }`,
  icons: `
    export const Package = () => null, Database = Package, FileCode2 = Package;
    export const Download = Package, RefreshCw = Package, ShieldAlert = Package;
    export const CheckCircle2 = Package, AlertTriangle = Package, Server = Package;
    export const Building = Package, Mail = Package, Lock = Package, Loader2 = Package;
  `,
  swal: `export default { fire: async options => {
    const f = globalThis.__exportPageFixture;
    f.confirmations.push(options);
    return { isConfirmed: f.confirm };
  } };`,
  form: `export function useForm() { return { handleSubmit: handler => () => handler({
    email: "admin@example.test", password: "valid-password", rememberMe: false,
  }), control: {} }; }`,
  resolver: `export const zodResolver = () => () => ({});`,
  zod: `
    const scalar = { email() { return this; }, min() { return this; }, default() { return this; } };
    export const z = { string: () => scalar, boolean: () => scalar, object: shape => shape };
  `,
  wouter: `export function useLocation() { return ["/login", url => globalThis.__exportPageFixture.locations.push(url)]; }`,
  authLib: `export async function signInWithEmail() { globalThis.__exportPageFixture.firebaseLogins++; } export function createUserWithEmail() {}`,
  firebase: `export const auth = globalThis.__exportPageFixture.auth;`,
  firebaseAuth: `export async function signOut() { globalThis.__exportPageFixture.firebaseSignouts++; }`,
  wpSession: `
    export function suppressWordPressOverride() {}
    export function clearWordPressSession() {}
  `,
};
const plugin: Plugin = {
  name: "export-page-fixtures",
  setup(builder) {
    const aliases: Record<string, string> = {
      "@/components/ui/card": "components",
      "@/components/ui/button": "components",
      "@/components/ui/input": "components",
      "@/components/ui/form": "components",
      "@/components/ui/checkbox": "components",
      "@/hooks/use-toast": "toast",
      "@/lib/queryClient": "queryClient",
      "@/hooks/useAuth": "authHook",
      "@/lib/auth": "authLib",
      "@/lib/firebase": "firebase",
      "@/lib/wordpressSession": "wpSession",
      "firebase/auth": "firebaseAuth",
      "lucide-react": "icons",
      "sweetalert2": "swal",
      "react-hook-form": "form",
      "@hookform/resolvers/zod": "resolver",
      zod: "zod",
      wouter: "wouter",
    };
    builder.onResolve({ filter: /.*/ }, ({ path }) => {
      const key = aliases[path] || (path in mocks ? path : null);
      return key ? { path: key, namespace: "fixture" } : null;
    });
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
      contents: mocks[path],
      loader: "js",
    }));
  },
};

let components: any;
before(async () => {
  const output = await build({
    stdin: {
      contents: `
        export { default as ExportPage } from "./client/src/pages/ExportarDirectorio";
        export { default as Login } from "./client/src/pages/Login";
        export { default as ProtectedRoute } from "./client/src/components/ProtectedRoute";
        export { ApiError } from "@/lib/queryClient";
      `,
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    plugins: [plugin],
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", output.outputFiles[0].text)(
    createRequire(import.meta.url), module, module.exports,
  );
  components = module.exports;
});

const location = {
  pathname: "/exportar-directorio",
  search: "",
  href: "",
  assigned: "",
  assign(url: string) { this.assigned = url; },
  replace(url: string) { this.assigned = url; },
};
(globalThis as any).window = { location };
const links: any[] = [];
(globalThis as any).document = {
  body: { appendChild() {} },
  createElement: () => {
    const link = { href: "", download: "", clicked: false, click() { this.clicked = true; }, remove() {} };
    links.push(link);
    return link;
  },
};
const originalCreateObjectURL = URL.createObjectURL;
URL.createObjectURL = () => "blob:fixture";
URL.revokeObjectURL = () => {};
const originalSetTimeout = globalThis.setTimeout;
let timeouts: Array<() => void> = [];
after(() => {
  globalThis.setTimeout = originalSetTimeout;
  URL.createObjectURL = originalCreateObjectURL;
});
function flushTimers() {
  for (const task of timeouts.splice(0)) task();
}
function render(component: () => unknown) {
  f.cursor = 0;
  return component();
}
function visit(tree: any, callback: (node: any) => void) {
  if (Array.isArray(tree)) {
    tree.forEach((node) => visit(node, callback));
  } else if (tree != null && typeof tree === "object") {
    callback(tree);
    visit(tree.props?.children, callback);
  }
}
function text(tree: any): string {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  return text(tree.props?.children);
}
function button(tree: any, label: string) {
  let match: any;
  visit(tree, (node) => {
    if (node.type === "button" && text(node).includes(label)) match = node;
  });
  assert.ok(match, `Missing button: ${label}`);
  return match;
}
function exportInfoResponse() {
  return Response.json({
    sourceAvailable: true, fileCount: 7, sourceBytes: 1000000,
    tableCount: 4, approxRows: 56, tables: [],
  });
}
function setupVerified() {
  f.queries["/api/admin/session"] = { data: { user: { id: 15 } }, isLoading: false, error: null };
  f.queries["/api/admin/export-info"] = {
    data: {
      sourceAvailable: true, fileCount: 7, sourceBytes: 1000000,
      tableCount: 4, approxRows: 56, tables: [],
    }, isLoading: false, error: null,
  };
}
beforeEach(() => {
  f.states = [];
  f.queries = {};
  f.opts = {};
  f.cursor = 0;
  f.toasts = [];
  f.requests = [];
  f.confirmations = [];
  f.confirm = true;
  f.locations = [];
  f.firebaseLogins = 0;
  f.firebaseSignouts = 0;
  f.auth = { currentUser: null, authStateReady: async () => {} };
  f.authContext = { user: { id: 15 }, loading: false, isAdmin: true, isWordPressSession: false };
  f.apiRequest = async (_method: string, url: string) => {
    if (url === "/api/admin/export-info") return exportInfoResponse();
    if (url === "/api/admin/session") return Response.json({ user: { id: 15 } });
    return new Response(new Blob(["fixture"]), {
      headers: { "Content-Disposition": 'attachment; filename="fixture-export.zip"', "X-Export-Files": "7" },
    });
  };
  items.clear();
  links.length = 0;
  location.pathname = "/exportar-directorio";
  location.search = "";
  location.href = "";
  location.assigned = "";
  timeouts = [];
  globalThis.setTimeout = ((callback: () => void) => {
    timeouts.push(callback);
    return 1 as any;
  }) as typeof setTimeout;
  globalThis.fetch = (async () => Response.json({
    success: true,
    user: { id: 15, role: "admin", firebaseUid: "manual_admin" },
  })) as typeof fetch;
});

test("summary remains gated until server verifies the session", () => {
  f.queries["/api/admin/session"] = { data: null, isLoading: true, error: null };
  let tree = render(() => components.ExportPage());
  assert.equal(f.opts["/api/admin/export-info"].enabled, false);
  assert.ok(text(tree).includes("Verifica tu sesión"));
  assert.ok(!text(tree).includes("Archivos de código"));
  assert.equal(button(tree, "Descargar todo").props.disabled, true);
  setupVerified();
  tree = render(() => components.ExportPage());
  assert.equal(f.opts["/api/admin/export-info"].enabled, true);
  assert.ok(text(tree).includes("Archivos de código"));
});

test("401 from summary offers reauthentication with fixed export destination", () => {
  setupVerified();
  f.queries["/api/admin/export-info"].error = new components.ApiError("Expiró", 401);
  const tree = render(() => components.ExportPage());
  assert.equal(button(tree, "Descargar todo").props.disabled, true);
  button(tree, "Volver a iniciar sesión").props.onClick();
  assert.equal(location.assigned, "/login?returnTo=%2Fexportar-directorio");
});

test("401 from download blocks actions and offers reauthentication", async () => {
  setupVerified();
  f.apiRequest = async () => { throw new components.ApiError("Expiró", 401); };
  let tree = render(() => components.ExportPage());
  await button(tree, "Descargar todo").props.onClick();
  tree = render(() => components.ExportPage());
  assert.equal(button(tree, "Descargar todo").props.disabled, true);
  assert.equal(f.toasts[0].variant, "destructive");
  button(tree, "Volver a iniciar sesión").props.onClick();
  assert.equal(location.assigned, "/login?returnTo=%2Fexportar-directorio");
});

test("verified admin can confirm three download modes and receives filenames", async () => {
  setupVerified();
  const modes = [
    ["Descargar todo", "/api/admin/project-export"],
    ["Descargar código", "/api/admin/project-export?includeDatabase=false"],
    ["Descargar respaldo", "/api/admin/project-export?includeSource=false"],
  ];
  for (const [label, endpoint] of modes) {
    const tree = render(() => components.ExportPage());
    assert.equal(button(tree, label).props.disabled, false);
    await button(tree, label).props.onClick();
    assert.equal(f.requests.at(-1).url, endpoint);
    assert.equal(links.at(-1).download, "fixture-export.zip");
    assert.equal(links.at(-1).clicked, true);
    assert.equal(f.toasts.at(-1).title, "Descarga completada");
    assert.equal(f.confirmations.at(-1).showCancelButton, true);
  }
});

async function submitLogin(tree: any) {
  let form: any;
  visit(tree, (node) => {
    if (node.type === "form" && node.props.onSubmit) form = node;
  });
  assert.ok(form, "Login form not rendered");
  await form.props.onSubmit();
  flushTimers();
}

test("Login honors fixed returnTo both from /login and inline ProtectedRoute", async () => {
  location.pathname = "/login";
  location.search = "?returnTo=%2Fexportar-directorio";
  await submitLogin(render(() => components.Login()));
  assert.equal(location.href, "/exportar-directorio");
  location.pathname = "/exportar-directorio";
  location.search = "";
  location.href = "";
  f.states = [];
  f.authContext.user = null;
  const inline = render(() => components.ProtectedRoute({ children: null, requireAdmin: true }));
  await submitLogin(inline);
  assert.equal(location.href, "/exportar-directorio");
});

test("Login ignores external or protocol-relative returnTo targets", async () => {
  for (const target of ["https://attacker.example", "//attacker.example", "/other"]) {
    f.states = [];
    location.pathname = "/login";
    location.search = `?returnTo=${encodeURIComponent(target)}`;
    location.href = "";
    await submitLogin(render(() => components.Login()));
    assert.equal(location.href, "/dashboard");
  }
});

test("Firebase login also returns to export without accepting an external redirect", async () => {
  globalThis.fetch = (async () => Response.json({ error: "Please use Firebase login" }, { status: 400 })) as typeof fetch;
  location.pathname = "/login";
  location.search = "?returnTo=%2Fexportar-directorio";
  await submitLogin(render(() => components.Login()));
  assert.equal(f.firebaseLogins, 1);
  assert.equal(location.href, "/exportar-directorio");
});