import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import { type AgentRuntimeGameCompanionLoopController } from '../../agent';
import { type PetConfig } from '../../types';
import {
  STOPPED_GAME_COMPANION_LOOP_STATUS,
  useGameCompanionLoopController,
  type GameCompanionLoopStatusSnapshot,
  type GameCompanionSourcePreference,
} from './useGameCompanionLoopController';

interface UsePetContainerGameCompanionLoopStateOptions {
  addLog: (message: string) => void;
  configRef: MutableRefObject<PetConfig>;
}

export function usePetContainerGameCompanionLoopState({
  addLog,
  configRef,
}: UsePetContainerGameCompanionLoopStateOptions) {
  const [gameCompanionLoopStatus, setGameCompanionLoopStatus] = useState<GameCompanionLoopStatusSnapshot>(
    STOPPED_GAME_COMPANION_LOOP_STATUS,
  );
  const [gameCompanionSourcePreference, setGameCompanionSourcePreference] = useState<GameCompanionSourcePreference | null>(null);
  const gameCompanionLoopControllerRef = useRef<AgentRuntimeGameCompanionLoopController | null>(null);
  const gameCompanionSourcePreferenceRef = useRef<GameCompanionSourcePreference | null>(null);

  const gameCompanionLoopController = useGameCompanionLoopController({
    addLog,
    configRef,
    onStatusChange: setGameCompanionLoopStatus,
    preferredSourceRef: gameCompanionSourcePreferenceRef,
  });
  gameCompanionLoopControllerRef.current = gameCompanionLoopController;
  gameCompanionSourcePreferenceRef.current = gameCompanionSourcePreference;

  const handleGameCompanionSourcePreferenceChange = useCallback((preference: GameCompanionSourcePreference | null) => {
    gameCompanionSourcePreferenceRef.current = preference;
    setGameCompanionSourcePreference(preference);
  }, []);

  const handleStopGameCompanionLoop = useCallback(() => {
    gameCompanionLoopControllerRef.current?.stop();
  }, []);

  const handleToggleGameCompanionLoop = useCallback(() => {
    if (gameCompanionLoopStatus.running) {
      gameCompanionLoopControllerRef.current?.stop();
      return;
    }

    gameCompanionLoopControllerRef.current?.start();
  }, [gameCompanionLoopStatus.running]);

  const handleRestartGameCompanionLoopWithSourcePreference = useCallback((preference: GameCompanionSourcePreference | null) => {
    handleGameCompanionSourcePreferenceChange(preference);
    gameCompanionLoopControllerRef.current?.start();
  }, [handleGameCompanionSourcePreferenceChange]);

  const handleRestartGameCompanionLoopWithScreenSource = useCallback(() => {
    handleGameCompanionSourcePreferenceChange(null);
    gameCompanionLoopControllerRef.current?.start({
      sourceType: 'screen',
    });
  }, [handleGameCompanionSourcePreferenceChange]);

  return {
    gameCompanionLoopControllerRef,
    gameCompanionLoopStatus,
    gameCompanionSourcePreference,
    handleGameCompanionSourcePreferenceChange,
    handleRestartGameCompanionLoopWithScreenSource,
    handleRestartGameCompanionLoopWithSourcePreference,
    handleStopGameCompanionLoop,
    handleToggleGameCompanionLoop,
  };
}
