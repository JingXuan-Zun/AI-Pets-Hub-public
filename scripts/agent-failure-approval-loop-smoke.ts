import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { coreSource, runtimeSource, desktopOrganizationToolsSource } = readProjectSources({
  coreSource: 'src/agent/agentCore.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  desktopOrganizationToolsSource: 'src/agent/agentRuntimeDesktopOrganizationTools.ts',
});

assert.match(
  coreSource,
  /function resolveAgentApprovalPauseCandidate\([\s\S]*result\.ok === false[\s\S]*result\.assessment\?\.status === 'failed'[\s\S]*result\.assessment\?\.status === 'needs-user'[\s\S]*return null/u,
  'failed or needs-user results should not create a new approval pause',
);

assert.match(
  coreSource,
  /function isDesktopOrganizationExecuteCommand\([\s\S]*desktopOrganization\?\.mode === 'execute'[\s\S]*organize_desktop_icons[\s\S]*mode === 'execute'/u,
  'desktop organization execute commands should be detectable',
);

assert.match(
  coreSource,
  /function shouldOfferRunCommandRecovery\([\s\S]*result\.ok === false && isDesktopOrganizationExecuteCommand\(command\)[\s\S]*return false/u,
  'failed desktop organization execution should not offer run-command recovery',
);

assert.match(
  coreSource,
  /canOfferRunCommandRecovery[\s\S]*shouldRetry && reobserveCommand && canOfferRunCommandRecovery[\s\S]*shouldRetry && !reobserveCommand && canOfferRunCommandRecovery/u,
  'run-command recovery should be gated by the failure loop guard',
);

assert.match(
  runtimeSource,
  /organize_desktop_icons: \(\{ command, runtime, toolCall \}\) => \([\s\S]*executeDesktopOrganizationToolCall\(runtime, toolCall, command\.sourceText\)/u,
  'desktop organization tool calls should be delegated to the desktop organization tool module',
);

assert.match(
  runtimeSource,
  /if \(command\.kind === 'desktop-organization'\)[\s\S]*executeDesktopOrganization\(context, command\.desktopOrganization \?\? \{\}, command\.sourceText\)/u,
  'desktop organization command execution should be delegated to the desktop organization tool module',
);

assert.match(
  desktopOrganizationToolsSource,
  /const desktopOrganization = context\.desktopOrganizationRef\.current;[\s\S]*if \(!desktopOrganization\) \{[\s\S]*errorText:[\s\S]*ok: false[\s\S]*responseText:/u,
  'desktop organization missing runtime should be an explicit failure',
);

assert.match(
  desktopOrganizationToolsSource,
  /if \(organization\.mode === 'execute'\) \{[\s\S]*if \(!context\.lastDesktopOrganizationPlanRef\.current\) \{[\s\S]*errorText:[\s\S]*ok: false[\s\S]*responseText:/u,
  'desktop organization execute without a plan should be an explicit failure',
);

console.log('agent failure approval loop smoke ok');
