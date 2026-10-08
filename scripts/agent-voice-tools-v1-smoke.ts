import assert from 'node:assert/strict';
import {
  buildAgentPermissionRoute,
  isAgentPermissionRouteSilentReadOnly,
  isAgentToolAvailableInMode,
  listRegisteredAgentToolNamesOutsideModePolicies,
  type AgentChatCommand,
} from '../src/agent/index.ts';
import { createAgentCommandFromPlannerDecision } from '../src/agent/agentPlanner.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  chatCommandSource,
  capabilitySource,
  registrySource,
  orchestratorSource,
  runtimeSource,
  chatVoiceInputSource,
  petContainerSource,
  agentCommandBridgeSource,
} = readProjectSources({
  chatCommandSource: 'src/agent/agentChatCommand.ts',
  capabilitySource: 'src/agent/agentCapabilityTypes.ts',
  registrySource: 'src/agent/agentToolRegistry.ts',
  orchestratorSource: 'src/agent/agentOrchestrator.ts',
  runtimeSource: 'src/agent/agentRuntimeExecutor.ts',
  chatVoiceInputSource: 'src/components/chat/usePetChatVoiceInputController.ts',
  petContainerSource: 'src/components/PetContainer.tsx',
  agentCommandBridgeSource: 'src/components/pet/usePetContainerAgentCommandBridge.ts',
});

for (const toolName of [
  'get_voice_status',
  'switch_tts_provider',
  'warmup_local_voice',
  'set_voice_input',
  'start_voice_input_session',
  'stop_voice_input_session',
] as const) {
  assert.match(chatCommandSource, new RegExp(`'${toolName}'`, 'u'), `${toolName} should be part of AgentToolCallName`);
  assert.match(registrySource, new RegExp(`name: '${toolName}'`, 'u'), `${toolName} should be registered`);
  assert.match(orchestratorSource, new RegExp(`case '${toolName}'`, 'u'), `${toolName} should have an execution plan`);
  assert.match(runtimeSource, new RegExp(`${toolName}:`, 'u'), `${toolName} should have runtime parameter specs and handler coverage`);
  assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true, `${toolName} should be available in Agent mode`);
}

for (const actionKind of [
  'read-voice-status',
  'switch-tts-provider',
  'warmup-local-voice',
  'set-voice-input',
  'start-voice-input-session',
  'stop-voice-input-session',
]) {
  assert.match(capabilitySource, new RegExp(`'${actionKind}'`, 'u'), `${actionKind} should be a typed action kind`);
}

assert.deepEqual(listRegisteredAgentToolNamesOutsideModePolicies(), []);

assert.match(
  runtimeSource,
  /voiceInputControllerRef\?: \{ current: AgentRuntimeVoiceInputController \| null \}/u,
  'Agent runtime context should accept a chat-layer voice input controller',
);

