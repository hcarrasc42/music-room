import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';

// Repositorio en memoria con lo justo que usa AuthService para los códigos
function memoryRepo<T extends { id?: string }>(rows: T[] = []) {
  // Soporta igualdad simple e IsNull(), que es lo único que usa AuthService
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([k, v]: [string, any]) => (v?._type === 'isNull' ? row[k] == null : row[k] === v));
  return {
    rows,
    findOneBy: vi.fn(async (where: any) => rows.find((r) => matches(r, where)) ?? null),
    save: vi.fn(async (data: any) => {
      const row = { id: `id-${rows.length + 1}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    }),
    update: vi.fn(async (where: any, data: any) => {
      const crit = typeof where === 'string' ? { id: where } : where;
      rows.filter((r) => matches(r, crit)).forEach((r) => Object.assign(r, data));
    }),
    delete: vi.fn(async (where: any) => {
      const crit = typeof where === 'string' ? { id: where } : where;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], crit)) rows.splice(i, 1);
    }),
  };
}

describe('AuthService — códigos de 6 dígitos', () => {
  const email = 'ana@gmail.com';
  let users: ReturnType<typeof memoryRepo>;
  let verifications: ReturnType<typeof memoryRepo>;
  let tokens: ReturnType<typeof memoryRepo>;
  let mail: { sendVerificationEmail: ReturnType<typeof vi.fn>; sendPasswordResetEmail: ReturnType<typeof vi.fn> };
  let service: AuthService;

  const lastCode = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![1] as string;
  const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

  beforeEach(() => {
    users = memoryRepo([{ id: 'u1', email, username: 'ana', passwordHash: 'old', isVerified: false } as any]);
    verifications = memoryRepo();
    tokens = memoryRepo();
    mail = { sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() };
    const cfg = { get: (_k: string, d?: unknown) => d, getOrThrow: () => 'test-secret' } as unknown as ConfigService;
    const jwt = { sign: () => 'access' } as unknown as JwtService;
    service = new AuthService(users as any, tokens as any, verifications as any, jwt, mail as any, cfg);
  });

  it('envía un código de 6 dígitos y no lo guarda en claro', async () => {
    await service.forgotPassword(email);
    const code = lastCode(mail.sendPasswordResetEmail);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifications.rows).toHaveLength(1);
    expect((verifications.rows[0] as any).tokenHash).not.toContain(code);
  });

  it('cambia la contraseña con el código correcto y lo invalida', async () => {
    await service.forgotPassword(email);
    const code = lastCode(mail.sendPasswordResetEmail);
    await service.resetPassword(email, code, 'nuevaClave123');
    expect((users.rows[0] as any).passwordHash).not.toBe('old');
    await expect(service.resetPassword(email, code, 'otraClave123')).rejects.toThrow(BadRequestException);
  });

  it('el código de otro email no sirve', async () => {
    await service.forgotPassword(email);
    const code = lastCode(mail.sendPasswordResetEmail);
    await expect(service.resetPassword('otro@gmail.com', code, 'nuevaClave123')).rejects.toThrow(
      'El código no es válido o ha caducado',
    );
  });

  it('tras 5 fallos el código deja de valer aunque luego se acierte', async () => {
    await service.forgotPassword(email);
    const code = lastCode(mail.sendPasswordResetEmail);
    for (let i = 0; i < 4; i++) {
      await expect(service.resetPassword(email, wrong(code), 'nuevaClave123')).rejects.toThrow('no es válido');
    }
    await expect(service.resetPassword(email, wrong(code), 'nuevaClave123')).rejects.toThrow('Demasiados intentos');
    await expect(service.resetPassword(email, code, 'nuevaClave123')).rejects.toThrow('no es válido');
  });

  it('no reenvía otro código antes de un minuto', async () => {
    await service.forgotPassword(email);
    await service.forgotPassword(email);
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('verifica la cuenta con el código y devuelve la sesión', async () => {
    await service.resendVerification(email);
    const code = lastCode(mail.sendVerificationEmail);
    const result = await service.verifyEmail(email, code);
    expect((users.rows[0] as any).isVerified).toBe(true);
    expect(result.access_token).toBe('access');
  });

  it('no revela si un email existe', async () => {
    const res = await service.forgotPassword('nadie@gmail.com');
    expect(res.message).toBe('Si el email está registrado, te hemos enviado un código');
    expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService — login y sesiones', () => {
  const email = 'ana@gmail.com';
  let users: ReturnType<typeof memoryRepo>;
  let tokens: ReturnType<typeof memoryRepo>;
  let service: AuthService;
  const user = () => users.rows[0] as any;

  beforeEach(async () => {
    const passwordHash = await bcrypt.hash('claveBuena1', 4);
    users = memoryRepo([
      { id: 'u1', email, username: 'ana', passwordHash, isVerified: true, failedLoginAttempts: 0, lockedUntil: null } as any,
    ]);
    tokens = memoryRepo();
    const cfg = { get: (_k: string, d?: unknown) => d, getOrThrow: () => 'test-secret' } as unknown as ConfigService;
    const jwt = { sign: () => 'access' } as unknown as JwtService;
    service = new AuthService(users as any, tokens as any, memoryRepo() as any, jwt, {} as any, cfg);
  });

  it('bloquea la cuenta 15 min tras 5 contraseñas fallidas, aunque luego acierte', async () => {
    for (let i = 0; i < 5; i++) {
      await expect(service.login(email, 'mala')).rejects.toThrow('Email o contraseña incorrectos');
    }
    expect(user().lockedUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    await expect(service.login(email, 'claveBuena1')).rejects.toThrow('Demasiados intentos fallidos');
  });

  it('un login correcto reinicia el contador de fallos', async () => {
    await expect(service.login(email, 'mala')).rejects.toThrow();
    expect(user().failedLoginAttempts).toBe(1);
    await service.login(email, 'claveBuena1');
    expect(user().failedLoginAttempts).toBe(0);
  });

  it('no dice que la cuenta está sin verificar si la contraseña es incorrecta', async () => {
    user().isVerified = false;
    await expect(service.login(email, 'mala')).rejects.toThrow('Email o contraseña incorrectos');
    await expect(service.login(email, 'claveBuena1')).rejects.toThrow('verificar tu email');
  });

  it('logout revoca solo el refresh token de este dispositivo', async () => {
    const a = await service.login(email, 'claveBuena1');
    await service.login(email, 'claveBuena1');
    await service.logout(a.refresh_token);
    expect(tokens.rows.filter((t: any) => t.revokedAt)).toHaveLength(1);
  });

  it('cambiar la contraseña exige la actual y cierra las demás sesiones', async () => {
    await service.login(email, 'claveBuena1');
    await expect(service.changePassword('u1', 'mala', 'claveNueva1')).rejects.toThrow('contraseña actual');
    const fresh = await service.changePassword('u1', 'claveBuena1', 'claveNueva1');
    expect(fresh.refresh_token).toBeDefined();
    expect(tokens.rows.filter((t: any) => !t.revokedAt)).toHaveLength(1); // solo la nueva
    expect(user().sessionsValidAfter).toBeInstanceOf(Date);
    await expect(service.login(email, 'claveBuena1')).rejects.toThrow();
    await service.login(email, 'claveNueva1');
  });

  it('una cuenta creada con Google puede poner contraseña sin dar la actual', async () => {
    user().passwordHash = null;
    await service.changePassword('u1', undefined, 'claveNueva1');
    await service.login(email, 'claveNueva1');
  });
});
