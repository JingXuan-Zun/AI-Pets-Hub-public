import { type AgentChatCommand } from './agentChatCommand';

const AGENT_COMMAND_PREFIXES = new Set([
  'agent',
  '助手',
  '智能体',
  '代理',
]);

function normalizeInstruction(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function parseSlashCommandBody(body: string) {
  const normalizedBody = normalizeInstruction(body);
  const match = normalizedBody.match(/^(\S+)(?:\s+(.+))?$/u);

  if (!match) {
    return {
      command: '',
      rest: '',
    };
  }

  return {
    command: match[1] ?? '',
    rest: match[2] ?? '',
  };
}

export function resolveAgentChatCommand(text: string): AgentChatCommand | null {
  const sourceText = text.trim();
  const isSlashCommand = sourceText.startsWith('/');

  if (!isSlashCommand) {
    return null;
  }

  const body = normalizeInstruction(sourceText.slice(1));

  if (!body) {
    return {
      instruction: '',
      kind: 'help',
      sourceText,
    };
  }

  const { command, rest } = parseSlashCommandBody(body);
  const commandKey = command.toLowerCase();
  const instruction = AGENT_COMMAND_PREFIXES.has(commandKey)
    ? normalizeInstruction(rest)
    : body;

  if (!instruction) {
    return {
      instruction,
      kind: 'help',
      sourceText,
    };
  }

  return {
    instruction,
    kind: 'unsupported',
    sourceText,
  };
}
