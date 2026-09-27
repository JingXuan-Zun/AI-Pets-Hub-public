import { Eraser, Layers3 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import {
  applyMcpPolicyPresetToConfigText,
  clearMcpToolPoliciesInConfigText,
  SETTINGS_MCP_POLICY_PRESETS,
  type SettingsMcpPolicyPresetId,
} from './settingsMcpPolicyBulkUtils';

interface SettingsMcpPolicyBulkActionsProps {
  configText: string;
  onConfigTextChange: (text: string) => void;
  onFeedback: (message: string) => void;
  tools: DesktopPetMcpToolLike[];
}

function getServerOptions(tools: DesktopPetMcpToolLike[]) {
  return [...new Set(tools.map((tool) => tool.serverId).filter(Boolean))];
}

function selectClassName() {
  return 'h-8 rounded-sm border border-border bg-background/70 px-2 text-xs outline-none focus:border-primary';
}

export function SettingsMcpPolicyBulkActions({
  configText,
  onConfigTextChange,
  onFeedback,
  tools,
}: SettingsMcpPolicyBulkActionsProps) {
  const serverOptions = getServerOptions(tools);
  const [presetId, setPresetId] = useState<SettingsMcpPolicyPresetId>('deny-high-risk');
  const [serverId, setServerId] = useState('');

  const applyPreset = (presetId: SettingsMcpPolicyPresetId, serverId: string) => {
    const result = applyMcpPolicyPresetToConfigText(configText, tools, presetId, serverId || null);
    if (result.error) {
      onFeedback(result.error);
      return;
    }

    onConfigTextChange(result.rawText);
    onFeedback(`MCP policy preset applied to ${result.changedCount} tool(s). Save config to make it active.`);
  };

  const clearScope = (serverId: string) => {
    const result = clearMcpToolPoliciesInConfigText(configText, tools, serverId || null);
    if (result.error) {
      onFeedback(result.error);
      return;
    }

    onConfigTextChange(result.rawText);
    onFeedback(`MCP tool policies cleared for ${result.changedCount} tool(s). Save config to make it active.`);
  };

  if (!tools.length) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex items-center gap-2 font-mono text-2xs text-foreground">
        <Layers3 className="h-3.5 w-3.5" />
        policy bulk actions
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_96px]">
        <select
          className={selectClassName()}
          value={serverId}
          onChange={(event) => setServerId(event.target.value)}
        >
          <option value="">all listed tools</option>
          {serverOptions.map((serverId) => (
            <option key={serverId} value={serverId}>{serverId}</option>
          ))}
        </select>
        <select
          className={selectClassName()}
          value={presetId}
          onChange={(event) => setPresetId(event.target.value as SettingsMcpPolicyPresetId)}
        >
          {SETTINGS_MCP_POLICY_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>{preset.label}</option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          className="h-8 rounded-sm text-xs"
          onClick={() => applyPreset(presetId, serverId)}
        >
          Apply
        </Button>
      </div>
      <div className="flex items-center justify-between gap-2 text-3xs text-muted-foreground">
        <span>{SETTINGS_MCP_POLICY_PRESETS.map((preset) => preset.label).join(' · ')}</span>
        <Button
          type="button"
          variant="ghost"
          className="h-7 rounded-sm px-2 text-2xs"
          onClick={() => clearScope(serverId)}
        >
          <Eraser className="h-3.5 w-3.5" />
          Clear scope
        </Button>
      </div>
    </div>
  );
}
