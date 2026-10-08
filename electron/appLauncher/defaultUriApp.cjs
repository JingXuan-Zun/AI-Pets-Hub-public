

function createDefaultUriAppLookup({ runPowerShellScript }) {
  function normalizeUriScheme(value) {
    return String(value || 'https')
      .trim()
      .replace(/:.*$/u, '')
      .toLowerCase()
      .replace(/[^a-z0-9.+-]/gu, '') || 'https';
  }

  function inferDefaultAppNameFromProgId(progId, command) {
    const text = `${progId || ''} ${command || ''}`.toLowerCase();
    if (text.includes('chrome')) {
      return 'Google Chrome';
    }

    if (text.includes('msedge') || text.includes('microsoft-edge') || text.includes('edge')) {
      return 'Microsoft Edge';
    }

    if (text.includes('firefox')) {
      return 'Firefox';
    }

    if (text.includes('brave')) {
      return 'Brave';
    }

    if (text.includes('opera')) {
      return 'Opera';
    }

    return progId || '';
  }

  function extractExecutablePathFromCommand(command) {
    const text = String(command || '').trim();
    if (!text) {
      return '';
    }

    const quotedMatch = text.match(/"([^"]+\.exe)"/iu);
    if (quotedMatch?.[1]) {
      return quotedMatch[1];
    }

    const bareMatch = text.match(/^([^\s]+\.exe)(?:\s|$)/iu);
    return bareMatch?.[1] || '';
  }

  async function getDefaultAppForUri(request = {}) {
    const uriScheme = normalizeUriScheme(request?.uriScheme || request?.scheme || request?.protocol);
    if (process.platform !== 'win32') {
      return {
        ok: false,
        error: 'Default URI app lookup is currently only implemented on Windows.',
        uriScheme,
      };
    }

    const script = String.raw`
$ErrorActionPreference = 'Stop'
$scheme = @'
${JSON.stringify(uriScheme)}
'@ | ConvertFrom-Json
$progId = ''
$command = ''
try {
  $userChoice = Get-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\$scheme\UserChoice" -ErrorAction Stop
  $progId = [string]$userChoice.ProgId
} catch {
  $progId = ''
}

if (-not [string]::IsNullOrWhiteSpace($progId)) {
  try {
    $commandKey = Get-Item -Path "Registry::HKEY_CLASSES_ROOT\$progId\shell\open\command" -ErrorAction Stop
    $command = [string]$commandKey.GetValue('')
  } catch {
    $command = ''
  }
}

@{
  ok = -not [string]::IsNullOrWhiteSpace($progId)
  uriScheme = $scheme
  progId = $progId
  command = $command
} | ConvertTo-Json -Depth 4 -Compress
`;

    try {
      const stdout = await runPowerShellScript(script, 1800);
      const parsed = JSON.parse(String(stdout || '{}').trim() || '{}');
      const command = typeof parsed?.command === 'string' ? parsed.command : '';
      const progId = typeof parsed?.progId === 'string' ? parsed.progId : '';
      const executablePath = extractExecutablePathFromCommand(command);
      return {
        ok: Boolean(parsed?.ok),
        appName: inferDefaultAppNameFromProgId(progId, command),
        command,
        executablePath,
        progId,
        uriScheme,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        uriScheme,
      };
    }
  }

  return { getDefaultAppForUri };
}

module.exports = { createDefaultUriAppLookup };
