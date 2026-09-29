import nodemailer from 'nodemailer';
import { storage } from './storage';
import { db } from './db';
import { companies, membershipTypes } from '@shared/schema';

interface EmailData {
  nombre_usuario?: string;
  nombre_empresa?: string;
  plan_nombre?: string;
  fecha_inicio?: string;
  fecha_vencimiento?: string;
  fecha_cancelacion?: string;
  dias_restantes?: string;
}

type TemplateType = 'welcome' | 'renewal' | 'cancellation' | 'notification';

async function getTransporter() {
  const emailConfig = await storage.getEmailConfiguration();
  
  if (!emailConfig) {
    throw new Error('No hay configuración de correo SMTP');
  }
  
  const transporterConfig: any = {
    host: emailConfig.smtpHost,
    port: emailConfig.smtpPort,
    secure: emailConfig.encryption === 'ssl',
    auth: {
      user: emailConfig.username,
      pass: emailConfig.password,
    },
    connectionTimeout: 60000,
    greetingTimeout: 30000,
    socketTimeout: 60000,
  };
  
  if (emailConfig.encryption === 'tls' || emailConfig.encryption === 'starttls') {
    transporterConfig.requireTLS = true;
    transporterConfig.tls = { rejectUnauthorized: false };
  } else if (emailConfig.encryption === 'ssl') {
    transporterConfig.secure = true;
    transporterConfig.tls = { rejectUnauthorized: false };
  }
  
  return {
    transporter: nodemailer.createTransport(transporterConfig),
    fromEmail: emailConfig.fromEmail,
    fromName: emailConfig.fromName,
  };
}

function replaceVariables(text: string, data: EmailData): string {
  let result = text;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

export async function sendTemplateEmail(
  templateType: TemplateType,
  toEmail: string,
  data: EmailData
): Promise<{ success: boolean; message: string }> {
  try {
    const template = await storage.getEmailTemplateByType(templateType);
    
    if (!template) {
      console.log(`Template '${templateType}' not found, skipping email`);
      return { success: false, message: `Plantilla '${templateType}' no encontrada` };
    }
    
    const { transporter, fromEmail, fromName } = await getTransporter();
    
    const subject = replaceVariables(template.subject, data);
    const htmlContent = replaceVariables(template.htmlContent, data);
    
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: toEmail,
      subject,
      html: htmlContent,
    });
    
    console.log(`Email '${templateType}' sent to ${toEmail}`);
    return { success: true, message: `Correo enviado a ${toEmail}` };
  } catch (error: any) {
    console.error(`Error sending ${templateType} email:`, error);
    return { success: false, message: error.message || 'Error al enviar correo' };
  }
}

export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  companyName: string,
  planName: string,
  companyId?: number,
  amount?: string,
  periodicidad?: string
): Promise<{ success: boolean; message: string }> {
  const baseUrl = process.env.REPLIT_APP_URL || 'https://directorio-ANPR.replit.app';
  const receiptUrl = companyId ? `${baseUrl}/api/companies/${companyId}/payment-receipt` : '';
  
  return sendTemplateEmail('welcome', userEmail, {
    nombre_usuario: userName,
    nombre_empresa: companyName,
    plan_nombre: planName,
    fecha_inicio: new Date().toLocaleDateString('es-MX'),
    enlace_recibo: receiptUrl,
    monto_pagado: amount || '',
    periodicidad: periodicidad || '',
  });
}

export async function sendRenewalEmail(
  userEmail: string,
  userName: string,
  companyName: string,
  planName: string,
  expirationDate: Date
): Promise<{ success: boolean; message: string }> {
  return sendTemplateEmail('renewal', userEmail, {
    nombre_usuario: userName,
    nombre_empresa: companyName,
    plan_nombre: planName,
    fecha_vencimiento: expirationDate.toLocaleDateString('es-MX'),
  });
}

export async function sendCancellationEmail(
  userEmail: string,
  userName: string,
  companyName: string,
  planName: string
): Promise<{ success: boolean; message: string }> {
  return sendTemplateEmail('cancellation', userEmail, {
    nombre_usuario: userName,
    nombre_empresa: companyName,
    plan_nombre: planName,
    fecha_cancelacion: new Date().toLocaleDateString('es-MX'),
  });
}

export async function sendExpirationNotification(
  userEmail: string,
  userName: string,
  companyName: string,
  planName: string,
  expirationDate: Date,
  daysRemaining: number
): Promise<{ success: boolean; message: string }> {
  return sendTemplateEmail('notification', userEmail, {
    nombre_usuario: userName,
    nombre_empresa: companyName,
    plan_nombre: planName,
    fecha_vencimiento: expirationDate.toLocaleDateString('es-MX'),
    dias_restantes: daysRemaining.toString(),
  });
}

