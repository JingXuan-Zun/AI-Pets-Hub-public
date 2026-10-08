import { useMemo, useState, type CSSProperties } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { SettingsDeepSeekHarnessAgentWorkbench } from './SettingsDeepSeekHarnessAgentWorkbench';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';
import type { PetConfig } from '../../types';
import {
  DEEPSEEK_HARNESS_CHAT_USAGE,
  getDeepSeekHarnessSetupGaps,
  NATIVE_RUNTIME_CHAT_USAGE,
} from './settingsAgentRuntimeGuidance';

interface SettingsAgentRuntimeSectionProps {
  config: PetConfig;
  noDragRegionStyle?: CSSProperties;
  onApplyConfig: (config: PetConfig) => void;
}

function updateSettings(config: PetConfig, updates: Partial<PetConfig['settings']>) {
  return { ...config, settings: { ...config.settings, ...updates } };
}

export function SettingsAgentRuntimeSection({ config, noDragRegionStyle, onApplyConfig }: SettingsAgentRuntimeSectionProps) {
  const { settings } = config;
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [setupReady, setSetupReady] = useState(false);
  const [workbenchExpanded, setWorkbenchExpanded] = useState(false);
  const setupGaps = useMemo(() => getDeepSeekHarnessSetupGaps({
    apiKey: settings.deepseekHarnessApiKey,
    dshHome: settings.deepseekHarnessHome,
    workspace: settings.deepseekHarnessWorkspace,
  }), [settings.deepseekHarnessApiKey, settings.deepseekHarnessHome, settings.deepseekHarnessWorkspace]);
  const apply = (updates: Partial<PetConfig['settings']>) => {
    setFeedback('');
    setSetupReady(false);
    onApplyConfig(updateSettings(config, updates));
  };
  const checkRuntime = async () => {
    setBusy(true);
    setFeedback('正在检测 Python 与 DeepSeek Harness SDK...');
    try {
      const result = await desktopPetShellRuntime.probeDeepSeekHarness({ pythonPath: settings.deepseekHarnessPythonPath });
      setFeedback(result.available
        ? 'SDK ' + (result.sdkVersion ?? '已安装') + ' · Python ' + (result.pythonVersion ?? '未知')
        : '不可用：' + (result.error ?? '未检测到 SDK'));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '检测失败');
    } finally {
      setBusy(false);
    }
  };
  const checkUpdate = async () => {
    setBusy(true);
    try {
      const result = await desktopPetShellRuntime.checkDeepSeekHarnessUpdate({ pythonPath: settings.deepseekHarnessPythonPath });
      setFeedback(result.checked ? '可用最新 SDK：' + result.latestVersion : (result.error ?? '暂时无法检查更新'));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '检查更新失败');
    } finally {
      setBusy(false);
    }
  };
  const validateSetup = async () => {
    setBusy(true);
    setFeedback('正在检查 Workspace、DSH_HOME、SDK，并生成受控 Profile...');
    setSetupReady(false);
    try {
      const result = await desktopPetShellRuntime.validateDeepSeekHarnessSetup({
        dshHome: settings.deepseekHarnessHome,
        model: settings.deepseekHarnessModel,
        pythonPath: settings.deepseekHarnessPythonPath,
        workspace: settings.deepseekHarnessWorkspace,
      });
      setSetupReady(result.ok);
      setFeedback(result.ok
        ? '受控环境已就绪 · SDK ' + (result.sdkVersion ?? '已安装') + '。下一次聊天中的 Agent 任务会使用 Harness。'
        : '环境未就绪：' + (result.error ?? '请检查 Workspace、DSH_HOME 和 SDK。'));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '环境验证失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-sm border border-border bg-secondary/15 p-4">
      <div>
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">Agent Runtime</Label>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          运行时只决定 Agent 如何处理任务；角色、聊天记录与桌宠界面始终留在应用内。
        </p>
      </div>

      <div className="flex items-start justify-between gap-3 rounded-sm border border-border bg-background/60 px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground">桌面操作使用新版 Agent 循环</div>
          <p className="mt-0.5 text-2xs leading-5 text-muted-foreground">
            打开应用、点击、登录、切换窗口等任务走新循环：先读窗口文字和控件，编号定位，开始时批准一次；输入、发送、删除、付款仍单独询问。
          </p>
        </div>
        <SettingsToggleSwitch
          checked={settings.agentDesktopLoopEnabled}
          hideLabel
          label="桌面操作使用新版 Agent 循环"
          onChange={(checked) => apply({ agentDesktopLoopEnabled: checked })}
          style={noDragRegionStyle}
        />
      </div>

      <select
        value={settings.agentRuntimeProvider}
        onChange={(event) => apply({ agentRuntimeProvider: event.target.value as PetConfig['settings']['agentRuntimeProvider'] })}
        className="h-9 w-full rounded-sm border border-border bg-background px-2 text-xs text-foreground"
        style={noDragRegionStyle}
      >
        <option value="native">Native Runtime（默认）</option>
        <option value="deepseek-harness">DeepSeek Harness（外部 SDK）</option>
      </select>

      {settings.agentRuntimeProvider === 'native' ? (
        <div className="rounded-sm border border-primary/30 bg-primary/5 px-3 py-2 text-2xs leading-5 text-muted-foreground">
          {NATIVE_RUNTIME_CHAT_USAGE}
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={[
              'rounded-sm border px-3 py-2 text-2xs leading-5',
              setupReady ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700' : 'border-amber-500/40 bg-amber-500/10 text-amber-700',
            ].join(' ')}
          >
            {setupReady
              ? '本次检查已通过。应用会在每次 Harness 任务开始前再次检查目录和受控 Profile，防止配置被改动后越权运行。'
              : '先填写以下三项，再点击“检查受控环境”。该检查不会发送聊天任务；它会自动生成受控 Profile，无需单独准备。'}
          </div>

          <div className="rounded-sm border border-border bg-background/60 px-3 py-2 text-2xs leading-5 text-muted-foreground">
            <p>{DEEPSEEK_HARNESS_CHAT_USAGE}</p>
            <p className="mt-1">使用入口：回到桌宠聊天，在输入框开启 Agent（输入“/”后选择 Agent 也可以），再发送针对 Workspace 的阅读或分析任务。</p>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Harness 使用界面">
            <Button type="button" variant={workbenchExpanded ? 'outline' : 'default'} size="sm" onClick={() => setWorkbenchExpanded(false)}>
              在聊天中使用
            </Button>
            <Button type="button" variant={workbenchExpanded ? 'default' : 'outline'} size="sm" onClick={() => setWorkbenchExpanded(true)}>
              展开 Harness 工作台
            </Button>
          </div>

          {setupGaps.length > 0 ? (
            <div className="space-y-1 rounded-sm border border-border bg-background/40 px-3 py-2 text-2xs text-muted-foreground">
              <p className="font-semibold text-foreground">还需要填写：</p>
              {setupGaps.map((gap) => <p key={gap.id}>• {gap.label}：{gap.detail}</p>)}
            </div>
          ) : null}

          <div className="grid gap-2">
            <div>
              <Label className="text-2xs text-muted-foreground">Python（可留空自动检测）</Label>
              <Input value={settings.deepseekHarnessPythonPath} onChange={(event) => apply({ deepseekHarnessPythonPath: event.target.value })} placeholder="例如 C:\Python313\python.exe" style={noDragRegionStyle} />
            </div>
            <div>
              <Label className="text-2xs text-muted-foreground">Workspace（允许读取的任务目录）</Label>
              <Input value={settings.deepseekHarnessWorkspace} onChange={(event) => apply({ deepseekHarnessWorkspace: event.target.value })} placeholder="例如 D:\Work\analysis-project" style={noDragRegionStyle} />
            </div>
            <div>
              <Label className="text-2xs text-muted-foreground">DSH_HOME（专用配置目录）</Label>
              <Input value={settings.deepseekHarnessHome} onChange={(event) => apply({ deepseekHarnessHome: event.target.value })} placeholder="例如 C:\Users\你的用户名\AppData\Roaming\AI Desktop Pet\deepseek-harness" style={noDragRegionStyle} />
            </div>
            <div>
              <Label className="text-2xs text-muted-foreground">Harness 模型</Label>
              <Input value={settings.deepseekHarnessModel} onChange={(event) => apply({ deepseekHarnessModel: event.target.value })} placeholder="例如 deepseek-v4-flash" style={noDragRegionStyle} />
            </div>
            <div>
              <Label className="text-2xs text-muted-foreground">DeepSeek 兼容 Base URL（可选）</Label>
              <Input value={settings.deepseekHarnessBaseUrl} onChange={(event) => apply({ deepseekHarnessBaseUrl: event.target.value })} placeholder="留空使用 SDK 默认地址" style={noDragRegionStyle} />
            </div>
            <div>
              <Label className="text-2xs text-muted-foreground">DeepSeek API Key（仅本机保存）</Label>
              <Input type="password" value={settings.deepseekHarnessApiKey} onChange={(event) => apply({ deepseekHarnessApiKey: event.target.value })} placeholder="输入 API Key" autoComplete="off" style={noDragRegionStyle} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void checkRuntime()}>检测本机 SDK</Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void checkUpdate()}>检查 SDK 更新</Button>
            <Button type="button" size="sm" disabled={busy || setupGaps.length > 0} onClick={() => void validateSetup()}>检查受控环境</Button>
          </div>
          {feedback ? <div className="rounded-sm border border-border bg-background/50 px-3 py-2 text-2xs text-muted-foreground">{feedback}</div> : null}
          {workbenchExpanded ? (
            <SettingsDeepSeekHarnessAgentWorkbench
              canRun={setupGaps.length === 0}
              settings={settings}
            />
          ) : null}
        </div>
      )}
    </section>
  );
}
