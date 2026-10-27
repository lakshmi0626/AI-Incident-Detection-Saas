export type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
export type IncidentStatus = 'Triggered' | 'Acknowledged' | 'Investigating' | 'Mitigated' | 'Resolved' | 'Closed';
export type UserRole = 'owner' | 'admin' | 'engineer' | 'viewer';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  role: UserRole;
  member_count?: number;
  app_count?: number;
  settings_json?: Record<string, any>;
}

export interface Application {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description?: string;
  api_key_prefix: string;
  api_key?: string;
  environments_json: string[];
  status: 'active' | 'warning' | 'critical' | 'paused';
  created_at: string;
  services_count: number;
  active_incidents_count: number;
}

export interface Service {
  id: string;
  application_id: string;
  name: string;
  language: string;
  tier: string;
  health_status: 'healthy' | 'degraded' | 'failing';
}

export interface Incident {
  id: string;
  organization_id: string;
  application_id: string;
  application_name?: string;
  title: string;
  fingerprint: string;
  severity: Severity;
  status: IncidentStatus;
  service_name: string;
  environment: string;
  description?: string;
  trigger_value?: string;
  assigned_to_user_id?: string;
  assignee_name?: string;
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  closed_at?: string;
  updated_at: string;
  mttd_seconds?: number;
  mttr_seconds?: number;
  ai_status?: 'available' | 'analyzed' | 'verified';
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  event_type: string;
  actor_type: 'system' | 'user' | 'ai';
  actor_name: string;
  message: string;
  data: Record<string, any>;
  created_at: string;
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  user_id?: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface AIAnalysis {
  id: string;
  incident_id: string;
  model_name: string;
  summary: string;
  root_cause_hypothesis: string;
  supporting_evidence: Array<{
    type: 'log' | 'metric' | 'trace';
    id?: string;
    title: string;
    snippet: string;
    severity?: string;
  }>;
  alternative_causes: string[];
  confidence_score: number;
  recommended_steps: string[];
  code_fix_diff?: string;
  verification_steps: string[];
  feedback_status: 'pending' | 'correct' | 'incorrect' | 'unresolved';
  verified_root_cause?: string;
  feedback_notes?: string;
  created_at: string;
}

export interface LogEntry {
  id: string;
  application_id: string;
  service_name: string;
  environment: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  message: string;
  raw_message?: string;
  context_data?: Record<string, any>;
  trace_id?: string;
  span_id?: string;
  timestamp: string;
}

export interface MetricSummaryPoint {
  time: string;
  timestamp: string;
  rps: number;
  latency_p50: number;
  latency_p95: number;
  error_rate: number;
  cpu_usage: number;
}

export interface TraceSpan {
  span_id: string;
  parent_span_id?: string;
  name: string;
  service_name: string;
  start_time: string;
  offset_ms: number;
  duration_ms: number;
  status_code: 'OK' | 'ERROR';
  status_message?: string;
  attributes?: Record<string, any>;
}

export interface NotificationItem {
  id: string;
  incident_id?: string;
  title: string;
  message: string;
  channel_type: string;
  severity: Severity;
  status: 'unread' | 'read' | 'delivered';
  created_at: string;
}

export interface NotificationChannel {
  id: string;
  channel_type: 'slack' | 'teams' | 'email';
  name: string;
  config: Record<string, any>;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_email?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  ip_address: string;
  details: Record<string, any>;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  tier: string;
  name: string;
  max_apps: number;
  max_monthly_events: number;
  max_ai_investigations_monthly: number;
  retention_days: number;
  price_usd_monthly: number;
  features: string[];
}

export interface UsageQuota {
  period_ym: string;
  plan_tier: string;
  apps_count: number;
  max_apps: number;
  events_ingested: number;
  max_monthly_events: number;
  ai_investigations_used: number;
  max_ai_investigations_monthly: number;
  retention_days: number;
}
