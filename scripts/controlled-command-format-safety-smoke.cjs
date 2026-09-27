const assert = require('node:assert/strict');
const { validateCommand } = require('../electron/controlledCommandService.cjs');

assert.equal(validateCommand('(Invoke-WebRequest -UseBasicParsing "https://wttr.in/Beijing?format=3").Content').ok, true);
assert.equal(validateCommand('format c: /q').ok, false);
assert.equal(validateCommand('cmd /c format c: /q').ok, false);
assert.equal(validateCommand('format.com c: /q').ok, false);
assert.equal(validateCommand('Write-Output "format this response"').ok, true);

console.log('controlled command format safety smoke ok');
