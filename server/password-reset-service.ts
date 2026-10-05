import crypto from "crypto";
import nodemailer from "nodemailer";
import { storage } from "./storage.js";

/**
 * Servicio de recuperación de contraseña.
 *
 * - Reutiliza la configuración SMTP existente del proyecto (tabla
 *   email_configuration) para el transporte real.
 * - FUERZA el remitente a Sistemas@anpr.org.mx como valor FIJO del sistema.
 *   Este valor está codificado aquí y NO se lee de ninguna configuración
 *   editable por usuarios ni administradores.
 * - Genera tokens únicos firmados (HMAC-SHA256) con expiración de 60 minutos.
 */

// ─────────────────────────────────────────────────────────────────────────────
// REMITENTE FIJO — no editable desde la interfaz ni configuración administrativa
export const PASSWORD_RESET_SENDER_EMAIL = "Sistemas@anpr.org.mx";
export const PASSWORD_RESET_SENDER_NAME = "Directorio ANPR";
// ─────────────────────────────────────────────────────────────────────────────

export const RESET_TOKEN_TTL_MINUTES = 60;

// Secreto para firmar (HMAC) los tokens. Usa un secreto dedicado si existe; si
// no, cae en otros secretos del entorno siempre presentes. El token firmado se
// guarda hasheado en BD: ni siquiera una fuga de la BD permite falsificarlo.
const SIGNING_SECRET =
  process.env.PASSWORD_RESET_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.STRIPE_SECRET_KEY ||
  "anpr-directorio-password-reset-fallback-secret";

/** Genera un token aleatorio y su firma (hash) para almacenar en BD. */
export function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex"); // 256 bits, único
  const tokenHash = hashToken(rawToken);
  return { rawToken, tokenHash };
}

/** Firma/deriva el hash de almacenamiento de un token (HMAC-SHA256). */
export function hashToken(rawToken: string): string {
  return crypto.createHmac("sha256", SIGNING_SECRET).update(rawToken).digest("hex");
}

