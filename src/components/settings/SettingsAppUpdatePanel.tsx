import { Download, ExternalLink, FileText, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppUpdateStatus, AppUpdateVersion } from '../../appUpdate/appUpdateTypes';

// The version list behind "当前版本": every version, newer and earlier — switch to one (only the
// files that differ from the installer are downloaded), restart to use it, or go back.

const LABELS: Record<AppUpdateVersion['action'], string> = {
  builtin: '安装包自带',
  current: '正在用',
  download: '',
  failed: '上次没装好',
  full: '完整安装包',
  'needs-full': '要换安装包',
  pending: '重启后用这个',
};

function formatSize(bytes: number) {
  return bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '';
}

export function SettingsAppUpdatePanel() {
  const bridge = typeof window === 'undefined' ? undefined : window.desktopPetShell?.appUpdate;
  const [status, setStatus] = useState<AppUpdateStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const check = async () => {
    if (!bridge) return;
    setBusy('check');
    setMessage('');
    try {
      setStatus(await bridge.check());
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => { void check(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bridge) return <p className="text-xs text-muted-foreground">只有桌面版能检查更新。</p>;

  const download = async (version: string) => {
    setBusy(version);
    setMessage(`正在准备 v${version}（只下载和安装包不一样的文件）…`);
    const result = await bridge.download(version);
    setMessage(result.ok ? `v${version} 准备好了，重启后换过去。` : `没换成：${'error' in result ? result.error : ''}`);
    setStatus(await bridge.status());
    setBusy(null);
  };
  const revert = async () => {
    await bridge.revert();
    setMessage(`重启后回到安装包自带的 v${status?.builtInVersion ?? ''}。`);
    setStatus(await bridge.status());
  };
  const stay = async () => {
    setStatus(await bridge.stay());
    setMessage('好，继续用现在这个版本。');
  };
  // A text file with versions, settings summary and recent logs (no chat, no keys) to send when
  // something goes wrong; released builds keep no log file of their own.
  const exportDiagnostics = async () => {
    const shell = window.desktopPetShell;
    if (!shell?.exportDiagnostics) return;
    setBusy('diagnostics');
    try {
      const result = await shell.exportDiagnostics();
      if (result.ok) setMessage(`诊断信息已保存到 ${result.path}。不含聊天内容和密钥，发给帮你排查的人就行。`);
      else if (!result.cancelled) setMessage(`没导出成：${result.error ?? ''}`);
    } finally {
      setBusy(null);
    }
  };
  const isNewer = (version: string) => version.localeCompare(status?.current ?? '', undefined, { numeric: true }) > 0;

  const upToDate = status && !status.versions.some((item) => (item.action === 'download' || item.action === 'full') && isNewer(item.version));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          正在用 <span className="font-semibold text-foreground">v{status?.current ?? __APP_VERSION__}</span>
          {status && !status.builtIn ? `（热更新，安装包是 v${status.builtInVersion}）` : ''}
          {status?.checkedAt ? ` · ${upToDate ? '已经是最新' : '有新版本'}` : ''}
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={() => void check()} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">
            {busy === 'check' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}检查更新
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void exportDiagnostics()} title="遇到问题时导出给帮你排查的人：版本、设置摘要、最近的运行日志（不含聊天内容和密钥）" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50">
            {busy === 'diagnostics' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}导出诊断信息
          </button>
          {status?.pending ? (
            <>
              <button type="button" onClick={() => void bridge.restart()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">重启换到 v{status.pending}</button>
              <button type="button" onClick={() => void stay()} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">不换了</button>
            </>
          ) : null}
        </div>
      </div>

      {status?.notice ? <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-2xs text-amber-800">{status.notice}</p> : null}
      {status?.error ? <p className="text-2xs text-rose-600">{status.error}</p> : null}
      {message ? <p className="text-2xs text-primary">{message}</p> : null}

      {status?.versions.length ? (
        <ul className="max-h-80 space-y-2 overflow-auto">
          {status.versions.map((item) => (
            <li key={item.version} className="rounded-md border border-border bg-background/60 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-foreground">v{item.version}</span>
                  <span className="text-2xs text-muted-foreground">{item.kind === 'hot' ? `热更新 ${formatSize(item.size)}` : '完整版'}{item.publishedAt ? ` · ${item.publishedAt.slice(0, 10)}` : ''}</span>
                  {LABELS[item.action] ? <span className="rounded-full bg-muted px-2 py-0.5 text-2xs text-muted-foreground">{LABELS[item.action]}</span> : null}
                </div>
                {item.action === 'download' ? (
                  <button type="button" disabled={Boolean(busy)} onClick={() => void download(item.version)} className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2.5 py-1 text-2xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">
                    {busy === item.version ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}{isNewer(item.version) ? '更新到这个版本' : '换回这个版本'}
                  </button>
                ) : item.action === 'builtin' ? (
                  <button type="button" onClick={() => void revert()} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-2xs font-semibold text-muted-foreground hover:bg-muted">
                    <RotateCcw className="h-3 w-3" />换回这个版本
                  </button>
                ) : (item.action === 'full' || item.action === 'needs-full') && item.page ? (
                  <a href={item.page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-2xs font-semibold text-muted-foreground hover:bg-muted">
                    <ExternalLink className="h-3 w-3" />下载完整安装包
                  </a>
                ) : null}
              </div>
              {item.notes ? <p className="mt-1 whitespace-pre-wrap text-2xs leading-5 text-muted-foreground">{item.notes}</p> : null}
            </li>
          ))}
        </ul>
      ) : status?.checkedAt ? <p className="text-2xs text-muted-foreground">还没有发布过可以热更新的版本。</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
        <label className="flex items-center gap-2 text-2xs text-muted-foreground">
          <input type="checkbox" checked={status?.autoDownload ?? true} onChange={(event) => void bridge.setAutoDownload(event.target.checked).then(setStatus)} />
          有新版本时自动在后台下载（重启前会问你）
        </label>
        <span className="text-2xs text-muted-foreground">要退回更早的版本：在上面的列表里选；换了安装包的版本要下载那个版本的完整安装包。</span>
      </div>
    </div>
  );
}
