import { IsOptional, IsString } from 'class-validator';
export class SuggestTrackDto {
  @IsString() spotifyTrackId: string;
  @IsString() spotifyUri: string;
  @IsString() trackName: string;
  @IsString() artist: string;
  @IsOptional() @IsString() albumArt?: string;
}
