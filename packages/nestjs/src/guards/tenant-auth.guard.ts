import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { tenantContext } from '@lanemc/multitenancy-core';

@Injectable()
export class TenantAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const user = tenantContext.getCurrentUser();
    
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    
    return true;
  }
}