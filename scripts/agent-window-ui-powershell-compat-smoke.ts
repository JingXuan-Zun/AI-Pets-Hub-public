import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { source } = readProjectSources({
  source: 'electron/appLauncherService.cjs',
});

assert.match(
  source,
  /\[Console\]::OutputEncoding = \[System\.Text\.Encoding\]::UTF8/u,
  'PowerShell scripts should force UTF-8 stdout so Chinese errors stay readable.',
);
assert.match(
  source,
  /\$OutputEncoding = \[System\.Text\.Encoding\]::UTF8/u,
  'PowerShell scripts should force UTF-8 pipeline output.',
);
assert.match(
  source,
  /encoding: 'buffer'/u,
  'PowerShell stdout/stderr should be decoded explicitly instead of assuming UTF-8.',
);
assert.match(
  source,
  /new TextDecoder\('gb18030'\)/u,
  'PowerShell error decoding should fall back to the local Windows Chinese code page.',
);
assert.match(
  source,
  /'-OutputFormat', 'Text'/u,
  'PowerShell should use text output to avoid CLIXML-style stderr in the Agent UI.',
);

assert.doesNotMatch(
  source,
  /^\s*\|\s*(?:ForEach-Object|Where-Object|Sort-Object|Select-Object)\b/mu,
  'Generated UIA PowerShell must not start a new line with a pipeline command; Windows PowerShell 5.1 parses that as an error.',
);
assert.match(
  source,
  /\$windowMatches = @\(\$windows \| ForEach-Object/u,
  'Window match pipeline should stay on one PowerShell statement.',
);
assert.match(
  source,
  /\$scoredControls = @\(\$controls \| Where-Object/u,
  'Control match pipeline should stay on one PowerShell statement.',
);
assert.equal(
  source.includes('$targetWindow = @($windows | Where-Object { [int64]$_.hwnd -eq $requestedHwnd } | Select-Object -First 1)'),
  false,
  'UIA target window lookup should not wrap a missing match in an empty array that passes null checks.',
);
assert.equal(
  source.includes("$targetWindow = @($windowMatches | Sort-Object -Property @{ Expression = 'matchScore'; Descending = $true }, @{ Expression = 'topLevelOrder'; Ascending = $true } | Select-Object -First 1)"),
  false,
  'UIA query window lookup should keep missing matches as null instead of an empty array.',
);
assert.match(
  source,
  /\$null -eq \$targetHandle -or \$targetHandle -eq \[IntPtr\]::Zero/u,
  'UIA target handle guard should catch null and zero handles before FromHandle.',
);

console.log('agent window ui powershell compat smoke ok');
