import { useState, type CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Slider } from '../../../components/ui/slider';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { analyzeAgentGameSnapshot } from '../../services/geminiService';
import type { PetConfig } from '../../types';
import {
  formatGameCompanionObservationRate,
  MAX_GAME_COMPANION_OBSERVATION_INTERVAL_MS,
  MIN_GAME_COMPANION_OBSERVATION_INTERVAL_MS,
  normalizeGameCompanionObservationInterval,
} from '../../gameCompanionSettings';

interface SettingsGameCompanionTabProps {
  config: PetConfig;
  noDragRegionStyle?: CSSProperties;
  onApplyConfig: (config: PetConfig) => void;
}

function parseGameScanResult(rawText: string) {
  const normalized = rawText.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
  const start = normalized.indexOf('{');
  const end = normalized.lastIndexOf('}');
  const jsonText = start >= 0 && end > start ? normalized.slice(start, end + 1) : normalized;
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const name = typeof parsed.detectedGameOrGenre === 'string' ? parsed.detectedGameOrGenre.trim() : '';
    const evidence = typeof parsed.gameIdentityEvidence === 'string' ? parsed.gameIdentityEvidence.trim() : '';
    return { name: name && !/未知|不确定|无法识别|游戏类型/iu.test(name) ? name : '', evidence };
  } catch {
    return { name: '', evidence: '' };
  }
}

