import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class QueryEnrollmentDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'PAUSED', 'LEFT'] as const)
  status?: 'ACTIVE' | 'PAUSED' | 'LEFT';

  @IsOptional()
  @IsDateString()
  from?: string; // joinDate >= from

  @IsOptional()
  @IsDateString()
  to?: string; // joinDate <= to

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;
}
