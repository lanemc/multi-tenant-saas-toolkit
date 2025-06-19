import { TenantMiddlewareOptions } from '@lanemc/multitenancy-core';
import { ModuleMetadata, Type } from '@nestjs/common';

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