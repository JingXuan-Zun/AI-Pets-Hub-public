import { useRef, useState, type RefObject } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { type PetAudioAsset, type PetConfig } from '../../types';
import { SettingsAudioAssetImportControls } from './SettingsAudioAssetImportControls';
import {
  createAudioAssetDraftsFromFiles,
  createSettingsAudioAssetsFromImportDrafts,
} from './settingsAudioAssetImportUtils';
import {
  createSettingsAudioAssetFromDraft,
  EMPTY_AUDIO_ASSET_DRAFT,
  removeSettingsAudioAsset,
  type SettingsAudioAssetDraft,
  upsertSettingsAudioAsset,
  upsertSettingsAudioAssets,
} from './settingsAudioAssetLibraryUtils';

interface SettingsAudioAssetSectionProps {
  localConfig: PetConfig;
  onApplyConfig: (config: PetConfig) => void;
}

function createDraftFromAsset(asset: PetAudioAsset): SettingsAudioAssetDraft {
  return {
    aliasesText: (asset.aliases ?? []).join(', '),
    durationMs: asset.durationMs === undefined ? '' : String(asset.durationMs),
    id: asset.id,
    name: asset.name,
    url: asset.url,
  };
}

function AudioAssetRow({
  asset,
  onEdit,
  onRemove,
}: {
  asset: PetAudioAsset;
  onEdit: (asset: PetAudioAsset) => void;
  onRemove: (assetId: string) => void;
}) {
  return (
    <div className="rounded-sm border border-border/80 bg-background/25 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xs font-medium text-foreground">{asset.name}</div>
          <div className="mt-1 truncate font-mono text-3xs uppercase tracking-widest text-muted-foreground">{asset.id}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(asset)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(asset.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-2 truncate text-2xs text-muted-foreground">{asset.url}</div>
      <div className="mt-2 flex flex-wrap gap-2 text-3xs text-muted-foreground">
        {(asset.aliases ?? []).map((alias) => (
          <span key={alias} className="rounded-sm border border-border/70 bg-secondary/30 px-2 py-1">{alias}</span>
        ))}
        {asset.durationMs ? <span className="rounded-sm border border-primary/20 bg-primary/5 px-2 py-1 text-primary">{asset.durationMs} ms</span> : null}
      </div>
    </div>
  );
}

function SettingsAudioAssetHeader({
  fileInputRef,
  onFileSelection,
  onTriggerFilePicker,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelection: (files: File[]) => void;
  onTriggerFilePicker: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Label className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">Audio Assets</Label>
        <div className="mt-1 text-xs text-muted-foreground">
          Skill songId, musicId, or audioId can resolve here by ID, name, or alias.
        </div>
      </div>
      <SettingsAudioAssetImportControls
        fileInputRef={fileInputRef}
        onSelectFiles={onFileSelection}
        onTriggerFilePicker={onTriggerFilePicker}
      />
    </div>
  );
}

function createImportFeedback(savedCount: number, skippedFileNames: string[]) {
  if (savedCount === 0) {
    return skippedFileNames.length > 0
      ? 'No local paths were exposed. Fill paths or URLs manually.'
      : '';
  }

  const skippedText = skippedFileNames.length > 0
    ? `; skipped ${skippedFileNames.length} without local paths`
    : '';
  return `Imported ${savedCount} audio asset${savedCount === 1 ? '' : 's'}${skippedText}.`;
}

function SettingsAudioAssetForm({
  draft,
  feedback,
  onApplyDraft,
  onClearDraft,
  onUpdateDraft,
}: {
  draft: SettingsAudioAssetDraft;
  feedback: string;
  onApplyDraft: () => void;
  onClearDraft: () => void;
  onUpdateDraft: (updates: Partial<SettingsAudioAssetDraft>) => void;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <input className="h-9 rounded-sm border border-border bg-secondary/40 px-3 text-2xs outline-none focus:border-primary" placeholder="ID / songId" value={draft.id} onChange={(event) => onUpdateDraft({ id: event.target.value })} />
        <input className="h-9 rounded-sm border border-border bg-secondary/40 px-3 text-2xs outline-none focus:border-primary" placeholder="Name" value={draft.name} onChange={(event) => onUpdateDraft({ name: event.target.value })} />
        <input className="h-9 rounded-sm border border-border bg-secondary/40 px-3 text-2xs outline-none focus:border-primary md:col-span-2" placeholder="Audio path or URL" value={draft.url} onChange={(event) => onUpdateDraft({ url: event.target.value })} />
        <input className="h-9 rounded-sm border border-border bg-secondary/40 px-3 text-2xs outline-none focus:border-primary" placeholder="Aliases, comma separated" value={draft.aliasesText} onChange={(event) => onUpdateDraft({ aliasesText: event.target.value })} />
        <input className="h-9 rounded-sm border border-border bg-secondary/40 px-3 text-2xs outline-none focus:border-primary" placeholder="Duration ms, optional" value={draft.durationMs} onChange={(event) => onUpdateDraft({ durationMs: event.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="h-8 rounded-sm px-3 text-2xs uppercase tracking-widest" onClick={onApplyDraft}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Save audio
        </Button>
        <Button type="button" variant="outline" className="h-8 rounded-sm border-border px-3 text-2xs uppercase tracking-widest" onClick={onClearDraft}>
          Clear
        </Button>
        {feedback ? <span className="text-2xs text-muted-foreground">{feedback}</span> : null}
      </div>
    </>
  );
}

function SettingsAudioAssetList({
  assets,
  onEdit,
  onRemove,
}: {
  assets: PetAudioAsset[];
  onEdit: (asset: PetAudioAsset) => void;
  onRemove: (assetId: string) => void;
}) {
  if (assets.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-border/80 bg-background/20 px-3 py-5 text-2xs text-muted-foreground">
        No audio assets yet. Add one so role Skill performances can resolve songs by songId or alias.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assets.map((asset) => (
        <AudioAssetRow key={asset.id} asset={asset} onEdit={onEdit} onRemove={onRemove} />
      ))}
    </div>
  );
}

function useSettingsAudioAssetDraftController(
  localConfig: PetConfig,
  onApplyConfig: (config: PetConfig) => void,
) {
  const [draft, setDraft] = useState<SettingsAudioAssetDraft>(EMPTY_AUDIO_ASSET_DRAFT);
  const [feedback, setFeedback] = useState('');
  const updateDraft = (updates: Partial<SettingsAudioAssetDraft>) => {
    setDraft((current) => ({ ...current, ...updates }));
    setFeedback('');
  };
  const applyDraft = () => {
    const asset = createSettingsAudioAssetFromDraft(draft);
    if (!asset) {
      setFeedback('Fill an audio path or URL first.');
      return;
    }

    onApplyConfig(upsertSettingsAudioAsset(localConfig, asset));
    setDraft(EMPTY_AUDIO_ASSET_DRAFT);
    setFeedback(`Saved audio asset: ${asset.name}`);
  };
  const selectFiles = async (files: File[]) => {
    if (files.length === 0) {
      setFeedback('');
      return;
    }

    const result = await createAudioAssetDraftsFromFiles(files);
    if (files.length === 1 && result.drafts[0]) {
      setDraft(result.drafts[0]);
      setFeedback('');
      return;
    }

    const assets = createSettingsAudioAssetsFromImportDrafts(result.drafts);
    if (assets.length > 0) {
      onApplyConfig(upsertSettingsAudioAssets(localConfig, assets));
    }
    setFeedback(createImportFeedback(assets.length, result.skippedFileNames));
  };

  return { applyDraft, draft, feedback, selectFiles, setDraft, updateDraft };
}

export function SettingsAudioAssetSection({
  localConfig,
  onApplyConfig,
}: SettingsAudioAssetSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftController = useSettingsAudioAssetDraftController(localConfig, onApplyConfig);

  const removeAsset = (assetId: string) => {
    onApplyConfig(removeSettingsAudioAsset(localConfig, assetId));
  };

  return (
    <div className="space-y-4 rounded-sm border border-border bg-secondary/15 p-4">
      <SettingsAudioAssetHeader
        fileInputRef={fileInputRef}
        onFileSelection={(files) => void draftController.selectFiles(files)}
        onTriggerFilePicker={() => fileInputRef.current?.click()}
      />
      <SettingsAudioAssetForm
        draft={draftController.draft}
        feedback={draftController.feedback}
        onApplyDraft={draftController.applyDraft}
        onClearDraft={() => draftController.setDraft(EMPTY_AUDIO_ASSET_DRAFT)}
        onUpdateDraft={draftController.updateDraft}
      />
      <SettingsAudioAssetList
        assets={localConfig.musicAssets ?? []}
        onEdit={(asset) => draftController.setDraft(createDraftFromAsset(asset))}
        onRemove={removeAsset}
      />
    </div>
  );
}
