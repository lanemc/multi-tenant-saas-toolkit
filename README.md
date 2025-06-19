# 🏢 Multi-Tenant SaaS Toolkit

[![npm version](https://badge.fury.io/js/@saaskit%2Fmultitenancy-core.svg)](https://badge.fury.io/js/@saaskit%2Fmultitenancy-core)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> **The fastest way to add multi-tenancy to your Node.js application** ⚡

Stop spending weeks implementing multi-tenancy from scratch. Get **production-ready tenant isolation**, **automatic data filtering**, and **enterprise-grade authorization** in minutes, not months.

```bash
# Get started in 30 seconds
npm install @saaskit/multitenancy-core
```

---

## 🎯 Why This Toolkit?

<table>
<tr>
<td>

**❌ Before: The Pain**
- Weeks implementing tenant context
- Manual query filtering everywhere
- Security vulnerabilities
- Inconsistent authorization
- Framework lock-in
- Data leakage risks

</td>
<td>

**✅ After: Pure Joy**
- Setup in 5 minutes
- Automatic tenant filtering
- Security by default
- Consistent RBAC/ABAC
- Framework agnostic
- Zero data leakage

</td>
</tr>
</table>

---

## 🚀 30-Second Quick Start

**1. Install the toolkit:**
```bash
npm install @saaskit/multitenancy-core @saaskit/multitenancy-adapters
```

**2. Add one middleware:**
```typescript
import { createTenantMiddleware } from '@saaskit/multitenancy-core';

app.use(createTenantMiddleware({
  resolution: { type: 'subdomain' },
  dataStore: yourDataStore // We'll show you how!
}));
```

**3. That's it!** 🎉 Your app now has:
- ✅ Automatic tenant detection
- ✅ Secure context isolation  
- ✅ Ready for multi-tenancy

---

## 🎁 What You Get

<details>
<summary><strong>🏠 Smart Tenant Context</strong> - Automatic tenant detection & isolation</summary>

- **AsyncLocalStorage magic** - Context follows your requests everywhere
- **Multiple resolution strategies** - Subdomain, header, JWT, or custom
- **Zero performance overhead** - Built for production scale
- **Type-safe everywhere** - Full TypeScript support

</details>

<details>
<summary><strong>🔒 Bulletproof Data Isolation</strong> - Never leak tenant data again</summary>

- **ORM integrations** - Prisma, Sequelize, Mongoose
- **Automatic query filtering** - Set it once, works everywhere
- **Multi-database support** - Separate databases per tenant
- **Admin override** - Safe cross-tenant operations

</details>

<details>
<summary><strong>👥 Enterprise Authorization</strong> - RBAC + ABAC in one package</summary>

- **Pre-built roles** - Admin, member, viewer out of the box
- **Flexible permissions** - Fine-grained access control
- **Policy engine** - Complex authorization rules made simple
- **Audit logging** - Track every action automatically

</details>

<details>
<summary><strong>🎯 Framework Freedom</strong> - Works with your favorite stack</summary>

- **Express** - Drop-in middleware
- **NestJS** - Decorators and guards
- **Fastify** - High-performance plugins
- **Any Node.js app** - Framework-agnostic core

</details>

---

## 🛠 Real-World Examples

### 📦 Express + Prisma (Most Popular)

```typescript
// 1. Setup your data store (implement once, use everywhere)
const tenantDataStore = {
  async getTenantById(id: string) {
    return await prisma.tenant.findUnique({ where: { id } });
  },
  async getTenantBySubdomain(subdomain: string) {
    return await prisma.tenant.findUnique({ where: { subdomain } });
  },
  async getUserTenant(userId: string, tenantId: string) {
    return await prisma.tenantUser.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      include: { roles: true }
    });
  }
};

// 2. Add tenant middleware (handles everything automatically)
app.use(createTenantMiddleware({
  resolution: { type: 'subdomain' },
  dataStore: tenantDataStore,
  allowNoTenant: false // Strict tenant isolation
}));

// 3. Apply Prisma adapter (queries auto-filtered by tenant)
import { applyPrismaAdapter } from '@saaskit/multitenancy-adapters';

applyPrismaAdapter(prisma, {
  tenantField: 'tenantId',
  models: ['User', 'Project', 'Task', 'Invoice']
});

// 4. Use anywhere - tenant context is automatic!
app.get('/api/projects', async (req, res) => {
  // Only returns projects for current tenant - automatically!
  const projects = await prisma.project.findMany();
  res.json(projects);
});

// 5. Add role-based protection
app.delete('/api/projects/:id', 
  requireRole('admin', 'project-manager'),
  async (req, res) => {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  }
);
```

### 🏗 NestJS + TypeORM (Enterprise)

```typescript
// app.module.ts
import { MultitenancyModule } from '@saaskit/multitenancy-nestjs';

@Module({
  imports: [
    MultitenancyModule.forRoot({
      resolution: { type: 'header', headerName: 'x-tenant-id' },
      dataStore: TypeOrmTenantDataStore
    })
  ]
})
export class AppModule {}

// projects.controller.ts
@Controller('projects')
@UseGuards(TenantAuthGuard)
export class ProjectsController {
  
  @Get()
  @Roles('member', 'admin')
  async findAll(@TenantContext() context: TenantContext) {
    // Automatically filtered by tenant
    return this.projectsService.findAll();
  }

  @Delete(':id')
  @Permissions('projects:delete')
  async remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
```

### ⚡ Fastify + Mongoose (High Performance)

```typescript
// Register the plugin
await fastify.register(require('@saaskit/multitenancy-fastify'), {
  resolution: { type: 'subdomain' },
  dataStore: mongoTenantDataStore
});

// Apply Mongoose plugin globally
import { mongooseTenantPlugin } from '@saaskit/multitenancy-adapters';

mongoose.plugin(mongooseTenantPlugin, { 
  tenantField: 'tenantId',
  indexTenant: true // Automatic indexing
});

// Use in routes
fastify.get('/api/users', {
  preHandler: [fastify.requireTenant, fastify.requireRole('admin')]
}, async (request, reply) => {
  // Auto-filtered by tenant
  const users = await User.find();
  return users;
});
```

---

## 🎨 Tenant Resolution Strategies

Choose the strategy that fits your architecture:

<table>
<tr>
<th>Strategy</th>
<th>Use Case</th>
<th>Example</th>
<th>Setup</th>
</tr>
<tr>
<td><strong>🌐 Subdomain</strong></td>
<td>Customer-facing SaaS</td>
<td><code>acme.yoursaas.com</code></td>
<td>

```typescript
{
  resolution: { 
    type: 'subdomain' 
  }
}
```

</td>
</tr>
<tr>
<td><strong>📋 Header</strong></td>
<td>API-first, mobile apps</td>
<td><code>X-Tenant-ID: acme</code></td>
<td>

```typescript
{
  resolution: { 
    type: 'header',
    headerName: 'x-tenant-id'
  }
}
```

</td>
</tr>
<tr>
<td><strong>🎫 JWT Token</strong></td>
<td>Microservices, SPAs</td>
<td><code>{ tenantId: "acme" }</code></td>
<td>

```typescript
{
  resolution: { 
    type: 'token',
    tokenClaim: 'tenantId'
  }
}
```

</td>
</tr>
<tr>
<td><strong>⚙️ Custom</strong></td>
<td>Complex routing logic</td>
<td>API key, path, etc.</td>
<td>

```typescript
{
  resolution: { 
    type: 'custom',
    customResolver: async (req) => {
      const apiKey = req.headers['x-api-key'];
      const client = await getClientByApiKey(apiKey);
      return client?.tenantId;
    }
  }
}
```

</td>
</tr>
</table>

---

## 🔐 Authorization Made Simple

### Quick Role Setup

```typescript
import { RoleManager } from '@saaskit/multitenancy-auth';

const roleManager = new RoleManager({
  roles: [
    {
      name: 'admin',
      permissions: [
        'users:*',        // All user operations
        'projects:*',     // All project operations  
        'billing:*',      // Billing management
        'settings:*'      // Tenant settings
      ]
    },
    {
      name: 'project-manager', 
      permissions: [
        'users:read',
        'projects:*',     // Full project access
        'tasks:*'
      ]
    },
    {
      name: 'member',
      permissions: [
        'users:read',
        'projects:read',
        'projects:write', // Can edit projects
        'tasks:*'
      ]
    },
    {
      name: 'viewer',
      permissions: [
        'users:read',
        'projects:read',
        'tasks:read'
      ]
    }
  ]
});
```

### Smart Permission Hierarchies

```typescript
// Set up permission inheritance
roleManager.setPermissionHierarchy({
  'users:manage': ['users:read', 'users:write', 'users:delete'],
  'projects:manage': ['projects:read', 'projects:write', 'projects:delete'],
  'admin:*': ['users:manage', 'projects:manage', 'billing:manage']
});

// Now 'admin:*' automatically includes all sub-permissions!
```

### Advanced ABAC Policies

```typescript
import { PolicyEngine } from '@saaskit/multitenancy-auth';

const policyEngine = new PolicyEngine();

// Resource ownership policy
policyEngine.registerPolicy({
  id: 'resource-ownership',
  name: 'Users can manage their own resources',
  effect: 'allow',
  actions: ['read', 'write', 'delete'],
  resources: ['project', 'task', 'document'],
  conditions: [{
    attribute: 'resource.attributes.ownerId',
    operator: 'eq',
    value: '${subject.id}' // Dynamic value
  }]
});

// Time-based access policy  
policyEngine.registerPolicy(
  PolicyEngine.createTimeBasedPolicy(
    'business-hours',
    'Allow admin access only during business hours',
    ['admin:*'],
    ['*'],
    { start: '09:00', end: '17:00', timezone: 'UTC' }
  )
);

// IP-based restrictions
policyEngine.registerPolicy({
  id: 'ip-whitelist',
  name: 'Restrict admin access to office IPs',
  effect: 'allow', 
  actions: ['admin:*'],
  resources: ['*'],
  conditions: [{
    attribute: 'environment.ipAddress',
    operator: 'in',
    value: ['192.168.1.0/24', '10.0.0.0/8']
  }]
});
```

---

## 🗃 Database Integration

### Prisma (Recommended)

```typescript
// schema.prisma
model User {
  id       String @id @default(cuid())
  email    String
  tenantId String // Required field
  
  @@unique([email, tenantId])
  @@index([tenantId])
}

model Project {
  id          String @id @default(cuid()) 
  name        String
  tenantId    String // Required field
  ownerId     String
  
  owner       User   @relation(fields: [ownerId], references: [id])
  
  @@index([tenantId])
  @@index([tenantId, ownerId])
}
```

```typescript
// Apply the adapter
import { applyPrismaAdapter } from '@saaskit/multitenancy-adapters';

applyPrismaAdapter(prisma, {
  tenantField: 'tenantId',
  models: ['User', 'Project', 'Task'], // Auto-filtered models
  exclude: ['SystemLog'], // Skip certain models
  onViolation: 'throw' // or 'warn' for development
});

// All queries now automatically filtered by tenant!
const users = await prisma.user.findMany(); // Only current tenant's users
const projects = await prisma.project.findMany(); // Only current tenant's projects
```

### Sequelize

```typescript
// models/User.js
import { DataTypes } from 'sequelize';
import { applySequelizeAdapter } from '@saaskit/multitenancy-adapters';

const User = sequelize.define('User', {
  email: DataTypes.STRING,
  tenantId: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Apply tenant filtering
applySequelizeAdapter(User, {
  tenantField: 'tenantId',
  autoScope: true
});

// Usage - automatically scoped to tenant
const users = await User.findAll(); // Only current tenant's users
```

### Mongoose

```typescript
// models/User.js
import mongoose from 'mongoose';
import { mongooseTenantPlugin } from '@saaskit/multitenancy-adapters';

const userSchema = new mongoose.Schema({
  email: String,
  name: String
  // tenantId added automatically by plugin
});

// Apply the plugin
userSchema.plugin(mongooseTenantPlugin, {
  tenantField: 'tenantId',
  indexTenant: true,
  autoPopulate: true
});

const User = mongoose.model('User', userSchema);

// Usage - automatically scoped
const users = await User.find(); // Only current tenant's users
```

---

## 🏗 Advanced Patterns

### Multi-Database Architecture

Perfect for enterprise customers who need dedicated databases:

```typescript
import { TenantConnectionManager } from '@saaskit/multitenancy-adapters';

const connectionManager = new TenantConnectionManager({
  default: process.env.DEFAULT_DATABASE_URL,
  resolver: async (tenantId: string) => {
    const tenant = await getTenant(tenantId);
    return tenant.dedicatedDb ? tenant.databaseUrl : 'default';
  },
  pooling: {
    max: 10,
    idleTimeout: 30000
  }
});

// Use in your middleware
app.use(async (req, res, next) => {
  const tenantId = getCurrentTenantId();
  const connection = await connectionManager.getConnection(tenantId);
  req.db = connection;
  next();
});
```

### Tenant Lifecycle Management

```typescript
import { TenantManager } from '@saaskit/multitenancy-core';

const tenantManager = new TenantManager({
  onCreate: async (tenant) => {
    // Setup default data, send welcome email, etc.
    await setupDefaultData(tenant.id);
    await sendWelcomeEmail(tenant.ownerEmail);
  },
  onSuspend: async (tenant) => {
    // Cleanup resources, notify users
    await cleanupResources(tenant.id);
  },
  onDelete: async (tenant) => {
    // Full cleanup, data export, etc.
    await exportTenantData(tenant.id);
    await deleteTenantData(tenant.id);
  }
});

// Create a new tenant
const newTenant = await tenantManager.create({
  name: 'Acme Corp',
  subdomain: 'acme',
  plan: 'professional',
  ownerEmail: 'admin@acme.com'
});
```

### Audit Logging

Track everything automatically:

```typescript
import { AuditLogger } from '@saaskit/multitenancy-core';

const auditLogger = AuditLogger.getInstance({
  store: new DatabaseAuditStore(prisma),
  sensitiveFields: ['password', 'apiKey', 'secret']
});

// Automatic logging with decorator
@AuditLog('user:update')
async function updateUser(id: string, data: any) {
  return await prisma.user.update({
    where: { id },
    data
  });
}

// Manual logging
await auditLogger.log({
  action: 'project:create',
  resource: { type: 'project', id: project.id },
  result: 'success',
  metadata: { name: project.name }
});

// Query audit logs
const recentActivity = await auditLogger.query({
  actions: ['user:login', 'user:logout'],
  dateRange: { start: yesterday, end: now },
  limit: 100
});
```

---

## 🐛 Troubleshooting & FAQ

<details>
<summary><strong>🔍 Tenant not detected / Context is undefined</strong></summary>

**Common causes:**
1. Middleware not registered or registered after routes
2. Async context lost in callbacks
3. Missing tenant data in resolution strategy

**Solutions:**
```typescript
// ✅ Correct: Register middleware BEFORE routes
app.use(createTenantMiddleware(config));
app.use('/api', apiRoutes);

// ❌ Wrong: Middleware after routes
app.use('/api', apiRoutes);
app.use(createTenantMiddleware(config));

// ✅ Preserve async context in callbacks
import { tenantContext } from '@saaskit/multitenancy-core';

setTimeout(() => {
  // Use runAsync to preserve context
  tenantContext.runAsync(currentContext, async () => {
    const tenant = tenantContext.getCurrentTenant();
    // ... your code
  });
}, 1000);
```

</details>

<details>
<summary><strong>⚡ Performance Issues</strong></summary>

**Optimization tips:**

1. **Enable connection pooling:**
```typescript
applyPrismaAdapter(prisma, {
  tenantField: 'tenantId',
  models: ['User', 'Project'],
  caching: {
    enabled: true,
    ttl: 300 // 5 minutes
  }
});
```

2. **Add database indexes:**
```sql
-- Always index tenant fields
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_projects_tenant_id ON projects(tenant_id);

-- Composite indexes for common queries
CREATE INDEX idx_projects_tenant_owner ON projects(tenant_id, owner_id);
```

3. **Use tenant-aware caching:**
```typescript
import { TenantCache } from '@saaskit/multitenancy-core';

const cache = new TenantCache(redisClient);

// Automatically scoped to current tenant
await cache.set('user-preferences', preferences);
const cached = await cache.get('user-preferences');
```

</details>

<details>
<summary><strong>🔒 Data Leakage Prevention</strong></summary>

**Best practices:**

1. **Always validate tenant access:**
```typescript
app.get('/api/projects/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id }
  });
  
  // ✅ Double-check tenant ownership
  const currentTenant = tenantContext.getCurrentTenantId();
  if (project.tenantId !== currentTenant) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project);
});
```

2. **Use strict mode:**
```typescript
app.use(createTenantMiddleware({
  resolution: { type: 'subdomain' },
  dataStore: tenantDataStore,
  allowNoTenant: false, // ✅ Strict: Reject requests without tenant
  validateAccess: true   // ✅ Validate user belongs to tenant
}));
```

3. **Enable audit logging:**
```typescript
// Track all data access
@AuditLog('data:access')
async function getData() {
  // Your data access code
}
```

</details>

<details>
<summary><strong>🧪 Testing Multi-Tenant Code</strong></summary>

```typescript
import { TenantContextManager } from '@saaskit/multitenancy-core';

describe('Multi-tenant API', () => {
  const tenantContext = TenantContextManager.getInstance();
  
  it('should isolate data by tenant', async () => {
    // Setup test tenants
    const tenant1 = { id: 'tenant1', name: 'Acme Corp' };
    const tenant2 = { id: 'tenant2', name: 'Globex Corp' };
    
    // Test with tenant1 context
    await tenantContext.runAsync({ tenant: tenant1 }, async () => {
      const projects = await getProjects();
      expect(projects).toHaveLength(3); // tenant1 has 3 projects
    });
    
    // Test with tenant2 context  
    await tenantContext.runAsync({ tenant: tenant2 }, async () => {
      const projects = await getProjects();
      expect(projects).toHaveLength(1); // tenant2 has 1 project
    });
  });
  
  it('should enforce role-based access', async () => {
    const memberContext = {
      tenant: { id: 'tenant1' },
      user: { id: 'user1' },
      roles: ['member']
    };
    
    await tenantContext.runAsync(memberContext, async () => {
      await expect(deleteProject('project1')).rejects.toThrow('Insufficient permissions');
    });
  });
});
```

</details>

---

## 📊 Migration Guides

### From Manual Multi-Tenancy

<details>
<summary><strong>Step-by-step migration from custom solution</strong></summary>

**Before: Manual tenant filtering**
```typescript
// ❌ Before: Manual and error-prone
app.get('/api/users', async (req, res) => {
  const tenantId = req.headers['x-tenant-id']; // Manual extraction
  if (!tenantId) return res.status(400).json({ error: 'Missing tenant' });
  
  const users = await prisma.user.findMany({
    where: { tenantId: tenantId } // Manual filtering - easy to forget!
  });
  res.json(users);
});
```

**After: Automatic with SaaS Toolkit**
```typescript
// ✅ After: Automatic and bulletproof
app.use(createTenantMiddleware({ 
  resolution: { type: 'header', headerName: 'x-tenant-id' },
  dataStore: tenantDataStore 
}));

applyPrismaAdapter(prisma, {
  tenantField: 'tenantId',
  models: ['User'] // Automatic filtering
});

app.get('/api/users', async (req, res) => {
  const users = await prisma.user.findMany(); // Automatically filtered!
  res.json(users);
});
```

**Migration steps:**
1. Install the toolkit
2. Replace manual tenant extraction with middleware
3. Apply ORM adapters
4. Remove manual filtering from queries
5. Add role-based authorization
6. Test thoroughly

</details>

### From Other Multi-Tenancy Libraries

<details>
<summary><strong>Migration guides for popular alternatives</strong></summary>

**From `@clerk/backend`:**
```typescript
// Before
import { clerkMiddleware } from '@clerk/backend';
app.use(clerkMiddleware);

// After: More control and flexibility
import { createTenantMiddleware } from '@saaskit/multitenancy-core';
app.use(createTenantMiddleware({
  resolution: { type: 'token', tokenClaim: 'org_id' },
  dataStore: clerkTenantDataStore
}));
```

**From `@casl/ability`:**
```typescript
// Before: Manual ability setup for each request
const ability = defineAbilityFor(user);
if (ability.cannot('delete', 'Project')) {
  throw new ForbiddenError();
}

// After: Automatic context-aware authorization
import { requirePermission } from '@saaskit/multitenancy-core';
app.delete('/projects/:id', requirePermission('projects:delete'), handler);
```

</details>

---

## 🎯 Production Checklist

Before going live, ensure you have:

- [ ] **Tenant isolation tested** - Verify no data leakage between tenants
- [ ] **Database indexes added** - Index all `tenantId` fields for performance  
- [ ] **Error handling configured** - Proper error responses for invalid tenants
- [ ] **Audit logging enabled** - Track all sensitive operations
- [ ] **Rate limiting per tenant** - Prevent resource exhaustion
- [ ] **Backup strategy** - Tenant-aware backup and restore
- [ ] **Monitoring set up** - Track tenant-specific metrics
- [ ] **Security review completed** - Regular security audits

### Production Configuration

```typescript
// production.ts
const config = {
  tenant: {
    resolution: { type: 'subdomain' },
    dataStore: new CachedTenantDataStore(redis, database),
    allowNoTenant: false,
    validateAccess: true,
    onError: (error, req, res) => {
      logger.error('Tenant resolution failed', { 
        error: error.message, 
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      res.status(400).json({ error: 'Invalid tenant configuration' });
    }
  },
  database: {
    pooling: { max: 20, idleTimeout: 30000 },
    caching: { enabled: true, ttl: 300 },
    indexing: { autoCreate: false } // Create indexes manually in production
  },
  audit: {
    enabled: true,
    store: new DatabaseAuditStore(prisma),
    retention: { days: 365 },
    sensitive: ['password', 'apiKey', 'token', 'secret']
  },
  security: {
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Per tenant
      keyGenerator: (req) => `${req.tenant?.id}:${req.ip}`
    }
  }
};
```

---

## 📚 API Reference

### Core Package

#### `createTenantMiddleware(options: TenantMiddlewareOptions)`
Creates middleware for automatic tenant resolution and context management.

```typescript
interface TenantMiddlewareOptions {
  resolution: TenantResolutionOptions;
  dataStore: TenantDataStore;
  onError?: (error: Error, req: any, res: any) => void;
  allowNoTenant?: boolean;
  validateAccess?: boolean;
}
```

#### `tenantContext: TenantContextManager`
Singleton for accessing current tenant context.

```typescript
// Get current tenant
const tenant = tenantContext.getCurrentTenant();
const tenantId = tenantContext.getCurrentTenantId();

// Get current user and roles
const user = tenantContext.getCurrentUser();
const roles = tenantContext.getCurrentRoles();
const permissions = tenantContext.getCurrentPermissions();

// Check permissions
const canEdit = tenantContext.hasPermission('projects:write');
const isAdmin = tenantContext.hasRole('admin');
```

#### Middleware Helpers

```typescript
// Require authentication
app.use(requireTenantAuth);

// Require specific roles (any of)
app.use(requireRole('admin', 'moderator'));

// Require specific permissions (any of)
app.use(requirePermission('users:read', 'users:write'));
```

### Adapters Package

#### Prisma Adapter

```typescript
import { applyPrismaAdapter, createPrismaAdapter } from '@saaskit/multitenancy-adapters';

// Apply to existing client
applyPrismaAdapter(prisma, {
  tenantField: 'tenantId',
  models: ['User', 'Project'],
  exclude: ['SystemLog'],
  onViolation: 'throw' | 'warn' | 'ignore'
});

// Create new tenant-aware client
const TenantPrismaClient = createTenantPrismaClient(PrismaClient, options);
const prisma = new TenantPrismaClient();
```

#### Sequelize Adapter

```typescript
import { applySequelizeAdapter, TenantModel } from '@saaskit/multitenancy-adapters';

// Apply to specific model
applySequelizeAdapter(User, {
  tenantField: 'tenantId',
  autoScope: true
});

// Use base model class
class User extends TenantModel {
  // Your model definition
}
```

#### Mongoose Adapter

```typescript
import { mongooseTenantPlugin, createTenantModel } from '@saaskit/multitenancy-adapters';

// Apply as plugin
userSchema.plugin(mongooseTenantPlugin, {
  tenantField: 'tenantId',
  indexTenant: true,
  autoPopulate: false
});

// Create tenant-specific models
const TenantUser = createTenantModel(User, tenantId);
```

### Auth Package

#### `RoleManager`

```typescript
const roleManager = new RoleManager({
  roles: RoleDefinition[],
  permissionHierarchy: Record<string, string[]>
});

// Role management
roleManager.registerRole(role);
roleManager.getRole(name);
roleManager.getRolePermissions(roleName);
roleManager.hasRole(name);

// Permission management
roleManager.setPermissionHierarchy(hierarchy);
roleManager.addPermissionImplication(parent, children);
```

#### `PolicyEngine`

```typescript
const policyEngine = new PolicyEngine();

// Policy management
policyEngine.registerPolicy(policy);
policyEngine.registerPolicies(policies);
policyEngine.evaluate(context);

// Policy templates
PolicyEngine.createOwnershipPolicy(resourceType);
PolicyEngine.createRolePolicy(role, actions, resources);
PolicyEngine.createTimeBasedPolicy(id, name, actions, resources, startTime, endTime);
```

#### `AuthorizationManager`

```typescript
const authManager = new AuthorizationManager({
  roleManager,
  policyEngine
});

// Authorization checks
const canAccess = await authManager.can(action, resource);
const cannotAccess = await authManager.cannot(action, resource);

// Bulk checks
const permissions = await authManager.getPermissions(subject);
const roles = await authManager.getRoles(subject);
```

---

## 🤝 Contributing

We love contributions! Here's how to get started:

### Quick Setup

```bash
# Clone and setup
git clone https://github.com/saaskit/multitenancy.git
cd multitenancy
npm install

# Run tests
npm test

# Build packages
npm run build

# Try the example
cd examples/express-demo
npm run dev
```

### Contribution Ideas

- 🎯 **New adapters** - Add support for more ORMs/databases
- 🔧 **Framework integrations** - Add support for Koa, Hapi, etc.
- 📚 **Examples** - More real-world examples and tutorials
- 🐛 **Bug fixes** - Check our [issues](https://github.com/saaskit/multitenancy/issues)
- 📖 **Documentation** - Improve guides and API docs
- ⚡ **Performance** - Optimize hot paths and memory usage

### Development Guidelines

- Write tests for new features
- Follow TypeScript best practices
- Update documentation
- Add examples for new features
- Ensure backward compatibility

---

## 📈 Roadmap

### 🎯 Next Release (v2.0)
- [ ] **GraphQL integration** - Schema stitching and resolvers
- [ ] **Admin dashboard** - Web UI for tenant management
- [ ] **Advanced caching** - Redis integration and cache invalidation
- [ ] **Tenant analytics** - Usage metrics and insights
- [ ] **Webhook system** - Event-driven tenant lifecycle

### 🚀 Future Releases
- [ ] **Python support** - Django and FastAPI adapters
- [ ] **Multi-region** - Geographical tenant distribution
- [ ] **Tenant migration** - Tools for moving tenants between databases
- [ ] **Advanced RBAC** - Hierarchical roles and dynamic permissions
- [ ] **Compliance tools** - GDPR, SOC2, HIPAA helpers

### 💡 Community Requests
Vote on features at [our discussions](https://github.com/saaskit/multitenancy/discussions)!

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

**Free for commercial use** ✅ **No attribution required** ✅ **Modify as needed** ✅

---

## 🆘 Support & Community

<table>
<tr>
<td align="center">
<strong>📚 Documentation</strong><br>
<a href="https://docs.saaskit.dev">docs.saaskit.dev</a>
</td>
<td align="center">
<strong>💬 Discord</strong><br>
<a href="https://discord.gg/saaskit">Join our community</a>
</td>
<td align="center">
<strong>🐛 Issues</strong><br>
<a href="https://github.com/saaskit/multitenancy/issues">Report bugs</a>
</td>
<td align="center">
<strong>💡 Discussions</strong><br>
<a href="https://github.com/saaskit/multitenancy/discussions">Share ideas</a>
</td>
</tr>
</table>

### Enterprise Support

Need help with production deployment, custom features, or architecture review?

**📧 [enterprise@saaskit.dev](mailto:enterprise@saaskit.dev)**

We offer:
- 🏗 **Architecture consulting** - Design review and best practices
- ⚡ **Performance optimization** - Scale to millions of tenants
- 🔒 **Security audits** - Comprehensive security review
- 🎓 **Training** - Team training and workshops
- 🛠 **Custom development** - Bespoke features and integrations

---

## ⭐ Show Your Support

If this toolkit saved you weeks of development time, give us a star! ⭐

It helps other developers discover the project and motivates us to keep improving it.

[![GitHub stars](https://img.shields.io/github/stars/saaskit/multitenancy.svg?style=social&label=Star)](https://github.com/saaskit/multitenancy)

---

<div align="center">

**Built with ❤️ by the SaaSKit team**

*Making multi-tenancy accessible to every developer*

</div>