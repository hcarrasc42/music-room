import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private cfg: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: cfg.getOrThrow('SMTP_HOST'),
      port: cfg.getOrThrow<number>('SMTP_PORT'),
      secure: false,
      auth: {
        user: cfg.getOrThrow('SMTP_USER'),
        pass: cfg.getOrThrow('SMTP_PASS'),
      },
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const url = `http://localhost:3000/auth/verify-email?token=${token}`;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[DEV] Verify email for ${to}:\n  ${url}\n`);
      return;
    }
    await this.transporter.sendMail({
      from: this.cfg.get('SMTP_FROM'),
      to,
      subject: 'Verifica tu cuenta de MusicRoom',
      text: `Haz click aquí para verificar tu cuenta: ${url}`,
    });
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[DEV] Password reset token for ${to}: ${token}\n`);
      return;
    }
    await this.transporter.sendMail({
      from: this.cfg.get('SMTP_FROM'),
      to,
      subject: 'Restablece tu contraseña de MusicRoom',
      text: `Tu token de reset: ${token}\nExpira en 1 hora.`,
    });
  }
}
