import { useCallback, useEffect, useRef, useState } from 'react';

interface UsePetMovementInteractionPauseOptions {
  isHovered: boolean;
}

const POINTER_OPERATION_PAUSE_MS = 720;
const WHEEL_OPERATION_PAUSE_MS = 680;
const CONTEXT_MENU_OPERATION_PAUSE_MS = 960;
const KEYBOARD_OPERATION_PAUSE_MS = 520;

export function usePetMovementInteractionPause({
  isHovered,
}: UsePetMovementInteractionPauseOptions) {
  const hoverStateRef = useRef(isHovered);
  const cooldownTimeoutRef = useRef<number | null>(null);
  const wheelInteractionTimeoutRef = useRef<number | null>(null);
  const [isPointerPressed, setIsPointerPressed] = useState(false);
  const [isInteractionCooldownActive, setIsInteractionCooldownActive] = useState(false);
  const [isWheelInteractionActive, setIsWheelInteractionActive] = useState(false);

  const clearInteractionCooldown = useCallback(() => {
    if (cooldownTimeoutRef.current !== null) {
      window.clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
    setIsInteractionCooldownActive(false);
  }, []);

  const activateInteractionCooldown = useCallback((durationMs: number) => {
    setIsInteractionCooldownActive(true);

    if (cooldownTimeoutRef.current !== null) {
      window.clearTimeout(cooldownTimeoutRef.current);
    }

    cooldownTimeoutRef.current = window.setTimeout(() => {
      cooldownTimeoutRef.current = null;
      setIsInteractionCooldownActive(false);
    }, durationMs);
  }, []);

  const notifyPointerDownInteraction = useCallback(() => {
    setIsPointerPressed(true);
    activateInteractionCooldown(POINTER_OPERATION_PAUSE_MS);
  }, [activateInteractionCooldown]);

  const notifyWheelInteraction = useCallback(() => {
    activateInteractionCooldown(WHEEL_OPERATION_PAUSE_MS);

    setIsWheelInteractionActive(true);
    if (wheelInteractionTimeoutRef.current !== null) {
      window.clearTimeout(wheelInteractionTimeoutRef.current);
    }
    wheelInteractionTimeoutRef.current = window.setTimeout(() => {
      wheelInteractionTimeoutRef.current = null;
      setIsWheelInteractionActive(false);
    }, WHEEL_OPERATION_PAUSE_MS);
  }, [activateInteractionCooldown]);

  const notifyContextMenuInteraction = useCallback(() => {
    activateInteractionCooldown(CONTEXT_MENU_OPERATION_PAUSE_MS);
  }, [activateInteractionCooldown]);

  useEffect(() => {
    hoverStateRef.current = isHovered;
  }, [isHovered]);

  useEffect(() => {
    const releasePointerInteraction = () => {
      setIsPointerPressed(false);
    };

    window.addEventListener('pointerup', releasePointerInteraction, true);
    window.addEventListener('pointercancel', releasePointerInteraction, true);
    window.addEventListener('blur', releasePointerInteraction);

    return () => {
      window.removeEventListener('pointerup', releasePointerInteraction, true);
      window.removeEventListener('pointercancel', releasePointerInteraction, true);
      window.removeEventListener('blur', releasePointerInteraction);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = () => {
      if (!hoverStateRef.current) {
        return;
      }

      activateInteractionCooldown(KEYBOARD_OPERATION_PAUSE_MS);
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [activateInteractionCooldown]);

  useEffect(() => () => {
    if (cooldownTimeoutRef.current !== null) {
      window.clearTimeout(cooldownTimeoutRef.current);
      cooldownTimeoutRef.current = null;
    }
    if (wheelInteractionTimeoutRef.current !== null) {
      window.clearTimeout(wheelInteractionTimeoutRef.current);
      wheelInteractionTimeoutRef.current = null;
    }
  }, []);

  return {
    isMovementInteractionPaused: isPointerPressed || isInteractionCooldownActive,
    isWheelInteractionActive,
    notifyContextMenuInteraction,
    notifyPointerDownInteraction,
    notifyWheelInteraction,
  };
}
