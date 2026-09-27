# Unity Bridge Protocol

Last updated: 2026-06-03

## Goal

This document defines the TCP JSON-lines contract between the Electron shell and a Unity avatar runtime.

The bridge is intentionally small:

- Electron owns desktop windows, desktop coordinates, persisted settings, and high-level pet state.
- Unity owns avatar loading, animation, expression, lip-sync, look-at, and runtime measurement.
- Both sides exchange runtime-neutral summaries so Three and Unity can coexist.

## Transport

- Host: `127.0.0.1`
- Port: `19777`
- Framing: one UTF-8 JSON object per line, terminated by `\n`
- Direction:
  - Electron -> Unity: commands
  - Unity -> Electron: events

Unity should connect as a TCP client after it starts. If Unity reconnects, Electron replays the latest remembered commands for each `petId`.

## Shared Fields

Every message should include:

- `type`: message type
- `petId`: stable pet id, defaults to `main` if omitted
- `runtimeKind`: optional, should be `unity` when present

Canonical pet ids currently used by the React runtime:

- `main`: primary pet
- companion ids: same ids as the desktop pet roster slots

## Commands: Electron -> Unity

### `loadAvatar`

Requests Unity to load or replace the avatar for one pet.

```json
{"type":"loadAvatar","runtimeKind":"unity","petId":"main","modelUrl":"local-model://models/pet.vrm"}
```

Fields:

- `modelUrl`: resolved model URL or local model URL

Unity should reply with `ready` after the avatar is usable, or `error` if loading fails.

### `setLayout`

Updates presentation-level layout state.

```json
{
  "type":"setLayout",
  "runtimeKind":"unity",
  "petId":"main",
  "scale":1.2,
  "presentationMode":"default",
  "screenWidth":1440,
  "screenHeight":900,
  "viewportX":520,
  "viewportY":260,
  "viewportWidth":256,
  "viewportHeight":256
}
```

Fields:

- `scale`: normalized pet scale from the desktop app
- `presentationMode`: `default` or `interactive-dialogue`
- `screenWidth`, `screenHeight`: renderer-window CSS pixel size used for DPI-safe overlay anchoring
- `viewportX`, `viewportY`, `viewportWidth`, `viewportHeight`: avatar shell bounds in renderer-window CSS pixels

### `setVisibility`

Shows or hides the Unity avatar for one pet.

```json
{"type":"setVisibility","runtimeKind":"unity","petId":"main","visible":true}
```

### `setSemanticState`

Updates high-level behavior state.

```json
{
  "type":"setSemanticState",
  "runtimeKind":"unity",
  "petId":"main",
  "motionKey":"walking",
  "expressionKey":"happy",
  "viseme":"aa",
  "lookAtX":0.4,
  "lookAtY":3.8,
  "dragActive":false,
  "dragDeltaX":0,
  "dragDeltaY":0,
  "hoverRegion":"head"
}
```

Fields:

- `motionKey`: content/runtime motion key, such as `idle`, `walking`, `running`, `eating`, `happy`, `sad`, `sleeping`
- `expressionKey`: expression key, such as `happy`, `sad`, `relaxed`
- `viseme`: current mouth shape key, such as `aa`, `ih`, `ou`, `ee`, `oh`
- `lookAtX`, `lookAtY`: normalized look-at target values from the desktop runtime
- `dragActive`, `dragDeltaX`, `dragDeltaY`: desktop drag state and latest drag delta for lightweight Unity-side drag feedback
- `hoverRegion`: active content hover region, or an empty string when no region is active

High-frequency fields should be de-duplicated or smoothed on the Unity side. Electron may also add send-rate limiting later.

## Events: Unity -> Electron

Unity events should match the neutral avatar runtime event contract used by React.

### `ready`

Avatar is mounted and usable.

```json
{"type":"ready","runtimeKind":"unity","petId":"main"}
```

### `visual-bounds`

Reports avatar visual bounds for layout/debug state.

```json
{
  "type":"visual-bounds",
  "runtimeKind":"unity",
  "petId":"main",
  "source":"measured",
  "bounds":{"left":42,"right":215,"top":18,"bottom":246}
}
```

Fields:

- `source`: `measured` or `fallback`
- `bounds.left`, `bounds.right`, `bounds.top`, `bounds.bottom`: visual bounds in the avatar shell coordinate space

For compatibility, Electron also accepts top-level `left`, `right`, `top`, and `bottom`.

### `motion-state-changed`

Reports the resolved runtime motion key.

```json
{"type":"motion-state-changed","runtimeKind":"unity","petId":"main","motionKey":"walking"}
```

### `expression-state-changed`

Reports the dominant expression key.

```json
{"type":"expression-state-changed","runtimeKind":"unity","petId":"main","expressionKey":"happy"}
```

### `perf-stats`

Reports lightweight runtime telemetry.

```json
{"type":"perf-stats","runtimeKind":"unity","petId":"main","fps":60,"frameIntervalMs":16.7}
```

### `error`

Reports a Unity runtime error worth surfacing to the desktop app.

```json
{"type":"error","runtimeKind":"unity","petId":"main","errorMessage":"Failed to load avatar"}
```

After recovery, Unity should emit `ready` again.

## Compatibility Aliases

Electron accepts these camelCase event aliases from early Unity prototypes:

- `visualBounds` -> `visual-bounds`
- `motionStateChanged` -> `motion-state-changed`
- `expressionStateChanged` -> `expression-state-changed`
- `perfStats` -> `perf-stats`

New Unity code should use the canonical kebab-case event names.

## Current Integration Notes

- Electron bridge server: `electron/unityBridgeService.cjs`
- Renderer shell API: `src/desktopShellBridge.ts`
- Unity command mirror hook: `src/pet-runtime/avatar-runtime/unity/unityAvatarRuntimeBridge.ts`
- Unity event adapter hook: `src/pet-runtime/avatar-runtime/unity/useUnityAvatarRuntimeEvents.ts`
- Neutral event contract: `src/pet-runtime/avatar-runtime/AVATAR_RUNTIME_EVENT_CONTRACT.md`

The first production milestone is not full Unity rendering replacement. It is protocol-compatible event flow: Unity sends the same neutral runtime events that Three already emits.
