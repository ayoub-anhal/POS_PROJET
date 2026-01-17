# Dépendances TailPOS - Couche API ERPNext

Ce document décrit les dépendances requises pour le fonctionnement de la couche API TailPOS permettant la communication avec ERPNext.

## Version React Native

**Important:** TailPOS utilise React Native **0.55.3** (version legacy).

Dans cette version:
- `AsyncStorage` est **inclus** dans `react-native` (pas de package séparé)
- `NetInfo` est **inclus** dans `react-native` (pas de package séparé)

**NE PAS INSTALLER** les packages suivants (incompatibles avec RN < 0.60):
- ❌ `@react-native-async-storage/async-storage`
- ❌ `@react-native-community/netinfo`

---

## Dépendances Requises

### 1. Base de Données Locale

| Package | Version | Status | Usage |
|---------|---------|--------|-------|
| pouchdb-react-native | ^6.4.1 | ✅ Installé | Base de données NoSQL locale |
| pouchdb-adapter-react-native-sqlite | ^1.0.3 | ✅ Installé | Adapter SQLite pour PouchDB |
| pouchdb-find | ^6.4.3 | ✅ Installé | Plugin de recherche Mango |
| pouchdb-upsert | ^2.2.0 | ✅ Installé | Plugin upsert pour PouchDB |
| react-native-sqlite-2 | ^1.6.0 | ✅ Installé | SQLite pour React Native |

### 2. Utilitaires

| Package | Version | Status | Usage |
|---------|---------|--------|-------|
| uuid | ^3.2.1 | ✅ Installé | Génération d'identifiants uniques |
| valid-url | ^1.0.9 | ✅ Installé | Validation des URLs |
| lodash | ^4.17.13 | ✅ Installé | Utilitaires JavaScript |

### 3. Inclus dans React Native 0.55.x

| Module | Import | Usage |
|--------|--------|-------|
| AsyncStorage | `import { AsyncStorage } from 'react-native'` | Stockage clé-valeur |
| NetInfo | `import { NetInfo } from 'react-native'` | Détection du réseau |

---

## Vérification des Dépendances

### Via Script

```bash
# Vérifier toutes les dépendances
npm run check:deps

# Ou directement
node scripts/check-dependencies.js
```

### Via Code JavaScript

```javascript
import { checkDependencies, logDependencyStatus } from './src/api/dependencies';

// Vérification rapide
const status = checkDependencies();
console.log(status);
// { allPresent: true, missing: [], present: [...], message: '...' }

// Affichage détaillé dans la console
logDependencyStatus();
```

---

## Installation

### Toutes les dépendances sont déjà installées

Les dépendances nécessaires à la couche API sont déjà présentes dans le `package.json` de TailPOS. Aucune installation supplémentaire n'est requise.

### Si des dépendances sont manquantes

```bash
# Installer les dépendances manquantes
npm install pouchdb-react-native pouchdb-adapter-react-native-sqlite pouchdb-find pouchdb-upsert uuid valid-url lodash

# Nettoyer et reconstruire
cd android && ./gradlew clean && cd ..
npm run android
```

---

## Compatibilité

### Versions Testées

| Composant | Version |
|-----------|---------|
| React Native | 0.55.3 |
| React | 16.3.1 |
| Android | API 21+ (Android 5.0+) |
| Node.js | 10+ |

### Migration Future (RN >= 0.60)

Si vous migrez vers React Native 0.60 ou supérieur, vous devrez:

1. **Installer les packages séparés:**
```bash
npm install @react-native-async-storage/async-storage @react-native-community/netinfo
```

2. **Modifier les imports:**
```javascript
// AVANT (RN < 0.60)
import { AsyncStorage, NetInfo } from 'react-native';

// APRÈS (RN >= 0.60)
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
```

3. **Linker les packages (si RN < 0.60):**
```bash
react-native link @react-native-async-storage/async-storage
react-native link @react-native-community/netinfo
```

---

## Structure des Fichiers API

```
tailpos-master/
├── src/
│   └── api/
│       ├── index.js              # Point d'entrée
│       ├── FrappeAPI.js          # Client API ERPNext
│       ├── ApiConfig.js          # Configuration
│       ├── SyncService.js        # Synchronisation
│       ├── DataMapper.js         # Mapping des données
│       ├── DataValidator.js      # Validation
│       ├── OfflineQueue.js       # Queue offline
│       ├── NetworkMonitor.js     # Surveillance réseau
│       └── dependencies.js       # Vérification dépendances
├── scripts/
│   ├── check-dependencies.js     # Script de vérification
│   └── test-sync.js              # Script de test sync
└── DEPENDENCIES.md               # Ce fichier
```

---

## Problèmes Courants

### 1. PouchDB ne fonctionne pas

```bash
# Réinstaller les dépendances PouchDB
npm uninstall pouchdb-react-native pouchdb-adapter-react-native-sqlite
npm install pouchdb-react-native pouchdb-adapter-react-native-sqlite

# Nettoyer le cache
npm start -- --reset-cache
```

### 2. Erreur SQLite sur Android

```bash
# Nettoyer le build Android
cd android && ./gradlew clean && cd ..

# Reconstruire
npm run android
```

### 3. UUID ne génère pas d'identifiants

```javascript
// Utiliser la version v4 explicitement
import { v4 as uuidv4 } from 'uuid';
const id = uuidv4();
```

### 4. NetInfo ne détecte pas le réseau

Pour React Native 0.55.x, utilisez:

```javascript
import { NetInfo } from 'react-native';

// Vérifier la connexion
NetInfo.isConnected.fetch().then(isConnected => {
  console.log('Connecté:', isConnected);
});

// Écouter les changements
NetInfo.addEventListener('connectionChange', state => {
  console.log('État réseau:', state);
});
```

### 5. AsyncStorage ne sauvegarde pas

```javascript
import { AsyncStorage } from 'react-native';

// Utiliser try/catch pour gérer les erreurs
try {
  await AsyncStorage.setItem('key', JSON.stringify(data));
  const value = await AsyncStorage.getItem('key');
  console.log('Récupéré:', JSON.parse(value));
} catch (error) {
  console.error('Erreur AsyncStorage:', error);
}
```

---

## Scripts NPM Disponibles

| Script | Commande | Description |
|--------|----------|-------------|
| `check:deps` | `npm run check:deps` | Vérifie les dépendances |
| `test:api` | `npm run test:api` | Teste la connexion API |
| `sync:test` | `npm run sync:test` | Teste la synchronisation |
| `clean:cache` | `npm run clean:cache` | Nettoie le cache Metro |
| `reinstall` | `npm run reinstall` | Réinstalle node_modules |
| `android:clean` | `npm run android:clean` | Nettoie le build Android |

---

## Support

Pour les problèmes liés à la couche API:
1. Exécutez `npm run check:deps` pour vérifier les dépendances
2. Exécutez `npm run sync:test` pour tester la connexion
3. Consultez les logs avec le mode debug activé

```javascript
import { FrappeAPI, SyncService } from './src/api';

// Activer le mode debug
FrappeAPI.setDebugMode(true);
SyncService._debugMode = true;
```

---

*Documentation générée pour TailPOS v1.4.0 avec couche API v2.1.0*
