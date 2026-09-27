import type { CSSProperties } from 'react';
import type { PetConfig } from '../../types';

type SocialControlKey =
  | 'groupParallelRoleGenerationEnabled'
  | 'groupAutomaticMemoryWriteEnabled'
  | 'groupAutomaticRelationshipEvolutionEnabled'
  | 'groupAutomaticSubgroupEvolutionEnabled';

const CONTROLS: Array<{ key: SocialControlKey; label: string; description: string }> = [
  { key: 'groupParallelRoleGenerationEnabled', label: '多人并行生成', description: '允许同一批次的多个角色并行请求；消息仍按稳定顺序发布。' },
  { key: 'groupAutomaticMemoryWriteEnabled', label: '自动长期记忆', description: '当前仍处于候选/审核模式，默认关闭。' },
  { key: 'groupAutomaticRelationshipEvolutionEnabled', label: '自动关系演化', description: '当前仍需要人工审核关系候选，默认关闭。' },
  { key: 'groupAutomaticSubgroupEvolutionEnabled', label: '自动小团体演化', description: '当前只生成候选和审计，不自动建立或解散小团体。' },
];

export function SettingsGroupSocialControls(props: {
  config: PetConfig;
  noDragRegionStyle?: CSSProperties;
  onApplyConfig: (config: PetConfig) => void;
}) {
  const update = (key: SocialControlKey, enabled: boolean) => props.onApplyConfig({
    ...props.config,
    settings: { ...props.config.settings, [key]: enabled },
  });
  return (
    <section className="rounded-sm border border-border bg-secondary/20 p-4">
      <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">社会 Agent 开关</div>
      <div className="mt-1 text-2xs leading-4 text-muted-foreground">实验能力独立控制；关闭不会删除已有候选、关系或记忆。</div>
      <div className="mt-4 space-y-3">
        {CONTROLS.map((control) => (
          <label key={control.key} className="flex items-start gap-3 rounded-sm border border-border/70 bg-background/30 p-3">
            <input
              aria-label={control.label}
              checked={props.config.settings[control.key]}
              onChange={(event) => update(control.key, event.target.checked)}
              style={props.noDragRegionStyle}
              type="checkbox"
            />
            <span>
              <span className="block text-xs text-foreground">{control.label}</span>
              <span className="mt-1 block text-2xs leading-4 text-muted-foreground">{control.description}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
