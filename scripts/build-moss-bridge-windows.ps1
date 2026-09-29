param(
  [string]$ProjectRoot = "",
  [switch]$InstallTools,
  [switch]$UpdateLlama,
  [string]$Msys2Root = "",
  [string]$LlamaRepo = "https://github.com/OpenMOSS/llama.cpp.git",
  [string]$LlamaBranch = "moss-tts-firstclass"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-ExistingPathOrEmpty([string]$PathValue) {
  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return ""
  }
  try {
    return (Resolve-Path -LiteralPath $PathValue -ErrorAction Stop).Path
  } catch {
    return ""
  }
}

function Convert-ToMsysPath([string]$WindowsPath) {
  $fullPath = [System.IO.Path]::GetFullPath($WindowsPath)
  $drive = $fullPath.Substring(0, 1).ToLowerInvariant()
  $rest = $fullPath.Substring(2).Replace("\", "/")
  return "/$drive$rest"
}

function Quote-Bash([string]$Value) {
  return "'" + $Value.Replace("'", "'\''") + "'"
}

function Find-Msys2Root([string]$PreferredRoot) {
  $candidates = @(
    $PreferredRoot,
    $env:MSYS2_ROOT,
    "C:\msys64",
    "C:\msys2"
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

  foreach ($candidate in $candidates) {
    $shellPath = Join-Path $candidate "msys2_shell.cmd"
    if (Test-Path -LiteralPath $shellPath) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }

  return ""
}

function Invoke-Msys2Command([string]$Root, [string]$Command, [string]$WorkingDirectory) {
  $shellPath = Join-Path $Root "msys2_shell.cmd"
  Push-Location -LiteralPath $WorkingDirectory
  try {
    & $shellPath -defterm -no-start -ucrt64 -here -c $Command
    if ($LASTEXITCODE -ne 0) {
      throw "MSYS2 command failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
  $ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
} else {
  $ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
}

$voiceRoot = Join-Path $ProjectRoot "local-models\voice"
$mossCodeRoot = Join-Path $voiceRoot "MOSS-TTS"
$bridgeDir = Join-Path $mossCodeRoot "moss_tts_delay\llama_cpp"
$bridgeSource = Join-Path $bridgeDir "backbone_bridge.c"
$bridgeDll = Join-Path $bridgeDir "backbone_bridge.dll"
$llamaDir = Join-Path $voiceRoot "llama.cpp"
$workDir = Join-Path $ProjectRoot ".moss-bridge-build"
$bashScript = Join-Path $workDir "build-moss-bridge.sh"

Write-Step "Checking MOSS-TTS paths"
if (-not (Test-Path -LiteralPath $bridgeSource)) {
  throw "Missing bridge source: $bridgeSource"
}

New-Item -ItemType Directory -Force -Path $workDir | Out-Null

$resolvedMsys2Root = Find-Msys2Root $Msys2Root
if (-not $resolvedMsys2Root) {
  if ($InstallTools) {
    Write-Step "Installing MSYS2 with winget"
    & winget install --id MSYS2.MSYS2 -e --source winget
    if ($LASTEXITCODE -ne 0) {
      throw "winget failed to install MSYS2. Install MSYS2 manually from https://www.msys2.org/ and rerun this script."
    }
    $resolvedMsys2Root = Find-Msys2Root $Msys2Root
  }

  if (-not $resolvedMsys2Root) {
    Write-Host ""
    Write-Host "MSYS2 was not found." -ForegroundColor Yellow
    Write-Host "Install it from https://www.msys2.org/ or run:"
    Write-Host "  winget install --id MSYS2.MSYS2 -e --source winget"
    Write-Host ""
    Write-Host "Then rerun:"
    Write-Host "  npm run moss:bridge"
    exit 1
  }
}

Write-Host "MSYS2: $resolvedMsys2Root"

if ($InstallTools) {
  Write-Step "Installing MSYS2 build tools"
  Invoke-Msys2Command `
    -Root $resolvedMsys2Root `
    -WorkingDirectory $ProjectRoot `
    -Command "pacman -Sy --needed --noconfirm git mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-cmake mingw-w64-ucrt-x86_64-ninja"
}

$projectRootMsys = Convert-ToMsysPath $ProjectRoot
$llamaDirMsys = Convert-ToMsysPath $llamaDir
$bridgeDirMsys = Convert-ToMsysPath $bridgeDir
$repoQuoted = Quote-Bash $LlamaRepo
$branchQuoted = Quote-Bash $LlamaBranch
$updateFlag = if ($UpdateLlama) { "1" } else { "0" }

$bashContent = @"
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT=$(Quote-Bash $projectRootMsys)
LLAMA_DIR=$(Quote-Bash $llamaDirMsys)
BRIDGE_DIR=$(Quote-Bash $bridgeDirMsys)
LLAMA_REPO=$repoQuoted
LLAMA_BRANCH=$branchQuoted
UPDATE_LLAMA="$updateFlag"

echo "Project root: `$PROJECT_ROOT"
echo "llama.cpp:    `$LLAMA_DIR"
echo "Bridge dir:   `$BRIDGE_DIR"
echo ""

missing_tools=()
for tool in git cmake ninja gcc; do
  if ! command -v "`$tool" >/dev/null 2>&1; then
    missing_tools+=("`$tool")
  fi
done

if [ "`${#missing_tools[@]}" -gt 0 ]; then
  echo "Missing MSYS2 tools: `${missing_tools[*]}" >&2
  echo "Run this once:" >&2
  echo "  npm run moss:bridge -- -InstallTools" >&2
  exit 2
fi

mkdir -p "`$(dirname "`$LLAMA_DIR")"

if [ ! -d "`$LLAMA_DIR/.git" ]; then
  echo "Cloning OpenMOSS llama.cpp..."
  git clone -b "`$LLAMA_BRANCH" "`$LLAMA_REPO" "`$LLAMA_DIR"
elif [ "`$UPDATE_LLAMA" = "1" ]; then
  echo "Updating existing llama.cpp checkout..."
  git -C "`$LLAMA_DIR" fetch origin "`$LLAMA_BRANCH"
  git -C "`$LLAMA_DIR" checkout "`$LLAMA_BRANCH"
  git -C "`$LLAMA_DIR" pull --ff-only origin "`$LLAMA_BRANCH"
else
  echo "Using existing llama.cpp checkout. Pass -UpdateLlama to update it."
fi

echo ""
echo "Configuring llama.cpp..."
cmake -S "`$LLAMA_DIR" -B "`$LLAMA_DIR/build" -G Ninja -DBUILD_SHARED_LIBS=ON -DCMAKE_BUILD_TYPE=Release

echo ""
echo "Building llama.cpp..."
cmake --build "`$LLAMA_DIR/build" --config Release -j"`$(nproc)"

LIB_MARKER="`$(find "`$LLAMA_DIR/build" \
  \( -name 'libllama.dll.a' -o -name 'libllama.a' -o -name 'llama.dll' -o -name 'libllama.dll' \) \
  -print -quit)"

if [ -z "`$LIB_MARKER" ]; then
  echo "Could not find llama.cpp library output under `$LLAMA_DIR/build" >&2
  exit 3
fi

LIB_DIR="`$(dirname "`$LIB_MARKER")"
echo "llama library dir: `$LIB_DIR"

echo ""
echo "Building backbone_bridge.dll..."
gcc -shared -O2 \
  -o "`$BRIDGE_DIR/backbone_bridge.dll" \
  "`$BRIDGE_DIR/backbone_bridge.c" \
  -I"`$LLAMA_DIR/include" \
  -I"`$LLAMA_DIR/ggml/include" \
  -L"`$LIB_DIR" \
  -lllama

echo ""
echo "Copying runtime DLL dependencies next to backbone_bridge.dll..."
for dll_dir in \
  "`$LLAMA_DIR/build/bin" \
  "`$LLAMA_DIR/build/src" \
  "`$LLAMA_DIR/build/ggml/src" \
  "`$LLAMA_DIR/build/ggml/src/ggml-cpu" \
  "`$LLAMA_DIR/build/ggml/src/ggml-cuda" \
  "/ucrt64/bin"; do
  if [ -d "`$dll_dir" ]; then
    find "`$dll_dir" -maxdepth 1 -type f \
      \( -name '*.dll' \) \
      -exec cp -u {} "`$BRIDGE_DIR/" \;
  fi
done

if [ ! -f "`$BRIDGE_DIR/backbone_bridge.dll" ]; then
  echo "backbone_bridge.dll was not created." >&2
  exit 4
fi

echo ""
echo "Created: `$BRIDGE_DIR/backbone_bridge.dll"
echo ""
echo "Dependency check:"
ldd "`$BRIDGE_DIR/backbone_bridge.dll" || true
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($bashScript, $bashContent.Replace("`r`n", "`n"), $utf8NoBom)

Write-Step "Building MOSS bridge"
Invoke-Msys2Command `
  -Root $resolvedMsys2Root `
  -WorkingDirectory $ProjectRoot `
  -Command ("bash " + (Quote-Bash (Convert-ToMsysPath $bashScript)))

Write-Step "Verifying output"
if (-not (Test-Path -LiteralPath $bridgeDll)) {
  throw "Build finished but backbone_bridge.dll is still missing: $bridgeDll"
}

Write-Host "OK: $bridgeDll" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: reopen the app or click the local voice recheck button, then try MOSS TTS again."
