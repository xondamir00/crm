import {
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  IsString,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  studentId: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsDateString()
  paidAt?: string; // ISO string, agar frontend yuborsa

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
