# PATCHLOG — COMET CEDELIA

---

## v1.4.0 — 2026-03-19

### Fonctionnalité — Résolution des doublons à l'import CSV
- Lors de la vérification pré-import, 3 stratégies proposées : ignorer, mettre à jour, forcer l'import
- Cases à cocher par ligne pour ignorer individuellement les doublons en mode "skip"
- Compteur "Mises à jour" dans les résultats (étape 3)

### Fonctionnalité — Barre de progression d'import
- Barre de progression visuelle pendant l'upload et le traitement serveur
- Deux phases : envoi du fichier (0–50%) et traitement serveur (50–100%)
- Utilisation de XMLHttpRequest pour le suivi temps réel de l'upload

### Amélioration — Dark mode complet sur le dashboard
- Tous les panneaux (graphiques, listes, statistiques) supportent le dark mode
- Variables CSS pour les tooltips, axes, grilles et légendes des graphiques Recharts
- StatCard, panneaux d'expiration, résumé financier, top clients : tous corrigés
- Panneaux d'ajout et modales adaptés au thème sombre

### Amélioration — Réorganisation de la navigation
- Import/Export, Synchronisation et Journal d'activité retirés de la sidebar
- Nouvelle section "Outils" dans les Paramètres avec des liens vers ces 3 pages
- Sidebar allégée et plus lisible

### Amélioration — Journal d'activité enrichi
- Entrées groupées par date avec séparateurs visuels
- Icône et badge coloré par type d'action (Création, Modification, Suppression, etc.)
- Badge entité (Client, Produit, Installation, Facture)
- Lien direct "Voir" vers l'entité concernée
- Temps relatif affiché ("Il y a 5 min", "Il y a 2h")
- Bouton "Réinitialiser les filtres" et compteur total d'entrées

---

## v1.3.0 — 2026-03-18

### Fonctionnalité — 7 fonctionnalités majeures
- **Debounce sur les recherches** : toutes les barres de recherche (installations, clients, produits, factures) attendent 300ms avant de lancer la requête
- **Pages d'erreur** : page 404 personnalisée + error boundary sur le dashboard avec bouton "Réessayer"
- **Validation Zod** : validation stricte sur les endpoints installations (PATCH/POST) et notifications, schémas dans `src/lib/validations.ts`
- **Soft delete (corbeille)** : suppressions réversibles via champ `deletedAt`, endpoint `/api/installations/restore`
- **Journal d'activité global** : modèle `ActivityLog`, page `/activity`, filtrage par entité et action
- **Opérations en lot (bulk)** : sélection multiple, barre d'actions groupées, endpoint `/api/installations/bulk`
- **Dark mode** : thème sombre complet, sélecteur Clair/Sombre/Système, sauvegarde en localStorage, pas de flash au chargement

### Sécurité — Audit complet et corrections
- Suppression de l'exposition des stack traces dans les réponses API
- `CRON_SECRET` obligatoire, passé via header `x-cron-secret`
- Protection contre l'injection de formules Excel dans les exports CSV
- Validation stricte de la pagination (`page` min 1, `limit` min 1 max 200)
- Limite de 10 000 lignes maximum par export CSV

### Optimisation — Performance du code
- Configuration Axonaut : 2 requêtes DB fusionnées en 1
- Installation détail : `select` sur les factures pour réduire la taille des réponses
- DataTable : `useMemo` sur le tri pour éviter le recalcul à chaque rendu

### Correctif — Historique des modifications toujours visible
- Section "Historique des modifications" toujours affichée sur la page installation
- Message explicatif quand il n'y a aucune entrée

### Correctif — Génération PDF réelle pour les rapports
- Téléchargement de rapport génère un vrai fichier PDF via html2pdf.js

### Sécurité — Configuration SMTP réservée aux admins
- Seuls les admins peuvent accéder et modifier la configuration SMTP

### Amélioration — Explication des rôles utilisateur
- Encart explicatif des différences admin/utilisateur dans le formulaire de création

### Sécurité — Sections admin-only dans les paramètres
- Sections sensibles (SMTP, utilisateurs, paramètres avancés) masquées pour les non-admins

