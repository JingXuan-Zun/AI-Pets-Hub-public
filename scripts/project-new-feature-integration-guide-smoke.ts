import { strict as assert } from 'node:assert';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  guide: guideSource,
  pluginRules: pluginRulesSource,
} = readProjectSources({
  guide: 'PROJECT_NEW_FEATURE_INTEGRATION_GUIDE.md',
  pluginRules: 'PROJECT_PLUGIN_MARKET_FUTURE_RULES.md',
});

assert.match(guideSource, /Current Baseline/u);
assert.match(guideSource, /official packaged read-only coverage is resolved or explicitly risk-accepted/u);
assert.match(guideSource, /40\/40/u);
assert.match(guideSource, /0\/2/u);
assert.match(guideSource, /Choose The Entry Seam/u);
assert.match(guideSource, /Use an Agent capability/u);
assert.match(guideSource, /Use a Skill/u);
assert.match(guideSource, /Use MCP/u);
assert.match(guideSource, /Use a runtime adapter/u);
assert.match(guideSource, /Use Settings only for configuration/u);
assert.match(guideSource, /File And Function Limits/u);
assert.match(guideSource, /300-line/u);
assert.match(guideSource, /50-line/u);
assert.match(guideSource, /Feature Mapping/u);
assert.match(guideSource, /Life companion/u);
assert.match(guideSource, /Role Skill performance/u);
assert.match(guideSource, /Game companion/u);
assert.match(guideSource, /Live commerce/u);
assert.match(guideSource, /Not A Plugin Market Yet/u);
assert.match(pluginRulesSource, /New product features should integrate through controlled capability, Skill, MCP, or runtime-adapter seams/u);

console.log('project new feature integration guide smoke passed');
