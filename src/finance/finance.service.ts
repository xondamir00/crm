// src/finance/finance.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PaymentStatus,
  TuitionChargeStatus,
  Prisma,
  PaymentMethod,
  DaysPattern,
  Group,
  TuitionCharge,
} from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async createPayment(dto: CreatePaymentDto, recordedById: string) {
    // 1. Student tekshir
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: dto.studentId },
    });
    if (!student) {
      throw new NotFoundException('Student topilmadi');
    }

    // 2. Payment create
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const payment = await this.prisma.payment.create({
      data: {
        studentId: dto.studentId,
        groupId: dto.groupId ?? null,
        amount: new Prisma.Decimal(dto.amount),
        method: dto.method,
        status: PaymentStatus.COMPLETED,
        paidAt,
        reference: dto.reference,
        comment: dto.comment,
        recordedById,
      },
    });

    // 3. Allocation – to‘lovni eski qarzlarga tarqatamiz
    await this.allocatePaymentToCharges(payment.id, dto.studentId, dto.groupId);

    // 4. Yangilangan student summary qaytaramiz
    const summary = await this.getStudentSummary(dto.studentId);

    return {
      payment,
      summary,
    };
  }

  //
  // AYMENT → TUITIONCHARGE allocation
  //
  private async allocatePaymentToCharges(
    paymentId: string,
    studentId: string,
    groupId?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) return;

    let remaining = payment.amount.toNumber();

    if (remaining <= 0) return;

    // Unpaid / partially paid charges
    const charges = await this.prisma.tuitionCharge.findMany({
      where: {
        studentId,
        ...(groupId ? { groupId } : {}),
        status: {
          in: [TuitionChargeStatus.PENDING, TuitionChargeStatus.PARTIALLY_PAID],
        },
      },
      include: { allocations: true },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    for (const charge of charges) {
      if (remaining <= 0) break;

      const allocatedSoFar = charge.allocations.reduce(
        (sum, a) => sum + a.amount.toNumber(),
        0,
      );
      const outstanding = charge.amountDue.toNumber() - allocatedSoFar;

      if (outstanding <= 0) continue;

      const allocateAmount = Math.min(remaining, outstanding);

      await this.prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          chargeId: charge.id,
          amount: new Prisma.Decimal(allocateAmount),
        },
      });

      remaining -= allocateAmount;

      // Charge status update
      const newStatus =
        allocateAmount + allocatedSoFar >= charge.amountDue.toNumber()
          ? TuitionChargeStatus.PAID
          : TuitionChargeStatus.PARTIALLY_PAID;

      await this.prisma.tuitionCharge.update({
        where: { id: charge.id },
        data: { status: newStatus },
      });
    }

    // Agar remaining > 0 bo‘lsa – bu “oldindan to‘lov” sifatida qoladi
    // hozircha uni alohida ko‘rmayapmiz, ammo keyin balansda hisobga olamiz.
  }

  //
  // CHIQIM YARATISH
  //
  async createExpense(dto: CreateExpenseDto, recordedById: string) {
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const expense = await this.prisma.expense.create({
      data: {
        title: dto.title,
        category: dto.category,
        amount: new Prisma.Decimal(dto.amount),
        method: dto.method,
        paidAt,
        note: dto.note,
        recordedById,
      },
    });

    return expense;
  }

  //
  // STUDENT FINANCE SUMMARY
  //
  async getStudentSummary(studentId: string) {
    // Student mavjudligini tekshirish
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student topilmadi');
    }

    // Barcha active/cancel bo‘lmagan charge lar
    const chargesAgg = await this.prisma.tuitionCharge.aggregate({
      _sum: { amountDue: true },
      where: {
        studentId,
        status: {
          in: [
            TuitionChargeStatus.PENDING,
            TuitionChargeStatus.PARTIALLY_PAID,
            TuitionChargeStatus.PAID,
          ],
        },
      },
    });

    const totalCharges = chargesAgg._sum.amountDue?.toNumber() ?? 0;

    // Allocation lar bo‘yicha jami to‘langan
    const allocationsAgg = await this.prisma.paymentAllocation.aggregate({
      _sum: { amount: true },
      where: {
        charge: {
          studentId,
          status: {
            in: [
              TuitionChargeStatus.PENDING,
              TuitionChargeStatus.PARTIALLY_PAID,
              TuitionChargeStatus.PAID,
            ],
          },
        },
      },
    });

    const totalPaid = allocationsAgg._sum.amount?.toNumber() ?? 0;

    const debt = totalCharges - totalPaid;

    // Oxirgi 5 ta payment
    const lastPayments = await this.prisma.payment.findMany({
      where: { studentId },
      orderBy: { paidAt: 'desc' },
      take: 5,
    });

    return {
      studentId,
      totalCharges,
      totalPaid,
      debt,
      lastPayments,
    };
  }

  //
  //  UMUMIY FINANCE OVERVIEW (oy/yil + method filter)
  //
  async getFinanceOverview(from: Date, to: Date, method?: PaymentMethod) {
    const incomeWhere: Prisma.PaymentWhereInput = {
      status: PaymentStatus.COMPLETED,
      paidAt: {
        gte: from,
        lte: to,
      },
      ...(method ? { method } : {}),
    };

    const expenseWhere: Prisma.ExpenseWhereInput = {
      paidAt: {
        gte: from,
        lte: to,
      },
      ...(method ? { method } : {}),
    };

    const incomeAgg = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: incomeWhere,
    });

    const expenseAgg = await this.prisma.expense.aggregate({
      _sum: { amount: true },
      where: expenseWhere,
    });

    const totalIncome = incomeAgg._sum.amount?.toNumber() ?? 0;
    const totalExpense = expenseAgg._sum.amount?.toNumber() ?? 0;

    return {
      from,
      to,
      method: method ?? 'ALL',
      totalIncome,
      totalExpense,
      profit: totalIncome - totalExpense,
    };
  }

  async createInitialTuitionChargeForEnrollment(params: {
    studentId: string;
    groupId: string;
    joinDate: Date;
  }) {
    const { studentId, groupId, joinDate } = params;

    // 1) Guruhni olaymiz (daysPattern + monthlyFee)
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      console.warn('[FINANCE] Group topilmadi, charge yaratilmaydi', {
        groupId,
      });
      return null;
    }

    if (!group.monthlyFee || group.monthlyFee <= 0) {
      console.warn('[FINANCE] monthlyFee = 0, charge yaratilmaydi', {
        groupId,
        monthlyFee: group.monthlyFee,
      });
      return null;
    }

    const year = joinDate.getFullYear();
    const month = joinDate.getMonth() + 1; // 1..12

    const { plannedLessons, chargedLessons } = this.calculateLessonsForMonth(
      group,
      joinDate,
    );

    let amountDueNumber: number;

    if (!plannedLessons || plannedLessons <= 0) {
      // Fallback: agar pattern bo‘yicha dars topolmasak, to‘liq summani yozamiz
      amountDueNumber = group.monthlyFee;
    } else {
      const perLesson = group.monthlyFee / plannedLessons;
      amountDueNumber = perLesson * chargedLessons;
      amountDueNumber = Math.round(amountDueNumber); // so‘mga yaxlitlash
    }

    const amountDue = new Prisma.Decimal(amountDueNumber);

    // Composite unique asosida upsert – bir oyga bitta hisob
    const charge = await this.prisma.tuitionCharge.upsert({
      where: {
        studentId_groupId_year_month: {
          studentId,
          groupId,
          year,
          month,
        },
      },
      update: {
        amountDue,
        plannedLessons,
        chargedLessons,
      },
      create: {
        studentId,
        groupId,
        year,
        month,
        amountDue,
        plannedLessons,
        chargedLessons,
      },
    });

    console.log('[FINANCE] TuitionCharge created/updated:', charge.id, {
      studentId,
      groupId,
      year,
      month,
      amountDue: amountDueNumber,
      plannedLessons,
      chargedLessons,
    });

    return charge;
  }

  private calculateLessonsForMonth(
    group: Group,
    joinDate: Date,
  ): { plannedLessons: number; chargedLessons: number } {
    const daysPattern = group.daysPattern;

    const year = joinDate.getFullYear();
    const monthIndex = joinDate.getMonth(); // 0-11

    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);

    const oddDays = [1, 3, 5]; // Du/Cho/Ju
    const evenDays = [2, 4, 6]; // Se/Pa/Sha

    const targetWeekdays = daysPattern === DaysPattern.ODD ? oddDays : evenDays;

    let plannedLessons = 0;
    let chargedLessons = 0;

    for (
      let d = new Date(monthStart.getTime());
      d <= monthEnd;
      d.setDate(d.getDate() + 1)
    ) {
      const weekday = d.getDay(); // 0-6, Yakshanba=0

      if (targetWeekdays.includes(weekday)) {
        plannedLessons += 1;

        if (d >= this.stripTime(joinDate)) {
          chargedLessons += 1;
        }
      }
    }

    return { plannedLessons, chargedLessons };
  }

  private stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}
