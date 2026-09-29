import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export type AgentSessionV3PilotRealCorpusBatchSmokeIndexGroup =
  | 'cli-contract'
  | 'coverage-index'
  | 'evidence-package'
  | 'evidence-summary'
  | 'final-gap-report'
  | 'gap-action-checklist'
  | 'handoff'
  | 'intake-field-completeness'
  | 'intake-filling-support'
  | 'intake-readiness-gate'
  | 'intake-template'
  | 'intake-validator'
  | 'metadata-quality'
  | 'missing-evidence-rollup'
  | 'next-evidence-target'
  | 'operator-checklist'
  | 'p0-intake-target-status'
  | 'p0-real-evidence-closeout'
  | 'package-health'
  | 'preflight'
  | 'readiness-rollup'
  | 'review-summary'
  | 'reviewer-packet'
  | 'runbook'
  | 'runbook-completion'
  | 'sample-note'
  | 'status-dashboard';

export interface AgentSessionV3PilotRealCorpusBatchSmokeIndexEntry {
  boundary: string;
  group: AgentSessionV3PilotRealCorpusBatchSmokeIndexGroup;
  name: string;
  purpose: string;
}

export interface AgentSessionV3PilotRealCorpusBatchSmokeIndexResult {
  entries: AgentSessionV3PilotRealCorpusBatchSmokeIndexEntry[];
  entryCount: number;
  groupCounts: Record<AgentSessionV3PilotRealCorpusBatchSmokeIndexGroup, number>;
  guardrail: string;
  kind: 'agent-session-v3-pilot-real-corpus-batch-smoke-index';
  missingCount: number;
  missingNames: string[];
  reportText: string;
  scriptsDir: string;
  summaryText: string;
  unindexedCount: number;
  unindexedNames: string[];
  version: 1;
}

export interface CreateAgentSessionV3PilotRealCorpusBatchSmokeIndexOptions {
  projectRoot?: string;
}

