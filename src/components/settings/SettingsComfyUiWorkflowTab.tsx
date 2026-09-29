import { Boxes, Network, Play, Workflow } from 'lucide-react';

const COMFY_UI_FUTURE_STEPS = [
  {
    description: '连接本机或远程运行的 ComfyUI 服务。',
    icon: Network,
    title: '连接服务',
  },
  {
    description: '导入、预览和管理 ComfyUI 工作流 JSON。',
    icon: Workflow,
    title: '管理工作流',
  },
  {
    description: '按需执行工作流，并接收生成结果。',
    icon: Play,
    title: '执行任务',
  },
];

/** The workflow route is reserved for ComfyUI integration only. */
export function SettingsComfyUiWorkflowTab() {
  return (
    <div className="m-0">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="ComfyUI 工作流">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Boxes className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">ComfyUI 工作流</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              此页面只用于后续接入 ComfyUI 工作流。当前未接入服务，因此不显示聊天、联网、MCP、日志或其他无关设置。
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {COMFY_UI_FUTURE_STEPS.map(({ description, icon: Icon, title }) => (
            <article key={title} className="rounded-md border border-border bg-muted/20 p-3">
              <Icon className="h-4 w-4 text-primary" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-2xs leading-5 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
          ComfyUI 服务尚未接入。
        </div>
      </section>
    </div>
  );
}
