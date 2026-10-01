import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUrl, Matches } from 'class-validator';
import { normalizeUsername, USERNAME_REGEX, USERNAME_RULES } from '../../common/validation/username.js';

type Visibility = 'public' | 'friends' | 'private';

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? normalizeUsername(value) : value))
  @IsString()
  @Matches(USERNAME_REGEX, { message: USERNAME_RULES })
  username?: string;

  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsUrl() avatarUrl?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsIn(['public', 'friends', 'private']) bioVisibility?: Visibility;
  @IsOptional() @IsString() musicGenres?: string;
  @IsOptional() @IsString() favoriteArtists?: string;
  @IsOptional() @IsIn(['public', 'friends', 'private']) musicVisibility?: Visibility;
}
