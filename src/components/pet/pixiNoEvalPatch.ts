import { install } from '@pixi/unsafe-eval';
import { ShaderSystem } from 'pixi.js';

// Pixi 6 builds its uniform-upload code with `new Function`, which the app's
// Content-Security-Policy forbids. This official patch swaps in the plain version.
// Import this module (for its side effect) before creating any pixi Application.
install({ ShaderSystem });
