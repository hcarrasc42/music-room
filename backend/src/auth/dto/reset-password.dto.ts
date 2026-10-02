import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
export class ResetPasswordDto {
  @IsEmail() email: string;
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos' }) code: string;
  @IsString() @MinLength(8) password: string;
}
