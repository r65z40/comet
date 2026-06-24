# Installation COMET sur Windows — Guide complet

Ce guide detaille chaque etape pour installer et faire tourner COMET sur un PC ou serveur Windows avec Docker Desktop.

---

## Table des matieres

1. [Verifier la compatibilite de votre PC](#1-verifier-la-compatibilite-de-votre-pc)
2. [Activer WSL 2](#2-activer-wsl-2)
3. [Installer Docker Desktop](#3-installer-docker-desktop)
4. [Installer Git pour Windows](#4-installer-git-pour-windows)
5. [Telecharger le projet COMET](#5-telecharger-le-projet-comet)
6. [Lancer l'installation automatique](#6-lancer-linstallation-automatique)
7. [Installation manuelle (alternative)](#7-installation-manuelle-alternative)
8. [Premier acces a COMET](#8-premier-acces-a-comet)
9. [Configuration apres installation](#9-configuration-apres-installation)
10. [Commandes courantes](#10-commandes-courantes)
11. [Mise a jour de COMET](#11-mise-a-jour-de-comet)
12. [Sauvegardes](#12-sauvegardes)
13. [Exposer COMET sur le reseau local](#13-exposer-comet-sur-le-reseau-local)
14. [Exposer COMET sur Internet (HTTPS)](#14-exposer-comet-sur-internet-https)
15. [Demarrage automatique au boot](#15-demarrage-automatique-au-boot)
16. [Depannage](#16-depannage)

---

## 1. Verifier la compatibilite de votre PC

### Configuration minimale

| Element | Minimum | Recommande |
|---------|---------|------------|
| Systeme | Windows 10 v2004+ ou Windows 11 | Windows 11 23H2+ |
| Processeur | 64-bit avec virtualisation (VT-x/AMD-V) | 4 coeurs+ |
| RAM | 4 Go | 8 Go+ |
| Disque | 10 Go libres | SSD avec 20 Go+ libres |

### Verifier la virtualisation

La virtualisation materielle doit etre activee dans le BIOS/UEFI.

1. Ouvrir le **Gestionnaire des taches** (`Ctrl+Shift+Echap`)
2. Onglet **Performance** > **Processeur**
3. En bas a droite, verifier que **Virtualisation : Active** est affiche

Si la virtualisation est **Desactivee** :
- Redemarrer le PC
- Entrer dans le BIOS/UEFI (touche `F2`, `F10`, `DEL` ou `Esc` au demarrage selon la marque)
- Chercher **Intel VT-x**, **Intel Virtualization Technology**, ou **AMD-V / SVM Mode**
- Activer l'option et sauvegarder

### Verifier la version de Windows

```powershell
winver
```

Vous devez avoir **Windows 10 version 2004** (build 19041) ou plus recent, ou **Windows 11**.

---

## 2. Activer WSL 2

WSL 2 (Windows Subsystem for Linux) est necessaire pour Docker Desktop. Il permet d'executer des conteneurs Linux nativement.

### Installation rapide

Ouvrir **PowerShell en administrateur** :
- Clic droit sur le bouton Demarrer > **Terminal (administrateur)** ou **PowerShell (administrateur)**

```powershell
wsl --install
```

Cette commande :
- Active la fonctionnalite WSL
- Active la plateforme de machine virtuelle
- Installe WSL 2 avec Ubuntu par defaut

**Redemarrer le PC** quand demande.

### Verifier que WSL 2 fonctionne

Apres le redemarrage, ouvrir PowerShell :

```powershell
wsl --version
```

Vous devriez voir quelque chose comme :

```
Version WSL : 2.x.x.x
Version du noyau : 5.15.x
```

Si WSL 1 est installe a la place, forcer WSL 2 :

```powershell
wsl --set-default-version 2
```

### Si `wsl --install` ne fonctionne pas

Sur les anciennes versions de Windows 10, activer manuellement :

```powershell
# Activer WSL
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Activer la plateforme VM
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

Redemarrer, puis telecharger et installer le **package de mise a jour du noyau Linux WSL 2** depuis :
https://aka.ms/wsl2kernel

Puis :

```powershell
wsl --set-default-version 2
```

---

## 3. Installer Docker Desktop

### Telecharger

Aller sur : **https://docs.docker.com/desktop/install/windows-install/**

Cliquer sur **"Docker Desktop for Windows"** pour telecharger l'installeur.

### Installer

1. Lancer **Docker Desktop Installer.exe**
2. A l'ecran de configuration, **cocher** :
   - **Use WSL 2 instead of Hyper-V** (important)
   - **Add shortcut to desktop** (optionnel)
3. Cliquer **Ok** et attendre la fin de l'installation
4. **Redemarrer le PC** si demande

### Premier lancement

1. Lancer **Docker Desktop** depuis le menu Demarrer ou le raccourci bureau
2. Accepter les conditions d'utilisation
3. Choisir **"Use recommended settings"** (ou personnaliser)
4. Attendre que le moteur Docker demarre — l'icone de la baleine dans la barre des taches devient **verte** quand c'est pret

### Verifier l'installation

Ouvrir PowerShell :

```powershell
docker --version
```

Resultat attendu : `Docker version 27.x.x` ou plus recent

```powershell
docker compose version
```

Resultat attendu : `Docker Compose version v2.x.x`

```powershell
docker run hello-world
```

Vous devriez voir `Hello from Docker!` — Docker fonctionne.

### Configurer les ressources (optionnel mais recommande)

Docker Desktop > **Settings** (icone engrenage) > **Resources** > **WSL integration** :

- S'assurer que **"Enable integration with my default WSL distro"** est coche

Docker Desktop > **Settings** > **Resources** > **Advanced** :
- **CPUs** : au moins 2 (4 recommande)
- **Memory** : au moins 2 Go (4 Go recommande)
- **Disk image size** : au moins 20 Go

Cliquer **Apply & restart**.

---

## 4. Installer Git pour Windows

Git est necessaire pour telecharger et mettre a jour le code source de COMET.

### Telecharger

Aller sur : **https://git-scm.com/download/win**

Le telechargement demarre automatiquement.

### Installer

1. Lancer l'installeur
2. **Garder les options par defaut** pour chaque ecran, sauf :
   - A l'ecran "Adjusting your PATH environment" : choisir **"Git from the command line and also from 3rd-party software"** (c'est le defaut)
   - A l'ecran "Configuring the line ending conversions" : choisir **"Checkout as-is, commit as-is"** ou garder le defaut (le `.gitattributes` du projet gere les fins de ligne)
3. Terminer l'installation

### Verifier

Ouvrir un **nouveau** PowerShell :

```powershell
git --version
```

Resultat attendu : `git version 2.x.x`

### Alternative sans Git

Si vous ne souhaitez pas installer Git, telechargez le projet en ZIP :
1. Aller sur la page GitHub du projet
2. Cliquer **Code** > **Download ZIP**
3. Extraire le ZIP dans un dossier (ex: `C:\comet`)

---

## 5. Telecharger le projet COMET

Ouvrir PowerShell et naviguer vers le dossier ou vous voulez installer COMET :

```powershell
# Par exemple sur le bureau
cd ~\Desktop

# Ou dans un dossier specifique
cd C:\

# Cloner le projet
git clone <repo-url> comet
cd comet
```

Verifier que les fichiers sont bien la :

```powershell
dir
```

Vous devez voir : `docker-compose.yml`, `Dockerfile`, `scripts\`, `src\`, `prisma\`, etc.

---

## 6. Lancer l'installation automatique

**S'assurer que Docker Desktop est lance** (icone baleine verte dans la barre des taches).

### Option A : Double-clic (le plus simple)

1. Ouvrir le dossier `comet` dans l'Explorateur de fichiers
2. Aller dans le dossier `scripts`
3. **Double-cliquer** sur `setup.bat`
4. Si Windows affiche un avertissement SmartScreen : cliquer **"Informations complementaires"** > **"Executer quand meme"**

### Option B : PowerShell

```powershell
cd C:\chemin\vers\comet
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

### Ce que fait le script

```
+==============================================+
|         COMET — Installation Windows         |
+==============================================+

[OK] Docker detecte

Creation du fichier .env...
  Secrets generes automatiquement.

--------------------------------------------
URL d'acces (ex: https://comet.mondomaine.fr)
Laisser vide pour http://localhost:3000
--------------------------------------------
>
```

1. **Verifie** que Docker est installe et lance
2. **Cree le fichier `.env`** en copiant `.env.example`
3. **Genere automatiquement** tous les secrets de securite :
   - `AUTH_SECRET` — cle de session (base64, 32 octets)
   - `ENCRYPTION_KEY` — cle de chiffrement SMTP/API (hex, 32 octets)
   - `CRON_SECRET` — secret pour les taches planifiees
   - `POSTGRES_PASSWORD` — mot de passe de la base de donnees
4. **Demande l'URL d'acces** — appuyer sur Entree pour garder `http://localhost:3000`
5. **Construit les images Docker** (3-5 minutes la premiere fois)
6. **Lance les conteneurs** (base de donnees + application)
7. **Attend** que l'application soit prete
8. **Affiche les instructions** pour se connecter

```
+==============================================+
|        Installation terminee !               |
+==============================================+

  URL: http://localhost:3000

  Identifiants admin dans les logs:
  docker compose logs app | Select-String 'Admin' -Context 0,3
```

---

## 7. Installation manuelle (alternative)

Si le script automatique ne fonctionne pas ou si vous preferez controler chaque etape.

### 7.1 Creer le fichier de configuration

```powershell
cd C:\chemin\vers\comet
copy .env.example .env
```

### 7.2 Generer les secrets

Ouvrir PowerShell et executer ces commandes pour generer des secrets aleatoires :

```powershell
# Generer AUTH_SECRET (base64, 32 octets)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])

# Generer ENCRYPTION_KEY (hex, 32 octets)
-join ((1..32) | ForEach-Object { "{0:x2}" -f (Get-Random -Max 256) })

# Generer CRON_SECRET (base64, 16 octets)
[Convert]::ToBase64String((1..16 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])

# Generer POSTGRES_PASSWORD (base64, 24 octets)
[Convert]::ToBase64String((1..24 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])
```

### 7.3 Editer le fichier .env

Ouvrir `.env` avec un editeur de texte (Bloc-notes, Notepad++, VS Code) :

```powershell
notepad .env
```

Remplacer les valeurs suivantes par les secrets generes :

```
POSTGRES_PASSWORD=<coller-le-mot-de-passe-genere>
DATABASE_URL="postgresql://comet:<meme-mot-de-passe>@db:5432/comet_cedelia?schema=public"
AUTH_SECRET="<coller-AUTH_SECRET>"
AUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="<coller-ENCRYPTION_KEY>"
CRON_SECRET="<coller-CRON_SECRET>"
```

**Important** : Le mot de passe dans `POSTGRES_PASSWORD` et dans `DATABASE_URL` doit etre **identique**.

### 7.4 Construire et lancer

```powershell
docker compose up -d --build
```

Premiere execution : environ 3-5 minutes (telechargement des images + compilation).

### 7.5 Suivre les logs

```powershell
docker compose logs -f app
```

Attendre de voir :

```
=== Starting application ===
```

Puis appuyer sur `Ctrl+C` pour quitter les logs.

---

## 8. Premier acces a COMET

### Recuperer les identifiants admin

```powershell
docker compose logs app | Select-String "Admin" -Context 0,3
```

Vous verrez quelque chose comme :

```
=========================================
Admin account created:
  Email:    admin@comet-cedelia.fr
  Password: aB3kL9mNpQ7xYz
=========================================
```

**Noter le mot de passe** — il n'est affiche qu'une seule fois.

### Se connecter

1. Ouvrir un navigateur (Chrome, Firefox, Edge)
2. Aller sur **http://localhost:3000**
3. Entrer l'email : `admin@comet-cedelia.fr`
4. Entrer le mot de passe affiche dans les logs
5. **Changer le mot de passe immediatement** : Parametres > Utilisateurs > cliquer sur l'admin

### Verifier que tout fonctionne

Apres connexion, verifier :

- Le **Dashboard** s'affiche correctement
- Le menu lateral est present (Clients, Installations, Produits, Board, etc.)
- Aller dans **Parametres** pour configurer l'application

---

## 9. Configuration apres installation

### Email SMTP (pour les alertes)

Parametres > Alertes Email > SMTP

Exemples de configuration :

| Fournisseur | Hote | Port | Securite |
|-------------|------|------|----------|
| Gmail | smtp.gmail.com | 587 | STARTTLS |
| Outlook/O365 | smtp.office365.com | 587 | STARTTLS |
| OVH | ssl0.ovh.net | 465 | SSL |
| Infomaniak | mail.infomaniak.com | 587 | STARTTLS |

Pour Gmail : utiliser un **mot de passe d'application** (pas le mot de passe du compte).

### Sauvegardes automatiques

Parametres > Sauvegarde :
- Activer les sauvegardes automatiques
- Frequence : quotidienne recommandee
- Heure : 02:00 (hors heures de travail)
- Retention : 7 (garder les 7 derniers backups)

### Apparence

Parametres > Apparence :
- Logo de l'entreprise
- Favicon
- Couleurs

---

## 10. Commandes courantes

Toutes les commandes se lancent dans **PowerShell**, depuis le dossier du projet.

### Gestion des conteneurs

```powershell
# Voir l'etat des services
docker compose ps

# Demarrer (si arrete)
docker compose up -d

# Arreter
docker compose down

# Redemarrer l'application (sans toucher a la base)
docker compose restart app

# Redemarrer tout
docker compose restart
```

### Consulter les logs

```powershell
# Logs en temps reel (Ctrl+C pour quitter)
docker compose logs -f app

# Derniers 100 lignes
docker compose logs --tail 100 app

# Logs de la base de donnees
docker compose logs db

# Chercher une erreur specifique
docker compose logs app | Select-String "error" -CaseSensitive:$false
```

### Acceder aux conteneurs

```powershell
# Shell dans le conteneur de l'application
docker compose exec app sh

# Acceder directement a la base de donnees
docker compose exec db psql -U comet comet_cedelia
```

---

## 11. Mise a jour de COMET

### Mise a jour standard

```powershell
cd C:\chemin\vers\comet

# Telecharger les dernieres modifications
git pull

# Reconstruire et relancer
docker compose up -d --build
```

Les migrations de base de donnees sont appliquees automatiquement au demarrage.

### Si la mise a jour echoue

```powershell
# Forcer la reconstruction sans cache
docker compose build --no-cache app

# Relancer
docker compose up -d
```

### Revenir a une version precedente

```powershell
# Voir l'historique des versions
git log --oneline -10

# Revenir a un commit specifique
git checkout <hash-du-commit>
docker compose up -d --build
```

---

## 12. Sauvegardes

### Via l'interface (recommande)

Parametres > Sauvegarde > **Creer un backup maintenant**

### Via PowerShell

```powershell
# Backup manuel de la base de donnees
docker compose exec db pg_dump -U comet comet_cedelia > backup.sql

# Copier un backup hors du conteneur
docker compose cp app:/app/backups/ ./mes-backups/

# Restaurer un backup SQL
Get-Content backup.sql | docker compose exec -T db psql -U comet comet_cedelia
```

### Emplacement des donnees Docker

Les volumes Docker persistent les donnees entre les redemarrages :

```powershell
# Voir les volumes
docker volume ls

# Les volumes de COMET :
# comet_postgres_data   — base de donnees
# comet_backup_data     — fichiers de backup
# comet_uploads_data    — fichiers uploades (logos, pieces jointes)
```

**Important** : `docker compose down` conserve les volumes. Seul `docker compose down -v` les supprime (perte de toutes les donnees).

---

## 13. Exposer COMET sur le reseau local

Par defaut, COMET est accessible uniquement depuis le PC ou il est installe (`localhost:3000`). Pour le rendre accessible aux autres PC du reseau :

### 1. Autoriser le port dans le pare-feu Windows

PowerShell **en administrateur** :

```powershell
New-NetFirewallRule -DisplayName "COMET" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

### 2. Trouver l'adresse IP du PC

```powershell
ipconfig
```

Chercher l'adresse **IPv4** de votre connexion (ex: `192.168.1.50`).

### 3. Acceder depuis un autre PC

Sur les autres PC du reseau, ouvrir un navigateur et aller sur :

```
http://192.168.1.50:3000
```

### 4. Mettre a jour AUTH_URL (optionnel)

Si vous accedez principalement via l'IP du reseau, modifier `.env` :

```
AUTH_URL="http://192.168.1.50:3000"
```

Puis redemarrer :

```powershell
docker compose restart app
```

---

## 14. Exposer COMET sur Internet (HTTPS)

Pour acceder a COMET depuis l'exterieur avec un nom de domaine et HTTPS.

### Option A : Caddy (Windows) — HTTPS automatique

1. Telecharger Caddy depuis https://caddyserver.com/download (Windows amd64)
2. Placer `caddy.exe` dans un dossier (ex: `C:\caddy\`)
3. Creer `C:\caddy\Caddyfile` :

```
comet.mondomaine.fr {
    reverse_proxy localhost:3000
}
```

4. Lancer Caddy :

```powershell
cd C:\caddy
.\caddy.exe run
```

Caddy obtient automatiquement un certificat HTTPS Let's Encrypt.

5. Mettre a jour `.env` :

```
AUTH_URL="https://comet.mondomaine.fr"
```

### Option B : Cloudflare Tunnel (sans ouvrir de port)

1. Installer `cloudflared` : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Se connecter :

```powershell
cloudflared tunnel login
cloudflared tunnel create comet
cloudflared tunnel route dns comet comet.mondomaine.fr
```

3. Creer `C:\Users\<vous>\.cloudflared\config.yml` :

```yaml
tunnel: <tunnel-id>
credentials-file: C:\Users\<vous>\.cloudflared\<tunnel-id>.json

ingress:
  - hostname: comet.mondomaine.fr
    service: http://localhost:3000
  - service: http_status:404
```

4. Lancer :

```powershell
cloudflared tunnel run comet
```

Avantage : pas besoin d'ouvrir des ports sur le routeur, HTTPS automatique.

---

## 15. Demarrage automatique au boot

Pour que COMET demarre automatiquement quand le PC s'allume.

### Docker Desktop au demarrage

Docker Desktop > **Settings** > **General** > cocher **"Start Docker Desktop when you sign in"**

### Conteneurs au demarrage

Les conteneurs sont deja configures avec `restart: unless-stopped` dans `docker-compose.yml`. Ils redemarrent automatiquement quand Docker Desktop demarre.

Verifier apres un redemarrage du PC :

```powershell
docker compose ps
```

Les deux services (`app` et `db`) doivent etre en statut **running**.

### Si les conteneurs ne redemarrent pas

```powershell
cd C:\chemin\vers\comet
docker compose up -d
```

Pour automatiser cette commande, creer une tache planifiee :

1. Ouvrir le **Planificateur de taches** (`taskschd.msc`)
2. **Creer une tache de base** :
   - Nom : `Comet Docker`
   - Declencheur : **Au demarrage de l'ordinateur**
   - Action : **Demarrer un programme**
   - Programme : `powershell.exe`
   - Arguments : `-WindowStyle Hidden -Command "cd C:\chemin\vers\comet; docker compose up -d"`
3. Cocher **"Executer avec les privileges les plus eleves"**
4. OK

---

## 16. Depannage

### Problemes Docker Desktop

| Symptome | Cause probable | Solution |
|----------|---------------|----------|
| Docker Desktop ne demarre pas | WSL 2 non installe | `wsl --install` en PowerShell admin, redemarrer |
| "Hardware assisted virtualization" | Virtualisation desactivee | Activer VT-x/AMD-V dans le BIOS |
| Docker tres lent | Ressources insuffisantes | Settings > Resources > augmenter CPU/RAM |
| "docker: command not found" | PATH pas configure | Fermer et rouvrir PowerShell, ou reinstaller Docker Desktop |
| "Cannot connect to Docker daemon" | Docker Desktop pas lance | Lancer Docker Desktop depuis le menu Demarrer |

### Problemes COMET

| Symptome | Cause probable | Solution |
|----------|---------------|----------|
| Page blanche sur localhost:3000 | App pas encore prete | Attendre 30s, verifier les logs : `docker compose logs -f app` |
| "Connection refused" | Conteneurs pas lances | `docker compose up -d` |
| Erreur connexion DB dans les logs | Mot de passe incorrect | Verifier que `POSTGRES_PASSWORD` et `DATABASE_URL` concordent dans `.env` |
| Port 3000 deja utilise | Autre application | Changer `APP_PORT=3001` dans `.env`, relancer |
| Build echoue avec "no space" | Disque plein | `docker system prune -a` pour nettoyer (attention : supprime les images inutilisees) |
| "exec format error" dans les logs | Image construite pour mauvaise archi | `docker compose build --no-cache` |
| Fichiers uploades perdus | Volume supprime | Ne jamais utiliser `docker compose down -v` en production |
| WARNING ENCRYPTION_KEY | Secret manquant | Generer et ajouter dans `.env` (voir section 7.2) |
| WARNING AUTH_SECRET | Secret par defaut | Generer et ajouter dans `.env` (voir section 7.2) |

### Commandes de diagnostic

```powershell
# Voir l'etat de Docker
docker info

# Voir les conteneurs (meme arretes)
docker compose ps -a

# Voir les logs d'erreur de l'application
docker compose logs app 2>&1 | Select-String "error|Error|ERROR"

# Voir l'utilisation des ressources
docker stats

# Verifier la connexion a la base
docker compose exec db pg_isready -U comet

# Tester que l'app repond
Invoke-WebRequest -Uri http://localhost:3000/api/health -UseBasicParsing

# Voir l'espace disque Docker
docker system df
```

### Reset complet (remet a zero)

**Attention : supprime toutes les donnees** (base, backups, fichiers uploades).

```powershell
docker compose down -v
docker compose up -d --build
```

### Reinstallation propre

En cas de probleme majeur :

```powershell
# Tout arreter et supprimer
docker compose down -v
docker system prune -a

# Supprimer le fichier .env pour repartir de zero
Remove-Item .env

# Relancer l'installation
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

---

## Recapitulatif rapide

```
1. Installer Docker Desktop      → docker.com/desktop
2. Activer WSL 2                  → wsl --install (PowerShell admin)
3. Installer Git                  → git-scm.com
4. Cloner le projet               → git clone <url> comet
5. Lancer le setup                → double-clic scripts\setup.bat
6. Ouvrir le navigateur           → http://localhost:3000
7. Se connecter avec l'admin      → voir les logs pour le mot de passe
8. Changer le mot de passe        → Parametres > Utilisateurs
9. Configurer SMTP                → Parametres > Alertes Email
10. Activer les sauvegardes       → Parametres > Sauvegarde
```
