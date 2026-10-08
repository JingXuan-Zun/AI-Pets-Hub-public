// Lines the character posts on her own (desktop awareness, screen watch, life companion prompts,
// game companion) are spoken like replies. The chat session registers the speaker because it owns
// voice playback; without one (e.g. no chat session mounted) the line is only shown.
type CompanionLineSpeaker = (text: string, petId: string | null) => void;

let speaker: CompanionLineSpeaker | null = null;

export function registerCompanionLineSpeaker(next: CompanionLineSpeaker) {
  speaker = next;
  return () => {
    if (speaker === next) speaker = null;
  };
}

export function speakCompanionLine(text: string, petId: string | null) {
  if (text.trim()) speaker?.(text, petId);
}