const EXPECTED_SMOKE_INDEX_ENTRIES: AgentSessionV3PilotRealCorpusBatchSmokeIndexEntry[] = [
  {
    boundary: 'template files only; no sample discovery',
    group: 'intake-template',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-template-smoke.ts',
    purpose: 'starter manifest, index, sample note, and README generation',
  },
  {
    boundary: 'CLI invocation only; no runtime authority',
    group: 'intake-template',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-template-cli-smoke.ts',
    purpose: 'intake template command-line entry',
  },
  {
    boundary: 'synthetic intake rehearsal only',
    group: 'intake-template',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-dry-run-smoke.ts',
    purpose: 'template dry-run with synthetic ready and mismatch corpus files',
  },
  {
    boundary: 'README and validator pre-sample checks only',
    group: 'intake-template',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-self-check-smoke.ts',
    purpose: 'generated intake README plus missing and empty validator checks',
  },
  {
    boundary: 'starter intake blocked contract only; no real evidence or runtime authority',
    group: 'intake-template',
    name: 'agent-session-v3-pilot-real-corpus-batch-starter-intake-blocked-smoke.ts',
    purpose: 'generated starter intake stays not-ready, blocked, open-fields, and runbook-blocked until caller fills real evidence',
  },
  {
    boundary: 'starter-to-filled evidence delta only; no runtime action order',
    group: 'intake-template',
    name: 'agent-session-v3-pilot-real-corpus-batch-starter-to-filled-delta-smoke.ts',
    purpose: 'starter placeholder intake and filled ready intake report different evidence states without treating the transition as a workflow',
  },
  {
    boundary: 'note completeness metadata only',
    group: 'sample-note',
    name: 'agent-session-v3-pilot-real-corpus-batch-sample-note-report-smoke.ts',
    purpose: 'missing, open, and complete sample-note report states',
  },
  {
    boundary: 'caller-declared source metadata preflight only',
    group: 'preflight',
    name: 'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight-smoke.ts',
    purpose: 'placeholder, consistent, unknown, status-mismatch, and handoff-mismatch source declaration states',
  },
  {
    boundary: 'machine-readable source declaration contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight-cli-json-contract-smoke.ts',
    purpose: 'source declaration preflight CLI JSON contract',
  },
  {
    boundary: 'schema evidence only',
    group: 'preflight',
    name: 'agent-session-v3-pilot-real-corpus-batch-schema-shape-report-smoke.ts',
    purpose: 'manifest and batch-index shape validation',
  },
  {
    boundary: 'schema CLI report only',
    group: 'preflight',
    name: 'agent-session-v3-pilot-real-corpus-batch-schema-shape-report-cli-smoke.ts',
    purpose: 'schema-shape command-line report output',
  },
  {
    boundary: 'path evidence only',
    group: 'preflight',
    name: 'agent-session-v3-pilot-real-corpus-batch-path-health-report-smoke.ts',
    purpose: 'required and referenced path validation',
  },
  {
    boundary: 'path CLI report only',
    group: 'preflight',
    name: 'agent-session-v3-pilot-real-corpus-batch-path-health-report-cli-smoke.ts',
    purpose: 'path-health command-line report output',
  },
  {
    boundary: 'manifest/index relationship evidence only',
    group: 'preflight',
    name: 'agent-session-v3-pilot-real-corpus-batch-consistency-report-smoke.ts',
    purpose: 'baseline/current manifest-index consistency validation',
  },
  {
    boundary: 'consistency CLI report only',
    group: 'preflight',
    name: 'agent-session-v3-pilot-real-corpus-batch-consistency-report-cli-smoke.ts',
    purpose: 'consistency command-line report output',
  },
  {
    boundary: 'machine-readable preflight contracts only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-preflight-reports-cli-json-contract-smoke.ts',
    purpose: 'schema-shape, path-health, and consistency CLI JSON contracts',
  },
  {
    boundary: 'validator report only',
    group: 'intake-validator',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-validator-smoke.ts',
    purpose: 'missing-file and mixed-intake validator outputs',
  },
  {
    boundary: 'validator CLI report only',
    group: 'intake-validator',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-validator-cli-smoke.ts',
    purpose: 'missing and mixed validator command-line reports',
  },
  {
    boundary: 'machine-readable validator contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-validator-cli-json-contract-smoke.ts',
    purpose: 'intake validator CLI JSON contract',
  },
  {
    boundary: 'summary over validator evidence only',
    group: 'evidence-summary',
    name: 'agent-session-v3-pilot-real-corpus-batch-evidence-summary-smoke.ts',
    purpose: 'blocked, review-needed, and ready evidence summaries',
  },
  {
    boundary: 'summary CLI report only',
    group: 'evidence-summary',
    name: 'agent-session-v3-pilot-real-corpus-batch-evidence-summary-cli-smoke.ts',
    purpose: 'evidence summary command-line report output',
  },
  {
    boundary: 'machine-readable evidence summary contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-evidence-summary-cli-json-contract-smoke.ts',
    purpose: 'evidence summary CLI JSON contract',
  },
  {
    boundary: 'metadata quality evidence only',
    group: 'metadata-quality',
    name: 'agent-session-v3-pilot-real-corpus-batch-metadata-quality-report-smoke.ts',
    purpose: 'placeholder, open-note, and complete metadata quality reports',
  },
  {
    boundary: 'machine-readable metadata contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-metadata-quality-cli-json-contract-smoke.ts',
    purpose: 'metadata quality CLI JSON contract',
  },
  {
    boundary: 'operator checklist report only',
    group: 'operator-checklist',
    name: 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-report-smoke.ts',
    purpose: 'blocked, review-needed, and ready checklist outputs',
  },
  {
    boundary: 'operator checklist CLI report only',
    group: 'operator-checklist',
    name: 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-cli-smoke.ts',
    purpose: 'operator checklist command-line report output',
  },
  {
    boundary: 'machine-readable checklist contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-operator-checklist-cli-json-contract-smoke.ts',
    purpose: 'operator checklist CLI JSON contract',
  },
  {
    boundary: 'multi-intake rollup report only',
    group: 'readiness-rollup',
    name: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-report-smoke.ts',
    purpose: 'blocked, review-needed, and ready multi-intake rollups',
  },
  {
    boundary: 'rollup CLI report only',
    group: 'readiness-rollup',
    name: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-cli-smoke.ts',
    purpose: 'readiness rollup command-line report output',
  },
  {
    boundary: 'machine-readable rollup contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-cli-json-contract-smoke.ts',
    purpose: 'readiness rollup CLI JSON contract',
  },
  {
    boundary: 'synthetic example generation only',
    group: 'readiness-rollup',
    name: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example-smoke.ts',
    purpose: 'missing, mixed, and ready example intake layout',
  },
  {
    boundary: 'machine-readable example contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example-cli-json-contract-smoke.ts',
    purpose: 'readiness rollup example CLI JSON contract',
  },
  {
    boundary: 'manual reading order rehearsal only',
    group: 'readiness-rollup',
    name: 'agent-session-v3-pilot-real-corpus-batch-review-order-rehearsal-smoke.ts',
    purpose: 'summary-first, rollup-second, checklist drill-down reading order',
  },
  {
    boundary: 'filled sample-note rehearsal only',
    group: 'readiness-rollup',
    name: 'agent-session-v3-pilot-real-corpus-batch-filled-sample-rehearsal-smoke.ts',
    purpose: 'filled source declaration, validator, checklist, and review-summary compatibility',
  },
  {
    boundary: 'one-page review summary only',
    group: 'review-summary',
    name: 'agent-session-v3-pilot-real-corpus-batch-review-summary-smoke.ts',
    purpose: 'compact batch review summary over rollup evidence',
  },
  {
    boundary: 'machine-readable review summary contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-review-summary-cli-json-contract-smoke.ts',
    purpose: 'review summary CLI JSON contract',
  },
  {
    boundary: 'handoff packaging only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle-smoke.ts',
    purpose: 'handoff bundle artifact output and sample-source declaration',
  },
  {
    boundary: 'machine-readable handoff bundle contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle-cli-json-contract-smoke.ts',
    purpose: 'handoff bundle CLI JSON contract',
  },
  {
    boundary: 'handoff artifact consistency rehearsal only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-bundle-e2e-rehearsal-smoke.ts',
    purpose: 'generated example through handoff bundle artifacts',
  },
  {
    boundary: 'handoff artifact integrity report only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-report-smoke.ts',
    purpose: 'valid, missing artifact, and kind-mismatch handoff packages',
  },
  {
    boundary: 'handoff optional evidence continuity rehearsal only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-optional-evidence-continuity-smoke.ts',
    purpose: 'review summary optional evidence path through bundle, artifact integrity, and reviewer packet',
  },
  {
    boundary: 'handoff phase-coverage consistency audit only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit-smoke.ts',
    purpose: 'phase-coverage observation consistency across bundle, artifact integrity, reviewer packet, optional source preflight rollup, and pure entry issue builder mismatches',
  },
  {
    boundary: 'machine-readable handoff phase-coverage consistency contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-phase-coverage-consistency-audit-cli-json-contract-smoke.ts',
    purpose: 'handoff phase-coverage consistency audit CLI JSON contract',
  },
  {
    boundary: 'machine-readable artifact integrity contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-artifact-integrity-cli-json-contract-smoke.ts',
    purpose: 'handoff artifact integrity CLI JSON contract',
  },
  {
    boundary: 'sample-source declaration report only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-report-smoke.ts',
    purpose: 'consistent, unknown, and mismatched handoff sample-source declarations',
  },
  {
    boundary: 'handoff source preflight integration rehearsal only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-integration-smoke.ts',
    purpose: 'filled source declaration through source preflight, handoff bundle, consistency report, and reviewer packet',
  },
  {
    boundary: 'handoff source preflight degraded rehearsal only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-degraded-rehearsal-smoke.ts',
    purpose: 'mismatched and unknown handoff source declarations through source preflight and reviewer packet evidence',
  },
  {
    boundary: 'handoff source preflight rollup report only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup-smoke.ts',
    purpose: 'multi-case handoff source declaration rollup over source preflight and reviewer packet evidence',
  },
  {
    boundary: 'handoff source preflight rollup degraded CLI rehearsal only',
    group: 'handoff',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup-degraded-cli-rehearsal-smoke.ts',
    purpose: 'multi-case CLI handoff source declaration rollup over consistent, mismatched, and unknown declarations',
  },
  {
    boundary: 'machine-readable handoff source preflight rollup contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-source-preflight-rollup-cli-json-contract-smoke.ts',
    purpose: 'handoff source preflight rollup CLI JSON contract',
  },
  {
    boundary: 'machine-readable sample-source contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-sample-source-consistency-cli-json-contract-smoke.ts',
    purpose: 'handoff sample-source consistency CLI JSON contract',
  },
  {
    boundary: 'reviewer packet summary only',
    group: 'reviewer-packet',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary-smoke.ts',
    purpose: 'ready, review-needed, unknown-source, and blocked reviewer packet states',
  },
  {
    boundary: 'machine-readable reviewer packet contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-summary-cli-json-contract-smoke.ts',
    purpose: 'handoff reviewer packet summary CLI JSON contract',
  },
  {
    boundary: 'reviewer packet happy/review-needed rehearsal only',
    group: 'reviewer-packet',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-e2e-rehearsal-smoke.ts',
    purpose: 'generated example through reviewer packet summary',
  },
  {
    boundary: 'reviewer packet degraded rehearsal only',
    group: 'reviewer-packet',
    name: 'agent-session-v3-pilot-real-corpus-batch-handoff-reviewer-packet-degraded-e2e-rehearsal-smoke.ts',
    purpose: 'missing artifact, sample-source mismatch, and invalid JSON packet blockers',
  },
  {
    boundary: 'runbook text self-check only',
    group: 'runbook',
    name: 'agent-session-v3-pilot-real-corpus-batch-runbook-self-check-smoke.ts',
    purpose: 'manual runbook command order, status meanings, and authority guardrails',
  },
  {
    boundary: 'runbook completion report only; explicit caller-owned intake dirs only',
    group: 'runbook-completion',
    name: 'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report-smoke.ts',
    purpose: 'manual runbook completion criteria over caller-provided real corpus batch intake directories',
  },
  {
    boundary: 'machine-readable runbook completion contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-runbook-completion-report-cli-json-contract-smoke.ts',
    purpose: 'real corpus batch runbook completion report CLI JSON contract',
  },
  {
    boundary: 'smoke coverage index only',
    group: 'coverage-index',
    name: 'agent-session-v3-pilot-real-corpus-batch-smoke-index-smoke.ts',
    purpose: 'all real corpus batch smoke files are listed in the coverage index',
  },
  {
    boundary: 'readiness snapshot consistency smoke only; no runtime authority',
    group: 'coverage-index',
    name: 'agent-session-v3-pilot-real-corpus-batch-readiness-snapshot-consistency-smoke.ts',
    purpose: 'current readiness checklist snapshot matches report outputs',
  },
  {
    boundary: 'next-step consistency smoke only; no runtime authority',
    group: 'coverage-index',
    name: 'agent-session-v3-pilot-real-corpus-batch-next-step-consistency-smoke.ts',
    purpose: 'status current-estimate, runbook, readiness, and package next-step consistency',
  },
  {
    boundary: 'real corpus batch closeout audit report only',
    group: 'coverage-index',
    name: 'agent-session-v3-pilot-real-corpus-batch-closeout-audit-smoke.ts',
    purpose: 'smoke index, docs, dashboard, and CLI JSON audit closeout consistency',
  },
  {
    boundary: 'machine-readable closeout audit contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-closeout-audit-cli-json-contract-smoke.ts',
    purpose: 'real corpus batch closeout audit CLI JSON contract',
  },
  {
    boundary: 'evidence package index report only',
    group: 'evidence-package',
    name: 'agent-session-v3-pilot-real-corpus-batch-evidence-package-index-smoke.ts',
    purpose: 'current real corpus batch evidence package entry catalog',
  },
  {
    boundary: 'machine-readable evidence package index contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-evidence-package-index-cli-json-contract-smoke.ts',
    purpose: 'real corpus batch evidence package index CLI JSON contract',
  },
  {
    boundary: 'package health rollup report only',
    group: 'package-health',
    name: 'agent-session-v3-pilot-real-corpus-batch-package-health-rollup-smoke.ts',
    purpose: 'evidence package, closeout, and missing-evidence health summary',
  },
  {
    boundary: 'machine-readable package health rollup contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-package-health-rollup-cli-json-contract-smoke.ts',
    purpose: 'real corpus batch package health rollup CLI JSON contract',
  },
  {
    boundary: 'next evidence target report only; no collection or runtime action order',
    group: 'next-evidence-target',
    name: 'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report-smoke.ts',
    purpose: 'prioritized next manual evidence target report over package health and missing evidence',
  },
  {
    boundary: 'machine-readable next evidence target contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report-cli-json-contract-smoke.ts',
    purpose: 'real corpus batch next evidence target report CLI JSON contract',
  },
  {
    boundary: 'P0 intake target status report only; explicit caller-owned intake dirs only',
    group: 'p0-intake-target-status',
    name: 'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report-smoke.ts',
    purpose: 'P0 manual evidence target status over caller-provided real corpus batch intake directories',
  },
  {
    boundary: 'P0 linkage degraded report rehearsal only',
    group: 'p0-intake-target-status',
    name: 'agent-session-v3-pilot-real-corpus-batch-p0-linkage-degraded-smoke.ts',
    purpose: 'evidence package and package health degrade when P0 status runbook/readiness linkage is missing',
  },
  {
    boundary: 'machine-readable P0 intake target status contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report-cli-json-contract-smoke.ts',
    purpose: 'real corpus batch P0 intake target status report CLI JSON contract',
  },
  {
    boundary: 'P0 real evidence closeout report only; explicit caller-owned intake dirs only',
    group: 'p0-real-evidence-closeout',
    name: 'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report-smoke.ts',
    purpose: 'P0 real evidence closeout over package health, next target, explicit P0 intake status, and readiness rollup',
  },
  {
    boundary: 'artifact rehearsal closeout smoke only; no required runtime workflow',
    group: 'p0-real-evidence-closeout',
    name: 'agent-session-v3-pilot-real-corpus-batch-artifact-rehearsal-closeout-smoke.ts',
    purpose: 'ready intake through P0 closeout, review summary, readiness rollup, checklist, handoff bundle, and reviewer packet contract continuity',
  },
  {
    boundary: 'machine-readable P0 real evidence closeout contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report-cli-json-contract-smoke.ts',
    purpose: 'real corpus batch P0 real evidence closeout report CLI JSON contract',
  },
  {
    boundary: 'status dashboard report only',
    group: 'status-dashboard',
    name: 'agent-session-v3-pilot-real-corpus-batch-status-dashboard-report-smoke.ts',
    purpose: 'real corpus batch coverage and real-sample gap dashboard',
  },
  {
    boundary: 'status dashboard checklist marker coverage only',
    group: 'status-dashboard',
    name: 'agent-session-v3-pilot-real-corpus-batch-status-dashboard-gap-marker-coverage-smoke.ts',
    purpose: 'explicit readiness checklist gap marker coverage',
  },
  {
    boundary: 'machine-readable status dashboard contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-status-dashboard-cli-json-contract-smoke.ts',
    purpose: 'status dashboard CLI JSON contract',
  },
  {
    boundary: 'manual gap action checklist report only',
    group: 'gap-action-checklist',
    name: 'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist-smoke.ts',
    purpose: 'prioritized manual checklist over status dashboard real-sample gaps',
  },
  {
    boundary: 'machine-readable gap action checklist contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-gap-action-checklist-cli-json-contract-smoke.ts',
    purpose: 'gap action checklist CLI JSON contract',
  },
  {
    boundary: 'missing evidence rollup report only',
    group: 'missing-evidence-rollup',
    name: 'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup-smoke.ts',
    purpose: 'dashboard gap, marker-source, and manual priority missing evidence rollup',
  },
  {
    boundary: 'machine-readable missing evidence rollup contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-missing-evidence-rollup-cli-json-contract-smoke.ts',
    purpose: 'missing evidence rollup CLI JSON contract',
  },
  {
    boundary: 'final manual gap report only; no runtime action order',
    group: 'final-gap-report',
    name: 'agent-session-v3-pilot-real-corpus-batch-final-gap-report-smoke.ts',
    purpose: 'final P0/P1/P2 manual real evidence gap report over missing-evidence rollup',
  },
  {
    boundary: 'machine-readable final gap report contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-final-gap-report-cli-json-contract-smoke.ts',
    purpose: 'final gap report CLI JSON contract',
  },
  {
    boundary: 'intake filling support report only; no intake creation, auto-fill, or runtime action order',
    group: 'intake-filling-support',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report-smoke.ts',
    purpose: 'manual intake field filling support over final gap report evidence',
  },
  {
    boundary: 'machine-readable intake filling support contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report-cli-json-contract-smoke.ts',
    purpose: 'intake filling support report CLI JSON contract',
  },
  {
    boundary: 'intake field completeness audit only; explicit caller-owned intake dirs only',
    group: 'intake-field-completeness',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit-smoke.ts',
    purpose: 'manual sample-note, manifest, and index field completeness audit over caller-provided intake directories',
  },
  {
    boundary: 'machine-readable intake field completeness audit contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit-cli-json-contract-smoke.ts',
    purpose: 'intake field completeness audit CLI JSON contract',
  },
  {
    boundary: 'intake readiness gate report only; explicit caller-owned intake dirs only',
    group: 'intake-readiness-gate',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report-smoke.ts',
    purpose: 'manual intake readiness gate over validator, field completeness, P0 target, and runbook evidence',
  },
  {
    boundary: 'machine-readable intake readiness gate contract only',
    group: 'cli-contract',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report-cli-json-contract-smoke.ts',
    purpose: 'intake readiness gate CLI JSON contract',
  },
  {
    boundary: 'intake field requirements consistency smoke only; no runtime authority',
    group: 'intake-field-completeness',
    name: 'agent-session-v3-pilot-real-corpus-batch-intake-field-requirements-consistency-smoke.ts',
    purpose: 'filling support, field completeness audit, intake template, and runbook field requirements consistency',
  },
];

