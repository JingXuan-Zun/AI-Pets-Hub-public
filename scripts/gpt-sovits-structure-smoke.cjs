const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');

// Budgets: <=300 lines per file, <=50 per function, production deps limited to voice-sidecar modules.
const root = require.resolve('../electron/gptSovitsService.cjs');
const visited = new Set();
let functions = 0;
function inspect(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, 99, true);
  assert.ok(source.split('\n').length <= 300, `${path.basename(file)} source budget`);
  (function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      functions++;
      const lines = tree.getLineAndCharacterOfPosition(node.end).line - tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      assert.ok(lines <= 50, `${path.basename(file)}:${node.name?.getText(tree) ?? 'callback'} function budget ${lines}`);
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'require'
      && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.startsWith('./')) {
      const dependency = path.resolve(path.dirname(file), node.arguments[0].text);
      if (path.basename(dependency).startsWith('gptSovits')) inspect(dependency);
      else assert.ok(/^(browserTts|localVoice)/.test(path.basename(dependency)), `Review new production dependency ${dependency}`);
    }
    ts.forEachChild(node, visit);
  })(tree);
}
inspect(root);
assert.deepEqual(Object.keys(require(root)), ['createGptSovitsService']);
const serviceKeys = Object.keys(require(root).createGptSovitsService({ projectRoot: path.resolve(__dirname, '..') }));
assert.deepEqual(serviceKeys.sort(), ['dispose', 'ensureStarted', 'getHealth', 'installRuntime', 'listModels']);

// Server script: pure helpers run without torch via the bundled or system Python.
const serverPath = path.resolve(__dirname, '../electron/gpt_sovits_server.py');
assert.ok(fs.readFileSync(serverPath, 'utf8').split('\n').length <= 300, 'server script budget');
const pythonCandidates = [path.resolve(__dirname, '../python/python.exe'), 'python', 'py'];
const python = pythonCandidates.find((candidate) => spawnSync(candidate, ['--version']).status === 0);
assert.ok(python, 'python available for server helper checks');
const installScriptPath = path.resolve(__dirname, '../electron/gpt_sovits_install.py');
assert.ok(fs.readFileSync(installScriptPath, 'utf8').split('\n').length <= 300, 'install script budget');
const compiled = spawnSync(python, ['-m', 'py_compile', installScriptPath], { encoding: 'utf8' });
assert.equal(compiled.status, 0, compiled.stderr);
const script = `
import importlib.util, json, os, sys, tempfile
sys.path.insert(0, os.path.dirname(${JSON.stringify(serverPath)}))
spec = importlib.util.spec_from_file_location("srv", ${JSON.stringify(serverPath)})
srv = importlib.util.module_from_spec(spec); spec.loader.exec_module(srv)
out = {}
out["judge"] = [srv.judge_audio(0, 32000, "你好"), srv.judge_audio(3200, 32000, "你好呀今天过得怎么样"),
  srv.judge_audio(32000 * 2, 32000, "你好呀今天过得怎么样"), srv.judge_audio(32000 * 30, 32000, "你好"),
  srv.judge_audio(32000, 0, "x")]
root = tempfile.mkdtemp()
os.makedirs(os.path.join(root, "m", "refs"))
for name in ["g.ckpt", "s.pth", "refs/n.wav"]: open(os.path.join(root, "m", name), "w").write("x")
def manifest(**patch):
    data = {"version": "v2ProPlus", "gpt": "g.ckpt", "sovits": "s.pth", "emotions": {"neutral": {"wav": "refs/n.wav", "text": "你好"}}}
    data.update(patch); json.dump(data, open(os.path.join(root, "m", "manifest.json"), "w", encoding="utf-8"))
def load(model_id="m"):
    try: return sorted(srv.load_manifest(root, model_id, root)["emotions"])
    except ValueError as error: return str(error)
manifest(); out["ok"] = load()
manifest(gpt="../g.ckpt"); out["traversal"] = load()
manifest(emotions={"neutral": {"wav": "refs/n.wav", "text": "a"}, "sad": {"wav": "refs/missing.wav", "text": "b"}}); out["missing_emotion_file"] = load()
out["bad_id"] = load("../m"); out["unknown"] = load("nope")
print(json.dumps(out))
`;
const result = spawnSync(python, ['-c', script], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
assert.equal(result.status, 0, result.stderr);
assert.deepEqual(JSON.parse(result.stdout.trim().split('\n').pop()), {
  judge: ['empty', 'short', 'ok', 'long', 'empty'],
  ok: ['neutral'],
  traversal: 'invalid_manifest',
  missing_emotion_file: ['neutral'],
  bad_id: 'invalid_model_id',
  unknown: 'model_not_found',
});
console.log(`GPT-SoVITS structure passed: ${visited.size} modules, ${functions} functions, server helpers ok`);
