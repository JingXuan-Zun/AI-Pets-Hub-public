import { PlayCircle, StopCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/button';
import { createAudioPlaybackSession } from '../../voice/ttsPlaybackPrimitives';
import { type VoicePlaybackSession } from '../../voice/types';
import { type SettingsSkillTimelineAudioPreviewSource } from './settingsSkillTimelineAudioPreview';

type AudioPreviewStatus = 'ended' | 'failed' | 'idle' | 'playing';

interface SettingsSkillTimelineAudioPreviewButtonProps {
  previewSource: SettingsSkillTimelineAudioPreviewSource | null;
}

function createStatusLabel(
  status: AudioPreviewStatus,
  previewSource: SettingsSkillTimelineAudioPreviewSource | null,
  errorText: string,
) {
  if (!previewSource) {
    return 'No playable audio source';
  }

  if (status === 'failed') {
    return errorText || 'Preview failed';
  }

  if (status === 'playing') {
    return `Playing ${previewSource.label}`;
  }

  if (status === 'ended') {
    return `Preview ended: ${previewSource.label}`;
  }

  return previewSource.label;
}

export function SettingsSkillTimelineAudioPreviewButton({
  previewSource,
}: SettingsSkillTimelineAudioPreviewButtonProps) {
  const sessionRef = useRef<VoicePlaybackSession | null>(null);
  const tokenRef = useRef(0);
  const [status, setStatus] = useState<AudioPreviewStatus>('idle');
  const [errorText, setErrorText] = useState('');

  const stopPreview = () => {
    tokenRef.current += 1;
    sessionRef.current?.stop();
    sessionRef.current = null;
    setStatus('idle');
    setErrorText('');
  };

  useEffect(() => stopPreview, []);
  useEffect(() => {
    stopPreview();
  }, [previewSource?.playbackUrl]);

  const startPreview = () => {
    if (!previewSource) {
      return;
    }

    stopPreview();
    const session = createAudioPlaybackSession(
      previewSource.playbackUrl,
      false,
      'Skill timeline audio preview',
    );
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    sessionRef.current = session;
    setStatus('playing');

    void session.done
      .then(() => {
        if (tokenRef.current === token && sessionRef.current === session) {
          sessionRef.current = null;
          setStatus('ended');
        }
      })
      .catch((error) => {
        if (tokenRef.current === token) {
          sessionRef.current = null;
          setErrorText(error instanceof Error ? error.message : String(error));
          setStatus('failed');
        }
      });
  };

  const isPlaying = status === 'playing';
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Button
        type="button"
        variant={isPlaying ? 'destructive' : 'outline'}
        size="sm"
        disabled={!previewSource}
        onClick={isPlaying ? stopPreview : startPreview}
      >
        {isPlaying ? <StopCircle /> : <PlayCircle />}
        {isPlaying ? 'Stop' : 'Preview'}
      </Button>
      <span className="min-w-0 truncate text-2xs text-muted-foreground">
        {createStatusLabel(status, previewSource, errorText)}
      </span>
    </div>
  );
}
