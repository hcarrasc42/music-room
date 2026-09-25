import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateEventDto {
  @IsString() name: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsIn(['open', 'invited', 'geo']) license?: 'open' | 'invited' | 'geo';
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(10_000) radiusM?: number;
  @IsOptional() @IsString() timeStart?: string;
  @IsOptional() @IsString() timeEnd?: string;
}
