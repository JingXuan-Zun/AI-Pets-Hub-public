# ADR-0001: Version-Neutral AgentRuntime Entry

- Status: Accepted
- Date: 2026-07-12
- Updated: 2026-07-23

## Context

The UI controller directly selected V2 or V3 in four initial-run and continuation paths. V3 reused V2 model, transaction, continuation, and result contracts. V4 only observed V2 events as a Shadow. This allowed multiple Modules to influence routing and made fixes easy to apply to one path but miss another.

## Decision

All production task starts and continuations enter through the version-neutral production Runtime entry. The UI Controller calls `runAgentProductionRuntime()`, which keeps task lifecycle, continuation, cancellation, approval, execution, and evidence transitions behind Runtime contracts.

The public Runtime contract lives under `src/agent/runtime/` and cannot reference versioned sessions. Runtime version selection and automatic V2/V3 fallback have been removed. `agentProductionSessionImplementation.ts` is the single production Session implementation and is reached only through `agentProductionSession.ts`.

Dependency direction is:

```text
UI -> Production Runtime -> Task Runtime
                         -> Permission Router
                         -> Tool Transaction Executor
                         -> Evidence Engine
                         -> Production Session implementation
```

Runtime core must never import a Legacy Adapter or a versioned session. Historical V3/Pilot diagnostics remain isolated behind `src/agent/legacy/index.ts` and are not production routing choices. Old persisted `agentSessionV2` chat records and removed runtime-mode settings remain readable only through explicit one-way compatibility readers.

## Consequences

- Version routing is no longer duplicated in UI control flow.
- Production execution has no runtime version selector or cross-version fallback.
- SessionV2 entry and helper compatibility Modules are retired and must remain absent.
- Historical V3/Pilot diagnostic corpora remain available without entering the production Agent barrel.
- Persisted-data compatibility is read-only and must not restore versioned runtime ownership.
- New capabilities must target the version-neutral Runtime contracts instead of adding separate V2/V3/V4 paths.

## Enforcement

`npm run check:agent-runtime-architecture` fails if Runtime core references V2/V3, if the UI Controller restores the old version router, or if a retired `agentSessionV2*.ts` compatibility Module reappears.

`npm run check:agent-runtime-retirement -- --evidence <manifest>` additionally requires six reviewed production observations from one matching source revision. Source retirement and production-observation acceptance are intentionally separate gates.
