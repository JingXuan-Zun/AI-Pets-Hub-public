import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const source = readProjectFile('src/components/chat/agentRunController.ts');

function extractFunctionBody(name: string) {
  return readModuleProjectFunction('src/components/chat/agentRunController.ts', name);
}

const styleRules = source.match(/const AGENT_PERSONA_RESULT_STYLE_RULES = \[[\s\S]*?\]\.join\('\\n'\);/u)?.[0] ?? '';
assert.ok(styleRules, 'Agent result persona style rules should be centralized');
assert.match(styleRules, /Agent 系统播报员/u);
assert.match(styleRules, /工具证据/u);
assert.match(styleRules, /只问一句短问题/u);
assert.match(styleRules, /默认成功回复应落到一条具体结果/u);
assert.match(styleRules, /人格提示词/u);

const sessionPrompt = extractFunctionBody('buildAgentProductionSessionPersonaPrompt');

assert.doesNotMatch(source, /function (?:buildAgentCommandPersonaPrompt|createAgentCommandPersonaStatusGuidance)\(/u,
  'unused command reply helpers must not remain alongside the production reply path');
assert.match(
  sessionPrompt,
  /AGENT_PERSONA_RESULT_STYLE_RULES/u,
  'AgentSessionV2 result persona prompt should use the same character style guard',
);
assert.match(
  sessionPrompt,
  /createAgentProductionSessionPersonaStatusGuidance\(result\)/u,
  'AgentSessionV2 result persona prompt should include status-specific reply guidance',
);
assert.match(sessionPrompt, /desktop-side task/u);
assert.doesNotMatch(sessionPrompt, /You just completed an AgentSessionV2 task/u);

const sessionStatusGuidance = extractFunctionBody('createAgentProductionSessionPersonaStatusGuidance');
assert.match(sessionStatusGuidance, /default:[\s\S]*没有完成/u);
assert.match(sessionStatusGuidance, /不要只说/u);
assert.match(sessionStatusGuidance, /case 'completed'/u);
assert.match(sessionStatusGuidance, /case 'needs-approval'/u);
assert.match(sessionStatusGuidance, /case 'needs-user'/u);
assert.match(sessionStatusGuidance, /case 'max-steps'/u);

const sessionFormatter = extractFunctionBody('formatAgentProductionSessionResultForPersonaPrompt');
assert.match(sessionFormatter, /tool: \$\{command\.toolCall\?\.name/u);
assert.match(sessionFormatter, /result: \$\{compactAgentPersonaPromptText/u);
assert.match(sessionFormatter, /verification: \$\{compactAgentPersonaPromptText/u);
assert.match(sessionFormatter, /evidence: \$\{compactAgentPersonaPromptText/u);
assert.match(sessionFormatter, /finalAnswer: \$\{compactAgentPersonaPromptText/u);
assert.match(sessionFormatter, /toolEvidence:\\n/u);
assert.doesNotMatch(
  sessionFormatter,
  /\uFFFD/u,
  'AgentSessionV2 persona evidence formatter should not contain replacement characters',
);

assert.ok(source.includes('正在调用本机能力'), 'Agent running stage should use readable copy');
assert.ok(source.includes('角色回复完成'), 'persona reply stage should use readable copy');
assert.ok(source.includes('auto continuation:'), 'auto-continuation trace should keep a stable debug prefix');
assert.match(source, /function createAgentSafeVisibleFallbackText/u);
assert.match(source, /当前没有可用的本机执行器/u);
assert.doesNotMatch(source, /AgentSessionV2 has no local tool executor/u);
assert.doesNotMatch(source, /AgentSessionV2 completed without an additional tool result/u);

console.log('agent persona result prompt smoke ok');
