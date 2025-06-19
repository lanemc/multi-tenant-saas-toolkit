import { tenantContext } from '@saaskit/multitenancy-core';
import type { Schema, Model, Document, Query, Aggregate, Types } from 'mongoose';

export interface MongooseAdapterOptions {
  tenantField?: string;
  discriminatorField?: string;
  useDiscriminator?: boolean;
}

/**
 * Mongoose plugin for automatic tenant filtering
 */
export function mongooseTenantPlugin(schema: Schema, options: MongooseAdapterOptions = {}) {
  const { 
    tenantField = 'tenantId'
  } = options;

  // Add tenant field to schema if not exists
  if (!schema.paths[tenantField]) {
    schema.add({
      [tenantField]: {
        type: Schema.Types.ObjectId,
        required: true,
        index: true
      }
    });
  }

  // Pre hooks for find operations
  const findHooks = [
    'find',
    'findOne',
    'findOneAndDelete',
    'findOneAndRemove',
    'findOneAndUpdate',
    'findOneAndReplace',
    'count',
    'countDocuments',
    'distinct'
  ];

  findHooks.forEach(method => {
    schema.pre(method as any, function(this: Query<any, any>) {
      const tenantId = tenantContext.getCurrentTenantId();
      if (!tenantId) return;

      // Add tenant filter to query
      const conditions = this.getQuery();
      if (!conditions[tenantField]) {
        conditions[tenantField] = new Types.ObjectId(tenantId);
      }
    });
  });

  // Pre hook for aggregate
  schema.pre('aggregate', function(this: Aggregate<any>) {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    // Add tenant filter as first stage in pipeline
    this.pipeline().unshift({
      $match: { [tenantField]: new Types.ObjectId(tenantId) }
    });
  });

  // Pre hook for save (create/update)
  schema.pre('save', function(this: Document) {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    // Set tenant ID if not already set
    if (!this.get(tenantField)) {
      this.set(tenantField, new Types.ObjectId(tenantId));
    }
  });

  // Pre hook for insertMany
  schema.pre('insertMany', function(this: Model<any>, next: () => void, docs: any[]) {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) {
      next();
      return;
    }

    // Add tenant ID to all documents
    const tenantObjectId = new Types.ObjectId(tenantId);
    docs.forEach(doc => {
      if (!doc[tenantField]) {
        doc[tenantField] = tenantObjectId;
      }
    });
    
    next();
  });

  // Pre hooks for update operations
  const updateHooks = [
    'updateOne',
    'updateMany',
    'replaceOne'
  ];

  updateHooks.forEach(method => {
    schema.pre(method as any, function(this: Query<any, any>) {
      const tenantId = tenantContext.getCurrentTenantId();
      if (!tenantId) return;

      // Add tenant filter to query conditions
      const conditions = this.getQuery();
      if (!conditions[tenantField]) {
        conditions[tenantField] = new Types.ObjectId(tenantId);
      }

      // Add tenant ID to update data for upserts
      const update = this.getUpdate();
      if (update && (update as any).upsert) {
        if ((update as any).$setOnInsert) {
          (update as any).$setOnInsert[tenantField] = new Types.ObjectId(tenantId);
        } else {
          (update as any).$setOnInsert = {
            [tenantField]: new Types.ObjectId(tenantId)
          };
        }
      }
    });
  });

  // Pre hooks for delete operations
  const deleteHooks = ['deleteOne', 'deleteMany'];

  deleteHooks.forEach(method => {
    schema.pre(method as any, function(this: Query<any, any>) {
      const tenantId = tenantContext.getCurrentTenantId();
      if (!tenantId) return;

      // Add tenant filter to query conditions
      const conditions = this.getQuery();
      if (!conditions[tenantField]) {
        conditions[tenantField] = new Types.ObjectId(tenantId);
      }
    });
  });

  // Add instance methods
  schema.methods.isOwnedByTenant = function(tenantId: string) {
    return this.get(tenantField)?.toString() === tenantId;
  };

  // Add static methods
  schema.statics.forTenant = function(tenantId: string) {
    return this.find({ [tenantField]: new Types.ObjectId(tenantId) });
  };

  schema.statics.countForTenant = function(tenantId: string) {
    return this.countDocuments({ [tenantField]: new Types.ObjectId(tenantId) });
  };

  // Add virtual for tenant population if needed
  schema.virtual('tenant', {
    ref: 'Tenant',
    localField: tenantField,
    foreignField: '_id',
    justOne: true
  });
}

/**
 * Create a tenant-specific model using discriminators
 */
export function createTenantModel<T extends Document>(
  baseModel: Model<T>,
  tenantId: string,
  discriminatorValue?: string
): Model<T> {
  const value = discriminatorValue || tenantId;
  
  // Check if discriminator already exists
  if (baseModel.discriminators && baseModel.discriminators[value]) {
    return baseModel.discriminators[value] as Model<T>;
  }

  // Create new discriminator
  return baseModel.discriminator(value, new Schema({}));
}

/**
 * Helper to run a function with a specific tenant context
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  // This would typically integrate with the core context manager
  // For now, we'll just execute the function
  // In a real implementation, this would set up the AsyncLocalStorage context
  return fn();
}

/**
 * Create a Mongoose connection with tenant plugin applied to all schemas
 */
export function createTenantConnection(
  mongoose: any,
  uri: string,
  options: any = {},
  pluginOptions?: MongooseAdapterOptions
) {
  const connection = mongoose.createConnection(uri, options);

  // Apply plugin to all schemas registered on this connection
  connection.plugin((schema: Schema) => {
    mongooseTenantPlugin(schema, pluginOptions);
  });

  return connection;
}