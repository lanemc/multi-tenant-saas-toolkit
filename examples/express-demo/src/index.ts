import { AuthorizationManager } from '@saaskit/multitenancy-auth';
import { 
  createTenantMiddleware, 
  tenantContext,
  requireRole,
  TenantDataStore,
  Tenant,
  TenantUser
} from '@saaskit/multitenancy-core';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// Mock data store
const tenants = new Map<string, Tenant>();
const users = new Map<string, any>();
const tenantUsers = new Map<string, TenantUser>();

// Initialize with sample data
const tenant1: Tenant = {
  id: 'tenant-1',
  name: 'Acme Corp',
  subdomain: 'acme',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date()
};

const tenant2: Tenant = {
  id: 'tenant-2',
  name: 'Tech Startup',
  subdomain: 'techstartup',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date()
};

tenants.set(tenant1.id, tenant1);
tenants.set(tenant2.id, tenant2);

// Sample users
const user1 = {
  id: 'user-1',
  email: 'admin@acme.com',
  name: 'John Admin'
};

const user2 = {
  id: 'user-2',
  email: 'member@acme.com',
  name: 'Jane Member'
};

users.set(user1.id, user1);
users.set(user2.id, user2);

// User-tenant relationships
tenantUsers.set(`${user1.id}:${tenant1.id}`, {
  userId: user1.id,
  tenantId: tenant1.id,
  roles: ['admin'],
  permissions: [],
  joinedAt: new Date()
});

tenantUsers.set(`${user2.id}:${tenant1.id}`, {
  userId: user2.id,
  tenantId: tenant1.id,
  roles: ['member'],
  permissions: [],
  joinedAt: new Date()
});

// Create tenant data store
const tenantDataStore: TenantDataStore = {
  async getTenantById(id: string) {
    return tenants.get(id) || null;
  },
  
  async getTenantBySubdomain(subdomain: string) {
    return Array.from(tenants.values()).find(t => t.subdomain === subdomain) || null;
  },
  
  async getTenantByDomain(domain: string) {
    return Array.from(tenants.values()).find(t => t.domain === domain) || null;
  },
  
  async createTenant(data) {
    const tenant: Tenant = {
      ...data,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    tenants.set(tenant.id, tenant);
    return tenant;
  },
  
  async updateTenant(id: string, data) {
    const tenant = tenants.get(id);
    if (!tenant) throw new Error('Tenant not found');
    
    const updated = {
      ...tenant,
      ...data,
      updatedAt: new Date()
    };
    tenants.set(id, updated);
    return updated;
  },
  
  async deleteTenant(id: string) {
    tenants.delete(id);
  },
  
  async getUserTenant(userId: string, tenantId: string) {
    return tenantUsers.get(`${userId}:${tenantId}`) || null;
  }
};

// JWT secret (in production, use environment variable)
const JWT_SECRET = 'your-secret-key';

// Authentication middleware
app.use((req, _res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      (req as any).user = users.get(decoded.userId);
    } catch (error) {
      // Invalid token, continue without user
    }
  }
  
  next();
});

// Initialize authorization manager
const authManager = new AuthorizationManager();

// Register some ABAC policies
authManager.registerPolicy({
  id: 'project-ownership',
  name: 'Project Ownership Policy',
  effect: 'allow',
  actions: ['projects:read', 'projects:update', 'projects:delete'],
  resources: ['project'],
  conditions: [
    {
      attribute: 'resource.attributes.ownerId',
      operator: 'custom',
      value: null,
      customEvaluator: (context) => 
        context.resource.attributes.ownerId === context.subject.id
    }
  ]
});

// Apply tenant middleware
app.use(createTenantMiddleware({
  resolution: {
    type: 'subdomain'
  },
  dataStore: tenantDataStore,
  onError: (error, req, res) => {
    res.status(400).json({ 
      error: 'Tenant resolution failed',
      message: error.message 
    });
  }
}));

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Multi-tenant SaaS Toolkit Demo',
    tenant: tenantContext.getCurrentTenant()
  });
});

// Login endpoint (generates JWT)
app.post('/login', async (req, res) => {
  const { email } = req.body;
  
  // Find user (mock authentication)
  const user = Array.from(users.values()).find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Generate JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  res.json({ token, user });
});

// Get current tenant info
app.get('/api/tenant', (req, res) => {
  const tenant = tenantContext.getCurrentTenant();
  const user = tenantContext.getCurrentUser();
  const roles = tenantContext.getCurrentRoles();
  
  res.json({ tenant, user, roles });
});

// Admin only endpoint
app.get('/api/admin', requireRole('admin'), (req, res) => {
  res.json({ 
    message: 'Admin dashboard data',
    tenant: tenantContext.getCurrentTenant()
  });
});

// Member accessible endpoint
app.get('/api/projects', requireRole('member', 'admin'), async (req, res) => {
  // Mock projects data
  const projects = [
    { id: '1', name: 'Project Alpha', ownerId: 'user-1' },
    { id: '2', name: 'Project Beta', ownerId: 'user-2' }
  ];
  
  res.json({ projects });
});

// ABAC protected endpoint
app.put('/api/projects/:id', async (req, res) => {
  const projectId = req.params.id;
  
  // Mock project lookup
  const project = { id: projectId, name: 'Project Alpha', ownerId: 'user-1' };
  
  // Check authorization
  const canUpdate = await authManager.can('projects:update', {
    type: 'project',
    id: projectId,
    attributes: { ownerId: project.ownerId }
  });
  
  if (!canUpdate) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  res.json({ 
    message: 'Project updated',
    project: { ...project, ...req.body }
  });
});

// Create new tenant (super admin only)
app.post('/api/tenants', async (req, res) => {
  try {
    const { name, subdomain } = req.body;
    
    // Check if subdomain already exists
    const existing = await tenantDataStore.getTenantBySubdomain(subdomain);
    if (existing) {
      return res.status(400).json({ error: 'Subdomain already exists' });
    }
    
    // Create tenant
    const tenant = await tenantDataStore.createTenant({
      name,
      subdomain,
      status: 'active'
    });
    
    res.json({ tenant });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Multi-tenant demo server running on port ${PORT}`);
  console.log('');
  console.log('Available tenants:');
  console.log('- http://acme.localhost:3000 (Acme Corp)');
  console.log('- http://techstartup.localhost:3000 (Tech Startup)');
  console.log('');
  console.log('Test users:');
  console.log('- admin@acme.com (admin role in Acme Corp)');
  console.log('- member@acme.com (member role in Acme Corp)');
});