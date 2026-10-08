import { Download, FileText, LoaderCircle, Plus, RefreshCw, Search } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { PublicPersonaEntry } from '../../persona-community/personaCommunityTypes';
import { usePersonaCommunity } from './usePersonaCommunity';

const DEFAULT_PERSONA_COMMUNITY_API_URL = '';
const apiUrl = import.meta.env.VITE_PERSONA_COMMUNITY_API_URL?.trim() || DEFAULT_PERSONA_COMMUNITY_API_URL;
const acceptedFileTypes = '.txt,.md,.json,text/plain,text/markdown,application/json';

function PersonaCard({ entry, downloading, onDownload }: {
  entry: PublicPersonaEntry; downloading: string | null; onDownload: () => void;
}) {
  const size = entry.sizeBytes < 1024 ? `${entry.sizeBytes} B` : `${Math.ceil(entry.sizeBytes / 1024)} KB`;
  return <article className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-card p-4">
    <FileText className="mt-1 h-5 w-5 shrink-0 text-primary" />
    <div className="min-w-0 flex-1">
      <h4 className="truncate text-sm font-semibold" title={entry.title}>{entry.title}</h4>
      <p className="mt-1 truncate text-xs text-muted-foreground">{entry.filename}</p>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{entry.format.toUpperCase()} · {size}</span>
        <button type="button" onClick={onDownload} disabled={Boolean(downloading)}
          aria-label={`下载 ${entry.filename}`} className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 px-3 py-1.5 text-primary hover:bg-primary/10 disabled:opacity-50">
          {downloading === entry.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}下载
        </button>
      </div>
    </div>
  </article>;
}

export function PersonaCommunityPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const community = usePersonaCommunity(apiUrl);
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return community.entries.filter((entry) => !term || [entry.title, entry.filename, entry.description]
      .some((text) => text?.toLocaleLowerCase().includes(term)));
  }, [community.entries, query]);

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void community.upload(file);
  };
  const emptyMessage = !apiUrl ? '人格分享暂未开放。'
    : query.trim() ? '没有找到匹配的人格文件。' : '还没有人格分享，点击右下角的 ＋ 发布第一个文件。';

  return <div className="relative flex min-h-96 flex-col pb-24">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs leading-5 text-muted-foreground">支持 TXT、MD、JSON，UTF-8 编码，单文件不超过 2 MB。<br />选中文件即公开分享，仅上传你选择的文件。</p>
      <div className="flex items-center gap-2">
        <label className="relative"><span className="sr-only">搜索人格文件</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索人格文件"
            className="h-9 w-44 rounded-md border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary" />
        </label>
        <button type="button" onClick={() => void community.refresh()} disabled={community.loading || community.uploading || !apiUrl}
          aria-label="刷新列表" title="刷新列表" className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground disabled:opacity-40">
          <RefreshCw className={`h-4 w-4 ${community.loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </div>
    {community.loadError && <p role="alert" className="mt-3 text-xs text-destructive">{community.loadError}</p>}
    {community.loading && !community.entries.length ? <div className="flex flex-1 items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
      <LoaderCircle className="h-4 w-4 animate-spin" />正在加载
    </div> : filtered.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {filtered.map((entry) => <PersonaCard key={entry.id} entry={entry} downloading={community.downloading} onDownload={() => void community.download(entry)} />)}
    </div> : !community.loadError && <div className="mt-5 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border px-4 py-12 text-center text-xs text-muted-foreground">{emptyMessage}</div>}
    <p role="status" aria-live="polite" className="mt-4 min-h-4 text-xs text-muted-foreground">{community.message}</p>
    <input ref={inputRef} type="file" accept={acceptedFileTypes} onChange={selectFile} disabled={community.uploading} className="hidden" />
    <button type="button" onClick={() => inputRef.current?.click()} disabled={community.uploading || !apiUrl}
      aria-label="上传并公开分享人格文件" title="选择文件并公开分享"
      className="absolute bottom-3 right-0 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
      {community.uploading ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Plus className="h-7 w-7" />}
    </button>
  </div>;
}
