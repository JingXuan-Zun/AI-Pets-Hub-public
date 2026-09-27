import type { StoryPromptPreset } from './storyPromptPresetTypes';

function safeFileName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'story-prompt-preset';
}

export function serializeStoryPromptPreset(preset: StoryPromptPreset) {
  return JSON.stringify(preset, null, 2);
}

export function readStoryPromptPresetFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('读取 JSON 文件失败。'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

export function downloadStoryPromptPreset(name: string, preset: StoryPromptPreset) {
  const blob = new Blob([serializeStoryPromptPreset(preset)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(name)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
