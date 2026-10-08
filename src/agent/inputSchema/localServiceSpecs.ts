import { type AgentToolCallName } from '../agentChatCommand';
import { type AgentToolInputParamSpec } from '../agentToolInputSchema';
import {
  AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES,
  AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES,
  AGENT_TOOL_GAME_COMPANION_LOOP_ACTION_VALUES,
  AGENT_TOOL_VOICE_PROVIDER_VALUES,
  AGENT_TOOL_LOCAL_FILE_ACTION_VALUES,
  AGENT_TOOL_FILE_MANAGEMENT_ACTION_VALUES,
  AGENT_TOOL_FILE_MANAGEMENT_MODE_VALUES,
  AGENT_TOOL_MEMORY_ACTION_VALUES,
  AGENT_TOOL_MEMORY_SCOPE_VALUES,
} from './parameterValues';

export const AGENT_LOCAL_SERVICE_INPUT_SPECS = {
  execute_local_file_action: [
    {
      aliases: ['fileAction', 'operation'],
      enumValues: AGENT_TOOL_LOCAL_FILE_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['target', 'folderPath', 'filePath', 'rootPath', 'queryRoot'],
      key: 'path',
      type: 'string',
    },
    {
      aliases: ['nameQuery', 'fileName', 'pattern'],
      key: 'query',
      type: 'string',
    },
    {
      key: 'limit',
      type: 'number',
    },
    {
      key: 'maxDepth',
      type: 'number',
    },
    {
      key: 'maxBytes',
      type: 'number',
    },
    {
      key: 'includeHidden',
      type: 'boolean',
    },
    {
      aliases: ['extension'],
      key: 'extensions',
      type: 'string',
    },
  ],
  execute_file_management_action: [
    {
      aliases: ['fileAction', 'operation'],
      enumValues: AGENT_TOOL_FILE_MANAGEMENT_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['previewAction', 'targetAction'],
      enumValues: AGENT_TOOL_FILE_MANAGEMENT_ACTION_VALUES,
      key: 'intendedAction',
      type: 'string',
    },
    {
      aliases: ['path', 'source', 'from', 'query'],
      key: 'sourcePath',
      type: 'string',
    },
    {
      aliases: ['desktop', 'desktopDirectory', 'desktopFolder'],
      key: 'desktopPath',
      type: 'string',
    },
    {
      aliases: ['targetPath', 'newPath', 'destination', 'dest', 'to'],
      key: 'destinationPath',
      type: 'string',
    },
    {
      aliases: ['targetDirectory', 'folderPath', 'directoryPath', 'parentPath'],
      key: 'destinationDirectory',
      type: 'string',
    },
    {
      aliases: ['name', 'fileName', 'folderName'],
      key: 'newName',
      type: 'string',
    },
    {
      key: 'dryRun',
      type: 'boolean',
    },
    {
      aliases: ['group', 'grouping', 'groupStrategy'],
      enumValues: AGENT_TOOL_DESKTOP_ITEM_GROUP_BY_VALUES,
      key: 'groupBy',
      type: 'string',
    },
    {
      key: 'includeDirectories',
      type: 'boolean',
    },
    {
      key: 'includeHidden',
      type: 'boolean',
    },
    {
      key: 'includeShortcuts',
      type: 'boolean',
    },
    {
      key: 'limit',
      type: 'number',
    },
    {
      enumValues: AGENT_TOOL_FILE_MANAGEMENT_MODE_VALUES,
      key: 'mode',
      type: 'string',
    },
  ],
  execute_memory_action: [
    {
      aliases: ['memoryAction', 'operation'],
      enumValues: AGENT_TOOL_MEMORY_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['keyword', 'keywords', 'target'],
      key: 'query',
      type: 'string',
    },
    {
      aliases: ['name', 'preferenceKey'],
      key: 'key',
      type: 'string',
    },
    {
      aliases: ['content', 'text', 'fact', 'preference'],
      key: 'value',
      type: 'string',
    },
    {
      aliases: ['type', 'topic'],
      key: 'category',
      type: 'string',
    },
    {
      enumValues: AGENT_TOOL_MEMORY_SCOPE_VALUES,
      key: 'scope',
      type: 'string',
    },
    {
      key: 'limit',
      type: 'number',
    },
  ],
  get_pet_settings: [
    {
      key: 'path',
      type: 'string',
    },
    {
      key: 'query',
      type: 'string',
    },
  ],
  update_pet_settings: [
    {
      aliases: ['changes', 'updates'],
      key: 'changesJson',
      required: true,
      type: 'string',
    },
  ],
  get_voice_status: [
    {
      key: 'includeLocalHealth',
      type: 'boolean',
    },
  ],
  inspect_local_project: [
    {
      aliases: ['projectPath', 'folderPath', 'filePath', 'query'],
      key: 'path',
      required: true,
      type: 'string',
    },
    {
      key: 'question',
      type: 'string',
    },
  ],
  get_path_info: [
    {
      aliases: ['target', 'query'],
      key: 'path',
      required: true,
      type: 'string',
    },
  ],
  list_directory: [
    {
      aliases: ['folderPath', 'query'],
      key: 'path',
      required: true,
      type: 'string',
    },
    {
      key: 'limit',
      type: 'number',
    },
    {
      key: 'includeHidden',
      type: 'boolean',
    },
  ],
  search_files: [
    {
      aliases: ['folderPath', 'rootPath', 'queryRoot'],
      key: 'path',
      required: true,
      type: 'string',
    },
    {
      aliases: ['nameQuery', 'fileName', 'pattern'],
      key: 'query',
      required: true,
      type: 'string',
    },
    {
      key: 'maxDepth',
      type: 'number',
    },
    {
      key: 'limit',
      type: 'number',
    },
    {
      key: 'includeHidden',
      type: 'boolean',
    },
    {
      aliases: ['extension'],
      key: 'extensions',
      type: 'string',
    },
  ],
  read_text_file: [
    {
      aliases: ['filePath', 'query'],
      key: 'path',
      required: true,
      type: 'string',
    },
    {
      key: 'maxBytes',
      type: 'number',
    },
  ],
  set_voice_input: [
    {
      key: 'enabled',
      required: true,
      type: 'boolean',
    },
  ],
  start_voice_input_session: [
    {
      key: 'agentPrefix',
      type: 'boolean',
    },
  ],
  stop_voice_input_session: [],
  switch_tts_provider: [
    {
      aliases: ['ttsProvider'],
      enumValues: AGENT_TOOL_VOICE_PROVIDER_VALUES,
      key: 'provider',
      required: true,
      type: 'string',
    },
    {
      key: 'enableVoice',
      type: 'boolean',
    },
    {
      key: 'autoSpeak',
      type: 'boolean',
    },
  ],
  warmup_local_voice: [],
  run_local_project_action: [
    {
      aliases: ['projectPath', 'folderPath', 'filePath', 'query'],
      key: 'path',
      type: 'string',
    },
    {
      aliases: ['index'],
      key: 'actionIndex',
      type: 'number',
    },
    {
      key: 'command',
      type: 'string',
    },
    {
      key: 'label',
      type: 'string',
    },
    {
      key: 'question',
      type: 'string',
    },
  ],
  list_agent_skills: [
    {
      key: 'query',
      type: 'string',
    },
    {
      key: 'limit',
      type: 'number',
    },
  ],
  execute_agent_skill: [
    {
      key: 'skillId',
      required: true,
      type: 'string',
    },
    {
      key: 'intent',
      type: 'string',
    },
    {
      key: 'target',
      type: 'string',
    },
    {
      key: 'inputJson',
      type: 'string',
    },
    {
      key: 'dryRun',
      type: 'boolean',
    },
  ],
  list_mcp_tools: [
    {
      key: 'serverId',
      type: 'string',
    },
  ],
  call_mcp_tool: [
    {
      key: 'serverId',
      required: true,
      type: 'string',
    },
    {
      aliases: ['toolName'],
      key: 'name',
      required: true,
      type: 'string',
    },
    {
      key: 'argumentsJson',
      type: 'string',
    },
  ],
  manage_game_companion_loop: [
    {
      aliases: ['mode', 'operation'],
      enumValues: AGENT_TOOL_GAME_COMPANION_LOOP_ACTION_VALUES,
      key: 'action',
      required: true,
      type: 'string',
    },
    {
      aliases: ['captureSourceTypes', 'type'],
      enumValues: AGENT_TOOL_CAPTURE_SOURCE_TYPE_VALUES,
      key: 'sourceType',
      type: 'string',
    },
    {
      aliases: ['id'],
      key: 'sourceId',
      type: 'string',
    },
    {
      aliases: ['target', 'sourceName', 'name', 'windowTitle', 'title'],
      key: 'query',
      type: 'string',
    },
    {
      aliases: ['gameName', 'game'],
      key: 'gameHint',
      type: 'string',
    },
    {
      aliases: ['analysisFocus', 'topic'],
      key: 'focus',
      type: 'string',
    },
    {
      aliases: ['sampleEveryMs'],
      key: 'intervalMs',
      type: 'number',
    },
    {
      aliases: ['commentCooldownMs', 'minSpeakIntervalMs'],
      key: 'minCommentIntervalMs',
      type: 'number',
    },
    {
      key: 'maxSamples',
      type: 'number',
    },
  ]
} satisfies Partial<Record<AgentToolCallName, readonly AgentToolInputParamSpec[]>>;
