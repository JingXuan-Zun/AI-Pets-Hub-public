import { RotateCcw, Save, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  applySettingsMcpFieldPolicyDraft,
  collectSettingsMcpSchemaFields,
  getSettingsMcpFieldPolicyDraft,
  type SettingsMcpFieldPolicyDraft,
  type SettingsMcpFieldPolicyMode,
} from './settingsMcpFieldPolicyUtils';

function toolKey(tool: DesktopPetMcpToolLike) {
  return `${tool.serverId}/${tool.name}`;
}

function draftKey(tool: DesktopPetMcpToolLike, path: string) {
  return `${toolKey(tool)}:${path}`;
}

export function SettingsMcpFieldPolicyTable({
  configText,
  onConfigTextChange,
  onFeedback,
  tools,
}: {
  configText: string;
  onConfigTextChange: (text: string) => void;
  onFeedback: (message: string) => void;
  tools: DesktopPetMcpToolLike[];
}) {
  const [selectedToolKey, setSelectedToolKey] = useState(() => tools[0] ? toolKey(tools[0]) : '');
  const [drafts, setDrafts] = useState<Record<string, SettingsMcpFieldPolicyDraft>>({});
  const selectedTool = tools.find((tool) => toolKey(tool) === selectedToolKey) ?? tools[0] ?? null;
  const fields = useMemo(
    () => selectedTool ? collectSettingsMcpSchemaFields(selectedTool.inputSchema ?? {}) : [],
    [selectedTool],
  );

  useEffect(() => {
    if (selectedTool && selectedToolKey !== toolKey(selectedTool)) setSelectedToolKey(toolKey(selectedTool));
  }, [selectedTool, selectedToolKey]);

  useEffect(() => {
    if (!selectedTool) return;
    setDrafts((current) => ({
      ...current,
      ...Object.fromEntries(fields.map((field) => [
        draftKey(selectedTool, field.path),
        getSettingsMcpFieldPolicyDraft(configText, selectedTool, field.path),
      ])),
    }));
  }, [configText, fields, selectedTool]);

  if (!selectedTool || !fields.length) return null;

  const updateDraft = (path: string, updates: Partial<SettingsMcpFieldPolicyDraft>) => {
    const key = draftKey(selectedTool, path);
    setDrafts((current) => ({
      ...current,
      [key]: { ...getSettingsMcpFieldPolicyDraft(configText, selectedTool, path), ...current[key], ...updates },
    }));
  };

  const applyDraft = (path: string) => {
    const draft = drafts[draftKey(selectedTool, path)]
      ?? getSettingsMcpFieldPolicyDraft(configText, selectedTool, path);
    const result = applySettingsMcpFieldPolicyDraft(configText, selectedTool, path, draft);
    if (result.error) return onFeedback(result.error);
    onConfigTextChange(result.rawText);
    onFeedback(`MCP field policy updated for ${toolKey(selectedTool)} ${path}. Save config to make it active.`);
  };

  const removeDraft = (path: string) => {
    const result = applySettingsMcpFieldPolicyDraft(configText, selectedTool, path, {
      mode: 'inherit',
      valuesText: '[]',
    });
    if (result.error) return onFeedback(result.error);
    setDrafts((current) => ({
      ...current,
      [draftKey(selectedTool, path)]: { mode: 'inherit', valuesText: '[]' },
    }));
    onConfigTextChange(result.rawText);
    onFeedback(`MCP field policy removed for ${toolKey(selectedTool)} ${path}. Save config to make it active.`);
  };

  return (
    <div className="space-y-2 rounded-sm border border-dashed border-border bg-background/30 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-2xs text-foreground">
          <ShieldAlert className="h-3.5 w-3.5 text-primary" />
          field permissions
        </div>
        <select
          className="h-8 min-w-0 max-w-full rounded-sm border border-border bg-background/70 px-2 font-mono text-2xs outline-none focus:border-primary"
          value={toolKey(selectedTool)}
          onChange={(event) => setSelectedToolKey(event.target.value)}
        >
          {tools.map((tool) => <option key={toolKey(tool)} value={toolKey(tool)}>{toolKey(tool)}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        {fields.map((field) => {
          const key = draftKey(selectedTool, field.path);
          const draft = drafts[key] ?? getSettingsMcpFieldPolicyDraft(configText, selectedTool, field.path);
          const valuesRequired = [
            'allow-array-values',
            'allow-values',
            'deny-array-values',
            'deny-values',
          ].includes(draft.mode);
          return (
            <div key={field.path} className="grid items-center gap-1 border-t border-border/50 py-1 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_132px_minmax(120px,1fr)_68px]">
              <div className="min-w-0">
                <div className="truncate font-mono text-3xs text-foreground">{field.path}</div>
                <div className="truncate text-3xs text-muted-foreground">{field.typeLabel}</div>
              </div>
              <select
                className="h-8 rounded-sm border border-border bg-background/70 px-2 text-2xs outline-none focus:border-primary"
                value={draft.mode}
                onChange={(event) => updateDraft(field.path, { mode: event.target.value as SettingsMcpFieldPolicyMode })}
              >
                <option value="inherit">inherit</option>
                <option value="deny-field">deny field</option>
                <option value="deny-values" disabled={!field.valuePolicySupported}>deny values</option>
                <option value="allow-values" disabled={!field.valuePolicySupported}>allow values</option>
                <option value="deny-array-values" disabled={!field.arrayItemValuePolicySupported}>deny array values</option>
                <option value="allow-array-values" disabled={!field.arrayItemValuePolicySupported}>allow array values</option>
              </select>
              <Input
                className="h-8 rounded-sm border-border bg-background/70 font-mono text-3xs"
                disabled={!valuesRequired}
                value={valuesRequired ? draft.valuesText : ''}
                onChange={(event) => updateDraft(field.path, { valuesText: event.target.value })}
              />
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="icon-sm" title="Apply field policy" onClick={() => applyDraft(field.path)}>
                  <Save className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="outline" size="icon-sm" title="Remove field policy" onClick={() => removeDraft(field.path)}>
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
