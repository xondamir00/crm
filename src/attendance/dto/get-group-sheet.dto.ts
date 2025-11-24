import { IsDateString, IsOptional, IsNumberString } from 'class-validator';

export class GetGroupSheetDto {
  @IsDateString()
  date: string; // "2025-11-24"

  @IsOptional()
  @IsNumberString()
  lesson?: string; // agar dars raqamini ham ishlatsak
}
