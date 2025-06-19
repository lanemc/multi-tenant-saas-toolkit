import { ModuleMetadata, Type } from '@nestjs/common';
import { TenantMiddlewareOptions } from '@thesaasdevkit/multitenancy-core';

export interface MultitenancyModuleOptions extends TenantMiddlewareOptions {
  global?: boolean;
}

export interface MultitenancyOptionsFactory {
  createMultitenancyOptions(): Promise<MultitenancyModuleOptions> | MultitenancyModuleOptions;
}

export interface MultitenancyModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  global?: boolean;
  useExisting?: Type<MultitenancyOptionsFactory>;
  useClass?: Type<MultitenancyOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<MultitenancyModuleOptions> | MultitenancyModuleOptions;
  inject?: any[];
}