[CmdletBinding()]
param(
    [string]$EnvironmentFile = "/etc/pixy-system/pixy-system.env",
    [string]$ApplicationDirectory = "/opt/pixy-system/current",
    [string]$ServiceUser = "pixy-system"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if (-not (Test-Path $EnvironmentFile)) {
    throw "Environment file not found: $EnvironmentFile"
}

$databaseUrlLine = Get-Content $EnvironmentFile |
    Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
    Select-Object -First 1

if (-not $databaseUrlLine) {
    throw "DATABASE_URL was not found in $EnvironmentFile"
}

$databaseUrl = ($databaseUrlLine -replace '^\s*DATABASE_URL\s*=\s*', '').Trim()
if (
    ($databaseUrl.StartsWith('"') -and $databaseUrl.EndsWith('"')) -or
    ($databaseUrl.StartsWith("'") -and $databaseUrl.EndsWith("'"))
) {
    $databaseUrl = $databaseUrl.Substring(1, $databaseUrl.Length - 2)
}

if (-not $databaseUrl) {
    throw "DATABASE_URL is empty in $EnvironmentFile"
}

$previousDatabaseUrl = $env:DATABASE_URL
try {
    $env:DATABASE_URL = $databaseUrl
    Push-Location $ApplicationDirectory

    & sudo --preserve-env=DATABASE_URL -u $ServiceUser npm run prisma:migrate
    if ($LASTEXITCODE -ne 0) {
        throw "Prisma migration deployment failed with exit code $LASTEXITCODE."
    }
} finally {
    Pop-Location
    $env:DATABASE_URL = $previousDatabaseUrl
}
