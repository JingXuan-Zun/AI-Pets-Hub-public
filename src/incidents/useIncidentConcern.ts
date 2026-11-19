import { useEffect, type MutableRefObject } from 'react';
import { listCharacterCognition, readCharacterCognition, saveCharacterCognition, updateCharacterCognition } from '../character-cognition/characterCognitionStore';
import { desktopPetChatStore } from '../chatStore';
import { resolveActiveChatPetId } from '../components/chat/chatTargetResolutionUtils';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { getRenderableDesktopPetSlots } from '../multiPetRoster';
import type { PetConfig } from '../types';
import { withIncidentConcern, withoutIncidentConcerns } from './incidentConcern';

// Pet window: a new problem the user has not decided about → on the mind of the character they
// talk to (or the first one who has a state), so she asks in her own words (incidentConcern.ts).

export function useIncidentConcern({ configRef }: { configRef: MutableRefObject<PetConfig> }) {
  useEffect(() => {
    const bridge = typeof window === 'undefined' ? undefined : window.desktopPetShell?.incidents;
    if (!bridge?.onNew) return undefined;
    return bridge.onNew((incident) => {
      const config = configRef.current;
      const active = resolveActiveChatPetId(config, desktopPetChatStore.getState().activePetId);
      const candidates = [active, ...getRenderableDesktopPetSlots(config).map((slot) => slot.id)];
      const roleId = candidates.find((id) => readCharacterCognition(id));
      if (!roleId) {
        pushFrontendRuntimeLog('incidents', 'no character state yet; the question stays in Settings → 体检');
        return;
      }
      updateCharacterCognition(roleId, (current) => withIncidentConcern(current, incident, Date.now()));
      pushFrontendRuntimeLog('incidents', 'new problem put on a character\'s mind', { roleId });
    });
  }, [configRef]);
}

/** After the user decided: nobody keeps asking. */
export function clearIncidentConcerns() {
  const now = Date.now();
  for (const cognition of Object.values(listCharacterCognition())) {
    const next = withoutIncidentConcerns(cognition, now);
    if (next !== cognition) saveCharacterCognition(next);
  }
}
