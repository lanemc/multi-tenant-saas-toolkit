import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tenantContext } from '@saaskit/multitenancy-core';
import { ROLES_KEY } from '../constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasRole = tenantContext.hasAnyRole(requiredRoles);
    
    if (!hasRole) {
      throw new ForbiddenException({
        message: 'Insufficient permissions',
        required: requiredRoles,
        current: tenantContext.getCurrentRoles(),
      });
    }
    
    return true;
  }
}