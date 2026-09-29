import { useCallback, useEffect, useRef, useState } from 'react';
import {
  captureOptionsEqual,
  cloneCaptureOptions,
  createCompositeCaptureStream,
  createCroppedCaptureStream,
  createDesktopSourceStream,
  releaseManagedMediaStream,
} from '../services/desktopCapture';

interface UseDesktopCaptureOptions {
  addLog: (message: string) => void;
  unsupportedMessage: string;
  failedMessage: string;
  endedMessage: string;
  stoppedMessage: string;
  formatConnectedMessage: (options: DesktopPetCaptureOptionsLike) => string;
}

export function useDesktopCapture({
  addLog,
  unsupportedMessage,
  failedMessage,
  endedMessage,
  stoppedMessage,
  formatConnectedMessage,
}: UseDesktopCaptureOptions) {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [activeScreenCaptureOptions, setActiveScreenCaptureOptions] = useState<DesktopPetCaptureOptionsLike | null>(null);
  const liveScreenCaptureSessionRef = useRef(false);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const addLogRef = useRef(addLog);
  const formatConnectedMessageRef = useRef(formatConnectedMessage);
  const messagesRef = useRef({
    unsupportedMessage,
    failedMessage,
    endedMessage,
    stoppedMessage,
  });

  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);

  useEffect(() => {
    formatConnectedMessageRef.current = formatConnectedMessage;
  }, [formatConnectedMessage]);

  useEffect(() => {
    messagesRef.current = {
      unsupportedMessage,
      failedMessage,
      endedMessage,
      stoppedMessage,
    };
  }, [unsupportedMessage, failedMessage, endedMessage, stoppedMessage]);

  const handlePreviewCaptureOptionsChange = useCallback((options?: DesktopPetCaptureOptionsLike | null) => {
    const nextOptions = cloneCaptureOptions(options);
    setActiveScreenCaptureOptions((currentOptions) => (
      captureOptionsEqual(currentOptions, nextOptions) ? currentOptions : nextOptions
    ));
  }, []);

  const handleStartScreenCapture = useCallback(async (options?: DesktopPetCaptureOptionsLike) => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia && !navigator.mediaDevices?.getUserMedia) {
        addLogRef.current(messagesRef.current.unsupportedMessage);
        return;
      }

      const normalizedOptions: DesktopPetCaptureOptionsLike = cloneCaptureOptions(options) ?? {};
      liveScreenCaptureSessionRef.current = false;
      releaseManagedMediaStream(screenStreamRef.current);
      screenStreamRef.current = null;
      setScreenStream(null);
      setActiveScreenCaptureOptions(null);

      const finalStream = normalizedOptions.mode === 'area'
        && normalizedOptions.cropRect
        && Array.isArray(normalizedOptions.areaSources)
        && normalizedOptions.areaSources.length
        ? await createCompositeCaptureStream(
            normalizedOptions.areaSources,
            normalizedOptions.cropRect,
            normalizedOptions.cropBasisWidth,
            normalizedOptions.cropBasisHeight,
          )
        : await (async () => {
            let sourceStream: MediaStream;
            if (normalizedOptions.sourceId && navigator.mediaDevices?.getUserMedia) {
              sourceStream = await createDesktopSourceStream(normalizedOptions.sourceId);
            } else {
              sourceStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
              });
            }

            return normalizedOptions.mode === 'area' && normalizedOptions.cropRect
              ? createCroppedCaptureStream(
                  sourceStream,
                  normalizedOptions.cropRect,
                  normalizedOptions.cropBasisWidth,
                  normalizedOptions.cropBasisHeight,
                )
              : sourceStream;
          })();

      liveScreenCaptureSessionRef.current = true;
      screenStreamRef.current = finalStream;
      setScreenStream(finalStream);
      setActiveScreenCaptureOptions(normalizedOptions);
      addLogRef.current(formatConnectedMessageRef.current(normalizedOptions));

      const primaryTrack = finalStream.getVideoTracks()[0];
      if (primaryTrack) {
        primaryTrack.onended = () => {
          setScreenStream((currentStream) => {
            if (currentStream !== finalStream) {
              return currentStream;
            }

            screenStreamRef.current = null;
            return null;
          });
          addLogRef.current(messagesRef.current.endedMessage);
        };
      }
    } catch (error) {
      console.error('Error capturing screen:', error);
      liveScreenCaptureSessionRef.current = false;
      addLogRef.current(messagesRef.current.failedMessage);
    }
  }, []);

  const handleStopScreenCapture = useCallback(() => {
    const currentStream = screenStreamRef.current;
    if (!currentStream) {
      return;
    }

    liveScreenCaptureSessionRef.current = false;
    releaseManagedMediaStream(currentStream);
    screenStreamRef.current = null;
    setScreenStream(null);
    setActiveScreenCaptureOptions(null);
    addLogRef.current(messagesRef.current.stoppedMessage);
  }, []);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  useEffect(() => {
    if (screenStream || !liveScreenCaptureSessionRef.current) {
      return;
    }

    liveScreenCaptureSessionRef.current = false;
    setActiveScreenCaptureOptions(null);
  }, [screenStream]);

  useEffect(() => {
    return () => {
      releaseManagedMediaStream(screenStreamRef.current);
      screenStreamRef.current = null;
    };
  }, []);

  return {
    screenStream,
    activeScreenCaptureOptions,
    handlePreviewCaptureOptionsChange,
    handleStartScreenCapture,
    handleStopScreenCapture,
  };
}
