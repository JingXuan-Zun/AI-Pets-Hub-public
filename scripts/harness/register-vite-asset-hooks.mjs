// Registers vite-asset-hooks.mjs (see there).
import { register } from 'node:module';

register('./vite-asset-hooks.mjs', import.meta.url);
