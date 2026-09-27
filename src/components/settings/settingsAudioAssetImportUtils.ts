import { createPetAudioAssetFromDraft } from '../../petAudioAssets';
import { type PetAudioAsset } from '../../types';
import { type SettingsAudioAssetDraft } from './settingsAudioAssetLibraryUtils';

const AUDIO_METADATA_TIMEOUT_MS = 4000;

export interface AudioAssetImportFileLike {
  name: string;
  path?: unknown;
}

export interface AudioAssetDraftImportResult {
  drafts: SettingsAudioAssetDraft[];
  skippedFileNames: string[];
}

function getFileLocalPath(file: AudioAssetImportFileLike) {
  return typeof file.path === 'string' ? file.path.trim() : '';
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/u, '').trim();
}

function normalizeAudioDurationMs(durationSeconds: number) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return '';
  }

  return String(Math.round(durationSeconds * 1000));
}

function createObjectUrl(file: File) {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return '';
  }

  try {
    return URL.createObjectURL(file);
  } catch {
    return '';
  }
}

function createUniqueImportId(baseId: string, usedIds: Set<string>) {
  const normalizedBaseId = baseId.trim() || 'audio';
  if (!usedIds.has(normalizedBaseId)) {
    return normalizedBaseId;
  }

  let suffix = 2;
  while (usedIds.has(`${normalizedBaseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${normalizedBaseId}-${suffix}`;
}

export function createAudioAssetDraftFromFileLike(
  file: AudioAssetImportFileLike,
): SettingsAudioAssetDraft | null {
  const filePath = getFileLocalPath(file);
  if (!filePath) {
    return null;
  }

  const fallbackName = stripFileExtension(file.name) || file.name;
  return {
    aliasesText: '',
    durationMs: '',
    id: fallbackName,
    name: fallbackName,
    url: filePath,
  };
}

export function readAudioFileDurationMs(file: File): Promise<string> {
  if (typeof Audio === 'undefined') {
    return Promise.resolve('');
  }

  const objectUrl = createObjectUrl(file);
  if (!objectUrl) {
    return Promise.resolve('');
  }

  return new Promise((resolve) => {
    const audio = new Audio();
    let timeoutId: ReturnType<typeof setTimeout>;
    let settled = false;
    const settle = (durationMs = '') => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('error', handleError);
      URL.revokeObjectURL(objectUrl);
      resolve(durationMs);
    };
    const handleLoaded = () => settle(normalizeAudioDurationMs(audio.duration));
    const handleError = () => settle();
    timeoutId = setTimeout(() => settle(), AUDIO_METADATA_TIMEOUT_MS);
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('error', handleError);
    audio.src = objectUrl;
    audio.load();
  });
}

export async function createAudioAssetDraftFromFileWithMetadata(
  file: File,
): Promise<SettingsAudioAssetDraft | null> {
  const draft = createAudioAssetDraftFromFileLike(file);
  if (!draft) {
    return null;
  }

  const durationMs = await readAudioFileDurationMs(file);
  return durationMs ? { ...draft, durationMs } : draft;
}

export async function createAudioAssetDraftsFromFiles(
  files: Iterable<File>,
): Promise<AudioAssetDraftImportResult> {
  const fileList = Array.from(files);
  const drafts = await Promise.all(fileList.map(createAudioAssetDraftFromFileWithMetadata));
  return {
    drafts: drafts.filter((draft): draft is SettingsAudioAssetDraft => Boolean(draft)),
    skippedFileNames: fileList
      .filter((_, index) => !drafts[index])
      .map((file) => file.name),
  };
}

export function createSettingsAudioAssetsFromImportDrafts(
  drafts: SettingsAudioAssetDraft[],
): PetAudioAsset[] {
  const usedIds = new Set<string>();
  return drafts
    .map((draft) => createPetAudioAssetFromDraft(draft))
    .filter((asset): asset is PetAudioAsset => Boolean(asset))
    .map((asset) => {
      const id = createUniqueImportId(asset.id, usedIds);
      usedIds.add(id);
      return id === asset.id ? asset : { ...asset, id };
    });
}
