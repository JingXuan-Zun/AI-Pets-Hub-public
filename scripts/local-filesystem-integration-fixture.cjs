const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function createFixture(pathApi, config = {}, baseline = null) {
  const root = pathApi === path.win32 ? 'C:\\文件夹' : '/文件夹';
  const at = (...parts) => pathApi.join(root, ...parts);
  const files = new Map();
  const trace = [];
  const descriptors = new Map();
  let nextFd = 0;
  const put = (target, kind, data = '') => files.set(target, { kind, data: Buffer.from(data) });
  put(root, 'directory');
  put(at('Desktop'), 'directory');
  put(at('Desktop', 'report.txt'), 'file', 'hello 中文');
  put(at('Desktop', 'photo.png'), 'file', Buffer.from([137, 80, 78, 71]));
  put(at('Desktop', '.hidden.txt'), 'file', 'hidden');
  put(at('Desktop', 'folder'), 'directory');
  put(at('Desktop', 'folder', 'nested.txt'), 'file', 'nested');
  put(at('private'), 'directory');
  put(at('private', 'secret.txt'), 'file', 'private content');
  put(at('.ssh'), 'directory');
  put(at('.ssh', 'id_rsa'), 'file', 'private key');
  put(at('alias.txt'), 'file', 'alias');
  const links = new Map([[at('alias.txt'), at('.ssh', 'id_rsa')], [at('linked-folder'), at('.ssh')]]);
  const fault = stage => { if (config.fault === stage) throw new Error(stage + ' failed'); };
  function node(target) {
    if (!files.has(target)) throw new Error('ENOENT: ' + target);
    return files.get(target);
  }
  function stat(target) {
    const item = node(target);
    return { size: item.data.length, birthtimeMs: 100, mtimeMs: 200,
      isDirectory: () => item.kind === 'directory', isFile: () => item.kind === 'file', isSymbolicLink: () => false };
  }
  function transfer(from, to, copy) {
    node(from);
    if (files.has(to)) throw new Error('EEXIST: ' + to);
    const moved = [...files].filter(([key]) => key === from || key.startsWith(from + pathApi.sep));
    for (const [key, value] of moved) files.set(to + key.slice(from.length), { ...value, data: Buffer.from(value.data) });
    if (!copy) for (const [key] of moved) files.delete(key);
  }
  const fakeFs = {
    constants: { COPYFILE_EXCL: 1 },
    statSync(target) { trace.push(['stat', target]); fault('stat'); return stat(target); },
    realpathSync: { native(target) {
      trace.push(['realpath', target]); fault('realpath');
      if (links.has(target)) return links.get(target);
      node(target); return target;
    } },
    readdirSync(target, options) {
      trace.push(['readdir', target, options]); fault('readdir');
      assert.equal(node(target).kind, 'directory');
      return [...files].filter(([key]) => key !== target && pathApi.dirname(key) === target)
        .map(([key, value]) => ({ name: pathApi.basename(key),
          isFile: () => value.kind === 'file', isDirectory: () => value.kind === 'directory' }));
    },
    openSync(target, flags) {
      trace.push(['open', target, flags]); fault('open'); node(target);
      const fd = nextFd++; descriptors.set(fd, target); return fd;
    },
    readSync(fd, buffer, offset, length, position) {
      trace.push(['read', fd, offset, length, position]); fault('read');
      return node(descriptors.get(fd)).data.copy(buffer, offset, position, position + length);
    },
    closeSync(fd) { trace.push(['close', fd]); descriptors.delete(fd); fault('close'); },
    readFileSync(target) { trace.push(['readFile', target]); fault('readFile'); return Buffer.from(node(target).data); },
    mkdirSync(target, options) {
      trace.push(['mkdir', target, options]); fault('mkdir');
      if (files.has(target)) {
        if (options.recursive && node(target).kind === 'directory') return;
        throw new Error('EEXIST: ' + target);
      }
      assert.equal(node(pathApi.dirname(target)).kind, 'directory'); put(target, 'directory');
    },
    renameSync(from, to) { trace.push(['rename', from, to]); fault('rename'); transfer(from, to, false); },
    copyFileSync(from, to, flags) {
      trace.push(['copyFile', from, to, flags]); assert.equal(flags, 1); fault('copy'); transfer(from, to, true);
    },
    cpSync(from, to, options) {
      trace.push(['cp', from, to, options]);
      assert.deepEqual(options, { recursive: true, errorOnExist: true, force: false });
      fault('copy'); transfer(from, to, true);
    },
  };
  const shell = { async trashItem(target) {
    assert.equal(this, shell); trace.push(['trash', target]); fault('trash');
    for (const key of [...files.keys()]) if (key === target || key.startsWith(target + pathApi.sep)) files.delete(key);
  } };
  const cache = new Map();
  const entry = path.resolve(__dirname, '../electron/localFileSystemService.cjs');
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const source = file === entry && baseline !== null ? baseline : fs.readFileSync(file, 'utf8');
    new Function('require', 'module', 'exports', source)(id => {
      if (id === 'fs') return fakeFs;
      if (id === 'path') return pathApi;
      if (id === 'os') return { homedir: () => root };
      assert.ok(id.startsWith('./'), 'Unexpected external dependency: ' + id);
      return load(path.resolve(path.dirname(file), id));
    }, module, module.exports);
    return module.exports;
  }
  const { createLocalFileSystemService } = load(entry);
  const logs = [[], []];
  const services = logs.map((log, index) => createLocalFileSystemService({
    protectedRoots: index === 0 ? [at('private')] : [],
    log: (action, result) => { trace.push(['log', index, action, result]); log.push([action, result]); },
  }));
  return { at, trace, files, descriptors, shell, services, logs, loaded: cache,
    snapshot: () => [...files].map(([key, value]) => [key, value.kind, value.data.toString('hex')]) };
}

module.exports = { createFixture };
