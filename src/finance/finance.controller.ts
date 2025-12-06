// src/finance/finance.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role, PaymentMethod } from '@prisma/client';
import { Request } from 'express';
import { Roles } from 'src/auth/decorator/roles.decorator';

interface AuthRequest extends Request {
  user: {
    userId: string;
    role: Role;
  };
}

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('payments')
  @Roles(Role.ADMIN, Role.MANAGER)
  async createPayment(@Body() dto: CreatePaymentDto, @Req() req: AuthRequest) {
    const recordedById = req.user.userId;
    return this.financeService.createPayment(dto, recordedById);
  }

  @Post('expenses')
  @Roles(Role.ADMIN, Role.MANAGER)
  async createExpense(@Body() dto: CreateExpenseDto, @Req() req: AuthRequest) {
    const recordedById = req.user.userId;
    return this.financeService.createExpense(dto, recordedById);
  }

  @Get('students/:id/summary')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getStudentSummary(@Param('id') studentId: string) {
    return this.financeService.getStudentSummary(studentId);
  }

  @Get('overview')
  @Roles(Role.ADMIN, Role.MANAGER)
  async getOverview(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('method') method?: PaymentMethod,
  ) {
    const fromDate = from
      ? new Date(from)
      : new Date(new Date().getFullYear(), 0, 1); // yil boshidan
    const toDate = to ? new Date(to) : new Date(); // bugungacha

    return this.financeService.getFinanceOverview(fromDate, toDate, method);
  }
}