export async function sendActivationEmail(
  userEmail: string,
  userName: string,
  tempPassword: string,
  activationUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { transporter, fromEmail, fromName } = await getTransporter();
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Bienvenido al Directorio de Equipamiento Urbano</h2>
        <p>Hola <strong>${userName}</strong>,</p>
        <p>Se ha creado una cuenta para ti como representante de empresa en nuestro directorio.</p>
        <p>Para activar tu cuenta y establecer tu contraseña definitiva, sigue estos pasos:</p>
        <ol>
          <li>Visita la página de activación: <a href="${activationUrl}">${activationUrl}</a></li>
          <li>Ingresa tu correo electrónico: <strong>${userEmail}</strong></li>
          <li>Ingresa tu contraseña temporal: <strong>${tempPassword}</strong></li>
          <li>Crea tu nueva contraseña definitiva</li>
        </ol>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Importante:</strong> Esta contraseña temporal solo puede usarse una vez. Después de usarla, deberás crear tu contraseña definitiva.</p>
        </div>
        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
        <p>Saludos,<br>El equipo del Directorio de Equipamiento Urbano</p>
      </div>
    `;
    
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: userEmail,
      subject: 'Activa tu cuenta - Directorio de Equipamiento Urbano',
      html: htmlContent,
    });
    
    console.log(`Activation email sent to ${userEmail}`);
    return { success: true, message: `Correo de activación enviado a ${userEmail}` };
  } catch (error: any) {
    console.error(`Error sending activation email:`, error);
    return { success: false, message: error.message || 'Error al enviar correo de activación' };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Límite simple anti-abuso: máximo 10 correos de "nueva reseña" por hora.
let reviewNotificationTimestamps: number[] = [];

export async function sendNewReviewNotificationToAdmins(review: {
  nombre: string;
  email: string;
  calificacion: number;
  comentario: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const now = Date.now();
    reviewNotificationTimestamps = reviewNotificationTimestamps.filter((t) => now - t < 60 * 60 * 1000);
    if (reviewNotificationTimestamps.length >= 10) {
      console.warn('New review notification skipped: hourly limit reached');
      return { success: false, message: 'Límite de notificaciones por hora alcanzado' };
    }
    reviewNotificationTimestamps.push(now);

    const allUsers = await storage.getAllUsers();
    const adminEmails = allUsers
      .filter((u) => u.role === 'admin' && u.email)
      .map((u) => u.email);

    if (adminEmails.length === 0) {
      return { success: false, message: 'No hay administradores con correo para notificar' };
    }

    const { transporter, fromEmail, fromName } = await getTransporter();
    const stars = '★'.repeat(review.calificacion) + '☆'.repeat(Math.max(0, 5 - review.calificacion));
    const baseUrl = process.env.REPLIT_APP_URL || 'https://directorio.anpr.org.mx';

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: adminEmails.join(', '),
      subject: 'Nueva reseña pendiente de moderación',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Nueva reseña de la plataforma</h2>
          <p>Se recibió una nueva reseña y está pendiente de moderación:</p>
          <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Usuario:</strong> ${escapeHtml(review.nombre)} (${escapeHtml(review.email)})</p>
            <p style="margin: 4px 0;"><strong>Calificación:</strong> ${stars} (${review.calificacion}/5)</p>
            <p style="margin: 4px 0;"><strong>Comentario:</strong></p>
            <p style="margin: 4px 0; white-space: pre-wrap;">${escapeHtml(review.comentario)}</p>
          </div>
          <p>
            <a href="${baseUrl}/admin/reviews" style="background: #16a34a; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none;">
              Ir a Gestión de Reseñas
            </a>
          </p>
        </div>
      `,
    });

    console.log(`New review notification sent to admins: ${adminEmails.join(', ')}`);
    return { success: true, message: `Notificación enviada a ${adminEmails.length} administrador(es)` };
  } catch (error: any) {
    console.error('Error sending new review notification:', error);
    return { success: false, message: error.message || 'Error al enviar notificación de reseña' };
  }
}

export async function checkAndSendExpirationNotifications(): Promise<{
  sent: number;
  errors: number;
  details: string[];
}> {
  const details: string[] = [];
  let sent = 0;
  let errors = 0;
  
  try {
    const template = await storage.getEmailTemplateByType('notification');
    
    const timing = template?.notificationTiming as { enabled?: boolean; value?: number; unit?: string } | null;
    
    if (!template || !timing?.enabled) {
      details.push('Notificaciones de vencimiento deshabilitadas o plantilla no configurada');
      return { sent, errors, details };
    }
    
    let daysBeforeExpiration = timing.value || 7;
    
    if (timing.unit === 'weeks') {
      daysBeforeExpiration = (timing.value || 1) * 7;
    } else if (timing.unit === 'months') {
      daysBeforeExpiration = (timing.value || 1) * 30;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiration);
    
    const allCompanies = await db.select().from(companies);
    
    for (const company of allCompanies) {
      if (!company.fechaVencimiento || !company.email1) continue;
      
      const expirationDate = new Date(company.fechaVencimiento);
      expirationDate.setHours(0, 0, 0, 0);
      
      const diffTime = expirationDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === daysBeforeExpiration) {
        try {
          const membershipType = company.membershipTypeId 
            ? await storage.getMembershipType(company.membershipTypeId)
            : null;
          
          const representanteName = company.nombreRepresentante || company.nombreEmpresa;
          
          const result = await sendExpirationNotification(
            company.email1,
            representanteName,
            company.nombreEmpresa,
            membershipType?.nombrePlan || 'Membresía',
            expirationDate,
            diffDays
          );
          
          if (result.success) {
            sent++;
            details.push(`✅ Enviado a ${company.nombreEmpresa} (${company.email1})`);
          } else {
            errors++;
            details.push(`❌ Error en ${company.nombreEmpresa}: ${result.message}`);
          }
        } catch (error: any) {
          errors++;
          details.push(`❌ Error en ${company.nombreEmpresa}: ${error.message}`);
        }
      }
    }
    
    if (sent === 0 && errors === 0) {
      details.push(`No hay empresas con vencimiento en ${daysBeforeExpiration} días`);
    }
    
  } catch (error: any) {
    errors++;
    details.push(`Error general: ${error.message}`);
  }
  
  return { sent, errors, details };
}
