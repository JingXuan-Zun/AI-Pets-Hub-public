import type { PetConfig } from '../../types';

export function SettingsDesktopActivityAwarenessTab(props: {
  config: PetConfig;
  onApplyConfig: (config: PetConfig) => void;
}) {
  const enabled = props.config.settings.lifeCompanion.desktopActivityAwarenessEnabled;
  const update = (next: boolean) => props.onApplyConfig({
    ...props.config,
    settings: {
      ...props.config.settings,
      lifeCompanion: {
        ...props.config.settings.lifeCompanion,
        desktopActivityAwarenessEnabled: next,
      },
    },
  });
  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <div><div className="text-2xs font-bold uppercase tracking-widest text-primary">桌面活动感知</div><p className="mt-1 text-xs leading-5 text-muted-foreground">低频识别当前前台应用类别，并由桌宠在合适时机主动互动。</p></div>
      <button type="button" onClick={() => update(!enabled)} className={`flex w-full items-center justify-between rounded-sm border px-3 py-3 text-left text-xs ${enabled ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-background/30 text-muted-foreground'}`}>
        <span>感知前台应用类型并主动互动</span><span>{enabled ? '已开启' : '已关闭'}</span>
      </button>
      <div className="space-y-2 rounded-sm border border-border bg-background/30 p-3 text-2xs leading-5 text-muted-foreground"><p>支持识别：浏览器、视频软件、办公软件。</p><p>不会读取网页正文、文档内容或屏幕画面；群聊、故事模式、正在生成回复和语音播放时不会主动插话。</p><p>同一类别需要持续出现后才触发，并有 30 分钟冷却时间。</p></div>
    </section>
  );
}
