const nodemailer = require('nodemailer');
const logger = require('../utils/logger.util');

/**
 * En desarrollo (sin credenciales SMTP), los emails se loguean en consola.
 * En producción, se envían por SMTP real.
 */
function getTransporter() {
  if (!process.env.SMTP_USER || process.env.NODE_ENV === 'test') {
    // Modo dev: nodemailer ethereal (sink) o solo logging
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

/**
 * Envía el código de verificación de email al usuario.
 * @param {string} to - Email del destinatario
 * @param {string} code - Código de 6 dígitos
 */
const sendVerificationEmail = async (to, code) => {
  const transporter = getTransporter();

  if (!transporter) {
    logger.info(`[email] [DEV] Código de verificación para ${to}: ${code}`);
    return true;
  }

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
    logger.info(`[email] Código de verificación enviado a ${to}`);
    return true;
  } catch (err) {
    logger.error(`[email] Error al enviar verificación a ${to}: ${err.message}`);
    return false;
  }
};

/**
 * Envía el email de recuperación de contraseña.
 * @param {string} to - Email del destinatario
 * @param {string} token - Token de reset
 */
const sendPasswordResetEmail = async (to, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:8081'}/auth/reset-password?token=${token}`;
  const transporter = getTransporter();

  if (!transporter) {
    logger.info(`[email] [DEV] Enlace de reset para ${to}: ${resetUrl}`);
    return true;
  }

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
          <p style="color: #999; font-size: 14px;">Este enlace expira en <strong>24 horas</strong>.</p>
          <p style="color: #bbb; font-size: 12px;">O copia: ${resetUrl}</p>
        </div>
      `,
      text: `Restablece tu contraseña: ${resetUrl}\nExpira en 24 horas.`,
    });
    logger.info(`[email] Email de recuperación enviado a ${to}`);
    return true;
  } catch (err) {
    logger.error(`[email] Error al enviar recuperación a ${to}: ${err.message}`);
    return false;
  }
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
