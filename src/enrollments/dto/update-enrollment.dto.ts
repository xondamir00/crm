import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class UpdateEnrollmentDto {
  @IsOptional()
  @IsEnum(['ACTIVE', 'PAUSED', 'LEFT'] as const)
  status?: 'ACTIVE' | 'PAUSED' | 'LEFT';

  @IsOptional()
  @IsDateString()
  leaveDate?: string;
}
