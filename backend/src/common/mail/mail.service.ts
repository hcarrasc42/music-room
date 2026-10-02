import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');
  private transporter: nodemailer.Transporter | null = null;

  constructor(private cfg: ConfigService) {
    const user = cfg.get<string>('SMTP_USER');
    const pass = cfg.get<string>('SMTP_PASS');
    // Sin credenciales reales (o con las de .env.example) los códigos solo salen por la terminal
    const configured = !!user && !!pass && !user.startsWith('tu_') && !pass.startsWith('tu_');
    if (configured) {
      this.transporter = nodemailer.createTransport({
        host: cfg.get('SMTP_HOST', 'smtp.gmail.com'),
        port: Number(cfg.get('SMTP_PORT', 587)),
        secure: false,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP sin configurar: los códigos se mostrarán en esta terminal en vez de enviarse');
    }
  }

  sendVerificationEmail(to: string, code: string): Promise<void> {
    return this.sendCode(to, code, {
      subject: `${code} es tu código de verificación de MusicRoom`,
      intro: 'Para activar tu cuenta, introduce este código en la app:',
    });
  }

  sendPasswordResetEmail(to: string, code: string): Promise<void> {
    return this.sendCode(to, code, {
      subject: `${code} es tu código para cambiar la contraseña de MusicRoom`,
      intro: 'Para elegir una contraseña nueva, introduce este código en la app:',
    });
  }

  private async sendCode(to: string, code: string, { subject, intro }: { subject: string; intro: string }) {
    if (!this.transporter) {
      this.logger.log(`[DEV] Código para ${to}: ${code}`);
      return;
    }

    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    const outro = 'Caduca en 15 minutos. Si no lo has pedido tú, puedes ignorar este correo.';
    await this.transporter.sendMail({
      from: this.cfg.get('SMTP_FROM') ?? this.cfg.get('SMTP_USER'),
      to,
      subject,
      text: `${intro}\n\n${spaced}\n\n${outro}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;color:#222">
          <h2 style="margin:0 0 16px">🎵 MusicRoom</h2>
          <p>${intro}</p>
          <p style="font-size:34px;font-weight:bold;letter-spacing:8px;text-align:center;
                    background:#f2f2f2;border-radius:8px;padding:16px;margin:24px 0">${spaced}</p>
          <p style="color:#777;font-size:13px">${outro}</p>
        </div>`,
    });
  }
}
