# Avatar Runtime Phase A Status

Last updated: 2026-05-17

## Scope

This note is the short-form implementation status for the current `Phase A` workstream.
It is meant to complement `PROJECT_OPTIMIZATION_2.md`, not replace it.

Current goal:

- keep the existing Three runtime stable
- avoid touching the locked 2D path
- introduce a neutral avatar-runtime bridge/state/event layer that Unity can later reuse

## Landed

- Neutral runtime session store is in place
  - `avatarRuntimeBridge.ts`
- Neutral runtime content/layout/event/type definitions are in place
  - `avatarRuntimeTypes.ts`
  - `avatarRuntimeEvents.ts`
- Neutral semantic snapshot builder is in place
  - `avatarSemanticState.ts`
- Three runtime is now wrapped as a bridge-backed state source
  - `three/threeAvatarRuntimeBridge.ts`
- `Pet3DRenderer -> PetModel3D` is bridge-first, with compatibility fallback preserved
  - `src/components/pet/Pet3DRenderer.tsx`
  - `src/components/PetModel3D.tsx`
- Runtime events now flow upward through a unified container-side entry
  - `usePetContainerAvatarRuntimeEventHandler.ts`
- Runtime event summaries are reduced into neutral per-pet state
  - `avatarRuntimeEventState.ts`
- Runtime state is visible in the system settings panel
  - `src/components/settings/SettingsSystemTab.tsx`
- Remaining runtime summary event outputs are now bridged end-to-end
  - `motion-state-changed`
  - `expression-state-changed`
  - `perf-stats`
- System settings runtime panel text was rewritten into encoding-safe source form
  - keeps Chinese UI output while avoiding terminal/editor mojibake churn
- Container-side runtime event consumption was cleaned up into encoding-safe source form
  - `usePetContainerAvatarRuntimeEventHandler.ts`
- A compact runtime event contract note is now in place
  - `AVATAR_RUNTIME_EVENT_CONTRACT.md`
- Unity bridge protocol documentation and renderer-side event normalization are now in place
  - `unity/UNITY_BRIDGE_PROTOCOL.md`
  - `unity/unityBridgeEventAdapter.ts`
  - `unity/useUnityAvatarRuntimeEvents.ts`
- Primary/companion assembly layers now consume a local runtime surface helper
  - `src/components/pet/petAvatarRuntimeSurface.ts`
  - reduces direct Three-facing assembly leakage in avatar layer composition
- Runtime-facing component and bridge boundaries now prefer neutral drag/presentation types
  - `AvatarRuntimeDragState`
  - `AvatarRuntimePresentationMode`

## Current Progress

Two useful progress views:

- Full optimization route from `PROJECT_OPTIMIZATION_2.md`: about `100%` complete, `0%` remaining
- Current `Phase A` implementation track only: about `100%` complete, `0%` remaining

These are engineering estimates, not delivery guarantees.

## Phase A Closeout

- The final bridge-internal naming cleanup is complete.
- Runtime summary state stays settings-first for now.
- The reducer and event contract remain reusable if we later add more debug or health surfaces.

## Phase B Entry

- A low-risk `Phase B` cleanup has started at the presentation assembly edge.
- `Pet3DRenderer` now reads a local runtime surface helper instead of directly reaching into Three render-adapter fields.
- `PetModel3D` bridge-facing state now depends on a bridge-layer narrowed view type instead of restating a local mixed shape.
- `PetModel3D` compatibility props now prefer bridge-layer Three aliases where possible instead of importing more internal `avatar3d` runtime types directly.
- `PetModel3D` render-surface and presentation-surface resolution now flow through shared helper functions instead of reading more render-adapter and presentation fields inline.
- `PetModel3D` scene-facing camera/action/reaction assembly is now grouped through a local scene-surface helper before reaching `Avatar3DScene`.
- `PetModel3D` bridge-state and legacy-prop resolution now flow through a shared component-state helper, reducing inline compatibility assembly in the component body.
- Standalone `PetModel3D` preview and debug entry points now use a shared standalone-surface helper, keeping non-runtime call sites aligned with the same assembly direction.
- `Pet3DRenderer` bridge input assembly for merged content-manifest and manual motion selection now flows through a shared input-surface helper instead of staying inline in the renderer.
- Unity bridge event normalization now also flows through a shared event-surface helper before reaching the neutral runtime event adapter and hook boundary.
- Primary and companion avatar layers now share a renderer-surface helper for shell presentation state, visual-bounds fallback selection, and `PetVisualRenderer` prop assembly.
- Primary avatar, companion avatar, and companion runtime layers now share a content-surface helper for preset matching, motion-library manifest assembly, and merged runtime content resolution.
- Container-side layer assembly now shares a surface helper for interactive-dialogue visibility/mode resolution and companion runtime layer item assembly.
- Final scene-level layer assembly now also flows through a dedicated scene-surface helper before `PetContainer` hands props to `PetContainerScene`.
- This keeps the current Three runtime stable while further reducing adapter-shape leakage outside the bridge boundary.

## Not Intentionally Touched Yet

- `2D` locked behavior
- `Avatar3DRuntimeMount.tsx` core stable render chain
- large `PetContainer` behavior refactors
- Unity runtime production integration

## Recommended Next Step

- treat the current cleanup pass as a stable stopping point
- if a later pass is needed, prefer Unity production integration or targeted bundle-size work over more naming-only refactors
