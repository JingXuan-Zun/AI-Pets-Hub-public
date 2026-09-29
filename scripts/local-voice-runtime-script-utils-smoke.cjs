const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  withTemporaryPythonScript,
} = require('../electron/localVoiceRuntimeScriptUtils.cjs');

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-script-utils-'));
  let seenScriptPath = null;

  try {
    const result = await withTemporaryPythonScript({
      cwd: tempRoot,
      execute: async (scriptPath) => {
        seenScriptPath = scriptPath;
        if (!fs.existsSync(scriptPath)) {
          throw new Error('temporary_script_missing_during_execution');
        }

        const content = fs.readFileSync(scriptPath, 'utf8');
        if (!content.includes('print')) {
          throw new Error('temporary_script_content_mismatch');
        }

        return { scriptPath };
      },
      scriptContent: "print('smoke')\n",
    });

    if (result.scriptPath !== seenScriptPath) {
      throw new Error('temporary_script_result_path_mismatch');
    }

    if (!seenScriptPath || fs.existsSync(seenScriptPath)) {
      throw new Error('temporary_script_not_cleaned_up');
    }

    console.log('localVoiceRuntime script utils smoke ok');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
