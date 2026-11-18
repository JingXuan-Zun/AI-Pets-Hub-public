import { strict as assert } from 'node:assert';
import { readProjectSources } from './smokeTestHarness.ts';

const { desktopInputRootSource, mousePreflightSource, mousePositionSource, mouseClickSource, mouseTouchSource, mouseResultSource, mousePreparationSource, nativeInteropSource, } = readProjectSources({
  desktopInputRootSource: 'electron/desktopInputService.cjs',
  mousePreflightSource: 'electron/desktopInputMousePreflight.cjs',
  mousePositionSource: 'electron/desktopInputMousePosition.cjs',
  mouseClickSource: 'electron/desktopInputMouseClick.cjs',
  mouseTouchSource: 'electron/desktopInputMouseTouch.cjs',
  mouseResultSource: 'electron/desktopInputMouseResult.cjs',
  mousePreparationSource: 'electron/desktopInputMousePreparation.cjs',
  nativeInteropSource: 'electron/desktopInputNativeInterop.cjs',
});
const desktopInputSource = [desktopInputRootSource, mousePreflightSource, mousePositionSource, mouseClickSource, mouseTouchSource, mouseResultSource].join('\n');

assert.match(
  mousePreparationSource,
  /forceTouchInjectionFallback = !isRight && !isMiddle && Boolean\(options\.forceTouchInjectionFallback\)/u,
  'mouse_event and touch injection diagnostics must be independently selectable.',
);
assert.doesNotMatch(
  mousePreparationSource,
  /forceTouchInjectionFallback \?\? options\.forceMouseEventFallback/u,
  'forcing mouse_event must not silently mix in touch injection.',
);

assert.match(
  desktopInputSource,
  /sendInputAttempts = @\(\)/u,
  'desktop input bridge should record per-click SendInput attempts.',
);
assert.match(
  desktopInputSource,
  /downLastError/u,
  'desktop input bridge should expose mouseDown GetLastError.',
);
assert.match(
  desktopInputSource,
  /upLastError/u,
  'desktop input bridge should expose mouseUp GetLastError.',
);
assert.match(
  desktopInputSource,
  /cursorBefore/u,
  'desktop input bridge should record cursor position before input.',
);
assert.match(
  desktopInputSource,
  /cursorAfter/u,
  'desktop input bridge should record cursor position after input.',
);
assert.match(
  nativeInteropSource,
  /CreateMouseInput\(uint flags\)/u,
  'desktop input bridge should construct mouse INPUT values in the C# helper so nested value-type fields are preserved.',
);
assert.doesNotMatch(
  desktopInputSource,
  /\$down\.mi\.dwFlags\s*=/u,
  'desktop input bridge must not mutate a copied nested MOUSEINPUT value from PowerShell.',
);
assert.doesNotMatch(
  desktopInputSource,
  /\$up\.mi\.dwFlags\s*=/u,
  'desktop input bridge must not mutate a copied nested MOUSEINPUT value from PowerShell.',
);
assert.match(
  desktopInputSource,
  /inputDiagnostics/u,
  'desktop input bridge should emit timing diagnostics.',
);
assert.match(
  desktopInputSource,
  /backendName = 'DesktopInputBackend'/u,
  'desktop input bridge should identify the DesktopInputBackend in diagnostics.',
);
assert.match(
  desktopInputSource,
  /\$inputPlan = @\('SetCursorPos', 'SendInputDownUp'\)/u,
  'desktop input bridge should expose a deterministic input backend plan.',
);
assert.match(
  desktopInputSource,
  /failureClassification/u,
  'desktop input bridge should classify input backend failures.',
);
assert.match(
  desktopInputSource,
  /KeyboardFallback/u,
  'desktop input bridge should support keyboard fallback diagnostics.',
);
assert.match(
  desktopInputSource,
  /foregroundBeforeDown/u,
  'desktop input bridge should record foreground before mouse down.',
);
assert.match(
  desktopInputSource,
  /foregroundAfterUp/u,
  'desktop input bridge should record foreground after mouse up.',
);
assert.match(
  desktopInputSource,
  /cursorBeforeDown/u,
  'desktop input bridge should record cursor before mouse down.',
);
assert.match(
  desktopInputSource,
  /cursorAfterUp/u,
  'desktop input bridge should record cursor after mouse up.',
);

console.log('desktop input diagnostics smoke ok');
