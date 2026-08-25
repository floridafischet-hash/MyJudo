import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS = 'required_permissions';
export const RequirePermissions = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

export const SUPERUSER_REQUIRED = 'superuser_required';
export const RequireSuperuser = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SUPERUSER_REQUIRED, true);
