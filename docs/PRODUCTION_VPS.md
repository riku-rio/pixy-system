# Production VPS deployment

This deployment uses one MySQL 8 container for the VPS and one dedicated database/user per application:

```text
VPS
├── pixy-system (systemd service)
├── pixy (systemd service, added separately)
└── pixy-shared-mysql (Docker)
    ├── pixy_system database + pixy_system_app user
    └── pixy database + pixy_app user
```

The MySQL port is published only on `127.0.0.1:3306`; it is not exposed publicly. The Discord bot runs directly under a dedicated Linux account and is supervised by systemd. Database root and application passwords are generated locally on the VPS and stored outside Git.

## 1. VPS prerequisites

Install Git, Docker Engine with the Compose plugin, Node.js 20 or newer, and PowerShell 7. Configure the VPS firewall so SSH is allowed, while port 3306 remains closed publicly.

## 2. Clone the application

Run PowerShell as a sudo-capable deployment user:

```powershell
sudo useradd --system --create-home --home-dir /opt/pixy-system --shell /usr/sbin/nologin pixy-system
sudo git clone https://github.com/riku-rio/pixy-system.git /opt/pixy-system/current
sudo chown -R pixy-system:pixy-system /opt/pixy-system
Set-Location /opt/pixy-system/current
```

For a private repository, use a read-only deploy key or another non-interactive Git credential configured for the deployment user. Do not put a personal access token directly in a command or repository URL.

## 3. Initialize the shared MySQL instance

The included script generates strong passwords, starts MySQL, waits for its health check, creates `pixy_system`, and creates a least-privilege `pixy_system_app` user:

```powershell
Set-Location /opt/pixy-system/current/deploy/vps
./Initialize-SharedMySql.ps1
```

Copy the printed `DATABASE_URL` into the protected application environment file. Secret files are stored in `deploy/vps/secrets/`, ignored by Git, and should be backed up securely.

The shared MySQL compose file belongs to the VPS infrastructure. When the second bot is added, use this same running MySQL container and create a separate `pixy` database/user; do not start another MySQL container.

## 4. Create the protected bot environment file

```powershell
sudo install -d -m 700 -o root -g root /etc/pixy-system
sudo Copy-Item /opt/pixy-system/current/.env.example /etc/pixy-system/pixy-system.env
sudo chmod 600 /etc/pixy-system/pixy-system.env
sudo nano /etc/pixy-system/pixy-system.env
```

Set all Discord IDs/tokens and replace `DATABASE_URL` with the value printed by the initializer. Keep the file owned by root with mode `600`.

## 5. Install dependencies and deploy the schema

```powershell
Set-Location /opt/pixy-system/current
sudo -u pixy-system npm install
sudo -u pixy-system npm run prisma:generate
sudo -u pixy-system --preserve-env=DATABASE_URL env DATABASE_URL=(sudo Select-String -Path /etc/pixy-system/pixy-system.env -Pattern '^DATABASE_URL=' | ForEach-Object { $_.Line.Substring(13).Trim('"') }) npm run prisma:migrate
```

The repository does not currently contain a committed `package-lock.json`, so production must use `npm install` for now. Once a lockfile is generated and committed, replace it with `npm ci` for reproducible installations.

A simpler alternative for the migration step is to temporarily load the protected environment file in a root shell, run `npm run prisma:migrate` as the service account, and immediately clear the environment afterward. Do not copy the production `.env` into the repository.

## 6. Install the systemd service

```powershell
sudo Copy-Item /opt/pixy-system/current/deploy/vps/pixy-system.service.example /etc/systemd/system/pixy-system.service
sudo systemctl daemon-reload
sudo systemctl enable --now pixy-system
```

Check status and logs:

```powershell
sudo systemctl status pixy-system --no-pager
sudo journalctl -u pixy-system -n 100 --no-pager
sudo journalctl -u pixy-system -f
```

The service sends `SIGTERM` during restarts. The application now closes the Discord client and Prisma connection cleanly before exiting.

## 7. Updating the bot

```powershell
sudo systemctl stop pixy-system
Set-Location /opt/pixy-system/current
sudo -u pixy-system git pull --ff-only
sudo -u pixy-system npm install
sudo -u pixy-system npm run prisma:generate
# Load DATABASE_URL from /etc/pixy-system/pixy-system.env, then:
sudo -u pixy-system npm run prisma:migrate
sudo systemctl start pixy-system
sudo systemctl status pixy-system --no-pager
```

Run migrations before restarting whenever a release includes schema changes.

## 8. Backups

Back up both the MySQL data and the database passwords. A practical minimum is a daily logical dump copied off the VPS:

```powershell
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDirectory = '/var/backups/pixy-mysql'
sudo New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$rootPassword = sudo Get-Content -Raw /opt/pixy-system/current/deploy/vps/secrets/mysql_root_password.txt
sudo docker exec -e "MYSQL_PWD=$($rootPassword.Trim())" pixy-shared-mysql mysqldump -uroot --single-transaction --routines --events --databases pixy_system | sudo Tee-Object -FilePath "$backupDirectory/pixy-system-$timestamp.sql" | Out-Null
sudo gzip "$backupDirectory/pixy-system-$timestamp.sql"
```

Store a copy outside the VPS and periodically test restoring it to a separate database.

## Local development

The root `docker-compose.yml` is for local development only. It uses `.env.docker`, binds MySQL to localhost, and keeps its database volume separate from production:

```powershell
Copy-Item .env.docker.example .env.docker
# Replace the placeholder development passwords.
npm run db:up
npm run db:logs
```

Use port `3308` in the local `DATABASE_URL`. Never reuse local passwords in production.
