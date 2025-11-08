import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateEnrollmentDto {
  @IsString()
  studentId: string;

  @IsString()
  groupId: string;

  @IsOptional()
  @IsDateString()
  joinDate?: string; // ISO: "2025-11-08"
}
