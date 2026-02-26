/**
 * Shared TypeScript interfaces for API entities.
 *
 * Replaces the widespread `useState<any>` / `useState<any[]>` across page
 * components with explicit, reusable type definitions.
 */

// ── Associated Preset (shared across IP lists, rate limits, presets) ──

export interface AssociatedPreset {
  id: number;
  name: string;
}

// ── IP Lists ─────────────────────────────────────────────────────────

export interface IPListFormData {
  name: string;
  ips: string;
  response_code: number;
  response_body: string;
  response_type: string;
}

export interface IPList {
  id: number;
  name: string;
  ips: string;
  response_code: number;
  response_body: string;
  response_type: string;
  usage?: {
    preset_count: number;
  };
}

// ── Resources ───────────────────────────────────────────────────────

export interface Resource {
  id: number;
  name: string;
  unique_path: string;
  secret_api_key: string;
  external_api_base_url?: string;
  external_api_url?: string;
  description?: string;
  total_usage_count?: number;
  endpoint_groups_count?: number;
  last_used?: string;
  timeout_seconds?: number;
  timeout_response_code?: number;
  timeout_response_body?: string;
  timeout_response_type?: string;
  endpoint_groups?: EndpointGroup[];
}

export interface EndpointGroup {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  endpoints?: Endpoint[];
}

export interface Endpoint {
  id: number;
  url_pattern: string;
  method: string;
}

// ── Rate Limits ──────────────────────────────────────────────────────

export interface RateLimitRule {
  requests: number;
  window_seconds: number;
}

export interface RateLimit {
  id: number;
  name: string;
  description?: string;
  rules: RateLimitRule[];
  response_code?: number;
  response_body?: string;
  response_type?: string;
  usage?: {
    preset_count: number;
  };
}

// ── Presets ──────────────────────────────────────────────────────────

export interface Preset {
  id: number;
  name: string;
  description: string | null;
  is_system?: boolean;
  rate_limit_id: number | null;
  rate_limit_name: string | null;
  rate_limit_rules: RateLimitRule[];
  ip_allowlist_id: number | null;
  ip_allowlist_name: string | null;
  ip_blocklist_id: number | null;
  ip_blocklist_name: string | null;
  api_key_count: number;
  allowed_methods: string[];
  resources: {
    id: number;
    name: string;
    unique_path?: string;
    external_api_base_url?: string;
    usage_limit?: number | null;
    lease_seconds?: number | null;
  }[];
  endpoint_groups: {
    id: number;
    name: string;
    description: string | null;
    resource_id: number;
    resource_name: string;
    lease_seconds: number | null;
    usage_limit: number | null;
    endpoints?: Endpoint[];
  }[];
}

export interface RateLimitWithRules {
  id: number;
  name: string;
  rules: RateLimitRule[];
}

export interface ApiKeyRow {
  id: number;
  name: string;
  description: string | null;
  api_key: string;
  preset_name: string | null;
}

// ── Logs ─────────────────────────────────────────────────────────────

export interface LogEntry {
  id: number;
  method: string;
  path: string;
  url: string;
  status_code: number;
  response_code: number;
  upstream_status_code?: number;
  response_time_ms?: number;
  duration_ms?: number;
  api_key_name?: string;
  project_name?: string;
  client_ip?: string;
  ip_address?: string;
  created_at: string;
  request_headers?: string;
  request_body?: string;
  response_headers?: string;
  response_body?: string;
  headers?: string;
  body?: string;
}

// ── API Keys / Use Cases ─────────────────────────────────────────────

export interface UseCase {
  id: number;
  name: string;
  description: string | null;
  notes: string | null;
  api_key: string;
  preset_id: number | null;
  preset_name: string | null;
  created_at?: string;
}
