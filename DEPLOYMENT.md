# Clinicovia Deployment

Production deploys run automatically from GitHub Actions when `main` is updated.

## Quick Deploy

From the project root:

```bash
./scripts/deploy.sh "deploy: describe your change"
```

The script stages deployable app files, commits them, and pushes `main`. The `Deploy` GitHub Action then connects to Hetzner and runs:

```bash
cd /opt/clinicovia
git fetch origin main
git reset --hard origin/main
docker compose -f docker-compose.deploy.yml build
docker compose -f docker-compose.deploy.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.deploy.yml up -d --remove-orphans
docker image prune -f
```

## GitHub Secrets

The deploy workflow needs these repository secrets:

```text
HETZNER_HOST=178.105.18.157
HETZNER_USER=root
HETZNER_PORT=22
HETZNER_SSH_KEY=<private deploy key allowed on the server>
```

## Server Paths

```text
App directory: /opt/clinicovia
Production env: /opt/clinicovia/.env
Compose file: /opt/clinicovia/docker-compose.deploy.yml
```

## Manual Deploy

Use this on the server only when you need to bypass GitHub Actions:

```bash
cd /opt/clinicovia
git fetch origin main
git reset --hard origin/main
docker compose -f docker-compose.deploy.yml build
docker compose -f docker-compose.deploy.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.deploy.yml up -d --remove-orphans
docker compose -f docker-compose.deploy.yml ps
```

## Important Notes

- Keep `/opt/clinicovia/.env` on the server only. Do not commit it.
- Add `OPENAI_API_KEY` to `/opt/clinicovia/.env` before expecting AI agents to answer.
- Rotate any GitHub token shared in chat or terminals.
