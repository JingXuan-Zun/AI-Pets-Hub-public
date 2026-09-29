import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  controller: controllerSource,
  desktopOrganizationTools: desktopOrganizationToolsSource,
} = readProjectSources({
  controller: 'src/components/chat/agentRunController.ts',
  desktopOrganizationTools: 'src/agent/agentRuntimeDesktopOrganizationTools.ts',
});

assert.match(
  desktopOrganizationToolsSource,
  /function createDesktopOrganizationExecutionReceipt\([\s\S]*!options\.started[\s\S]*\? 'failed'[\s\S]*options\.ok === false[\s\S]*\? 'unverified'[\s\S]*: 'success'/u,
  'desktop organization execution should distinguish tool startup failure from post-check verification failure',
);

assert.match(
  desktopOrganizationToolsSource,
  /receipt: createDesktopOrganizationExecutionReceipt\(\{[\s\S]*commandName: 'desktop-organization'[\s\S]*started: result\.started[\s\S]*verification: result\.verification/u,
  'desktop organization execute results should carry a receipt that preserves the tool execution state',
);

assert.match(
  desktopOrganizationToolsSource,
  /receipt: createDesktopOrganizationExecutionReceipt\(\{[\s\S]*commandName: 'desktop-icon-placement'[\s\S]*started: result\.started[\s\S]*verification: result\.verification/u,
  'single desktop icon placement results should carry a receipt that preserves the tool execution state',
);

assert.match(
  controllerSource,
  /const receiptStatus = resolveAgentReceiptStatus\(result\)[\s\S]*const toolStageStatus = receiptStatus === 'blocked' \|\| receiptStatus === 'failed'[\s\S]*\? 'failed'[\s\S]*: 'completed'/u,
  'agent work stages should mark the tool stage failed only when the receipt says the tool itself failed',
);

assert.match(
  controllerSource,
  /const verifyStageStatus = receiptStatus === 'blocked'[\s\S]*result\.ok === false \|\| result\.assessment\?\.status === 'failed'[\s\S]*\? 'failed'[\s\S]*: 'completed'/u,
  'agent work stages should keep verification failure on the verification stage',
);

assert.match(
  controllerSource,
  /receiptStatus === 'unverified'[\s\S]*\? 'running'[\s\S]*: 'completed'/u,
  'unverified receipts should keep the verification stage running instead of marking it completed',
);

assert.match(
  controllerSource,
  /receiptStatus === 'unverified'[\s\S]*\? 'Tool executed but still needs verification'/u,
  'unverified receipts should display the tool stage as executed instead of failed',
);

assert.match(
  controllerSource,
  /keepPendingVerification = receiptStatus === 'unverified'[\s\S]*completeAgentRunTrace\(trace, resultText, \{ keepPendingVerification \}\)/u,
  'trace summary should preserve pending verification when only execution is unverified',
);

assert.match(
  controllerSource,
  /statusLine = result\.ok === false[\s\S]*receiptStatus === 'unverified'[\s\S]*status: executed but still needs verification/u,
  'trace details should not describe unverified execution as completed',
);

console.log('agent tool verification stage smoke ok');
