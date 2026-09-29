import { useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import type { PetConfig } from '../../types';
import {
  buildDeepSeekHarnessAgentGoal,
  DEEPSEEK_HARNESS_AGENT_IMPORT_TEMPLATE,
  getSelectedDeepSeekHarnessAgentId,
  installDeepSeekHarnessAgent,
  loadDeepSeekHarnessAgents,
  parseDeepSeekHarnessAgentImport,
  removeDeepSeekHarnessAgent,
  setSelectedDeepSeekHarnessAgentId,
  type DeepSeekHarnessAgentDefinition,
} from '../../agent/deepseekHarnessAgentLibrary';

interface SettingsDeepSeekHarnessAgentWorkbenchProps {
  canRun: boolean;
  settings: PetConfig['settings'];
}

export function SettingsDeepSeekHarnessAgentWorkbench({
  canRun,
  settings,
}: SettingsDeepSeekHarnessAgentWorkbenchProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [agents, setAgents] = useState<DeepSeekHarnessAgentDefinition[]>(() => loadDeepSeekHarnessAgents());
  const [selectedAgentId, setSelectedAgentId] = useState(() => getSelectedDeepSeekHarnessAgentId());
  const [task, setTask] = useState('');
  const [feedback, setFeedback] = useState('');
  const [result, setResult] = useState('');
  const [running, setRunning] = useState(false);

  const selectAgent = (agentId: string) => {
    setSelectedDeepSeekHarnessAgentId(agentId);
    setSelectedAgentId(agentId);
  };
  const importAgent = async (file: File | null | undefined) => {
    if (!file) return;
    try {
      const parsed = parseDeepSeekHarnessAgentImport(await file.text());
      if (!parsed.agent) {
        setFeedback(parsed.error);
        return;
      }
      setAgents(installDeepSeekHarnessAgent(parsed.agent));
      selectAgent(parsed.agent.id);
      setFeedback('已安装并选中 Agent：' + parsed.agent.name);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '读取 Agent 文件失败。');
    }
  };
  const removeAgent = (agent: DeepSeekHarnessAgentDefinition) => {
    setAgents(removeDeepSeekHarnessAgent(agent.id));
    if (selectedAgentId === agent.id) {
      setSelectedAgentId('');
    }
  };
  const runTask = async () => {
    const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;
    setRunning(true);
    setFeedback('Harness 正在执行工作台任务...');
    setResult('');
    try {
      const response = await desktopPetShellRuntime.runDeepSeekHarness({
        apiKey: settings.deepseekHarnessApiKey,
        baseUrl: settings.deepseekHarnessBaseUrl,
        dshHome: settings.deepseekHarnessHome,
        model: settings.deepseekHarnessModel,
        pythonPath: settings.deepseekHarnessPythonPath,
        requestId: 'workbench-' + Date.now(),
        userGoal: buildDeepSeekHarnessAgentGoal(task.trim(), selectedAgent),
        workspace: settings.deepseekHarnessWorkspace,
      });
      if (!response.ok) {
        setFeedback(response.error ?? 'Harness 任务执行失败。');
        return;
      }
      setFeedback('Harness 工作台任务已完成。');
      setResult(response.finalResponse ?? '');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Harness 工作台任务执行失败。');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="space-y-3 rounded-sm border border-primary/30 bg-primary/5 p-3">
      <div>
        <h3 className="text-xs font-bold text-foreground">DeepSeek Harness 工作台</h3>
        <p className="mt-1 text-2xs leading-5 text-muted-foreground">
          导入的是声明式 Agent 配置，不会安装或执行任意脚本。选中的 Agent 会附加到工作台任务和之后的聊天 Agent 任务。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            void importAgent(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          导入 Harness Agent JSON
        </Button>
        <span className="self-center text-2xs text-muted-foreground">格式：ai-desktop-pet-harness-agent.v1</span>
      </div>      <details className="rounded-sm border border-border bg-background/50 px-3 py-2 text-2xs text-muted-foreground">
        <summary className="cursor-pointer font-semibold text-foreground">查看 Agent JSON 模板</summary>
        <pre className="custom-scrollbar mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-sm bg-background p-2 text-2xs text-foreground">{DEEPSEEK_HARNESS_AGENT_IMPORT_TEMPLATE}</pre>
      </details>

      {agents.length > 0 ? (
        <div className="space-y-2">
          {agents.map((agent) => {
            const selected = agent.id === selectedAgentId;
            return (
              <article key={agent.id} className={['rounded-sm border p-3', selected ? 'border-primary bg-primary/10' : 'border-border bg-background/60'].join(' ')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">{agent.name}</h4>
                    <p className="mt-1 text-2xs text-muted-foreground">{agent.description}</p>
                    <p className="mt-1 font-mono text-2xs text-muted-foreground">{agent.id}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => selectAgent(agent.id)}>
                      {selected ? '当前使用' : '设为当前'}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeAgent(agent)}>移除</Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-sm border border-dashed border-border p-3 text-center text-2xs text-muted-foreground">
          暂无已安装 Harness Agent。导入 JSON 后会显示在这里。
        </div>
      )}

      <div className="space-y-2 rounded-sm border border-border bg-background/60 p-3">
        <label className="block text-2xs font-semibold text-foreground" htmlFor="harness-workbench-task">工作台任务</label>
        <textarea
          id="harness-workbench-task"
          value={task}
          onChange={(event) => setTask(event.target.value)}
          placeholder="例如：阅读 Workspace 内的 README 和 package.json，列出风险与下一步。"
          className="min-h-24 w-full resize-y rounded-sm border border-border bg-background px-2 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/60"
        />
        <Button type="button" size="sm" disabled={!canRun || running || !task.trim()} onClick={() => void runTask()}>
          {running ? '正在运行...' : '在工作台运行'}
        </Button>
        {!canRun ? <p className="text-2xs text-amber-700">请先完成上方 Workspace、DSH_HOME 与 API Key 配置。</p> : null}
      </div>

      {feedback ? <p className="text-2xs text-muted-foreground">{feedback}</p> : null}
      {result ? <pre className="custom-scrollbar max-h-60 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-background p-3 text-2xs text-foreground">{result}</pre> : null}
    </section>
  );
}
