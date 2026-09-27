import { strict as assert } from 'node:assert';
import { mergeMcpToolsForServer } from '../src/components/settings/settingsMcpToolListUtils';

const merged = mergeMcpToolsForServer(
  [
    {
      description: 'Old echo.',
      inputSchema: { type: 'object' },
      name: 'echo',
      serverId: 'alpha',
      title: 'Echo',
    },
    {
      description: 'Keep me.',
      inputSchema: { type: 'object' },
      name: 'search',
      serverId: 'beta',
      title: 'Search',
    },
  ],
  'alpha',
  [
    {
      description: 'New echo.',
      inputSchema: { type: 'object' },
      name: 'echo2',
      serverId: 'alpha',
      title: 'Echo 2',
    },
  ],
);

assert.deepEqual(merged.map((tool) => `${tool.serverId}:${tool.name}`), [
  'beta:search',
  'alpha:echo2',
]);

console.log('agent MCP tool list utils smoke passed');
