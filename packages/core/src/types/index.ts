export interface Tenant {
  id: string;
  name: string;
  subdomain?: string;
  domain?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'inactive' | 'suspended';
}

export interface User {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface TenantUser {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  joinedAt: Date;
}

export interface TenantContext {
  tenant: Tenant;
  user?: User;
  roles?: string[];
  permissions?: string[];
}

export interface TenantResolutionOptions {
  type: 'subdomain' | 'header' | 'token' | 'custom';
  headerName?: string;
  tokenClaim?: string;
  customResolver?: (req: any) => Promise<string | null>;
}

export interface TenantMiddlewareOptions {
  resolution: TenantResolutionOptions;
  dataStore: TenantDataStore;
  onError?: (error: Error, req: any, res: any) => void;
  allowNoTenant?: boolean;
}

export interface TenantDataStore {
  getTenantById(id: string): Promise<Tenant | null>;
  getTenantBySubdomain(subdomain: string): Promise<Tenant | null>;
  getTenantByDomain(domain: string): Promise<Tenant | null>;
  createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tenant>;
  updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant>;
  deleteTenant(id: string): Promise<void>;
  getUserTenant(userId: string, tenantId: string): Promise<TenantUser | null>;
}

export interface AuthorizationRule {
  action: string;
  resource?: string;
  condition?: (context: TenantContext, resource?: any) => boolean | Promise<boolean>;
}

export interface RoleDefinition {
  name: string;
  permissions: string[];
  description?: string;
}