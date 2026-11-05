import { useState, type CSSProperties } from 'react';
import { Check, Save, Trash2 } from 'lucide-react';
import {
  activeApiProfile,
  applyApiProfile,
  describeApiProfile,
  readApiProfiles,
  removeApiProfile,
  saveCurrentAsProfile,
} from '../../settings/apiProfiles';
import type { PetConfig } from '../../types';

// “接口配置”: save the current chat model setup under a name, keep several, and switch with
// one click when one stops working. Keys are kept encrypted; the list only shows endpoints.

type Settings = PetConfig['settings'];
type CustomApiDraft = { apiKey: string; apiUrl: string; modelName: string };

export function SettingsApiProfiles({ customApiDraft, noDragRegionStyle, onCommitSettings, onSetCustomApiDraft, settings }: {
  customApiDraft: CustomApiDraft;
  noDragRegionStyle?: CSSProperties;
  /** Applied to the saved settings and saved at once: a switch should not wait for “保存”. */
  onCommitSettings: (patch: (saved: Settings) => Partial<Settings>) => void;
  onSetCustomApiDraft: (draft: CustomApiDraft) => void;
  settings: Settings;
}) {
  const profiles = readApiProfiles(settings);
  const active = activeApiProfile(settings);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  // The OpenAI-compatible fields are a draft until saved; a profile is made from what is saved.
  const draftUnsaved = settings.llmProvider === 'openai' && (customApiDraft.apiUrl !== settings.customApiUrl
    || customApiDraft.apiKey !== settings.customApiKey || customApiDraft.modelName !== settings.customModelName);
  const hasKey = settings.llmProvider === 'gemini' ? Boolean(settings.geminiApiKey) : Boolean(settings.customApiKey);

  const save = () => {
    if (draftUnsaved) { setNote('上面的接口地址、密钥或模型名还没保存，先保存再存成配置。'); return; }
    if (!name.trim()) { setNote('给这套配置起个名字，比如“DeepSeek”“备用中转”。'); return; }
    onCommitSettings((saved) => saveCurrentAsProfile(saved, name));
    setNote(`已存为「${name.trim()}」。`);
    setName('');
  };

  const use = (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    const patch = applyApiProfile(settings, profile);
    onCommitSettings((saved) => applyApiProfile(saved, profile));
    if (profile.llmProvider === 'openai') {
      onSetCustomApiDraft({ apiKey: patch.customApiKey ?? '', apiUrl: profile.customApiUrl, modelName: profile.customModelName });
    }
    setNote(`已切换到「${profile.name}」，下一句话起就用它。`);
  };

  const remove = (id: string) => {
    const profile = profiles.find((item) => item.id === id);
    if (!profile || !window.confirm(`删除接口配置「${profile.name}」？正在用的设置不受影响。`)) return;
    onCommitSettings((saved) => removeApiProfile(saved, id));
    setNote(`已删除「${profile.name}」。`);
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3" style={noDragRegionStyle}>
      <div>
        <div className="text-xs font-semibold text-foreground">接口配置</div>
        <p className="mt-0.5 text-2xs leading-5 text-muted-foreground">
          把现在的模型设置存下来，可以存好几套；一个接口出问题时点“切换”就换到另一个，不用重新填。也可以直接跟角色说“换到备用模型”。密钥加密保存，不进备份。
        </p>
      </div>
      {profiles.length ? (
        <ul className="space-y-1.5">
          {profiles.map((profile) => {
            const isActive = active?.id === profile.id;
            return (
              <li key={profile.id} className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${isActive ? 'border-primary/50 bg-primary/5' : 'border-border bg-background'}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-foreground">{profile.name}{isActive ? <span className="ml-1.5 text-2xs font-normal text-primary">正在用</span> : null}</div>
                  <div className="truncate text-2xs text-muted-foreground">{describeApiProfile(profile)}{profile.apiKey ? '' : ' · 没有密钥'}</div>
                </div>
                <button type="button" disabled={isActive} onClick={() => use(profile.id)}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-2xs font-semibold text-foreground hover:bg-muted disabled:border-primary/40 disabled:text-primary">
                  {isActive ? <Check className="h-3.5 w-3.5" /> : null}{isActive ? '当前' : '切换'}
                </button>
                <button type="button" onClick={() => remove(profile.id)} title={`删除 ${profile.name}`}
                  className="inline-flex h-7 items-center rounded-md border border-destructive/30 px-2 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex items-center gap-2">
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40}
          placeholder={active ? `当前是「${active.name}」，存成新的起个名字` : '给当前设置起个名字，例如 DeepSeek'}
          onKeyDown={(event) => { if (event.key === 'Enter') save(); }}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary" />
        <button type="button" onClick={save} disabled={!hasKey && !name.trim()}
          className="inline-flex h-8 items-center gap-1 rounded-md bg-primary px-3 text-2xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          <Save className="h-3.5 w-3.5" />存为配置
        </button>
      </div>
      {note ? <div className="text-2xs text-primary">{note}</div> : null}
    </div>
  );
}
