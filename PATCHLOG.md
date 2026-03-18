# PATCHLOG — COMET CEDELIA

## 2026-03-18

### Fonctionnalité — Debounce sur les recherches
- Toutes les barres de recherche (installations, clients, produits, factures) attendent 300ms avant de lancer la requête
- Réduit considérablement le nombre de requêtes API pendant la saisie

### Fonctionnalité — Pages d'erreur
- Page 404 personnalisée avec bouton retour au tableau de bord
- Error boundary sur le dashboard avec bouton "Réessayer" et référence d'erreur

### Fonctionnalité — Validation Zod sur les API
- Validation stricte des données entrantes sur les endpoints installations (PATCH/POST) et notifications
- Messages d'erreur détaillés par champ en cas de données invalides
- Schémas réutilisables dans `src/lib/validations.ts`

### Fonctionnalité — Soft delete (corbeille)
- Les suppressions de clients, produits et installations sont désormais réversibles (champ `deletedAt`)
- Les éléments supprimés sont masqués des listes mais conservés en base
- Endpoint `/api/installations/restore` pour restaurer des éléments supprimés
- Index DB sur `deletedAt` pour les performances

### Fonctionnalité — Journal d'activité global
- Nouveau modèle `ActivityLog` : suivi de toutes les actions (CREATE, UPDATE, DELETE, RESTORE, EXPORT, BULK_*)
- Page `/activity` accessible depuis la sidebar (réservée aux admins)
- Filtrage par entité et par type d'action
- Logging automatique sur les modifications d'installations, suppressions, exports CSV

### Fonctionnalité — Opérations en lot (bulk)
- Sélection multiple via checkboxes dans le tableau des installations
- Barre d'actions groupées : changer le statut, supprimer en lot
- Endpoint `/api/installations/bulk` avec validation Zod
- Confirmation avant suppression en lot

### Fonctionnalité — Dark mode
- Thème sombre complet : sidebar, header, tableaux, pages
- Sélecteur dans le header : Clair / Sombre / Système
- Préférence sauvegardée en localStorage
- Pas de flash au chargement (script inline pré-rendu)
- Support du `prefers-color-scheme` du système

### Sécurité — Audit et corrections de sécurité
- **Stack traces** : suppression de l'exposition des traces d'erreur dans les réponses API (notifications, sync)
- **Endpoint cron** : `CRON_SECRET` désormais obligatoire, secret passé via header `x-cron-secret` (plus en query param)
- **CSV injection** : protection contre l'injection de formules Excel (=, +, -, @) dans les exports CSV
- **Pagination** : validation stricte des paramètres `page` (min 1) et `limit` (min 1, max 200) sur toutes les routes
- **Export** : limite de 10 000 lignes maximum par export CSV pour éviter les surcharges mémoire

### Optimisation — Performance du code
- **Axonaut config** : 2 requêtes DB fusionnées en 1 seule pour charger la configuration API
- **Installation détail** : utilisation de `select` sur les factures pour réduire la taille des réponses
- **DataTable** : `useMemo` sur le tri pour éviter le recalcul à chaque rendu

### Correctif — Historique des modifications toujours visible
- La section "Historique des modifications" sur la page installation est désormais toujours affichée
- Quand il n'y a aucune entrée, un message explicatif s'affiche à la place

### Correctif — Génération PDF réelle pour les rapports
- Le téléchargement de rapport génère maintenant un vrai fichier PDF via html2pdf.js

### Sécurité — Configuration SMTP réservée aux admins
- Seuls les utilisateurs avec le rôle admin peuvent accéder et modifier la configuration SMTP

### Amélioration — Explication des rôles à la création d'utilisateur
- Un encart explicatif détaille les différences entre les rôles admin et utilisateur dans le formulaire de création

### Sécurité — Sections admin-only dans les paramètres
- Les sections sensibles (SMTP, gestion utilisateurs, paramètres avancés) sont masquées pour les non-admins
- Réorganisation de la grille des paramètres

### Correctif — Page installation, téléchargement PDF, mini donut chart
- Corrections multiples sur la page installation
- Le téléchargement PDF fonctionne correctement
- Le mini graphique donut est affiché à côté du nom client

### Fonctionnalité — Messages broadcast
- Les admins peuvent diffuser des messages à tous les utilisateurs via un éditeur rich text

### Fonctionnalité — Recalcul automatique des dates, audit, export PDF, fusion produits
- Recalcul automatique des dates de garantie lors de modifications
- Historique d'audit sur les installations
- Export PDF depuis la fiche installation
- Fusion de produits en doublon
- Validation des doublons à l'import

### Fonctionnalité — Fusion clients, sélecteur par page, corrections rapports
- Fusion de fiches client en doublon
- Sélecteur du nombre d'éléments par page sur les tableaux
- Correction des dates et de l'ordre des colonnes dans les rapports

### Correctif — Encodage UTF-8 pour import/export CSV
- Support complet de l'encodage UTF-8 pour les fichiers CSV importés et exportés

### Amélioration — Dropdown famille/fournisseur, colonne quantité, Com Parc éditable
- Les champs famille et fournisseur utilisent des listes déroulantes
- Ajout d'une colonne quantité sur la page client
- Le champ Com Parc est éditable avec un bouton crayon

### Fonctionnalité — Édition inline de tous les champs installation
- Famille, fournisseur, dates, durée et quantité sont modifiables directement dans le tableau

### Correctif — Largeur colonne durée, recherche sur page client
- La colonne durée ne déborde plus
- Élargissement du nom produit et ajout d'une barre de recherche sur la page client

### Correctif — Logique boutons installation et tableaux
- Correction de la logique d'affichage des boutons sur les installations
- Amélioration des mises en page des tableaux

### Fonctionnalité — Champ Com Parc et création installation depuis factures
- Ajout du champ "Com Parc" (commentaire parc) sur les installations
- Possibilité de créer une installation directement depuis une facture

### Correctif — Retour à la ligne sur colonnes statut du rapport
- Les colonnes statut dans les rapports autorisent le retour à la ligne

### Correctif — Liens cliquables dans les emails d'alerte
- Les liens dans les emails d'alerte de garantie sont maintenant cliquables
- Le champ EMAIL_ALERT est masqué de l'historique de synchronisation

### Correctif — Docker et cron
- Ajout de `curl` dans le Dockerfile pour que le cron de vérification fonctionne

### Correctif — Rapport colonnes et logs cron
- Les colonnes du rapport utilisent `nowrap` pour éviter les retours à la ligne indésirables
- Ajout de logs pour le diagnostic des alertes cron

### Correctif — Largeur nom produit dans les rapports
- Réduction de la largeur du nom produit à 35% et `nowrap` sur les cellules
