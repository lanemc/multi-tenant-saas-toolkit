import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantContext } from '@saaskit/multitenancy-core';
import { TenantRequest } from '../middleware/tenant.middleware';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    
    // If tenant context exists on the request, ensure it's maintained throughout execution
    if (request.tenant) {
      const tenantCtx = {
        tenant: request.tenant,
        user: request.tenantUser,
        roles: request.tenantRoles,
        permissions: request.tenantPermissions,
      };
      
      // Run the handler within the tenant context
      return new Observable(subscriber => {
        tenantContext.runAsync(tenantCtx, async () => {
          try {
            const result = await next.handle().toPromise();
            subscriber.next(result);
            subscriber.complete();
          } catch (error) {
            subscriber.error(error);
          }
        });
      });
    }
    
    // No tenant context, proceed normally
    return next.handle();
  }
}