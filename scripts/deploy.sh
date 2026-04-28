#!/usr/bin/env bash
set -euo pipefail

MESSAGE="${1:-deploy: update clinicovia}"
BRANCH="${DEPLOY_BRANCH:-main}"

git rev-parse --show-toplevel >/dev/null
cd "$(git rev-parse --show-toplevel)"

if [[ "$(git branch --show-current)" != "$BRANCH" ]]; then
  echo "Switch to $BRANCH before deploying."
  exit 1
fi

git add \
  .github \
  backend \
  frontend \
  whatsapp-bridge \
  scripts \
  Caddyfile \
  DEPLOYMENT.md \
  .env.example \
  .gitignore \
  docker-compose.yml \
  docker-compose.prod.yml \
  docker-compose.deploy.yml

if git diff --cached --quiet; then
  echo "No deployable changes to commit."
else
  git commit -m "$MESSAGE"
fi

git push origin "$BRANCH"
echo "Pushed to $BRANCH. GitHub Actions will deploy production automatically."
