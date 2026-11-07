import { useEffect, useState } from 'react';
import type { BrowserTtsInstallProgress, PetConfig } from '../../types';
import { installStarterVoice, onGptSovitsInstallProgress } from '../../voice/gptSovitsRuntime';

// Top of the voice page: one click for 小玲's real voice (the starter pack). Installs the voice
// runtime (a portable Python too, when the computer has none) and her bundled voice, then switches
// to it. Hidden once she already speaks with it.

export const STARTER_VOICE_ID = 'xiaoling-lite';

export function SettingsStarterVoiceCard(props: {
  settings: PetConfig['settings'];
  applySettings: (updates: Partial<PetConfig['settings']>) => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BrowserTtsInstallProgress | null>(null);
  const [result, setResult] = useState<{ ok: boolean; error: string | null } | null>(null);
  useEffect(() => onGptSovitsInstallProgress(setProgress), []);
  const usingIt = props.settings.ttsProvider === 'gpt-sovits' && props.settings.gptSovitsModelId === STARTER_VOICE_ID;
  if (usingIt && !running && !result) return null;

  const start = async () => {
    setRunning(true);
    setResult(null);
    try {
      const outcome = await installStarterVoice(props.settings);
      setResult({ error: outcome.error, ok: outcome.ok });
      if (outcome.ok && outcome.modelId) {
        props.applySettings({ gptSovitsModelId: outcome.modelId, ttsProvider: 'gpt-sovits', voiceEnabled: true });
      }
    } finally {
      setRunning(false);
    }
  };
  const lines = (progress?.messages ?? []).slice(-3);

  return (
    <section className="space-y-3 rounded-sm border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">小玲的真声音</div>
          <p className="mt-1 text-2xs leading-5 text-muted-foreground">
            一键装好本地语音和小玲的声音，装完自动换成她的声音。要下载几个 GB（有 NVIDIA 显卡的约 6GB，没有的约 3GB），网速一般要二三十分钟；都装在软件所在的文件夹里。没有 Python 也没关系，会自动准备。
          </p>
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => void start()}
          className="shrink-0 rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {running ? '正在安装…' : result && !result.ok ? '再试一次' : '一键安装'}
        </button>
      </div>
      {running && lines.length ? (
        <div className="space-y-0.5 rounded-sm bg-background/60 p-2 font-mono text-2xs text-muted-foreground">
          {lines.map((line, index) => <div key={`${index}-${line}`} className="truncate">{line}</div>)}
        </div>
      ) : null}
      {result?.ok ? <div className="text-2xs font-semibold text-primary">装好了，现在小玲用自己的声音说话了。</div> : null}
      {result && !result.ok ? <div className="text-2xs text-amber-600">没装成：{result.error || '请检查网络后再试一次。'}已经下载好的部分会保留，再试一次会接着装。</div> : null}
    </section>
  );
}
