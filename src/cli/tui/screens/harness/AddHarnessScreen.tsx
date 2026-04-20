import type { HarnessModelProvider } from '../../../../schema';
import { NetworkModeSchema } from '../../../../schema';
import { HarnessNameSchema, HarnessTruncationStrategySchema } from '../../../../schema/schemas/primitives/harness';
import { ARN_VALIDATION_MESSAGE, isValidArn } from '../../../commands/shared/arn-utils';
import {
  ConfirmReview,
  Panel,
  Screen,
  StepIndicator,
  TextInput,
  WizardMultiSelect,
  WizardSelect,
} from '../../components';
import type { SelectableItem } from '../../components';
import { HELP_TEXT } from '../../constants';
import { useListNavigation, useMultiSelectNavigation } from '../../hooks';
import { generateUniqueName } from '../../utils';
import type { AddHarnessConfig, AdvancedSetting, ContainerMode } from './types';
import {
  ADVANCED_SETTING_OPTIONS,
  BEDROCK_MODEL_OPTIONS,
  CONTAINER_MODE_OPTIONS,
  HARNESS_STEP_LABELS,
  MODEL_PROVIDER_OPTIONS,
  NETWORK_MODE_OPTIONS,
  TRUNCATION_STRATEGY_OPTIONS,
} from './types';
import { useAddHarnessWizard } from './useAddHarnessWizard';
import React, { useMemo } from 'react';

interface AddHarnessScreenProps {
  existingHarnessNames: string[];
  onComplete: (config: AddHarnessConfig) => void;
  onExit: () => void;
}

