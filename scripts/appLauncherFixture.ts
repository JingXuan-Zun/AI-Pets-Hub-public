import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';

// Apply fixtures throughout the local module graph so extraction does not let
// nested dependencies fall through to real registry, process or memory actions.
export function loadAppLauncherFixture(overrides: Record<string, unknown>, globals: Record<string, unknown> = {}, entrySource?: string) {
  const cache = new Map<string, { exports: any }>();
  const directory = path.resolve('electron');
  function load(file: string): any {
    const cached = cache.get(file);
    if (cached) return cached.exports;
    const module = { exports: {} as any };
    cache.set(file, module);
    const realRequire = createRequire(file);
    vm.runInNewContext(entrySource && file === path.join(directory, 'appLauncherService.cjs') ? entrySource : readFileSync(file, 'utf8'), {
      module, exports: module.exports, __dirname: path.dirname(file), __filename: file,
      Buffer, process, console, Error, URL, setTimeout, clearTimeout, ...globals,
      require: (specifier: string) => {
        const key = path.basename(specifier);
        if (Object.hasOwn(overrides, key)) return overrides[key];
        if (specifier === 'electron') return { shell: {} };
        if (!specifier.startsWith('.')) return realRequire(specifier);
        const target = realRequire.resolve(specifier);
        return target.startsWith(directory + path.sep) && target.endsWith('.cjs')
          ? load(target) : realRequire(specifier);
      },
    }, { filename: file });
    return module.exports;
  }
  return load(path.join(directory, 'appLauncherService.cjs'));
}
