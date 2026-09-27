const { spawn } = require('child_process');

function parseJsonLine(output) {
  const lines = String(output || '').trim().split(/\r?\n/u).reverse();
  for (const line of lines) {
    try {
      const value = JSON.parse(line);
      if (value && typeof value === 'object') return value;
    } catch {}
  }
  return null;
}

function runDeepSeekHarnessProcess(options) {
  const child = spawn(options.command, [...options.commandArgs, options.runnerPath], {
    cwd: options.cwd,
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let cancelProcess = () => {};
  const promise = new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    timer = setTimeout(() => {
      child.kill();
      finish({ error: 'DeepSeek Harness task timed out after 300 seconds.', ok: false });
    }, options.timeoutMs);
    cancelProcess = () => {
      if (settled) return;
      child.kill();
      finish({ cancelled: true, error: 'DeepSeek Harness task cancelled.', ok: false });
    };
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      finish({ error: error instanceof Error ? error.message : String(error), ok: false });
    });
    child.on('close', (code) => {
      const payload = parseJsonLine(stdout);
      const finalResponse = payload?.finalResponse;
      finish(code === 0 && typeof finalResponse === 'string' && finalResponse.trim()
        ? { finalResponse: finalResponse.trim(), ok: true }
        : { error: payload?.error || stderr.trim() || `Harness exited with code ${code}.`, ok: false });
    });
    child.stdin.end(JSON.stringify({ goal: options.userGoal }));
  });
  promise.cancel = cancelProcess;
  return promise;
}

module.exports = { runDeepSeekHarnessProcess };
