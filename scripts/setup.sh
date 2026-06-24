#!/bin/bash
set -e

# ============================================================
# COMET — Installation rapide
# Usage: bash scripts/setup.sh
# ============================================================

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         COMET — Installation             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check prerequisites
for cmd in docker; do
  if ! command -v "$cmd" &> /dev/null; then
    echo "ERREUR: '$cmd' n'est pas installé."
    echo "Installez Docker: https://docs.docker.com/get-docker/"
    exit 1
  fi
done

if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
  echo "ERREUR: 'docker compose' n'est pas disponible."
  echo "Installez Docker Compose: https://docs.docker.com/compose/install/"
  exit 1
fi

COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
  COMPOSE_CMD="docker-compose"
fi

# Create .env if missing
if [ ! -f .env ]; then
  echo "Création du fichier .env..."
  cp .env.example .env

  # Generate secrets
  AUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  CRON_SECRET=$(openssl rand -base64 16 2>/dev/null || head -c 16 /dev/urandom | base64)
  ENCRYPTION_KEY=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
  POSTGRES_PASSWORD=$(openssl rand -base64 24 2>/dev/null || head -c 24 /dev/urandom | base64)

  # Replace placeholders
  sed -i "s|change-me-use-a-strong-password|${POSTGRES_PASSWORD}|g" .env
  sed -i "s|generate-with-openssl-rand-base64-32|${AUTH_SECRET}|g" .env
  sed -i "s|generate-with-openssl-rand-base64-16|${CRON_SECRET}|g" .env
  sed -i "s|^ENCRYPTION_KEY=\"\"|ENCRYPTION_KEY=\"${ENCRYPTION_KEY}\"|" .env

  echo "  Secrets générés automatiquement."
  echo ""
else
  echo "Fichier .env existant détecté, conservation."
  echo ""
fi

# Prompt for external URL
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "URL d'accès (ex: https://comet.mondomaine.fr)"
echo "Laisser vide pour http://localhost:3000"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -r -p "> " APP_URL
if [ -n "$APP_URL" ]; then
  sed -i "s|^AUTH_URL=.*|AUTH_URL=\"${APP_URL}\"|" .env
  echo "  AUTH_URL mis à jour: ${APP_URL}"
fi
echo ""

# Build and start
echo "Construction et démarrage des conteneurs..."
echo ""
$COMPOSE_CMD up -d --build

echo ""
echo "Attente du démarrage de l'application..."
RETRIES=30
while [ "$RETRIES" -gt 0 ]; do
  if curl -sf http://localhost:${APP_PORT:-3000}/api/health > /dev/null 2>&1; then
    break
  fi
  RETRIES=$((RETRIES - 1))
  sleep 2
done

if [ "$RETRIES" -eq 0 ]; then
  echo ""
  echo "L'application met du temps à démarrer."
  echo "Vérifiez les logs: $COMPOSE_CMD logs -f app"
  echo ""
else
  echo ""
  echo "╔══════════════════════════════════════════════════════╗"
  echo "║              Installation terminée !                ║"
  echo "╠══════════════════════════════════════════════════════╣"
  echo "║                                                     ║"
  echo "║  URL: ${APP_URL:-http://localhost:${APP_PORT:-3000}}$(printf '%*s' $((37 - ${#APP_URL:-26})) ''  )║"
  echo "║                                                     ║"
  echo "║  Les identifiants admin s'affichent dans les logs:  ║"
  echo "║  $COMPOSE_CMD logs app | grep -A3 'Admin'$(printf '%*s' $((12 - ${#COMPOSE_CMD})) '')║"
  echo "║                                                     ║"
  echo "║  Commandes utiles:                                  ║"
  echo "║  • Logs:    $COMPOSE_CMD logs -f app$(printf '%*s' $((22 - ${#COMPOSE_CMD})) '')║"
  echo "║  • Stop:    $COMPOSE_CMD down$(printf '%*s' $((27 - ${#COMPOSE_CMD})) '')║"
  echo "║  • Restart: $COMPOSE_CMD restart app$(printf '%*s' $((19 - ${#COMPOSE_CMD})) '')║"
  echo "║  • Backup:  $COMPOSE_CMD exec db pg_dump -U comet comet_cedelia  ║"
  echo "║                                                     ║"
  echo "╚══════════════════════════════════════════════════════╝"
  echo ""
fi
