import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';
import { MailService } from '../common/mail/mail.service.js';
import { checkEmail } from '../common/validation/email-check.js';
import { normalizeUsername } from '../common/validation/username.js';
import { EmailVerification } from './entities/email-verification.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(RefreshToken) private tokens: Repository<RefreshToken>,
    @InjectRepository(EmailVerification) private verifications: Repository<EmailVerification>,
    private jwt: JwtService,
    private mail: MailService,
    private cfg: ConfigService,
  ) {}

  async register(rawEmail: string, password: string, rawUsername: string) {
    const email = rawEmail.trim().toLowerCase();
    const emailCheck = checkEmail(email);
    if (!emailCheck.ok) throw new BadRequestException(emailCheck.error);

    const username = normalizeUsername(rawUsername);
    if (await this.users.findOneBy({ email })) throw new BadRequestException('Ya hay una cuenta asociada a este email');
    if (await this.users.findOneBy({ username })) throw new BadRequestException('Ese nombre de usuario ya está cogido');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.users.save({ email, username, passwordHash, isVerified: false });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.verifications.save({ userId: user.id, tokenHash, expiresAt, type: 'verify' });
    await this.mail.sendVerificationEmail(email, rawToken);

    return { message: 'Registration successful. Check your email.' };
  }

  async login(email: string, password: string) {
    const user = await this.users.findOneBy({ email: email.trim().toLowerCase() });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Email o contraseña incorrectos');
    if (!user.isVerified) throw new UnauthorizedException('Tienes que verificar tu email antes de entrar');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email o contraseña incorrectos');

    return this.issueTokens(user);
  }

  async issueTokens(user: User) {
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email },
      { expiresIn: this.cfg.get('JWT_EXPIRES_IN', '15m') },
    );

    const rawRefresh = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.tokens.save({ userId: user.id, tokenHash, expiresAt, revokedAt: null });

    return { access_token: accessToken, refresh_token: rawRefresh };
  }

  async refresh(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await this.tokens.findOne({ where: { tokenHash }, relations: { user: true } });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      if (record) {
        await this.tokens.update({ userId: record.userId }, { revokedAt: new Date() });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.tokens.update(record.id, { revokedAt: new Date() });
    return this.issueTokens(record.user);
  }

  async verifyEmail(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await this.verifications.findOneBy({ tokenHash, type: 'verify' });
    if (!record || record.expiresAt < new Date()) throw new BadRequestException('Invalid or expired token');

    await this.users.update(record.userId, { isVerified: true });
    await this.verifications.delete(record.id);
    return { message: 'Email verified' };
  }

  async forgotPassword(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.users.findOneBy({ email });
    if (!user) return { message: 'If the email exists, a reset link was sent' };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.verifications.save({ userId: user.id, tokenHash, expiresAt, type: 'reset' });
    await this.mail.sendPasswordResetEmail(email, rawToken);
    return { message: 'If the email exists, a reset link was sent' };
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record = await this.verifications.findOneBy({ tokenHash, type: 'reset' });
    if (!record || record.expiresAt < new Date()) throw new BadRequestException('Invalid or expired token');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.update(record.userId, { passwordHash });
    await this.verifications.delete(record.id);
    return { message: 'Password updated' };
  }

  async loginWithGoogle(idToken: string) {
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(this.cfg.getOrThrow('GOOGLE_CLIENT_ID'));
    const ticket = await client.verifyIdToken({
      idToken,
      audience: this.cfg.getOrThrow('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new UnauthorizedException('Invalid Google token');

    let user = await this.users.findOneBy({ email: payload.email });
    if (!user) {
      user = await this.users.save({
        email: payload.email,
        username: await this.freeUsername(),
        googleId: payload.sub,
        isVerified: true,
        passwordHash: null,
      });
    } else if (!user.googleId) {
      await this.users.update(user.id, { googleId: payload.sub, isVerified: true });
    }

    return this.issueTokens(user);
  }

  // Login con Google no pasa por el registro: se genera un nombre de usuario provisional
  // (usuario_1234) que no revela el email y que se puede cambiar desde el perfil
  private async freeUsername(): Promise<string> {
    for (;;) {
      const candidate = `usuario_${crypto.randomInt(1000, 1_000_000)}`;
      if (!(await this.users.findOneBy({ username: candidate }))) return candidate;
    }
  }
}
