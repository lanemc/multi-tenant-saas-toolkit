import { TenantContext, tenantContext } from '@lanemc/multitenancy-core';
import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { MULTITENANCY_OPTIONS } from '../constants';
import { MultitenancyModuleOptions } from '../interfaces';

export interface TenantRequest extends Request {
  tenant?: TenantContext['tenant'];
  tenantUser?: TenantContext['user'];
  tenantRoles?: string[];
  tenantPermissions?: string[];
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    @Inject(MULTITENANCY_OPTIONS)
    private readonly options: MultitenancyModuleOptions,
  ) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    const { resolution, dataStore, onError, allowNoTenant = false } = this.options;

    try {
      // Resolve tenant ID based on configured strategy
      let tenantId: string | null = null;

      switch (resolution.type) {
        case 'subdomain': {
          const subdomain = this.extractSubdomain(req);
          if (subdomain) {
            const tenant = await dataStore.getTenantBySubdomain(subdomain);
            tenantId = tenant?.id || null;
          }
          break;
        }

        case 'header': {
          const headerName = resolution.headerName || 'x-tenant-id';
          tenantId = req.headers[headerName.toLowerCase()] as string || null;
          break;
        }

        case 'token': {
          const tokenClaim = resolution.tokenClaim || 'tenant_id';
          tenantId = (req as any).user?.[tokenClaim] || null;
          break;
        }

        case 'custom': {
          if (resolution.customResolver) {
            tenantId = await resolution.customResolver(req);
          }
          break;
        }
      }

      // If no tenant found and it's not allowed, return error
      if (!tenantId && !allowNoTenant) {
        const error = new Error('Tenant not found');
        if (onError) {
          return onError(error, req, res);
        }
        return res.status(400).json({ error: 'Tenant not found' });
      }

      // If we have a tenant ID, fetch the tenant and create context
      if (tenantId) {
        const tenant = await dataStore.getTenantById(tenantId);
        
        if (!tenant) {
          const error = new Error(`Tenant not found: ${tenantId}`);
          if (onError) {
            return onError(error, req, res);
          }
          return res.status(404).json({ error: 'Tenant not found' });
        }

        if (tenant.status !== 'active') {
          const error = new Error(`Tenant is ${tenant.status}`);
          if (onError) {
            return onError(error, req, res);
          }
          return res.status(403).json({ error: `Tenant is ${tenant.status}` });
        }

        // Get user and roles if authenticated
        const user = (req as any).user;
        let roles: string[] = [];
        let permissions: string[] = [];

        if (user && user.id) {
          const tenantUser = await dataStore.getUserTenant(user.id, tenant.id);
          if (tenantUser) {
            roles = tenantUser.roles;
            permissions = tenantUser.permissions || [];
          } else if (!allowNoTenant) {
            const error = new Error('User not member of tenant');
            if (onError) {
              return onError(error, req, res);
            }
            return res.status(403).json({ error: 'User not member of tenant' });
          }
        }

        // Create context
        const context: TenantContext = {
          tenant,
          user,
          roles,
          permissions,
        };

        // Attach to request for backward compatibility
        req.tenant = tenant;
        req.tenantUser = user;
        req.tenantRoles = roles;
        req.tenantPermissions = permissions;

        // Run the rest of the request within the tenant context
        tenantContext.run(context, () => {
          next();
        });
      } else {
        // No tenant context
        next();
      }
    } catch (error) {
      if (onError) {
        return onError(error as Error, req, res);
      }
      console.error('Tenant middleware error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private extractSubdomain(req: Request): string | null {
    const host = req.hostname || req.headers.host || '';
    const parts = host.split('.');
    
    // For localhost or IP addresses, check x-forwarded-host
    if (parts.length < 3 || host.includes('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(host)) {
      const forwardedHost = req.headers['x-forwarded-host'] as string;
      if (forwardedHost) {
        const forwardedParts = forwardedHost.split('.');
        if (forwardedParts.length >= 3) {
          return forwardedParts[0];
        }
      }
      return null;
    }

    // Return the first part as subdomain
    return parts[0];
  }
}