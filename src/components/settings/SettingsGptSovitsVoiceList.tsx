import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { type GptSovitsModelSummary, type PetConfig } from '../../types';
import { Button } from '../../../components/ui/button';
import { speakText, stopVoicePlayback } from '../../services/voiceService';
import { getVoiceErrorMessage, isVoiceCancellationError } from '../../voice/errorMessages';

type SettingsUpdater = (updates: Partial<PetConfig['settings']>) => void;

const KIND_LABELS: Record<GptSovitsModelSummary['kind'], { text: string; className: string }> = {
  full: { text: '训练版', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700' },
  lite: { text: '轻量版', className: 'border-sky-500/40 bg-sky-500/10 text-sky-700' },
};

const EMOTION_LABELS: Record<string, string> = {
  neutral: '平静', happy: '开心', sad: '难过', angry: '生气', surprised: '惊讶', gentle: '温柔', shy: '害羞',
};

function previewLine(name: string) {
  return `你好呀，我是${name}，以后就由我来陪着你啦。`;
}

// Every installed voice pack with its kind, emotions and a one-line preview in that voice.
export function SettingsGptSovitsVoiceList({ models, settings, selectedModelId, noDragRegionStyle, applySettings }: {
  models: GptSovitsModelSummary[];
  settings: PetConfig['settings'];
  selectedModelId: string;
  noDragRegionStyle?: CSSProperties;
  applySettings: SettingsUpdater;
}) {
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewTokenRef = useRef(0);

  useEffect(() => () => {
    previewTokenRef.current += 1;
    stopVoicePlayback();
  }, []);

  const stopPreview = () => {
    previewTokenRef.current += 1;
    stopVoicePlayback();
    setPreviewingId(null);
  };

  const preview = async (model: GptSovitsModelSummary) => {
    const token = ++previewTokenRef.current;
    setError(null);
    setPreviewingId(model.id);
    try {
      const session = await speakText(
        previewLine(model.name),
        { ...settings, ttsProvider: 'gpt-sovits', gptSovitsModelId: model.id },
        undefined,
        { force: true },
      );
      await session.done;
    } catch (previewError) {
      if (token === previewTokenRef.current && !isVoiceCancellationError(previewError)) {
        setError(getVoiceErrorMessage(previewError, '试听失败，请检查语音服务状态。'));
      }
    } finally {
      if (token === previewTokenRef.current) setPreviewingId(null);
    }
  };

  if (models.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">音色列表</div>
      {models.map((model) => {
        const kind = KIND_LABELS[model.kind];
        const isSelected = model.id === selectedModelId;
        const isPreviewing = previewingId === model.id;
        return (
          <div key={model.id} className="flex flex-wrap items-center gap-3 rounded-sm border border-border bg-background/50 p-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <span>{model.name}</span>
                <span className={'rounded-sm border px-1.5 py-0.5 text-2xs ' + kind.className}>{kind.text}</span>
                {isSelected && <span className="text-2xs text-primary">当前使用</span>}
              </div>
              <div className="text-2xs text-muted-foreground">
                情绪：{model.emotions.map((emotion) => EMOTION_LABELS[emotion] ?? emotion).join('、')}
                {model.author && ` · 制作：${model.author}`}
              </div>
              {model.description && <div className="text-2xs text-muted-foreground">{model.description}</div>}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={Boolean(previewingId) && !isPreviewing}
                onClick={() => (isPreviewing ? stopPreview() : void preview(model))}
                style={noDragRegionStyle}
              >
                {isPreviewing ? '停止' : '试听'}
              </Button>
              {!isSelected && (
                <Button size="sm" variant="outline" onClick={() => applySettings({ gptSovitsModelId: model.id })} style={noDragRegionStyle}>
                  使用
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {error && <div className="text-2xs text-red-700">{error}</div>}
      <div className="text-2xs text-muted-foreground">
        轻量版只用几段参考录音模仿声音，不用训练，像度稍低；训练版最像原声。第一次试听需要启动语音服务，会慢一些。
      </div>
    </div>
  );
}
