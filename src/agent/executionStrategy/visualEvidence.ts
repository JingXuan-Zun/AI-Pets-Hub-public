import { type AgentChatCommand, type AgentChatCommandResult, type AgentStructuredToolEvidence } from '../agentChatCommand';

export function resolveAgentVisualExecutionStrategyStructuredEvidence(
  result: AgentChatCommandResult,
): AgentStructuredToolEvidence | null {
  return result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? parseAgentVisualExecutionStrategyTextEvidence(result);
}

function collectAgentVisualExecutionStrategyResultText(result: AgentChatCommandResult) {
  return [
    result.responseText,
    result.verification,
    result.errorText,
    ...(result.observations ?? []),
    ...(result.stateSummary?.observedState ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    ...(result.receipt?.summaryLines ?? []),
  ].filter((line): line is string => typeof line === 'string' && Boolean(line.trim())).join('\n');
}

function parseAgentVisualExecutionStrategyTextPoint(
  text: string,
  pattern: RegExp,
): { x: number; y: number } | null {
  const match = pattern.exec(text);
  if (!match) {
    return null;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);
  return Number.isFinite(x) && Number.isFinite(y)
    ? { x, y }
    : null;
}

function parseAgentVisualExecutionStrategyTextEvidence(
  result: AgentChatCommandResult,
): AgentStructuredToolEvidence | null {
  const text = collectAgentVisualExecutionStrategyResultText(result);
  if (!text || !/Visual\s+(?:action readiness|element center|coordinate audit|target matched)/iu.test(text)) {
    return null;
  }

  const readiness = (
    /Visual action readiness:\s*(ready|needs-target-selection|needs-primary-action|needs-coordinate|low-confidence|not-actionable|unknown)/iu.exec(text)?.[1]?.toLowerCase()
  ) as AgentStructuredToolEvidence['visualActionReadiness'] | undefined;
  const confidence = /Visual confidence:\s*(high|medium|low|0?\.\d+|1(?:\.0+)?)/iu.exec(text)?.[1]?.toLowerCase();
  const coordinateAuditStatus = (
    /Visual coordinate audit:\s*status=([a-z0-9_-]+)/iu.exec(text)?.[1]
  ) as AgentStructuredToolEvidence['coordinateAuditStatus'] | undefined;
  const targetMatched = /Visual target matched:\s*([^\n|]+)/iu.exec(text)?.[1]?.trim() ?? null;
  const primaryAction = /Visual primary action:\s*([^\n|]+)/iu.exec(text)?.[1]?.trim() ?? null;
  const relation = /Visual target\/action relation:\s*([^\n|]+)/iu.exec(text)?.[1]?.trim() ?? null;
  const elementRegion = /Visual element region:\s*([^\n|]+)/iu.exec(text)?.[1]?.trim() ?? null;
  const elementCenter = parseAgentVisualExecutionStrategyTextPoint(
    text,
    /Visual element center:\s*x=(-?\d+(?:\.\d+)?)\s*y=(-?\d+(?:\.\d+)?)/iu,
  );
  const elementCenterRatio = parseAgentVisualExecutionStrategyTextPoint(
    text,
    /Visual element center ratio:\s*x=(-?\d+(?:\.\d+)?)\s*y=(-?\d+(?:\.\d+)?)/iu,
  );
  const sourceBoundsMatch = /Visual source bounds:\s*x=(-?\d+(?:\.\d+)?)\s*y=(-?\d+(?:\.\d+)?)\s*width=(\d+(?:\.\d+)?)\s*height=(\d+(?:\.\d+)?)/iu.exec(text);
  const interactionVerificationStatus = (
    /(?:Target interaction|Launcher) verification:\s*status=([a-z0-9_-]+)/iu.exec(text)?.[1]
  ) as NonNullable<AgentStructuredToolEvidence['targetInteractionVerification']>['status'] | undefined;
  const interactionActionMatches = /(?:Target interaction|Launcher) verification:[^\n]*actionMatches=(true|false|unknown)/iu.exec(text)?.[1]?.toLowerCase();

  const numericConfidence = confidence && /^\d/u.test(confidence) ? Number(confidence) : NaN;
  const normalizedConfidence: AgentStructuredToolEvidence['confidence'] = confidence === 'high' || confidence === 'medium' || confidence === 'low'
    ? confidence
    : Number.isFinite(numericConfidence)
      ? numericConfidence >= 0.75 ? 'high' : numericConfidence >= 0.45 ? 'medium' : 'low'
      : null;

  return {
    confidence: normalizedConfidence,
    coordinateAuditStatus: coordinateAuditStatus ?? null,
    elementCenter: elementCenter
      ? {
          coordinateSpace: 'native-screen',
          ...elementCenter,
        }
      : null,
    elementCenterRatio: elementCenterRatio
      ? {
          coordinateSpace: 'source-ratio',
          ...elementCenterRatio,
        }
      : null,
    elementRegion,
    targetInteractionVerification: interactionVerificationStatus
      ? {
          primaryActionMatchesTarget: interactionActionMatches === 'true'
            ? true
            : interactionActionMatches === 'false'
              ? false
              : null,
          status: interactionVerificationStatus,
        }
      : null,
    primaryAction,
    relation,
    sourceBounds: sourceBoundsMatch
      ? {
          coordinateSpace: 'native-screen',
          height: Number(sourceBoundsMatch[4]),
          width: Number(sourceBoundsMatch[3]),
          x: Number(sourceBoundsMatch[1]),
          y: Number(sourceBoundsMatch[2]),
        }
      : null,
    targetMatched,
    visualActionReadiness: readiness ?? null,
  };
}

function isAgentExecutionStrategyFinitePoint(point: AgentStructuredToolEvidence['elementCenter']) {
  return Boolean(point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)));
}

