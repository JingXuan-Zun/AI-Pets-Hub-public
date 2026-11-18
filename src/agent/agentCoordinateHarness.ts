import { type AgentCoordinateAuditEvidence } from './agentCoordinateAudit';

export interface AgentCoordinateHarnessResult {
  audit: AgentCoordinateAuditEvidence;
  clickPoint: {
    x: number;
    y: number;
  } | null;
  redDotRatio: {
    x: number;
    y: number;
  } | null;
  status:
    | 'coordinate_closure_ok'
    | 'coordinate_closure_untrusted'
    | 'coordinate_closure_no_change'
    | 'coordinate_closure_coordinate_failed'
    | 'coordinate_closure_invalid_ratio';
  targetRegionChanged: boolean | null;
}
