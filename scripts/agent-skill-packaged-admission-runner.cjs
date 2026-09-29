const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
}

function readLatestExecutable(projectRoot) {
  const latestInfo = fs.readFileSync(path.join(projectRoot, 'release', 'LATEST_BUILD.txt'), 'utf8');
  const latestBuildLine = latestInfo.split(/\r?\n/u).find((line) => line.startsWith('latest_build='));
  if (!latestBuildLine) throw new Error('release/LATEST_BUILD.txt does not contain latest_build.');
  return path.join(latestBuildLine.slice('latest_build='.length), 'win-unpacked', 'AI Desktop Pet.exe');
}

function runProcess(executablePath, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(executablePath, args, { stdio: 'inherit', windowsHide: true });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Packaged admission probe timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

async function run() {
  const projectRoot = path.resolve(__dirname, '..');
  const args = process.argv.slice(2);
  const executablePath = path.resolve(argumentValue(args, '--exe') || readLatestExecutable(projectRoot));
  const outputRoot = path.resolve(argumentValue(args, '--output-dir')
    || path.join(projectRoot, 'tmp', `external-skill-packaged-admission-${Date.now()}`));
  const reportPath = path.join(outputRoot, 'external-skill-packaged-admission-report.json');
  const runtimeLogRoot = path.join(outputRoot, 'runtime-logs');
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-packaged-admission-profile-'));
  fs.mkdirSync(outputRoot, { recursive: true });

  try {
    const result = await runProcess(executablePath, [
      '--desktop-pet-skill-packaged-admission-enable',
      '--desktop-pet-skill-packaged-admission-headless',
      `--desktop-pet-skill-packaged-admission-report=${reportPath}`,
      `--desktop-pet-skill-packaged-admission-user-data-dir=${profileRoot}`,
      `--desktop-pet-runtime-log-dir=${runtimeLogRoot}`,
    ], 30000);
    if (!fs.existsSync(reportPath)) {
      throw new Error(`Packaged process exited without writing the admission report (code ${result.code}, signal ${result.signal || 'none'}).`);
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    if (result.code !== 0 || report.ok !== true || report.runtime?.appIsPackaged !== true) {
      throw new Error(`Packaged admission probe failed: ${JSON.stringify({ exitCode: result.code, report })}`);
    }
    console.log(`External Skill packaged admission report: ${reportPath}`);
    console.log(JSON.stringify(report.summary));
  } finally {
    fs.rmSync(profileRoot, { force: true, recursive: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
