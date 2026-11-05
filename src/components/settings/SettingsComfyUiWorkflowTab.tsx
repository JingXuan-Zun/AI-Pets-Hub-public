import { useRef, useState, type ChangeEvent } from 'react';
import { Boxes, FolderOpen, Network, RefreshCw, Star, Trash2, Upload } from 'lucide-react';
import type { ComfyUiSettings } from '../../comfyui/comfyUiSettings';
import {
  COMFY_UI_PROMPT_PLACEHOLDER, createComfyUiWorkflowEntry, describeComfyUiTarget, keepComfyUiTarget, listComfyUiTextInputs,
  type ComfyUiInputTarget, type ComfyUiWorkflowEntry,
} from '../../comfyui/comfyUiWorkflow';
import type { PetConfig } from '../../types';

// Connect the user's ComfyUI (local or cloud) and import workflows the character can draw with.
// Changes save immediately, like the model library; name and description when the field is left.

type CommitConfig = (updater: (config: PetConfig) => PetConfig) => unknown;

const targetKey = (target: ComfyUiInputTarget | null) => (target ? `${target.nodeId}\u0000${target.inputKey}` : '');

/** Which text box a prompt goes into: found on import, changeable by hand when the guess is wrong. */
function TargetPicker({ entry, label, onPick, target }: {
  entry: ComfyUiWorkflowEntry;
  label: string;
  onPick: (target: ComfyUiInputTarget | null) => void;
  target: ComfyUiInputTarget | null;
}) {
  const options = listComfyUiTextInputs(entry.workflow);
  return (
    <label className="min-w-0">
      {label}
      <select
        value={targetKey(target)}
        onChange={(event) => onPick(options.find((option) => targetKey(option) === event.target.value) ?? null)}
        className={`mt-1 h-8 w-full rounded-md border bg-background px-2 text-2xs outline-none focus:border-primary ${target ? 'border-border text-foreground' : 'border-destructive/50 text-destructive'}`}
      >
        <option value="">未找到 / 不填</option>
        {options.map((option) => (
          <option key={targetKey(option)} value={targetKey(option)}>{describeComfyUiTarget(entry.workflow, option)}</option>
        ))}
      </select>
    </label>
  );
}

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
  // Known after a connection test: whether our sync extension is loaded in that ComfyUI.
  const [syncExtension, setSyncExtension] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Set while choosing the new export for “更新”: the file replaces that workflow instead of adding one.
  const replacingIdRef = useRef('');

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
      setSyncExtension(Boolean(result.syncExtension));
      setFeedback(`连接成功${result.version ? `（ComfyUI ${result.version}` : '（'}${result.device ? `，${result.device}` : ''}），已保存。${result.syncExtension ? '同步扩展已装好。' : '还没装同步扩展（见下方）。'}`);
    } else {
      setFeedback(`连接失败：${result.error ?? '未知原因'}`);
    }
  };

  const importWorkflow = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';
    const replacing = comfyUi.workflows.find((entry) => entry.id === replacingIdRef.current);
    replacingIdRef.current = '';
    if (!file) return;
    try {
      if (replacing) {
        const fresh = { ...createComfyUiWorkflowEntry({ id: replacing.id, name: replacing.name, text: await file.text() }), sourceName: file.name.replace(/\.json$/iu, '') };
        const entry = {
          ...fresh,
          description: replacing.description,
          negative: keepComfyUiTarget(replacing.negative, fresh.workflow, fresh.negative),
          positive: keepComfyUiTarget(replacing.positive, fresh.workflow, fresh.positive),
        };
        updateComfyUi(onCommit, { workflows: comfyUi.workflows.map((item) => (item.id === entry.id ? entry : item)) });
        setFeedback(`已更新“${entry.name}”，之后画图用新的参数${entry.positive ? `，提示词写入 ${describeComfyUiTarget(entry.workflow, entry.positive)}` : '，但没找到放提示词的位置'}。`);
        return;
      }
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

  const updateWorkflow = (id: string, patch: Partial<Pick<ComfyUiWorkflowEntry, 'description' | 'name' | 'negative' | 'positive'>>) => {
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
        <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-foreground">
          一张图最多等
          <select value={comfyUi.timeoutSeconds} onChange={(event) => updateComfyUi(onCommit, { timeoutSeconds: Number(event.target.value) })}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs font-normal outline-none focus:border-primary">
            {/* No 5 minutes: 300 is read as the old default and moved to 15. */}
            {[[180, '3 分钟'], [600, '10 分钟'], [900, '15 分钟'], [1800, '30 分钟']].map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
            {[180, 600, 900, 1800].includes(comfyUi.timeoutSeconds) ? null : <option value={comfyUi.timeoutSeconds}>{Math.round(comfyUi.timeoutSeconds / 60)} 分钟</option>}
          </select>
          <span className="font-normal text-muted-foreground">带高清放大的工作流慢，等久一点</span>
        </label>
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

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="ComfyUI 同步扩展">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-foreground">
              自动同步 ComfyUI 里的改动
              {syncExtension === null ? null : (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-2xs font-semibold ${syncExtension ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {syncExtension ? '已装好' : '未安装'}
                </span>
              )}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              装上这个小扩展后，在 ComfyUI 网页里改了参数（尺寸、步数、开关…），她下次画图就直接用改过的，不用重新导出。
              装法：点右边按钮打开文件夹，把 ai-desktop-pet-sync 整个文件夹复制到 ComfyUI 的 custom_nodes 里（ComfyUI 在别的电脑上就拷过去），重启 ComfyUI，再点上面的“测试并保存”确认。
              ComfyUI 网页要开着才会同步；名字要和导入的工作流一样，或者正开着的就是它。
            </p>
          </div>
          <button type="button" onClick={() => void window.desktopPetShell?.comfyUi?.openExtensionFolder?.().then((result) => { if (!result.ok) setFeedback(`打不开扩展文件夹：${result.error ?? '未知原因'}`); })}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted">
            <FolderOpen className="h-3.5 w-3.5" />打开扩展文件夹
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
                在 ComfyUI 里用“导出 (API)”/“Save (API)”保存 JSON 再导入。提示词会写进连到采样器 positive 的文本节点；如果那段文字里有 {COMFY_UI_PROMPT_PLACEHOLDER}，只替换这一处，其余画质词保留。提示词由好几个文本框拼起来时，会优先用名叫“内容”“提示词”的那个，路上的开关画图时会自动拨过去；找错了就在下面手动选。没装同步扩展时用的是导入那一刻的副本：在 ComfyUI 里改了参数，要重新导出后点工作流旁的“更新”。
              </p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={(event) => void importWorkflow(event)} />
          <button type="button" onClick={() => { replacingIdRef.current = ''; fileInputRef.current?.click(); }}
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
                    <button type="button" onClick={() => { replacingIdRef.current = entry.id; fileInputRef.current?.click(); }}
                      title="在 ComfyUI 里改了参数后，重新“导出 (API)”一份选上，替换这个工作流（名字、说明、提示词位置不变）"
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-2xs font-semibold text-foreground hover:bg-muted">
                      <RefreshCw className="h-3.5 w-3.5" />更新
                    </button>
                    <button type="button" onClick={() => removeWorkflow(entry.id)} title={`删除 ${entry.name}`}
                      className="inline-flex h-8 items-center rounded-md border border-destructive/30 px-2.5 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input defaultValue={entry.description} onBlur={(event) => { if (event.target.value !== entry.description) updateWorkflow(entry.id, { description: event.target.value }); }}
                    placeholder="什么时候用它，例如“二次元立绘”“写实照片”（角色会按这个挑工作流）"
                    className="mt-2 h-8 w-full rounded-md border border-border bg-background px-2 text-2xs outline-none focus:border-primary" />
                  <div className="mt-2 grid gap-2 text-2xs text-muted-foreground sm:grid-cols-3">
                    <TargetPicker label="提示词写进" entry={entry} target={entry.positive} onPick={(positive) => updateWorkflow(entry.id, { positive })} />
                    <TargetPicker label="反向提示词写进" entry={entry} target={entry.negative} onPick={(negative) => updateWorkflow(entry.id, { negative })} />
                    <div className="self-end pb-1.5">随机种子：<span className="text-foreground">{entry.seeds.length} 个</span></div>
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
