import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { normalizeUsername, USERNAME_REGEX, USERNAME_RULES } from '../../common/validation/username.js';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @Transform(({ value }) => (typeof value === 'string' ? normalizeUsername(value) : value))
  @IsString()
  @Matches(USERNAME_REGEX, { message: USERNAME_RULES })
  username: string;
}
