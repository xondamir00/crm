import {
  IsNumber,
  Min,
  IsEnum,
  IsString,
  IsDateString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseCategory, PaymentMethod } from '@prisma/client';

export class CreateExpenseDto {
  @IsString()
  title: string;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsNumber()
  @Type(() => Number)
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
