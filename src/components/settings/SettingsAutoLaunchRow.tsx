import { useEffect, useState } from 'react';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';

// Start with Windows (2026-11-13). The switch shows what Windows will actually do (its Run
// entry), so turning it off in Task Manager's startup list shows here as off too.

type AutoLaunchState = { enabled: boolean; error?: string; supported: boolean };

export function SettingsAutoLaunchRow() {
  const [state, setState] = useState<AutoLaunchState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const bridge = window.desktopPetShell?.autoLaunch;
    if (!bridge) {
      setState({ enabled: false, supported: false });
      return undefined;
    }
    void bridge.get().then((result) => {
      if (alive) setState({ enabled: result.enabled === true, error: result.ok ? undefined : result.error, supported: result.supported !== false && result.ok });
    });
    return () => { alive = false; };
  }, []);

  const change = async (checked: boolean) => {
    const bridge = window.desktopPetShell?.autoLaunch;
    if (!bridge || busy) return;
    setBusy(true);
    const result = await bridge.set(checked);
    setBusy(false);
    setState({ enabled: result.enabled === true, error: result.ok ? undefined : result.error, supported: result.supported !== false });
  };

  const hint = !state
    ? '正在读取…'
    : !state.supported
      ? '开发版不能设置，打包后的版本才行。'
      : '电脑开机登录后自动打开桌宠，不用每天手动启动。也可以在任务管理器的“启动应用”里关掉。';

  return (
    <div className="flex items-start justify-between gap-3">
      <span className="space-y-0.5">
        <span className="block text-xs font-semibold text-foreground">开机自动启动</span>
        <span className="block text-2xs leading-5 text-muted-foreground">{hint}</span>
        {state?.error ? <span className="block text-2xs leading-5 text-destructive">{state.error}</span> : null}
      </span>
      <SettingsToggleSwitch
        checked={state?.enabled === true}
        disabled={!state?.supported || busy}
        hideLabel
        label="开机自动启动"
        onChange={(checked) => { void change(checked); }}
      />
    </div>
  );
}
