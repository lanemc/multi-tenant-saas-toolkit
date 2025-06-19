import { TenantContext } from '@saaskit/multitenancy-core';

export type PolicyEffect = 'allow' | 'deny';

export interface PolicyCondition {
  attribute: string;
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'custom';
  value: any;
  customEvaluator?: (context: PolicyContext) => boolean;
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  effect: PolicyEffect;
  actions: string[];
  resources: string[];
  conditions?: PolicyCondition[];
  priority?: number;
}

export interface PolicyContext {
  subject: {
    id: string;
    roles: string[];
    attributes: Record<string, any>;
  };
  action: string;
  resource: {
    type: string;
    id?: string;
    attributes: Record<string, any>;
  };
  environment: {
    tenantId: string;
    timestamp: Date;
    ipAddress?: string;
    attributes: Record<string, any>;
  };
}

export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();

  /**
   * Register a policy
   */
  registerPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Register multiple policies
   */
  registerPolicies(policies: Policy[]): void {
    policies.forEach(policy => this.registerPolicy(policy));
  }

  /**
   * Evaluate policies for a given context
   */
  evaluate(context: PolicyContext): boolean {
    const applicablePolicies = this.getApplicablePolicies(context);
    
    // Sort by priority (higher priority first)
    const sortedPolicies = applicablePolicies.sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );

    // Explicit deny takes precedence
    for (const policy of sortedPolicies) {
      if (policy.effect === 'deny' && this.evaluateConditions(policy, context)) {
        return false;
      }
    }

    // Check for explicit allow
    for (const policy of sortedPolicies) {
      if (policy.effect === 'allow' && this.evaluateConditions(policy, context)) {
        return true;
      }
    }

    // Default deny
    return false;
  }

  /**
   * Get policies applicable to a context
   */
  private getApplicablePolicies(context: PolicyContext): Policy[] {
    return Array.from(this.policies.values()).filter(policy => {
      // Check if action matches
      const actionMatches = policy.actions.some(action => 
        this.matchesPattern(context.action, action)
      );

      // Check if resource matches
      const resourceMatches = policy.resources.some(resource => 
        this.matchesPattern(context.resource.type, resource)
      );

      return actionMatches && resourceMatches;
    });
  }

  /**
   * Evaluate conditions for a policy
   */
  private evaluateConditions(policy: Policy, context: PolicyContext): boolean {
    if (!policy.conditions || policy.conditions.length === 0) {
      return true;
    }

    return policy.conditions.every(condition => 
      this.evaluateCondition(condition, context)
    );
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    const value = this.getAttributeValue(condition.attribute, context);

    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      
      case 'neq':
        return value !== condition.value;
      
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      
      case 'gt':
        return value > condition.value;
      
      case 'gte':
        return value >= condition.value;
      
      case 'lt':
        return value < condition.value;
      
      case 'lte':
        return value <= condition.value;
      
      case 'contains':
        return Array.isArray(value) && value.includes(condition.value);
      
      case 'custom':
        return condition.customEvaluator ? condition.customEvaluator(context) : false;
      
      default:
        return false;
    }
  }

  /**
   * Get attribute value from context
   */
  private getAttributeValue(attribute: string, context: PolicyContext): any {
    const path = attribute.split('.');
    let value: any = context;

    for (const segment of path) {
      if (value && typeof value === 'object' && segment in value) {
        value = value[segment];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Check if a string matches a pattern (supports wildcards)
   */
  private matchesPattern(str: string, pattern: string): boolean {
    if (pattern === '*') return true;
    
    // Convert pattern to regex
    const regexPattern = pattern
      .split('*')
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(str);
  }

  /**
   * Create a policy context from tenant context
   */
  static createContextFromTenant(
    tenantContext: TenantContext,
    action: string,
    resource: { type: string; id?: string; attributes?: Record<string, any> }
  ): PolicyContext {
    return {
      subject: {
        id: tenantContext.user?.id || 'anonymous',
        roles: tenantContext.roles || [],
        attributes: {
          ...tenantContext.user?.metadata,
          email: tenantContext.user?.email
        }
      },
      action,
      resource: {
        type: resource.type,
        id: resource.id,
        attributes: resource.attributes || {}
      },
      environment: {
        tenantId: tenantContext.tenant.id,
        timestamp: new Date(),
        attributes: {}
      }
    };
  }

  /**
   * Common policy templates
   */
  static createOwnershipPolicy(resourceType: string): Policy {
    return {
      id: `${resourceType}-ownership`,
      name: `${resourceType} Ownership Policy`,
      description: `Allow users to manage their own ${resourceType}s`,
      effect: 'allow',
      actions: ['read', 'write', 'delete'],
      resources: [resourceType],
      conditions: [
        {
          attribute: 'resource.attributes.ownerId',
          operator: 'eq',
          value: null, // Will be compared against subject.id at runtime
          customEvaluator: (context) => 
            context.resource.attributes.ownerId === context.subject.id
        }
      ]
    };
  }

  static createRolePolicy(role: string, actions: string[], resources: string[]): Policy {
    return {
      id: `role-${role}-policy`,
      name: `${role} Role Policy`,
      effect: 'allow',
      actions,
      resources,
      conditions: [
        {
          attribute: 'subject.roles',
          operator: 'contains',
          value: role
        }
      ]
    };
  }

  static createTimeBasedPolicy(
    id: string,
    name: string,
    actions: string[],
    resources: string[],
    startTime: Date,
    endTime: Date
  ): Policy {
    return {
      id,
      name,
      effect: 'allow',
      actions,
      resources,
      conditions: [
        {
          attribute: 'environment.timestamp',
          operator: 'custom',
          value: null,
          customEvaluator: (context) => {
            const now = context.environment.timestamp;
            return now >= startTime && now <= endTime;
          }
        }
      ]
    };
  }
}