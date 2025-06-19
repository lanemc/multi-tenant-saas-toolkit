import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MultitenancyModuleOptions, MultitenancyModuleAsyncOptions, MultitenancyOptionsFactory } from './interfaces';
import { TenantMiddleware } from './middleware/tenant.middleware';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor';
import { MULTITENANCY_OPTIONS } from './constants';

@Global()
@Module({})
export class MultitenancyModule {
  static forRoot(options: MultitenancyModuleOptions): DynamicModule {
    const providers: Provider[] = [
      {
        provide: MULTITENANCY_OPTIONS,
        useValue: options,
      },
      TenantMiddleware,
    ];

    if (options.global !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: TenantContextInterceptor,
      });
    }

    return {
      module: MultitenancyModule,
      providers,
      exports: [MULTITENANCY_OPTIONS],
    };
  }

  static forRootAsync(options: MultitenancyModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [
      ...this.createAsyncProviders(options),
      TenantMiddleware,
    ];

    if (options.global !== false) {
      providers.push({
        provide: APP_INTERCEPTOR,
        useClass: TenantContextInterceptor,
      });
    }

    return {
      module: MultitenancyModule,
      imports: options.imports || [],
      providers,
      exports: [MULTITENANCY_OPTIONS],
    };
  }

  private static createAsyncProviders(options: MultitenancyModuleAsyncOptions): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    return [
      this.createAsyncOptionsProvider(options),
      {
        provide: options.useClass!,
        useClass: options.useClass!,
      },
    ];
  }

  private static createAsyncOptionsProvider(options: MultitenancyModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: MULTITENANCY_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: MULTITENANCY_OPTIONS,
      useFactory: async (optionsFactory: MultitenancyOptionsFactory) =>
        await optionsFactory.createMultitenancyOptions(),
      inject: [options.useExisting || options.useClass!],
    };
  }
}