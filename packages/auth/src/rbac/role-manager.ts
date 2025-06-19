import { RoleDefinition } from '@lanemc/multitenancy-core';

export interface RoleManagerOptions {
  roles?: RoleDefinition[];
  permissionHierarchy?: Record<string, string[]>;
}

export class RoleManager {
  private roles: Map<string, RoleDefinition> = new Map();
  private permissionHierarchy: Map<string, Set<string>> = new Map();

  constructor(options: RoleManagerOptions = {}) {
    if (options.roles) {
      this.registerRoles(options.roles);
    }
    if (options.permissionHierarchy) {
      this.setPermissionHierarchy(options.permissionHierarchy);
    }
    
    // Register default roles
    this.registerDefaultRoles();
  }

  /**
   * Register default roles common to most SaaS applications
   */
  private registerDefaultRoles() {
    const defaultRoles: RoleDefinition[] = [
      {
        name: 'admin',
        permissions: [
          'tenant:manage',
          'users:read',
          'users:write',
          'users:delete',
          'users:invite',
          'roles:manage',
          'billing:manage',
          'settings:manage',
          'data:read',
          'data:write',
          'data:delete'
        ],
        description: 'Full administrative access within the tenant'
      },
      {
        name: 'member',
        permissions: [
          'users:read',
          'data:read',
          'data:write',
          'settings:read'
        ],
        description: 'Standard member access'
      },
      {
        name: 'viewer',
        permissions: [
          'users:read',
          'data:read',
          'settings:read'
        ],
        description: 'Read-only access'
      }
    ];

    defaultRoles.forEach(role => {
      if (!this.roles.has(role.name)) {
        this.registerRole(role);
      }
    });
  }

  /**
   * Register a new role
   */
  registerRole(role: RoleDefinition): void {
    this.roles.set(role.name, role);
  }

  /**
   * Register multiple roles
   */
  registerRoles(roles: RoleDefinition[]): void {
    roles.forEach(role => this.registerRole(role));
  }

  /**
   * Get a role definition
   */
  getRole(name: string): RoleDefinition | undefined {
    return this.roles.get(name);
  }

  /**
   * Get all registered roles
   */
  getAllRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }

  /**
   * Check if a role exists
   */
  hasRole(name: string): boolean {
    return this.roles.has(name);
  }

  /**
   * Get permissions for a role
   */
  getRolePermissions(roleName: string): string[] {
    const role = this.roles.get(roleName);
    if (!role) return [];

    // Expand permissions based on hierarchy
    const expandedPermissions = new Set<string>();
    
    role.permissions.forEach(permission => {
      expandedPermissions.add(permission);
      
      // Add implied permissions from hierarchy
      const implied = this.permissionHierarchy.get(permission);
      if (implied) {
        implied.forEach(p => expandedPermissions.add(p));
      }
    });

    return Array.from(expandedPermissions);
  }

  /**
   * Get permissions for multiple roles
   */
  getPermissionsForRoles(roleNames: string[]): string[] {
    const allPermissions = new Set<string>();
    
    roleNames.forEach(roleName => {
      const permissions = this.getRolePermissions(roleName);
      permissions.forEach(p => allPermissions.add(p));
    });

    return Array.from(allPermissions);
  }

  /**
   * Check if a role has a specific permission
   */
  roleHasPermission(roleName: string, permission: string): boolean {
    const permissions = this.getRolePermissions(roleName);
    return permissions.includes(permission);
  }

  /**
   * Check if any of the roles have a specific permission
   */
  rolesHavePermission(roleNames: string[], permission: string): boolean {
    return roleNames.some(roleName => this.roleHasPermission(roleName, permission));
  }

  /**
   * Set permission hierarchy (e.g., 'users:manage' implies 'users:read', 'users:write')
   */
  setPermissionHierarchy(hierarchy: Record<string, string[]>): void {
    Object.entries(hierarchy).forEach(([parent, children]) => {
      this.permissionHierarchy.set(parent, new Set(children));
    });
  }

  /**
   * Add a permission implication
   */
  addPermissionImplication(parent: string, children: string[]): void {
    const existing = this.permissionHierarchy.get(parent) || new Set();
    children.forEach(child => existing.add(child));
    this.permissionHierarchy.set(parent, existing);
  }

  /**
   * Update a role's permissions
   */
  updateRolePermissions(roleName: string, permissions: string[]): void {
    const role = this.roles.get(roleName);
    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }
    
    role.permissions = permissions;
  }

  /**
   * Add permissions to a role
   */
  addPermissionsToRole(roleName: string, permissions: string[]): void {
    const role = this.roles.get(roleName);
    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }
    
    const permissionSet = new Set(role.permissions);
    permissions.forEach(p => permissionSet.add(p));
    role.permissions = Array.from(permissionSet);
  }

  /**
   * Remove permissions from a role
   */
  removePermissionsFromRole(roleName: string, permissions: string[]): void {
    const role = this.roles.get(roleName);
    if (!role) {
      throw new Error(`Role not found: ${roleName}`);
    }
    
    const permissionSet = new Set(role.permissions);
    permissions.forEach(p => permissionSet.delete(p));
    role.permissions = Array.from(permissionSet);
  }

  /**
   * Delete a role
   */
  deleteRole(roleName: string): void {
    this.roles.delete(roleName);
  }

  /**
   * Clone a role with a new name
   */
  cloneRole(sourceName: string, targetName: string, description?: string): RoleDefinition {
    const sourceRole = this.roles.get(sourceName);
    if (!sourceRole) {
      throw new Error(`Source role not found: ${sourceName}`);
    }

    const newRole: RoleDefinition = {
      name: targetName,
      permissions: [...sourceRole.permissions],
      description: description || `Cloned from ${sourceName}`
    };

    this.registerRole(newRole);
    return newRole;
  }
}