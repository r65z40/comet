#!/bin/sh
set -e

echo "=== Comet startup ==="

# Warn if default secrets are still in use
if [ "$AUTH_SECRET" = "defaultsecret_changeme_in_production" ]; then
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "  WARNING: AUTH_SECRET is set to the default value!"
  echo "  Generate a secure secret: openssl rand -base64 32"
  echo "  Set it in your .env or docker-compose.yml"
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo ""
fi
if [ "$CRON_SECRET" = "comet_cron_secret_2024" ]; then
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "  WARNING: CRON_SECRET is set to the default value!"
  echo "  Generate a secure secret: openssl rand -base64 16"
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo ""
fi

# Strip Prisma-specific query params (?schema=public) that psql doesn't understand
DB_URL=$(echo "$DATABASE_URL" | cut -d'?' -f1)

# Wait for database to be ready (max 60 seconds)
RETRIES=30
DB_READY=0
while [ "$RETRIES" -gt 0 ]; do
  if psql "$DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
    DB_READY=1
    break
  fi
  RETRIES=$((RETRIES - 1))
  echo "Waiting for database... ($RETRIES retries left)"
  sleep 2
done

if [ "$DB_READY" = "0" ]; then
  echo "ERROR: Could not connect to database after 60s. Exiting."
  exit 1
fi

echo "Database is ready. Running Prisma migrations..."
if ! node node_modules/prisma/build/index.js migrate deploy 2>&1; then
  echo "WARNING: Prisma migrate returned non-zero (may be OK on first run)"
fi

# Seed admin user if users table is empty (fresh install)
USER_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM users" 2>/dev/null | tr -d ' ')
if [ "$USER_COUNT" = "0" ] 2>/dev/null; then
  echo "No users found — creating initial admin account..."
  node -e "
const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = new PrismaClient();
(async () => {
  const pass = crypto.randomBytes(12).toString('base64url');
  const hash = await bcrypt.hash(pass, 12);
  await prisma.user.create({ data: { name: 'Administrateur', email: 'admin@comet-cedelia.fr', password: hash, role: 'ADMIN' }});
  await prisma.setting.upsert({ where: { key: 'axonaut_api_url' }, update: {}, create: { key: 'axonaut_api_url', value: 'https://axonaut.com/api/v2' }});
  console.log('=========================================');
  console.log('Admin account created:');
  console.log('  Email:    admin@comet-cedelia.fr');
  console.log('  Password: ' + pass);
  console.log('=========================================');
  console.log('IMPORTANT: Change this password after first login!');
})().catch(e => { console.error('Seed error:', e.message); process.exit(1); }).finally(() => prisma.\$disconnect());
"
fi

echo "=== Starting application ==="
exec node server.js
