import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ShieldCheck, Sparkles, Upload } from 'lucide-react';
import { createAgentSkillManifest, type AgentSkillManifestEntry } from '../../agent/agentSkillManifest';
import { orderAgentSkillDirectoryEntries } from '../../agent/agentSkillDirectoryOrdering';
import {
  createEmptyAgentExternalSkillLibrary,
  parseAgentExternalSkillLibraryJson,
  removeAgentExternalSkillFromLibrary,
  serializeAgentExternalSkillLibrary,
  type AgentExternalSkillDefinition,
} from '../../agent/agentExternalSkillLibrary';

import { readAgentSkillImportFile } from '../../agent/agentSkillArchiveImport';
import { installAgentImportedSkills } from '../../agent/agentSkillImportInstallation';

type SkillEntry = AgentSkillManifestEntry | AgentExternalSkillDefinition;
type ExtensionHubTab = 'installed' | 'market';

function getRiskLabel(risk: SkillEntry['risk']) { return risk === 'action' ? '需要动作权限' : risk === 'visual' ? '视觉能力' : '只读能力'; }
function getStageLabel(stage: AgentSkillManifestEntry['stage']) { return stage === 'foundation' ? '基础' : stage === 'mvp' ? '已接入' : '规划'; }
function isExternalSkill(entry: SkillEntry): entry is AgentExternalSkillDefinition { return entry.id.startsWith('external.'); }

function SkillMarketplaceCard({ entry, enabled, onSelect, onToggle, onRemove }: { entry: SkillEntry; enabled: boolean; onSelect: () => void; onToggle?: () => void; onRemove?: () => void }) {
  const external = isExternalSkill(entry);
  const stage = external ? '已导入' : getStageLabel(entry.stage);
  return <article className="flex min-h-52 flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20">
    <button type="button" className="flex min-w-0 flex-1 text-left" onClick={onSelect}><div className="flex min-w-0 flex-1 flex-col"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div><div className="min-w-0"><h3 className="truncate text-sm font-bold text-foreground">{entry.title}</h3><p className="mt-0.5 truncate text-2xs text-muted-foreground">{external ? entry.sourceName : 'AI-Pets-Hub 内置能力'}</p></div></div><ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-label="受控能力" /></div><p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">{entry.description}</p><div className="mt-auto flex flex-wrap gap-1.5 pt-3"><span className={['rounded-full border px-2 py-0.5 text-2xs', enabled ? 'border-success/40 bg-success/5 text-success' : 'border-primary/30 bg-primary/5 text-primary'].join(' ')}>{enabled ? '当前已启用' : external ? '已导入未启用' : stage}</span><span className="rounded-full border border-border px-2 py-0.5 text-2xs text-muted-foreground">{getRiskLabel(entry.risk)}</span>{entry.tags.slice(0, 2).map((tag) => <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-2xs text-muted-foreground">{tag}</span>)}</div></div></button>
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/70 pt-3"><span className="truncate font-mono text-2xs text-muted-foreground">{'preferredCapabilityId' in entry ? entry.preferredCapabilityId : (entry.capabilityIds[0] || 'declarative')}</span><div className="flex items-center gap-1.5">{onToggle ? <button type="button" onClick={onToggle} className="rounded-md border border-primary/40 px-2.5 py-1 text-2xs font-semibold text-primary hover:bg-primary/10">{enabled ? '停用' : '启用'}</button> : null}{onRemove ? <button type="button" onClick={onRemove} className="rounded-md border border-destructive/30 px-2.5 py-1 text-2xs font-semibold text-destructive hover:bg-destructive/10">卸载</button> : null}<button type="button" onClick={onSelect} className="rounded-md border border-border px-2.5 py-1 text-2xs font-semibold text-muted-foreground hover:bg-muted">查看详情</button></div></div>
  </article>;
}

