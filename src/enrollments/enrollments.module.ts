import { Module } from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from './enrollments.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceModule } from 'src/finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, PrismaService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
