# Audit Logging

The Multi-Tenant SaaS Toolkit provides built-in audit logging capabilities for compliance and security requirements.

## Quick Start

```typescript
import { auditLogger, InMemoryAuditStore } from '@saaskit/multitenancy-core';

// Configure the audit logger with a store
auditLogger.configure({
  store: new InMemoryAuditStore(),
  enableConsoleLog: true, // For development
  includeRequestInfo: true,
  sensitiveFields: ['password', 'token', 'secret']
});

// Log an audit event
await auditLogger.log('user.login', {
  resource: 'auth',
  metadata: { email: 'user@example.com' },
  result: 'success'
});
```

## Automatic Context Capture

The audit logger automatically captures tenant and user context:

```typescript
// Within a tenant context, this information is captured automatically
await auditLogger.log('document.create', {
  resource: 'document',
  resourceId: 'doc_123',
  changes: {
    title: 'New Document',
    content: 'Document content...'
  }
});

// The logged event will include:
// - tenantId (from current context)
// - userId (from current context)
// - timestamp
// - unique event ID
```

## Using the Audit Decorator

For class methods, use the `@AuditAction` decorator:

```typescript
import { AuditAction } from '@saaskit/multitenancy-core';

class DocumentService {
  @AuditAction('document.create')
  async createDocument(data: any) {
    // Method implementation
    return { id: 'doc_123', ...data };
  }

  @AuditAction('document.update', { resource: 'document' })
  async updateDocument(id: string, data: any) {
    // Method implementation
    return { id, ...data };
  }

  @AuditAction('document.delete')
  async deleteDocument(id: string) {
    // Method implementation
  }
}
```

## Querying Audit Logs

```typescript
// Query audit logs with filters
const events = await auditLogger.query({
  tenantId: 'tenant_123',
  action: 'document.create',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  result: 'success',
  limit: 50,
  orderBy: 'timestamp',
  order: 'desc'
});

// Count events matching criteria
const count = await auditLogger.count({
  tenantId: 'tenant_123',
  userId: 'user_456',
  resource: 'document'
});
```

## Express Integration

```typescript
app.post('/api/documents', requireTenantAuth, async (req, res) => {
  try {
    const document = await createDocument(req.body);
    
    // Log the action with request info
    await auditLogger.log('document.create', {
      resource: 'document',
      resourceId: document.id,
      changes: req.body,
      request: req, // Captures IP and user agent
      result: 'success'
    });
    
    res.json(document);
  } catch (error) {
    await auditLogger.log('document.create', {
      resource: 'document',
      changes: req.body,
      request: req,
      result: 'failure',
      error: error.message
    });
    
    res.status(500).json({ error: error.message });
  }
});
```

## Custom Audit Store

Implement your own audit store for production use:

```typescript
import { AuditLogStore, AuditEvent } from '@saaskit/multitenancy-core';

class DatabaseAuditStore implements AuditLogStore {
  async log(event: AuditEvent): Promise<void> {
    // Save to database
    await db.auditLogs.create({
      data: event
    });
  }

  async query(options: AuditQueryOptions): Promise<AuditEvent[]> {
    // Query from database
    return await db.auditLogs.findMany({
      where: {
        tenantId: options.tenantId,
        userId: options.userId,
        action: options.action,
        // ... other filters
      },
      orderBy: { timestamp: options.order || 'desc' },
      take: options.limit,
      skip: options.offset
    });
  }

  async count(options: AuditQueryOptions): Promise<number> {
    // Count from database
    return await db.auditLogs.count({
      where: {
        tenantId: options.tenantId,
        // ... other filters
      }
    });
  }
}

// Configure with custom store
auditLogger.configure({
  store: new DatabaseAuditStore()
});
```

## Sensitive Data Handling

The audit logger automatically redacts sensitive fields:

```typescript
await auditLogger.log('user.update', {
  changes: {
    email: 'new@example.com',
    password: 'newPassword123', // Will be logged as '[REDACTED]'
    profile: {
      name: 'John Doe',
      apiToken: 'secret_token' // Will be logged as '[REDACTED]'
    }
  }
});
```

Configure additional sensitive fields:

```typescript
auditLogger.configure({
  store: myStore,
  sensitiveFields: ['password', 'token', 'secret', 'ssn', 'creditCard']
});
```

## Best Practices

1. **Always configure a persistent store in production** - The in-memory store is only for development/testing.

2. **Log both successes and failures** - This helps with security analysis and debugging.

3. **Include relevant metadata** - Add context that will be useful for analysis.

4. **Use consistent action names** - Follow a naming convention like `resource.action` (e.g., `user.create`, `document.update`).

5. **Implement retention policies** - Don't keep audit logs forever; implement cleanup based on your compliance requirements.

6. **Secure audit log access** - Ensure only authorized users can query audit logs.

7. **Monitor audit log failures** - Audit logging failures should be monitored but not break the application.

## Common Audit Events

```typescript
// Authentication events
await auditLogger.log('auth.login', { resource: 'auth', metadata: { method: 'password' }});
await auditLogger.log('auth.logout', { resource: 'auth' });
await auditLogger.log('auth.failed', { resource: 'auth', result: 'failure', error: 'Invalid credentials' });

// Data access events
await auditLogger.log('data.read', { resource: 'user', resourceId: userId });
await auditLogger.log('data.export', { resource: 'reports', metadata: { format: 'csv' }});

// Administrative events
await auditLogger.log('admin.roleAssign', { resource: 'role', resourceId: roleId, metadata: { userId }});
await auditLogger.log('admin.permissionGrant', { resource: 'permission', changes: { permissions: ['read', 'write'] }});

// Configuration changes
await auditLogger.log('config.update', { resource: 'settings', changes: { oldValue, newValue }});
```