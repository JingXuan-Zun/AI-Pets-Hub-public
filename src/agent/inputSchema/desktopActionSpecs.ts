import { type AgentToolCallName } from '../agentChatCommand';
import { type AgentToolInputParamSpec } from '../agentToolInputSchema';
import {
  AGENT_TOOL_DISPLAY_TARGET_VALUES,
  AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES,
  AGENT_TOOL_DESKTOP_ORGANIZATION_MODE_VALUES,
  AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES,
  AGENT_TOOL_CONTROLLED_COMMAND_SHELL_VALUES,
  AGENT_TOOL_BROWSER_CONTROL_ACTION_VALUES,
} from './parameterValues';

export const AGENT_DESKTOP_ACTION_INPUT_SPECS = {
  run_controlled_command: [
    {
      aliases: ['script', 'query'],
      key: 'command',
      required: true,
      type: 'string',
    },
    {
      key: 'cwd',
      type: 'string',
    },
    {
      enumValues: AGENT_TOOL_CONTROLLED_COMMAND_SHELL_VALUES,
      key: 'shell',
      type: 'string',
    },
    {
      key: 'timeoutMs',
      type: 'number',
    },
  ],
  control_browser: [
    {
      aliases: ['browserAction', 'operation'],
      enumValues: AGENT_TOOL_BROWSER_CONTROL_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['target', 'site', 'website'],
      key: 'url',
      type: 'string',
    },
    {
      aliases: ['target', 'keyword', 'keywords'],
      key: 'query',
      type: 'string',
    },
    {
      key: 'tabId',
      type: 'string',
    },
    {
      key: 'title',
      type: 'string',
    },
    {
      key: 'forceNewPage',
      type: 'boolean',
    },
    {
      key: 'forceOpen',
      type: 'boolean',
    },
    {
      key: 'readPage',
      type: 'boolean',
    },
  ],
  organize_desktop_icons: [
    {
      aliases: ['display', 'targetDisplay'],
      enumValues: AGENT_TOOL_DISPLAY_TARGET_VALUES,
      key: 'displayTarget',
      type: 'string',
    },
    {
      aliases: ['target', 'displayTarget'],
      enumValues: AGENT_TOOL_DISPLAY_TARGET_VALUES,
      key: 'targetDisplay',
      type: 'string',
    },
    {
      aliases: ['source', 'sourceDisplayTarget'],
      enumValues: AGENT_TOOL_DISPLAY_TARGET_VALUES,
      key: 'sourceDisplay',
      type: 'string',
    },
    {
      aliases: ['iconScope'],
      enumValues: AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES,
      key: 'scope',
      type: 'string',
    },
    {
      aliases: ['iconScope', 'scope'],
      enumValues: AGENT_TOOL_DESKTOP_ICON_SCOPE_VALUES,
      key: 'sourceScope',
      type: 'string',
    },
    {
      aliases: ['actionMode'],
      enumValues: AGENT_TOOL_DESKTOP_ORGANIZATION_MODE_VALUES,
      key: 'mode',
      type: 'string',
    },
    {
      aliases: ['group', 'grouping', 'groupStrategy', 'sortGroup'],
      enumValues: AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES,
      key: 'groupBy',
      type: 'string',
    },
    {
      aliases: ['layoutIntent', 'placementGoal', 'arrangementIntent', 'intent'],
      key: 'placementIntent',
      type: 'string',
    },
  ],
  remember_local_app: [
    {
      aliases: ['name'],
      key: 'alias',
      required: true,
      type: 'string',
    },
    {
      aliases: ['appPath'],
      key: 'path',
      required: true,
      type: 'string',
    },
  ]
} satisfies Partial<Record<AgentToolCallName, readonly AgentToolInputParamSpec[]>>;
