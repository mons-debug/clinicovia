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
docker compose -f docker-compose.deploy.yml build --pull backend whatsapp-bridge celery-worker celery-beat
docker compose -f docker-compose.deploy.yml build --pull --no-cache frontend
docker compose -f docker-compose.deploy.yml run --rm backend alembic upgrade head
docker compose -f docker-compose.deploy.yml up -d --remove-orphans --force-recreate
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
Production secrets: /opt/clinicovia/.secrets
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
docker compose -f docker-compose.deploy.yml up -d --remove-orphans --force-recreate
docker compose -f docker-compose.deploy.yml ps
```

## AI Secrets

Keep AI provider keys out of Git and out of `.env` when possible. The production Docker setup mounts a server-only secret file into backend services:

```text
/opt/clinicovia/.secrets/openai_api_key
```

To set or rotate it on the server:

```bash
cd /opt/clinicovia
mkdir -p .secrets
chmod 700 .secrets
read -rsp "OpenAI API key: " OPENAI_KEY; echo
printf '%s' "$OPENAI_KEY" > .secrets/openai_api_key
unset OPENAI_KEY
chmod 600 .secrets/openai_api_key
docker compose -f docker-compose.deploy.yml up -d --force-recreate backend celery-worker celery-beat
```

## Important Notes

- Keep `/opt/clinicovia/.env` on the server only. Do not commit it.
- Add the OpenAI API key to `/opt/clinicovia/.secrets/openai_api_key` before expecting AI agents to answer.
- Rotate any GitHub token shared in chat or terminals.
