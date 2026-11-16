[CmdletBinding()]
param(
    [string]$AppxPath = "",
    [string]$Password = "UniDesk2026!"
)

# 1. Locate Windows SDK signtool.exe
$sdkSignTool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
if (-not (Test-Path $sdkSignTool)) {
    $found = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like "*\x64\*" } | Select-Object -First 1
    if ($found) { $sdkSignTool = $found.FullName }
}

if (-not (Test-Path $sdkSignTool)) {
    Write-Host "[SignTool] Windows Kits signtool not found. Checking PATH..."
    $cmd = Get-Command signtool.exe -ErrorAction SilentlyContinue
    if ($cmd) { $sdkSignTool = $cmd.Source }
}

$pfxPath = Join-Path (Split-Path -Parent $PSScriptRoot) "build\unidesk_dev.pfx"
$cerPath = Join-Path (Split-Path -Parent $PSScriptRoot) "build\unidesk_dev.cer"

if (-not (Test-Path $pfxPath)) {
    Write-Host "Creating developer certificate first..."
    $buildDir = Split-Path -Parent $pfxPath
    if (-not (Test-Path $buildDir)) { New-Item -ItemType Directory -Path $buildDir -Force | Out-Null }
    $Subject = "CN=BSFramework.UniDesk"
    $existing = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue | Where-Object { $_.Subject -eq $Subject } | Select-Object -First 1
    if (-not $existing) {
        $existing = New-SelfSignedCertificate -Type CodeSigningCert -Subject $Subject -CertStoreLocation "Cert:\CurrentUser\My" -KeyUsage DigitalSignature -FriendlyName "Uni Desk Developer Certificate" -NotAfter (Get-Date).AddYears(5)
    }
    $secPwd = ConvertTo-SecureString -String $Password -Force -AsPlainText
    Export-PfxCertificate -Cert $existing -FilePath $pfxPath -Password $secPwd | Out-Null
    Export-Certificate -Cert $existing -FilePath $cerPath | Out-Null
    $store = New-Object System.Security.Cryptography.X509Certificates.X509Store("TrustedPeople", "CurrentUser")
    $store.Open("ReadWrite")
    $store.Add($existing)
    $store.Close()
}

if (-not $AppxPath) {
    $relDir = Join-Path (Split-Path -Parent $PSScriptRoot) "release"
    $latest = Get-ChildItem -Path $relDir -Filter "*.appx" -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latest) {
        $AppxPath = $latest.FullName
    }
}

if (-not $AppxPath -or -not (Test-Path $AppxPath)) {
    Write-Error "No AppX or MSIX file found to sign: $AppxPath"
    exit 1
}

Write-Host "[SignTool] Signing package: $AppxPath"
Write-Host "[SignTool] Using: $sdkSignTool"

& "$sdkSignTool" sign /fd SHA256 /f "$pfxPath" /p "$Password" "$AppxPath"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[SignTool] Success: AppX/MSIX package signed with trusted developer certificate!"

    # Export cert and 1-click installer next to the AppX
    $appxDir = Split-Path -Parent $AppxPath
    $targetCer = Join-Path $appxDir "UniDesk_Developer_Cert.cer"
    Copy-Item $cerPath $targetCer -Force

    $installerBat = Join-Path $appxDir "Install_Certificate.bat"
    $batContent = @"
@echo off
title Uni Desk Certificate Installer
echo ========================================================
echo   TRUSTING UNI DESK DEVELOPER CERTIFICATE (ONE-TIME)
echo ========================================================
echo.
certutil -addstore -f "TrustedPeople" "%~dp0UniDesk_Developer_Cert.cer"
echo.
echo ========================================================
echo   SUCCESS! The certificate is now trusted.
echo   You can now double-click the .appx / .msix to install.
echo ========================================================
pause
"@
    Set-Content -Path $installerBat -Value $batContent -Encoding ASCII
    Write-Host "[SignTool] Created 1-click certificate installer: $installerBat"
} else {
    Write-Error "[SignTool] Failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
