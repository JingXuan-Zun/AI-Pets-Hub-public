import { Bot, Download, ExternalLink, Image, Package, Store, UserRound } from 'lucide-react';
import { PersonaCommunityPanel } from './PersonaCommunityPanel';
import { SettingsPluginMarketplaceTab } from './SettingsPluginMarketplaceTab';

export type SettingsExtensionHubCategory = 'overview' | 'plugins' | 'personas' | 'external' | 'resources' | 'deepseek-harness';
const CATEGORY_COPY: Record<SettingsExtensionHubCategory, { description: string; icon: typeof Store; title: string; status: string }> = {
  overview: { description: '从一个入口发现、预览和管理插件、人格、外部接入与资源包。', icon: Store, title: '扩展中心', status: '分类预览' },
  plugins: { description: '查看插件市场与插件发布信息。Skill 的导入和管理位于 Skills 页面。', icon: Package, title: '插件', status: '市场筹备' },
  personas: { description: '发现、导入和分享可复用的人格与角色预设，不默认包含可执行代码。', icon: UserRound, title: '人格分享', status: '可导入预设' },
  external: { description: '连接 MCP、工作流、其他桌宠和外部 AI 项目；外部项目默认保持独立边界。', icon: ExternalLink, title: '外部接入', status: '按需连接' },
  resources: { description: '管理模型、声音、动作、表情、背景和主题等非执行资源。', icon: Image, title: '资源包', status: '本地资源' },
  'deepseek-harness': { description: 'DeepSeek Harness 作为未来可选的 Agent 能力扩展方向；当前不作为本地桌宠聊天或插件市场的前置依赖。', icon: Bot, title: 'DeepSeek Harness 能力扩展', status: '规划中' },
};

const EMPTY_CATEGORY_COPY: Record<'personas' | 'external' | 'resources', { description: string; title: string }> = {
  personas: { title: '还没有可浏览的人格分享', description: '后续可以从本地文件或受信任来源导入 Persona 与 Character Preset。' },
  external: { title: '还没有外部接入项目', description: 'MCP 和 ComfyUI 等现有连接入口仍可从对应的管理页配置。' },
  resources: { title: '还没有可浏览的资源包', description: '本地模型库、动作表情和声音资源会逐步接入这里。' },
};

function EmptyExtensionCategory({ category }: { category: 'personas' | 'external' | 'resources' }) { const copy = EMPTY_CATEGORY_COPY[category]; return <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/10 px-5 py-12 text-center"><div className="text-sm font-semibold text-foreground">{copy.title}</div><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-muted-foreground">{copy.description}</p><div className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-2xs text-muted-foreground"><Download className="h-3.5 w-3.5" />后续接入分类内容</div></div>; }

export function SettingsExtensionHubTab({ category, currentPetId = 'primary' }: { category: SettingsExtensionHubCategory; currentPetId?: string }) {
  const copy = CATEGORY_COPY[category]; const Icon = copy.icon;
  return <div className="m-0"><section className="rounded-lg border border-border bg-card p-5 shadow-sm" aria-label={copy.title}><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-base font-bold text-foreground">{copy.title}</h2><span className="rounded-full border border-border px-2 py-0.5 text-2xs text-muted-foreground">{copy.status}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy.description}</p></div></div>{category === 'plugins' ? <div className="mt-5"><SettingsPluginMarketplaceTab /></div> : category === 'personas' ? <div className="mt-5"><PersonaCommunityPanel /></div> : category === 'overview' ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{(['plugins', 'personas', 'external', 'resources'] as const).map((item) => { const itemCopy = CATEGORY_COPY[item]; const ItemIcon = itemCopy.icon; return <article key={item} className="rounded-lg border border-border bg-muted/10 p-4"><ItemIcon className="h-5 w-5 text-primary" /><h3 className="mt-3 text-sm font-semibold text-foreground">{itemCopy.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{itemCopy.description}</p></article>; })}</div> : category === 'deepseek-harness' ? <div className="mt-5 rounded-lg border border-dashed border-border bg-muted/10 px-5 py-10 text-center"><div className="text-sm font-semibold text-foreground">能力扩展规划中</div><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-muted-foreground">未来可研究将 DeepSeek Harness 作为可选 Agent Provider 接入；当前不启用外部安装，不替换现有 Production Runtime。</p></div> : <EmptyExtensionCategory category={category} />}</section></div>;
}
