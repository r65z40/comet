# COMET - CEDELIA

Plateforme de suivi des garanties et installations informatiques. Gestion des clients, produits, factures et installations avec suivi en temps réel des échéances.

---

## Installation rapide (Docker)

### Prérequis

- Serveur Linux (Ubuntu 22.04+, Debian 12+)
- **Docker** (v24+) et **Docker Compose** (v2+)
- 1 Go RAM minimum, 2 Go recommandé
- Nom de domaine (optionnel, pour HTTPS)

### 1. Installer Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Se reconnecter pour que le groupe prenne effet
```

### 2. Cloner et installer

```bash
git clone <repo-url> comet
cd comet
bash scripts/setup.sh
```

Le script :
- Genere tous les secrets automatiquement (`AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, mot de passe PostgreSQL)
- Demande l'URL d'acces (ex: `https://comet.mondomaine.fr`)
- Construit et lance les conteneurs Docker
- Attend que l'application soit prete

### 3. Premier acces

Les identifiants admin s'affichent dans les logs :

```bash
docker compose logs app | grep -A3 "Admin"
```

- **Email** : `admin@comet-cedelia.fr`
- **Mot de passe** : genere aleatoirement (affiche dans les logs)

**Changer le mot de passe immediatement** : Parametres > Utilisateurs.

### 4. Reverse proxy HTTPS (recommande)

**Caddy** (le plus simple, HTTPS automatique) :

```bash
sudo apt install -y caddy
echo 'comet.mondomaine.fr {
    reverse_proxy localhost:3000
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```

**Nginx** :

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

## Installation manuelle (sans setup.sh)

```bash
cp .env.example .env
```

Editer `.env` :

```bash
POSTGRES_PASSWORD=<mot-de-passe-fort>
DATABASE_URL="postgresql://comet:<mot-de-passe-fort>@db:5432/comet_cedelia?schema=public"
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="https://comet.mondomaine.fr"
ENCRYPTION_KEY="<openssl rand -hex 32>"
CRON_SECRET="<openssl rand -base64 16>"
```

Puis :

```bash
docker compose up -d
docker compose logs -f app    # Attendre "Starting application"
```

---

## Variables d'environnement

| Variable | Description | Obligatoire | Defaut |
|----------|-------------|:-----------:|--------|
| `DATABASE_URL` | URL PostgreSQL | Oui | — |
| `POSTGRES_USER` | Utilisateur PostgreSQL | Non | `comet` |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL | Oui | — |
| `POSTGRES_DB` | Nom de la base | Non | `comet_cedelia` |
| `AUTH_SECRET` | Secret NextAuth (32+ chars) | Oui | — |
| `AUTH_URL` | URL publique de l'app | Oui | `http://localhost:3000` |
| `AUTH_TRUST_HOST` | Trust header Host (reverse proxy) | Non | `true` |
| `ENCRYPTION_KEY` | Cle de chiffrement (hex 64 chars) pour SMTP/API | Oui | — |
| `CRON_SECRET` | Secret pour `/api/cron` | Oui | — |
| `AXONAUT_API_KEY` | Cle API Axonaut | Non | — |
| `AXONAUT_API_URL` | URL API Axonaut | Non | `https://axonaut.com/api/v2` |
| `NEXT_PUBLIC_APP_NAME` | Nom affiche dans les emails | Non | `Comet` |
| `APP_PORT` | Port expose | Non | `3000` |
| `DB_PORT` | Port PostgreSQL expose | Non | `5432` |
| `TZ` | Fuseau horaire | Non | `Europe/Paris` |

---

## Configuration post-installation

Dans **Parametres** :

1. **Email SMTP** — Parametres > Alertes Email > SMTP (hote, port, identifiants). Necessaire pour les alertes d'expiration et les notifications.

