import { TenantMiddlewareOptions, TenantContext, tenantContext } from '@thesaasdevkit/multitenancy-core';
import { FastifyPluginAsync, FastifyRequest, FastifyReply, onRequestHookHandler } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: TenantContext['tenant'];
    tenantUser?: TenantContext['user'];
    tenantRoles?: string[];
    tenantPermissions?: string[];
  }
}

/**
 * Fastify plugin for tenant resolution and context management
 */
const fastifyMultitenancyPlugin: FastifyPluginAsync<TenantMiddlewareOptions> = async (
  fastify,
  options
) => {
  const { resolution, dataStore, onError, allowNoTenant = false } = options;

  // Create the tenant resolution handler
  const resolveTenant: onRequestHookHandler = async (request, reply) => {
    try {
      // Resolve tenant ID based on configured strategy
      let tenantId: string | null = null;

      switch (resolution.type) {
        case 'subdomain': {
          const subdomain = extractSubdomain(request);
          if (subdomain) {
            const tenant = await dataStore.getTenantBySubdomain(subdomain);
            tenantId = tenant?.id || null;
          }
          break;
        }

        case 'header': {
          const headerName = resolution.headerName || 'x-tenant-id';
          tenantId = request.headers[headerName.toLowerCase()] as string || null;
          break;
        }

        case 'token': {
          const tokenClaim = resolution.tokenClaim || 'tenant_id';
          // Assuming request.user is populated by auth decorator/plugin
          tenantId = (request as any).user?.[tokenClaim] || null;
          break;
        }

        case 'custom': {
          if (resolution.customResolver) {
            tenantId = await resolution.customResolver(request);
          }
          break;
        }
      }

      // If no tenant found and it's not allowed, return error
      if (!tenantId && !allowNoTenant) {
        const error = new Error('Tenant not found');
        if (onError) {
          return onError(error, request, reply);
        }
        return reply.status(400).send({ error: 'Tenant not found' });
      }

      // If we have a tenant ID, fetch the tenant and create context
      if (tenantId) {
        const tenant = await dataStore.getTenantById(tenantId);
        
        if (!tenant) {
          const error = new Error(`Tenant not found: ${tenantId}`);
          if (onError) {
            return onError(error, request, reply);
          }
          return reply.status(404).send({ error: 'Tenant not found' });
        }

        if (tenant.status !== 'active') {
          const error = new Error(`Tenant is ${tenant.status}`);
          if (onError) {
            return onError(error, request, reply);
          }
          return reply.status(403).send({ error: `Tenant is ${tenant.status}` });
        }

        // Get user and roles if authenticated
        const user = (request as any).user;
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
              return onError(error, request, reply);
            }
            return reply.status(403).send({ error: 'User not member of tenant' });
          }
        }

        // Create context
        const context: TenantContext = {
          tenant,
          user,
          roles,
          permissions,
        };

        // Attach to request for direct access
        request.tenant = tenant;
        request.tenantUser = user;
        request.tenantRoles = roles;
        request.tenantPermissions = permissions;

        // Set context for async local storage access
        tenantContext.run(context, () => {
          // Context is now available for the rest of the request
        });
      }
    } catch (error) {
      if (onError) {
        return onError(error as Error, request, reply);
      }
      console.error('Tenant middleware error:', error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
  };

  // Register the hook
  fastify.addHook('onRequest', resolveTenant);
};

// Helper functions removed - tenant context is now set directly in the hook

/**
 * Extract subdomain from request
 */
function extractSubdomain(request: FastifyRequest): string | null {
  const host = request.hostname || '';
  const parts = host.split('.');
  
  // For localhost or IP addresses, check x-forwarded-host
  if (parts.length < 3 || host.includes('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(host)) {
    const forwardedHost = request.headers['x-forwarded-host'] as string;
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

/**
 * Fastify preHandler hook to require authentication within tenant context
 */
export async function requireTenantAuth(_request: FastifyRequest, reply: FastifyReply) {
  const user = tenantContext.getCurrentUser();
  if (!user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }
}

/**
 * Fastify preHandler hook factory to require specific roles
 */
export function requireRole(...roles: string[]) {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!tenantContext.hasAnyRole(roles)) {
      return reply.status(403).send({ 
        error: 'Insufficient permissions',
        required: roles,
        current: tenantContext.getCurrentRoles()
      });
    }
  };
}

/**
 * Fastify preHandler hook factory to require specific permissions
 */
export function requirePermission(...permissions: string[]) {
  return async (_request: FastifyRequest, reply: FastifyReply) => {
    const hasPermission = permissions.some(p => tenantContext.hasPermission(p));
    if (!hasPermission) {
      return reply.status(403).send({ 
        error: 'Insufficient permissions',
        required: permissions,
        current: tenantContext.getCurrentPermissions()
      });
    }
  };
}

// Export the plugin wrapped with fastify-plugin for proper encapsulation
export const fastifyMultitenancy = fp(fastifyMultitenancyPlugin, {
  fastify: '>=3.0.0',
  name: '@thesaasdevkit/multitenancy-fastify'
});

// Export types from core (avoiding function conflicts)
export type { 
  Tenant, 
  User, 
  TenantUser, 
  TenantContext,
  TenantDataStore,
  TenantResolutionOptions,
  TenantMiddlewareOptions
} from '@thesaasdevkit/multitenancy-core';