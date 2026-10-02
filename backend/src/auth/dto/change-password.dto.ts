import { IsOptional, IsString, MinLength } from 'class-validator';
export class ChangePasswordDto {
  // Obligatoria si la cuenta ya tiene contraseña (no lo es si se creó con Google)
  @IsOptional() @IsString() currentPassword?: string;
  @IsString() @MinLength(8) newPassword: string;
}
