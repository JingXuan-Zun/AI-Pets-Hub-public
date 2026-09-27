# Avatar Runtime Event Contract

Last updated: 2026-05-17

## Purpose

This note defines the current neutral event contract emitted through `AvatarRuntimeBridgeSession.emitEvent(...)`.
It is the short-form source of truth for:

- event names
- payload meaning
- source-of-truth priority
- emission frequency expectations
- consumer expectations in `PetContainer` and future Unity coexistence work

## Event Ownership

- The runtime bridge session owns event transport.
- The concrete runtime implementation owns event production.
  - Today: Three
  - Later: Unity can emit the same contract
- Container-side consumers must treat the payloads as runtime-neutral summaries.

## Current Event Set

- `ready`
- `visual-bounds`
- `motion-state-changed`
- `expression-state-changed`
- `perf-stats`
- `error`

## Event Semantics

### `ready`

- Means the runtime instance has reached a usable mounted state.
- It does not guarantee every optional follow-up sample has completed.
- It is valid for `visual-bounds` or `perf-stats` to arrive after `ready`.

### `visual-bounds`

Payload:

- `bounds`
- `source: 'fallback' | 'measured'`

Rules:

- `fallback` means the bounds came from projected/presentation heuristics.
- `measured` means the bounds came from runtime canvas sampling.
- Consumers should prefer `measured` over `fallback` when both exist.
- `fallback` exists to keep shell layout, drag limits, and collision logic responsive before sampling completes.
- A later `measured` event is expected to replace the earlier approximation.

Priority:

1. latest `measured`
2. latest `fallback`

### `motion-state-changed`

Payload:

- `motionKey: string | null`

Rules:

- This is the resolved runtime motion summary, not the raw requested action.
- It should emit only when the resolved motion key changes.
- `null` means no stable resolved motion key is currently available.

Current Three source of truth:

- resolved motion key from `resolveAvatar3DMotionState(...)`

### `expression-state-changed`

Payload:

- `expressionKey: string | null`

Rules:

- This is a presentation summary for the currently dominant expression.
- Prefer explicit content expression keys when available.
- Fall back to the active expression action label if no content key exists.
- Emit only when the summary value changes.

Current Three source of truth priority:

1. `reactionSummary.expressionContentKey`
2. `reactionSummary.activeExpression`
3. `null`

### `perf-stats`

Payload:

- `fps?: number | null`
- `frameIntervalMs?: number | null`

Rules:

- This is lightweight runtime telemetry, not a profiler-grade metric.
- Current values are approximate and derived from the effective render interval policy.
- Emit only when the summarized values change.
- Consumers may use it for health/status display, not for gameplay-critical logic.

Current Three source of truth:

- `effectiveRenderFrameIntervalMs`
- derived `fps = round(1000 / frameIntervalMs)`

### `error`

Payload:

- `errorMessage: string`

Rules:

- Means the runtime hit a render/load failure worth surfacing to container-side health state.
- Repeated identical errors may be de-duplicated by consumers.
- A later `ready` event may represent successful recovery.

## Consumer Guidance

- Consumers should not assume every event arrives on every frame.
- Consumers should treat the summary reducer state as the primary read model.
- Consumers should avoid direct Three-specific interpretation where the neutral summary is enough.
- Settings/debug surfaces may display the summary state directly.
- Future Unity runtime work should target contract compatibility before adding new event kinds.

## Phase A Boundary

This contract is intentionally small for Phase A.
Anything below should stay out of the neutral event layer until needed:

- raw animation clip names
- per-frame viseme streams
- detailed renderer memory counters
- runtime-specific scene graph details
