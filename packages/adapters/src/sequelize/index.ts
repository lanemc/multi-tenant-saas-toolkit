import { tenantContext } from '@saaskit/multitenancy-core';
import type { Model, ModelStatic, FindOptions, CreateOptions, UpdateOptions, DestroyOptions } from 'sequelize';

export interface SequelizeAdapterOptions {
  tenantField?: string;
  models?: string[];
  excludeModels?: string[];
}

/**
 * Apply tenant scoping to a Sequelize model
 */
export function applySequelizeAdapter(
  model: ModelStatic<any>,
  options: SequelizeAdapterOptions = {}
): void {
  const { tenantField = 'tenantId' } = options;

  // Add hooks for automatic tenant filtering
  model.addHook('beforeFind', (options: FindOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    
    // Handle complex where conditions
    if ((options.where as any)[Symbol.for('or')] || (options.where as any)[Symbol.for('and')]) {
      // Wrap existing conditions with tenant filter
      options.where = {
        [Symbol.for('and')]: [
          options.where,
          { [tenantField]: tenantId }
        ]
      };
    } else {
      (options.where as any)[tenantField] = tenantId;
    }
  });

  // Add tenant ID to create operations
  model.addHook('beforeCreate', (instance: Model, _options: CreateOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    instance.setDataValue(tenantField, tenantId);
  });

  // Add tenant ID to bulk create operations
  model.addHook('beforeBulkCreate', (options: any) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    if (Array.isArray(options.records)) {
      options.records = options.records.map((record: any) => ({
        ...record,
        [tenantField]: tenantId
      }));
    }
  });

  // Add tenant filter to update operations
  model.addHook('beforeUpdate', (instance: Model, options: UpdateOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    (options.where as any)[tenantField] = tenantId;
  });

  // Add tenant filter to bulk update operations
  model.addHook('beforeBulkUpdate', (options: UpdateOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    (options.where as any)[tenantField] = tenantId;
  });

  // Add tenant filter to destroy operations
  model.addHook('beforeDestroy', (instance: Model, options: DestroyOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    (options.where as any)[tenantField] = tenantId;
  });

  // Add tenant filter to bulk destroy operations
  model.addHook('beforeBulkDestroy', (options: DestroyOptions) => {
    const tenantId = tenantContext.getCurrentTenantId();
    if (!tenantId) return;

    options.where = options.where || {};
    (options.where as any)[tenantField] = tenantId;
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
      }
    };
  });
}

/**
 * Create a Sequelize plugin for all models
 */
export function createSequelizePlugin(options: SequelizeAdapterOptions = {}) {
  const { models = [], excludeModels = [] } = options;

  return (sequelize: any) => {
    // Apply to all models after they are defined
    const originalDefine = sequelize.define.bind(sequelize);
    
    sequelize.define = function(modelName: string, attributes: any, modelOptions: any = {}) {
      const model = originalDefine(modelName, attributes, modelOptions);
      
      // Check if this model should have tenant filtering
      const shouldApply = excludeModels.includes(modelName) 
        ? false 
        : models.length === 0 || models.includes(modelName);
      
      if (shouldApply) {
        applySequelizeAdapter(model, options);
      }
      
      return model;
    };

    // Apply to already defined models
    Object.values(sequelize.models).forEach((model: any) => {
      const modelName = model.name;
      const shouldApply = excludeModels.includes(modelName) 
        ? false 
        : models.length === 0 || models.includes(modelName);
      
      if (shouldApply) {
        applySequelizeAdapter(model, options);
      }
    });
  };
}

/**
 * Base class for tenant-scoped Sequelize models
 */
export class TenantModel extends Model {
  static tenantField = 'tenantId';

  static initTenantModel(attributes: any, options: any) {
    const modelOptions = {
      ...options,
      hooks: {
        ...options.hooks,
        afterDefine: (model: ModelStatic<any>) => {
          applySequelizeAdapter(model, { tenantField: this.tenantField });
          if (options.hooks?.afterDefine) {
            options.hooks.afterDefine(model);
          }
        }
      }
    };

    return this.init(attributes, modelOptions);
  }
}