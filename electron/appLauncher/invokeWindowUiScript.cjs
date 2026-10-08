const { createTopLevelWindowEnumeratorPowerShell } = require('./topLevelWindowEnumeratorPowerShell.cjs');
const { windowUiInvokeMatchingScript } = require('./windowUiInvokeMatchingScript.cjs');
const { windowUiInvokeActionPatternsScript } = require('./windowUiInvokeActionPatternsScript.cjs');
const { windowUiInvokeControlScoringScript } = require('./windowUiInvokeControlScoringScript.cjs');
const { windowUiInvokeTraversalScript } = require('./windowUiInvokeTraversalScript.cjs');

function createInvokeWindowUiScript({ payloadBase64 }) {
  return [
    String.raw`
$ErrorActionPreference = 'Stop'
`,
    String.raw`${createTopLevelWindowEnumeratorPowerShell()}`,
    String.raw`

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName WindowsBase

$requestJson = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('`,
    String.raw`${payloadBase64}`,
    windowUiInvokeMatchingScript,
    windowUiInvokeActionPatternsScript,
    windowUiInvokeControlScoringScript,
    windowUiInvokeTraversalScript,
  ].join('');
}

module.exports = { createInvokeWindowUiScript };
