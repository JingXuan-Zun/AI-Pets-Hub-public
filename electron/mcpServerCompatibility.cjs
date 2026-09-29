const path = require('path');

const PACKAGE_AVAILABILITY_PATTERN = /(?:EAI_AGAIN|ENETUNREACH|ENOTFOUND|ERR_PNPM_META_FETCH_FAIL|cache miss|offline mode|network access|npm error code E(?:AI_AGAIN|NETUNREACH|NOTFOUND))/iu;
const PERMISSION_PATTERN = /(?:EACCES|EPERM|access is denied|permission denied|operation not permitted)/iu;
const MISSING_COMMAND_PATTERN = /(?:ENOENT|command not found|could not find|is not recognized|no such file or directory|was not found)/iu;
const TIMEOUT_PATTERN = /(?:timed out|timeout)/iu;
const CRASH_PATTERN = /(?:exited code=|signal=|EPIPE|server exited|session already closed|session closed)/iu;

function commandBase(command) {
  return path.basename(String(command ?? '')).toLowerCase();
}

function isRuntimeLauncher(command) {
  return ['node', 'node.exe', 'npm', 'npm.cmd', 'npx', 'npx.cmd', 'pnpm', 'pnpm.cmd'].includes(commandBase(command));
}

function compatibility(issueCode, status, summary, nextAction) {
  return { issueCode, nextAction, status, summary };
}

function classifyMcpServerCompatibility(diagnostic = {}) {
  if (diagnostic.ok) {
    return compatibility(
      'ready',
      'ready',
      'The server started and returned its tool list.',
      'No compatibility action is required.',
    );
  }

  const errorText = `${diagnostic.error ?? ''}\n${diagnostic.stderrSnippet ?? ''}`;
  if (/Unknown MCP server/iu.test(errorText)) {
    return compatibility(
      'unknown-server',
      'blocked',
      'The saved server configuration could not be found.',
      'Save the server configuration again, then rerun the diagnostic.',
    );
  }
  if (diagnostic.cwdExists === false) {
    return compatibility(
      'cwd-missing',
      'blocked',
      'The configured working directory is unavailable.',
      'Choose an existing folder that the desktop app can access.',
    );
  }
  if (PERMISSION_PATTERN.test(errorText)) {
    return compatibility(
      'permission-denied',
      'blocked',
      'Windows or the host denied access to the command or working directory.',
      'Check file permissions, security software, and whether the command is allowed to run.',
    );
  }
  if (PACKAGE_AVAILABILITY_PATTERN.test(errorText)) {
    return compatibility(
      'package-unavailable',
      'retryable',
      'The package launcher could not obtain the MCP server package.',
      'Restore registry access or preinstall the package in the local npm cache, then retry.',
    );
  }
  if (diagnostic.commandPathExists === false || MISSING_COMMAND_PATTERN.test(errorText)) {
    return isRuntimeLauncher(diagnostic.command)
      ? compatibility(
        'runtime-missing',
        'blocked',
        'The configured Node or package-manager runtime is unavailable.',
        'Install the required runtime or select its existing executable path.',
      )
      : compatibility(
        'command-missing',
        'blocked',
        'The configured MCP server command is unavailable.',
        'Correct the command path or add the executable to PATH.',
      );
  }
  if (TIMEOUT_PATTERN.test(errorText)) {
    return compatibility(
      'startup-timeout',
      'retryable',
      'The server did not complete MCP startup before the timeout.',
      'Check package startup output and increase timeout only when slow startup is expected.',
    );
  }
  if (CRASH_PATTERN.test(errorText)) {
    return compatibility(
      'server-crash',
      'retryable',
      'The MCP server process closed unexpectedly.',
      'Review the bounded stderr detail, fix the server configuration, then reset and retry the session.',
    );
  }
  return compatibility(
    'protocol-or-startup-error',
    'blocked',
    'The server failed during MCP startup or tool discovery.',
    'Review the bounded error detail and confirm that the server supports the configured MCP stdio protocol.',
  );
}

module.exports = { classifyMcpServerCompatibility };
