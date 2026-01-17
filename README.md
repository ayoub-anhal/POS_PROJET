# 🛒 Système de Gestion de Stock et POS

## ERPNext + TailPOS - Solution Intégrée

![Version](https://img.shields.io/badge/version-2.3.0-blue.svg)
![ERPNext](https://img.shields.io/badge/ERPNext-v15-green.svg)
![TailPOS](https://img.shields.io/badge/TailPOS-React%20Native%200.55-orange.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)
![Status](https://img.shields.io/badge/status-Production%20Ready-brightgreen.svg)

---

## 📋 Table des Matières

1. [Présentation](#-présentation)
2. [Fonctionnalités](#-fonctionnalités)
3. [Architecture](#-architecture)
4. [Prérequis](#-prérequis)
5. [Installation Rapide](#-installation-rapide)
6. [Configuration](#-configuration)
7. [Utilisation](#-utilisation)
8. [API Reference](#-api-reference)
9. [Tests](#-tests)
10. [Dépannage](#-dépannage)
11. [Structure du Projet](#-structure-du-projet)
12. [Contribution](#-contribution)
13. [Changelog](#-changelog)
14. [Licence](#-licence)

---

## 🎯 Présentation

Ce projet est une solution complète de gestion de stock et de point de vente (POS) qui intègre **ERPNext** comme backend puissant et **TailPOS** comme application mobile de caisse.

### Pourquoi cette solution?

Les petites et moyennes entreprises ont besoin d'un système de gestion de stock fiable et d'une interface de vente mobile intuitive. Cette intégration combine le meilleur des deux mondes:

- **ERPNext**: Un ERP open-source complet avec gestion des stocks, comptabilité, et reporting
- **TailPOS**: Une application de caisse mobile légère, rapide et fonctionnant hors ligne

### Pour qui?

- Commerces de détail
- Restaurants et cafés
- Petites et moyennes entreprises
- Toute entreprise nécessitant une gestion de stock et des ventes mobiles

### Avantages Principaux

- ✅ **100% Open Source** - Pas de frais de licence
- ✅ **Mode Hors Ligne** - Continuez à vendre même sans internet
- ✅ **Synchronisation Automatique** - Données toujours à jour
- ✅ **Multi-plateformes** - Android, tablettes, navigateur web
- ✅ **Extensible** - Personnalisable selon vos besoins

---

## ✨ Fonctionnalités

### ERPNext (Backend)

| Fonctionnalité | Description |
|----------------|-------------|
| 📦 Gestion des Stocks | Suivi en temps réel, multi-entrepôts |
| 🏷️ Produits & Catégories | Catalogue complet avec images et codes-barres |
| 👥 Gestion des Clients | Fiches clients, historique d'achats |
| 🧾 Facturation POS | Factures automatiques, numérotation |
| 📊 Rapports & Analyses | Ventes, stocks, performances |
| 💰 Multi-devises | Support de plusieurs devises |
| 🏢 Multi-entrepôts | Gestion de plusieurs points de vente |

### TailPOS (Frontend Mobile)

| Fonctionnalité | Description |
|----------------|-------------|
| 🛒 Interface de Caisse | Design intuitif et rapide |
| 📷 Scan Codes-barres | Caméra ou scanner Bluetooth |
| 📴 Mode Hors Ligne | Ventes sans connexion internet |
| 🔄 Sync Automatique | Synchronisation transparente |
| 👤 Gestion Clients | Création et recherche rapide |
| 📜 Historique Ventes | Consultation et réimpression |
| 🌍 Multi-langues | Français, Anglais, et plus |
| 🖨️ Impression | Tickets thermiques Bluetooth |

### Intégration API

| Fonctionnalité | Description |
|----------------|-------------|
| 🔗 API REST Standard | Utilisation de l'API Frappe native |
| 🔄 Sync Bidirectionnelle | Produits, clients, ventes |
| 📤 Queue Offline | Retry automatique avec backoff |
| 🔍 Mapping Intelligent | Transformation automatique des données |
| 📡 Détection Réseau | Surveillance continue de la connexion |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ARCHITECTURE SYSTÈME                          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐                      ┌─────────────────────┐
│                     │      REST API        │                     │
│      TailPOS        │  ◄──────────────────►│      ERPNext        │
│   (React Native)    │   JSON over HTTP     │     (Frappe)        │
│                     │                      │                     │
├─────────────────────┤                      ├─────────────────────┤
│                     │                      │                     │
│  ┌───────────────┐  │                      │  ┌───────────────┐  │
│  │  FrappeAPI    │  │    /api/resource/*   │  │    Items      │  │
│  │  (Client)     │──┼──────────────────────┼──│    Customer   │  │
│  └───────────────┘  │                      │  │    POS Invoice│  │
│                     │                      │  └───────────────┘  │
│  ┌───────────────┐  │                      │                     │
│  │  SyncService  │  │    Sync bidirec.     │  ┌───────────────┐  │
│  │  (Scheduler)  │──┼──────────────────────┼──│    Stock      │  │
│  └───────────────┘  │                      │  │    Warehouse  │  │
│                     │                      │  └───────────────┘  │
│  ┌───────────────┐  │                      │                     │
│  │ OfflineQueue  │  │    Queue + Retry     │  ┌───────────────┐  │
│  │ (PouchDB)     │──┼──────────────────────┼──│   MariaDB     │  │
│  └───────────────┘  │                      │  │   (Backend)   │  │
│                     │                      │  └───────────────┘  │
│  ┌───────────────┐  │                      │                     │
│  │  DataMapper   │  │    Transformation    │  ┌───────────────┐  │
│  │  (Convert)    │──┼──────────────────────┼──│    Redis      │  │
│  └───────────────┘  │                      │  │   (Cache)     │  │
│                     │                      │  └───────────────┘  │
└─────────────────────┘                      └─────────────────────┘
       │                                              │
       │         ┌──────────────────────┐            │
       └─────────│   NetworkMonitor     │────────────┘
                 │  (Détection réseau)  │
                 └──────────────────────┘
```

### Flux de Données - Exemple: Création d'une Vente

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUX: VENTE HORS LIGNE                           │
└─────────────────────────────────────────────────────────────────────┘

  1. CRÉATION           2. STOCKAGE LOCAL      3. QUEUE OFFLINE
  ┌─────────────┐       ┌─────────────┐        ┌─────────────┐
  │  Utilisateur│       │   PouchDB   │        │ OfflineQueue│
  │  crée vente │ ────► │  (SQLite)   │ ─────► │  (Pending)  │
  └─────────────┘       └─────────────┘        └─────────────┘
                                                      │
  ┌───────────────────────────────────────────────────┘
  │
  │  4. CONNEXION DÉTECTÉE         5. TRAITEMENT QUEUE
  │  ┌─────────────┐               ┌─────────────┐
  └─►│NetworkMonitor│ ────────────► │ processQueue│
     │ (Online!)   │               │ (Batch)     │
     └─────────────┘               └─────────────┘
                                          │
  ┌───────────────────────────────────────┘
  │
  │  6. MAPPING                    7. ENVOI API
  │  ┌─────────────┐               ┌─────────────┐
  └─►│  DataMapper │ ────────────► │  FrappeAPI  │
     │ Receipt→Inv │               │ POST Invoice│
     └─────────────┘               └─────────────┘
                                          │
                                          ▼
                               ┌─────────────────┐
                               │    ERPNext      │
                               │  POS Invoice    │
                               │    créée!       │
                               └─────────────────┘
```

---

## 📦 Prérequis

### Pour ERPNext (Serveur)

| Composant | Version Requise | Notes |
|-----------|-----------------|-------|
| Ubuntu/Debian | 20.04+ / 11+ | Serveur Linux recommandé |
| Python | 3.10 ou 3.11 | ⚠️ **Pas** Python 3.12+ |
| Node.js | 16.x ou 18.x | Version LTS recommandée |
| MariaDB | 10.6+ | ou MySQL 8.0+ |
| Redis | 6.0+ | Pour cache et queue jobs |
| Git | 2.x+ | Pour clonage des repos |
| wkhtmltopdf | 0.12.6+ | Pour génération PDF |

### Pour TailPOS (Mobile)

| Composant | Version Requise | Notes |
|-----------|-----------------|-------|
| Node.js | 14.x ou 16.x | Pour le build |
| npm | 6.x+ | ou yarn 1.x |
| React Native CLI | 0.55.x | Version legacy |
| Android Studio | 4.0+ | Pour émulateur et build |
| JDK | 8 ou 11 | Pour Gradle Android |
| Android SDK | API 21+ | Android 5.0 minimum |

### Matériel Recommandé

**Serveur ERPNext:**
- CPU: 2+ cores
- RAM: 4GB minimum (8GB recommandé)
- Disque: 20GB+ SSD
- Réseau: Connexion stable

**Appareil TailPOS:**
- Android 5.0+ (API 21)
- RAM: 2GB minimum
- Stockage: 100MB libre
- Caméra (pour scan codes-barres)
- WiFi ou données mobiles

---

## 🚀 Installation Rapide

### Option 1: Installation Automatique (Recommandée)

```bash
# 1. Cloner le repository
git clone https://github.com/votre-repo/POS_PROJET.git
cd POS_PROJET

# 2. Installer ERPNext (sur le serveur)
chmod +x scripts/install_erpnext.sh
sudo ./scripts/install_erpnext.sh

# 3. Configurer ERPNext pour POS
chmod +x scripts/setup_pos.sh
./scripts/setup_pos.sh

# 4. Installer TailPOS (sur machine de développement)
cd tailpos-master
npm install
npm run android
```

### Option 2: Installation Manuelle

Consultez le guide détaillé: **[INSTALLATION.md](./INSTALLATION.md)**

---

## ⚙️ Configuration

### 1. Configuration ERPNext

```bash
# Démarrer ERPNext
cd frappe-bench
bench start

# Ouvrir dans le navigateur
# http://localhost:8000
```

**Configuration via interface web:**

1. Connexion avec le compte administrateur
2. Aller dans: **Setup > Company** → Créer votre entreprise
3. Aller dans: **Stock > Warehouse** → Créer un entrepôt
4. Aller dans: **Selling > POS Profile** → Créer un profil POS
5. Aller dans: **Setup > User** → Créer l'utilisateur POS

### 2. Configuration TailPOS

**Dans l'application TailPOS:**

1. Ouvrir **Paramètres** (icône engrenage)
2. Section **Synchronisation**
3. Remplir les champs:

| Champ | Valeur |
|-------|--------|
| URL Serveur | `http://IP_SERVEUR:8000` |
| Nom d'utilisateur | `pos_user@example.com` |
| Mot de passe | `votre_mot_de_passe` |

4. Cliquer sur **Tester la connexion**
5. Si succès ✅, cliquer sur **Synchroniser**

### 3. Configuration Réseau

Pour accéder depuis un réseau externe:

```bash
# Sur le serveur ERPNext, modifier site_config.json
cd frappe-bench/sites/site1.local
nano site_config.json
```

Ajouter:
```json
{
  "allow_cors": "*",
  "ignore_csrf": 1
}
```

Redémarrer:
```bash
bench restart
```

---

## 📱 Utilisation

### Guide Rapide - Faire une Vente

```
┌────────────────────────────────────────────────────────────────┐
│                     PROCESSUS DE VENTE                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1️⃣  OUVRIR         Lancer l'application TailPOS              │
│                                                                │
│  2️⃣  SCANNER        Scanner le code-barres du produit         │
│      ou CHERCHER    Rechercher par nom dans le catalogue       │
│                                                                │
│  3️⃣  QUANTITÉ       Ajuster la quantité si nécessaire (+/-)   │
│                                                                │
│  4️⃣  AJOUTER        Appuyer sur le bouton + pour ajouter      │
│                                                                │
│  5️⃣  RÉPÉTER        Répéter pour chaque produit               │
│                                                                │
│  6️⃣  PAYER          Appuyer sur le bouton "Payer"             │
│                                                                │
│  7️⃣  MODE PAIEMENT  Sélectionner: Espèces, Carte, etc.        │
│                                                                │
│  8️⃣  CONFIRMER      Valider la transaction                    │
│                                                                │
│  9️⃣  REÇU           Imprimer ou envoyer par email (optionnel) │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Mode Hors Ligne

L'application fonctionne **sans connexion internet**:

| Indicateur | Signification |
|------------|---------------|
| 🟢 Vert | En ligne - synchronisation active |
| 🔴 Rouge | Hors ligne - ventes sauvegardées localement |
| 🟡 Jaune | Synchronisation en cours |

**Comportement hors ligne:**
- Les ventes sont stockées dans PouchDB (SQLite)
- Dès que la connexion revient → synchronisation automatique
- Les produits et clients restent disponibles (cache local)
- Aucune action requise de l'utilisateur

### Gestion des Clients

```
Nouveau Client:
  Paramètres > Clients > Nouveau
  → Remplir: Nom, Email, Téléphone
  → Sauvegarder

Sélectionner Client pour une vente:
  Écran de vente > Icône Client
  → Rechercher ou sélectionner
  → Le client apparaît sur le ticket
```

---

## 📚 API Reference

Consultez la documentation complète: **[API_REFERENCE.md](./API_REFERENCE.md)**

### Endpoints Principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/method/login` | Authentification |
| `POST` | `/api/method/logout` | Déconnexion |
| `GET` | `/api/resource/Item` | Liste des produits |
| `GET` | `/api/resource/Item/{name}` | Détail d'un produit |
| `GET` | `/api/resource/Customer` | Liste des clients |
| `POST` | `/api/resource/Customer` | Créer un client |
| `POST` | `/api/resource/POS Invoice` | Créer une vente |
| `GET` | `/api/resource/POS Profile` | Configuration POS |

### Exemple de Requête

```javascript
// Authentification
const response = await fetch('http://localhost:8000/api/method/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    usr: 'pos_user@example.com',
    pwd: 'password123'
  })
});

// Récupérer les produits
const items = await fetch('http://localhost:8000/api/resource/Item?limit_page_length=100', {
  headers: { 'Accept': 'application/json' }
});
```

---

## 🧪 Tests

### Tests Rapides

```bash
# Vérifier les dépendances
cd tailpos-master
npm run check:deps

# Tester la connexion API
./scripts/test_api.sh http://localhost:8000

# Tester le flux complet
./scripts/test_full_flow.sh http://localhost:8000
```

### Tests dans React Native

```javascript
import { testSuite, TEST_CATEGORIES } from './src/api';

// Exécuter tous les tests
const results = await testSuite.runAll({
  serverUrl: 'http://192.168.1.100:8000',
  username: 'pos_user@example.com',
  password: 'password123'
});

console.log('Taux de réussite:', results.successRate + '%');
```

Consultez le guide complet: **[TESTING.md](./tailpos-master/TESTING.md)**

---

## 🔧 Dépannage

### Problèmes Courants

<details>
<summary><strong>❌ Erreur de connexion au serveur</strong></summary>

**Symptômes:** "Serveur inaccessible", "Connection timeout"

**Solutions:**
1. Vérifier que ERPNext est démarré: `bench start`
2. Vérifier l'URL (http vs https, port 8000)
3. Vérifier le pare-feu: `sudo ufw allow 8000`
4. Tester avec curl: `curl http://localhost:8000`
</details>

<details>
<summary><strong>❌ Échec d'authentification</strong></summary>

**Symptômes:** "Invalid credentials", "Login failed"

**Solutions:**
1. Vérifier le nom d'utilisateur (email exact)
2. Vérifier le mot de passe
3. Vérifier que l'utilisateur existe dans ERPNext
4. Vérifier le rôle "POS User" est attribué
</details>

<details>
<summary><strong>❌ Synchronisation bloquée</strong></summary>

**Symptômes:** Icône de sync qui tourne sans fin

**Solutions:**
1. Vérifier la connexion réseau
2. Forcer la sync: Paramètres > Forcer Synchronisation
3. Vérifier les logs: `adb logcat | grep TailPOS`
4. Redémarrer l'application
</details>

<details>
<summary><strong>❌ Produits non affichés</strong></summary>

**Symptômes:** Catalogue vide après sync

**Solutions:**
1. Vérifier qu'il y a des produits dans ERPNext
2. Vérifier les permissions de l'utilisateur sur "Item"
3. Resynchroniser: Paramètres > Sync Complète
</details>

Guide complet: **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**

---

## 📁 Structure du Projet

```
POS_PROJET/
├── erpnext-develop/          # Backend ERPNext
│   ├── setup_pos.py          # Script configuration POS
│   ├── cors_config.py        # Configuration CORS
│   └── ...
│
├── tailpos-master/           # Frontend TailPOS
│   ├── src/
│   │   ├── api/              # Couche API (notre intégration)
│   │   │   ├── FrappeAPI.js
│   │   │   ├── ApiConfig.js
│   │   │   ├── SyncService.js
│   │   │   ├── DataMapper.js
│   │   │   ├── DataValidator.js
│   │   │   ├── OfflineQueue.js
│   │   │   ├── NetworkMonitor.js
│   │   │   ├── TestSuite.js
│   │   │   └── index.js
│   │   └── ...
│   ├── scripts/
│   │   ├── test_api.sh
│   │   └── test_full_flow.sh
│   └── package.json
│
├── scripts/                  # Scripts d'installation
│   ├── install_erpnext.sh
│   └── setup_pos.sh
│
├── README.md                 # Ce fichier
├── INSTALLATION.md           # Guide d'installation
├── API_REFERENCE.md          # Documentation API
├── TROUBLESHOOTING.md        # Guide de dépannage
├── CHANGELOG.md              # Historique des versions
└── LICENSE                   # Licence MIT
```

Voir détails: **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)**

---

## 🤝 Contribution

Les contributions sont les bienvenues!

### Comment Contribuer

1. **Fork** le repository
2. **Créer** une branche: `git checkout -b feature/ma-fonctionnalite`
3. **Commiter** vos changements: `git commit -m 'Ajout de ma fonctionnalité'`
4. **Pousser** la branche: `git push origin feature/ma-fonctionnalite`
5. **Ouvrir** une Pull Request

### Guidelines

- Suivre les conventions de code existantes
- Ajouter des tests pour les nouvelles fonctionnalités
- Mettre à jour la documentation si nécessaire
- Écrire des messages de commit clairs

Voir: **[CONTRIBUTING.md](./CONTRIBUTING.md)**

---

## 📝 Changelog

### Version 2.3.0 (2025-01-17)
- ✅ Système de tests complet (TestRunner, TestSuite)
- ✅ Scripts de test shell
- ✅ Documentation des tests

### Version 2.2.0 (2025-01-17)
- ✅ Module de vérification des dépendances
- ✅ Scripts npm utiles

### Version 2.1.0 (2025-01-17)
- ✅ Gestion du mode offline (OfflineQueue)
- ✅ NetworkMonitor pour surveillance réseau

### Version 2.0.0 (2025-01-17)
- ✅ DataMapper et DataValidator
- ✅ Mapping bidirectionnel complet

Voir historique complet: **[CHANGELOG.md](./CHANGELOG.md)**

---

## 📄 Licence

Ce projet est sous licence **MIT**.

```
MIT License

Copyright (c) 2025 POS_PROJET

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

Voir: **[LICENSE](./LICENSE)**

---

## 📞 Contact & Support

| Canal | Lien |
|-------|------|
| 📧 Email | support@example.com |
| 🐛 Issues | [GitHub Issues](https://github.com/votre-repo/issues) |
| 📖 Wiki | [GitHub Wiki](https://github.com/votre-repo/wiki) |
| 💬 Discussions | [GitHub Discussions](https://github.com/votre-repo/discussions) |

---

<div align="center">

**Fait avec ❤️ pour simplifier la gestion des ventes**

[⬆ Retour en haut](#-système-de-gestion-de-stock-et-pos)

</div>
