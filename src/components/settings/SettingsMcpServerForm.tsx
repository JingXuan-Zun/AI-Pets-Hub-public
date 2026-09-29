import { useEffect, useMemo, useState } from 'react';
import { Loader2, PlayCircle, Plus, ScanSearch, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import {
  applyMcpServerDraftToConfigText,
  createEmptyMcpServerDraft,
  parseMcpConfigText,
  removeMcpServerFromConfigText,
  type SettingsMcpServerDraft,
} from './settingsMcpConfigFormUtils';
import { SettingsMcpServerDraftPreflightPanel } from './SettingsMcpServerDraftPreflightPanel';
import { SettingsMcpServerEnvironmentPreflightPanel } from './SettingsMcpServerEnvironmentPreflightPanel';
import { SettingsMcpServerTemplatePanel } from './SettingsMcpServerTemplatePanel';
import {
  createSettingsMcpServerDraftApplyGate,
  createSettingsMcpServerDraftPreflight,
} from './settingsMcpServerDraftPreflight';

function inputClassName() {
  return 'h-9 rounded-sm border-border bg-background/70 text-xs focus-visible:ring-primary';
}

function selectClassName() {
  return 'h-9 w-full rounded-sm border border-border bg-background/70 px-2 text-xs outline-none focus:border-primary';
}

interface SettingsMcpServerFormProps {
  configText: string;
  draft: SettingsMcpServerDraft;
  onConfigTextChange: (text: string) => void;
  onDraftChange: (draft: SettingsMcpServerDraft) => void;
  onFeedback: (message: string) => void;
  onTestServer?: (serverId: string) => void;
}

export function SettingsMcpServerForm({
  configText,
  draft,
  onConfigTextChange,
  onDraftChange,
  onFeedback,
  onTestServer,
}: SettingsMcpServerFormProps) {
  const parsedConfig = parseMcpConfigText(configText);
  const draftPreflight = useMemo(
    () => createSettingsMcpServerDraftPreflight(draft),
    [draft],
  );
  const [environmentBusy, setEnvironmentBusy] = useState(false);
  const [environmentResult, setEnvironmentResult] = useState<DesktopPetMcpServerEnvironmentPreflightLike | null>(null);
  const servers = parsedConfig.servers;

  useEffect(() => {
    setEnvironmentResult(null);
  }, [draft]);

  const updateDraft = (updates: Partial<SettingsMcpServerDraft>) => {
    onDraftChange({ ...draft, ...updates });
  };

  const selectServer = (serverId: string) => {
    const server = servers.find((item) => item.id === serverId);
    if (server) onDraftChange(server);
  };

  const applyDraft = () => {
    const gate = createSettingsMcpServerDraftApplyGate(draftPreflight);
    if (!gate.canApply) {
      onFeedback(gate.message);
      return;
    }
    const result = applyMcpServerDraftToConfigText(configText, draft);
    if (result.error) {
      onFeedback(result.error);
      return;
    }
    onConfigTextChange(result.rawText);
    onFeedback('MCP server was applied to the JSON config. Save the config to activate it.');
  };

  const removeDraftServer = () => {
    if (!draft.id.trim()) {
      onDraftChange(createEmptyMcpServerDraft());
      return;
    }
    const result = removeMcpServerFromConfigText(configText, draft.id.trim());
    if (result.error) {
      onFeedback(result.error);
      return;
    }
    onConfigTextChange(result.rawText);
    onDraftChange(createEmptyMcpServerDraft());
    onFeedback('MCP server was removed from the JSON config. Save the config to apply the change.');
  };

  const testDraftServer = () => {
    const serverId = draft.id.trim();
    if (!serverId) {
      onFeedback('MCP server id is required before testing.');
      return;
    }
    onTestServer?.(serverId);
  };

  const preflightEnvironment = async () => {
    let env: Record<string, unknown>;
    try {
      const parsed = JSON.parse(draft.envJson.trim() || '{}') as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Environment JSON must be an object.');
      }
      env = parsed as Record<string, unknown>;
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Environment JSON is invalid.');
      return;
    }
    setEnvironmentBusy(true);
    try {
      const result = await desktopPetShellRuntime.preflightMcpServerEnvironment({
        server: {
          args: draft.argsText.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean),
          command: draft.command,
          cwd: draft.cwd,
          env,
          id: draft.id,
        },
      });
      setEnvironmentResult(result);
      onFeedback(`MCP host environment check: ${result.status}. No server process was started.`);
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'MCP host environment check failed.');
    } finally {
      setEnvironmentBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-sm border border-border/70 bg-background/35 p-3">
      <SettingsMcpServerTemplatePanel
        onSelectTemplate={(templateDraft, message) => {
          onDraftChange(templateDraft);
          onFeedback(message);
        }}
      />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_80px_80px_80px_110px]">
        <select
          className={selectClassName()}
          value={servers.some((server) => server.id === draft.id) ? draft.id : ''}
          onChange={(event) => selectServer(event.target.value)}
        >
          <option value="">Select saved MCP server</option>
          {servers.map((server) => (
            <option key={server.id} value={server.id}>{server.title || server.id}</option>
          ))}
        </select>
        <Button type="button" variant="secondary" className="h-9 rounded-sm text-xs" onClick={() => onDraftChange(createEmptyMcpServerDraft())}>
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
        <Button type="button" variant="destructive" className="h-9 rounded-sm text-xs" onClick={removeDraftServer}>
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </Button>
        <Button type="button" variant="outline" className="h-9 rounded-sm text-xs" onClick={testDraftServer}>
          <PlayCircle className="h-3.5 w-3.5" />
          Test
        </Button>
        <Button type="button" variant="outline" className="h-9 rounded-sm text-xs" disabled={environmentBusy} onClick={() => void preflightEnvironment()}>
          {environmentBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
          Check host
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input className={inputClassName()} value={draft.id} onChange={(event) => updateDraft({ id: event.target.value.trim() })} placeholder="Server id, for example filesystem" />
        <Input className={inputClassName()} value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="Display name" />
      </div>
      <Input className={inputClassName()} value={draft.command} onChange={(event) => updateDraft({ command: event.target.value })} placeholder="Command, for example node, python, or npx.cmd" />
      <Input className={inputClassName()} value={draft.cwd} onChange={(event) => updateDraft({ cwd: event.target.value })} placeholder="Working directory; leave empty for the project root" />

      <div className="grid gap-2 sm:grid-cols-2">
        <textarea
          className="min-h-[92px] w-full resize-y rounded-sm border border-border bg-background/70 p-2 font-mono text-2xs leading-5 outline-none focus:border-primary"
          spellCheck={false}
          value={draft.argsText}
          onChange={(event) => updateDraft({ argsText: event.target.value })}
          placeholder={'One argument per line\nserver.js\n--flag'}
        />
        <textarea
          className="min-h-[92px] w-full resize-y rounded-sm border border-border bg-background/70 p-2 font-mono text-2xs leading-5 outline-none focus:border-primary"
          spellCheck={false}
          value={draft.envJson}
          onChange={(event) => updateDraft({ envJson: event.target.value })}
          placeholder={'Environment JSON\n{"API_KEY":"..."}'}
        />
      </div>

      <SettingsMcpServerDraftPreflightPanel checks={draftPreflight.checks} status={draftPreflight.status} />
      {environmentResult ? <SettingsMcpServerEnvironmentPreflightPanel result={environmentResult} /> : null}
      <Button type="button" variant="outline" className="h-9 w-full rounded-sm text-xs" onClick={applyDraft}>
        Apply to JSON config
      </Button>
      {parsedConfig.error ? (
        <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-2xs text-destructive">
          {parsedConfig.error}
        </div>
      ) : null}
    </div>
  );
}
