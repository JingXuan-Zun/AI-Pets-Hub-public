import { type AgentRuntimeResult } from './runtime/agentRuntimeContract';
import {
  type AgentSessionV3ExperimentalSessionResult,
} from './agentSessionV3ExperimentalSession';

export type AgentSessionV3ExperimentalFeatureFlagMode =
  | 'v2-default'
  | 'v3-experimental';

export type AgentSessionV3ExperimentalRouteKind =
  | 'unavailable'
  | 'v2-default'
  | 'v2-fallback'
  | 'v3-experimental';

export interface ResolveAgentSessionV3ExperimentalRouteOptions {
  fallbackToV2?: boolean | null;
  mode?: AgentSessionV3ExperimentalFeatureFlagMode | null;
  v3ExperimentalAvailable?: boolean | null;
  v3UnavailableReason?: string | null;
}

export interface AgentSessionV3ExperimentalRouteDecision {
  fallbackToV2: boolean;
  reason: string;
  route: AgentSessionV3ExperimentalRouteKind;
  v3ExperimentalRequested: boolean;
}

export type AgentSessionV3ExperimentalFeatureFlagRouteResult<
  V2Result = AgentRuntimeResult,
  V3Result = AgentSessionV3ExperimentalSessionResult,
> =
  | {
      decision: AgentSessionV3ExperimentalRouteDecision & {
        route: 'v2-default';
      };
      result: V2Result;
      v2Result: V2Result;
      v3Result: null;
    }
  | {
      decision: AgentSessionV3ExperimentalRouteDecision & {
        route: 'v2-fallback';
      };
      result: V2Result;
      v2Result: V2Result;
      v3Result: null;
    }
  | {
      decision: AgentSessionV3ExperimentalRouteDecision & {
        route: 'v3-experimental';
      };
      result: V3Result;
      v2Result: null;
      v3Result: V3Result;
    }
  | {
      decision: AgentSessionV3ExperimentalRouteDecision & {
        route: 'unavailable';
      };
      result: null;
      v2Result: null;
      v3Result: null;
    };

export interface RunAgentSessionV3ExperimentalFeatureFlagRouteOptions<
  V2Result = AgentRuntimeResult,
  V3Result = AgentSessionV3ExperimentalSessionResult,
> extends ResolveAgentSessionV3ExperimentalRouteOptions {
  isV3FallbackableResult?: ((result: V3Result) => boolean) | null;
  runV2: () => V2Result | Promise<V2Result>;
  runV3Experimental?: (() => V3Result | Promise<V3Result>) | null;
}

export function isAgentSessionV3ExperimentalFallbackableResult(
  result: AgentSessionV3ExperimentalSessionResult,
) {
  const looseResult = result as AgentSessionV3ExperimentalSessionResult & {
    finalAnswer?: string | null;
    status?: string | null;
  };
  const runtimePhase = result.runtime?.state?.phase ?? null;
  const finalAnswer = typeof looseResult.finalAnswer === 'string' ? looseResult.finalAnswer : '';
  const status = typeof looseResult.status === 'string' ? looseResult.status : '';
  const fallbackEvidenceText = [
    finalAnswer,
    status,
  ].join('\n');

  if (
    (status === 'needs-user' || status === 'waiting' || status === 'failed')
    && /v2 fallback should continue the task|could not safely prepare that command/iu.test(finalAnswer)
  ) {
    return true;
  }

  if (
    (status === 'needs-user' || status === 'waiting' || status === 'failed')
    && /(?:launched-unverified|no-window-match|unverified\s+launch|launch(?:ed)?\s+status:\s*unverified|approved tool result is unverified)/iu.test(fallbackEvidenceText)
  ) {
    return true;
  }

  return Boolean(
    runtimePhase === 'recover'
      && (
        result.status === 'failed'
        || result.status === 'waiting'
      )
  ) || Boolean(
    result.status === 'waiting'
      && runtimePhase === 'recover',
  );
}

export function resolveAgentSessionV3ExperimentalRoute(
  options: ResolveAgentSessionV3ExperimentalRouteOptions = {},
): AgentSessionV3ExperimentalRouteDecision {
  const mode = options.mode ?? 'v2-default';
  const v3ExperimentalRequested = mode === 'v3-experimental';
  const fallbackToV2 = options.fallbackToV2 !== false;

  if (!v3ExperimentalRequested) {
    return {
      fallbackToV2,
      reason: 'AgentSessionV2 remains the default runtime path.',
      route: 'v2-default',
      v3ExperimentalRequested,
    };
  }

  if (options.v3ExperimentalAvailable !== true) {
    return {
      fallbackToV2,
      reason: options.v3UnavailableReason
        ?? 'Experimental v3 runtime is not available for this request.',
      route: fallbackToV2 ? 'v2-fallback' : 'unavailable',
      v3ExperimentalRequested,
    };
  }

  return {
    fallbackToV2,
    reason: 'Experimental v3 runtime was explicitly requested and is available.',
    route: 'v3-experimental',
    v3ExperimentalRequested,
  };
}

export async function runAgentSessionV3ExperimentalFeatureFlagRoute<
  V2Result = AgentRuntimeResult,
  V3Result = AgentSessionV3ExperimentalSessionResult,
>(
  options: RunAgentSessionV3ExperimentalFeatureFlagRouteOptions<V2Result, V3Result>,
): Promise<AgentSessionV3ExperimentalFeatureFlagRouteResult<V2Result, V3Result>> {
  const decision = resolveAgentSessionV3ExperimentalRoute({
    fallbackToV2: options.fallbackToV2,
    mode: options.mode,
    v3ExperimentalAvailable: Boolean(options.runV3Experimental) && options.v3ExperimentalAvailable === true,
    v3UnavailableReason: options.v3UnavailableReason,
  });

  if (decision.route === 'v3-experimental') {
    const v3Result = await options.runV3Experimental!() as V3Result;
    const shouldFallback = decision.fallbackToV2 && (
      options.isV3FallbackableResult
        ? options.isV3FallbackableResult(v3Result)
        : isAgentSessionV3ExperimentalFallbackableResult(v3Result as AgentSessionV3ExperimentalSessionResult)
    );
    if (shouldFallback) {
      const v2Result = await options.runV2() as V2Result;
      return {
        decision: {
          ...decision,
          reason: 'Experimental v3 runtime could not safely prepare the next command, so v2 fallback ran automatically.',
          route: 'v2-fallback',
        },
        result: v2Result,
        v2Result,
        v3Result: null,
      };
    }

    return {
      decision: {
        ...decision,
        route: 'v3-experimental',
      },
      result: v3Result,
      v2Result: null,
      v3Result,
    };
  }

  if (decision.route === 'unavailable') {
    return {
      decision: {
        ...decision,
        route: 'unavailable',
      },
      result: null,
      v2Result: null,
      v3Result: null,
    };
  }

  const result = await options.runV2() as V2Result;
  if (decision.route === 'v2-default') {
    return {
      decision: {
        ...decision,
        route: 'v2-default',
      },
      result,
      v2Result: result,
      v3Result: null,
    };
  }

  return {
    decision: {
      ...decision,
      route: 'v2-fallback',
    },
    result,
    v2Result: result,
    v3Result: null,
  };
}
