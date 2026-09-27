const { uniqueStrings } = require('./localVoiceRuntimePathUtils.cjs');

function splitOutputLines(...chunks) {
  return chunks
    .join('\n')
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function takeTail(lines, limit = 8) {
  return lines.length <= limit ? lines : lines.slice(-limit);
}

function formatSpawnFailure(result) {
  return result.stderr.trim()
    || result.stdout.trim()
    || (result.error instanceof Error ? result.error.message : '')
    || `exit_code_${result.exitCode ?? 'unknown'}`;
}

function quotePowerShellValue(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function buildPowerShellEncodedCommand(executable, args) {
  const command = [`& ${quotePowerShellValue(executable)}`]
    .concat((Array.isArray(args) ? args : []).map((arg) => quotePowerShellValue(arg)))
    .join(' ');

  return Buffer.from(command, 'utf16le').toString('base64');
}

function buildSpawnCommandSpec({ buildPowerShellEncodedCommand, candidate, commandArgs, options, platform }) {
  const candidateArgs = [...candidate.args, ...commandArgs];
  const spawnOptions = {
    cwd: options.cwd,
    env: options.env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  };

  if (platform === 'win32') {
    return {
      command: 'powershell.exe',
      args: [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        buildPowerShellEncodedCommand(candidate.executable, candidateArgs),
      ],
      options: spawnOptions,
    };
  }

  return {
    command: candidate.executable,
    args: candidateArgs,
    options: spawnOptions,
  };
}

function buildSpawnErrorResult({ canceled = false, error, stderr = '', stdout = '' }) {
  return {
    ok: false,
    stdout,
    stderr,
    exitCode: null,
    error,
    ...(canceled ? { canceled: true } : {}),
  };
}

function buildSpawnCloseResult({ exitCode, stderr = '', stdout = '' }) {
  return {
    ok: exitCode === 0,
    stdout,
    stderr,
    exitCode,
    error: null,
  };
}

function stripAnsiCodes(value) {
  return String(value ?? '').replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

function parseJsonFromCommandOutput(rawOutput) {
  const normalizedOutput = stripAnsiCodes(rawOutput).trim();
  if (!normalizedOutput) {
    throw new Error('empty_json_output');
  }

  const candidates = [
    normalizedOutput,
    ...splitOutputLines(normalizedOutput).reverse(),
  ];
  const seen = new Set();

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate line.
    }
  }

  throw new Error(`json_parse_failed: ${takeTail(splitOutputLines(normalizedOutput), 3).join(' | ')}`);
}

function pushOptionalRunnerArg(targetArgs, flag, value) {
  if (!Array.isArray(targetArgs)) {
    return;
  }

  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return;
  }

  targetArgs.push(flag, normalized);
}

function createLineReporter(callback) {
  let buffer = '';

  const emitLine = (line) => {
    const normalized = stripAnsiCodes(line).trim();
    if (normalized && typeof callback === 'function') {
      callback(normalized);
    }
  };

  return {
    push(chunkText) {
      buffer += String(chunkText ?? '').replace(/\r/g, '\n');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        emitLine(line);
      }
    },
    flush() {
      if (buffer.trim()) {
        emitLine(buffer);
      }

      buffer = '';
    },
  };
}

function createInstallProgressReporter(onProgress, onMessage) {
  const state = {
    stage: 'starting',
    currentStep: null,
    executable: null,
    messages: [],
    error: null,
    missingPackages: [],
  };

  function emit() {
    if (typeof onProgress !== 'function') {
      return;
    }

    onProgress({
      stage: state.stage,
      currentStep: state.currentStep,
      executable: state.executable,
      messages: [...state.messages],
      error: state.error,
      missingPackages: [...state.missingPackages],
    });
  }

  return {
    getMessages() {
      return [...state.messages];
    },
    setStage(stage) {
      state.stage = stage;
      emit();
    },
    setExecutable(executable) {
      state.executable = executable || null;
      emit();
    },
    setError(error) {
      state.error = error ? String(error) : null;
      emit();
    },
    setMissingPackages(missingPackages) {
      state.missingPackages = uniqueStrings(Array.isArray(missingPackages) ? missingPackages : []);
      emit();
    },
    push(message) {
      const normalized = stripAnsiCodes(message).trim();
      if (!normalized) {
        return;
      }

      if (state.messages[state.messages.length - 1] !== normalized) {
        state.messages.push(normalized);
        if (state.messages.length > 80) {
          state.messages = state.messages.slice(-80);
        }
      }

      state.currentStep = normalized;
      if (typeof onMessage === 'function') {
        onMessage(normalized);
      }
      emit();
    },
  };
}

module.exports = {
  buildSpawnCommandSpec,
  buildSpawnCloseResult,
  buildSpawnErrorResult,
  buildPowerShellEncodedCommand,
  createInstallProgressReporter,
  createLineReporter,
  formatSpawnFailure,
  parseJsonFromCommandOutput,
  pushOptionalRunnerArg,
  splitOutputLines,
  stripAnsiCodes,
  takeTail,
};
