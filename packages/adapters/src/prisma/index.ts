import { tenantContext } from '@thesaasdevkit/multitenancy-core';

export interface PrismaAdapterOptions {
  tenantField?: string;
  models?: string[];
  excludeModels?: string[];
}

export interface PrismaMiddlewareParams {
  model?: string;
  action: string;
  args: Record<string, unknown>;
  dataPath: string[];
  runInTransaction: boolean;
}

export interface PrismaClient {
  $use: (middleware: PrismaMiddleware) => void;
}

export type PrismaMiddleware = (
  params: PrismaMiddlewareParams,
  next: (params: PrismaMiddlewareParams) => Promise<unknown>
) => Promise<unknown>;

export interface PrismaConstructor {
  new (options?: Record<string, unknown>): PrismaClient;
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

  return async (params: PrismaMiddlewareParams, next: (params: PrismaMiddlewareParams) => Promise<unknown>) => {
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

    if (!params.model || !shouldFilter(params.model)) {
      return next(params);
    }

    // Add tenant filter to queries
    if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(params.action)) {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      
      // Add tenant filter
      const whereClause = params.args.where as Record<string, unknown>;
      if (whereClause.AND) {
        (whereClause.AND as Record<string, unknown>[]).push({ [tenantField]: tenantId });
      } else if (whereClause.OR) {
        params.args.where = {
          AND: [
            { [tenantField]: tenantId },
            { OR: whereClause.OR }
          ]
        };
      } else {
        whereClause[tenantField] = tenantId;
      }
    }

    // Add tenant ID to create operations
    if (params.action === 'create') {
      params.args = params.args || {};
      params.args.data = params.args.data || {};
      (params.args.data as Record<string, unknown>)[tenantField] = tenantId;
    }

    // Add tenant ID to createMany operations
    if (params.action === 'createMany') {
      params.args = params.args || {};
      if (Array.isArray(params.args.data)) {
        params.args.data = (params.args.data as Record<string, unknown>[]).map((item: Record<string, unknown>) => ({
          ...item,
          [tenantField]: tenantId
        }));
      } else if (params.args.data) {
        (params.args.data as Record<string, unknown>)[tenantField] = tenantId;
      }
    }

    // Add tenant filter to update operations
    if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      
      const whereClause = params.args.where as Record<string, unknown>;
      if (whereClause.AND) {
        (whereClause.AND as Record<string, unknown>[]).push({ [tenantField]: tenantId });
      } else {
        params.args.where = {
          AND: [
            whereClause,
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
      (params.args.where as Record<string, unknown>)[tenantField] = tenantId;
      
      // Add to create data
      (params.args.create as Record<string, unknown>)[tenantField] = tenantId;
    }

    return next(params);
  };
}

/**
 * Apply the Prisma adapter to a Prisma client instance
 */
export function applyPrismaAdapter(prisma: PrismaClient, options?: PrismaAdapterOptions) {
  const middleware = createPrismaAdapter(options);
  prisma.$use(middleware);
  return prisma;
}

/**
 * Create a tenant-scoped Prisma client factory
 */
export function createTenantPrismaClient(
  PrismaClient: PrismaConstructor,
  options?: PrismaAdapterOptions
): PrismaConstructor {
  return class TenantPrismaClient extends PrismaClient {
    constructor(clientOptions?: Record<string, unknown>) {
      super(clientOptions);
      applyPrismaAdapter(this, options);
    }
  };
}