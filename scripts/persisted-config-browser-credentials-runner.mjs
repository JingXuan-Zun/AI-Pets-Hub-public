import { build } from 'esbuild';
// Storage behavior does not depend on image contents or animation-frame discovery.
const result = await build({ entryPoints: ['scripts/persisted-config-browser-credentials-smoke.ts'],
  bundle: true, platform: 'node', format: 'esm', write: false,
  define: { 'import.meta.glob': '__testAssetGlob' },
  banner: { js: 'const __testAssetGlob = () => ({});' },
  plugins: [{ name: 'test-asset-urls', setup(builder) {
    builder.onLoad({ filter: /\.(png|svg)$/ }, ({ path }) => ({ contents: `export default ${JSON.stringify(path)};`, loader: 'js' }));
  } }],
});
try { await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')); }
catch (error) { console.error(error.message); process.exitCode = 1; }