function getGroupCounts(entries: readonly AgentSessionV3PilotRealCorpusBatchSmokeIndexEntry[]) {
  const groupCounts = Object.fromEntries([
    'cli-contract',
    'coverage-index',
    'evidence-package',
    'evidence-summary',
    'final-gap-report',
    'gap-action-checklist',
    'handoff',
    'intake-field-completeness',
    'intake-filling-support',
    'intake-readiness-gate',
    'intake-template',
    'intake-validator',
    'metadata-quality',
    'missing-evidence-rollup',
    'next-evidence-target',
    'operator-checklist',
    'p0-intake-target-status',
    'p0-real-evidence-closeout',
    'package-health',
    'preflight',
    'readiness-rollup',
    'review-summary',
    'reviewer-packet',
    'runbook',
    'runbook-completion',
    'sample-note',
    'status-dashboard',
  ].map((group) => [group, 0])) as Record<AgentSessionV3PilotRealCorpusBatchSmokeIndexGroup, number>;

  for (const entry of entries) {
    groupCounts[entry.group] += 1;
  }

  return groupCounts;
}

function getActualRealCorpusBatchSmokeNames(scriptsDir: string) {
  return readdirSync(scriptsDir)
    .filter((name) => name.startsWith('agent-session-v3-pilot-real-corpus-batch-'))
    .filter((name) => name.endsWith('-smoke.ts'))
    .sort();
}

