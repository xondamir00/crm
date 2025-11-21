import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorator/roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Agar route’da @Roles yo‘q bo‘lsa – hammani o‘tkazamiz
    if (!required || required.length === 0) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as { role?: string; isActive?: boolean };

    console.log('ROLES GUARD >>>', { required, user });

    if (!user) {
      throw new ForbiddenException('User JWT dan kelmadi');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Foydalanuvchi bloklangan');
    }

    const allowedRoles = required; // bu Role[]
    const userRole = user.role as Role;

    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(`Ruxsat berilmagan rol: ${userRole}`);
    }

    return true;
  }
}
