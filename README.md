# COMET - CEDELIA

Plateforme de suivi des garanties et installations informatiques pour CEDELIA. Permet de gérer les clients, produits, factures et installations avec un suivi en temps réel des échéances de garantie.

## Fonctionnalités

- **Dashboard** — Vue d'ensemble avec statistiques, graphiques de répartition (famille/fournisseur), échéances à venir
- **Gestion des installations** — Suivi du statut (En parc, Hors parc, Renouvelé, Toujours en parc) avec compte à rebours
- **Gestion des clients** — Fiches client avec logo, coordonnées, historique des installations et factures
- **Gestion des produits** — Catalogue produits avec famille, fournisseur, durée de garantie
- **Factures** — Import et consultation des factures liées aux installations
- **Rapports PDF** — Génération de rapports personnalisables par client (page de garde, statistiques, groupement par famille/date)
- **Synchronisation Axonaut** — Import automatique des données depuis l'API Axonaut (clients, produits, factures)
- **Notifications email** — Alertes SMTP configurables pour les garanties arrivant à échéance
- **Import CSV** — Import en masse des installations
- **Personnalisation** — Logo du site, favicon, couleurs des rapports, orientation, éléments visibles

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19, Tailwind CSS 4 |
| Base de données | PostgreSQL 16 |
| ORM | Prisma 5 |
| Authentification | NextAuth v5 (credentials) |
| Graphiques | Recharts |
| Icônes | Lucide React |
| Email | Nodemailer |
| Déploiement | Docker (multi-stage build) |

## Prérequis

- **Docker** et **Docker Compose** (recommandé)
- Ou : Node.js 20+, PostgreSQL 16+

## Installation rapide (Docker)

```bash
# Cloner le projet
git clone <repo-url> comet && cd comet

# Copier la configuration
cp .env.example .env

# Éditer les variables d'environnement
# AUTH_SECRET : générer avec `openssl rand -base64 32`
# AXONAUT_API_KEY : votre clé API Axonaut (optionnel)

# Lancer
docker compose up -d
```

L'application est accessible sur **http://localhost:3000**.

## Installation manuelle

```bash
# Installer les dépendances
npm install

# Configurer la base de données
cp .env.example .env
# Éditer .env avec votre DATABASE_URL PostgreSQL

# Appliquer le schéma
npm run db:push

# Lancer en développement
npm run dev

# Ou build + production
npm run build && npm start
```

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://comet:comet_password@localhost:5432/comet_cedelia` |
| `AUTH_SECRET` | Secret NextAuth (obligatoire) | — |
| `AUTH_URL` | URL publique de l'app | `http://localhost:3000` |
| `AXONAUT_API_KEY` | Clé API Axonaut | — |
| `AXONAUT_API_URL` | URL de l'API Axonaut | `https://axonaut.com/api/v2` |

## Scripts disponibles

```bash
npm run dev          # Serveur de développement
npm run build        # Build production
npm start            # Lancer en production
npm run lint         # Linter ESLint
npm run db:push      # Appliquer le schéma Prisma
npm run db:migrate   # Déployer les migrations
npm run db:seed      # Seed initial (utilisateur admin)
npm run db:studio    # Interface Prisma Studio
```

## Structure du projet

```
src/
├── app/
│   ├── (auth)/login/        # Page de connexion
│   ├── (dashboard)/         # Pages protégées
│   │   ├── dashboard/       # Tableau de bord
│   │   ├── clients/         # Gestion clients
│   │   ├── installations/   # Suivi installations
│   │   ├── products/        # Catalogue produits
│   │   ├── invoices/        # Factures
│   │   ├── renewed/         # Produits renouvelés
│   │   ├── settings/        # Paramètres
│   │   └── sync/            # Synchronisation Axonaut
│   └── api/                 # Routes API REST
├── components/
│   ├── layout/              # Sidebar, Header
│   └── ui/                  # DataTable, StatusBadge, StatCard, etc.
├── lib/
│   ├── auth.ts              # Configuration NextAuth
│   ├── db.ts                # Client Prisma (singleton)
│   ├── axonaut.ts           # Client API Axonaut
│   ├── email.ts             # Envoi d'emails SMTP
│   ├── auto-status.ts       # Correction automatique des statuts
│   └── utils.ts             # Fonctions utilitaires
└── middleware.ts             # Protection des routes
```

## Modèle de données

```
Client ──< Installation >── Product
  │              │
  └──< Invoice >─┘
         │
         └──< InvoiceLine >── Product
```

- **Client** — Entreprise avec coordonnées et logo
- **Product** — Produit avec famille, fournisseur, durée de garantie
- **Installation** — Lien client-produit avec dates de garantie et statut
- **Invoice** — Facture avec lignes détaillées
- **Setting** — Configuration clé-valeur (paramètres app, rapports, SMTP)

## Statuts des installations

| Statut | Description |
|--------|-------------|
| `EN_PARC` | Installation active, garantie valide |
| `HORS_PARC` | Garantie expirée |
| `RENOUVELE` | Installation renouvelée |
| `Toujours en parc` | Maintenu en parc manuellement (flag `alwaysInFleet`) |

La correction automatique remet en `EN_PARC` toute installation dont la garantie est encore valide mais marquée `HORS_PARC`.

## Licence

Projet interne CEDELIA.
