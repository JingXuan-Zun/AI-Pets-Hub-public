export type SettingsSkillMcpProgressArea =
  | 'mcp-foundation'
  | 'mcp-safety'
  | 'role-skill-performance'
  | 'skill-foundation';

export interface SettingsSkillMcpProgressItem {
  area: SettingsSkillMcpProgressArea;
  blocker: string;
  evidence: string;
  estimateLabel: string;
  nextStep: string;
  status: 'near-complete' | 'partial';
  title: string;
}

export interface SettingsSkillMcpProgressEvidence {
  exportedAt: string;
  items: SettingsSkillMcpProgressItem[];
  kind: 'settings-skill-mcp-progress-evidence';
  version: 1;
}

export interface SettingsSkillMcpProgressImportedEvidence extends SettingsSkillMcpProgressEvidence {
  inputPath: string;
}

export interface SettingsSkillMcpProgressImportedSummary {
  currentMatch: boolean;
  detail: string;
  exportedAt: string;
  inputPath: string;
  itemCount: number;
  mismatchCount: number;
  statusText: string;
}

const VALID_PROGRESS_AREAS: SettingsSkillMcpProgressArea[] = [
  'mcp-foundation',
  'mcp-safety',
  'role-skill-performance',
  'skill-foundation',
];
const VALID_PROGRESS_STATUSES: SettingsSkillMcpProgressItem['status'][] = ['near-complete', 'partial'];

