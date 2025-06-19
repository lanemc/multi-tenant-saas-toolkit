import { tenantContext } from '@thesaasdevkit/multitenancy-core';
import { Model, ModelStatic, FindOptions, CreateOptions, UpdateOptions, DestroyOptions, Sequelize, ModelAttributes, ModelOptions, BulkCreateOptions, Attributes, WhereOptions } from 'sequelize';

export interface SequelizeAdapterOptions {
  tenantField?: string;
  models?: string[];
  excludeModels?: string[];
}

/**
 * Apply tenant scoping to a Sequelize model
 */
export function applySequelizeAdapter<T extends Model>(
  model: ModelStatic<T>,
  options: SequelizeAdapterOptions = {}
): void {
  const { tenantField = 'tenantId' } = options;

  // Add hooks for automatic tenant filtering
  model.addHook('beforeFind', (options: FindOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    
    // Handle complex where conditions
    const whereOptions = options.where as Record<string | symbol, unknown>;
    if (whereOptions[Symbol.for('or')] || whereOptions[Symbol.for('and')]) {
      // Wrap existing conditions with tenant filter
      options.where = {
        [Symbol.for('and')]: [
          options.where,
          { [tenantField]: tenantId }
        ]
      };
    } else {
      (options.where as Record<string, unknown>)[tenantField] = tenantId;
    }
  });

  // Add tenant ID to create operations
  model.addHook('beforeCreate', (instance: Model, _options: CreateOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    instance.setDataValue(tenantField, tenantId);
  });

  // Add tenant ID to bulk create operations
  model.addHook('beforeBulkCreate', (instances: T[], _options: BulkCreateOptions<Attributes<T>>) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    if (Array.isArray(instances)) {
      instances.forEach((instance: T) => {
        instance.setDataValue(tenantField as keyof Attributes<T>, tenantId);
      });
    }
  });

  // Add tenant filter to update operations
  model.addHook('beforeUpdate', (_instance: Model, options: UpdateOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    (options.where as Record<string, unknown>)[tenantField] = tenantId;
  });

  // Add tenant filter to bulk update operations
  model.addHook('beforeBulkUpdate', (options: UpdateOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    (options.where as Record<string, unknown>)[tenantField] = tenantId;
  });

  // Add tenant filter to destroy operations
  model.addHook('beforeDestroy', (_instance: Model, options: DestroyOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    (options.where as Record<string, unknown>)[tenantField] = tenantId;
  });

  // Add tenant filter to bulk destroy operations
  model.addHook('beforeBulkDestroy', (options: DestroyOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    (options.where as Record<string, unknown>)[tenantField] = tenantId;
  });

  // Add a default scope for tenant filtering
  model.addScope('tenant', (tenantId?: string) => {
    const contextTenantId = tenantId || tenantContext.getCurrentTenantId();
    if (!contextTenantId) {
      throw new Error('No tenant context available');
    }

    return {
      where: {
        [tenantField]: contextTenantId
      } as WhereOptions<Attributes<T>>
    };
  });
}

/**
 * Create a Sequelize plugin for all models
 */
export function createSequelizePlugin(options: SequelizeAdapterOptions = {}) {
  const { models = [], excludeModels = [] } = options;

  return (sequelize: Sequelize) => {
    // Apply to all models after they are defined
    const originalDefine = sequelize.define.bind(sequelize);
    
    sequelize.define = function<M extends Model>(modelName: string, attributes: ModelAttributes<M>, modelOptions: ModelOptions<M> = {}) {
      const model = originalDefine(modelName, attributes, modelOptions) as ModelStatic<M>;
      
      // Check if this model should have tenant filtering
      const shouldApply = excludeModels.includes(modelName) 
        ? false 
        : models.length === 0 || models.includes(modelName);
      
      if (shouldApply) {
        applySequelizeAdapter(model as ModelStatic<Model>, options);
      }
      
      return model;
    };

    // Apply to already defined models
    Object.values(sequelize.models).forEach((model: ModelStatic<Model>) => {
      const modelName = model.name;
      const shouldApply = excludeModels.includes(modelName) 
        ? false 
        : models.length === 0 || models.includes(modelName);
      
      if (shouldApply) {
        applySequelizeAdapter(model as ModelStatic<Model>, options);
      }
    });
  };
}

/**
 * Base class for tenant-scoped Sequelize models
 */
export class TenantModel extends Model {
  static tenantField = 'tenantId';

  static initTenantModel(attributes: ModelAttributes, options: ModelOptions & { sequelize: Sequelize }) {
    const modelOptions = {
      ...options,
      hooks: {
        ...options.hooks
      }
    };

    const result = this.init(attributes, modelOptions);
    applySequelizeAdapter(this as unknown as ModelStatic<Model>, { tenantField: this.tenantField });
    return result;
  }
}