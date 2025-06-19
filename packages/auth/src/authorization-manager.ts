import { tenantContext, TenantContext } from '@saaskit/multitenancy-core';

import { PolicyEngine, Policy } from './abac/policy-engine';
import { RoleManager } from './rbac/role-manager';

export interface AuthorizationOptions {
  roleManager?: RoleManager;
  policyEngine?: PolicyEngine;
  defaultDeny?: boolean;
  cache?: boolean;
  cacheTTL?: number;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reasons: string[];
  evaluatedPolicies?: string[];
}

export class AuthorizationManager {
  private roleManager: RoleManager;
  private policyEngine: PolicyEngine;
  private defaultDeny: boolean;
  private cache: Map<string, { decision: boolean; timestamp: number }> = new Map();
  private cacheEnabled: boolean;
  private cacheTTL: number;

  constructor(options: AuthorizationOptions = {}) {
    this.roleManager = options.roleManager || new RoleManager();
    this.policyEngine = options.policyEngine || new PolicyEngine();
    this.defaultDeny = options.defaultDeny !== false;
    this.cacheEnabled = options.cache || false;
    this.cacheTTL = options.cacheTTL || 60000; // 1 minute default
  }

  /**
   * Check if the current user can perform an action
   */
  async can(
    action: string,
    resource?: { type: string; id?: string; attributes?: Record<string, any> }
  ): Promise<boolean> {
    const context = tenantContext.getContext();
    if (!context) {
      return !this.defaultDeny;
    }

    return this.canWithContext(context, action, resource);
  }

  /**
   * Check if a specific context can perform an action
   */
  async canWithContext(
    context: TenantContext,
    action: string,
    resource?: { type: string; id?: string; attributes?: Record<string, any> }
  ): Promise<boolean> {
    // Check cache first
    if (this.cacheEnabled) {
      const cacheKey = this.getCacheKey(context, action, resource);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.decision;
      }
    }

    let allowed = false;
    const reasons: string[] = [];

    // First check RBAC permissions
    if (context.roles && context.roles.length > 0) {
      const permissions = this.roleManager.getPermissionsForRoles(context.roles);
      
      // Check direct permission match
      if (permissions.includes(action)) {
        allowed = true;
        reasons.push(`Permission '${action}' granted by role(s): ${context.roles.join(', ')}`);
      }

      // Check wildcard permissions
      const wildcardPermissions = permissions.filter(p => p.includes('*'));
      for (const permission of wildcardPermissions) {
        if (this.matchesWildcard(action, permission)) {
          allowed = true;
          reasons.push(`Permission '${action}' granted by wildcard permission '${permission}'`);
          break;
        }
      }
    }

    // Then check ABAC policies if resource is provided
    if (resource) {
      const policyContext = PolicyEngine.createContextFromTenant(
        context,
        action,
        resource
      );

      const policyDecision = this.policyEngine.evaluate(policyContext);
      
      if (policyDecision) {
        allowed = true;
        reasons.push(`Allowed by ABAC policy evaluation`);
      } else if (!allowed) {
        reasons.push(`Denied by ABAC policy evaluation`);
      }
    }

    // Cache the decision
    if (this.cacheEnabled) {
      const cacheKey = this.getCacheKey(context, action, resource);
      this.cache.set(cacheKey, { decision: allowed, timestamp: Date.now() });
    }

    return allowed;
  }

  /**
   * Get detailed authorization decision
   */
  async authorize(
    action: string,
    resource?: { type: string; id?: string; attributes?: Record<string, any> }
  ): Promise<AuthorizationDecision> {
    const context = tenantContext.getContext();
    if (!context) {
      return {
        allowed: !this.defaultDeny,
        reasons: ['No tenant context available']
      };
    }

    const reasons: string[] = [];
    let allowed = false;

    // RBAC evaluation
    if (context.roles && context.roles.length > 0) {
      const permissions = this.roleManager.getPermissionsForRoles(context.roles);
      
      if (permissions.includes(action)) {
        allowed = true;
        reasons.push(`Permission '${action}' granted by role(s): ${context.roles.join(', ')}`);
      } else {
        const wildcardMatch = permissions.find(p => 
          p.includes('*') && this.matchesWildcard(action, p)
        );
        
        if (wildcardMatch) {
          allowed = true;
          reasons.push(`Permission '${action}' granted by wildcard permission '${wildcardMatch}'`);
        }
      }
    }

    // ABAC evaluation
    if (resource) {
      const policyContext = PolicyEngine.createContextFromTenant(
        context,
        action,
        resource
      );

      const policyDecision = this.policyEngine.evaluate(policyContext);
      
      if (policyDecision) {
        allowed = true;
        reasons.push(`Allowed by ABAC policy evaluation`);
      } else if (!allowed) {
        allowed = false;
        reasons.push(`Denied by ABAC policy evaluation`);
      }
    }

    if (!allowed && reasons.length === 0) {
      reasons.push('No matching permissions or policies found');
    }

    return { allowed, reasons };
  }

  /**
   * Require permission (throws if not allowed)
   */
  async require(
    action: string,
    resource?: { type: string; id?: string; attributes?: Record<string, any> }
  ): Promise<void> {
    const decision = await this.authorize(action, resource);
    
    if (!decision.allowed) {
      const error = new Error(`Unauthorized: ${decision.reasons.join('; ')}`);
      (error as any).code = 'UNAUTHORIZED';
      (error as any).action = action;
      (error as any).resource = resource;
      throw error;
    }
  }

  /**
   * Check if a string matches a wildcard pattern
   */
  private matchesWildcard(str: string, pattern: string): boolean {
    const regexPattern = pattern
      .split('*')
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    context: TenantContext,
    action: string,
    resource?: { type: string; id?: string; attributes?: Record<string, any> }
  ): string {
    const parts = [
      context.tenant.id,
      context.user?.id || 'anonymous',
      context.roles?.join(',') || '',
      action,
      resource?.type || '',
      resource?.id || ''
    ];
    
    return parts.join(':');
  }

  /**
   * Clear authorization cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get role manager
   */
  getRoleManager(): RoleManager {
    return this.roleManager;
  }

  /**
   * Get policy engine
   */
  getPolicyEngine(): PolicyEngine {
    return this.policyEngine;
  }

  /**
   * Register a policy
   */
  registerPolicy(policy: Policy): void {
    this.policyEngine.registerPolicy(policy);
  }

  /**
   * Register multiple policies
   */
  registerPolicies(policies: Policy[]): void {
    this.policyEngine.registerPolicies(policies);
  }
}