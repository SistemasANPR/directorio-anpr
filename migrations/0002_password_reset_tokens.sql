-- Password reset tokens — tabla AISLADA para recuperación de contraseña.
-- Cambio puramente ADITIVO: crea una tabla nueva, no modifica `users` ni
-- ninguna tabla existente. Seguro para desarrollo y producción.

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "firebase_uid" text,
  "token_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "request_ip" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);

-- Búsqueda rápida por hash (validación del token) y por email (rate limiting).
CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_token_hash" ON "password_reset_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_email" ON "password_reset_tokens" ("email");
CREATE INDEX IF NOT EXISTS "idx_password_reset_tokens_expires_at" ON "password_reset_tokens" ("expires_at");
