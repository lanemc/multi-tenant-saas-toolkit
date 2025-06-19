import { AsyncLocalStorage } from 'async_hooks';

import { TenantContext, Tenant, User } from '../types';

export class TenantContextManager {
  private static instance: TenantContextManager;
  private storage: AsyncLocalStorage<TenantContext>;

  private constructor() {
    this.storage = new AsyncLocalStorage<TenantContext>();
  }

  public static getInstance(): TenantContextManager {
    if (!TenantContextManager.instance) {
      TenantContextManager.instance = new TenantContextManager();
    }
    return TenantContextManager.instance;
  }

  /**
   * Run a function within a tenant context
   */
  public run<T>(context: TenantContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  /**
   * Run an async function within a tenant context
   */
  public async runAsync<T>(context: TenantContext, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(context, fn);
  }

  /**
   * Get the current tenant context
   */
  public getContext(): TenantContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Get the current tenant
   */
  public getCurrentTenant(): Tenant | undefined {
    return this.storage.getStore()?.tenant;
  }

  /**
   * Get the current tenant ID
   */
  public getCurrentTenantId(): string | undefined {
    return this.storage.getStore()?.tenant?.id;
  }

  /**
   * Get the current user
   */
  public getCurrentUser(): User | undefined {
    return this.storage.getStore()?.user;
  }

  /**
   * Get the current user's roles
   */
  public getCurrentRoles(): string[] {
    return this.storage.getStore()?.roles || [];
  }

  /**
   * Check if the current user has a specific role
   */
  public hasRole(role: string): boolean {
    const roles = this.getCurrentRoles();
    return roles.includes(role);
  }

  /**
   * Check if the current user has any of the specified roles
   */
  public hasAnyRole(roles: string[]): boolean {
    const currentRoles = this.getCurrentRoles();
    return roles.some(role => currentRoles.includes(role));
  }

  /**
   * Check if the current user has all of the specified roles
   */
  public hasAllRoles(roles: string[]): boolean {
    const currentRoles = this.getCurrentRoles();
    return roles.every(role => currentRoles.includes(role));
  }

  /**
   * Get the current user's permissions
   */
  public getCurrentPermissions(): string[] {
    return this.storage.getStore()?.permissions || [];
  }

  /**
   * Check if the current user has a specific permission
   */
  public hasPermission(permission: string): boolean {
    const permissions = this.getCurrentPermissions();
    return permissions.includes(permission);
  }

  /**
   * Execute a function with a specific tenant context (for admin operations)
   */
  public async runWithTenant<T>(tenantId: string, dataStore: any, fn: () => Promise<T>): Promise<T> {
    const tenant = await dataStore.getTenantById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    const context: TenantContext = { tenant };
    return this.runAsync(context, fn);
  }

  /**
   * Clear the current context (useful for testing)
   */
  public clear(): void {
    // AsyncLocalStorage automatically clears when the async context ends
    // This method is mainly for documentation and potential future use
  }
}

// Export singleton instance
export const tenantContext = TenantContextManager.getInstance();