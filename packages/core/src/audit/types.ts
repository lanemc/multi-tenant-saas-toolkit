export interface AuditEvent {
  id: string;
  timestamp: Date;
  tenant?: string;
  actor: {
    id: string;
    type: 'user' | 'system' | 'anonymous';
  };
  action: string;
  resource: {
    type: string;
    id: string;
  };
  result: 'success' | 'failure';
  metadata: Record<string, any>;
}

export interface AuditQueryFilter {
  tenant?: string;
  actor?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  result?: 'success' | 'failure';
  startDate?: Date;
  endDate?: Date;
}

export interface AuditQuerySort {
  field: 'timestamp' | 'action' | 'result' | 'actor';
  order: 'asc' | 'desc';
}

export interface AuditQueryPagination {
  limit: number;
  offset: number;
}

export interface AuditStore {
  store(event: AuditEvent): Promise<void>;
  query(
    filter: AuditQueryFilter,
    sort?: AuditQuerySort,
    pagination?: AuditQueryPagination
  ): Promise<AuditEvent[]>;
  count(filter: AuditQueryFilter): Promise<number>;
}

export interface AuditLogInput {
  action: string;
  resource: {
    type: string;
    id: string;
  };
  result: 'success' | 'failure';
  metadata?: Record<string, any>;
  request?: any; // Express Request type
}

export interface AuditLoggerConfig {
  store?: AuditStore;
  sensitiveFields?: string[];
}

export interface AuditActionConfig {
  action: string;
  resourceType: string;
  getResourceId?: (args: any[]) => string;
  getMetadata?: (args: any[], result?: any) => Record<string, any>;
}