export const SETTINGS_SKILL_MCP_PROGRESS_ITEMS: SettingsSkillMcpProgressItem[] = [
  {
    area: 'skill-foundation',
    blocker: 'Signed WASM execution, bounded JSON capability flow, persistent receipts and rate limits, package-attributed crash quarantine, exportable diagnostics, static and real packaged admission, restore/uninstall controls with bounded snapshot cleanup, SPKI SHA-256 signing-key continuity, root-signed publisher-catalog provisioning, bounded host-owned HTTPS catalog delivery, sanitized production-readiness auditing, validated fresh-build production config injection, retained 10/10 packaged production evidence, controlled two-entry ZIP archive install/version policy with marketplace-only provenance checks, mandatory host-owned marketplace publisher identity assessment, explicit dual-signature key migration, a reviewed real Publisher lifecycle, an unpublished sequence 2 Catalog candidate, and local signed-package Settings installation exist. Offline root-key backup, Catalog renewal operations, remote Catalog browsing/download, broader resource quotas, multi-file asset archives, migration scripts, and marketplace-grade distribution remain incomplete.',
    evidence: 'Signed host artifact staging with main-process Ed25519 evidence, digest-verified artifact reads, ephemeral supervisor processes, import-free wasm-pure-i32-v1 and bounded wasm-pure-json-v1 execution, persistent grants with a 200-entry redacted receipt history and 20-call/60-second storage.read limits, digest-bound health with 1s/2s backoff and automatic quarantine after three consecutive package-attributed failures, redacted package-health JSON export and redacted health and lifecycle receipt JSON exports, a static WASM admission matrix, and a 7/7 real packaged-process admission probe retained as external-skill-packaged-admission-report.json exist. Quarantine restore requires fresh Ed25519 staging; uninstall stores an immutable rollback snapshot, clears health/grants, and has a Settings rollback control. Host cleanup keeps at most five uninstall snapshots per package for 30 days, protects the active uninstall snapshot, skips malformed metadata, and removes only artifacts proven unreferenced by the current index plus update and uninstall snapshots. Signed replacement requires both the existing keyId and matching SPKI DER SHA-256 public-key fingerprint and, when declared, the same signed publisher.id. Explicit old-key/new-key dual-signature migration uses a canonical security.keyMigration payload signed by both keys, requires stable publisher identity and both pinned SPKI fingerprints, and persists main-process-ed25519-dual-signature evidence. Rejected key changes do not mutate the artifact or trusted-key registry, and rejected migration proofs leave both unchanged. Publisher assessment now verifies a root-signed catalog on every read and rejects forged, future, expired, replayed, revoked-root, below-minimum, or mismatched catalogs; valid same-sequence archives can recover active-file damage. A read-only Settings audit reports sanitized root, HTTPS delivery, and active-catalog readiness as not-configured, invalid, incomplete, or ready-disabled and exports no PEM, local path, or full catalog URL. Production config validation accepts only canonical Ed25519 SPKI public-key PEM plus enabled HTTPS delivery config, rejects private-key PEM, injects fixed resources only through the named complete fresh production build, and blocks ordinary fresh or incremental production-trust updates even when incremental baseline force is requested. Controlled ZIP staging persists host-verified archive provenance bound to the active artifact and signed distribution. The first reviewed Publisher passed local install, update, downgrade rejection, dual-signature migration, uninstall, and rollback; a root-signed sequence 2 Catalog candidate admits it without publication. Settings can import trusted Publisher public keys, install a bounded local archive through main-process verification, synchronize the verified package, and leaves runtime disabled. Uninstall rollback preserves archive provenance; direct signed JSON staging clears it and fails only the separate marketplace provenance check. The bundled root registry is empty and no renderer Catalog refresh, network install, or trust-mutation IPC exists. Market release remains explicitly disabled.',
    estimateLabel: '99.99%',
    nextStep: 'Preserve the unpublished Publisher/Catalog evidence and local install UI, establish sequence-increasing Catalog renewal before expiry, and complete ordinary-user MCP setup, compatibility, and schema-aware permissions before any remote market or higher-risk capability work.',
    status: 'partial',
    title: 'Skill foundation',
  },
  {
    area: 'role-skill-performance',
    blocker: 'Rich full-track authoring, multi-character orchestration, and deeper audio-sync tooling are still incomplete.',
    evidence: 'Character animation routing, timeline scheduling, audio sync, expression cues, editor controls, and Unity/3D/Live2D contract smokes exist.',
    estimateLabel: '99%',
    nextStep: 'Continue role-skill timeline authoring only in small editor slices with smoke coverage.',
    status: 'partial',
    title: 'Role Skill performance',
  },
  {
    area: 'mcp-foundation',
    blocker: 'Official packaged read-only coverage, the bound 31-minute production lifecycle run, ordinary-user no-spawn host checks, the local real-process compatibility matrix, and a first isolated third-party reference family are closed. Packaged hostile-environment reproduction and real Schema-shape diversity remain open.',
    evidence: 'Facade, stdio runtime, config UI, lifecycle/history, readiness/runbook/closure visibility, Windows .cmd/.bat stdio spawn support, real filesystem and memory MCP saved config, development and packaged-main harness soak evidence, risk/policy consistency evidence, lifecycle hardening evidence, and packaged-production review gates exist. The real AI Desktop Pet.exe now has 2/2 official packaged server coverage at tmp/mcp-packaged-diagnosis-20260726-cli-20r/packaged-read-only-call-report.json: filesystem and memory produced 40/40 tools/list successes plus 40/40 read-only list_directory/read_graph call successes with zero failures, skips, or error samples. The bound fresh-package report at tmp/mcp-packaged-production-run/mcp-packaged-production-1785341969341/report.json records one 30.34-minute packaged session with 20 rounds per server, 40/40 list successes, 40/40 approved read-only call successes, zero failures, skips, restarts, tool-count drift, unexpected calls, writes, high-risk calls, or unexpected exits, and one controlled close. Runtime log and call report share a non-empty run ID and verified SHA-256 provenance. Before save, Settings can check command/PATH availability, cwd, Windows command scripts, paths with spaces, hidden environment-value completeness, and npx online/offline-cache requirements without spawning a process or accessing the network. Saved-server diagnostics classify missing runtimes/commands, package availability, permission denial, startup timeout, server crash, and protocol/startup failures into bounded ordinary-user summaries and next actions. The local real-process report at tmp/mcp-compatibility-matrix-20260729/report.json passes 8/8 for no Node, package unavailability, permission denial, startup timeout, crash, crash recovery, and paths with spaces; stderr credential-like values are redacted before renderer exposure. An isolated, version-pinned official server-everything audit adds a third real package family without changing saved user config or calling tools. MCP child processes preserve runtime PATH/cache/proxy variables but no longer inherit DESKTOP_PET values, common host secrets, NODE_OPTIONS, or NODE_PATH unless explicitly declared in that server env.',
    estimateLabel: '99.9%',
    nextStep: 'Add packaged hostile-environment lifecycle evidence without changing saved user config; retain a separate search for a real draft 2019/2020, composition, or reference-heavy server package.',
    status: 'near-complete',
    title: 'MCP foundation',
  },
  {
    area: 'mcp-safety',
    blocker: 'Remaining work is real draft 2019/2020, composition/reference Schema evidence, packaged hostile-environment lifecycle evidence, and polish. The 9 observed object or nested-array structures remain whole-field-only; wildcard and contextual field grants are not implemented.',
    evidence: 'Approval gates, risk summaries, risk/policy preset/decision consistency evidence, lifecycle hardening evidence, receipts, cancellation, policy presets, history retention, diagnostics, and pooled-session visibility exist. Schema signals include enum/required/examples plus standard MCP read-only/destructive/open-world annotations, and an end-to-end smoke proves the high-risk preset denies a matching call before the external server. The Electron main-process gate requires a discovered tool schema and bounded local JSON Schema draft 7/2019/2020 validation before invocation, with 64 KiB UTF-8 renderer input, bounded argument depth/nodes/array/properties, bounded UTF-8 schema size/depth/nodes/cache/errors, remote-reference rejection, pattern guards, and redacted validation errors. Per-tool exact JSON Pointer field rules support deny-on-presence, scalar deny/allow lists, and bounded homogeneous scalar-array deny-items/allow-items lists. Array policies cap input at 1024 dense scalar items, reject non-array/sparse/object/nested input, omit values from denial receipts, and run before MCP process startup. Settings exposes array-value modes only when every resolved homogeneous items branch is scalar; fixed tuple indices use ordinary exact-pointer rules. A process-backed local draft 7/2019/2020 matrix proves invalid inputs never reach tools/call. The read-only report at tmp/mcp-real-schema-compatibility-20260729-three-server/report.json covers filesystem, memory, and the fixed-version official reference server with 3/3 servers, 36/36 supported schemas, 49 visible fields, 38 scalar-value-capable fields, 14 homogeneous-array structures, and 5 safely editable scalar-array fields without retaining raw schemas, commands, arguments, environment values, or local paths. All current real schemas remain draft 7 with no observed composition, reference, or tuple structures, so broader shape diversity remains open.',
    estimateLabel: '99.8%',
    nextStep: 'Add packaged hostile-environment lifecycle evidence; keep object/nested-array policy disabled and continue seeking a real non-draft-7 or composition/reference-heavy package.',
    status: 'near-complete',
    title: 'MCP safety/visibility',
  },
];

