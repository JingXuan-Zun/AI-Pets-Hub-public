import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { removeEmptyBeginDialogDrafts } from '../src/components/settings/settingsPersonalityBeginDialogs';
import type { PetConfig } from '../src/types';

const emptyDialogDraft = { assistant: '', user: '' };
const configWithDraft = {
  personality: {
    beginDialogs: [emptyDialogDraft],
  },
  companionPets: [{ personality: { beginDialogs: [emptyDialogDraft] } }],
} as PetConfig;

const configForSave = removeEmptyBeginDialogDrafts({
  ...configWithDraft,
  personality: {
    ...configWithDraft.personality,
    beginDialogs: [emptyDialogDraft, { assistant: '', user: '保留这条' }],
  },
});

assert.deepEqual(
  configForSave.personality.beginDialogs,
  [{ assistant: '', user: '保留这条' }],
  'saving should remove only fully empty dialog drafts',
);
assert.deepEqual(
  configForSave.companionPets[0]?.personality.beginDialogs,
  [],
  'saving should remove fully empty companion dialog drafts too',
);

const normalizationSource = readFileSync('src/petConfigNormalization.ts', 'utf8');
assert.match(
  normalizationSource,
  /const beginDialogs = Array\.isArray\(input\?\.beginDialogs\)[\s\S]*?\.map\(\(dialog\) => \(\{[\s\S]*?\}\)\)\s*: fallback\.beginDialogs;/u,
  'normalization should retain an empty dialog draft until the user can type into it',
);
assert.doesNotMatch(
  normalizationSource,
  /\.filter\(\(dialog\) => dialog\.user\.trim\(\) \|\| dialog\.assistant\.trim\(\)\)/u,
  'normalization must not immediately discard a newly added empty dialog draft',
);

console.log('settings personality begin dialogs smoke passed');
