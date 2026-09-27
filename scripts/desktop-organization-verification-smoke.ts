import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { showcaseSource, desktopOrganizationToolsSource, sessionSource } = readProjectSources({
  showcaseSource: 'src/components/pet/useDesktopOrganizationShowcase.ts',
  desktopOrganizationToolsSource: 'src/agent/agentRuntimeDesktopOrganizationTools.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(
  showcaseSource,
  /export interface DesktopOrganizationShowcaseStartResult[\s\S]*ok\?: boolean;[\s\S]*verification\?: string \| null;/u,
  'desktop organization showcase result should expose structured ok and verification fields',
);

assert.match(
  showcaseSource,
  /function isDesktopIconMoveSummaryVerified\(/u,
  'desktop organization should derive success from post-move verification',
);

assert.match(
  showcaseSource,
  /function createDesktopIconMoveVerification\(/u,
  'desktop organization should format post-move verification evidence',
);

assert.match(
  showcaseSource,
  /function createDesktopIconMoveFollowUp\(/u,
  'desktop organization should provide a follow-up when post-check fails',
);

assert.match(
  showcaseSource,
  /ok: verified,[\s\S]*verification,/u,
  'desktop organization execution should return structured verification status',
);

assert.match(
  showcaseSource,
  /responseText: \[[\s\S]*确认无误后[\s\S]*\]\.join\('\\n'\),\s*ok: true,\s*started: false/u,
  'desktop organization preview success should return ok:true instead of leaving status ambiguous',
);

assert.doesNotMatch(
  showcaseSource,
  /REAL_ICON_MOVE_STAGGER_MS\s*=\s*180/u,
  'desktop icon execution should not add the old 180ms delay before every icon move',
);

assert.match(
  showcaseSource,
  /REAL_ICON_MOVE_BATCH_SIZE[\s\S]*REAL_ICON_MOVE_BATCH_PAUSE_MS/u,
  'desktop icon execution should use a small batch pause instead of per-icon staggering',
);

assert.match(
  showcaseSource,
  /batchPauseMs: REAL_ICON_MOVE_BATCH_PAUSE_MS,[\s\S]*batchSize: REAL_ICON_MOVE_BATCH_SIZE/u,
  'desktop organization start should pass the fast batch move cadence',
);

assert.match(
  desktopOrganizationToolsSource,
  /interface AgentRuntimeDesktopOrganizationResult[\s\S]*ok\?: boolean;[\s\S]*verification\?: string \| null;/u,
  'agent runtime should accept structured desktop organization verification',
);

assert.match(
  desktopOrganizationToolsSource,
  /interface AgentRuntimeDesktopIconPlacementResult[\s\S]*ok\?: boolean;[\s\S]*verification\?: string \| null;/u,
  'agent runtime should accept structured desktop icon placement verification',
);

assert.match(
  desktopOrganizationToolsSource,
  /const previewOk = result\.ok \?\? Boolean\(result\.plan\);[\s\S]*errorText: previewOk\s*\? null\s*: result\.errorText \?\? result\.responseText/u,
  'agent runtime should normalize a preview with a plan as a successful planning step',
);

assert.match(
  desktopOrganizationToolsSource,
  /ok: previewOk/u,
  'agent runtime should pass the normalized desktop preview ok state through to Agent assessment',
);

assert.match(
  desktopOrganizationToolsSource,
  /verification: result\.verification/u,
  'agent runtime should pass desktop verification text through to Agent assessment',
);

assert.match(
  sessionSource,
  /If the preview succeeds and the user did not ask for preview-only\/plan-only, continue to organize_desktop_icons with mode "execute"/u,
  'AgentSessionV2 should treat desktop organization preview as preflight, not completion.',
);

assert.match(
  sessionSource,
  /function shouldRejectAgentSessionV2PrematureDesktopOrganizationFinal/u,
  'AgentSessionV2 should reject final answers that claim desktop organization after preview-only evidence.',
);

assert.match(
  sessionSource,
  /hasAgentSessionV2DesktopOrganizationPreview\(options\.toolResults\)[\s\S]*!hasAgentSessionV2DesktopOrganizationExecuteAttempt/u,
  'desktop organization final rejection should require an execute attempt after preview.',
);

console.log('desktop organization verification smoke ok');
