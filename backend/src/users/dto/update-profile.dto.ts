import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

type Visibility = 'public' | 'friends' | 'private';

export class UpdateProfileDto {
  @IsOptional() @IsString() displayName?: string;
  @IsOptional() @IsUrl() avatarUrl?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsIn(['public', 'friends', 'private']) bioVisibility?: Visibility;
  @IsOptional() @IsString() musicGenres?: string;
  @IsOptional() @IsString() favoriteArtists?: string;
  @IsOptional() @IsIn(['public', 'friends', 'private']) musicVisibility?: Visibility;
}
