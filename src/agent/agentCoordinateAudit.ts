export type AgentCoordinateAuditStatus =
  | 'coordinate_ok'
  | 'coordinate_out_of_bounds'
  | 'coordinate_display_mismatch'
  | 'coordinate_unknown';

export interface AgentCoordinateAuditDistanceToBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface AgentCoordinateAuditEvidence {
  coordinateSpace?: string | null;
  distanceToBounds?: AgentCoordinateAuditDistanceToBounds | null;
  insideSourceBounds?: boolean | null;
  point?: {
    x: number;
    y: number;
  } | null;
  pointDisplayId?: string | null;
  pointDisplayLabel?: string | null;
  reason: string;
  sourceBounds?: {
    height: number;
    width: number;
    x: number;
    y: number;
  } | null;
  sourceBoundsCoordinateSpace?: string | null;
  sourceDisplayId?: string | null;
  sourceDisplayLabel?: string | null;
  sourceId?: string | null;
  sourceName?: string | null;
  sourceNativeBoundsSource?: string | null;
  sourceRatio?: {
    x: number;
    y: number;
  } | null;
  sourceScaleFactor?: number | null;
  sourceType?: string | null;
  status: AgentCoordinateAuditStatus;
}
