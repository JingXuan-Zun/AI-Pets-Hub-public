// Starting and stopping the microphone belongs to the chat layer (it owns the recogniser and the
// "正在听你说" state). The pet container registers its start / stop here so the character's voice
// capabilities can reach them ("开始听我说" / "别听了") without holding a React ref.

export interface VoiceInputSessionResult {
  errorText?: string | null;
  ok?: boolean;
  responseText?: string;
}

export interface VoiceInputSessionController {
  start: (options?: { agentPrefix?: boolean }) => Promise<VoiceInputSessionResult> | VoiceInputSessionResult;
  stop: () => Promise<VoiceInputSessionResult> | VoiceInputSessionResult;
}

let controller: VoiceInputSessionController | null = null;

/** Registers the chat layer's controller; returns the function that takes it away again. */
export function registerVoiceInputSessionController(next: VoiceInputSessionController) {
  controller = next;
  return () => {
    if (controller === next) controller = null;
  };
}

export function getVoiceInputSessionController() {
  return controller;
}
