# 📦 Guide d'Installation Complet

## ERPNext + TailPOS - Installation pas à pas

Ce guide vous accompagne dans l'installation complète du système de gestion de stock et POS.

---

## 📋 Table des Matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Installation ERPNext](#2-installation-erpnext)
3. [Configuration ERPNext pour POS](#3-configuration-erpnext-pour-pos)
4. [Installation TailPOS](#4-installation-tailpos)
5. [Configuration Réseau](#5-configuration-réseau)
6. [Vérification de l'Installation](#6-vérification-de-linstallation)
7. [Problèmes Courants](#7-problèmes-courants)

---

## 1. Vue d'ensemble

### Architecture d'Installation

```
┌─────────────────────────────────────────────────────────────────┐
│                      ENVIRONNEMENT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SERVEUR (Linux Ubuntu/Debian)                                │
│   ├── ERPNext v15                                              │
│   ├── MariaDB 10.6+                                            │
│   ├── Redis 6.0+                                               │
│   └── Node.js 18.x                                             │
│                                                                 │
│   DÉVELOPPEMENT (Windows/Mac/Linux)                            │
│   ├── Node.js 16.x                                             │
│   ├── Android Studio                                           │
│   └── TailPOS (React Native)                                   │
│                                                                 │
│   PRODUCTION (Appareil Android)                                │
│   └── APK TailPOS                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Temps Estimé

| Composant | Temps |
|-----------|-------|
| Installation ERPNext | 30-60 min |
| Configuration ERPNext | 15-30 min |
| Installation TailPOS | 15-30 min |
| Configuration et Tests | 15-30 min |
| **Total** | **1h30 - 2h30** |

---

## 2. Installation ERPNext

### 2.1 Prérequis Système (Ubuntu 22.04 LTS)

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer les dépendances de base
sudo apt install -y \
    git \
    python3-dev \
    python3-pip \
    python3-venv \
    python3-setuptools \
    software-properties-common \
    curl \
    wget \
    build-essential \
    libffi-dev \
    libssl-dev \
    libmysqlclient-dev \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    libxrender1 \
    libxext6 \
    xfonts-75dpi \
    xfonts-base
```

### 2.2 Installation de MariaDB

```bash
# Installer MariaDB
sudo apt install -y mariadb-server mariadb-client

# Sécuriser l'installation
sudo mysql_secure_installation
```

**Réponses recommandées:**
```
Enter current password for root: [Entrée - pas de mot de passe]
Switch to unix_socket authentication [Y/n]: n
Change the root password? [Y/n]: Y
New password: VotreMotDePasse123!
Remove anonymous users? [Y/n]: Y
Disallow root login remotely? [Y/n]: Y
Remove test database? [Y/n]: Y
Reload privilege tables now? [Y/n]: Y
```

**Configuration MariaDB:**

```bash
# Éditer la configuration
sudo nano /etc/mysql/mariadb.conf.d/50-server.cnf
```

Ajouter dans la section `[mysqld]`:
```ini
[mysqld]
character-set-client-handshake = FALSE
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

[mysql]
default-character-set = utf8mb4
```

```bash
# Redémarrer MariaDB
sudo systemctl restart mariadb
```

### 2.3 Installation de Redis

```bash
# Installer Redis
sudo apt install -y redis-server

# Activer Redis au démarrage
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Vérifier
redis-cli ping
# Doit répondre: PONG
```

### 2.4 Installation de Node.js

```bash
# Installer nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Recharger le shell
source ~/.bashrc

# Installer Node.js 18
nvm install 18
nvm use 18
nvm alias default 18

# Vérifier
node --version  # v18.x.x
npm --version   # 9.x.x

# Installer yarn
npm install -g yarn
```

### 2.5 Installation de wkhtmltopdf

```bash
# Télécharger wkhtmltopdf
wget https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-2/wkhtmltox_0.12.6.1-2.jammy_amd64.deb

# Installer
sudo dpkg -i wkhtmltox_0.12.6.1-2.jammy_amd64.deb
sudo apt install -f -y

# Vérifier
wkhtmltopdf --version
```

### 2.6 Installation de Frappe Bench

```bash
# Installer pip et virtualenv
sudo pip3 install frappe-bench

# Créer l'utilisateur frappe (optionnel mais recommandé)
sudo useradd -m -s /bin/bash frappe
sudo usermod -aG sudo frappe
sudo su - frappe

# Initialiser bench
bench init --frappe-branch version-15 frappe-bench

# Entrer dans le dossier
cd frappe-bench
```

### 2.7 Création du Site

```bash
# Créer un nouveau site
bench new-site site1.local --admin-password AdminPassword123

# Note: Vous devrez entrer le mot de passe root MariaDB
```

### 2.8 Installation d'ERPNext

```bash
# Récupérer l'application ERPNext
bench get-app erpnext --branch version-15

# Installer sur le site
bench --site site1.local install-app erpnext

# Définir comme site par défaut
bench use site1.local
```

### 2.9 Démarrage d'ERPNext

```bash
# Mode développement (avec logs)
bench start

# OU en arrière-plan (production)
bench setup supervisor
sudo supervisorctl reload
```

**Accéder à ERPNext:**
- URL: http://localhost:8000
- Utilisateur: Administrator
- Mot de passe: AdminPassword123

---

## 3. Configuration ERPNext pour POS

### 3.1 Première Configuration (Setup Wizard)

1. Ouvrir http://localhost:8000
2. Se connecter avec Administrator
3. Suivre l'assistant de configuration:
   - Langue: Français
   - Pays: [Votre pays]
   - Fuseau horaire: [Votre fuseau]
   - Devise: EUR / USD / ...
   - Nom de l'entreprise: [Votre entreprise]

### 3.2 Configuration de l'Entreprise

```
Navigation: Setup > Company
```

| Champ | Valeur |
|-------|--------|
| Company Name | Votre Entreprise |
| Abbreviation | VE |
| Default Currency | EUR |
| Country | France |

### 3.3 Création d'un Entrepôt

```
Navigation: Stock > Warehouse > New
```

| Champ | Valeur |
|-------|--------|
| Warehouse Name | Magasin Principal |
| Warehouse Type | Stock |
| Company | Votre Entreprise |
| Is Group | Non |

### 3.4 Création d'une Liste de Prix

```
Navigation: Stock > Price List > New
```

| Champ | Valeur |
|-------|--------|
| Price List Name | Vente Retail |
| Currency | EUR |
| Selling | Oui |
| Enabled | Oui |

### 3.5 Création du POS Profile

```
Navigation: Selling > POS Profile > New
```

| Champ | Valeur |
|-------|--------|
| Name | Caisse 1 |
| Company | Votre Entreprise |
| Warehouse | Magasin Principal |
| Campaign | (laisser vide) |
| Write Off Account | (sélectionner) |
| Write Off Cost Center | (sélectionner) |

**Onglet Payments:**
- Ajouter mode de paiement: Cash
- Ajouter mode de paiement: Card

### 3.6 Création de l'Utilisateur POS

```
Navigation: Setup > User > New
```

| Champ | Valeur |
|-------|--------|
| Email | pos_user@votreentreprise.com |
| First Name | Caissier |
| Last Name | POS |
| Send Welcome Email | Non |

**Rôles à attribuer:**
- Sales User
- POS User
- Stock User

**Permissions POS Profile:**
```
Navigation: Selling > POS Profile > [Caisse 1] > User Permissions
Ajouter: pos_user@votreentreprise.com
```

### 3.7 Configuration CORS (pour TailPOS)

```bash
# Éditer la configuration du site
cd ~/frappe-bench/sites/site1.local
nano site_config.json
```

Ajouter:
```json
{
  "allow_cors": "*",
  "ignore_csrf": 1
}
```

```bash
# Redémarrer
bench restart
```

### 3.8 Création de Produits Tests

```
Navigation: Stock > Item > New
```

Créer quelques produits pour tester:

| Item Code | Item Name | Rate | Item Group |
|-----------|-----------|------|------------|
| PROD-001 | Produit Test 1 | 10.00 | Products |
| PROD-002 | Produit Test 2 | 25.50 | Products |
| PROD-003 | Produit Test 3 | 99.99 | Products |

---

## 4. Installation TailPOS

### 4.1 Prérequis

```bash
# Vérifier Node.js
node --version  # 14.x ou 16.x recommandé

# Installer React Native CLI (si pas déjà fait)
npm install -g react-native-cli
```

### 4.2 Installation d'Android Studio

1. Télécharger depuis: https://developer.android.com/studio
2. Installer avec les composants par défaut
3. Configurer SDK Manager:
   - Android SDK Platform 29 (Android 10)
   - Android SDK Build-Tools 29.0.2
   - Intel x86 Emulator Accelerator (HAXM)

### 4.3 Variables d'Environnement

**Windows:**
```
ANDROID_HOME = C:\Users\[User]\AppData\Local\Android\Sdk
JAVA_HOME = C:\Program Files\Java\jdk-11
Path += %ANDROID_HOME%\platform-tools
Path += %ANDROID_HOME%\tools
```

**Linux/Mac:**
```bash
# Ajouter à ~/.bashrc ou ~/.zshrc
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

### 4.4 Clonage et Installation

```bash
# Naviguer vers le projet
cd POS_PROJET/tailpos-master

# Installer les dépendances
npm install

# OU avec yarn
yarn install
```

### 4.5 Configuration de la Connexion

```bash
# Créer le fichier de configuration
nano src/api/config.json
```

```json
{
  "serverUrl": "http://IP_DU_SERVEUR:8000",
  "username": "pos_user@votreentreprise.com",
  "password": "VotreMotDePasse",
  "company": "Votre Entreprise",
  "warehouse": "Magasin Principal - VE",
  "posProfile": "Caisse 1"
}
```

### 4.6 Lancement en Mode Développement

```bash
# Démarrer Metro Bundler
npm start

# Dans un autre terminal, lancer sur Android
npm run android

# OU sur émulateur spécifique
npx react-native run-android --deviceId emulator-5554
```

### 4.7 Build de Production (APK)

```bash
# Nettoyer le projet
cd android
./gradlew clean
cd ..

# Générer l'APK release
npm run apk
# OU
cd android && ./gradlew assembleRelease

# L'APK se trouve dans:
# android/app/build/outputs/apk/release/app-release.apk
```

### 4.8 Installation sur Appareil

```bash
# Via ADB
adb install android/app/build/outputs/apk/release/app-release.apk

# OU transférer l'APK sur l'appareil et installer manuellement
```

---

## 5. Configuration Réseau

### 5.1 Pare-feu (UFW)

```bash
# Autoriser le port ERPNext
sudo ufw allow 8000/tcp

# Si vous utilisez le reverse proxy nginx
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Vérifier
sudo ufw status
```

### 5.2 Accès depuis le Réseau Local

Pour que TailPOS accède à ERPNext depuis le réseau local:

1. **Trouver l'IP du serveur:**
```bash
ip addr show
# Chercher l'IP en 192.168.x.x ou 10.x.x.x
```

2. **Configurer ERPNext pour écouter sur toutes les interfaces:**
```bash
bench set-config -g host 0.0.0.0
bench restart
```

3. **Configurer TailPOS:**
   - URL Serveur: `http://192.168.1.100:8000` (remplacer par votre IP)

### 5.3 Configuration HTTPS (Production)

```bash
# Installer certbot
sudo apt install certbot

# Si vous avez un domaine
sudo bench setup lets-encrypt site1.local

# OU avec nginx comme reverse proxy
sudo apt install nginx
```

**Configuration nginx (/etc/nginx/sites-available/erpnext):**
```nginx
server {
    listen 80;
    server_name erp.votredomaine.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 6. Vérification de l'Installation

### 6.1 Checklist ERPNext

| Élément | Commande/Action | Résultat Attendu |
|---------|-----------------|------------------|
| Service MariaDB | `sudo systemctl status mariadb` | Active (running) |
| Service Redis | `redis-cli ping` | PONG |
| Bench start | `bench start` | Pas d'erreurs |
| Accès web | http://localhost:8000 | Page de login |
| Login Admin | Administrator / [pass] | Dashboard |
| Company créée | Setup > Company | Visible |
| POS Profile | Selling > POS Profile | Créé |

### 6.2 Checklist TailPOS

| Élément | Commande/Action | Résultat Attendu |
|---------|-----------------|------------------|
| npm install | `npm install` | Pas d'erreurs |
| Metro start | `npm start` | Bundler démarré |
| Build Android | `npm run android` | App lancée |
| Connexion | Paramètres > Test | Succès ✅ |
| Sync | Bouton Sync | Produits chargés |

### 6.3 Tests Automatiques

```bash
# Depuis le dossier tailpos-master
cd tailpos-master

# Vérifier les dépendances
npm run check:deps

# Tester l'API
./scripts/test_api.sh http://SERVEUR:8000

# Tester le flux complet
./scripts/test_full_flow.sh http://SERVEUR:8000
```

**Résultat attendu:**
```
==========================================
  RÉSUMÉ
==========================================
  Passed: 9
  Failed: 0
  Total:  9
==========================================
✓ Tous les tests ont réussi!
```

---

## 7. Problèmes Courants

### Problème: "bench: command not found"

```bash
# Solution: Ajouter au PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Problème: Erreur MariaDB "Access denied"

```bash
# Reset du mot de passe root
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'nouveaumotdepasse';
FLUSH PRIVILEGES;
EXIT;
```

### Problème: "Port 8000 already in use"

```bash
# Trouver le processus
lsof -i :8000

# Tuer le processus
kill -9 <PID>

# OU utiliser un autre port
bench set-config webserver_port 8001
```

### Problème: React Native "SDK location not found"

```bash
# Créer local.properties
cd android
echo "sdk.dir=/chemin/vers/Android/Sdk" > local.properties
```

### Problème: Gradle build failed

```bash
# Nettoyer et reconstruire
cd android
./gradlew clean
./gradlew assembleDebug --stacktrace
```

---

## 📞 Support

Si vous rencontrez des problèmes:

1. Consultez [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Vérifiez les [Issues GitHub](https://github.com/votre-repo/issues)
3. Créez une nouvelle issue avec les logs

---

[⬅️ Retour au README](./README.md)
