import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export async function assertGroupActive(prisma: PrismaClient, groupId: string) {
  const g = await prisma.group.findUnique({
    where: { id: groupId },
    select: { isActive: true },
  });
  if (!g) throw new NotFoundException('Guruh topilmadi');
  if (!g.isActive) throw new BadRequestException('Guruh faol emas (arxivda)');
}

export async function assertStudentExists(
  prisma: PrismaClient,
  studentId: string,
) {
  const s = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!s) throw new NotFoundException('O`quvchi topilmadi');
}

export async function assertNoDuplicateActive(
  prisma: PrismaClient,
  studentId: string,
  groupId: string,
) {
  const exists = await prisma.enrollment.findFirst({
    where: { studentId, groupId, status: 'ACTIVE' as any },
    select: { id: true },
  });
  if (exists)
    throw new ConflictException('Bu o`quvchi ushbu guruhda allaqachon ACTIVE');
}

export async function assertGroupHasFreeSeat(
  prisma: PrismaClient,
  groupId: string,
) {
  const [g, activeCount] = await prisma.$transaction([
    prisma.group.findUnique({
      where: { id: groupId },
      select: { capacity: true },
    }),
    prisma.enrollment.count({ where: { groupId, status: 'ACTIVE' as any } }),
  ]);
  if (!g) throw new NotFoundException('Guruh topilmadi');
  if (activeCount >= g.capacity) {
    throw new BadRequestException('Guruh to`la (capacity limitiga yetgan)');
  }
}
