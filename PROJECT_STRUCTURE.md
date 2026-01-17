# Structure du Projet - TailPOS ERPNext Integration

Ce document décrit l'organisation des fichiers et dossiers du projet.

---

## Vue d'Ensemble

```
POS_PROJET/
├── README.md                    # Documentation principale
├── INSTALLATION.md              # Guide d'installation
├── API_REFERENCE.md             # Référence de l'API
├── TROUBLESHOOTING.md           # Guide de dépannage
├── CHANGELOG.md                 # Historique des versions
├── CONTRIBUTING.md              # Guide de contribution
├── LICENSE                      # Licence MIT
├── PROJECT_STRUCTURE.md         # Ce fichier
│
├── tailpos-master/              # Application React Native TailPOS
│   ├── package.json             # Dépendances npm
│   ├── index.js                 # Point d'entrée de l'app
│   ├── App.js                   # Composant racine
│   ├── TESTING.md               # Documentation des tests
│   │
│   ├── src/                     # Code source
│   │   ├── api/                 # ⭐ Module API ERPNext (nouveau)
│   │   ├── boot/                # Configuration au démarrage
│   │   ├── container/           # Composants conteneurs
│   │   ├── services/            # Services métier
│   │   ├── store/               # State management (MobX-State-Tree)
│   │   └── stories/             # Storybook components
│   │
│   ├── android/                 # Configuration Android native
│   ├── ios/                     # Configuration iOS native
│   └── scripts/                 # Scripts utilitaires
│
└── Documentation ERPNext/       # (optionnel) Docs configuration ERPNext
```

---

## Module API (`tailpos-master/src/api/`)

Le coeur de l'intégration ERPNext.

```
src/api/
├── index.js                     # Point d'entrée, exports
│
├── FrappeAPI.js                 # Client API REST ERPNext
├── ApiConfig.js                 # Configuration persistante
├── SyncService.js               # Synchronisation bidirectionnelle
│
├── DataMapper.js                # Transformation des données
├── DataValidator.js             # Validation avec schémas
│
├── OfflineQueue.js              # Queue hors ligne (PouchDB)
├── NetworkMonitor.js            # Surveillance réseau
│
├── dependencies.js              # Vérification dépendances
│
├── TestConnection.js            # Tests de connexion
├── TestSuite.js                 # Suite de tests intégrée
│
└── config.json                  # Configuration (non versionné)
```

### Descriptions des Fichiers

| Fichier | Lignes | Description |
|---------|--------|-------------|
| `index.js` | ~265 | Point d'entrée du module, gère tous les exports |
| `FrappeAPI.js` | ~750 | Client HTTP pour l'API REST Frappe/ERPNext |
| `ApiConfig.js` | ~200 | Gestion de la config avec AsyncStorage |
| `SyncService.js` | ~400 | Logique de synchronisation des données |
| `DataMapper.js` | ~600 | Mapping ERPNext ↔ TailPOS |
| `DataValidator.js` | ~450 | Validation des données avec schémas |
| `OfflineQueue.js` | ~350 | Queue persistante pour mode offline |
| `NetworkMonitor.js` | ~300 | Détection et surveillance réseau |
| `dependencies.js` | ~150 | Vérification des packages npm |
| `TestConnection.js` | ~850 | Tests de connexion et API |
| `TestSuite.js` | ~560 | Suite de tests React Native |

---

## Application TailPOS (`tailpos-master/src/`)

Structure de l'application React Native originale.

```
src/
├── boot/
│   └── configureStore.js        # Configuration du store MobX-State-Tree
│
├── container/
│   ├── BadNetworkComponent/     # Écran erreur réseau
│   ├── BluetoothComponent/      # Connexion imprimante Bluetooth
│   ├── ConfirmOrderComponent/   # Confirmation de commande
│   ├── InputComponent/          # Saisie numérique (PIN, quantités)
│   ├── ItemComponent/           # Affichage d'un produit
│   ├── LoginComponent/          # Écran de connexion
│   ├── PaymentComponent/        # Écran de paiement
│   ├── ReceiptComponent/        # Affichage d'un ticket
│   ├── ReceiptViewComponent/    # Vue détaillée d'un ticket
│   ├── ReceiptsComponent/       # Liste des tickets
│   ├── RootComponent/           # Composant racine avec navigation
│   ├── SalesComponent/          # Écran de vente principal
│   ├── SettingComponent/        # Paramètres de l'application
│   ├── ShiftComponent/          # Gestion des shifts/sessions
│   └── SplashComponent/         # Écran de démarrage
│
├── services/
│   ├── printer/                 # Service d'impression Bluetooth
│   └── storage/                 # Service de stockage local
│
├── store/
│   ├── StateStore/              # Store principal
│   ├── CustomerStore/           # Store clients
│   ├── ItemStore/               # Store produits
│   ├── ReceiptStore/            # Store tickets/ventes
│   ├── AttendantStore/          # Store employés/caissiers
│   ├── CompanyStore/            # Store entreprise
│   ├── SettingStore/            # Store paramètres
│   └── SyncStore/               # Store synchronisation
│
└── stories/
    ├── screens/                 # Écrans Storybook
    └── components/              # Composants Storybook
```

