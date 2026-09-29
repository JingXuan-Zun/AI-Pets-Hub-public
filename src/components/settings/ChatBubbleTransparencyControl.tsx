import { Slider } from '../../../components/ui/slider';
import { clampChatBubbleTransparency, resolveChatBubbleBackgroundStyle } from '../../chatAppearanceSettings';

export function ChatBubbleTransparencyControl({ value, onChange }: {
  value: number;
  onChange: (value: number) => void;
}) {
  const transparency = clampChatBubbleTransparency(value);
  return (
    <div className="space-y-3 sm:col-span-3">
      <div className="flex items-center justify-between text-2xs font-semibold text-muted-foreground">
        <span>气泡背景透明度</span><output className="font-mono text-primary">{transparency}%</output>
      </div>
      <Slider aria-label="气泡背景透明度" min={0} max={100} step={1} value={[transparency]}
        onValueChange={([next]) => { if (next !== undefined) onChange(next); }} />
      <p className="text-2xs text-muted-foreground">0% 不透明，100% 背景透明；文字和头像不受影响。保存后保留设置。</p>
      <div className="rounded-lg bg-gradient-to-r from-sky-200 to-violet-200 p-3">
        <div className="rounded-xl border border-border px-4 py-3 text-xs text-slate-900"
          style={resolveChatBubbleBackgroundStyle(transparency)}>气泡预览：文字始终保持清晰。</div>
      </div>
    </div>
  );
}
