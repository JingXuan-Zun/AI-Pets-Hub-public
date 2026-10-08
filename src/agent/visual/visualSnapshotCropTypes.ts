import { type AgentCaptureQualityAnalysis } from '../agentCaptureQuality';

type VisualSnapshotCropCoordinateSpace = 'native-screen' | 'source' | 'source-ratio';

export interface VisualSnapshotFocusCropRequest {
  coordinateSpace: VisualSnapshotCropCoordinateSpace;
  height?: number;
  paddingRatio: number;
  scale?: number;
  width?: number;
  x?: number;
  y?: number;
}

export interface VisualSnapshotResolvedCrop {
  imageRect: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  label: string;
  scale: number;
  sourceBounds: DesktopPetCaptureRectLike | null;
}

export interface VisualSnapshotPreparedSource {
  captureFallbackLine: string;
  captureQuality: AgentCaptureQualityAnalysis;
  cropLine: string;
  imageDataUrl: string;
  source: DesktopPetCaptureSourceLike;
}

export function normalizeVisualSnapshotCropCoordinateSpace(value: string) {
  if (value === 'native-screen' || value === 'source' || value === 'source-ratio') {
    return value;
  }

  return 'source-ratio';
}
