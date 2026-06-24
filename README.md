# COMET - CEDELIA

Plateforme de suivi des garanties et installations informatiques pour CEDELIA. Permet de gérer les clients, produits, factures et installations avec un suivi en temps réel des échéances de garantie.

## Fonctionnalités

- **Dashboard** — Vue d'ensemble avec statistiques, graphiques de répartition, échéances à venir
- **Gestion des installations** — Suivi du statut avec compte à rebours, édition inline, historique des modifications
- **Gestion des clients** — Fiches client avec logo, coordonnées, portail client dédié
- **Gestion des produits** — Catalogue avec famille, fournisseur, durée de garantie
- **Tableau de communication (Board)** — Kanban drag-and-drop avec colonnes personnalisables, cartes, tags, checklist, commentaires
- **Factures** — Import et consultation des factures, création d'installations depuis les factures
- **Rapports PDF** — 4 templates (classique, corporate, executive, personnalisé), éditeur visuel de page de garde
- **Ticketing** — Système de tickets avec portail client, synchronisation Atera
- **Base de connaissances** — Articles internes ou publiés vers le portail client
- **Synchronisation Axonaut** — Import automatique (clients, produits, factures)
- **Notifications** — Alertes email SMTP + notifications in-app
- **Sauvegardes automatiques** — Backup programmable avec rotation et stockage cloud (S3/FTP)
- **Import/Export** — CSV et Excel avec détection des doublons
- **Gestion des rôles** — Admin / Utilisateur avec restrictions granulaires

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, Tailwind CSS 4 |
| Base de données | PostgreSQL 16 |
| ORM | Prisma 5 |
| Authentification | NextAuth v5 (credentials) |
| Graphiques | Recharts |
| Drag & Drop | @dnd-kit |
| Email | Nodemailer |
| Déploiement | Docker (multi-stage build) |

---

## Déploiement sur un serveur (Docker)

### Prérequis

- Un serveur Linux (Ubuntu 22.04+, Debian 12+, ou similaire)
- **Docker** (v24+) et **Docker Compose** (v2+)
- 1 Go de RAM minimum, 2 Go recommandé
- Un nom de domaine (optionnel, pour HTTPS)

### Étape 1 — Installer Docker

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Se reconnecter pour que le groupe prenne effet
```

### Étape 2 — Récupérer le projet

```bash
git clone <repo-url> comet
cd comet
```

### Étape 3 — Installation rapide (recommandé)

```bash
bash scripts/setup.sh
```

Le script génère automatiquement tous les secrets, crée le `.env`, et lance l'application. Les identifiants admin s'affichent dans les logs.

### Étape 3 (alternatif) — Configuration manuelle

```bash
cp .env.example .env
```

Éditer le fichier `.env` avec vos valeurs :

```bash
# OBLIGATOIRE : Mot de passe PostgreSQL (choisir un mot de passe fort)
POSTGRES_PASSWORD=mon-mot-de-passe-securise-2024

# OBLIGATOIRE : Adapter le DATABASE_URL avec le même mot de passe
DATABASE_URL="postgresql://comet:mon-mot-de-passe-securise-2024@db:5432/comet_cedelia?schema=public"

# OBLIGATOIRE : Générer un secret unique
AUTH_SECRET="$(openssl rand -base64 32)"

# OBLIGATOIRE : URL publique de l'application
AUTH_URL="https://comet.mondomaine.fr"
# Ou si pas de domaine : AUTH_URL="http://IP_DU_SERVEUR:3000"

# OBLIGATOIRE : Chiffrement des données sensibles en base
ENCRYPTION_KEY="$(openssl rand -hex 32)"

# OBLIGATOIRE : Secret pour les tâches cron
CRON_SECRET="$(openssl rand -base64 16)"

# OPTIONNEL : Clé API Axonaut
AXONAUT_API_KEY=""

# OPTIONNEL : Ports personnalisés
APP_PORT=3000
DB_PORT=5432
```

### Étape 4 — Lancer l'application

```bash
docker compose up -d
```

Le premier démarrage prend 2-3 minutes (build de l'image + migrations). Suivre les logs :

```bash
docker compose logs -f app
```

Attendre le message `=== Starting application ===` puis accéder à l'application.

### Étape 5 — Premier accès

L'application est accessible sur `http://IP_DU_SERVEUR:3000` (ou le port configuré dans `APP_PORT`).

Au premier lancement, un compte admin est créé automatiquement :
- **Email** : `admin@comet-cedelia.fr`
- **Mot de passe** : affiché dans les logs (`docker compose logs app | grep "Password"`)

**Changer le mot de passe immédiatement** après la première connexion (Paramètres > Utilisateurs).

### Étape 6 — Configurer le reverse proxy (recommandé)

Pour HTTPS avec un nom de domaine, ajouter un reverse proxy. Exemple avec **Caddy** (le plus simple) :

```bash
# Installer Caddy
sudo apt install -y caddy

# Éditer /etc/caddy/Caddyfile
echo 'comet.mondomaine.fr {
    reverse_proxy localhost:3000
}' | sudo tee /etc/caddy/Caddyfile

sudo systemctl restart caddy
```

Caddy gère automatiquement les certificats HTTPS via Let's Encrypt.

Ou avec **nginx** :

```nginx
server {
    listen 80;
    server_name comet.mondomaine.fr;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 500M;
    }
}
```

---

## Commandes utiles

### Gestion

```bash
# Démarrer
docker compose up -d

# Arrêter
docker compose down

# Voir les logs
docker compose logs -f app

# Voir le statut (santé des services)
docker compose ps

# Redémarrer l'application
docker compose restart app
```

