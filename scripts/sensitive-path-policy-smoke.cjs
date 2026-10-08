const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSensitivePathPolicy } = require('../electron/sensitivePathPolicy.cjs');
const { createLocalFileSystemService } = require('../electron/localFileSystemService.cjs');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-sensitive-'));
const home = path.join(root, 'home');
const userData = path.join(root, 'AppData', 'Roaming', 'ai-pets-hub');

function write(relativePath, text = 'secret') {
  const target = path.join(home, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  return target;
}

try {
  const policy = createSensitivePathPolicy({ extraRoots: [userData] });
  const sensitive = [
    write('.ssh/id_ed25519'),
    write('.ssh/config'),
    write('.aws/credentials'),
    write('.git-credentials'),
    write('project/.env'),
    write('project/.env.local'),
    write('certs/server.pem'),
    write('certs/client.PFX'),
    write('AppData/Local/Google/Chrome/User Data/Default/Login Data'),
    path.join(userData, 'persisted-config.json'),
  ];
  for (const target of sensitive) assert.equal(policy.isSensitivePath(target), true, target);

  const ordinary = [
    write('project/.env.example'),
    write('project/README.md'),
    write('Documents/sshnotes.txt'),
    write('Pictures/key-art.png'),
  ];
  for (const target of ordinary) assert.equal(policy.isSensitivePath(target), false, target);

  // A junction from an ordinary folder into .ssh must not hide the key.
  const linkDirectory = path.join(home, 'Desktop', 'shortcut-folder');
  fs.mkdirSync(path.dirname(linkDirectory), { recursive: true });
  fs.symlinkSync(path.join(home, '.ssh'), linkDirectory, 'junction');
  assert.equal(policy.isSensitivePath(path.join(linkDirectory, 'config')), true, 'junction into .ssh');

  const service = createLocalFileSystemService({ protectedRoots: [userData] });
  const blockedRead = service.readTextFile({ path: path.join(home, '.ssh', 'config') });
  assert.equal(blockedRead.ok, false);
  assert.equal(blockedRead.reason, 'sensitive-path');
  assert.equal('text' in blockedRead, false);
  assert.equal(service.readTextFile({ path: path.join(linkDirectory, 'config') }).reason, 'sensitive-path');
  assert.equal(service.readTextFile({ path: ordinary[1] }).text, 'secret');

  (async () => {
    const copyOut = await service.executeFileManagementAction({
      action: 'copy',
      destinationDirectory: path.join(home, 'Documents'),
      sourcePath: path.join(home, '.ssh', 'id_ed25519'),
    });
    assert.equal(copyOut.ok, false);
    assert.equal(copyOut.reason, 'sensitive-path');
    assert.equal(fs.existsSync(path.join(home, 'Documents', 'id_ed25519')), false);

    const plantKey = write('Downloads/authorized_keys', 'ssh-ed25519 AAAA attacker');
    const copyIn = await service.executeFileManagementAction({
      action: 'copy',
      destinationDirectory: path.join(home, '.ssh'),
      sourcePath: plantKey,
    });
    assert.equal(copyIn.reason, 'sensitive-path', 'writing into .ssh is blocked');
    assert.equal(fs.existsSync(path.join(home, '.ssh', 'authorized_keys')), false);

    const ordinaryCopy = await service.executeFileManagementAction({
      action: 'copy',
      destinationDirectory: path.join(home, 'Documents'),
      sourcePath: ordinary[1],
    });
    assert.equal(ordinaryCopy.ok, true, JSON.stringify(ordinaryCopy));

    fs.rmSync(root, { recursive: true, force: true });
    console.log('sensitive path policy smoke passed');
  })().catch((error) => {
    fs.rmSync(root, { recursive: true, force: true });
    console.error(error);
    process.exitCode = 1;
  });
} catch (error) {
  fs.rmSync(root, { recursive: true, force: true });
  throw error;
}
