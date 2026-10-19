import { useRef, useState, type ChangeEvent } from 'react';
import { Boxes, Network, Star, Trash2, Upload } from 'lucide-react';
import type { ComfyUiSettings } from '../../comfyui/comfyUiSettings';
import { COMFY_UI_PROMPT_PLACEHOLDER, createComfyUiWorkflowEntry, describeComfyUiTarget } from '../../comfyui/comfyUiWorkflow';
import type { PetConfig } from '../../types';

// Connect the user's ComfyUI (local or cloud) and import workflows the character can draw with.
// Changes save immediately, like the model library; name and description when the field is left.

type CommitConfig = (updater: (config: PetConfig) => PetConfig) => unknown;

function updateComfyUi(commit: CommitConfig, patch: Partial<ComfyUiSettings>, apiKey?: string) {
  commit((config) => ({
    ...config,
    settings: {
      ...config.settings,
      ...(apiKey === undefined ? {} : { comfyUiApiKey: apiKey }),
      comfyUi: { ...config.settings.comfyUi, ...patch },
    },
  }));
}

export function SettingsComfyUiWorkflowTab({ localConfig, onCommit }: { localConfig: PetConfig; onCommit: CommitConfig }) {
  const comfyUi = localConfig.settings.comfyUi;
  const [serverUrl, setServerUrl] = useState(comfyUi.serverUrl);
  const [apiKey, setApiKey] = useState(localConfig.settings.comfyUiApiKey);
  const [feedback, setFeedback] = useState('');
  const [testing, setTesting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const saveConnection = () => {
    updateComfyUi(onCommit, { serverUrl: serverUrl.trim() }, apiKey.trim());
    setFeedback('已保存连接设置。');
  };

  const testConnection = async () => {
    const bridge = window.desktopPetShell?.comfyUi;
    if (!bridge) {
      setFeedback('只能在桌面版里测试连接。');
      return;
    }
    setTesting(true);
    setFeedback('正在连接…');
    const result = await bridge.test({ apiKey: apiKey.trim(), serverUrl: serverUrl.trim() });
    setTesting(false);
    if (result.ok) {
      updateComfyUi(onCommit, { serverUrl: serverUrl.trim() }, apiKey.trim());
      setFeedback(`连接成功${result.version ? `（ComfyUI ${result.version}` : '（'}${result.device ? `，${result.device}` : ''}），已保存。`);
    } else {
      setFeedback(`连接失败：${result.error ?? '未知原因'}`);
    }
  };

  const importWorkflow = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    try {
      const entry = createComfyUiWorkflowEntry({
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `comfy-${Date.now()}`,
        name: file.name.replace(/\.json$/iu, ''),
        text: await file.text(),
      });
      updateComfyUi(onCommit, {
        defaultWorkflowId: comfyUi.defaultWorkflowId || entry.id,
        workflows: [...comfyUi.workflows, entry],
      });
      setFeedback(entry.positive
        ? `已导入“${entry.name}”：提示词写入 ${describeComfyUiTarget(entry.workflow, entry.positive)}${entry.seeds.length ? `，每次随机 ${entry.seeds.length} 个种子` : ''}。`
        : `已导入“${entry.name}”，但没找到放提示词的位置，角色暂时不能用它画图。`);
    } catch (error) {
      setFeedback(`导入失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const updateWorkflow = (id: string, patch: { description?: string; name?: string }) => {
    updateComfyUi(onCommit, { workflows: comfyUi.workflows.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) });
  };

  const removeWorkflow = (id: string) => {
    const workflows = comfyUi.workflows.filter((entry) => entry.id !== id);
    updateComfyUi(onCommit, { defaultWorkflowId: comfyUi.defaultWorkflowId === id ? workflows[0]?.id ?? '' : comfyUi.defaultWorkflowId, workflows });
  };

  return (
    <div className="m-0 space-y-4">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="ComfyUI 连接">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Network className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">连接 ComfyUI</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              本机或云端的 ComfyUI 都可以。连上并导入工作流后，在聊天里说“画一张……”，角色会从对话里提炼提示词，用工作流画好发给你。
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-foreground">
            服务地址
            <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="http://127.0.0.1:8188"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs font-normal outline-none focus:border-primary" />
          </label>
          <label className="text-xs font-semibold text-foreground">
            访问令牌（可选，云端或加了密码的服务才需要）
            <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="不需要就留空" autoComplete="off"
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-xs font-normal outline-none focus:border-primary" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={testing} onClick={() => void testConnection()}
            className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {testing ? '连接中…' : '测试并保存'}
          </button>
          <button type="button" onClick={saveConnection} className="h-8 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted">
            只保存
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="ComfyUI 工作流">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground">工作流</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                在 ComfyUI 里用“导出 (API)”/“Save (API)”保存 JSON 再导入。提示词会写进连到采样器 positive 的文本节点；如果那段文字里有 {COMFY_UI_PROMPT_PLACEHOLDER}，只替换这一处，其余画质词保留。
              </p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void importWorkflow(event)} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <Upload className="h-3.5 w-3.5" />导入工作流
          </button>
        </div>
        {feedback ? <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-2xs text-primary">{feedback}</div> : null}
        {comfyUi.workflows.length ? (
          <div className="mt-4 space-y-3">
            {comfyUi.workflows.map((entry) => {
              const isDefault = entry.id === comfyUi.defaultWorkflowId;
              return (
                <article key={entry.id} className={`rounded-md border p-3 ${isDefault ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/20'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input defaultValue={entry.name} onBlur={(event) => { if (event.target.value !== entry.name) updateWorkflow(entry.id, { name: event.target.value }); }} aria-label="工作流名称"
                      className="h-8 min-w-40 flex-1 rounded-md border border-border bg-background px-2 text-xs font-semibold outline-none focus:border-primary" />
                    <button type="button" onClick={() => updateComfyUi(onCommit, { defaultWorkflowId: entry.id })} disabled={isDefault}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-2xs font-semibold text-foreground hover:bg-muted disabled:border-primary/40 disabled:text-primary">
                      <Star className="h-3.5 w-3.5" />{isDefault ? '默认' : '设为默认'}
                    </button>
                    <button type="button" onClick={() => removeWorkflow(entry.id)} title={`删除 ${entry.name}`}
                      className="inline-flex h-8 items-center rounded-md border border-destructive/30 px-2.5 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input defaultValue={entry.description} onBlur={(event) => { if (event.target.value !== entry.description) updateWorkflow(entry.id, { description: event.target.value }); }}
                    placeholder="什么时候用它，例如“二次元立绘”“写实照片”（角色会按这个挑工作流）"
                    className="mt-2 h-8 w-full rounded-md border border-border bg-background px-2 text-2xs outline-none focus:border-primary" />
                  <div className="mt-2 grid gap-1 text-2xs text-muted-foreground sm:grid-cols-3">
                    <div>提示词：<span className={entry.positive ? 'text-foreground' : 'text-destructive'}>{describeComfyUiTarget(entry.workflow, entry.positive)}</span></div>
                    <div>反向提示词：<span className="text-foreground">{describeComfyUiTarget(entry.workflow, entry.negative)}</span></div>
                    <div>随机种子：<span className="text-foreground">{entry.seeds.length} 个</span></div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-border bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
            还没有工作流。导入一个之后，角色就能在聊天里画图了。
          </div>
        )}
      </section>
    </div>
  );
}
