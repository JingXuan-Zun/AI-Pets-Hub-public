import { extractFile, listPackage } from '@electron/asar';

const asarPath = process.argv[2];
if (!asarPath) throw new Error('Usage: node scripts/verify-neural-graph-package.mjs <app.asar>');

const settingsEntry = listPackage(asarPath).find((value) => (
  /[\\/]dist[\\/]assets[\\/]SettingsNeuralPersonaGraphSection-[^\\/]+\.js$/u.test(value)
));
if (!settingsEntry) throw new Error('Neural persona graph chunk is missing from the package.');
const settingsChunk = settingsEntry.replace(/^[\\/]+/u, '').replaceAll('\\', '/');

const source = extractFile(asarPath, settingsEntry.replace(/^[\\/]+/u, '')).toString('utf8');
const checks = {
  pixiCanvas: source.includes('neuralGraphPixiCanvas'),
  rendererResize: source.includes('.resize('),
  resizeObserver: source.includes('ResizeObserver'),
};
if (Object.values(checks).some((value) => !value)) {
  throw new Error(`Neural graph package verification failed: ${JSON.stringify(checks)}`);
}

console.log(JSON.stringify({ checks, settingsChunk }, null, 2));
