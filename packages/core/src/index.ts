// Core exports
export * from './types';
export * from './context/tenant-context';
export * from './middleware/express';
export * from './audit';

// Re-export commonly used items for convenience
export { tenantContext } from './context/tenant-context';
export { 
  createTenantMiddleware,
  requireTenantAuth,
  requireRole,
  requirePermission,
  type TenantRequest
} from './middleware/express';
export { AuditLogger } from './audit/audit-logger';
export { AuditAction } from './audit/decorator';
export { InMemoryAuditStore } from './audit/stores/in-memory-store';