### Correctif — Page installation, PDF, mini donut chart
- Corrections multiples sur la page installation
- Téléchargement PDF fonctionnel
- Mini graphique donut affiché à côté du nom client

### Fonctionnalité — Messages broadcast
- Diffusion de messages à tous les utilisateurs via éditeur rich text (admin)

---

## v1.2.0 — 2026-03-17

### Fonctionnalité — Recalcul automatique, audit, export PDF, fusion produits
- Recalcul automatique des dates de garantie lors de modifications
- Historique d'audit sur les installations
- Export PDF depuis la fiche installation
- Fusion de produits en doublon
- Validation des doublons à l'import

### Fonctionnalité — Fusion clients, sélecteur par page, rapports
- Fusion de fiches client en doublon
- Sélecteur du nombre d'éléments par page sur les tableaux
- Correction des dates et de l'ordre des colonnes dans les rapports

### Correctif — Encodage UTF-8 pour import/export CSV
- Support complet de l'encodage UTF-8 avec BOM pour les fichiers CSV

### Amélioration — Dropdown famille/fournisseur, quantité, Com Parc
- Champs famille et fournisseur en listes déroulantes
- Colonne quantité sur la page client
- Champ Com Parc éditable avec bouton crayon

### Fonctionnalité — Édition inline de tous les champs installation
- Famille, fournisseur, dates, durée et quantité modifiables directement dans le tableau

### Correctif — Largeur colonne durée, recherche page client
- Colonne durée ne déborde plus
- Élargissement du nom produit, barre de recherche sur la page client

### Correctif — Logique boutons installation et tableaux
- Correction de la logique d'affichage des boutons
- Amélioration des mises en page des tableaux

### Fonctionnalité — Champ Com Parc et création depuis factures
- Ajout du champ "Com Parc" (commentaire parc) sur les installations
- Création d'une installation directement depuis une facture

### Correctif — Retour à la ligne colonnes statut du rapport
- Les colonnes statut dans les rapports autorisent le retour à la ligne

### Correctif — Liens cliquables dans les emails d'alerte
- Liens dans les emails d'alerte de garantie maintenant cliquables
- Champ EMAIL_ALERT masqué de l'historique de synchronisation

### Correctif — Docker et cron
- Ajout de `curl` dans le Dockerfile pour le cron de vérification

### Correctif — Rapport colonnes et logs cron
- Colonnes du rapport en `nowrap` pour éviter les retours à la ligne indésirables
- Ajout de logs pour le diagnostic des alertes cron

### Correctif — Largeur nom produit dans les rapports
- Réduction de la largeur du nom produit à 35% et `nowrap` sur les cellules

### Fonctionnalité — Dashboard personnalisable + planification alertes email
- Panneaux réorganisables par drag & drop
- Ajout/suppression de panneaux, taille ajustable
- Registre de 13 panneaux différents (stats, graphiques, listes)
- Planification des alertes email : fréquence, jours, seuils

### Fonctionnalité — Animation logo comète
- Animation d'explosion de météore sur le logo du dashboard
- L'animation ouvre un iframe vers cedelia.fr
- Utilise le logo branding uploadé

### Fonctionnalité — Import/Export CSV complet
- Nouveau module d'import CSV avec mapping de colonnes intelligent
- Auto-détection du séparateur et des colonnes via alias
- Prévisualisation des données avant import
- Section export avec 4 types de données (installations, clients, produits, factures)

### Fonctionnalité — Mot de passe oublié + alertes SMTP
- Page de réinitialisation de mot de passe
- Alertes SMTP configurables avec test d'envoi

### Amélioration — Colonnes élargies, suppression données, test email
- Colonnes élargies dans les tableaux
- Suppression de données en masse (admin)
- Test d'envoi email depuis les paramètres
- Déconnexion traduite en français

### Correctif — SSL email, image fond rapport, quantité rapport
- Correction de la connexion SSL pour l'envoi d'email
- Image de fond personnalisable sur le rapport
- Nom produit élargi à 50%, quantité dans les rapports

### Amélioration — Opacité image fond rapport, couverture pleine page
- Curseur d'opacité pour l'image de fond du rapport
- Page de couverture en pleine page
- Correction des alertes cron

