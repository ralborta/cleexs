// Tipos compartidos para Cleexs PRIA

export enum TenantType {
  ROOT = 'ROOT',
  AGENCY = 'AGENCY',
  DIRECT_CLIENT = 'DIRECT_CLIENT',
  AGENCY_CLIENT = 'AGENCY_CLIENT',
}

export enum TenantStatus {
  active = 'active',
  suspended = 'suspended',
  archived = 'archived',
}

export enum UserRole {
  owner = 'owner',
  editor = 'editor',
  viewer = 'viewer',
}

export enum RunStatus {
  pending = 'pending',
  running = 'running',
  completed = 'completed',
  failed = 'failed',
}

export interface Top3Entry {
  position: number; // 1, 2, 3
  name: string;
  type: 'brand' | 'competitor';
}

export interface PromptResultFlags {
  ambiguous_ranking?: boolean;
  no_ranking?: boolean;
  brand_not_detected?: boolean;
  competitor_detected?: boolean;
  parsing_error?: boolean;
  incomplete_response?: boolean;
  manual_override?: boolean;
}

export interface PRIAByCategory {
  [categoryId: string]: number; // PRIA score 0-100
}
