import type { HarnessModelProvider, NetworkMode } from '../../../../schema';

export type AddHarnessStep =
  | 'name'
  | 'model-provider'
  | 'model-id'
  | 'api-key-arn'
  | 'advanced'
  | 'network-mode'
  | 'subnets'
  | 'security-groups'
  | 'idle-timeout'
  | 'max-lifetime'
  | 'max-iterations'
  | 'max-tokens'
  | 'timeout'
  | 'truncation-strategy'
  | 'confirm';

export interface AddHarnessConfig {
  name: string;
  modelProvider: HarnessModelProvider;
  modelId: string;
  apiKeyArn?: string;
  maxIterations?: number;
  maxTokens?: number;
  timeoutSeconds?: number;
  truncationStrategy?: 'sliding_window' | 'summarization';
  networkMode?: NetworkMode;
  subnets?: string[];
  securityGroups?: string[];
  idleTimeout?: number;
  maxLifetime?: number;
}

export const HARNESS_STEP_LABELS: Record<AddHarnessStep, string> = {
  name: 'Name',
  'model-provider': 'Model provider',
  'model-id': 'Model',
  'api-key-arn': 'API key ARN',
  advanced: 'Advanced settings',
  'network-mode': 'Network mode',
  subnets: 'Subnets',
  'security-groups': 'Security groups',
  'idle-timeout': 'Idle timeout',
  'max-lifetime': 'Max lifetime',
  'max-iterations': 'Max iterations',
  'max-tokens': 'Max tokens',
  timeout: 'Timeout',
  'truncation-strategy': 'Truncation',
  confirm: 'Confirm',
};

export const MODEL_PROVIDER_OPTIONS = [
  { id: 'bedrock' as const, title: 'Amazon Bedrock', description: 'Use models via Amazon Bedrock' },
  { id: 'open_ai' as const, title: 'OpenAI', description: 'Use OpenAI models (requires API key ARN)' },
  { id: 'gemini' as const, title: 'Google Gemini', description: 'Use Google Gemini models (requires API key ARN)' },
] as const;

export const BEDROCK_MODEL_OPTIONS = [
  { id: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0', title: 'Claude Sonnet 4 (Recommended)' },
  { id: 'us.anthropic.claude-3-5-haiku-20241022-v1:0', title: 'Claude Haiku 3.5' },
  { id: 'us.amazon.nova-pro-v1:0', title: 'Nova Pro' },
  { id: 'us.amazon.nova-lite-v1:0', title: 'Nova Lite' },
] as const;

export const TRUNCATION_STRATEGY_OPTIONS = [
  { id: 'sliding_window' as const, title: 'Sliding window', description: 'Keep most recent messages' },
  { id: 'summarization' as const, title: 'Summarization', description: 'Compress older context' },
] as const;

export const ADVANCED_SETTING_OPTIONS = [
  { id: 'network', title: 'Network', description: 'VPC configuration' },
  { id: 'lifecycle', title: 'Lifecycle', description: 'Idle timeout and max lifetime' },
  { id: 'execution', title: 'Execution limits', description: 'Iterations, tokens, timeout' },
  { id: 'truncation', title: 'Truncation', description: 'Context management strategy' },
] as const;

export type AdvancedSetting = (typeof ADVANCED_SETTING_OPTIONS)[number]['id'];

export const NETWORK_MODE_OPTIONS = [
  { id: 'PUBLIC' as const, title: 'Public', description: 'Internet-facing' },
  { id: 'VPC' as const, title: 'VPC', description: 'Deploy within a VPC' },
] as const;
