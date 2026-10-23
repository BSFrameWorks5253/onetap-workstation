[CmdletBinding()]
param(
    [string]$Subject = "CN=BSFramework.UniDesk",
    [string]$Password = "UniDesk2026!",
    [string]$OutputDir = "$PSScriptRoot\..\build"
)

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$pfxPath = Join-Path $OutputDir "unidesk_dev.pfx"
$cerPath = Join-Path $OutputDir "unidesk_dev.cer"

Write-Host "Creating Code Signing Certificate for: $Subject"

# Check if an existing cert with this subject exists in CurrentUser\My
$existing = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue | Where-Object { $_.Subject -eq $Subject } | Select-Object -First 1

if (-not $existing) {
    $existing = New-SelfSignedCertificate -Type CodeSigningCert -Subject $Subject -CertStoreLocation "Cert:\CurrentUser\My" -KeyUsage DigitalSignature -FriendlyName "Uni Desk Developer Certificate" -NotAfter (Get-Date).AddYears(5)
}

$secPwd = ConvertTo-SecureString -String $Password -Force -AsPlainText
Export-PfxCertificate -Cert $existing -FilePath $pfxPath -Password $secPwd | Out-Null
Export-Certificate -Cert $existing -FilePath $cerPath | Out-Null

# Also install into CurrentUser\TrustedPeople store so Windows automatically trusts it on this machine
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPeople", "CurrentUser")
$store.Open("ReadWrite")
$store.Add($existing)
$store.Close()

Write-Host "Successfully exported and installed certificate to CurrentUser\TrustedPeople"
Write-Host "PFX: $pfxPath"
Write-Host "CER: $cerPath"