---

## Configuration Android (`tailpos-master/android/`)

```
android/
├── app/
│   ├── build.gradle             # Config build de l'app
│   ├── proguard-rules.pro       # Règles ProGuard
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml
│           ├── java/...         # Code Java natif
│           └── res/             # Ressources (icônes, etc.)
│
├── build.gradle                 # Config build globale
├── gradle.properties            # Propriétés Gradle
├── gradlew                      # Script Gradle (Unix)
├── gradlew.bat                  # Script Gradle (Windows)
└── local.properties             # Config locale (SDK path)
```

---

## Scripts (`tailpos-master/scripts/`)

```
scripts/
├── test_api.sh                  # Test des endpoints API
├── test_full_flow.sh            # Test d'un flux de vente complet
└── check_deps.js                # Vérification des dépendances
```

### Utilisation des Scripts

```bash
# Test de l'API
./scripts/test_api.sh http://localhost:8000

# Test du flux complet
./scripts/test_full_flow.sh http://localhost:8000

# Vérification des dépendances
npm run check:deps
```

---

## Fichiers de Configuration

### `package.json`

```json
{
  "name": "tailpos",
  "version": "1.4.0",
  "scripts": {
    "start": "react-native start",
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "test": "jest",
    "lint": "eslint src/",
    "check:deps": "node scripts/check_deps.js",
    "test:api": "./scripts/test_api.sh",
    "sync:test": "node -e \"require('./src/api').testSuite.runAll()\""
  },
  "dependencies": {
    "react": "16.3.1",
    "react-native": "0.55.3",
    "mobx": "^4.2.0",
    "mobx-state-tree": "^2.0.5",
    "realm": "^2.5.0",
    "pouchdb-adapter-react-native-sqlite": "^2.0.0"
  }
}
```

### `src/api/config.json` (exemple)

```json
{
  "serverUrl": "http://192.168.1.100:8000",
  "username": "pos_user@example.com",
  "password": "secure_password_123",
  "company": "Ma Société",
  "warehouse": "Magasin Principal - MS",
  "posProfile": "Caisse 1",
  "priceList": "Vente Retail"
}
```

### `android/local.properties`

```properties
sdk.dir=C:\\Users\\USERNAME\\AppData\\Local\\Android\\Sdk
```

---

## Flux de Données

```
┌─────────────────────────────────────────────────────────────────────┐
│                           APPLICATION                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│   │   UI     │───▶│  Store   │───▶│  Sync    │───▶│   API    │   │
│   │Components│◀───│  (MobX)  │◀───│ Service  │◀───│ (Frappe) │   │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘   │
│                          │               │               │         │
│                          ▼               ▼               ▼         │
│                   ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│                   │  Realm   │    │  Offline │    │  Network │   │
│                   │   DB     │    │   Queue  │    │  Monitor │   │
│                   └──────────┘    └──────────┘    └──────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            ERPNext                                   │
├─────────────────────────────────────────────────────────────────────┤
│   Items │ Customers │ POS Invoice │ Stock │ Warehouse │ Price List │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Conventions de Nommage

### Fichiers

| Type | Convention | Exemple |
|------|------------|---------|
| Modules API | PascalCase.js | `FrappeAPI.js` |
| Composants | PascalCase/ | `SalesComponent/` |
| Scripts | snake_case.sh | `test_api.sh` |
| Config | lowercase.json | `config.json` |

### Dossiers

| Type | Convention | Exemple |
|------|------------|---------|
| Modules | lowercase | `api/`, `store/` |
| Composants | PascalCase | `LoginComponent/` |

### Code

| Type | Convention | Exemple |
|------|------------|---------|
| Classes | PascalCase | `FrappeAPI` |
| Fonctions | camelCase | `syncItems()` |
| Constantes | UPPER_SNAKE | `API_VERSION` |
| Variables | camelCase | `itemList` |

---

## Dépendances Principales

### Production

| Package | Version | Usage |
|---------|---------|-------|
| react | 16.3.1 | UI Framework |
| react-native | 0.55.3 | Mobile Framework |
| mobx | 4.2.0 | State Management |
| mobx-state-tree | 2.0.5 | Store Structure |
| realm | 2.5.0 | Local Database |
| pouchdb | 7.x | Offline Queue |

### Développement

| Package | Version | Usage |
|---------|---------|-------|
| jest | latest | Testing |
| eslint | latest | Linting |
| babel | 6.x | Transpilation |

---

## Commandes Utiles

```bash
# Installation
npm install

# Développement
npm start                        # Metro Bundler
npm run android                  # Build Android

# Tests
npm run test:api                 # Test API
npm run check:deps               # Vérifier dépendances

# Build Production
cd android && ./gradlew assembleRelease

# Nettoyage
rm -rf node_modules && npm install
cd android && ./gradlew clean
```

---

*Structure du projet TailPOS ERPNext Integration v2.3.0*
