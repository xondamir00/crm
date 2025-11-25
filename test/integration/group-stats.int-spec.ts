import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentsService } from '../../src/students/students.service';
import { EnrollmentsService } from '../../src/enrollments/enrollments.service';
import { GroupsService } from 'src/group/group.service';

describe('Integration: Group stats & enrollments', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let groupsService: GroupsService;
  let studentsService: StudentsService;
  let enrollmentsService: EnrollmentsService;

  const PASSWORD = 'Test12345!';

  let groupId: string;
  let student1Id: string;
  let student2Id: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    groupsService = moduleRef.get(GroupsService);
    studentsService = moduleRef.get(StudentsService);
    enrollmentsService = moduleRef.get(EnrollmentsService);

    // DB tozalash (farzand -> ota-ona tartibida)
    await prisma.attendanceRecord.deleteMany();
    await prisma.attendanceSheet.deleteMany();
    await prisma.enrollment.deleteMany();
    await prisma.teachingAssignment.deleteMany();
    await prisma.studentProfile.deleteMany();
    await prisma.teacherProfile.deleteMany();
    await prisma.managerProfile.deleteMany();
    await prisma.group.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();
  });

  it('should create group with capacity = 2', async () => {
    const g = await groupsService.create({
      name: 'StatsGroup',
      capacity: 2,
      daysPattern: 'ODD',
      startTime: '09:00',
      endTime: '10:00',
      monthlyFee: 250000,
    });

    groupId = g.id;
    expect(groupId).toBeDefined();
  });

  it('should create two students', async () => {
    const s1 = await studentsService.create({
      firstName: 'Ali',
      lastName: 'Valiyev',
      phone: '+998900000201',
      password: PASSWORD,
    });
    const s2 = await studentsService.create({
      firstName: 'Hasan',
      lastName: 'Karimov',
      phone: '+998900000202',
      password: PASSWORD,
    });

    student1Id = s1.id;
    student2Id = s2.id;

    expect(student1Id).toBeDefined();
    expect(student2Id).toBeDefined();
  });

  it('stats should be correct after first enrollment', async () => {
    await enrollmentsService.create({
      studentId: student1Id,
      groupId,
      joinDate: new Date().toISOString(),
    });

    const stats = await groupsService.getStats(groupId);

    expect(stats.group.id).toBe(groupId);
    expect(stats.group.capacity).toBe(2);
    expect(stats.activeEnrollments).toBe(1);
    expect(stats.remaining).toBe(1);
    expect(stats.isFull).toBe(false);
  });

  it('stats should show full after second enrollment', async () => {
    await enrollmentsService.create({
      studentId: student2Id,
      groupId,
      joinDate: new Date().toISOString(),
    });

    const stats = await groupsService.getStats(groupId);

    expect(stats.activeEnrollments).toBe(2);
    expect(stats.remaining).toBe(0);
    expect(stats.isFull).toBe(true);
  });
});