export function SettingsSkillDirectory({ currentPetId }: { currentPetId: string }) {
  const manifest = useMemo(() => createAgentSkillManifest(), []);
  const [library, setLibrary] = useState(() => { try { return parseAgentExternalSkillLibraryJson(window.localStorage.getItem('desktop-pet.agent-external-skills.v1')); } catch { return createEmptyAgentExternalSkillLibrary(); } });
  const [bindings, setBindings] = useState<Record<string, string[]>>(() => { try { return JSON.parse(window.localStorage.getItem('desktop-pet.agent-skill-bindings.v1') || '{}') as Record<string, string[]>; } catch { return {}; } });
  const [activeTab, setActiveTab] = useState<ExtensionHubTab>('installed');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [importing, setImporting] = useState(false);
  const importLock = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importedIds = bindings[currentPetId] ?? [];
  const entries: SkillEntry[] = orderAgentSkillDirectoryEntries(library.skills, manifest.entries);
  const filteredEntries = useMemo(() => { const q = query.trim().toLocaleLowerCase(); return entries.filter((entry) => !q || [entry.title, entry.description, entry.id, ...entry.tags].some((value) => value.toLocaleLowerCase().includes(q))); }, [entries, query]);
  const persistBindings = (next: Record<string, string[]>) => { setBindings(next); window.localStorage.setItem('desktop-pet.agent-skill-bindings.v1', JSON.stringify(next)); };
  const toggleSkill = (skillId: string) => { const current = new Set(bindings[currentPetId] ?? []); current.has(skillId) ? current.delete(skillId) : current.add(skillId); persistBindings({ ...bindings, [currentPetId]: [...current] }); };
  const removeSkill = (skillId: string) => { const nextLibrary = removeAgentExternalSkillFromLibrary(library, skillId); setLibrary(nextLibrary); window.localStorage.setItem('desktop-pet.agent-external-skills.v1', serializeAgentExternalSkillLibrary(nextLibrary)); const current = (bindings[currentPetId] ?? []).filter((id) => id !== skillId); persistBindings({ ...bindings, [currentPetId]: current }); setSelectedId(null); setFeedback('已卸载外部 Skill。'); };
  const importSkill = async (file: File) => {
    if (importLock.current) return;
    importLock.current = true;
    setImporting(true);
    setFeedback('正在分析技能文件…');
    try {
      const preview = await readAgentSkillImportFile(file);
      const installed = installAgentImportedSkills(window.localStorage, currentPetId, preview);
      setLibrary(installed.library);
      setBindings(installed.bindings);
      setFeedback(`已安装并为 ${currentPetId} 启用 ${preview.skills.length} 个技能。${preview.warnings.join('；')}`);
      setSelectedId(preview.skills[0]?.id ?? null);
    } catch (error) {
      setFeedback(`导入失败：${error instanceof Error ? error.message : '无法读取文件。'}`);
    } finally {
      importLock.current = false;
      setImporting(false);
    }
  };
  const selectedEntry = entries.find((entry) => entry.id === selectedId) ?? null;
  useEffect(() => { setSelectedId(null); }, [currentPetId]);
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1"><button type="button" onClick={() => setActiveTab('installed')} className={['rounded-md px-3 py-1.5 text-xs font-semibold', activeTab === 'installed' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'].join(' ')}>已安装</button><button type="button" onClick={() => setActiveTab('market')} className={['rounded-md px-3 py-1.5 text-xs font-semibold', activeTab === 'market' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'].join(' ')}>Skills 列表</button></div><div className="flex items-center gap-2"><div className="relative min-w-52"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Skills、能力或标签" className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-xs outline-none focus:border-primary" /></div><input ref={fileInputRef} type="file" accept=".zip,.json,.md,.markdown,text/plain,application/json,application/zip" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSkill(file); event.currentTarget.value = ''; }} /><button type="button" disabled={importing} onClick={() => fileInputRef.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"><Upload className="h-3.5 w-3.5" />{importing ? '分析中…' : '导入 Skill / ZIP'}</button></div></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h3 className="text-lg font-bold text-foreground">{activeTab === 'installed' ? `${currentPetId} 的能力` : 'Skills 列表'}</h3><span className="rounded-full border border-border px-2 py-0.5 text-2xs text-muted-foreground">{filteredEntries.length} 项</span></div><span className="text-2xs text-muted-foreground">内置 {manifest.entries.length} · 外部导入 {library.skills.length}</span></div>
    {feedback ? <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-2xs text-primary">{feedback}</div> : null}
    {filteredEntries.length ? <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredEntries.map((entry) => <SkillMarketplaceCard key={entry.id} entry={entry} enabled={isExternalSkill(entry) ? importedIds.includes(entry.id) : entry.defaultEnabled} onSelect={() => setSelectedId(entry.id)} onToggle={isExternalSkill(entry) ? () => toggleSkill(entry.id) : undefined} onRemove={isExternalSkill(entry) ? () => removeSkill(entry.id) : undefined} />)}</div> : <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">没有匹配的 Skills。</div>}
    {selectedEntry ? <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-2xs font-mono text-primary">{selectedEntry.id}</div><h4 className="mt-1 text-sm font-bold text-foreground">{selectedEntry.title}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">{isExternalSkill(selectedEntry) ? selectedEntry.instructions || '这是声明式 Skill，当前不会执行任意本地代码。' : selectedEntry.routeSummary}</p></div><button type="button" onClick={() => setSelectedId(null)} className="rounded-md border border-border px-2 py-1 text-2xs text-muted-foreground">关闭详情</button></div><div className="mt-3 grid gap-2 text-2xs text-muted-foreground sm:grid-cols-3"><div>来源：<span className="text-foreground">{isExternalSkill(selectedEntry) ? selectedEntry.sourceName : '内置'}</span></div><div>风险：<span className="text-foreground">{getRiskLabel(selectedEntry.risk)}</span></div><div>版本：<span className="font-mono text-foreground">{isExternalSkill(selectedEntry) ? selectedEntry.version : selectedEntry.package.version}</span></div></div></div> : null}
  </>;
}
