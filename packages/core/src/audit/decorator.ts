import { AuditLogger } from './audit-logger';
import { AuditActionConfig } from './types';

export function AuditAction(config: AuditActionConfig) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      let result: any;
      let success = true;
      let errorMessage: string | undefined;
      
      try {
        // Call the original method
        result = await originalMethod.apply(this, args);
        return result;
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : String(error);
        throw error; // Re-throw the original error
      } finally {
        // Log the audit event asynchronously
        setImmediate(async () => {
          try {
            const logger = AuditLogger.getInstance();
            
            // Extract resource ID
            let resourceId = 'unknown';
            if (config.getResourceId) {
              try {
                resourceId = config.getResourceId(args);
              } catch (error) {
                console.error('Error in getResourceId:', error);
              }
            }
            
            // Extract metadata
            let metadata: Record<string, any> = {};
            if (config.getMetadata) {
              try {
                metadata = config.getMetadata(args, result);
              } catch (error) {
                console.error('Error in getMetadata:', error);
              }
            }
            
            // Add error information if the method failed
            if (!success && errorMessage) {
              metadata.error = errorMessage;
            }
            
            // Add execution time
            metadata.executionTime = Date.now() - startTime;
            
            await logger.log({
              action: config.action,
              resource: {
                type: config.resourceType,
                id: resourceId
              },
              result: success ? 'success' : 'failure',
              metadata
            });
          } catch (auditError) {
            // Audit logging should never break the application
            console.error('Failed to log audit event in decorator:', auditError);
          }
        });
      }
    };
    
    return descriptor;
  };
}