param(
    [Parameter(Mandatory = $true)]
    [string]$PublicOrigin,
    [switch]$EnableTunnel
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$releaseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $releaseDir

$uri = $null
if (-not [Uri]::TryCreate($PublicOrigin, [UriKind]::Absolute, [ref]$uri) -or
    $uri.Scheme -ne 'https' -or $uri.AbsolutePath -ne '/' -or
    $uri.Query -ne '' -or $uri.Fragment -ne '' -or
    $PublicOrigin.EndsWith('/')) {
    throw 'PublicOrigin must be an HTTPS origin without a trailing slash, for example https://quiz.example.com'
}

function New-HexSecret([int]$byteCount) {
    $bytes = New-Object byte[] $byteCount
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function Read-TunnelToken {
    $secure = Read-Host 'Paste the Cloudflare Tunnel token' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$envPath = Join-Path $releaseDir '.env'
$utf8 = New-Object System.Text.UTF8Encoding($false)
if (-not (Test-Path -LiteralPath $envPath)) {
    $adminPassword = New-HexSecret 24
    $lines = @(
        "POSTGRES_PASSWORD=$(New-HexSecret 32)"
        "SESSION_SECRET=$(New-HexSecret 48)"
        "ADMIN_INITIAL_PASSWORD=$adminPassword"
        "WEB_ORIGIN=$PublicOrigin"
    )
    if ($EnableTunnel) {
        $token = Read-TunnelToken
        if ([string]::IsNullOrWhiteSpace($token)) { throw 'Cloudflare Tunnel token is required.' }
        $lines += "CLOUDFLARE_TUNNEL_TOKEN=$token"
    } else {
        $lines += 'CLOUDFLARE_TUNNEL_TOKEN='
    }
    [System.IO.File]::WriteAllLines($envPath, $lines, $utf8)
    Write-Host "Initial admin username: admin"
    Write-Host "Initial admin password: $adminPassword"
    Write-Host 'Save this password now. The .env file also contains it; do not send that file to others.'
} else {
    $envLines = Get-Content -LiteralPath $envPath
    if ($envLines -notcontains "WEB_ORIGIN=$PublicOrigin") {
        throw '.env has a different WEB_ORIGIN. Edit it before retrying.'
    }
    if ($EnableTunnel -and -not ($envLines | Where-Object { $_ -match '^CLOUDFLARE_TUNNEL_TOKEN=.+$' })) {
        $token = Read-TunnelToken
        if ([string]::IsNullOrWhiteSpace($token)) { throw 'Cloudflare Tunnel token is required.' }
        $envLines = @($envLines | Where-Object { $_ -notmatch '^CLOUDFLARE_TUNNEL_TOKEN=' })
        $envLines += "CLOUDFLARE_TUNNEL_TOKEN=$token"
        [System.IO.File]::WriteAllLines($envPath, $envLines, $utf8)
    }
}

$settings = @{}
foreach ($line in (Get-Content -LiteralPath $envPath)) {
    if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$Matches[1]] = $Matches[2] }
}
if ($settings.POSTGRES_PASSWORD -notmatch '^[a-zA-Z0-9_-]{24,}$') {
    throw 'POSTGRES_PASSWORD must contain at least 24 URL-safe letters, digits, _ or -.'
}
if ($settings.SESSION_SECRET.Length -lt 32 -or $settings.SESSION_SECRET -match '^replace-') {
    throw 'SESSION_SECRET must be a random value of at least 32 characters.'
}
if ($settings.ADMIN_INITIAL_PASSWORD.Length -lt 12 -or $settings.ADMIN_INITIAL_PASSWORD -match '^replace-') {
    throw 'ADMIN_INITIAL_PASSWORD must contain at least 12 characters.'
}

& docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop in Linux containers mode, then retry.' }

$composeArgs = @('compose', '-f', 'compose.yaml')

& docker @composeArgs config --quiet
if ($LASTEXITCODE -ne 0) { throw 'Compose configuration is invalid.' }
& docker @composeArgs pull
if ($LASTEXITCODE -ne 0) { throw 'Image pull failed. If the images are private, run docker login.' }
& docker @composeArgs up -d --no-build
if ($LASTEXITCODE -ne 0) { throw 'Container startup failed.' }
if ($EnableTunnel) {
    & docker @composeArgs pull tunnel
    if ($LASTEXITCODE -ne 0) { throw 'Tunnel image pull failed.' }
    & docker @composeArgs up -d --no-build tunnel
    if ($LASTEXITCODE -ne 0) { throw 'Tunnel startup failed.' }
}

$healthy = $false
for ($attempt = 0; $attempt -lt 45; $attempt++) {
    try {
        $response = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/api/health' -TimeoutSec 3
        if ($response.status -eq 'ok') { $healthy = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}
if (-not $healthy) {
    & docker @composeArgs logs --tail 80 api proxy
    throw 'Local health check failed.'
}

& docker @composeArgs exec -T api node dist/db/seed-admin.js
if ($LASTEXITCODE -ne 0) { throw 'Admin seed failed.' }
& docker @composeArgs ps
if ($EnableTunnel) { & docker @composeArgs ps tunnel }
Write-Host 'Local health check passed: http://127.0.0.1:8080/api/health'
if ($EnableTunnel) {
    Write-Host 'In Cloudflare Dashboard, set the public hostname service to HTTP http://proxy:80, then test the HTTPS URL.'
}
