const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PROFILE_FILE_NAME = 'ai-pets-capability-lock.patch.yml';

function createProfilePatch(pluginPath) {
  const pluginUrl = pathToFileURL(path.resolve(pluginPath)).href;
  return ['# AI-Pets-Hub owns permission and tool execution.', '- id: persistent-pwsh', '  disabled: true', '- id: str-replace-editor', '  disabled: true', '- insert:', '    - id: ai-pets-capability-bridge', `      name: ${JSON.stringify(pluginUrl)}`].join('\n');
}

function prepareDeepSeekHarnessCapabilityProfile({ dshHome, pluginPath }) {
  const profilePath = path.join(dshHome, PROFILE_FILE_NAME);
  fs.writeFileSync(profilePath, createProfilePatch(pluginPath), 'utf8');
  return profilePath;
}

module.exports = { prepareDeepSeekHarnessCapabilityProfile };