### Correctif — Marges pages de détail du rapport
- Réduction des marges sur les pages de détail

---

## v1.1.0 — 2026-03-16

### Fonctionnalité — Statut "Toujours en parc" et page renouvelés
- Nouveau statut "Toujours en parc" pour les installations actives hors garantie
- Page dédiée `/renewed` pour les installations renouvelées
- Correction de la pagination lors de la synchronisation Axonaut

### Fonctionnalité — Tri colonnes, actions rapides, filtres dashboard
- Colonnes triables dans tous les tableaux
- Actions rapides sur les lignes d'installation
- Filtres cliquables sur les stats du dashboard
- Favicon personnalisé

### Correctif — Auto-correction statut garantie
- Si la garantie est encore valide, le statut repasse automatiquement à "En parc"

### Amélioration — Tableaux, rapports, statuts et favicon
- Améliorations multiples des tableaux et de l'affichage des statuts
- Corrections sur les rapports PDF
- Favicon mis à jour

### Fonctionnalité — Cartes stats cliquables, jours restants, titre rapport
- Les cartes statistiques du dashboard sont cliquables et redirigent vers les listes filtrées
- Jours restants affichés dans les rapports
- Titre de rapport personnalisable
- Option pour afficher les renouvelés dans les rapports

### Fonctionnalité — Import CSV factures/produits/installations
- Première version de l'import CSV depuis la sidebar
- Support des factures, produits et installations

### Correctif — Texte vertical rapport et refresh Axonaut
- Texte vertical du nom client réduit de 40%, centré à l'impression
- Correction du refresh individuel Axonaut

### Correctif — Migration purchasePrice
- Ajout de la migration SQL pour la colonne `purchasePrice` manquante
- Correction du nom de table (`invoice_lines`)

### Correctif — Rafraîchissement factures Axonaut
- Gestion du 404 avec fallback sur recherche paginée
- Limitation à 3 pages pour éviter le blocage
- Essai des endpoints directs puis recherche sur toutes les pages

### Correctif — Encodage Windows-1252 pour CSV
- Détection automatique de l'encodage (UTF-8 / Windows-1252 / Latin-1)
- Support des accents français dans les imports CSV

### Correctif — Rate limiting et backoff exponentiel
- Backoff exponentiel pour les erreurs 429 (rate limit Axonaut)
- Réduction de la logique dupliquée dans les appels API

### Correctif — Progression synchronisation et logs
- Affichage de la progression de la synchronisation en temps réel
- Nettoyage des logs obsolètes
- Correction du rafraîchissement des factures

### Correctif — Noms de produits tronqués
- Troncature des noms de produits trop longs dans la liste produits

---

## v1.0.0 — 2026-03-16

### Fonctionnalité — Logo site et paramètres rapport étendus
- Personnalisation du logo du site (sidebar + page de connexion)
- Paramètres étendus pour les rapports : couleur principale, stats, famille, fournisseur, durée, orientation

### Fonctionnalité — Texte vertical sur la couverture du rapport
- Nom de l'entreprise affiché verticalement sur la page de couverture du rapport

### Correctif — Nom de société visible sur le rapport
- Le nom de société est correctement affiché sur le rapport
- Le logo uploadé est utilisé comme favicon

### Fonctionnalité — Nom client vertical sur rapport + actualiser individuel
- Nom du client affiché verticalement dans le rapport
- Bouton d'actualisation individuel pour chaque facture Axonaut

---

## v0.9.0 — 2026-03-12

### Fonctionnalité — Notifications et alertes de garantie
- Cloche de notification dans le header avec alertes d'expiration de garantie
- Notifications individuelles supprimables + "Tout effacer"
- Préférence sauvegardée côté serveur

### Fonctionnalité — Site responsive mobile
- Sidebar mobile avec hamburger menu et overlay
- Tous les tableaux et pages adaptés aux petits écrans
- Header et formulaires responsives

### Fonctionnalité — Logo et favicon
- Logo comète comme favicon et icône sidebar
- Titre de l'application mis à jour