2. **Sauvegardes** — Parametres > Sauvegarde
   - Frequence : quotidienne, hebdomadaire ou mensuelle
   - Heure d'execution (ex: 02:00)
   - Retention (nombre de backups conserves)
   - Stockage cloud optionnel (S3/MinIO ou FTP)
   - Notification par email en cas d'echec

3. **Apparence** — Logo, favicon, couleurs de l'entreprise

4. **Axonaut** (optionnel) — Synchronisation clients/produits/factures

5. **Portail client** — Activer par client dans la fiche client > Portail

---

## Sauvegardes

### Ce qui est sauvegarde

- **Base de donnees complete** (PostgreSQL dump avec `--clean --if-exists`)
- **Fichiers uploades** (`/public/uploads/` : logos clients, pieces jointes)
- Format : archive `.tar.gz` contenant `database.sql.gz` + dossier `uploads/`

### Fonctionnement

| Mode | Declenchement | Rotation |
|------|--------------|----------|
| **Automatique** | Cron interne (configurable) | Oui : garde les N plus recents + supprime ceux > N*2 jours |
| **Manuel** | Bouton dans Parametres > Sauvegarde | Non (jamais supprime automatiquement) |

### Stockage

- **Local** : `/app/backups/` (volume Docker `backup_data`, persiste entre redemarrages)
- **Cloud** (optionnel) : S3 (AWS, MinIO, Scaleway) ou FTP
- Les deux simultanément : le backup local est toujours cree, puis uploade vers le cloud

### Restauration

Depuis l'interface : Parametres > Sauvegarde > cliquer sur un backup > Restaurer.

La restauration :
1. Cree un backup de securite de l'etat actuel avant de restaurer
2. Decompresse l'archive
3. Restaure la base dans une transaction unique (`--single-transaction`)
4. Restaure les fichiers uploades si presents dans l'archive

### Backup/restauration en ligne de commande

```bash
# Backup manuel via Docker
docker compose exec db pg_dump -U comet comet_cedelia | gzip > backup_$(date +%Y%m%d).sql.gz

# Restaurer depuis un dump SQL
gunzip -c backup_20240101.sql.gz | docker compose exec -T db psql -U comet comet_cedelia

# Copier un backup hors du conteneur
docker compose cp app:/app/backups/backup_auto_2024-01-01.tar.gz ./

# Uploader un backup dans le conteneur
docker compose cp ./backup.tar.gz app:/app/backups/
```

---

## Commandes utiles

```bash
# Demarrer / arreter
docker compose up -d
docker compose down

# Logs (temps reel)
docker compose logs -f app

# Statut des services
docker compose ps

# Redemarrer l'application
docker compose restart app

# Ouvrir un shell dans le conteneur
docker compose exec app sh

# Acceder a la base directement
docker compose exec db psql -U comet comet_cedelia
```

### Mise a jour

```bash
git pull
docker compose up -d --build
```

Les migrations sont appliquees automatiquement au demarrage.

### Reset complet (supprime toutes les donnees)

```bash
docker compose down -v
docker compose up -d
```

---

## Fonctionnalites

- **Dashboard** — Statistiques, graphiques, echeances a venir, widgets personnalisables
- **Clients** — Fiches avec logo, coordonnees, contacts, timeline unifiee, portail client
- **Installations** — Suivi des garanties avec compte a rebours, historique, edition inline
- **Produits** — Catalogue avec famille, fournisseur, duree de garantie
- **Board** — Kanban drag-and-drop avec colonnes, cartes, tags, checklist, commentaires, pieces jointes
- **Factures** — Import, consultation, liaison aux installations
- **Rapports PDF** — 4 templates (classique, corporate, executive, personnalise) + editeur de page de garde
- **Tickets** — Systeme de tickets avec portail client, synchronisation Atera bidirectionnelle
- **Base de connaissances** — Articles internes ou publies vers le portail
- **Ecran d'affichage** — Systeme de widgets pour ecrans (alertes critiques, videos, Spotify, meteo)
- **Synchronisation Axonaut** — Import automatique clients, produits, factures
- **Notifications** — Alertes email SMTP + in-app avec preferences par utilisateur
- **Sauvegardes** — Automatiques avec rotation, stockage local + cloud (S3/FTP)
- **Import/Export** — CSV et Excel avec detection des doublons
- **Securite** — Roles Admin/Utilisateur, headers securite (HSTS, CSP), chiffrement des secrets

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, Tailwind CSS 4 |
| Base de donnees | PostgreSQL 16 |
| ORM | Prisma 5 |
| Auth | NextAuth v5 (credentials) |
| Graphiques | Recharts |
| Drag & Drop | @dnd-kit |
| Email | Nodemailer |
| Deploiement | Docker (multi-stage, Alpine) |

