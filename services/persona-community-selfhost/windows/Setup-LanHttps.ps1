param([string]$Address)
$ErrorActionPreference = 'Stop'
# Prefer this Windows PowerShell installation's modules when launched from PowerShell 7.
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + [System.IO.Path]::PathSeparator + $env:PSModulePath
$serverDirectory = $PSScriptRoot
$certificateDirectory = Join-Path $serverDirectory 'certificates'
if (Test-Path -LiteralPath $certificateDirectory) { throw 'Certificates already exist. Preserve them; do not overwrite an active deployment.' }
if (-not $Address) {
  $addresses = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.AddressState -eq 'Preferred' -and ($_.IPAddress -match '^192\.168\.' -or $_.IPAddress -match '^10\.' -or $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[01])\.')
  } | Select-Object -ExpandProperty IPAddress -Unique)
  if ($addresses.Count -eq 1) { $Address = $addresses[0] }
  else { Write-Host ('Detected private addresses: ' + ($addresses -join ', ')); $Address = Read-Host 'Enter this server computer LAN IPv4 address' }
}
$parsedAddress = $null
if (-not [System.Net.IPAddress]::TryParse($Address, [ref]$parsedAddress) -or
  $parsedAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
  -not ($Address -match '^192\.168\.' -or $Address -match '^10\.' -or $Address -match '^172\.(1[6-9]|2[0-9]|3[01])\.')) {
  throw 'Enter a private LAN IPv4 address.'
}
New-Item -ItemType Directory -Path $certificateDirectory | Out-Null
$ownerSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $certificateDirectory /inheritance:r /grant:r "*$($ownerSid):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Unable to restrict certificate directory permissions.' }
$random = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($random) } finally { $rng.Dispose() }
$password = [Convert]::ToBase64String($random)
$securePassword = ConvertTo-SecureString $password -AsPlainText -Force
$certificate = $null
try {
  $certificate = New-SelfSignedCertificate -Type Custom -Subject 'CN=Desktop Pet LAN Sharing' `
    -CertStoreLocation 'Cert:\CurrentUser\My' -KeyAlgorithm RSA -KeyLength 2048 `
    -HashAlgorithm SHA256 -KeyExportPolicy Exportable -KeyUsage DigitalSignature,KeyEncipherment `
    -NotAfter (Get-Date).AddMonths(6) `
    -TextExtension @("2.5.29.17={text}DNS=localhost&IPAddress=127.0.0.1&IPAddress=$Address", '2.5.29.37={text}1.3.6.1.5.5.7.3.1')
  Export-PfxCertificate -Cert $certificate -FilePath (Join-Path $certificateDirectory 'server.pfx') `
    -Password $securePassword -CryptoAlgorithmOption AES256_SHA256 | Out-Null
  Export-Certificate -Cert $certificate -FilePath (Join-Path $serverDirectory 'lan-server.cer') | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $certificateDirectory 'password.txt'), $password)
} finally {
  if ($certificate) { Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($certificate.Thumbprint)" -DeleteKey }
}
$configuration = [ordered]@{
  host = '0.0.0.0'; port = 8787; uploadsEnabled = $true; dataDirectory = './data'
  tls = @{ pfx = './certificates/server.pfx'; passwordFile = './certificates/password.txt' }
}
[System.IO.File]::WriteAllText((Join-Path $serverDirectory 'server.config.json'), ($configuration | ConvertTo-Json -Depth 4))
[System.IO.File]::WriteAllText((Join-Path $serverDirectory 'SERVER-ADDRESS.txt'), "https://${Address}:8787")
Write-Host "LAN endpoint: https://${Address}:8787"
Write-Host 'Copy only lan-server.cer and Trust-LanCertificate.ps1 to client computers.'
Write-Host ('Certificate file SHA-256: ' + (Get-FileHash -LiteralPath (Join-Path $serverDirectory 'lan-server.cer') -Algorithm SHA256).Hash)
Write-Host 'Do not copy certificates/server.pfx, password.txt or data to clients.'
Write-Host 'If Windows asks for network access, allow Private networks only.'
