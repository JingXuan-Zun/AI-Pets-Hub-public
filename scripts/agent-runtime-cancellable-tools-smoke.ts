import { readModuleProjectSources as readProjectSources } from './projectModuleSource.mjs';
import assert from 'node:assert/strict';


const {
  runtimeSource,
  visualRuntimeSource,
  browserRuntimeSource,
  systemRuntimeSource,
  bridgeSource,
  runtimeBridgeSource,
  preloadSource,
  ipcSource,
  controlledCommandSource,
  viteEnvSource,
} = readProjectSources({
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  visualRuntimeSource: 'src/agent/agentRuntimeVisualTools.ts',
  browserRuntimeSource: 'src/agent/agentRuntimeBrowserTools.ts',
  systemRuntimeSource: 'src/agent/agentRuntimeSystemTools.ts',
  bridgeSource: 'src/desktopShellBridge.ts',
  runtimeBridgeSource: 'src/desktopShellRuntime.ts',
  preloadSource: 'electron/preload.cjs',
  ipcSource: 'electron/ipcHandlers.cjs',
  controlledCommandSource: 'electron/controlledCommandService.cjs',
  viteEnvSource: 'src/vite-env.d.ts',
});

assert.match(runtimeSource, /import \{ isAgentRuntimeCancellationRequested \} from '\.\/agentRuntimeCancellation'/u);
assert.match(systemRuntimeSource, /executeRunControlledCommand\(\s*runtime: AgentRuntimeExecutorContext/u);
assert.match(systemRuntimeSource, /cancelControlledCommand\(\{ requestId \}\)/u);
assert.match(systemRuntimeSource, /requestId,\s*\n\s*shell,/u);
assert.match(runtimeSource, /control_browser: \(\{ runtime, toolCall \}\) => executeControlBrowser\(runtime, toolCall\)/u);
assert.match(browserRuntimeSource, /executeControlBrowser\(\s*context: AgentRuntimeExecutorContext/u);
assert.match(browserRuntimeSource, /runCancellableAgentRuntimeTask\(context, toolCall, \(\) => desktopPetShellRuntime\.controlBrowser/u);
assert.match(visualRuntimeSource, /executeListCaptureSources\(\s*runtime: AgentRuntimeExecutorContext/u);
assert.match(visualRuntimeSource, /runCancellableAgentRuntimeTask\(runtime, toolCall, \(\) => desktopPetShellRuntime\.listCaptureSources/u);
assert.match(visualRuntimeSource, /runCancellableAgentRuntimeTask\(runtime, toolCall, \(\) => summarizeAgentVisualSnapshot/u);
assert.match(visualRuntimeSource, /runCancellableAgentRuntimeTask\(runtime, toolCall, \(\) => analyzeAgentGameSnapshot/u);
assert.match(visualRuntimeSource, /stopCompanionLoopOnAbort/u);

assert.match(controlledCommandSource, /const activeCommands = new Map\(\)/u);
assert.match(controlledCommandSource, /activeCommands\.set\(requestId, child\)/u);
assert.match(controlledCommandSource, /function cancelControlledCommand/u);
assert.match(controlledCommandSource, /child\.kill\(\)/u);
assert.match(controlledCommandSource, /cancelControlledCommand,/u);

assert.match(ipcSource, /desktop-pet:cancel-controlled-command/u);
assert.match(preloadSource, /cancelControlledCommand: \(request\) => ipcRenderer\.invoke\('desktop-pet:cancel-controlled-command'/u);
assert.match(bridgeSource, /cancelControlledCommand: \(request\?: \{ requestId\?: string \}\)/u);
assert.match(runtimeBridgeSource, /cancelControlledCommand: desktopPetShellBridge\.cancelControlledCommand/u);
assert.match(viteEnvSource, /cancelControlledCommand\?: \(request\?: \{\s*requestId\?: string;/u);

console.log('agent runtime cancellable tools smoke ok');
