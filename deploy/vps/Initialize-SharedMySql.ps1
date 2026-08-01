[CmdletBinding()]
param(
    [string]$DatabaseName = "pixy_system",
    [string]$DatabaseUser = "pixy_system_app"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function New-RandomPassword {
    param([int]$Length = 48)

    $alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    $bytes = New-Object byte[] $Length
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)

    $builder = [System.Text.StringBuilder]::new($Length)
    foreach ($byte in $bytes) {
        [void]$builder.Append($alphabet[$byte % $alphabet.Length])
    }

    return $builder.ToString()
}

function Assert-SafeSqlIdentifier {
    param(
        [Parameter(Mandatory)]
        [string]$Value,

        [Parameter(Mandatory)]
        [string]$Name
    )

    if ($Value -notmatch '^[A-Za-z0-9_]+$') {
        throw "$Name may contain only letters, numbers, and underscores."
    }
}

Assert-SafeSqlIdentifier -Value $DatabaseName -Name "DatabaseName"
Assert-SafeSqlIdentifier -Value $DatabaseUser -Name "DatabaseUser"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is required and was not found in PATH."
}

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeFile = Join-Path $scriptDirectory "compose.yml"
$secretsDirectory = Join-Path $scriptDirectory "secrets"
$rootPasswordFile = Join-Path $secretsDirectory "mysql_root_password.txt"
$appPasswordFile = Join-Path $secretsDirectory "pixy_system_db_password.txt"

New-Item -ItemType Directory -Path $secretsDirectory -Force | Out-Null

if (Test-Path $rootPasswordFile) {
    $rootPassword = (Get-Content -Raw $rootPasswordFile).Trim()
    if (-not $rootPassword) {
        throw "The existing MySQL root password file is empty: $rootPasswordFile"
    }
} else {
    $rootPassword = New-RandomPassword
    [System.IO.File]::WriteAllText($rootPasswordFile, $rootPassword, [System.Text.UTF8Encoding]::new($false))
}

if (Test-Path $appPasswordFile) {
    $appPassword = (Get-Content -Raw $appPasswordFile).Trim()
    if (-not $appPassword) {
        throw "The existing application database password file is empty: $appPasswordFile"
    }
} else {
    $appPassword = New-RandomPassword
    [System.IO.File]::WriteAllText($appPasswordFile, $appPassword, [System.Text.UTF8Encoding]::new($false))
}

if (-not $IsWindows) {
    & chmod 600 $rootPasswordFile $appPasswordFile
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to restrict database secret file permissions."
    }
}

& docker compose -f $composeFile up -d
if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed to start the shared MySQL service."
}

$deadline = (Get-Date).AddMinutes(2)
do {
    Start-Sleep -Seconds 3
    $health = (& docker inspect --format '{{.State.Health.Status}}' pixy-shared-mysql 2>$null).Trim()
} while ($health -ne "healthy" -and (Get-Date) -lt $deadline)

if ($health -ne "healthy") {
    throw "MySQL did not become healthy within two minutes. Run: docker logs pixy-shared-mysql"
}

$sql = @"
CREATE DATABASE IF NOT EXISTS ``$DatabaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS '$DatabaseUser'@'%' IDENTIFIED BY '$appPassword';
ALTER USER '$DatabaseUser'@'%' IDENTIFIED BY '$appPassword';
GRANT ALL PRIVILEGES ON ``$DatabaseName``.* TO '$DatabaseUser'@'%';
FLUSH PRIVILEGES;
"@

$sql | & docker compose -f $composeFile exec -T -e "MYSQL_PWD=$rootPassword" mysql mysql -uroot
if ($LASTEXITCODE -ne 0) {
    throw "Failed to create the application database and user."
}

$escapedPassword = [System.Uri]::EscapeDataString($appPassword)
$databaseUrl = "mysql://${DatabaseUser}:${escapedPassword}@127.0.0.1:3306/${DatabaseName}?connection_limit=5&connect_timeout=5&max_idle_connection_lifetime=300"

Write-Host ""
Write-Host "Shared MySQL is ready." -ForegroundColor Green
Write-Host "Database: $DatabaseName"
Write-Host "User:     $DatabaseUser"
Write-Host ""
Write-Host "Put this value in the bot's protected .env file:" -ForegroundColor Cyan
Write-Host "DATABASE_URL=`"$databaseUrl`""
Write-Host ""
Write-Host "Secret files are stored under: $secretsDirectory"
Write-Host "Back them up securely and never commit them."
