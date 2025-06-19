import { tenantContext } from '@saaskit/multitenancy-core';

export interface PrismaAdapterOptions {
  tenantField?: string;
  models?: string[];
  excludeModels?: string[];
}

/**
 * Create a Prisma middleware for automatic tenant filtering
 */
export function createPrismaAdapter(options: PrismaAdapterOptions = {}) {
  const { 
    tenantField = 'tenantId',
    models = [],
    excludeModels = []
  } = options;

  return async (params: any, next: (params: any) => Promise<any>) => {
    const tenantId = tenantContext.getCurrentTenantId();

    // Skip if no tenant context
    if (!tenantId) {
      return next(params);
    }

    // Check if this model should be filtered
    const shouldFilter = (model: string) => {
      if (excludeModels.includes(model)) return false;
      if (models.length > 0) return models.includes(model);
      return true; // Filter all models by default
    };

    if (!shouldFilter(params.model)) {
      return next(params);
    }

    // Add tenant filter to queries
    if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      
      // Add tenant filter
      if (params.args.where.AND) {
        params.args.where.AND.push({ [tenantField]: tenantId });
      } else if (params.args.where.OR) {
        params.args.where = {
          AND: [
            { [tenantField]: tenantId },
            { OR: params.args.where.OR }
          ]
        };
      } else {
        params.args.where[tenantField] = tenantId;
      }
    }

    // Add tenant ID to create operations
    if (params.action === 'create') {
      params.args = params.args || {};
      params.args.data = params.args.data || {};
      params.args.data[tenantField] = tenantId;
    }

    // Add tenant ID to createMany operations
    if (params.action === 'createMany') {
      params.args = params.args || {};
      if (Array.isArray(params.args.data)) {
        params.args.data = params.args.data.map((item: any) => ({
          ...item,
          [tenantField]: tenantId
        }));
      } else if (params.args.data) {
        params.args.data[tenantField] = tenantId;
      }
    }

    // Add tenant filter to update operations
    if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      
      if (params.args.where.AND) {
        params.args.where.AND.push({ [tenantField]: tenantId });
      } else {
        params.args.where = {
          AND: [
            params.args.where,
            { [tenantField]: tenantId }
          ]
        };
      }
    }

    // Add tenant ID to upsert operations
    if (params.action === 'upsert') {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      params.args.create = params.args.create || {};
      params.args.update = params.args.update || {};
      
      // Add to where clause
      params.args.where[tenantField] = tenantId;
      
      // Add to create data
      params.args.create[tenantField] = tenantId;
    }

    return next(params);
  };
}

/**
 * Apply the Prisma adapter to a Prisma client instance
 */
export function applyPrismaAdapter(prisma: any, options?: PrismaAdapterOptions) {
  const middleware = createPrismaAdapter(options);
  prisma.$use(middleware);
  return prisma;
}

/**
 * Create a tenant-scoped Prisma client factory
 */
export function createTenantPrismaClient(
  PrismaClient: new (options?: any) => any,
  options?: PrismaAdapterOptions
): new (clientOptions?: any) => any {
  return class TenantPrismaClient extends PrismaClient {
    constructor(clientOptions?: any) {
      super(clientOptions);
      applyPrismaAdapter(this, options);
    }
  };
}