export function getSettingsSkillMcpProgressItems() {
  return SETTINGS_SKILL_MCP_PROGRESS_ITEMS;
}

function asRecord(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is missing or invalid.`);
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is missing or invalid.`);
  }

  return value;
}

function progressAreaValue(value: unknown) {
  if (VALID_PROGRESS_AREAS.includes(value as SettingsSkillMcpProgressArea)) {
    return value as SettingsSkillMcpProgressArea;
  }

  throw new Error('item.area is missing or invalid.');
}

function progressStatusValue(value: unknown) {
  if (VALID_PROGRESS_STATUSES.includes(value as SettingsSkillMcpProgressItem['status'])) {
    return value as SettingsSkillMcpProgressItem['status'];
  }

  throw new Error('item.status is missing or invalid.');
}

function normalizeProgressItem(value: unknown): SettingsSkillMcpProgressItem {
  const item = asRecord(value, 'progress item');
  return {
    area: progressAreaValue(item.area),
    blocker: requiredString(item.blocker, 'item.blocker'),
    evidence: requiredString(item.evidence, 'item.evidence'),
    estimateLabel: requiredString(item.estimateLabel, 'item.estimateLabel'),
    nextStep: requiredString(item.nextStep, 'item.nextStep'),
    status: progressStatusValue(item.status),
    title: requiredString(item.title, 'item.title'),
  };
}

