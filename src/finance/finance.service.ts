// src/finance/finance.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  TuitionChargeStatus,
  Prisma,
  PaymentMethod,
  DaysPattern,
  Group,
} from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { PrismaService } from 'prisma/prisma.service';
import { ApplyDiscountDto } from './dto/apply-discount.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private roundToThousand(amount: number): number {
    if (!Number.isFinite(amount)) return 0;
    return Math.round(amount / 1000) * 1000;
  }

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
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student topilmadi');
    }

    const charges = await this.prisma.tuitionCharge.findMany({
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

    const totalCharges = charges.reduce((sum, c) => {
      const amount = c.amountDue.toNumber();
      const discount = c.discount.toNumber();
      return sum + (amount - discount);
    }, 0);

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
    const debtRounded = this.roundToThousand(debt);

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
      debtRounded,
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
  private calculateLessonsForMonth(
    group: Group,
    joinDate: Date,
  ): { plannedLessons: number; chargedLessons: number } {
    const daysPattern = group.daysPattern;

    const year = joinDate.getFullYear();
    const monthIndex = joinDate.getMonth(); // 0-11

    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);

    // JS'da: Yakshanba=0, Dushanba=1, ... Shanba=6
    const oddDays = [1, 3, 5]; // Du / Cho / Ju
    const evenDays = [2, 4, 6]; // Se / Pa / Sha

    const targetWeekdays = daysPattern === DaysPattern.ODD ? oddDays : evenDays;

    let plannedLessons = 0;
    let chargedLessons = 0;

    for (
      let d = new Date(monthStart.getTime());
      d <= monthEnd;
      d.setDate(d.getDate() + 1)
    ) {
      const weekday = d.getDay(); // 0–6

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
    const month = joinDate.getMonth() + 1;

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
        studentId_groupId_year_month: { studentId, groupId, year, month },
      },
      update: {
        amountDue,
        discount: new Prisma.Decimal(0),
        plannedLessons,
        chargedLessons,
      },
      create: {
        studentId,
        groupId,
        year,
        month,
        amountDue,
        discount: new Prisma.Decimal(0),
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

  async getGlobalBalance() {
    // 1) Barcha charge'lar bo‘yicha effective summa (amount - discount)
    const charges = await this.prisma.tuitionCharge.findMany({});
    const totalCharges = charges.reduce((sum, c) => {
      const base = c.amountDue.toNumber();
      const discount = c.discount.toNumber();
      return sum + (base - discount);
    }, 0);

    // 2) Jami to‘langan (allocation bo‘yicha)
    const allocAgg = await this.prisma.paymentAllocation.aggregate({
      _sum: { amount: true },
    });
    const totalAllocated = allocAgg._sum.amount?.toNumber() ?? 0;

    const totalDebt = totalCharges - totalAllocated;
    const totalDebtRounded = this.roundToThousand(totalDebt);

    // 3) Naxt kirim (Payment jadvali bo‘yicha)
    const incomeAgg = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: PaymentStatus.COMPLETED },
    });
    const totalIncome = incomeAgg._sum.amount?.toNumber() ?? 0;

    // 4) Chiqimlar
    const expenseAgg = await this.prisma.expense.aggregate({
      _sum: { amount: true },
    });
    const totalExpense = expenseAgg._sum.amount?.toNumber() ?? 0;

    const netCash = totalIncome - totalExpense;

    return {
      totalCharges, // yozilgan hisoblar jami (chegirmadan keyin)
      totalIncome, // to‘langan pul jami
      totalExpense, // chiqimlar jami
      netCash, // kassadagi sof pul (teorik)
      totalDebt, // hozirgi umumiy qarzdorlik
      totalDebtRounded,
    };
  }

  async getDebtors(minDebt = 0) {
    const charges = await this.prisma.tuitionCharge.findMany({
      where: {
        status: {
          in: [TuitionChargeStatus.PENDING, TuitionChargeStatus.PARTIALLY_PAID],
        },
      },
      include: {
        allocations: true,
        student: {
          include: { user: true },
        },
        group: true,
      },
    });

    const map = new Map<
      string,
      {
        studentId: string;
        fullName: string;
        phone: string;
        totalDebt: number;
        totalDebtRounded: number;
        groups: { groupId: string; name: string; debt: number }[];
      }
    >();

    for (const c of charges) {
      const base = c.amountDue.toNumber();
      const discount = c.discount.toNumber();
      const effective = base - discount;

      const paid = c.allocations.reduce(
        (sum, a) => sum + a.amount.toNumber(),
        0,
      );

      const debt = effective - paid;
      if (debt <= 0) continue;

      const studentId = c.studentId;
      const key = studentId;

      if (!map.has(key)) {
        map.set(key, {
          studentId,
          fullName: `${c.student.user.firstName} ${c.student.user.lastName}`,
          phone: c.student.user.phone,
          totalDebt: 0,
          totalDebtRounded: 0,
          groups: [],
        });
      }

      const item = map.get(key)!;
      item.totalDebt += debt;
      item.totalDebtRounded = this.roundToThousand(item.totalDebt);
      item.groups.push({
        groupId: c.groupId,
        name: c.group.name,
        debt,
      });
    }

    const result = Array.from(map.values())
      .filter((x) => x.totalDebt >= minDebt)
      .sort((a, b) => b.totalDebt - a.totalDebt);

    return result;
  }

  async applyDiscount(dto: ApplyDiscountDto) {
    const charge = await this.prisma.tuitionCharge.findUnique({
      where: {
        studentId_groupId_year_month: {
          studentId: dto.studentId,
          groupId: dto.groupId,
          year: dto.year,
          month: dto.month,
        },
      },
      include: { allocations: true },
    });

    if (!charge) {
      throw new NotFoundException('Bu oy uchun hisob topilmadi');
    }

    const amountDue = charge.amountDue.toNumber();

    if (dto.discountAmount > amountDue) {
      throw new BadRequestException(
        'Chegirma summasi hisobdan katta bo‘lishi mumkin emas',
      );
    }

    const discount = new Prisma.Decimal(dto.discountAmount);

    // mavjud to‘lovlar bilan statusni qayta hisoblash
    const paid = charge.allocations.reduce(
      (sum, a) => sum + a.amount.toNumber(),
      0,
    );

    const effectiveAmount = amountDue - dto.discountAmount;
    const status =
      paid >= effectiveAmount
        ? TuitionChargeStatus.PAID
        : paid > 0
          ? TuitionChargeStatus.PARTIALLY_PAID
          : TuitionChargeStatus.PENDING;

    const updated = await this.prisma.tuitionCharge.update({
      where: { id: charge.id },
      data: {
        discount,
        status,
      },
    });

    return updated;
  }
}
