import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { GoogleAuthDto } from './dto/google-auth.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { JwtGuard } from './guards/jwt.guard.js';

// Límites por IP más estrictos que el general (ver app.module.ts) en lo que se puede atacar por fuerza bruta
const STRICT = { default: { limit: 5, ttl: 60_000 } };
const LOGIN = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  @Throttle(STRICT)
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.username);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(LOGIN)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: RefreshTokenDto) {
    return this.auth.logout(dto.refresh_token);
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  logoutAll(@CurrentUser() u: { id: string }) {
    return this.auth.logoutAll(u.id);
  }

  @Post('change-password')
  @HttpCode(200)
  @Throttle(STRICT)
  @UseGuards(JwtGuard)
  changePassword(@CurrentUser() u: { id: string }, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(u.id, dto.currentPassword, dto.newPassword);
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle(STRICT)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.email, dto.code);
  }

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle(STRICT)
  resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle(STRICT)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle(STRICT)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.email, dto.code, dto.password);
  }

  @Post('google')
  @Throttle(LOGIN)
  loginWithGoogle(@Body() dto: GoogleAuthDto) {
    return this.auth.loginWithGoogle(dto.idToken);
  }
}
