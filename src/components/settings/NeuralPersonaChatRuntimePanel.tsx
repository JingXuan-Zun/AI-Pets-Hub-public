import type { NeuralPersonaGraphSectionState } from './useNeuralPersonaGraphSectionState';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

function modeMessage(enabled: boolean, status: NeuralPersonaGraphSectionState['status']) {
  if (!enabled) return '当前聊天输入：Classic 人格';
  if (status === 'ready') return '当前聊天输入：Neural 神经人格（仅单聊测试）';
  if (status === 'loading') return '正在检查图谱；聊天时不可用会自动回退 Classic。';
  if (status === 'missing') return '尚未生成图谱；聊天将自动回退 Classic。';
  if (status === 'error') return '图谱当前不可用；聊天将自动回退 Classic。';
  return '神经人格编辑器未启用；聊天将使用 Classic。';
}

export function NeuralPersonaChatRuntimePanel(props: {
  enabled: boolean;
  graphStatus: NeuralPersonaGraphSectionState['status'];
  onChange: (enabled: boolean) => void;
}) {
  const ready = props.enabled && props.graphStatus === 'ready';
  return (
    <section className={`rounded-sm border p-4 ${ready
      ? 'border-emerald-400/50 bg-emerald-400/10'
      : 'border-border bg-secondary/20'}`}>
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-foreground">
            单聊使用神经人格
          </span>
          <span className="mt-1 block text-[10px] leading-4 text-muted-foreground">
            开启后，本角色单聊会检索并发送已激活节点给大模型。群聊暂不接入。
          </span>
        </span>
        <SettingsToggleSwitch checked={props.enabled} hideLabel label="单聊使用神经人格" onChange={props.onChange} />
      </label>
      <div className={`mt-3 text-[10px] font-medium ${ready
        ? 'text-emerald-300'
        : 'text-muted-foreground'}`}>
        {modeMessage(props.enabled, props.graphStatus)}
      </div>
      <p className="mt-1 text-[9px] leading-4 text-muted-foreground">
        图谱缺失、损坏或读取失败时不会阻断聊天，而会记录原因并回退 Classic。
      </p>
    </section>
  );
}
