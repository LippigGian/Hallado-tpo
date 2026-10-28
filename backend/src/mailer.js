import nodemailer from 'nodemailer';

export function createRegistrationMailer(env = process.env) {
  const mode = env.MAIL_MODE || 'disabled';
  if (mode === 'console' && env.NODE_ENV !== 'production') {
    return { async sendCode(email, code) {
      console.log(`[SOLO DESARROLLO: no se envió email] Registro ${email}: ${code} (vence en 5 minutos)`);
    } };
  }
  if (mode !== 'smtp') return null;
  const port = Number(env.SMTP_PORT || 587);
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM || ![465, 587].includes(port)) return null;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST, port, secure: port === 465, requireTLS: port === 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  return { async sendCode(email, code) {
    await transport.sendMail({ from: env.MAIL_FROM, to: email,
      subject: 'Hallado: verificá tu email',
      text: `Tu código de registro en Hallado es ${code}. Vence en 5 minutos. Si no lo solicitaste, ignorá este mensaje.`,
    });
  } };
}