function isAgentExecutionStrategyNativePoint(point: AgentStructuredToolEvidence['elementCenter']) {
  return Boolean(
    isAgentExecutionStrategyFinitePoint(point)
    && (point?.coordinateSpace?.trim().toLowerCase() || 'native-screen') === 'native-screen',
  );
}

function isAgentExecutionStrategyRatioPoint(point: AgentStructuredToolEvidence['elementCenterRatio']) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  const coordinateSpace = point?.coordinateSpace?.trim().toLowerCase() || 'source-ratio';
  return Boolean(
    Number.isFinite(x)
    && Number.isFinite(y)
    && x >= 0
    && x <= 1
    && y >= 0
    && y <= 1
    && coordinateSpace.includes('ratio'),
  );
}

export function resolveAgentExecutionStrategySourceBounds(evidence: AgentStructuredToolEvidence | null) {
  const bounds = evidence?.sourceBounds ?? null;
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  const coordinateSpace = bounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (
    ![x, y, width, height].every(Number.isFinite)
    || width <= 0
    || height <= 0
    || coordinateSpace !== 'native-screen'
  ) {
    return null;
  }

  return { height, width, x, y };
}

// A screen point must lie inside the analyzed window/crop. Vision models sometimes give
// window-pixel bounds or centers without a coordinate space (e.g. 595,479 for a window at
// 684,355); read as screen coordinates they miss the window, so the ratio point is used.
const AGENT_EXECUTION_STRATEGY_SOURCE_TOLERANCE_PX = 8;

function keepAgentExecutionStrategyPointInsideSource(
  point: { x: number; y: number } | null,
  sourceBounds: ReturnType<typeof resolveAgentExecutionStrategySourceBounds>,
) {
  if (!point || !sourceBounds) return point;
  const tolerance = AGENT_EXECUTION_STRATEGY_SOURCE_TOLERANCE_PX;
  return point.x >= sourceBounds.x - tolerance && point.x <= sourceBounds.x + sourceBounds.width + tolerance
    && point.y >= sourceBounds.y - tolerance && point.y <= sourceBounds.y + sourceBounds.height + tolerance
    ? point
    : null;
}

