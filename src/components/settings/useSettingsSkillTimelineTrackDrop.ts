import { useRef, useState, type PointerEvent } from 'react';
import {
  resolveSkillTimelineStripDropTrackId,
  type SkillTimelineStripTrackBounds,
} from './settingsSkillTimelineStripDropTrack';

export function useSettingsSkillTimelineTrackDrop(
  onDropStepTrack?: (stepId: string, trackId: string) => void,
) {
  const trackElementsRef = useRef(new Map<string, HTMLDivElement>());
  const [hoverTrackId, setHoverTrackId] = useState('');

  const registerTrackElement = (trackId: string, element: HTMLDivElement | null) => {
    if (element) {
      trackElementsRef.current.set(trackId, element);
    } else {
      trackElementsRef.current.delete(trackId);
    }
  };
  const resolveTrackIdFromEvent = (event: PointerEvent<HTMLButtonElement>) => {
    const trackBounds: SkillTimelineStripTrackBounds[] = Array.from(trackElementsRef.current.entries())
      .map(([id, element]) => {
        const bounds = element.getBoundingClientRect();
        return { bottom: bounds.bottom, id, top: bounds.top };
      });
    return resolveSkillTimelineStripDropTrackId(trackBounds, event.clientY);
  };
  const previewTrackDrop = (event: PointerEvent<HTMLButtonElement>) => {
    setHoverTrackId(resolveTrackIdFromEvent(event));
  };
  const commitTrackDrop = (stepId: string, event: PointerEvent<HTMLButtonElement>) => {
    const trackId = resolveTrackIdFromEvent(event);
    if (trackId) {
      onDropStepTrack?.(stepId, trackId);
    }
  };

  return {
    clearTrackDrop: () => setHoverTrackId(''),
    commitTrackDrop,
    hoverTrackId,
    previewTrackDrop,
    registerTrackElement,
  };
}
