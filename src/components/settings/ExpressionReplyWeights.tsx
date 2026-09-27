import { type ExpressionReplySettings, calculateEffectiveExpressionReplySettings, calculateExpressionReplyPercentages } from '../../expression/expressionSettings';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';
import type { ExpressionLibraryReadiness } from '../../expression/expressionLibraryReadiness';
import { Button } from '../../../components/ui/button';

interface ExpressionReplyWeightsProps {
  imageCandidateCount: number;
  settings: ExpressionReplySettings;
  onChange: (settings: ExpressionReplySettings) => void;
  readiness?: ExpressionLibraryReadiness | null;
  onReview?: () => void;
  onRefresh?: () => void;
}

const CHANNELS = [
  { key: 'imageStickerWeight', label: '图片表情', hint: '用户表情库' },
  { key: 'kaomojiWeight', label: '颜文字', hint: '(｡･ω･｡)ﾉ♡' },
  { key: 'systemEmojiWeight', label: 'Emoji', hint: '😊 🎉 👍' },
] as const;

export function ExpressionReplyWeights({ imageCandidateCount, settings, onChange, readiness, onReview, onRefresh }: ExpressionReplyWeightsProps) {
  const effectiveSettings = calculateEffectiveExpressionReplySettings(settings, imageCandidateCount);
  const percentages = calculateExpressionReplyPercentages(effectiveSettings);
  const percentageByKey = {
    imageStickerWeight: percentages.imageSticker,
    kaomojiWeight: percentages.kaomoji,
    systemEmojiWeight: percentages.systemEmoji,
  };
  const sliderStyle = (value: number, min = 0, max = 100) => {
    const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min || 1)) * 100));
    return { background: `linear-gradient(to right, #00BFFF 0%, #00BFFF ${percentage}%, #BAE6FD ${percentage}%, #BAE6FD 100%)` };
  };
  const sliderClassName = "mt-1 h-1.5 w-full appearance-none rounded-full disabled:opacity-45 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#00BFFF] [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[#00BFFF]";

  return (
    <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">回复方式占比</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">自动换算比例；全为 0 时仅回复文字。</p>
        </div>
        <SettingsToggleSwitch checked={settings.enabled} label="启用表情回复" onChange={(enabled) => onChange({ ...settings, enabled })} />
      </div>

      <div className="mt-3 space-y-2.5">
        {CHANNELS.map((channel) => (
          <label className="block" key={channel.key}>
            <span className="flex items-center justify-between text-xs font-medium">
              <span>{channel.label} <span className="font-normal text-muted-foreground">· {channel.hint}</span></span>
              <span>权重 {settings[channel.key]} · 可用占比 {settings.enabled ? percentageByKey[channel.key] : 0}%</span>
            </span>
            <input
              className={sliderClassName}
              disabled={!settings.enabled || (channel.key === 'imageStickerWeight' && (!settings.imageLibraryEnabled || imageCandidateCount === 0))}
              max="100"
              min="0"
              step="1"
              type="range"
              value={settings[channel.key]}
              style={sliderStyle(settings[channel.key])}
              onChange={(event) => onChange({ ...settings, [channel.key]: Number(event.target.value) })}
            />
          </label>
        ))}
      </div>

      {settings.imageLibraryEnabled && !settings.imageLibraryMode ? (
        <p className="mt-2 rounded-md bg-secondary/40 px-2.5 py-2 text-[11px] text-muted-foreground">请先在下方选择“应用托管库”或“外部目录库”；选择前图片实际占比为 0。</p>
      ) : settings.imageLibraryEnabled ? (
        <div className="mt-2 space-y-2 rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-[11px] text-muted-foreground" role="status">
          {readiness ? <>
            <p>已导入 {readiness.total} 张 · 可用于回复 {readiness.ready} 张 · 待审核 {readiness.pending} 张 · 待重新归类 {readiness.unassigned} 张 · 文件失效 {readiness.missing} 张</p>
            {readiness.total === 0 ? <p>当前所选图库尚未识别到图片。请在下方导入图片；若已从文件夹添加，请点击“重新检查图库”。</p>
              : readiness.ready === 0 ? <p>图片可用占比为 0：{readiness.pending > 0 ? '请在批量处理选中图片，点击“通过审核”。' : readiness.unassigned > 0 ? '请先将图片移动到一个分类，再通过审核。' : '请检查图片路径及分类文件夹是否存在，再重新检查图库。'}上传或调整权重不会自动通过审核。</p>
              : <p>已审核图片可参与回复；100% 表示有合适表情时只选图片，并非每条回复强制发图。</p>}
          </> : <p>尚未取得所选图库的图片状态，请重新检查图库；加载失败详情见下方。</p>}
          <div className="flex flex-wrap gap-2">
            {readiness && readiness.pending + readiness.unassigned > 0 && onReview ? <Button type="button" size="sm" variant="outline" onClick={onReview}>查看待审核图片</Button> : null}
            {onRefresh ? <Button type="button" size="sm" variant="outline" onClick={onRefresh}>重新检查图库</Button> : null}
          </div>
        </div>
      ) : null}

      <label className="mt-3 block border-t border-border pt-2.5 text-xs font-medium">
        近期去重：{settings.recentExpressionWindow} 条
        <input
          className={sliderClassName}
          disabled={!settings.enabled}
          max="20"
          min="1"
          type="range"
          value={settings.recentExpressionWindow}
          style={sliderStyle(settings.recentExpressionWindow, 1, 20)}
          onChange={(event) => onChange({ ...settings, recentExpressionWindow: Number(event.target.value) })}
        />
        <span className="ml-2 text-[11px] font-normal text-muted-foreground">避开近期相同表达</span>
      </label>
    </section>
  );
}
