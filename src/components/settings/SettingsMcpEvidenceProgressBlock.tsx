import { useState } from 'react';
import { SettingsMcpPerServerSoakCommandReviewPanel } from './SettingsMcpPerServerSoakCommandReviewPanel';
import { SettingsMcpProgressOverview } from './SettingsMcpProgressOverview';
import { SettingsMcpPostSaveReadinessReviewPanel } from './SettingsMcpPostSaveReadinessReviewPanel';
import { SettingsMcpSavedConfigReadinessHandoffPanel } from './SettingsMcpSavedConfigReadinessHandoffPanel';
import { SettingsMcpSoakEvidenceActions } from './SettingsMcpSoakEvidenceActions';
import { SettingsMcpSoakReadinessPanel } from './SettingsMcpSoakReadinessPanel';
import { SettingsMcpSoakSummaryPanel } from './SettingsMcpSoakSummaryPanel';
import type { SettingsMcpServerHealthSummary } from './settingsMcpHealthSummary';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

interface SettingsMcpEvidenceProgressBlockProps {
  configText: string;
  disabled?: boolean;
  healthSummaries: SettingsMcpServerHealthSummary[];
  lastConfigSavedAt?: number | null;
  onFeedback?: (message: string) => void;
  toolCount: number;
}

export function SettingsMcpEvidenceProgressBlock({
  configText,
  disabled = false,
  healthSummaries,
  lastConfigSavedAt = null,
  onFeedback,
  toolCount,
}: SettingsMcpEvidenceProgressBlockProps) {
  const [readinessSummary, setReadinessSummary] = useState<SettingsMcpSoakReadinessSummaryResult | null>(null);
  const [soakSummary, setSoakSummary] = useState<SettingsMcpSoakSummaryResult | null>(null);
  const clearSoakSummary = () => {
    setSoakSummary(null);
    onFeedback?.('MCP soak evidence cleared for this Settings session.');
  };

  return (
    <div className="space-y-2">
      <SettingsMcpProgressOverview
        configText={configText}
        healthSummaries={healthSummaries}
        readinessSummary={readinessSummary}
        soakSummary={soakSummary}
        toolCount={toolCount}
      />
      <SettingsMcpPostSaveReadinessReviewPanel
        readinessSummary={readinessSummary}
        savedAt={lastConfigSavedAt}
        soakSummary={soakSummary}
      />
      <SettingsMcpSavedConfigReadinessHandoffPanel
        configText={configText}
        readinessSummary={readinessSummary}
        savedAt={lastConfigSavedAt}
      />
      <SettingsMcpPerServerSoakCommandReviewPanel
        configText={configText}
        readinessSummary={readinessSummary}
        onFeedback={onFeedback}
      />
      <SettingsMcpSoakReadinessPanel
        configText={configText}
        disabled={disabled}
        onFeedback={onFeedback}
        onSummaryChange={setReadinessSummary}
      />
      <SettingsMcpSoakSummaryPanel
        disabled={disabled}
        onFeedback={onFeedback}
        onSummaryChange={setSoakSummary}
        summary={soakSummary}
      />
      <SettingsMcpSoakEvidenceActions
        disabled={disabled}
        summary={soakSummary}
        onClear={clearSoakSummary}
        onFeedback={onFeedback}
      />
    </div>
  );
}
