import { strict as assert } from 'node:assert';

const {
  createMcpStdioSpawnSpec,
  getWindowsCommandProcessor,
  isWindowsCommandScript,
} = await import('../electron/mcpStdioSpawnSpec.cjs') as {
  createMcpStdioSpawnSpec: (
    server: { args?: string[]; command: string },
    platform?: string,
    env?: Record<string, string | undefined>,
  ) => { args: string[]; command: string };
  getWindowsCommandProcessor: (env?: Record<string, string | undefined>) => string;
  isWindowsCommandScript: (command: string) => boolean;
};

assert.equal(isWindowsCommandScript('npx.cmd'), true);
assert.equal(isWindowsCommandScript('tool.bat'), true);
assert.equal(isWindowsCommandScript('node.exe'), false);
assert.equal(
  getWindowsCommandProcessor({ SystemRoot: 'C:\\Windows' }),
  'C:\\Windows\\System32\\cmd.exe',
);
assert.equal(
  getWindowsCommandProcessor({ ComSpec: 'D:\\Tools\\cmd.exe', SystemRoot: 'C:\\Windows' }),
  'D:\\Tools\\cmd.exe',
);

const windowsSpec = createMcpStdioSpawnSpec({
  args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
  command: 'npx.cmd',
}, 'win32', { SystemRoot: 'C:\\Windows' });
assert.equal(windowsSpec.command, 'C:\\Windows\\System32\\cmd.exe');
assert.deepEqual(windowsSpec.args.slice(0, 4), ['/d', '/s', '/c', 'npx.cmd']);
assert.deepEqual(windowsSpec.args.slice(4), ['-y', '@modelcontextprotocol/server-filesystem', '.']);

const nodeSpec = createMcpStdioSpawnSpec({
  args: ['server.cjs'],
  command: process.execPath,
}, 'win32');
assert.equal(nodeSpec.command, process.execPath);
assert.deepEqual(nodeSpec.args, ['server.cjs']);

const nonWindowsSpec = createMcpStdioSpawnSpec({
  args: ['--help'],
  command: 'npx.cmd',
}, 'linux');
assert.equal(nonWindowsSpec.command, 'npx.cmd');
assert.deepEqual(nonWindowsSpec.args, ['--help']);

console.log('agent MCP stdio spawn spec smoke passed');
