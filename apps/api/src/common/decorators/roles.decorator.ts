import { SetMetadata } from '@nestjs/common';
// Import AdminRole from the generated Prisma client
import { AdminRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);