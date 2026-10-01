$ErrorActionPreference = 'Stop'
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + [System.IO.Path]::PathSeparator + $env:PSModulePath
$certificatePath = Join-Path $PSScriptRoot 'lan-server.cer'
$certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($certificatePath)
if ($certificate.Subject -ne 'CN=Desktop Pet LAN Sharing' -or $certificate.HasPrivateKey -or $certificate.NotAfter -lt (Get-Date)) {
  throw 'Invalid or expired LAN sharing certificate.'
}
Write-Host 'This will trust your own LAN sharing server for the current Windows user.'
Write-Host ('Certificate file SHA-256: ' + (Get-FileHash -LiteralPath $certificatePath -Algorithm SHA256).Hash)
Write-Host 'Compare this hash with the value shown on your server computer.'
if ((Read-Host 'Type TRUST after confirming the hash matches') -cne 'TRUST') { throw 'Certificate trust cancelled.' }
Import-Certificate -FilePath $certificatePath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
Write-Host ('Certificate trusted. Restart the desktop pet. Removal thumbprint: ' + $certificate.Thumbprint)
