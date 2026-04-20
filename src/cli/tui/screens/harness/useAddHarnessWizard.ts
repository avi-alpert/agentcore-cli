import type { HarnessModelProvider, NetworkMode } from '../../../../schema';
import type { AddHarnessConfig, AddHarnessStep, AdvancedSetting } from './types';
import { useCallback, useMemo, useState } from 'react';

const SETTING_TO_FIRST_STEP: Record<AdvancedSetting, AddHarnessStep> = {
  network: 'network-mode',
  lifecycle: 'idle-timeout',
  execution: 'max-iterations',
  truncation: 'truncation-strategy',
};

function getFirstAdvancedStep(settings: AdvancedSetting[]): AddHarnessStep | undefined {
  for (const setting of ['network', 'lifecycle', 'execution', 'truncation'] as AdvancedSetting[]) {
    if (settings.includes(setting)) return SETTING_TO_FIRST_STEP[setting];
  }
  return undefined;
}

function getDefaultConfig(): AddHarnessConfig {
  return {
    name: '',
    modelProvider: 'bedrock',
    modelId: 'us.anthropic.claude-sonnet-4-5-20250514-v1:0',
  };
}

export function useAddHarnessWizard() {
  const [config, setConfig] = useState<AddHarnessConfig>(getDefaultConfig);
  const [step, setStep] = useState<AddHarnessStep>('name');
  const [advancedSettings, setAdvancedSettingsState] = useState<AdvancedSetting[]>([]);

  const allSteps = useMemo(() => {
    const steps: AddHarnessStep[] = ['name', 'model-provider', 'model-id'];

    // Add api-key-arn step for non-bedrock providers
    if (config.modelProvider !== 'bedrock') {
      steps.push('api-key-arn');
    }

    // Always show advanced settings selection
    steps.push('advanced');

    // Add steps based on advanced settings selections
    if (advancedSettings.includes('network')) {
      steps.push('network-mode');
      if (config.networkMode === 'VPC') {
        steps.push('subnets', 'security-groups');
      }
    }

    if (advancedSettings.includes('lifecycle')) {
      steps.push('idle-timeout', 'max-lifetime');
    }

    if (advancedSettings.includes('execution')) {
      steps.push('max-iterations', 'max-tokens', 'timeout');
    }

    if (advancedSettings.includes('truncation')) {
      steps.push('truncation-strategy');
    }

    // Always end with confirm
    steps.push('confirm');

    return steps;
  }, [config.modelProvider, config.networkMode, advancedSettings]);

  const currentIndex = allSteps.indexOf(step);

  const goBack = useCallback(() => {
    const idx = allSteps.indexOf(step);
    const prevStep = allSteps[idx - 1];
    if (prevStep) setStep(prevStep);
  }, [allSteps, step]);

  const nextStep = useCallback(
    (currentStep: AddHarnessStep): AddHarnessStep | undefined => {
      const idx = allSteps.indexOf(currentStep);
      return allSteps[idx + 1];
    },
    [allSteps]
  );

  const setName = useCallback(
    (name: string) => {
      setConfig(c => ({ ...c, name }));
      const next = nextStep('name');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setModelProvider = useCallback(
    (modelProvider: HarnessModelProvider) => {
      setConfig(c => ({ ...c, modelProvider }));
      const next = nextStep('model-provider');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setModelId = useCallback(
    (modelId: string) => {
      setConfig(c => ({ ...c, modelId }));
      const next = nextStep('model-id');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setApiKeyArn = useCallback(
    (apiKeyArn: string) => {
      setConfig(c => ({ ...c, apiKeyArn }));
      const next = nextStep('api-key-arn');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setAdvancedSettings = useCallback(
    (settings: AdvancedSetting[]) => {
      setAdvancedSettingsState(settings);
      // Compute next step directly from incoming settings rather than relying
      // on allSteps which still reflects the previous (empty) advancedSettings.
      const firstAdvancedStep = getFirstAdvancedStep(settings);
      setStep(firstAdvancedStep ?? 'confirm');
    },
    []
  );

  const setNetworkMode = useCallback(
    (networkMode: NetworkMode) => {
      setConfig(c => ({ ...c, networkMode }));
      // Compute next step directly: VPC needs subnets, PUBLIC skips to the
      // next advanced section. Can't rely on allSteps since state hasn't
      // re-rendered yet (same stale-closure pattern as setAdvancedSettings).
      if (networkMode === 'VPC') {
        setStep('subnets');
      } else {
        const networkIdx = advancedSettings.indexOf('network');
        const remaining = advancedSettings.slice(networkIdx + 1);
        const nextAdvanced = getFirstAdvancedStep(remaining);
        setStep(nextAdvanced ?? 'confirm');
      }
    },
    [advancedSettings]
  );

  const setSubnets = useCallback(
    (subnetsStr: string) => {
      const subnets = subnetsStr.split(',').map(s => s.trim()).filter(Boolean);
      setConfig(c => ({ ...c, subnets }));
      const next = nextStep('subnets');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setSecurityGroups = useCallback(
    (sgStr: string) => {
      const securityGroups = sgStr.split(',').map(s => s.trim()).filter(Boolean);
      setConfig(c => ({ ...c, securityGroups }));
      const next = nextStep('security-groups');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setIdleTimeout = useCallback(
    (idleTimeoutStr: string) => {
      const idleTimeout = parseInt(idleTimeoutStr, 10);
      setConfig(c => ({ ...c, idleTimeout }));
      const next = nextStep('idle-timeout');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setMaxLifetime = useCallback(
    (maxLifetimeStr: string) => {
      const maxLifetime = parseInt(maxLifetimeStr, 10);
      setConfig(c => ({ ...c, maxLifetime }));
      const next = nextStep('max-lifetime');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setMaxIterations = useCallback(
    (maxIterationsStr: string) => {
      const maxIterations = parseInt(maxIterationsStr, 10);
      setConfig(c => ({ ...c, maxIterations }));
      const next = nextStep('max-iterations');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setMaxTokens = useCallback(
    (maxTokensStr: string) => {
      const maxTokens = parseInt(maxTokensStr, 10);
      setConfig(c => ({ ...c, maxTokens }));
      const next = nextStep('max-tokens');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setTimeoutSeconds = useCallback(
    (timeoutStr: string) => {
      const timeoutSeconds = parseInt(timeoutStr, 10);
      setConfig(c => ({ ...c, timeoutSeconds }));
      const next = nextStep('timeout');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const setTruncationStrategy = useCallback(
    (truncationStrategy: 'sliding_window' | 'summarization') => {
      setConfig(c => ({ ...c, truncationStrategy }));
      const next = nextStep('truncation-strategy');
      if (next) setStep(next);
    },
    [nextStep]
  );

  const reset = useCallback(() => {
    setConfig(getDefaultConfig());
    setStep('name');
    setAdvancedSettingsState([]);
  }, []);

  return {
    config,
    step,
    steps: allSteps,
    currentIndex,
    advancedSettings,
    goBack,
    setName,
    setModelProvider,
    setModelId,
    setApiKeyArn,
    setAdvancedSettings,
    setNetworkMode,
    setSubnets,
    setSecurityGroups,
    setIdleTimeout,
    setMaxLifetime,
    setMaxIterations,
    setMaxTokens,
    setTimeoutSeconds,
    setTruncationStrategy,
    reset,
  };
}
