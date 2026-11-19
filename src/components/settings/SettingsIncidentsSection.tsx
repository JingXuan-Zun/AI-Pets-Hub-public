import { useEffect, useState } from 'react';
import { INCIDENT_SOURCE_LABELS, type Incident, type IncidentSnapshot, type IncidentUpload } from '../../incidents/incidentTypes';
import { clearIncidentConcerns } from '../../incidents/useIncidentConcern';

// Settings → 健康 → 最近遇到的问题 (2026-11-18): errors the app ran into, merged when they repeat,
// with where they happened and the log lines just before. Sending them to the developer is
// asked once and can be switched off; "看看会发什么" shows exactly what would leave.

const formatTime = (at: number) => new Date(at).toLocaleString();
const isNewer = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }) > 0;

function IncidentItem({ item, consent, onRemove }: { item: Incident; consent: IncidentSnapshot['consent']; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const fixed = item.fixedIn && isNewer(item.fixedIn, __APP_VERSION__);
  return (
    <li className="rounded-sm border border-border bg-background/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2 text-2xs text-muted-foreground">
            <span className="rounded-full border border-border px-2 py-0.5">{INCIDENT_SOURCE_LABELS[item.source]}</span>
            <span>{item.count} 次</span>
            <span>最近 {formatTime(item.lastAt)}</span>
            <span>版本 {item.versions.join('、')}</span>
            {consent === 'yes' ? <span>{item.uploadedCount >= item.count ? '已发给开发者' : '等待发送'}</span> : null}
          </div>
          <p className="mt-1 break-words text-xs font-semibold text-foreground">{item.title}</p>
        </button>
        <button type="button" onClick={onRemove} className="shrink-0 rounded-sm border border-border px-2 py-1 text-2xs text-muted-foreground hover:bg-muted">删掉</button>
      </div>
      {item.fixedIn ? (
        <p className="mt-1 text-2xs text-emerald-700">{fixed ? `开发者已在 v${item.fixedIn} 修好，更新到这个版本就好了。` : `已在 v${item.fixedIn} 修好。`}</p>
      ) : null}
      {open ? (
        <div className="mt-2 space-y-2 text-2xs text-muted-foreground">
          <div>第一次出现：{formatTime(item.firstAt)} · 编号 {item.fingerprint.slice(0, 8)}</div>
          {item.frames.length ? (
            <div>
              <div className="font-semibold text-foreground">出错位置</div>
              <ul className="font-mono">{item.frames.map((frame, index) => <li key={index}>{frame.fn} · {frame.file}{frame.line ? `:${frame.line}` : ''}</li>)}</ul>
            </div>
          ) : null}
          {item.context.length ? (
            <div>
              <div className="font-semibold text-foreground">出错前的记录（只留在你电脑上，不会发出去）</div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/40 p-2 font-mono">{item.context.join('\n')}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function SettingsIncidentsSection() {
  const bridge = typeof window === 'undefined' ? undefined : window.desktopPetShell?.incidents;
  const [snapshot, setSnapshot] = useState<IncidentSnapshot | null>(null);
  const [preview, setPreview] = useState<IncidentUpload[] | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => { void bridge?.list().then(setSnapshot); }, [bridge]);
  if (!bridge) return null;

  const setConsent = async (value: 'no' | 'yes') => {
    setSnapshot(await bridge.setConsent(value));
    clearIncidentConcerns();
    setMessage(value === 'yes' ? '好，问题报告会自动发给开发者。' : '好，不发送。问题还是会记在这里给你看。');
  };
  const uploadNow = async () => {
    const result = await bridge.uploadNow();
    setSnapshot(result);
    setMessage(result.ok ? `发好了（${result.sent ?? 0} 条）。` : `没发成：${result.error ?? result.reason ?? ''}`);
  };
  const items = snapshot?.items ?? [];

  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4">
      <div>
        <div className="text-2xs font-bold uppercase tracking-widest text-primary">最近遇到的问题</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          软件出错时会自动记下来，同样的问题只记一条并累计次数。想知道是怎么回事，可以跟她说“看看最近出了什么问题”。
        </p>
      </div>

      {snapshot && (snapshot.consent === 'unasked' ? items.length > 0 : true) ? (
        <div className="rounded-sm border border-primary/30 bg-primary/5 p-3 text-xs leading-5">
          {snapshot.consent === 'unasked' ? (
            <>
              <p className="text-foreground">要把问题报告发给开发者吗？发出去的只有报错内容和出错位置，<strong>不含聊天内容、密钥和你电脑上的文件路径</strong>。开发者修好后，这里会告诉你更新到哪个版本。</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => void setConsent('yes')} className="rounded-sm border border-primary/50 px-3 py-1 text-primary hover:bg-primary/10">发送</button>
                <button type="button" onClick={() => void setConsent('no')} className="rounded-sm border border-border px-3 py-1 text-muted-foreground hover:bg-muted">不发</button>
                <button type="button" onClick={() => void bridge.preview().then(setPreview)} className="rounded-sm border border-border px-3 py-1 text-muted-foreground hover:bg-muted">看看会发什么</button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-foreground">
                <input type="checkbox" checked={snapshot.consent === 'yes'} onChange={(event) => void setConsent(event.target.checked ? 'yes' : 'no')} />
                把问题报告发给开发者（不含聊天内容、密钥和文件路径）
              </label>
              <button type="button" onClick={() => void bridge.preview().then(setPreview)} className="text-2xs text-primary hover:underline">看看会发什么</button>
              {snapshot.consent === 'yes' ? <button type="button" onClick={() => void uploadNow()} className="text-2xs text-primary hover:underline">现在发送</button> : null}
            </div>
          )}
        </div>
      ) : null}
      {message ? <p className="text-2xs text-primary">{message}</p> : null}
      {preview ? (
        <div className="text-2xs">
          <div className="flex items-center justify-between"><span className="font-semibold text-foreground">下次会发送的内容（{preview.length} 条）</span><button type="button" onClick={() => setPreview(null)} className="text-muted-foreground hover:underline">收起</button></div>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted/40 p-2 font-mono text-muted-foreground">{preview.length ? JSON.stringify(preview, null, 2) : '没有要发的。'}</pre>
        </div>
      ) : null}

      {items.length ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <IncidentItem key={item.fingerprint} item={item} consent={snapshot?.consent ?? 'unasked'} onRemove={() => void bridge.remove(item.fingerprint).then(setSnapshot)} />
          ))}
        </ul>
      ) : snapshot ? <p className="text-xs text-muted-foreground">最近没有遇到问题。</p> : null}
    </section>
  );
}