export function createSettingsSkillMcpProgressEvidence(
  exportedAt = new Date().toISOString(),
): SettingsSkillMcpProgressEvidence {
  return {
    exportedAt,
    items: getSettingsSkillMcpProgressItems(),
    kind: 'settings-skill-mcp-progress-evidence',
    version: 1,
  };
}

export function createSettingsSkillMcpProgressEvidenceText(exportedAt?: string) {
  return `${JSON.stringify(createSettingsSkillMcpProgressEvidence(exportedAt), null, 2)}\n`;
}

export function parseSettingsSkillMcpProgressEvidenceText(text: string) {
  const parsed = asRecord(JSON.parse(text), 'Skill/MCP progress evidence');
  if (parsed.kind !== 'settings-skill-mcp-progress-evidence') {
    throw new Error('Input is not a Skill/MCP progress evidence export.');
  }
  if (parsed.version !== 1) {
    throw new Error('Skill/MCP progress evidence version is unsupported.');
  }
  if (!Array.isArray(parsed.items)) {
    throw new Error('Skill/MCP progress evidence items are missing or invalid.');
  }

  return {
    exportedAt: requiredString(parsed.exportedAt, 'exportedAt'),
    items: parsed.items.map(normalizeProgressItem),
    kind: 'settings-skill-mcp-progress-evidence' as const,
    version: 1 as const,
  };
}

export function parseSettingsSkillMcpProgressEvidenceImportText(
  text: string,
  inputPath: string,
): SettingsSkillMcpProgressImportedEvidence {
  return {
    ...parseSettingsSkillMcpProgressEvidenceText(text),
    inputPath,
  };
}

function createProgressItemSignature(item: SettingsSkillMcpProgressItem) {
  return [
    item.area,
    item.blocker,
    item.evidence,
    item.estimateLabel,
    item.nextStep,
    item.status,
    item.title,
  ].join('\n');
}

function createProgressFingerprint(items: SettingsSkillMcpProgressItem[]) {
  return items.map(createProgressItemSignature).sort().join('\n---\n');
}

function createProgressAreaMap(items: SettingsSkillMcpProgressItem[]) {
  return new Map(items.map((item) => [item.area, createProgressItemSignature(item)]));
}

function getMismatchedProgressAreas(
  importedItems: SettingsSkillMcpProgressItem[],
  currentItems: SettingsSkillMcpProgressItem[],
) {
  const importedByArea = createProgressAreaMap(importedItems);
  const currentByArea = createProgressAreaMap(currentItems);
  const areas = new Set([...importedByArea.keys(), ...currentByArea.keys()]);

  return [...areas]
    .filter((area) => importedByArea.get(area) !== currentByArea.get(area))
    .sort();
}

function createProgressStatusText(items: SettingsSkillMcpProgressItem[]) {
  const partialCount = items.filter((item) => item.status === 'partial').length;
  const nearCompleteCount = items.filter((item) => item.status === 'near-complete').length;
  return `${nearCompleteCount} near-complete / ${partialCount} partial`;
}

export function createSettingsSkillMcpProgressImportedSummary(
  imported: SettingsSkillMcpProgressImportedEvidence,
  currentItems = getSettingsSkillMcpProgressItems(),
): SettingsSkillMcpProgressImportedSummary {
  const currentMatch = createProgressFingerprint(imported.items) === createProgressFingerprint(currentItems);
  const mismatchedAreas = getMismatchedProgressAreas(imported.items, currentItems);
  const mismatchCount = currentMatch ? 0 : Math.max(1, mismatchedAreas.length);

  return {
    currentMatch,
    detail: currentMatch
      ? 'Imported progress evidence matches the current Skill/MCP progress model.'
      : `${mismatchCount} progress area(s) differ from the current Skill/MCP progress model.`,
    exportedAt: imported.exportedAt,
    inputPath: imported.inputPath,
    itemCount: imported.items.length,
    mismatchCount,
    statusText: createProgressStatusText(imported.items),
  };
}
