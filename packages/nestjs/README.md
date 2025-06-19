# @lanemc/multitenancy-nestjs

NestJS module and middleware for the Multi-Tenant SaaS Toolkit.

## Installation

```bash
npm install @lanemc/multitenancy-nestjs @lanemc/multitenancy-core
```

## Usage

### Module Setup

```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MultitenancyModule, TenantMiddleware } from '@lanemc/multitenancy-nestjs';

@Module({
  imports: [
    MultitenancyModule.forRoot({
      resolution: {
        type: 'subdomain', // or 'header', 'token', 'custom'
        // headerName: 'x-tenant-id', // for header-based resolution
        // tokenClaim: 'tenant_id', // for token-based resolution
        // customResolver: async (request) => { ... } // for custom resolution
      },
      dataStore: myDataStore, // Your implementation of TenantDataStore
      onError: (error, request, response) => {
        // Custom error handling
        response.status(500).json({ error: error.message });
      },
      allowNoTenant: false, // Whether to allow requests without tenant context
      global: true // Make interceptor global (default: true)
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*'); // Apply to all routes
  }
}
```

### Async Module Setup

```typescript
import { Module } from '@nestjs/common';
import { MultitenancyModule } from '@lanemc/multitenancy-nestjs';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MultitenancyModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        resolution: {
          type: configService.get('TENANT_RESOLUTION_TYPE'),
          headerName: configService.get('TENANT_HEADER_NAME'),
        },
        dataStore: myDataStore,
        allowNoTenant: false,
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## Guards and Decorators

### Protecting Routes with Guards

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { 
  TenantAuthGuard, 
  RolesGuard, 
  PermissionsGuard,
  Roles,
  Permissions,
  Tenant,
  TenantUser,
  TenantId
} from '@lanemc/multitenancy-nestjs';

@Controller('api')
@UseGuards(TenantAuthGuard) // Require authenticated user in tenant context
export class ApiController {
  
  @Get('profile')
  getProfile(@TenantUser() user: any, @Tenant() tenant: any) {
    return { user, tenant };
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super-admin')
  getAdminData(@TenantId() tenantId: string) {
    // Only accessible by admin or super-admin roles
    return { tenantId, data: 'admin data' };
  }

  @Get('documents')
  @UseGuards(PermissionsGuard)
  @Permissions('documents.read')
  getDocuments() {
    // Only accessible with documents.read permission
    return { documents: [] };
  }
}
```

### Using Multiple Guards

```typescript
@Controller('api')
@UseGuards(TenantAuthGuard, RolesGuard) // Apply to all routes in controller
@Roles('user') // Minimum role required for all routes
export class SecureApiController {
  
  @Post('documents')
  @Permissions('documents.create')
  @UseGuards(PermissionsGuard) // Additional guard for this route
  createDocument(@Body() data: any, @TenantId() tenantId: string) {
    // Requires 'user' role AND 'documents.create' permission
  }
}
```

## Tenant Resolution Strategies

### Subdomain-based
```typescript
// Resolves tenant from subdomain (e.g., acme.app.com -> tenant: acme)
resolution: { type: 'subdomain' }
```

### Header-based
```typescript
// Resolves tenant from request header
resolution: { 
  type: 'header',
  headerName: 'x-tenant-id' // default
}
```

### Token-based
```typescript
// Resolves tenant from JWT token claim
resolution: { 
  type: 'token',
  tokenClaim: 'tenant_id' // default
}
```

### Custom
```typescript
// Custom resolution logic
resolution: { 
  type: 'custom',
  customResolver: async (request) => {
    // Your custom logic
    return tenantId;
  }
}
```

## Context Access in Services

```typescript
import { Injectable } from '@nestjs/common';
import { tenantContext } from '@lanemc/multitenancy-core';

@Injectable()
export class DataService {
  async getData() {
    // Access tenant context anywhere in your application
    const tenant = tenantContext.getCurrentTenant();
    const user = tenantContext.getCurrentUser();
    const hasRole = tenantContext.hasRole('admin');
    const hasPermission = tenantContext.hasPermission('data.read');
    
    // Your business logic
    return { 
      tenantId: tenant?.id,
      userId: user?.id,
      isAdmin: hasRole
    };
  }
}
```

## Error Handling

Customize error responses in your exception filters:

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';

@Catch(ForbiddenException)
export class TenantForbiddenFilter implements ExceptionFilter {
  catch(exception: ForbiddenException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    response.status(status).json({
      statusCode: status,
      message: 'Access denied',
      error: 'Forbidden',
      details: {
        required: exceptionResponse.required,
        current: exceptionResponse.current,
      },
    });
  }
}
```

## TypeScript Support

The module extends NestJS with full TypeScript support:

```typescript
// Decorators with type inference
@Get('data')
getData(
  @Tenant() tenant: Tenant,
  @TenantUser() user: User,
  @TenantId() tenantId: string
) {
  // Full type safety
}
```

## Best Practices

1. **Apply middleware globally**: Configure the tenant middleware in your main module to ensure it runs for all routes.

2. **Use guards appropriately**: 
   - `TenantAuthGuard` for routes requiring authentication
   - `RolesGuard` for role-based access
   - `PermissionsGuard` for fine-grained permissions

3. **Leverage decorators**: Use parameter decorators to access tenant context in your controllers instead of accessing the request object directly.

4. **Service layer access**: Use `tenantContext` from the core package to access tenant information in your services and repositories.

5. **Error handling**: Implement custom exception filters to provide consistent error responses for tenant-related errors.