function resolveAgentExecutionStrategyElementBoundsCenter(
  evidence: AgentStructuredToolEvidence | null,
  sourceBounds: ReturnType<typeof resolveAgentExecutionStrategySourceBounds>,
) {
  const bounds = evidence?.elementBounds ?? null;
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  const coordinateSpace = bounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (!bounds || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  if (coordinateSpace === 'native-screen') {
    return {
      x: Math.round(x + width / 2),
      y: Math.round(y + height / 2),
    };
  }

  if (coordinateSpace.includes('ratio') && sourceBounds) {
    return {
      x: Math.round(sourceBounds.x + sourceBounds.width * (x + width / 2)),
      y: Math.round(sourceBounds.y + sourceBounds.height * (y + height / 2)),
    };
  }

  return null;
}

export function resolveAgentExecutionStrategySourceHwnd(options: {
  command: AgentChatCommand;
  evidence: AgentStructuredToolEvidence | null;
}) {
  const input = options.command.toolCall?.input ?? {};
  const candidateWindowHwnd = [
    ...(Array.isArray(options.evidence?.actionCandidates) ? options.evidence.actionCandidates : []),
    ...(Array.isArray(options.evidence?.targetCandidates) ? options.evidence.targetCandidates : []),
  ]
    .map((candidate) => Number(candidate.window?.hwnd))
    .find((hwnd) => Number.isFinite(hwnd) && hwnd > 0);
  const hwnd = Number(
    options.evidence?.finalWindow?.hwnd
      ?? candidateWindowHwnd
      ?? input.hwnd
      ?? input.sourceHwnd
      ?? input.windowHandle,
  );
  return Number.isFinite(hwnd) && hwnd > 0 ? Math.round(hwnd) : null;
}

function isAgentExecutionStrategyCoordinateAuditOk(evidence: AgentStructuredToolEvidence | null) {
  const status = evidence?.coordinateAuditStatus ?? evidence?.coordinateAudit?.status ?? null;
  return status === 'coordinate_ok';
}

export function resolveAgentExecutionStrategyCoordinatePoint(evidence: AgentStructuredToolEvidence | null) {
  if (!evidence) {
    return {
      point: null,
      reason: 'no structured visual evidence',
    };
  }

  const sourceBounds = resolveAgentExecutionStrategySourceBounds(evidence);
  const boundsCenter = keepAgentExecutionStrategyPointInsideSource(
    resolveAgentExecutionStrategyElementBoundsCenter(evidence, sourceBounds),
    sourceBounds,
  );
  if (boundsCenter) {
    return {
      point: boundsCenter,
      reason: 'used the geometric center of the actionable element bounds',
    };
  }

  if (isAgentExecutionStrategyRatioPoint(evidence.elementCenterRatio) && sourceBounds) {
    return {
      point: {
        x: Math.round(sourceBounds.x + sourceBounds.width * Number(evidence.elementCenterRatio?.x)),
        y: Math.round(sourceBounds.y + sourceBounds.height * Number(evidence.elementCenterRatio?.y)),
      },
      reason: 'derived native-screen point from elementCenterRatio and sourceBounds',
    };
  }

  if (
    isAgentExecutionStrategyNativePoint(evidence.elementCenter)
    && isAgentExecutionStrategyCoordinateAuditOk(evidence)
    && keepAgentExecutionStrategyPointInsideSource({ x: Number(evidence.elementCenter?.x), y: Number(evidence.elementCenter?.y) }, sourceBounds)
  ) {
    return {
      point: {
        x: Math.round(Number(evidence.elementCenter?.x)),
        y: Math.round(Number(evidence.elementCenter?.y)),
      },
      reason: 'native-screen elementCenter passed coordinate audit',
    };
  }

  const auditStatus = evidence.coordinateAuditStatus ?? evidence.coordinateAudit?.status ?? null;
  if (auditStatus && auditStatus !== 'coordinate_ok') {
    return {
      point: null,
      reason: `coordinate audit is ${auditStatus}`,
    };
  }

  if (isAgentExecutionStrategyNativePoint(evidence.elementCenter)) {
    return {
      point: null,
      reason: 'native-screen elementCenter has no passing coordinate audit',
    };
  }

  if (isAgentExecutionStrategyRatioPoint(evidence.elementCenterRatio) && !sourceBounds) {
    return {
      point: null,
      reason: 'elementCenterRatio is available but sourceBounds are missing or not native-screen',
    };
  }

  return {
    point: null,
    reason: !evidence.elementCenter && !evidence.elementCenterRatio
      ? 'no visual action point'
      : `coordinate space is ${evidence.elementCenter?.coordinateSpace ?? evidence.elementCenterRatio?.coordinateSpace ?? 'unknown'}`,
  };
}

/** The window handle the click was located in, so a replaced or closed window is caught before clicking. */
export function resolveAgentExecutionStrategyExpectedWindowHwnd(
  evidence: AgentStructuredToolEvidence | null | undefined,
  clickPoint?: { x: number; y: number } | null,
) {
  const match = /^window:(\d+):/u.exec(evidence?.sourceBounds?.sourceId ?? '');
  const hwnd = match ? Number(match[1]) : NaN;
  if (Number.isFinite(hwnd) && hwnd > 0) return hwnd;
  // Screen-level reads carry no window id; fall back to the observed window that held the
  // point, so a later stale-click check can tell when that window was replaced (e.g. by login).
  const window = evidence?.finalWindow;
  const bounds = window?.bounds;
  const windowHwnd = Number(window?.hwnd);
  if (!clickPoint || !bounds || !(windowHwnd > 0)) return null;
  const [x, y, width, height] = [bounds.x, bounds.y, bounds.width, bounds.height].map(Number);
  const inside = [x, y, width, height].every(Number.isFinite)
    && clickPoint.x >= x && clickPoint.x <= x + width && clickPoint.y >= y && clickPoint.y <= y + height;
  return inside ? Math.round(windowHwnd) : null;
}