### Correctif — SMTP email
- Auto-détection du mode TLS depuis le port
- Correction de l'erreur SSL version
- Le test SMTP utilise les valeurs du formulaire (pas seulement la DB)

### Correctif — Filtre liste clients
- Correction du filtre pour `clientType` null
- Utilisation d'une requête Prisma typée avec `OR`
- Ajout du compteur renouvelés dans les rapports imprimés

---

## v0.8.0 — 2026-03-12

### Amélioration — Conversion thème clair
- Conversion complète de l'application du thème sombre vers un thème clair/blanc
- Toutes les pages, sidebar, header, tableaux, cartes

### Correctif — Synchronisation et paramètres
- Correction de la suppression lors de la synchronisation
- Réorganisation du layout des paramètres
- Correction du filtrage clients
- Logique de statut des installations corrigée

### Correctif — Sauvegarde automatique du statut
- Le changement de statut d'une installation est sauvegardé automatiquement

---

## v0.7.0 — 2026-03-11

### Fonctionnalité — Tri tableaux, logos clients, impression rapports, statuts
- Tri des colonnes dans tous les tableaux de données
- Logos clients affichés (depuis Axonaut)
- Impression et export des rapports
- Amélioration de l'affichage des statuts

### Amélioration — Logo entreprise sur rapport, statuts colorés, suppression, thème léger
- Logo de l'entreprise sur la page de couverture du rapport
- Badges de statut colorés
- Actions de suppression sur les installations
- Thème visuel allégé

### Fonctionnalité — Refonte des statuts installations
- Nouveaux statuts métier : En parc, En parc (garantie), Hors parc, Renouvelé
- Rapport avec fond blanc, tri par famille/date
- Modification de la date de fin de garantie

---

## v0.6.0 — 2026-03-11

### Fonctionnalité — Dashboard interactif et gestion utilisateurs
- Éléments du dashboard cliquables (graphiques, cartes)
- Page de gestion des utilisateurs (admin)
- Rôles et permissions

### Fonctionnalité — Graphiques FR, page produit, notifications SMTP
- Dates françaises sur les graphiques (mois/année)
- Page de détail produit
- Configuration et envoi de notifications SMTP

### Correctif — Dépendances et Docker
- Résolution du conflit de peer dependency nodemailer
- Correction du Dockerfile
- Suppression de `npx prisma migrate deploy` du CMD
- Auto-migration enum vers text au démarrage du container
- Correction de l'entrypoint pour Alpine Linux (sed → cut)
- Ajout de `linux-musl-openssl-3.0.x` dans les binaryTargets Prisma

---

## v0.5.0 — 2026-03-11

### Fonctionnalité — Endpoint diagnostic et parsing Axonaut
- Endpoint de diagnostic pour la synchronisation Axonaut
- Parsing robuste des custom_fields Axonaut

### Correctif — Génération des installations
- Correction de l'enum vers String pour les statuts
- Rate limiting sur les appels API
- Tracking des doublons avec identifiants uniques

---

## v0.4.0 — 2026-03-10

### Fonctionnalité — Statuts métier et suivi d'échéances
- Remplacement des statuts par des termes métier (En parc, Hors parc, etc.)
- Compteur de jours restants avant expiration
- Codes couleur selon l'urgence (vert, orange, rouge)

---

## v0.3.0 — 2026-03-10

### Fonctionnalité — Page Factures + correction synchronisation
- Nouvelle page de gestion des factures
- Correction de la synchronisation qui ne produisait pas d'installations

---

## v0.2.0 — 2026-03-10

### Correctif — Parsing API Axonaut
- Les valeurs numériques de l'API Axonaut sont maintenant parsées en float
- Correction des prix d'achat et de vente

---

## v0.1.0 — 2026-03-10

### Première version — Application COMET CEDELIA
- Application SaaS complète pour le suivi de matériel informatique
- Synchronisation avec l'API Axonaut (clients, factures, produits)
- Dashboard avec statistiques et graphiques
- Gestion des installations avec suivi de garantie
- Gestion des clients, produits et factures
- Authentification utilisateur (NextAuth)
- Base de données PostgreSQL avec Prisma ORM
- Interface responsive avec Tailwind CSS
- Déploiement Docker avec docker-compose
