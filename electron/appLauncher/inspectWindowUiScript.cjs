const { createTopLevelWindowEnumeratorPowerShell } = require('./topLevelWindowEnumeratorPowerShell.cjs');
const { windowUiInspectMatchingScript } = require('./windowUiInspectMatchingScript.cjs');
const { windowUiInspectTraversalScript } = require('./windowUiInspectTraversalScript.cjs');

function createInspectWindowUiScript({ payloadBase64 }) {
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
    windowUiInspectMatchingScript,
    windowUiInspectTraversalScript,
  ].join('');
}

module.exports = { createInspectWindowUiScript };
