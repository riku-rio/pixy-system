[CmdletBinding()]
param(
    [string]$DatabaseName = "pixy_system",
    [string]$BackupDirectory = "/var/backups/pixy-mysql"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($DatabaseName -notmatch '^[A-Za-z0-9_]+$') {
    throw "DatabaseName may contain only letters, numbers, and underscores."
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPasswordFile = Join-Path $scriptDirectory "secrets/mysql_root_password.txt"
if (-not (Test-Path $rootPasswordFile)) {
    throw "MySQL root password file not found: $rootPasswordFile"
}

$rootPassword = (Get-Content -Raw $rootPasswordFile).Trim()
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$temporaryFile = Join-Path ([System.IO.Path]::GetTempPath()) "$DatabaseName-$timestamp.sql"
$archiveName = "$DatabaseName-$timestamp.sql.gz"

try {
    $env:MYSQL_PWD = $rootPassword
    & docker exec -e "MYSQL_PWD=$rootPassword" pixy-shared-mysql mysqldump -uroot --single-transaction --routines --events --databases $DatabaseName |
        Set-Content -Path $temporaryFile -Encoding utf8NoBOM

    if ($LASTEXITCODE -ne 0) {
        throw "mysqldump failed with exit code $LASTEXITCODE."
    }

    & gzip -f $temporaryFile
    if ($LASTEXITCODE -ne 0) {
        throw "gzip failed with exit code $LASTEXITCODE."
    }

    & sudo install -d -m 700 $BackupDirectory
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create backup directory: $BackupDirectory"
    }

    & sudo mv "$temporaryFile.gz" (Join-Path $BackupDirectory $archiveName)
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to move the backup archive into $BackupDirectory"
    }

    Write-Host "Backup created: $(Join-Path $BackupDirectory $archiveName)" -ForegroundColor Green
} finally {
    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    Remove-Item $temporaryFile -Force -ErrorAction SilentlyContinue
    Remove-Item "$temporaryFile.gz" -Force -ErrorAction SilentlyContinue
}
