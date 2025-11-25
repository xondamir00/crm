import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { TeachersService } from '../../src/teachers/teachers.service';
import { TeachingAssignmentsService } from '../../src/teaching-assignments/teaching-assignments.service';
import { GroupsService } from 'src/group/group.service';

describe('Integration: Teacher my-groups', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let teachersService: TeachersService;
  let groupsService: GroupsService;
  let taService: TeachingAssignmentsService;

  const PASSWORD = 'Test12345!';

  let teacherUserId: string;
  let teacherProfileId: string;
  let activeGroupId: string;
  let inactiveGroupId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    teachersService = moduleRef.get(TeachersService);
    groupsService = moduleRef.get(GroupsService);
    taService = moduleRef.get(TeachingAssignmentsService);

    // DB tozalash – farzand -> ota-ona
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

    // 1) Room yaratamiz
    const room = await prisma.room.create({
      data: {
        name: 'r-101',
        capacity: 15,
      },
    });

    // 2) ACTIVE group
    const g1 = await groupsService.create({
      name: 'G1',
      capacity: 10,
      daysPattern: 'ODD',
      startTime: '09:00',
      endTime: '10:00',
      monthlyFee: 300000,
      roomId: room.id,
    });
    activeGroupId = g1.id;

    // 3) INACTIVE group (teacher resultida ko‘rinmasligi kerak)
    const g2 = await groupsService.create({
      name: 'G2',
      capacity: 12,
      daysPattern: 'EVEN',
      startTime: '11:00',
      endTime: '12:00',
      monthlyFee: 250000,
    });
    inactiveGroupId = g2.id;

    await prisma.group.update({
      where: { id: inactiveGroupId },
      data: { isActive: false },
    });

    // 4) Teacher #1 yaratamiz – majburiy salary yoki percent qo‘shamiz
    const t = await teachersService.create({
      firstName: 'Ustoz',
      lastName: 'Aliyev',
      phone: '+998900000301',
      password: PASSWORD,
      monthlySalary: '2000000', // 🔥 shu sababli endi xato bo‘lmaydi
      percentShare: null,
    } as any);

    teacherUserId = t.userId;
    teacherProfileId = t.id;
  });

  it('should return only active group for teacher', async () => {
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // ACTIVE assignment: teacher + ACTIVE group
    await taService.create({
      teacherId: teacherProfileId,
      groupId: activeGroupId,
      fromDate: todayStr,
      role: 'LEAD',
      inheritSchedule: true,
    } as any);

    // 5) Teacher my-groups ni chaqiramiz
    const groups = await teachersService.findMyGroups(teacherUserId);

    expect(Array.isArray(groups)).toBe(true);
    expect(groups.length).toBe(1);

    const g = groups[0];

    expect(g.groupId).toBe(activeGroupId);
    expect(g.groupName).toBe('G1');
    expect(g.daysPattern).toBe('ODD');
    expect(g.startTime).toBe('09:00');
    expect(g.endTime).toBe('10:00');

    expect(g.room).toBeDefined();
    expect(g.room!.name).toBe('r-101');
    expect(g.room!.capacity).toBe(15);

    expect(g.assignmentId).toBeDefined();
    expect(['LEAD', 'ASSISTANT']).toContain(g.role);
  });

  it('should return empty array for teacher with no assignments', async () => {
    const t2 = await teachersService.create({
      firstName: 'Ikkinchi',
      lastName: 'Ustoz',
      phone: '+998900000302',
      password: PASSWORD,
      monthlySalary: '1500000',
      percentShare: null,
    } as any);

    const groups = await teachersService.findMyGroups(t2.userId);

    expect(groups).toEqual([]);
  });
});
