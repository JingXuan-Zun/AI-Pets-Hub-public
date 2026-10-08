import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { runtimeSource, desktopOrganizationToolsSource } = readProjectSources({
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  desktopOrganizationToolsSource: 'src/agent/agentRuntimeDesktopOrganizationTools.ts',
});

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