### Mise à jour

```bash
git pull
docker compose up -d --build
```

L'application applique automatiquement les nouvelles migrations au démarrage.

### Sauvegardes

Les sauvegardes automatiques sont configurables dans Paramètres > Sauvegarde. Elles incluent la base de données + les fichiers uploadés.

Backup manuel :

```bash
# Exporter la base
docker compose exec db pg_dump -U comet comet_cedelia | gzip > backup_$(date +%Y%m%d).sql.gz

# Restaurer
gunzip -c backup_20240101.sql.gz | docker compose exec -T db psql -U comet comet_cedelia
```

### Reset complet

```bash
# Supprimer tout (données incluses !)
docker compose down -v
docker compose up -d
```

---

## Configuration post-installation

Après le premier démarrage, configurer dans **Paramètres** :

1. **Email (SMTP)** — Pour les alertes d'expiration de garantie
   - Paramètres > Alertes Email > Configuration SMTP
   - Hôte, port, identifiants de votre serveur mail

2. **Logo et personnalisation** — Logo de l'entreprise, favicon, couleurs
   - Paramètres > Apparence

3. **Sauvegardes automatiques** — Fréquence, heure, rétention
   - Paramètres > Sauvegarde

4. **Axonaut** (optionnel) — Synchronisation des données
   - Paramètres > Axonaut ou variable `AXONAUT_API_KEY`

5. **Portail client** — Activer l'accès client sur les fiches clients

---

## Variables d'environnement

| Variable | Description | Obligatoire | Défaut |
|----------|-------------|:-----------:|--------|
| `DATABASE_URL` | URL de connexion PostgreSQL | Oui | — |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | Oui | — |
| `AUTH_SECRET` | Secret NextAuth (32 chars min) | Oui | — |
| `AUTH_URL` | URL publique de l'application | Oui | `http://localhost:3000` |
| `AUTH_TRUST_HOST` | Faire confiance au header Host (reverse proxy) | Non | `true` |
| `ENCRYPTION_KEY` | Clé de chiffrement (hex 64 chars) pour SMTP/API keys | Oui | — |
| `CRON_SECRET` | Secret pour l'endpoint /api/cron | Non | `comet_cron_secret_2024` |
| `AXONAUT_API_KEY` | Clé API Axonaut | Non | — |
| `AXONAUT_API_URL` | URL de l'API Axonaut | Non | `https://axonaut.com/api/v2` |
| `APP_PORT` | Port exposé pour l'application | Non | `3000` |
| `DB_PORT` | Port exposé pour PostgreSQL | Non | `5432` |
| `TZ` | Fuseau horaire | Non | `Europe/Paris` |

---

## Développement local

```bash
# Prérequis : Node.js 20+, PostgreSQL 16+
npm install --legacy-peer-deps

# Configurer .env avec DATABASE_URL pointant vers localhost
cp .env.example .env
# Modifier DATABASE_URL : ...@localhost:5432/...

# Appliquer le schéma
npm run db:push

# Seed initial (créer l'admin)
npm run db:seed

# Lancer en dev
npm run dev
```

### Scripts npm

```bash
npm run dev          # Serveur de développement (hot reload)
npm run build        # Build production
npm start            # Lancer en production
npm run lint         # Linter ESLint
npm run db:push      # Appliquer le schéma Prisma (dev)
npm run db:migrate   # Déployer les migrations (production)
npm run db:seed      # Créer l'utilisateur admin
npm run db:studio    # Interface visuelle Prisma Studio
```

---

## Architecture

```
src/
├── app/
│   ├── (auth)/              # Pages publiques (login, reset password)
│   ├── (dashboard)/         # Pages protégées
│   │   ├── board/           # Tableau Kanban
│   │   ├── clients/         # Gestion clients + rapports
│   │   ├── dashboard/       # Vue d'ensemble
│   │   ├── installations/   # Suivi des installations
│   │   ├── invoices/        # Factures
│   │   ├── knowledge/       # Base de connaissances
│   │   ├── products/        # Catalogue produits
│   │   ├── settings/        # Paramètres + éditeur de page de garde
│   │   ├── sync/            # Synchronisation Axonaut
│   │   └── tickets/         # Ticketing
│   ├── api/                 # Routes API REST
│   └── portal/              # Portail client (auth séparée)
├── components/
│   ├── layout/              # Sidebar, Header, Notifications
│   └── ui/                  # DataTable, RichTextEditor, etc.
├── lib/
│   ├── auth.ts              # Configuration NextAuth
│   ├── backup.ts            # Système de sauvegarde
│   ├── cron-scheduler.ts    # Planificateur de tâches
│   ├── db.ts                # Client Prisma
│   ├── email.ts             # Envoi d'emails SMTP
│   └── notifications.ts     # Notifications in-app
└── middleware.ts             # Protection des routes + headers sécurité
```

## Dépannage

| Problème | Solution |
|----------|----------|
| L'app ne démarre pas | Vérifier les logs : `docker compose logs app` |
| Erreur de connexion DB | Vérifier que `POSTGRES_PASSWORD` correspond dans `DATABASE_URL` |
| Port 3000 occupé | Changer `APP_PORT` dans `.env` |
| Migrations échouent | Vérifier que la DB est accessible et les migrations dans `prisma/migrations/` |
| Email ne fonctionne pas | Vérifier la config SMTP dans Paramètres > Alertes Email |
| Certificat HTTPS | Vérifier que le domaine pointe vers le serveur (DNS) |

---

## Licence

Projet interne CEDELIA.
