import { RotateCcw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  applyMcpToolPolicyDraftToConfigText,
  getMcpToolPolicyDraft,
  type SettingsMcpToolPolicyDraft,
  type SettingsMcpToolPolicyModeDraft,
} from './settingsMcpPolicyConfigUtils';

interface SettingsMcpToolPolicyTableProps {
  configText: string;
  onConfigTextChange: (text: string) => void;
  onFeedback: (message: string) => void;
  tools: DesktopPetMcpToolLike[];
}

function createDraftKey(tool: DesktopPetMcpToolLike) {
  return `${tool.serverId}/${tool.name}`;
}

function selectClassName() {
  return 'h-8 w-full rounded-sm border border-border bg-background/70 px-2 text-xs outline-none focus:border-primary';
}

function updateDraft(
  draft: SettingsMcpToolPolicyDraft,
  updates: Partial<SettingsMcpToolPolicyDraft>,
) {
  return { ...draft, ...updates };
}

export function SettingsMcpToolPolicyTable({
  configText,
  onConfigTextChange,
  onFeedback,
  tools,
}: SettingsMcpToolPolicyTableProps) {
  const [drafts, setDrafts] = useState<Record<string, SettingsMcpToolPolicyDraft>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(tools.map((tool) => [
      createDraftKey(tool),
      getMcpToolPolicyDraft(configText, tool),
    ])));
  }, [configText, tools]);

  const setToolDraft = (tool: DesktopPetMcpToolLike, updates: Partial<SettingsMcpToolPolicyDraft>) => {
    const key = createDraftKey(tool);
    setDrafts((current) => ({
      ...current,
      [key]: updateDraft(current[key] ?? getMcpToolPolicyDraft(configText, tool), updates),
    }));
  };

  const applyToolDraft = (tool: DesktopPetMcpToolLike) => {
    const draft = drafts[createDraftKey(tool)] ?? getMcpToolPolicyDraft(configText, tool);
    const result = applyMcpToolPolicyDraftToConfigText(configText, tool, draft);
    if (result.error) {
      onFeedback(result.error);
      return;
    }

    onConfigTextChange(result.rawText);
    onFeedback(`MCP policy updated for ${tool.serverId}/${tool.name}. Save config to make it active.`);
  };

  if (!tools.length) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="font-mono text-2xs text-foreground">tool policies</div>
      <div className="space-y-2">
        {tools.map((tool) => {
          const key = createDraftKey(tool);
          const draft = drafts[key] ?? getMcpToolPolicyDraft(configText, tool);
          return (
            <div key={key} className="grid gap-2 sm:grid-cols-[1fr_92px_88px_96px_68px]">
              <div className="min-w-0">
                <div className="truncate font-mono text-2xs text-foreground">{key}</div>
                <div className="truncate text-3xs text-muted-foreground">{tool.title}</div>
              </div>
              <select
                className={selectClassName()}
                value={draft.mode}
                onChange={(event) => setToolDraft(tool, {
                  mode: event.target.value as SettingsMcpToolPolicyModeDraft,
                })}
              >
                <option value="inherit">inherit</option>
                <option value="allow">allow</option>
                <option value="deny">deny</option>
              </select>
              <Input
                className="h-8 rounded-sm border-border bg-background/70 text-xs"
                inputMode="numeric"
                placeholder="retry"
                value={draft.retryCountText}
                onChange={(event) => setToolDraft(tool, { retryCountText: event.target.value })}
              />
              <Input
                className="h-8 rounded-sm border-border bg-background/70 text-xs"
                inputMode="numeric"
                placeholder="timeout"
                value={draft.timeoutMsText}
                onChange={(event) => setToolDraft(tool, { timeoutMsText: event.target.value })}
              />
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon-sm" title="Apply" onClick={() => applyToolDraft(tool)}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="Reset"
                  onClick={() => setToolDraft(tool, { mode: 'inherit', retryCountText: '', timeoutMsText: '' })}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
