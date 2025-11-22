import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorator/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Handler (method) → class bo‘yicha @Roles metadata’ni o‘qiymiz
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Agar route’da @Roles umuman bo‘lmasa – hammani o‘tkazamiz
    if (!required || required.length === 0) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { role?: Role; isActive?: boolean; sub?: string };

    console.log('ROLES GUARD >>>', {
      handler: ctx.getHandler().name,
      required,
      user,
    });

    if (!user) {
      throw new ForbiddenException('User JWT dan kelmadi');
    }

    if (user.isActive === false) {
      throw new ForbiddenException('Foydalanuvchi bloklangan');
    }

    // Masalan: 'TEACHER'
    const userRole = user.role;

    // required: [Role.TEACHER] yoki [Role.ADMIN, Role.MANAGER]
    if (!required.includes(userRole as Role)) {
      throw new ForbiddenException(`Ruxsat berilmagan rol: ${userRole}`);
    }

    return true;
  }
}
