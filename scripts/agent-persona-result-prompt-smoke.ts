import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('src/components/chat/agentRunController.ts');

function extractFunctionBody(name: string) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} should exist`);
  const nextFunction = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, nextFunction >= 0 ? nextFunction : source.length);
}

const styleRules = source.match(/const AGENT_PERSONA_RESULT_STYLE_RULES = \[[\s\S]*?\]\.join\('\\n'\);/u)?.[0] ?? '';
assert.ok(styleRules, 'Agent result persona style rules should be centralized');
assert.match(styleRules, /Agent 系统播报员/u);
assert.match(styleRules, /工具证据/u);
assert.match(styleRules, /只问一句短问题/u);
assert.match(styleRules, /不要只说/u);
assert.match(styleRules, /人格提示词/u);

const legacyPrompt = extractFunctionBody('buildAgentCommandPersonaPrompt');
const sessionPrompt = extractFunctionBody('buildAgentSessionV2PersonaPrompt');

assert.match(
  legacyPrompt,
  /AGENT_PERSONA_RESULT_STYLE_RULES/u,
  'legacy Agent result persona prompt should use the same character style guard',
);
assert.match(
  legacyPrompt,
  /createAgentCommandPersonaStatusGuidance\(result\)/u,
  'legacy Agent result persona prompt should include status-specific reply guidance',
);
assert.match(
  sessionPrompt,
  /AGENT_PERSONA_RESULT_STYLE_RULES/u,
  'AgentSessionV2 result persona prompt should use the same character style guard',
);
assert.match(
  sessionPrompt,
  /createAgentSessionV2PersonaStatusGuidance\(result\)/u,
  'AgentSessionV2 result persona prompt should include status-specific reply guidance',
);
assert.match(sessionPrompt, /desktop-side task/u);
assert.doesNotMatch(sessionPrompt, /You just completed an AgentSessionV2 task/u);

const commandStatusGuidance = extractFunctionBody('createAgentCommandPersonaStatusGuidance');
assert.match(commandStatusGuidance, /result\.ok === false/u);
assert.match(commandStatusGuidance, /assessmentStatus === 'needs-user'/u);
assert.match(commandStatusGuidance, /assessmentStatus === 'unverified'/u);
assert.match(commandStatusGuidance, /不要只说/u);

const sessionStatusGuidance = extractFunctionBody('createAgentSessionV2PersonaStatusGuidance');
assert.match(sessionStatusGuidance, /case 'completed'/u);
assert.match(sessionStatusGuidance, /case 'needs-approval'/u);
assert.match(sessionStatusGuidance, /case 'needs-user'/u);
assert.match(sessionStatusGuidance, /case 'max-steps'/u);

const sessionFormatter = extractFunctionBody('formatAgentSessionV2ResultForPersonaPrompt');
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
