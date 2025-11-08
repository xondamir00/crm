import {
  ConflictException,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, Role } from '@prisma/client';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { PrismaService } from 'prisma/prisma.service';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTeacherDto) {
    if (dto.monthlySalary == null && dto.percentShare == null) {
      throw new BadRequestException(
        'Provide either monthlySalary or percentShare',
      );
    }
    if (dto.monthlySalary != null && dto.percentShare != null) {
      throw new BadRequestException(
        'Choose only one: monthlySalary OR percentShare',
      );
    }

    const exists = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });
    if (exists) throw new ConflictException('Phone already used');

    const passwordHash = await argon2.hash(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          passwordHash,
          role: Role.TEACHER,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
        },
      });

      await tx.teacherProfile.create({
        data: {
          userId: user.id,
          photoUrl: dto.photoUrl,
          monthlySalary: dto.monthlySalary ?? null,
          percentShare: dto.percentShare ?? null,
        },
      });

      return user;
    });
  }

  list() {
    return this.prisma.user.findMany({
      where: { role: Role.TEACHER, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async update(userId: string, dto: UpdateTeacherDto) {
    if (dto.monthlySalary != null && dto.percentShare != null)
      throw new BadRequestException(
        'Provide only one of monthlySalary or percentShare',
      );

    if (dto.phone) {
      const exists = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (exists && exists.id !== userId)
        throw new ConflictException('Phone already used');
    }

    const teacher = await this.prisma.user.findUnique({
      where: { id: userId, role: Role.TEACHER },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const tx = this.prisma.$transaction.bind(this.prisma);
    return tx(async (trx: Prisma.TransactionClient) => {
      const dataUser: any = {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      };
      if (dto.password) dataUser.passwordHash = await argon2.hash(dto.password);

      await trx.user.update({ where: { id: userId }, data: dataUser });

      await trx.teacherProfile.update({
        where: { userId },
        data: {
          photoUrl: dto.photoUrl,
          monthlySalary:
            dto.monthlySalary ??
            (dto.monthlySalary === null ? null : undefined),
          percentShare:
            dto.percentShare ?? (dto.percentShare === null ? null : undefined),
        },
      });

      return trx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
        },
      });
    });
  }

  async remove(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId, role: Role.TEACHER },
    });
    if (!u) throw new NotFoundException('Teacher not found');
    await this.prisma.user.delete({
      where: { id: userId },
    });
    return { success: true };
  }
}
