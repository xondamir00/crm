import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminPhone = '+998900001122';
  const exists = await prisma.user.findUnique({ where: { phone: adminPhone } });

  if (!exists) {
    const passwordHash = await argon2.hash('Admin@12345');
    await prisma.user.create({
      data: {
        fullName: 'Super Admin',
        phone: adminPhone,
        passwordHash,
        role: Role.ADMIN,
        isActive: true,
      },
    });
    console.log(
      'Seed: ADMIN user created:',
      adminPhone,
      'password: Admin@12345',
    );
  } else {
    console.log('Seed: ADMIN already exists:', adminPhone);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
