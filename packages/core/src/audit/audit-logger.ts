import { v4 as uuidv4 } from 'uuid';

import { tenantContext } from '../context/tenant-context';

import { AuditEvent, AuditLogInput, AuditLoggerConfig, AuditStore, AuditQueryFilter } from './types';

export class AuditLogger {
  private static instance: AuditLogger;
  private store?: AuditStore;
  private sensitiveFields: string[];

  private constructor(config: AuditLoggerConfig = {}) {
    this.store = config.store;
    this.sensitiveFields = config.sensitiveFields || [
      'password', 'secret', 'token', 'key', 'apiKey', 'credentials', 'auth', 'authorization'
    ];
  }

  static getInstance(config?: AuditLoggerConfig): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger(config);
    } else if (config) {
      throw new Error('AuditLogger has already been initialized. Configuration can only be set on first getInstance call.');
    }
    return AuditLogger.instance;
  }

  async log(input: AuditLogInput): Promise<void> {
    try {
      const context = tenantContext.getContext();
      const event: AuditEvent = {
        id: uuidv4(),
        timestamp: new Date(),
        tenant: context?.tenant?.id,
        actor: this.getActor(context),
        action: input.action,
        resource: input.resource,
        result: input.result,
        metadata: this.sanitizeMetadata({
          ...input.metadata,
          ...this.extractRequestInfo(input.request)
        })
      };

      if (!this.store) {
        console.warn('AuditLogger: No store configured, audit event not persisted');
        return;
      }

      await this.store.store(event);
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit failures shouldn't break the application
    }
  }

  async query(filter: AuditQueryFilter): Promise<AuditEvent[]> {
    if (!this.store) {
      throw new Error('No audit store configured');
    }

    // Apply tenant context filter if available and no explicit tenant filter
    const context = tenantContext.getContext();
    const finalFilter = { ...filter };
    if (context?.tenant?.id && !finalFilter.tenant) {
      finalFilter.tenant = context.tenant.id;
    }

    return this.store.query(finalFilter);
  }

  async count(filter: AuditQueryFilter): Promise<number> {
    if (!this.store) {
      throw new Error('No audit store configured');
    }

    // Apply tenant context filter if available and no explicit tenant filter
    const context = tenantContext.getContext();
    const finalFilter = { ...filter };
    if (context?.tenant?.id && !finalFilter.tenant) {
      finalFilter.tenant = context.tenant.id;
    }

    return this.store.count(finalFilter);
  }

  private getActor(context: any): { id: string; type: 'user' | 'system' | 'anonymous' } {
    if (context?.user?.id) {
      return { id: context.user.id, type: 'user' };
    }
    
    // Check if this is a system operation (could be determined by other context)
    if (context?.isSystem) {
      return { id: 'system', type: 'system' };
    }

    return { id: 'anonymous', type: 'anonymous' };
  }

  private extractRequestInfo(request: any): Record<string, any> {
    if (!request) {
      return {};
    }

    const info: Record<string, any> = {};

    // Extract IP address
    if (request.ip) {
      info.ip = request.ip;
    }

    // Check for forwarded IP
    if (request.get) {
      const forwardedFor = request.get('x-forwarded-for');
      if (forwardedFor) {
        info.ip = forwardedFor.split(',')[0].trim();
      }

      // Extract user agent
      const userAgent = request.get('user-agent');
      if (userAgent) {
        info.userAgent = userAgent;
      }
    }

    return info;
  }

  private sanitizeMetadata(metadata: Record<string, any> = {}): Record<string, any> {
    try {
      return this.sanitizeObject(metadata);
    } catch (error) {
      // Handle circular references or other serialization issues
      try {
        return JSON.parse(JSON.stringify(metadata));
      } catch {
        return { error: 'Unable to serialize metadata' };
      }
    }
  }

  private sanitizeObject(obj: any, visited = new WeakSet()): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    // Handle circular references
    if (visited.has(obj)) {
      return '[Circular Reference]';
    }
    visited.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, visited));
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, visited);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.sensitiveFields.some(sensitive => 
      lowerFieldName.includes(sensitive.toLowerCase())
    );
  }
}