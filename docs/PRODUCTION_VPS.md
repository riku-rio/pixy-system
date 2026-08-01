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

MySQL is published only on `127.0.0.1:3306`, so it is not reachable from the public internet. The Discord bot runs under a dedicated Linux account and is supervised by systemd. Database root and application passwords are generated on the VPS and stored outside Git.

## 1. Prerequisites

Install Git, Docker Engine with the Compose plugin, Node.js 20 or newer, and PowerShell 7. Keep TCP port 3306 closed in the VPS firewall.

## 2. Clone the application

Run these commands from PowerShell as a sudo-capable deployment user:

```powershell
sudo useradd --system --create-home --home-dir /opt/pixy-system --shell /usr/sbin/nologin pixy-system
sudo git clone https://github.com/riku-rio/pixy-system.git /opt/pixy-system/current
sudo chown -R pixy-system:pixy-system /opt/pixy-system
Set-Location /opt/pixy-system/current
```

For a private repository, configure a read-only deploy key for the deployment account. Do not place a personal access token in the command or repository URL.

## 3. Initialize shared MySQL

The initializer generates strong passwords, starts the shared MySQL container, waits for its health check, creates `pixy_system`, and creates a least-privilege `pixy_system_app` account:

```powershell
Set-Location /opt/pixy-system/current/deploy/vps
./Initialize-SharedMySql.ps1
```

Copy the printed `DATABASE_URL`. Secret files are stored under `deploy/vps/secrets/`, ignored by Git, and must be backed up securely.

When `pixy` is deployed later, use this same MySQL container and create a separate database/user for it. Do not start a second MySQL instance.

## 4. Create the protected application environment

```powershell
sudo install -d -m 700 -o root -g root /etc/pixy-system
sudo cp /opt/pixy-system/current/.env.example /etc/pixy-system/pixy-system.env
sudo chmod 600 /etc/pixy-system/pixy-system.env
sudo nano /etc/pixy-system/pixy-system.env
```

Set the Discord values and replace `DATABASE_URL` with the value printed by the initializer. Keep the file owned by root with mode `600`.

## 5. Install dependencies and deploy the schema

```powershell
Set-Location /opt/pixy-system/current
sudo -u pixy-system npm install
sudo -u pixy-system npm run prisma:generate
sudo pwsh -File ./deploy/vps/Invoke-DatabaseMigration.ps1
```

The repository does not currently contain a committed `package-lock.json`, so deployment must use `npm install` for now. After a lockfile is generated and committed, replace it with `npm ci` for reproducible installations.

## 6. Install the systemd service

```powershell
sudo cp /opt/pixy-system/current/deploy/vps/pixy-system.service.example /etc/systemd/system/pixy-system.service
sudo systemctl daemon-reload
sudo systemctl enable --now pixy-system
```

Check status and logs:

```powershell
sudo systemctl status pixy-system --no-pager
sudo journalctl -u pixy-system -n 100 --no-pager
sudo journalctl -u pixy-system -f
```

During restarts, systemd sends `SIGTERM`. The application closes the Discord client and Prisma connection before exiting.

## 7. Update the bot

```powershell
sudo systemctl stop pixy-system
Set-Location /opt/pixy-system/current
sudo -u pixy-system git pull --ff-only
sudo -u pixy-system npm install
sudo -u pixy-system npm run prisma:generate
sudo pwsh -File ./deploy/vps/Invoke-DatabaseMigration.ps1
sudo systemctl start pixy-system
sudo systemctl status pixy-system --no-pager
```

Run migrations before starting the new release whenever schema changes are included.

## 8. Backups

Create a logical backup with the included PowerShell helper:

```powershell
Set-Location /opt/pixy-system/current/deploy/vps
sudo pwsh -File ./Backup-SharedMySql.ps1
```

The default destination is `/var/backups/pixy-mysql`. Copy backups off the VPS and periodically test a restore into a separate database.

Back up the files under `deploy/vps/secrets/` separately. A database dump without the correct credentials is harder to operate and recover safely.

## Local development

The root `docker-compose.yml` is for local development only. It uses `.env.docker`, binds MySQL to localhost, and keeps its data separate from production:

```powershell
Copy-Item .env.docker.example .env.docker
# Replace both placeholder development passwords.
npm run db:up
npm run db:logs
```

Use port `3308` in the local `DATABASE_URL`. Never reuse development passwords in production.
