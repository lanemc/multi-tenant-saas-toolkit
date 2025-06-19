// RBAC exports
export * from './rbac/role-manager';

// ABAC exports
export * from './abac/policy-engine';

// Main authorization exports
export * from './authorization-manager';

// Re-export commonly used items
export { RoleManager } from './rbac/role-manager';
export { PolicyEngine, Policy, PolicyContext, PolicyEffect } from './abac/policy-engine';
export { AuthorizationManager } from './authorization-manager';