// Prisma adapter exports
export {
  createPrismaAdapter,
  applyPrismaAdapter,
  createTenantPrismaClient,
  type PrismaAdapterOptions
} from './prisma';

// Sequelize adapter exports
export {
  applySequelizeAdapter,
  createSequelizePlugin,
  TenantModel,
  type SequelizeAdapterOptions
} from './sequelize';

// Mongoose adapter exports
export {
  mongooseTenantPlugin,
  createTenantModel,
  withTenantContext,
  createTenantConnection,
  type MongooseAdapterOptions
} from './mongoose';