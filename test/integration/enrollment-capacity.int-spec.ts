import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentsService } from '../../src/students/students.service';
import { EnrollmentsService } from '../../src/enrollments/enrollments.service';
import * as argon2 from 'argon2';
import { GroupsService } from 'src/group/group.service';

describe('Integration: Enrollment capacity', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let studentsService: StudentsService;
  let groupsService: GroupsService;
  let enrollmentsService: EnrollmentsService;

  let groupId: string;
  let student1Id: string;
  let student2Id: string;

  const PASSWORD = 'Test12345!';

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    studentsService = moduleRef.get(StudentsService);
    groupsService = moduleRef.get(GroupsService);
    enrollmentsService = moduleRef.get(EnrollmentsService);

    // DB tozalash – farzandlar -> ota-onalar tartibida
    await prisma.attendanceRecord.deleteMany();
    await prisma.attendanceSheet.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.teachingAssignment.deleteMany(); // 🔥 YANGI QATOR

    await prisma.studentProfile.deleteMany();
    await prisma.teacherProfile.deleteMany();
    await prisma.managerProfile.deleteMany();
    await prisma.group.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should create group with capacity = 1', async () => {
    const g = await groupsService.create({
      name: 'TestGroup',
      capacity: 1,
      daysPattern: 'ODD',
      startTime: '09:00',
      endTime: '10:00',
      monthlyFee: 200000,
    });

    groupId = g.id;
    expect(groupId).toBeDefined();
  });

  it('should create first student', async () => {
    const s = await studentsService.create({
      firstName: 'Ali',
      lastName: 'Valiyev',
      phone: '+998900000101',
      password: PASSWORD,
    });

    student1Id = s.id;
    expect(student1Id).toBeDefined();
  });

  it('should create second student', async () => {
    const s = await studentsService.create({
      firstName: 'Hasan',
      lastName: 'Karimov',
      phone: '+998900000102',
      password: PASSWORD,
    });

    student2Id = s.id;
    expect(student2Id).toBeDefined();
  });

  it('should allow first student to enroll group', async () => {
    const e = await enrollmentsService.create({
      studentId: student1Id,
      groupId,
      joinDate: new Date().toISOString(),
    });

    expect(e.status).toBe('ACTIVE');
  });

  it('should NOT allow second student because capacity is full', async () => {
    await expect(
      enrollmentsService.create({
        studentId: student2Id,
        groupId,
        joinDate: new Date().toISOString(),
      }),
    ).rejects.toThrow('Guruh to`la');
  });
});