export function AddHarnessScreen({ existingHarnessNames, onComplete, onExit }: AddHarnessScreenProps) {
  const wizard = useAddHarnessWizard();

  const modelProviderItems: SelectableItem[] = useMemo(
    () => MODEL_PROVIDER_OPTIONS.map(opt => ({ id: opt.id, title: opt.title, description: opt.description })),
    []
  );

  const bedrockModelItems: SelectableItem[] = useMemo(
    () => BEDROCK_MODEL_OPTIONS.map(opt => ({ id: opt.id, title: opt.title })),
    []
  );

  const containerModeItems: SelectableItem[] = useMemo(
    () => CONTAINER_MODE_OPTIONS.map(opt => ({ id: opt.id, title: opt.title, description: opt.description })),
    []
  );

  const advancedSettingItems: SelectableItem[] = useMemo(
    () => ADVANCED_SETTING_OPTIONS.map(opt => ({ id: opt.id, title: opt.title, description: opt.description })),
    []
  );

  const networkModeItems: SelectableItem[] = useMemo(
    () => NETWORK_MODE_OPTIONS.map(opt => ({ id: opt.id, title: opt.title, description: opt.description })),
    []
  );

  const truncationStrategyItems: SelectableItem[] = useMemo(
    () => TRUNCATION_STRATEGY_OPTIONS.map(opt => ({ id: opt.id, title: opt.title, description: opt.description })),
    []
  );

  const isNameStep = wizard.step === 'name';
  const isModelProviderStep = wizard.step === 'model-provider';
  const isModelIdStep = wizard.step === 'model-id';
  const isApiKeyArnStep = wizard.step === 'api-key-arn';
  const isContainerStep = wizard.step === 'container';
  const isContainerUriStep = wizard.step === 'container-uri';
  const isContainerDockerfileStep = wizard.step === 'container-dockerfile';
  const isAdvancedStep = wizard.step === 'advanced';
  const isNetworkModeStep = wizard.step === 'network-mode';
  const isSubnetsStep = wizard.step === 'subnets';
  const isSecurityGroupsStep = wizard.step === 'security-groups';
  const isIdleTimeoutStep = wizard.step === 'idle-timeout';
  const isMaxLifetimeStep = wizard.step === 'max-lifetime';
  const isMaxIterationsStep = wizard.step === 'max-iterations';
  const isMaxTokensStep = wizard.step === 'max-tokens';
  const isTimeoutStep = wizard.step === 'timeout';
  const isTruncationStrategyStep = wizard.step === 'truncation-strategy';
  const isConfirmStep = wizard.step === 'confirm';

  const modelProviderNav = useListNavigation({
    items: modelProviderItems,
    onSelect: item => wizard.setModelProvider(item.id as HarnessModelProvider),
    onExit: () => wizard.goBack(),
    isActive: isModelProviderStep,
  });

  const bedrockModelNav = useListNavigation({
    items: bedrockModelItems,
    onSelect: item => wizard.setModelId(item.id),
    onExit: () => wizard.goBack(),
    isActive: isModelIdStep && wizard.config.modelProvider === 'bedrock',
  });

  const containerModeNav = useListNavigation({
    items: containerModeItems,
    onSelect: item => wizard.setContainerMode(item.id as ContainerMode),
    onExit: () => wizard.goBack(),
    isActive: isContainerStep,
  });

  const advancedSettingsNav = useMultiSelectNavigation({
    items: advancedSettingItems,
    getId: item => item.id,
    onConfirm: ids => wizard.setAdvancedSettings(ids as AdvancedSetting[]),
    onExit: () => wizard.goBack(),
    isActive: isAdvancedStep,
    requireSelection: false,
  });

  const networkModeNav = useListNavigation({
    items: networkModeItems,
    onSelect: item => wizard.setNetworkMode(NetworkModeSchema.parse(item.id)),
    onExit: () => wizard.goBack(),
    isActive: isNetworkModeStep,
  });

  const truncationStrategyNav = useListNavigation({
    items: truncationStrategyItems,
    onSelect: item => wizard.setTruncationStrategy(HarnessTruncationStrategySchema.parse(item.id)),
    onExit: () => wizard.goBack(),
    isActive: isTruncationStrategyStep,
  });

  useListNavigation({
    items: [{ id: 'confirm', title: 'Confirm' }],
    onSelect: () => onComplete(wizard.config),
    onExit: () => wizard.goBack(),
    isActive: isConfirmStep,
  });

  const helpText = isAdvancedStep
    ? 'Space toggle · Enter confirm · Esc back'
    : isModelProviderStep ||
        isContainerStep ||
        isNetworkModeStep ||
        isTruncationStrategyStep ||
        (isModelIdStep && wizard.config.modelProvider === 'bedrock')
      ? HELP_TEXT.NAVIGATE_SELECT
      : isConfirmStep
        ? HELP_TEXT.CONFIRM_CANCEL
        : HELP_TEXT.TEXT_INPUT;

  const headerContent = <StepIndicator steps={wizard.steps} currentStep={wizard.step} labels={HARNESS_STEP_LABELS} />;

  const confirmFields = useMemo(() => {
    const fields = [
      { label: 'Name', value: wizard.config.name },
      { label: 'Model Provider', value: wizard.config.modelProvider },
      { label: 'Model ID', value: wizard.config.modelId },
    ];

    if (wizard.config.apiKeyArn) {
      fields.push({ label: 'API Key ARN', value: wizard.config.apiKeyArn });
    }

    if (wizard.config.containerUri) {
      fields.push({ label: 'Container URI', value: wizard.config.containerUri });
    }

    if (wizard.config.dockerfilePath) {
      fields.push({ label: 'Dockerfile', value: wizard.config.dockerfilePath });
    }

    if (wizard.config.networkMode) {
      fields.push({ label: 'Network Mode', value: wizard.config.networkMode });
      if (wizard.config.networkMode === 'VPC') {
        if (wizard.config.subnets) {
          fields.push({ label: 'Subnets', value: wizard.config.subnets.join(', ') });
        }
        if (wizard.config.securityGroups) {
          fields.push({ label: 'Security Groups', value: wizard.config.securityGroups.join(', ') });
        }
      }
    }

    if (wizard.config.idleTimeout !== undefined) {
      fields.push({ label: 'Idle Timeout', value: `${wizard.config.idleTimeout}s` });
    }

    if (wizard.config.maxLifetime !== undefined) {
      fields.push({ label: 'Max Lifetime', value: `${wizard.config.maxLifetime}s` });
    }

    if (wizard.config.maxIterations !== undefined) {
      fields.push({ label: 'Max Iterations', value: String(wizard.config.maxIterations) });
    }

    if (wizard.config.maxTokens !== undefined) {
      fields.push({ label: 'Max Tokens', value: String(wizard.config.maxTokens) });
    }

    if (wizard.config.timeoutSeconds !== undefined) {
      fields.push({ label: 'Timeout', value: `${wizard.config.timeoutSeconds}s` });
    }

    if (wizard.config.truncationStrategy) {
      fields.push({ label: 'Truncation Strategy', value: wizard.config.truncationStrategy });
    }

    return fields;
  }, [wizard.config]);

  return (
    <Screen
      title="Add Harness"
      onExit={onExit}
      helpText={helpText}
      headerContent={headerContent}
      exitEnabled={isNameStep}
    >
      <Panel>
        {isNameStep && (
          <TextInput
            key="name"
            prompt="Harness name"
            initialValue={generateUniqueName('MyHarness', existingHarnessNames)}
            onSubmit={wizard.setName}
            onCancel={onExit}
            schema={HarnessNameSchema}
            customValidation={value => !existingHarnessNames.includes(value) || 'Harness name already exists'}
          />
        )}

        {isModelProviderStep && (
          <WizardSelect
            title="Select model provider"
            description="Choose where to run your models"
            items={modelProviderItems}
            selectedIndex={modelProviderNav.selectedIndex}
          />
        )}

        {isModelIdStep && wizard.config.modelProvider === 'bedrock' && (
          <WizardSelect
            title="Select Bedrock model"
            description="Choose a model from Amazon Bedrock"
            items={bedrockModelItems}
            selectedIndex={bedrockModelNav.selectedIndex}
          />
        )}

        {isModelIdStep && wizard.config.modelProvider !== 'bedrock' && (
          <TextInput
            key="model-id"
            prompt="Model ID"
            initialValue=""
            onSubmit={wizard.setModelId}
            onCancel={() => wizard.goBack()}
            customValidation={value => (value.trim().length > 0 ? true : 'Model ID is required')}
          />
        )}

        {isApiKeyArnStep && (
          <TextInput
            key="api-key-arn"
            prompt="API Key ARN (Secrets Manager)"
            initialValue=""
            onSubmit={wizard.setApiKeyArn}
            onCancel={() => wizard.goBack()}
            customValidation={value => isValidArn(value) || ARN_VALIDATION_MESSAGE}
          />
        )}

        {isContainerStep && (
          <WizardSelect
            title="Custom container"
            description="Optionally provide a custom container image for the harness runtime"
            items={containerModeItems}
            selectedIndex={containerModeNav.selectedIndex}
          />
        )}

        {isContainerUriStep && (
          <TextInput
            key="container-uri"
            prompt="Container image URI (e.g., 123456789012.dkr.ecr.us-east-1.amazonaws.com/my-harness:latest)"
            initialValue=""
            onSubmit={wizard.setContainerUri}
            onCancel={() => wizard.goBack()}
            customValidation={value => (value.trim().length > 0 ? true : 'Container URI is required')}
          />
        )}

        {isContainerDockerfileStep && (
          <TextInput
            key="container-dockerfile"
            prompt="Path to Dockerfile"
            initialValue=""
            onSubmit={wizard.setDockerfilePath}
            onCancel={() => wizard.goBack()}
            customValidation={value => (value.trim().length > 0 ? true : 'Dockerfile path is required')}
          />
        )}

        {isAdvancedStep && (
          <WizardMultiSelect
            title="Advanced settings (optional)"
            description="Configure network, lifecycle, execution limits, or truncation"
            items={advancedSettingItems}
            cursorIndex={advancedSettingsNav.cursorIndex}
            selectedIds={advancedSettingsNav.selectedIds}
          />
        )}

        {isNetworkModeStep && (
          <WizardSelect
            title="Network mode"
            description="Choose network deployment mode"
            items={networkModeItems}
            selectedIndex={networkModeNav.selectedIndex}
          />
        )}

        {isSubnetsStep && (
          <TextInput
            key="subnets"
            prompt="Subnet IDs (comma-separated)"
            initialValue=""
            onSubmit={wizard.setSubnets}
            onCancel={() => wizard.goBack()}
            customValidation={value =>
              value.trim().length > 0 ? true : 'At least one subnet is required for VPC mode'
            }
          />
        )}

        {isSecurityGroupsStep && (
          <TextInput
            key="security-groups"
            prompt="Security Group IDs (comma-separated)"
            initialValue=""
            onSubmit={wizard.setSecurityGroups}
            onCancel={() => wizard.goBack()}
            customValidation={value =>
              value.trim().length > 0 ? true : 'At least one security group is required for VPC mode'
            }
          />
        )}

        {isIdleTimeoutStep && (
          <TextInput
            key="idle-timeout"
            prompt="Idle timeout (seconds)"
            initialValue="300"
            onSubmit={wizard.setIdleTimeout}
            onCancel={() => wizard.goBack()}
            customValidation={value => {
              const num = parseInt(value, 10);
              return !isNaN(num) && num > 0 ? true : 'Must be a positive number';
            }}
          />
        )}

        {isMaxLifetimeStep && (
          <TextInput
            key="max-lifetime"
            prompt="Max lifetime (seconds)"
            initialValue="3600"
            onSubmit={wizard.setMaxLifetime}
            onCancel={() => wizard.goBack()}
            customValidation={value => {
              const num = parseInt(value, 10);
              return !isNaN(num) && num > 0 ? true : 'Must be a positive number';
            }}
          />
        )}

        {isMaxIterationsStep && (
          <TextInput
            key="max-iterations"
            prompt="Max iterations"
            initialValue="10"
            onSubmit={wizard.setMaxIterations}
            onCancel={() => wizard.goBack()}
            customValidation={value => {
              const num = parseInt(value, 10);
              return !isNaN(num) && num > 0 ? true : 'Must be a positive number';
            }}
          />
        )}

        {isMaxTokensStep && (
          <TextInput
            key="max-tokens"
            prompt="Max tokens"
            initialValue="4096"
            onSubmit={wizard.setMaxTokens}
            onCancel={() => wizard.goBack()}
            customValidation={value => {
              const num = parseInt(value, 10);
              return !isNaN(num) && num > 0 ? true : 'Must be a positive number';
            }}
          />
        )}

        {isTimeoutStep && (
          <TextInput
            key="timeout"
            prompt="Timeout (seconds)"
            initialValue="300"
            onSubmit={wizard.setTimeoutSeconds}
            onCancel={() => wizard.goBack()}
            customValidation={value => {
              const num = parseInt(value, 10);
              return !isNaN(num) && num > 0 ? true : 'Must be a positive number';
            }}
          />
        )}

        {isTruncationStrategyStep && (
          <WizardSelect
            title="Truncation strategy"
            description="How to manage context when it exceeds limits"
            items={truncationStrategyItems}
            selectedIndex={truncationStrategyNav.selectedIndex}
          />
        )}

        {isConfirmStep && <ConfirmReview fields={confirmFields} />}
      </Panel>
    </Screen>
  );
}
