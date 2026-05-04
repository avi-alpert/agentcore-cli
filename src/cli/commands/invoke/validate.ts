import type { InvokeOptions } from './types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateInvokeOptions(options: InvokeOptions): ValidationResult {
  if (options.harnessArn && (options.harnessName || options.agentName)) {
    return { valid: false, error: '--harness-arn cannot be combined with --harness or --runtime' };
  }
  if (options.harnessArn && options.exec) {
    return { valid: false, error: '--exec is not supported with --harness-arn' };
  }
  if (options.harnessName && options.agentName) {
    return { valid: false, error: '--harness and --runtime cannot be used together' };
  }
  if (options.verbose && !options.harnessName && !options.harnessArn) {
    return { valid: false, error: '--verbose is only supported with --harness or --harness-arn' };
  }
  if (options.exec && !options.prompt) {
    return { valid: false, error: 'A command is required with --exec. Usage: agentcore invoke --exec "ls -la"' };
  }
  if (options.exec && (options.tool || options.input)) {
    return { valid: false, error: '--exec cannot be combined with --tool or --input' };
  }
  if (options.exec && options.stream) {
    return { valid: false, error: '--exec already streams output; --stream is not needed' };
  }
  if (options.json && !options.prompt) {
    return { valid: false, error: 'Prompt is required for JSON output' };
  }
  if (options.stream && !options.prompt) {
    return { valid: false, error: 'Prompt is required for streaming' };
  }
  return { valid: true };
}