assert.match(
  chatVoiceInputSource,
  /return \{[\s\S]*startVoiceInputSession[\s\S]*stopVoiceInput[\s\S]*toggleVoiceInput/u,
  'Chat voice input hook should expose explicit start/stop/toggle controls',
);

assert.match(
  agentCommandBridgeSource,
  /const voiceInputControllerRef = useRef<AgentRuntimeVoiceInputControllerLike \| null>\(null\)/u,
  'Agent command bridge should own the voice input controller ref',
);

assert.match(
  agentCommandBridgeSource,
  /executeAgentChatCommand\(command,[\s\S]*voiceInputControllerRef/u,
  'Agent command bridge should pass the voice input controller ref into Agent runtime',
);

assert.match(
  agentCommandBridgeSource,
  /const persistAgentConfigUpdate = useCallback<PetConfigUpdateHandler>\([\s\S]*persist: options\?\.persist \?\? true/u,
  'Agent config mutations should request persistence unless a command explicitly opts out',
);

assert.match(
  agentCommandBridgeSource,
  /onUpdateConfig: persistAgentConfigUpdate/u,
  'Agent runtime should use the persisted config update bridge',
);

assert.match(
  agentCommandBridgeSource,
  /voiceInputControllerRef\.current = \{[\s\S]*start: startVoiceInputSession[\s\S]*stop: stopVoiceInput/u,
  'Agent voice bridge should register the chat voice input controller',
);

assert.match(
  petContainerSource,
  /usePetContainerAgentCommandBridge\([\s\S]*gameCompanionLoopControllerRef[\s\S]*onUpdateConfig/u,
  'PetContainer should create the Agent command bridge',
);

assert.match(
  petContainerSource,
  /usePetContainerAgentVoiceInputBridge\([\s\S]*startVoiceInputSession: voiceInputController\.startVoiceInputSession[\s\S]*voiceInputControllerRef: agentCommandBridge\.voiceInputControllerRef/u,
  'PetContainer should register the chat voice input controller through the Agent bridge',
);

const voiceStatusCommand: AgentChatCommand = {
  capabilityId: 'voice-control',
  instruction: 'read voice status',
  kind: 'tool-call',
  sourceText: 'what is the current voice status',
  toolCall: {
    input: {
      includeLocalHealth: true,
    },
    name: 'get_voice_status',
  },
};
const voiceStatusRoute = buildAgentPermissionRoute(voiceStatusCommand);
assert.equal(voiceStatusRoute.status, 'silent');
assert.equal(voiceStatusRoute.routeMode, 'agent');
assert.equal(voiceStatusRoute.maxRisk, 'read');
assert.equal(isAgentPermissionRouteSilentReadOnly(voiceStatusRoute), true);

const switchProviderCommand: AgentChatCommand = {
  capabilityId: 'voice-control',
  instruction: 'switch tts provider',
  kind: 'tool-call',
  sourceText: 'switch to local voice',
  toolCall: {
    input: {
      provider: 'local',
    },
    name: 'switch_tts_provider',
  },
};
const switchProviderRoute = buildAgentPermissionRoute(switchProviderCommand);
assert.equal(switchProviderRoute.status, 'needs-approval');
assert.equal(switchProviderRoute.maxRisk, 'reversible-write');

const warmupCommand: AgentChatCommand = {
  capabilityId: 'voice-control',
  instruction: 'warmup local voice',
  kind: 'tool-call',
  sourceText: 'warm up local voice',
  toolCall: {
    input: {},
    name: 'warmup_local_voice',
  },
};
const warmupRoute = buildAgentPermissionRoute(warmupCommand);
assert.equal(warmupRoute.status, 'needs-approval');
assert.equal(warmupRoute.maxRisk, 'launch');

const setVoiceInputCommand: AgentChatCommand = {
  capabilityId: 'voice-control',
  instruction: 'enable voice input',
  kind: 'tool-call',
  sourceText: 'enable voice input',
  toolCall: {
    input: {
      enabled: true,
    },
    name: 'set_voice_input',
  },
};
const setVoiceInputRoute = buildAgentPermissionRoute(setVoiceInputCommand);
assert.equal(setVoiceInputRoute.status, 'needs-approval');
assert.equal(setVoiceInputRoute.maxRisk, 'reversible-write');

const startVoiceInputCommand: AgentChatCommand = {
  capabilityId: 'voice-control',
  instruction: 'start listening',
  kind: 'tool-call',
  sourceText: 'start listening',
  toolCall: {
    input: {
      agentPrefix: false,
    },
    name: 'start_voice_input_session',
  },
};
const startVoiceInputRoute = buildAgentPermissionRoute(startVoiceInputCommand);
assert.equal(startVoiceInputRoute.status, 'needs-approval');
assert.equal(startVoiceInputRoute.maxRisk, 'launch');

const stopVoiceInputCommand: AgentChatCommand = {
  capabilityId: 'voice-control',
  instruction: 'stop listening',
  kind: 'tool-call',
  sourceText: 'stop listening',
  toolCall: {
    input: {},
    name: 'stop_voice_input_session',
  },
};
const stopVoiceInputRoute = buildAgentPermissionRoute(stopVoiceInputCommand);
assert.equal(stopVoiceInputRoute.status, 'silent');
assert.equal(stopVoiceInputRoute.maxRisk, 'read');

const statusFallback = createAgentCommandFromPlannerDecision('voice status please', null);
assert.equal(statusFallback?.kind, 'tool-call');
assert.equal(statusFallback?.toolCall?.name, 'get_voice_status');
assert.equal(statusFallback?.toolCall?.input.includeLocalHealth, true);

const localProviderFallback = createAgentCommandFromPlannerDecision('switch to local voice', {
  intent: 'unsupported',
  message: 'model missed voice provider switch',
});
assert.equal(localProviderFallback?.kind, 'unsupported');

const apiProviderFallback = createAgentCommandFromPlannerDecision('switch to api voice', {
  intent: 'tool',
  tool: 'switch_tts_provider',
  args: {},
});
assert.equal(apiProviderFallback?.kind, 'unsupported');

const modelProvidedApiProvider = createAgentCommandFromPlannerDecision('switch to api voice', {
  intent: 'tool',
  tool: 'switch_tts_provider',
  args: {
    provider: 'api',
  },
});
assert.equal(modelProvidedApiProvider?.kind, 'tool-call');
assert.equal(modelProvidedApiProvider?.toolCall?.name, 'switch_tts_provider');
assert.equal(modelProvidedApiProvider?.toolCall?.input.provider, 'api');

const inputFallback = createAgentCommandFromPlannerDecision('disable microphone voice input', {
  intent: 'tool',
  tool: null,
  args: {},
});
assert.equal(inputFallback?.kind, 'unsupported');

const warmupFallback = createAgentCommandFromPlannerDecision('warm up local voice model', {
  intent: 'clarify',
  message: 'model tried to ask',
});
assert.equal(warmupFallback?.kind, 'unsupported');

const startListeningFallback = createAgentCommandFromPlannerDecision('start listening', {
  intent: 'unsupported',
  message: 'model missed voice input session',
});
assert.equal(startListeningFallback?.kind, 'unsupported');

const startAgentListeningFallback = createAgentCommandFromPlannerDecision('start listening for my Agent command', {
  intent: 'tool',
  tool: null,
  args: {},
});
assert.equal(startAgentListeningFallback?.kind, 'unsupported');

const stopListeningFallback = createAgentCommandFromPlannerDecision('stop listening', {
  intent: 'tool',
  tool: null,
  args: {},
});
assert.equal(stopListeningFallback?.kind, 'unsupported');

console.log('agent voice tools v1 smoke ok');
