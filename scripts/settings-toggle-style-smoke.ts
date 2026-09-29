import assert from 'node:assert/strict';
import { toggleButtonClass } from '../src/components/settings/settingsVoiceUtils';

const enabledClassName = toggleButtonClass(true);
const disabledClassName = toggleButtonClass(false);

assert.match(
  enabledClassName,
  /border-primary/,
  'enabled toggles should use the primary border',
);
assert.match(
  enabledClassName,
  /bg-primary\/10/,
  'enabled toggles should light up with the primary background',
);
assert.match(
  enabledClassName,
  /text-primary/,
  'enabled toggles should use the primary text color',
);
assert.doesNotMatch(
  disabledClassName,
  /bg-primary\/10/,
  'disabled toggles should not use the primary lit background',
);
assert.match(
  disabledClassName,
  /text-muted-foreground/,
  'disabled toggles should use muted text',
);

console.log('settings toggle style smoke ok');
