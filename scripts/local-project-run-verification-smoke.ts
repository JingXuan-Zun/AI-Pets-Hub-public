import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { serviceSource, systemRuntimeSource, viteEnvSource } = readProjectSources({
  serviceSource: 'electron/localProjectInspectorService.cjs',
  systemRuntimeSource: 'src/agent/agentRuntimeSystemTools.ts',
  viteEnvSource: 'src/vite-env.d.ts',
});

assert.match(
  serviceSource,
  /verification: \{[\s\S]*confidence: 'started'[\s\S]*visible-terminal-window-created/u,
  'terminal command runs should report a started verification state',
);

assert.match(
  serviceSource,
  /summary: '已创建新的可见命令行窗口；当前没有读取 stdout\/stderr 或退出码。'/u,
  'terminal command verification should be explicit about not reading output or exit code',
);

assert.match(
  serviceSource,
  /verification: runResult\.verification \?\? null/u,
  'local project run result should carry action verification',
);

assert.match(
  viteEnvSource,
  /verification\?: \{[\s\S]*confidence\?: 'started' \| 'request-accepted' \| 'failed';[\s\S]*summary\?: string;/u,
  'renderer type should expose local project verification',
);

assert.match(
  systemRuntimeSource,
  /function createLocalProjectRunVerification\(/u,
  'agent runtime should translate local project verification into Agent verification',
);

assert.match(
  systemRuntimeSource,
  /function createLocalProjectRunFollowUp\(/u,
  'agent runtime should suggest follow-up based on project run confidence',
);

assert.match(
  systemRuntimeSource,
  /Project run verification confidence/u,
  'agent runtime observations should include project run confidence',
);

assert.match(
  systemRuntimeSource,
  /verification: createLocalProjectRunVerification\(result\)/u,
  'run_local_project_action should pass verification into Agent result',
);

console.log('local project run verification smoke ok');
