import { type AgentCoordinateAuditEvidence } from './agentCoordinateAudit';
import { type AgentCoordinateHarnessResult } from './agentCoordinateHarness';

export type AgentCaptureStatus =
  | 'capture_ok'
  | 'capture_black_frame'
  | 'capture_low_entropy'
  | 'capture_fallback_screen_crop'
  | 'capture_untrusted';

export interface AgentCaptureQualityMetrics {
  dominantColorRatio: number;
  entropy: number;
  height: number;
  lumaStdDev: number;
  meanLuma: number;
  nearBlackRatio: number;
  sampledPixelCount: number;
  uniqueColorBucketCount: number;
  width: number;
}

export interface AgentInputReplayPreview {
  afterCaptureStatus?: AgentCaptureStatus | null;
  afterRedDotDataUrl?: string | null;
  beforeCaptureStatus?: AgentCaptureStatus | null;
  beforeRedDotDataUrl?: string | null;
  clickPoint?: {
    x: number;
    y: number;
  } | null;
  coordinateAudit?: AgentCoordinateAuditEvidence | null;
  coordinateClosure?: AgentCoordinateHarnessResult | null;
  coordinateClosureStatus?: AgentCoordinateHarnessResult['status'] | null;
  screenSource?: string | null;
  uiChanged?: boolean | null;
  visualDeltaRatio?: number | null;
}