/** Construye el transporter reutilizando el SMTP existente del proyecto. */
async function getResetTransporter(): Promise<nodemailer.Transporter> {
  const emailConfig = await storage.getEmailConfiguration();
  if (!emailConfig) {
    throw new Error(
      "No hay configuración SMTP activa en el sistema (tabla email_configuration)."
    );
  }

  const transporterConfig: any = {
    host: emailConfig.smtpHost,
    port: emailConfig.smtpPort,
    secure: emailConfig.encryption === "ssl",
    auth: {
      user: emailConfig.username,
      pass: emailConfig.password,
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  };

  if (emailConfig.encryption === "tls" || emailConfig.encryption === "starttls") {
    transporterConfig.requireTLS = true;
    transporterConfig.tls = { rejectUnauthorized: false };
  } else if (emailConfig.encryption === "ssl") {
    transporterConfig.secure = true;
    transporterConfig.tls = { rejectUnauthorized: false };
  }

  return nodemailer.createTransport(transporterConfig);
}

/** Plantilla HTML profesional y responsiva (Gmail/Outlook/móvil). */
function buildResetEmailHtml(resetLink: string, displayName?: string): string {
  const greeting = displayName ? `Hola ${escapeHtml(displayName)},` : "Hola,";
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Recuperación de contraseña</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin:0; padding:0; background-color:#f3f4f6; -webkit-text-size-adjust:100%; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }
    @media only screen and (max-width:600px){
      .container { width:100% !important; }
      .px { padding-left:24px !important; padding-right:24px !important; }
      .btn-a { display:block !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6;">
  <span style="display:none; font-size:1px; color:#f3f4f6; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">
    Restablece tu contraseña del Directorio ANPR. El enlace caduca en 60 minutos.
  </span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Encabezado -->
          <tr>
            <td align="center" style="background-color:#1e40af; padding:36px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="width:56px; height:56px; background-color:#ffffff; border-radius:12px; display:inline-block; line-height:56px; text-align:center; font-family:Arial,Helvetica,sans-serif; font-size:28px; color:#1e40af; font-weight:bold;">A</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:14px; font-family:Arial,Helvetica,sans-serif; font-size:20px; font-weight:bold; color:#ffffff;">
                    Directorio ANPR
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Cuerpo -->
          <tr>
            <td class="px" style="padding:36px 40px 8px 40px; font-family:Arial,Helvetica,sans-serif;">
              <h1 style="margin:0 0 16px 0; font-size:22px; line-height:1.3; color:#111827;">Recuperación de contraseña</h1>
              <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6; color:#374151;">${greeting}</p>
              <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6; color:#374151;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para crear una nueva contraseña.
              </p>
            </td>
          </tr>
          <!-- Botón -->
          <tr>
            <td align="center" style="padding:12px 40px 28px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" bgcolor="#1e40af" style="border-radius:8px;">
                    <a class="btn-a" href="${resetLink}" target="_blank" style="display:inline-block; padding:15px 36px; font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold; color:#ffffff; background-color:#1e40af; border-radius:8px;">
                      Restablecer mi contraseña
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Aviso de expiración -->
          <tr>
            <td class="px" style="padding:0 40px 8px 40px; font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff; border-radius:8px;">
                <tr>
                  <td style="padding:14px 18px; font-size:14px; line-height:1.5; color:#1e40af;">
                    ⏱️ Por seguridad, este enlace caduca en <strong>60 minutos</strong> y solo puede usarse una vez.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Enlace alterno -->
          <tr>
            <td class="px" style="padding:18px 40px 8px 40px; font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 6px 0; font-size:13px; line-height:1.5; color:#6b7280;">
                Si el botón no funciona, copia y pega esta dirección en tu navegador:
              </p>
              <p style="margin:0; font-size:13px; line-height:1.5; word-break:break-all;">
                <a href="${resetLink}" target="_blank" style="color:#1e40af;">${resetLink}</a>
              </p>
            </td>
          </tr>
          <!-- Nota de seguridad -->
          <tr>
            <td class="px" style="padding:18px 40px 32px 40px; font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0; font-size:13px; line-height:1.6; color:#6b7280;">
                Si tú no solicitaste este cambio, puedes ignorar este correo: tu contraseña actual seguirá siendo válida.
              </p>
            </td>
          </tr>
          <!-- Pie -->
          <tr>
            <td align="center" style="background-color:#f9fafb; padding:24px 40px; border-top:1px solid #e5e7eb; font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 4px 0; font-size:12px; color:#9ca3af;">
                Este es un mensaje automático, por favor no respondas a este correo.
              </p>
              <p style="margin:0; font-size:12px; color:#9ca3af;">
                © ${year} Directorio ANPR — Equipamiento Urbano
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Versión de respaldo en texto plano. */
function buildResetEmailText(resetLink: string, displayName?: string): string {
  const greeting = displayName ? `Hola ${displayName},` : "Hola,";
  return [
    greeting,
    "",
    "Recibimos una solicitud para restablecer la contraseña de tu cuenta del Directorio ANPR.",
    "",
    "Abre el siguiente enlace para crear una nueva contraseña:",
    resetLink,
    "",
    "Por seguridad, este enlace caduca en 60 minutos y solo puede usarse una vez.",
    "",
    "Si tú no solicitaste este cambio, ignora este correo: tu contraseña actual seguirá siendo válida.",
    "",
    "— Directorio ANPR (mensaje automático, no respondas a este correo)",
  ].join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Envía el correo de recuperación REAL, siempre desde el remitente fijo
 * Sistemas@anpr.org.mx, reutilizando el SMTP existente.
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  resetLink: string,
  displayName?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = await getResetTransporter();

    const info = await transporter.sendMail({
      from: `"${PASSWORD_RESET_SENDER_NAME}" <${PASSWORD_RESET_SENDER_EMAIL}>`,
      sender: PASSWORD_RESET_SENDER_EMAIL,
      to: toEmail,
      subject: "Recuperación de contraseña — Directorio ANPR",
      text: buildResetEmailText(resetLink, displayName),
      html: buildResetEmailHtml(resetLink, displayName),
    });

    // Log de entrega REAL: deja constancia de los campos que confirman que el
    // servidor SMTP aceptó (o rechazó) el mensaje, para auditoría/diagnóstico.
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    console.log(
      `[password-reset] Envío a ${toEmail} desde ${PASSWORD_RESET_SENDER_EMAIL} | ` +
        `messageId=${info.messageId} | accepted=${JSON.stringify(accepted)} | ` +
        `rejected=${JSON.stringify(rejected)} | response=${info.response || ""}`
    );

    // Si el servidor no aceptó el destinatario, tratarlo como fallo explícito.
    if (rejected.length > 0 || accepted.length === 0) {
      return {
        success: false,
        message: `El servidor SMTP no aceptó el destinatario ${toEmail} (rejected=${JSON.stringify(rejected)})`,
      };
    }

    return {
      success: true,
      message: `Correo enviado a ${toEmail} (messageId=${info.messageId})`,
    };
  } catch (error: any) {
    console.error(
      `[password-reset] ERROR al enviar correo de recuperación a ${toEmail}:`,
      error?.message || error
    );
    return { success: false, message: error?.message || "Error al enviar correo" };
  }
}


