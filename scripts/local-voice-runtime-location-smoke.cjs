// The portable exe installed its voice environment from Downloads, then was moved: the remembered folder is still found, and pip cache/temp stay inside the runtime.
const fs = require('fs'); const os = require('os'); const path = require('path'); const assert = require('assert');
const utils = require(path.resolve(__dirname, '../electron/localVoiceRuntimePathUtils.cjs'));
const host = require(path.resolve(__dirname, '../electron/localVoiceRuntimeHostUtils.cjs'));
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vrt-'));
const userData = path.join(base, 'userData');
const app = { isPackaged: true, getPath: () => userData };
const downloads = path.join(base, 'Downloads'); const moved = path.join(base, 'D', 'Games', 'Pet');
fs.mkdirSync(downloads, { recursive: true }); fs.mkdirSync(moved, { recursive: true });
process.env.PORTABLE_EXECUTABLE_DIR = downloads;
const first = utils.resolveRuntimeRoot({ app });
fs.mkdirSync(path.join(first, "venv-stt"), { recursive: true }); utils.resolveRuntimeRoot({ app }); // restart after install
assert.strictEqual(first, path.join(downloads, 'python', 'local-voice-runtime'));
fs.mkdirSync(path.join(first, 'venv-stt'), { recursive: true }); // install happens
process.env.PORTABLE_EXECUTABLE_DIR = moved; // exe moved
assert.strictEqual(utils.resolveRuntimeRoot({ app }), first, 'moved exe should find remembered install');
fs.mkdirSync(path.join(moved, 'python', 'local-voice-runtime', 'venv-tts'), { recursive: true });
assert.strictEqual(utils.resolveRuntimeRoot({ app }), path.join(moved, 'python', 'local-voice-runtime'), 'nearby install wins');
const env = host.createPythonEnv(first);
assert.ok(env.PIP_CACHE_DIR.startsWith(first) && env.TMP.startsWith(first) && fs.existsSync(env.TEMP));
assert.ok(!host.createPythonEnv().PIP_CACHE_DIR);
fs.rmSync(base, { recursive: true, force: true });
console.log('local voice runtime location smoke passed');