function createSummaryText(result: Pick<AgentSessionV3PilotRealCorpusBatchSmokeIndexResult, 'entryCount' | 'missingCount' | 'unindexedCount'>) {
  return [
    'AgentSessionV3PilotRealCorpusBatchSmokeIndex',
    `entries=${result.entryCount}`,
    `missing=${result.missingCount}`,
    `unindexed=${result.unindexedCount}`,
  ].join(' ');
}

function createReportText(
  result: Pick<
    AgentSessionV3PilotRealCorpusBatchSmokeIndexResult,
    | 'entries'
    | 'groupCounts'
    | 'guardrail'
    | 'missingNames'
    | 'scriptsDir'
    | 'summaryText'
    | 'unindexedNames'
  >,
) {
  return [
    result.summaryText,
    `scriptsDir: ${result.scriptsDir}`,
    'smokeGroups:',
    ...Object.entries(result.groupCounts).map(([group, count]) => `- group=${group} count=${count}`),
    result.missingNames.length ? 'missingSmokes:' : 'missingSmokes: none',
    ...result.missingNames.map((name) => `- ${name}`),
    result.unindexedNames.length ? 'unindexedSmokes:' : 'unindexedSmokes: none',
    ...result.unindexedNames.map((name) => `- ${name}`),
    'indexedSmokes:',
    ...result.entries.map((entry) => [
      `- group=${entry.group}`,
      `name=${entry.name}`,
      `purpose=${entry.purpose}`,
      `boundary=${entry.boundary}`,
    ].join(' ')),
    `guardrail=${result.guardrail}`,
  ].join('\n');
}

