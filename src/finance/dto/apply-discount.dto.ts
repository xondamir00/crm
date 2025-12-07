import { IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyDiscountDto {
  @IsString()
  studentId: string;

  @IsString()
  groupId: string;

  @Type(() => Number)
  @IsNumber()
  year: number;

  @Type(() => Number)
  @IsNumber()
  month: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount: number; // so'mda, masalan 50000
}