export function SettingsGameCompanionTab({ config, noDragRegionStyle, onApplyConfig }: SettingsGameCompanionTabProps) {
  const [sources, setSources] = useState<DesktopPetCaptureSourceLike[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [scanFeedback, setScanFeedback] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const intervalMs = normalizeGameCompanionObservationInterval(config.settings.gameCompanionObservationIntervalMs);
  const applyInterval = (value: number | undefined) => {
    if (value === undefined) return;
    onApplyConfig({
      ...config,
      settings: {
        ...config.settings,
        gameCompanionObservationIntervalMs: normalizeGameCompanionObservationInterval(value),
      },
    });
  };
  const refreshSources = async () => {
    setScanBusy(true);
    setScanFeedback('正在读取可捕获的游戏窗口...');
    try {
      const result = await desktopPetShellRuntime.listCaptureSources({
        captureSourceTypes: ['window'], forceRefresh: true, includeCaptureThumbnails: true,
      });
      const nextSources = Array.isArray(result) ? result.filter((source) => Boolean(source.thumbnail)) : [];
      setSources(nextSources);
      setSelectedSourceId((current) => current && nextSources.some((source) => source.id === current)
        ? current : (nextSources[0]?.id ?? ''));
      setScanFeedback(nextSources.length ? '请选择游戏窗口，然后点击“手动扫描”。' : '没有找到带预览的游戏窗口，请先打开游戏并保持窗口可见。');
    } catch (error) {
      setScanFeedback(error instanceof Error ? error.message : '读取游戏窗口失败。');
    } finally { setScanBusy(false); }
  };
  const scanGame = async () => {
    const source = sources.find((candidate) => candidate.id === selectedSourceId);
    if (!source?.thumbnail) {
      setScanFeedback('请先读取并选择一个游戏窗口。');
      return;
    }
    setScanBusy(true);
    setScanFeedback('正在扫描游戏画面并识别游戏名称...');
    try {
      const result = await analyzeAgentGameSnapshot({
        gameHint: config.settings.gameCompanionGameName,
        gameIdentityMetadata: `捕获窗口标题：${source.name}`,
        imageDataUrl: source.thumbnail,
        question: '请优先识别当前具体游戏名称；只有证据不足时才返回游戏类型，并说明不确定原因。',
        settings: config.settings,
        sourceLabel: source.name,
      });
      const parsed = parseGameScanResult(result);
      if (!parsed.name) {
        setScanFeedback(`未能可靠识别具体游戏。${parsed.evidence ? `依据：${parsed.evidence}` : '请补充游戏名称或重新扫描。'}`);
        return;
      }
      onApplyConfig({ ...config, settings: {
        ...config.settings,
        gameCompanionGameName: parsed.name,
      } });
      setScanFeedback(`已识别并保存：${parsed.name}${parsed.evidence ? ` · ${parsed.evidence}` : ''}`);
    } catch (error) {
      setScanFeedback(error instanceof Error ? error.message : '游戏扫描失败。');
    } finally { setScanBusy(false); }
  };

  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/20 p-4">
      <details className="rounded-sm border border-border bg-background/30 p-3">
        <summary className="cursor-pointer text-2xs font-bold uppercase tracking-widest text-muted-foreground">高级：桌面活动感知</summary>
        <div className="mt-3 space-y-2">
          <button type="button" onClick={() => onApplyConfig({ ...config, settings: { ...config.settings, lifeCompanion: { ...config.settings.lifeCompanion, desktopActivityAwarenessEnabled: !config.settings.lifeCompanion.desktopActivityAwarenessEnabled } } })} className={`flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left text-xs ${config.settings.lifeCompanion.desktopActivityAwarenessEnabled ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-secondary/30 text-muted-foreground'}`}>
            <span>感知前台应用类型并主动互动</span><span>{config.settings.lifeCompanion.desktopActivityAwarenessEnabled ? '已开启' : '已关闭'}</span>
          </button>
          <p className="text-2xs leading-5 text-muted-foreground">只识别浏览器、视频软件、办公软件等应用类别，不读取网页正文、文档内容或屏幕画面。</p>
        </div>
      </details>
      <div>
        <div className="text-2xs font-bold uppercase tracking-widest text-primary">游戏陪玩</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          调整陪玩获取游戏画面的频率。这里的“帧”是一次画面采样，不是视频录制帧率；模型分析会保持单线程，避免高频设置造成请求堆积。
        </p>
      </div>
      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <div>
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">游戏身份资料</Label>
          <p className="mt-1 text-2xs leading-5 text-muted-foreground">可以手动填写，模型会优先参考这些资料，不再仅凭截图猜测。</p>
        </div>
        <Input value={config.settings.gameCompanionGameName} onChange={(event) => onApplyConfig({ ...config, settings: { ...config.settings, gameCompanionGameName: event.target.value } })} placeholder="游戏名称，例如：英雄联盟" style={noDragRegionStyle} />
        <textarea value={config.settings.gameCompanionGameDescription} onChange={(event) => onApplyConfig({ ...config, settings: { ...config.settings, gameCompanionGameDescription: event.target.value } })} placeholder="游戏介绍、版本、玩法或需要关注的内容" className="min-h-20 w-full rounded-sm border border-border bg-secondary p-3 text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary" style={noDragRegionStyle} />
      </div>
      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">手动扫描游戏</Label>
            <p className="mt-1 text-2xs text-muted-foreground">读取可见窗口并扫描选中的游戏画面。</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={scanBusy} onClick={() => void refreshSources()}>读取窗口</Button>
            <Button type="button" size="sm" disabled={scanBusy || !selectedSourceId} onClick={() => void scanGame()}>手动扫描</Button>
          </div>
        </div>
        <select value={selectedSourceId} onChange={(event) => setSelectedSourceId(event.target.value)} className="h-9 w-full rounded-sm border border-border bg-background px-2 text-xs text-foreground" style={noDragRegionStyle}>
          <option value="">请选择游戏窗口</option>
          {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
        </select>
        {scanFeedback ? <div className="text-2xs leading-5 text-muted-foreground">{scanFeedback}</div> : null}
      </div>
      <div className="space-y-3 rounded-sm border border-border bg-background/30 p-3">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">观察频率</Label>
          <span className="font-mono text-2xs text-primary">
            {Number((intervalMs / 1000).toFixed(1))} 秒 / 次 · {formatGameCompanionObservationRate(intervalMs)}
          </span>
        </div>
        <Slider
          aria-label="游戏陪玩观察间隔"
          min={MIN_GAME_COMPANION_OBSERVATION_INTERVAL_MS / 1000}
          max={MAX_GAME_COMPANION_OBSERVATION_INTERVAL_MS / 1000}
          step={0.1}
          value={[intervalMs / 1000]}
          onValueChange={(value) => applyInterval(value[0] === undefined ? undefined : value[0] * 1000)}
          style={noDragRegionStyle}
        />
        <div className="flex justify-between text-2xs text-muted-foreground">
          <span>0.2 秒（5 次采样/秒）</span>
          <span>10 秒（0.1 次采样/秒）</span>
        </div>
      </div>
      <div className="rounded-sm border border-sky-200 bg-sky-50 px-3 py-2 text-2xs leading-5 text-sky-800">
        新间隔会保存到当前配置；正在运行的陪玩循环将在下一次开启或重启时使用。回复冷却至少为 5 秒，且只有检测到明显变化才回复。模型分析期间不会并发提交旧请求。
        最终陪玩回复会继续经过当前桌宠的人格、记忆和知识提示词生成。
      </div>
    </section>
  );
}
