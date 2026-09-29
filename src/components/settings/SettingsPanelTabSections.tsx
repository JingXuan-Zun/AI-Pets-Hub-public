import type { ComponentType, LazyExoticComponent } from 'react';
import type { SettingsMotionExpressionTabProps } from './SettingsMotionExpressionTab';
import type { SettingsModelTabProps } from './SettingsModelTab';
import type { SettingsPersonalityTabProps } from './SettingsPersonalityTab';
import type { AiWorkspacePage } from './SettingsPersonalityTab';
import type { SettingsSystemTabProps } from './SettingsSystemTab';
import type { SettingsVisionTabProps } from './SettingsVisionTab';
import type { SettingsVoiceTabProps } from './SettingsVoiceTab';

export type SettingsPanelTabValue =
  | 'personality'
  | 'model'
  | 'motion-expression'
  | 'vision'
  | 'voice'
  | 'system';

type LazyTabComponent<Props> = LazyExoticComponent<ComponentType<Props>>;

interface SettingsPanelActiveTabContentProps {
  activeTab: SettingsPanelTabValue;
  personalityWorkspacePage?: AiWorkspacePage;
  motionExpressionTab: LazyTabComponent<SettingsMotionExpressionTabProps>;
  motionExpressionTabProps: SettingsMotionExpressionTabProps;
  modelTab: LazyTabComponent<SettingsModelTabProps>;
  modelTabProps: SettingsModelTabProps;
  personalityTab: LazyTabComponent<SettingsPersonalityTabProps>;
  personalityTabProps: SettingsPersonalityTabProps;
  systemTab: LazyTabComponent<SettingsSystemTabProps>;
  systemTabProps: SettingsSystemTabProps;
  visionTab: LazyTabComponent<SettingsVisionTabProps>;
  visionTabProps: SettingsVisionTabProps;
  voiceTab: LazyTabComponent<SettingsVoiceTabProps>;
  voiceTabProps: SettingsVoiceTabProps;
}

export function SettingsPanelActiveTabContent({
  activeTab,
  personalityWorkspacePage,
  motionExpressionTab,
  motionExpressionTabProps,
  modelTab,
  modelTabProps,
  personalityTab,
  personalityTabProps,
  systemTab,
  systemTabProps,
  visionTab,
  visionTabProps,
  voiceTab,
  voiceTabProps,
}: SettingsPanelActiveTabContentProps) {
  switch (activeTab) {
    case 'personality': {
      const PersonalityTab = personalityTab;
      return <PersonalityTab {...personalityTabProps} workspacePage={personalityWorkspacePage} />;
    }
    case 'model': {
      const ModelTab = modelTab;
      return <ModelTab {...modelTabProps} />;
    }
    case 'motion-expression': {
      const MotionExpressionTab = motionExpressionTab;
      return <MotionExpressionTab {...motionExpressionTabProps} />;
    }
    case 'vision': {
      const VisionTab = visionTab;
      return <VisionTab {...visionTabProps} />;
    }
    case 'voice': {
      const VoiceTab = voiceTab;
      return <VoiceTab {...voiceTabProps} />;
    }
    case 'system': {
      const SystemTab = systemTab;
      return <SystemTab {...systemTabProps} />;
    }
    default:
      return null;
  }
}
