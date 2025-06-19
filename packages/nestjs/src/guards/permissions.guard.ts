import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tenantContext } from '@saaskit/multitenancy-core';

import { PERMISSIONS_KEY } from '../constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const hasPermission = requiredPermissions.some(p => tenantContext.hasPermission(p));
    
    if (!hasPermission) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        required: requiredPermissions,
        current: tenantContext.getCurrentPermissions(),
      });
    }
    
    return true;
  }
}