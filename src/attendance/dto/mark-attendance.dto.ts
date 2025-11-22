// dto/mark-attendance.dto.ts
import { AttendanceStatus } from '@prisma/client';
import {
  IsArray,
  ValidateNested,
  IsBoolean,
  IsString,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

class MarkItemDto {
  @IsString()
  studentId: string;

  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class MarkAttendanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarkItemDto)
  items: MarkItemDto[];

  @IsBoolean()
  lock: boolean;
}
