import { Download, Eye, Store, Upload } from 'lucide-react';

const MARKETPLACE_FUTURE_FEATURES = [
  {
    description: '用户可提交自己的插件和版本说明。',
    icon: Upload,
    title: '上传发布',
  },
  {
    description: '其他用户可查看插件介绍、截图与版本信息。',
    icon: Eye,
    title: '预览插件',
  },
  {
    description: '确认需要后再下载和安装对应插件。',
    icon: Download,
    title: '下载使用',
  },
];

/**
 * The plugin page is intentionally separate from the generic system settings.
 * It is the future user-to-user marketplace entry, not a home for MCP, logs,
 * chat appearance, or other unrelated configuration.
 */
export function SettingsPluginMarketplaceTab() {
  return (
    <div className="m-0">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="插件市场">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground">插件市场</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              这里将用于用户上传、预览与下载插件。市场功能尚在准备中，当前不放置聊天、MCP、日志等无关设置。
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {MARKETPLACE_FUTURE_FEATURES.map(({ description, icon: Icon, title }) => (
            <article key={title} className="rounded-md border border-border bg-muted/20 p-3">
              <Icon className="h-4 w-4 text-primary" />
              <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-2xs leading-5 text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
          暂无可浏览或下载的插件。
        </div>
      </section>
    </div>
  );
}
