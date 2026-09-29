import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// El webhook de Stripe DEBE recibir el cuerpo CRUDO (Buffer) para verificar la
// firma con stripe.webhooks.constructEvent. Se registra ANTES del express.json
// global; una vez que este parser marca req._body, express.json lo omite.
app.use('/api/stripe-webhook', express.raw({ type: '*/*' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Disable CSP for development
app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.removeHeader('X-Content-Security-Policy');
  res.removeHeader('X-WebKit-CSP');
  next();
});



// Middleware to extract user info from headers for API requests
app.use('/api', (req: any, res, next) => {
  const userHeader = req.headers['x-user-info'];
  console.log("Middleware debug - userHeader:", userHeader);
  if (userHeader) {
    try {
      req.user = JSON.parse(userHeader as string);
      console.log("Middleware debug - parsed user:", req.user);
    } catch (error) {
      console.log("Middleware debug - parsing error:", error);
      // If parsing fails, continue without user info
    }
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    let status = err.status || err.statusCode || 500;
    let message = err.message || "Error interno del servidor";

    // Errores de subida de archivos (multer): devolver una razón clara en español.
    if (err && err.name === "MulterError") {
      status = 400;
      switch (err.code) {
        case "LIMIT_FILE_SIZE":
          status = 413;
          message = ["document", "catalogoFile"].includes(err.field)
            ? "El documento supera el tamaño máximo permitido de 20 MB. Selecciona un archivo más ligero."
            : "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.";
          break;
        case "LIMIT_FILE_COUNT":
        case "LIMIT_UNEXPECTED_FILE":
          message = "Se excedió el número máximo de archivos permitidos.";
          break;
        default:
          message = `Error al subir el archivo: ${err.message}`;
      }
    }

    // Log para diagnóstico (no se debe perder el error).
    console.error("Unhandled error:", err);

    // Si ya se enviaron cabeceras, delega en el handler por defecto de Express.
    if (res.headersSent) {
      return next(err);
    }

    // Responder al cliente. NO relanzar: hacerlo provoca una excepción no
    // capturada que puede tumbar el proceso.
    res.status(status).json({ error: message, message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