---

## Developpement local

```bash
# Prerequisites : Node.js 20+, PostgreSQL 16+
npm install --legacy-peer-deps

cp .env.example .env
# Modifier DATABASE_URL pour pointer vers localhost

npm run db:push      # Appliquer le schema
npm run db:seed      # Creer l'admin
npm run dev          # Lancer en dev
```

### Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de dev (hot reload) |
| `npm run build` | Build production |
| `npm start` | Lancer en production |
| `npm run db:push` | Appliquer le schema Prisma (dev) |
| `npm run db:migrate` | Deployer les migrations (prod) |
| `npm run db:seed` | Creer l'utilisateur admin |
| `npm run db:studio` | Interface visuelle Prisma Studio |
| `npm test` | Lancer les tests (Vitest) |

---

## Architecture

```
src/
  app/
    (dashboard)/         # Pages protegees (admin)
      board/             # Kanban + ecran d'affichage
      clients/           # Fiches clients + rapports + timeline
      dashboard/         # Vue d'ensemble
      installations/     # Suivi des installations
      invoices/          # Factures
      knowledge/         # Base de connaissances
      products/          # Catalogue produits
      settings/          # Parametres + editeur de couverture
      sync/              # Synchronisation Axonaut
      tickets/           # Ticketing
    api/                 # Routes API REST
    portal/              # Portail client (auth JWT separee)
  components/
    layout/              # Sidebar, Header, Notifications
    ui/                  # DataTable, RichTextEditor, StatusBadge...
  lib/
    auth.ts              # Configuration NextAuth
    backup.ts            # Systeme de sauvegarde
    backup-cloud.ts      # Upload S3/FTP
    cron-scheduler.ts    # Planificateur de taches
    crypto.ts            # Chiffrement des secrets
    db.ts                # Client Prisma
    email.ts             # Envoi d'emails SMTP
    notifications.ts     # Notifications in-app
  middleware.ts          # Protection des routes + headers securite
scripts/
  setup.sh               # Installation automatique
  entrypoint.sh          # Point d'entree Docker
prisma/
  schema.prisma          # Schema de la base de donnees
  migrations/            # Historique des migrations
  seed.ts                # Seed initial (admin)
```

---

## Depannage

| Probleme | Solution |
|----------|----------|
| L'app ne demarre pas | `docker compose logs app` — verifier les erreurs |
| Erreur connexion DB | Verifier que `POSTGRES_PASSWORD` correspond dans `DATABASE_URL` |
| Port 3000 occupe | Changer `APP_PORT` dans `.env` |
| Migrations echouent | `docker compose logs app` — verifier l'acces DB |
| Emails ne partent pas | Parametres > Alertes Email > tester la config SMTP |
| HTTPS ne fonctionne pas | Verifier le DNS (A record) et le reverse proxy |
| Backup echoue | Verifier les logs : `docker compose logs app \| grep backup` |
| WARNING ENCRYPTION_KEY | Generer : `openssl rand -hex 32` et ajouter dans `.env` |
| WARNING AUTH_SECRET | Generer : `openssl rand -base64 32` et ajouter dans `.env` |

---

## Licence

Projet interne CEDELIA.
