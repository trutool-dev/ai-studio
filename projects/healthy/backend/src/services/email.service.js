const nodemailer = require('nodemailer');
const logger = require('../utils/logger.util');

/**
 * Servicio de email.
 *
 * SEC-51 (SA-22 + JB-19): los logs nunca contienen el email del destinatario, el OTP
 * ni el enlace/token de recuperación (antes, sin SMTP, se registraban en claro y
 * acababan en los logs de Railway). Sin SMTP configurado:
 *   - en producción el envío falla de forma visible (log de error y `false`);
 *   - en desarrollo/test solo se registra que el email NO se envió (para obtener un
 *     OTP en dev, usar POST /auth/dev/code, protegido por token — SEC-30).
 */
function getTransporter() {
  if (!process.env.SMTP_USER || process.env.NODE_ENV === 'test') {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/** Gestiona la ausencia de SMTP sin registrar datos del email. */
function handleNoTransport(kind) {
  if (process.env.NODE_ENV === 'production') {
    logger.error(`[email] SMTP no configurado: email de ${kind} NO enviado`);
    return false;
  }
  logger.info(`[email] [DEV] Email de ${kind} no enviado (SMTP no configurado)`);
  return true;
}

/** Descripción del error de envío sin el mensaje completo (puede incluir direcciones). */
function errorRef(err) {
  return (err && (err.code || err.responseCode || err.name)) || 'error';
}

/**
 * Envía el código de verificación de email al usuario.
 * @param {string} to - Email del destinatario
 * @param {string} code - Código de 6 dígitos
 */
const sendVerificationEmail = async (to, code) => {
  const transporter = getTransporter();
  if (!transporter) return handleNoTransport('verificación');

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Healthy App <noreply@healthy.app>',
      to,
      subject: `${code} — Verifica tu cuenta en Healthy`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1a1a1a;">Bienvenido a Healthy</h2>
          <p style="color: #666;">Tu código de verificación es:</p>
          <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px;">${code}</span>
          </div>
          <p style="color: #999; font-size: 14px;">Este código expira en <strong>15 minutos</strong>.</p>
        </div>
      `,
      text: `Tu código de verificación es: ${code}\nExpira en 15 minutos.`,
    });
    logger.info('[email] Código de verificación enviado');
    return true;
  } catch (err) {
    logger.error(`[email] Error al enviar verificación (${errorRef(err)})`);
    return false;
  }
};

/**
 * Envía el email de recuperación de contraseña.
 * @param {string} to - Email del destinatario
 * @param {string} token - Token de reset (en claro; en BD solo se guarda su hash)
 */
const sendPasswordResetEmail = async (to, token) => {
  const transporter = getTransporter();
  if (!transporter) return handleNoTransport('recuperación');

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/auth/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Healthy App <noreply@healthy.app>',
      to,
      subject: 'Recupera tu contraseña de Healthy',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1a1a1a;">Recuperación de contraseña</h2>
          <p style="color: #666;">Haz clic en el botón para crear una nueva contraseña:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0;">
            Restablecer contraseña
          </a>
          <p style="color: #999; font-size: 14px;">Este enlace expira en <strong>1 hora</strong>.</p>
          <p style="color: #bbb; font-size: 12px;">O copia: ${resetUrl}</p>
        </div>
      `,
      text: `Restablece tu contraseña: ${resetUrl}\nExpira en 1 hora.`,
    });
    logger.info('[email] Email de recuperación enviado');
    return true;
  } catch (err) {
    logger.error(`[email] Error al enviar recuperación (${errorRef(err)})`);
    return false;
  }
};

/**
 * SEC-60 (SA-25): aviso al titular cuando alguien intenta registrarse con un email
 * que ya tiene cuenta (la API responde igual que a un registro nuevo).
 * @param {string} to - Email del destinatario
 */
const sendAccountExistsEmail = async (to) => {
  const transporter = getTransporter();
  if (!transporter) return handleNoTransport('cuenta existente');

  const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/auth/login`;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Healthy App <noreply@healthy.app>',
      to,
      subject: 'Ya tienes una cuenta en Healthy',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1a1a1a;">Ya tienes una cuenta</h2>
          <p style="color: #666;">Alguien (probablemente tú) ha intentado crear una cuenta en Healthy con este email, pero ya existe una.</p>
          <p style="color: #666;">Puedes <a href="${loginUrl}">iniciar sesión</a> o recuperar tu contraseña desde la app. Si no has sido tú, ignora este mensaje.</p>
        </div>
      `,
      text: 'Ya existe una cuenta de Healthy con este email. Inicia sesión o recupera tu contraseña desde la app. Si no has sido tú, ignora este mensaje.',
    });
    logger.info('[email] Aviso de cuenta existente enviado');
    return true;
  } catch (err) {
    logger.error(`[email] Error al enviar aviso de cuenta existente (${errorRef(err)})`);
    return false;
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendAccountExistsEmail };
