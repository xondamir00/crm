import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpenSheetDto } from './dto/open-sheet.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { QuerySheetDto } from './dto/query-sheet.dto';
import { AttendanceStatus, SheetStatus } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import {
  dateOnlyUTC,
  ensureDateMatchesGroupPattern,
} from './utils/schedule.util';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  private toView(sheet: any) {
    return {
      id: sheet.id,
      groupId: sheet.groupId,
      date: sheet.date,
      startTime: this.minToHHMM(sheet.startMinutes),
      endTime: this.minToHHMM(sheet.endMinutes),
      status: sheet.status,
      teacherAssignId: sheet.teacherAssignId ?? null,
      note: sheet.note ?? null,
      students:
        sheet.attendance?.map((a) => ({
          studentId: a.studentId,
          status: a.status,
          note: a.note ?? null,
        })) ?? [],
    };
  }

  private minToHHMM(m: number) {
    const h = Math.floor(m / 60)
      .toString()
      .padStart(2, '0');
    const mm = (m % 60).toString().padStart(2, '0');
    return `${h}:${mm}`;
  }

  async openSheet(dto: OpenSheetDto) {
    const group = await this.prisma.group.findUnique({
      where: { id: dto.groupId },
      select: {
        id: true,
        daysPattern: true,
        startMinutes: true,
        endMinutes: true,
        isActive: true,
      },
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');
    if (!group.isActive) throw new BadRequestException('Guruh arxivda');

    const date = dateOnlyUTC(new Date(dto.date));
    if (!ensureDateMatchesGroupPattern(date, group.daysPattern)) {
      throw new BadRequestException('Bu sana guruh jadvaliga to‘g‘ri kelmaydi');
    }

    const sheet = await this.prisma.attendanceSheet.upsert({
      where: { groupId_date: { groupId: group.id, date } },
      create: {
        groupId: group.id,
        date,
        startMinutes: group.startMinutes,
        endMinutes: group.endMinutes,
        teacherAssignId: dto.teacherAssignId,
        note: dto.note,
      },
      update: {},
    });

    const activeEnrolls = await this.prisma.enrollment.findMany({
      where: {
        groupId: group.id,
        status: 'ACTIVE',
        joinDate: { lte: date },
        OR: [{ leaveDate: null }, { leaveDate: { gte: date } }],
      },
      select: { studentId: true },
    });

    const existing = await this.prisma.attendance.findMany({
      where: { sheetId: sheet.id },
      select: { studentId: true },
    });
    const existingSet = new Set(existing.map((a) => a.studentId));

    const toCreate = activeEnrolls.filter((e) => !existingSet.has(e.studentId));

    if (toCreate.length) {
      await this.prisma.attendance.createMany({
        data: toCreate.map((e) => ({
          sheetId: sheet.id,
          studentId: e.studentId,
          status: 'ABSENT',
        })),
        skipDuplicates: true,
      });
    }

    const fresh = await this.prisma.attendanceSheet.findUniqueOrThrow({
      where: { id: sheet.id },
      include: {
        attendance: {
          include: {
            student: {
              include: { user: true },
            },
          },
        },
      },
    });

    return {
      id: fresh.id,
      groupId: fresh.groupId,
      date: fresh.date,
      startTime: this.minToHHMM(fresh.startMinutes),
      endTime: this.minToHHMM(fresh.endMinutes),
      status: fresh.status,
      teacherAssignId: fresh.teacherAssignId,
      note: fresh.note,
      students: fresh.attendance.map((a) => ({
        studentId: a.studentId,
        fullName: `${a.student.user.firstName} ${a.student.user.lastName}`,
        phone: a.student.user.phone,
        status: a.status,
        note: a.note ?? null,
      })),
    };
  }

  async mark(sheetId: string, dto: MarkAttendanceDto, currentUserId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sheet = await tx.attendanceSheet.findUnique({
        where: { id: sheetId },
        select: { id: true, status: true, groupId: true },
      });

      if (!sheet) {
        throw new NotFoundException('Sheet topilmadi');
      }

      if (sheet.status === SheetStatus.LOCKED) {
        throw new BadRequestException('Bu jadval allaqachon lock qilingan');
      }

      const teacher = await tx.teacherProfile.findUnique({
        where: { userId: currentUserId },
        select: { id: true },
      });

      if (!teacher) {
        throw new ForbiddenException('Faqat teacher davomat belgilashi mumkin');
      }

      for (const item of dto.items) {
        await tx.attendance.upsert({
          where: {
            sheetId_studentId: {
              sheetId,
              studentId: item.studentId,
            },
          },
          update: {
            status: item.status,
            note: item.note ?? null,
            markedBy: teacher.id,
            markedAt: new Date(),
          },
          create: {
            sheetId,
            studentId: item.studentId,
            status: item.status,
            note: item.note ?? null,
            markedBy: teacher.id,
            markedAt: new Date(),
          },
        });
      }

      if (dto.lock) {
        await tx.attendanceSheet.update({
          where: { id: sheetId },
          data: { status: SheetStatus.LOCKED },
        });
      }

      return { success: true };
    });
  }
  async getSheet(sheetId: string) {
    const sheet = await this.prisma.attendanceSheet.findUnique({
      where: { id: sheetId },
      include: {
        attendance: { include: { student: { include: { user: true } } } },
      },
    });
    if (!sheet) throw new NotFoundException('Varaq topilmadi');

    return {
      ...this.toView(sheet),
      students: sheet.attendance.map((a) => ({
        studentId: a.studentId,
        fullName: `${a.student.user.firstName} ${a.student.user.lastName}`,
        phone: a.student.user.phone,
        status: a.status,
        note: a.note ?? null,
      })),
    };
  }

  async listSheets(q: QuerySheetDto) {
    const where: any = { groupId: q.groupId };
    if (q.from || q.to) {
      where.date = {
        gte: q.from ? dateOnlyUTC(new Date(q.from)) : undefined,
        lte: q.to ? dateOnlyUTC(new Date(q.to)) : undefined,
      };
    }
    const rows = await this.prisma.attendanceSheet.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { attendance: true },
    });

    return rows.map((s) => ({
      id: s.id,
      date: s.date,
      status: s.status,
      present: s.attendance.filter((x) => x.status === 'PRESENT').length,
      absent: s.attendance.filter((x) => x.status === 'ABSENT').length,
      late: s.attendance.filter((x) => x.status === 'LATE').length,
      excused: s.attendance.filter((x) => x.status === 'EXCUSED').length,
    }));
  }
}
