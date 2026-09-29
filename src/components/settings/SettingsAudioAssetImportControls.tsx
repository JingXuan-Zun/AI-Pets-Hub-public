import { type ChangeEvent, type RefObject } from 'react';
import { Music2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';

const AUDIO_ACCEPT = '.aac,.flac,.m4a,.mp3,.oga,.ogg,.opus,.wav,.webm,audio/*';

export function SettingsAudioAssetImportControls({
  fileInputRef,
  onSelectFiles,
  onTriggerFilePicker,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onSelectFiles: (files: File[]) => void;
  onTriggerFilePicker: () => void;
}) {
  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    onSelectFiles(selectedFiles);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        multiple
        onChange={handleFileSelection}
      />
      <Button
        type="button"
        variant="outline"
        className="h-8 rounded-sm border-border px-3 text-2xs uppercase tracking-widest"
        onClick={onTriggerFilePicker}
      >
        <Music2 className="mr-1 h-3.5 w-3.5" />
        Import audio
      </Button>
    </>
  );
}
