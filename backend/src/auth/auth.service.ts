import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { MailService } from '../common/mail/mail.service.js';
import { checkEmail } from '../common/validation/email-check.js';
import { normalizeUsername } from '../common/validation/username.js';
import { EmailVerification } from './entities/email-verification.entity.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';

type CodeType = 'verify' | 'reset';
const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

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

    const code = await this.createCode(user.id, 'verify');
    await this.mail.sendVerificationEmail(email, code);

    return { message: 'Cuenta creada. Revisa tu email para verificarla' };
  }

  // Reenvía el código de verificación. Responde igual exista o no la cuenta,
  // para no revelar qué emails están registrados
  async resendVerification(rawEmail: string) {
    const user = await this.users.findOneBy({ email: rawEmail.trim().toLowerCase() });
    if (user && !user.isVerified && !(await this.sentRecently(user.id, 'verify'))) {
      const code = await this.createCode(user.id, 'verify');
      await this.mail.sendVerificationEmail(user.email, code);
    }
    return { message: 'Si la cuenta está pendiente de verificar, te hemos enviado un código nuevo' };
  }

  async login(email: string, password: string) {
    const wrong = new UnauthorizedException('Email o contraseña incorrectos');
    const user = await this.users.findOneBy({ email: email.trim().toLowerCase() });
    if (!user || !user.passwordHash) throw wrong;

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        `Demasiados intentos fallidos. Prueba de nuevo en ${minutes} min o recupera la contraseña`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      const attempts = user.failedLoginAttempts + 1;
      const locked = attempts >= MAX_LOGIN_ATTEMPTS;
      await this.users.update(user.id, {
        failedLoginAttempts: locked ? 0 : attempts,
        lockedUntil: locked ? new Date(Date.now() + LOGIN_LOCK_MS) : null,
      });
      throw wrong;
    }

    if (user.failedLoginAttempts || user.lockedUntil) {
      await this.users.update(user.id, { failedLoginAttempts: 0, lockedUntil: null });
    }
    // Se comprueba después de la contraseña: si no, cualquiera podría saber
    // qué emails están registrados sin verificar
    if (!user.isVerified) throw new UnauthorizedException('Tienes que verificar tu email antes de entrar');

    return this.issueTokens(user);
  }

  // Cierra la sesión de este dispositivo
  async logout(rawRefresh: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');
    await this.tokens.update({ tokenHash, revokedAt: IsNull() }, { revokedAt: new Date() });
    return { message: 'Sesión cerrada' };
  }

  // Cierra todas las sesiones: revoca los refresh tokens y anula los access tokens ya emitidos
  async logoutAll(userId: string) {
    await this.revokeAllSessions(userId);
    return { message: 'Sesión cerrada en todos los dispositivos' };
  }

  // Cambia la contraseña, cierra las demás sesiones y devuelve una sesión nueva para este dispositivo
  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string) {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) throw new UnauthorizedException();
    if (user.passwordHash) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
        throw new BadRequestException('La contraseña actual no es correcta');
      }
      if (await bcrypt.compare(newPassword, user.passwordHash)) {
        throw new BadRequestException('La nueva contraseña tiene que ser distinta de la actual');
      }
    }
    await this.users.update(userId, {
      passwordHash: await bcrypt.hash(newPassword, 10),
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await this.revokeAllSessions(userId);
    return this.issueTokens(user);
  }

  private async revokeAllSessions(userId: string) {
    await this.tokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.users.update(userId, { sessionsValidAfter: new Date() });
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
      throw new UnauthorizedException('La sesión ha caducado. Vuelve a iniciar sesión');
    }

    await this.tokens.update(record.id, { revokedAt: new Date() });
    return this.issueTokens(record.user);
  }

  // Verifica la cuenta con el código del email y deja al usuario ya logueado
  async verifyEmail(email: string, code: string) {
    const user = await this.consumeCode(email, code, 'verify');
    await this.users.update(user.id, { isVerified: true });
    return this.issueTokens(user);
  }

  async forgotPassword(rawEmail: string) {
    const user = await this.users.findOneBy({ email: rawEmail.trim().toLowerCase() });
    if (user && !(await this.sentRecently(user.id, 'reset'))) {
      const code = await this.createCode(user.id, 'reset');
      await this.mail.sendPasswordResetEmail(user.email, code);
    }
    return { message: 'Si el email está registrado, te hemos enviado un código' };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    const user = await this.consumeCode(email, code, 'reset');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    // Si pudo cambiar la contraseña es que controla el email: la cuenta queda verificada
    await this.users.update(user.id, { passwordHash, isVerified: true, failedLoginAttempts: 0, lockedUntil: null });
    // Cierra las sesiones abiertas por si alguien más tenía acceso a la cuenta
    await this.revokeAllSessions(user.id);
    return { message: 'Contraseña actualizada' };
  }

  // --- Códigos de 6 dígitos (verificación y reset) ---

  // Genera un código nuevo e invalida el anterior del mismo tipo
  private async createCode(userId: string, type: CodeType): Promise<string> {
    await this.verifications.delete({ userId, type });
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.verifications.save({
      userId,
      type,
      tokenHash: this.hashCode(userId, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      attempts: 0,
    });
    return code;
  }

  // Evita que se pueda bombardear un buzón pidiendo códigos sin parar
  private async sentRecently(userId: string, type: CodeType): Promise<boolean> {
    const last = await this.verifications.findOneBy({ userId, type });
    return !!last && Date.now() - last.createdAt.getTime() < RESEND_COOLDOWN_MS;
  }

  // Comprueba el código; tras MAX_CODE_ATTEMPTS fallos hay que pedir otro
  private async consumeCode(rawEmail: string, code: string, type: CodeType): Promise<User> {
    const invalid = new BadRequestException('El código no es válido o ha caducado');
    const user = await this.users.findOneBy({ email: rawEmail.trim().toLowerCase() });
    if (!user) throw invalid;
    const record = await this.verifications.findOneBy({ userId: user.id, type });
    if (!record || record.expiresAt < new Date()) throw invalid;

    const expected = Buffer.from(record.tokenHash, 'hex');
    const given = Buffer.from(this.hashCode(user.id, code), 'hex');
    if (!crypto.timingSafeEqual(expected, given)) {
      const attempts = record.attempts + 1;
      if (attempts >= MAX_CODE_ATTEMPTS) {
        await this.verifications.delete(record.id);
        throw new BadRequestException('Demasiados intentos. Pide un código nuevo');
      }
      await this.verifications.update(record.id, { attempts });
      throw invalid;
    }

    await this.verifications.delete(record.id);
    return user;
  }

  // HMAC con secreto del servidor: un volcado de la BD no permite probar el millón de códigos
  private hashCode(userId: string, code: string): string {
    return crypto
      .createHmac('sha256', this.cfg.getOrThrow('JWT_SECRET'))
      .update(`${userId}:${code}`)
      .digest('hex');
  }

  async loginWithGoogle(idToken: string) {
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client(this.cfg.getOrThrow('GOOGLE_CLIENT_ID'));
    const ticket = await client.verifyIdToken({
      idToken,
      audience: this.cfg.getOrThrow('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new UnauthorizedException('No se pudo validar la cuenta de Google');

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
