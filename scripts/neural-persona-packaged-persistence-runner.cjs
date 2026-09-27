const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : '';
}

function readLatestExecutable(projectRoot) {
  const info = fs.readFileSync(path.join(projectRoot, 'release', 'LATEST_BUILD.txt'), 'utf8');
  const line = info.split(/\r?\n/u).find((entry) => entry.startsWith('latest_build='));
  if (!line) throw new Error('release/LATEST_BUILD.txt does not contain latest_build.');
  return path.join(line.slice('latest_build='.length), 'win-unpacked', 'AI Desktop Pet.exe');
}

function runProcess(executablePath, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(executablePath, args, { stdio: 'inherit', windowsHide: true });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Neural persona packaged probe timed out after ${timeoutMs} ms.`));
    }, timeoutMs);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code, signal) => { clearTimeout(timeout); resolve({ code, signal }); });
  });
}

function readReport(reportPath, phase) {
  if (!fs.existsSync(reportPath)) throw new Error(`${phase} phase did not write a report.`);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  if (!report.ok || report.phase !== phase || !report.appIsPackaged) {
    throw new Error(`${phase} phase failed: ${JSON.stringify(report)}`);
  }
  return report;
}

async function runPhase(executablePath, profileRoot, outputRoot, phase) {
  const reportPath = path.join(outputRoot, `${phase}-report.json`);
  const result = await runProcess(executablePath, [
    '--desktop-pet-neural-persona-persistence-probe',
    `--desktop-pet-neural-persona-probe-phase=${phase}`,
    `--desktop-pet-neural-persona-probe-report=${reportPath}`,
    `--desktop-pet-neural-persona-probe-user-data-dir=${profileRoot}`,
  ], 30000);
  if (result.code !== 0) throw new Error(`${phase} phase exited with code ${result.code}.`);
  return readReport(reportPath, phase);
}

async function run() {
  const projectRoot = path.resolve(__dirname, '..');
  const executablePath = path.resolve(
    argumentValue(process.argv.slice(2), '--exe') || readLatestExecutable(projectRoot),
  );
  const outputRoot = path.join(projectRoot, 'tmp', `neural-persona-packaged-${Date.now()}`);
  const profileRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'neural-persona-packaged-profile-'));
  fs.mkdirSync(outputRoot, { recursive: true });
  try {
    const writeReport = await runPhase(executablePath, profileRoot, outputRoot, 'write');
    const readReportResult = await runPhase(executablePath, profileRoot, outputRoot, 'read');
    if (writeReport.userDataPath !== profileRoot || readReportResult.userDataPath !== profileRoot) {
      throw new Error('Packaged probe did not use the isolated profile.');
    }
    console.log(`neural persona packaged persistence probe ok: ${outputRoot}`);
  } finally {
    fs.rmSync(profileRoot, { force: true, recursive: true });
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
