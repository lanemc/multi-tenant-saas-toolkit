export * from './multitenancy.module';
export * from './middleware/tenant.middleware';
export * from './guards/tenant-auth.guard';
export * from './guards/roles.guard';
export * from './guards/permissions.guard';
export * from './decorators/tenant.decorator';
export * from './decorators/roles.decorator';
export * from './decorators/permissions.decorator';
export * from './interceptors/tenant-context.interceptor';
export * from './interfaces';

// Re-export core types (specific exports to avoid conflicts)
export {
  TenantContext,
  TenantDataStore,
  TenantMiddlewareOptions,
  TenantResolutionOptions,
  AuthorizationRule,
  RoleDefinition,
  tenantContext,
  AuditEvent,
  AuditStore,
  AuditLogInput,
  AuditLoggerConfig,
  AuditActionConfig
} from '@saaskit/multitenancy-core';

// Re-export core types with aliases to avoid conflicts
export {
  Tenant as TenantType,
  User as UserType,
  TenantUser as TenantUserType
} from '@saaskit/multitenancy-core';