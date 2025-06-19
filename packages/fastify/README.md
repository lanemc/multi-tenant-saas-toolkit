# @lanemc/multitenancy-fastify

Fastify middleware adapter for the Multi-Tenant SaaS Toolkit.

## Installation

```bash
npm install @lanemc/multitenancy-fastify @lanemc/multitenancy-core
```

## Usage

```typescript
import fastify from 'fastify';
import { fastifyMultitenancy, requireRole, requirePermission } from '@lanemc/multitenancy-fastify';

const app = fastify();

// Register the multitenancy plugin
await app.register(fastifyMultitenancy, {
  resolution: {
    type: 'subdomain', // or 'header', 'token', 'custom'
    // headerName: 'x-tenant-id', // for header-based resolution
    // tokenClaim: 'tenant_id', // for token-based resolution
    // customResolver: async (request) => { ... } // for custom resolution
  },
  dataStore: myDataStore, // Your implementation of TenantDataStore
  onError: (error, request, reply) => {
    // Custom error handling
    reply.status(500).send({ error: error.message });
  },
  allowNoTenant: false // Whether to allow requests without tenant context
});

// Use in routes
app.get('/api/profile', {
  preHandler: requireTenantAuth
}, async (request, reply) => {
  // Access tenant context
  const tenant = request.tenant;
  const user = request.tenantUser;
  const roles = request.tenantRoles;
  
  return { tenant, user, roles };
});

// Require specific roles
app.post('/api/admin/users', {
  preHandler: [requireTenantAuth, requireRole('admin', 'super-admin')]
}, async (request, reply) => {
  // Only accessible by admin or super-admin
});

// Require specific permissions
app.delete('/api/documents/:id', {
  preHandler: [requireTenantAuth, requirePermission('documents.delete')]
}, async (request, reply) => {
  // Only accessible with documents.delete permission
});
```

## Tenant Resolution Strategies

### Subdomain-based
```typescript
// Resolves tenant from subdomain (e.g., acme.app.com -> tenant: acme)
resolution: { type: 'subdomain' }
```

### Header-based
```typescript
// Resolves tenant from request header
resolution: { 
  type: 'header',
  headerName: 'x-tenant-id' // default
}
```

### Token-based
```typescript
// Resolves tenant from JWT token claim
resolution: { 
  type: 'token',
  tokenClaim: 'tenant_id' // default
}
```

### Custom
```typescript
// Custom resolution logic
resolution: { 
  type: 'custom',
  customResolver: async (request) => {
    // Your custom logic
    return tenantId;
  }
}
```

## Context Access

Within route handlers and hooks running after the multitenancy plugin, you can access the tenant context:

```typescript
import { tenantContext } from '@lanemc/multitenancy-core';

app.get('/api/data', async (request, reply) => {
  // Direct access from request
  const tenant = request.tenant;
  
  // Or use the context manager
  const currentTenant = tenantContext.getCurrentTenant();
  const currentUser = tenantContext.getCurrentUser();
  const hasRole = tenantContext.hasRole('admin');
  const hasPermission = tenantContext.hasPermission('data.read');
  
  // Your logic here
});
```

## Error Handling

The plugin provides default error responses, but you can customize them:

```typescript
await app.register(fastifyMultitenancy, {
  // ... other options
  onError: (error, request, reply) => {
    // Log the error
    request.log.error(error);
    
    // Custom error response
    if (error.message.includes('Tenant not found')) {
      reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Organization not found'
      });
    } else {
      reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An error occurred'
      });
    }
  }
});
```

## TypeScript Support

The plugin extends Fastify's type definitions to include tenant properties:

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    tenant?: Tenant;
    tenantUser?: User;
    tenantRoles?: string[];
    tenantPermissions?: string[];
  }
}
```

This means you get full TypeScript support when accessing tenant data from the request object.