export function createAgentSessionV3PilotRealCorpusBatchSmokeIndex(
  options: CreateAgentSessionV3PilotRealCorpusBatchSmokeIndexOptions = {},
): AgentSessionV3PilotRealCorpusBatchSmokeIndexResult {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const scriptsDir = path.join(projectRoot, 'scripts');
  const actualNames = getActualRealCorpusBatchSmokeNames(scriptsDir);
  const indexedNames = EXPECTED_SMOKE_INDEX_ENTRIES.map((entry) => entry.name).sort();
  const actualNameSet = new Set(actualNames);
  const indexedNameSet = new Set(indexedNames);
  const missingNames = indexedNames.filter((name) => !actualNameSet.has(name));
  const unindexedNames = actualNames.filter((name) => !indexedNameSet.has(name));
  const groupCounts = getGroupCounts(EXPECTED_SMOKE_INDEX_ENTRIES);
  const resultWithoutText: AgentSessionV3PilotRealCorpusBatchSmokeIndexResult = {
    entries: [...EXPECTED_SMOKE_INDEX_ENTRIES].sort((left, right) => left.name.localeCompare(right.name)),
    entryCount: EXPECTED_SMOKE_INDEX_ENTRIES.length,
    groupCounts,
    guardrail: 'caller-owned smoke coverage index only; does not run smoke tests, collect samples, choose thresholds, route permissions, execute tools, decide recovery, define workflows, or grant runtime authority.',
    kind: 'agent-session-v3-pilot-real-corpus-batch-smoke-index',
    missingCount: missingNames.length,
    missingNames,
    reportText: '',
    scriptsDir,
    summaryText: '',
    unindexedCount: unindexedNames.length,
    unindexedNames,
    version: 1,
  };
  const summaryText = createSummaryText(resultWithoutText);

  return {
    ...resultWithoutText,
    reportText: createReportText({
      ...resultWithoutText,
      summaryText,
    }),
    summaryText,
  };
}

function runAgentSessionV3PilotRealCorpusBatchSmokeIndexCli() {
  const result = createAgentSessionV3PilotRealCorpusBatchSmokeIndex();
  console.log(result.reportText);

  if (result.missingCount > 0 || result.unindexedCount > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAgentSessionV3PilotRealCorpusBatchSmokeIndexCli();
}
