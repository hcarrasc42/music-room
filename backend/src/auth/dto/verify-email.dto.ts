import { IsEmail, Matches } from 'class-validator';
export class VerifyEmailDto {
  @IsEmail() email: string;
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos' }) code: string;
}
