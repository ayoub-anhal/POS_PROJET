# Guide de Test - TailPOS API ERPNext

Ce document explique comment tester la connexion et les fonctionnalités de la couche API TailPOS.

---

## Table des Matières

1. [Tests Rapides](#1-tests-rapides)
2. [Tests en Ligne de Commande](#2-tests-en-ligne-de-commande)
3. [Tests dans React Native](#3-tests-dans-react-native)
4. [Catégories de Tests](#4-catégories-de-tests)
5. [Interprétation des Résultats](#5-interprétation-des-résultats)
6. [Résolution des Problèmes](#6-résolution-des-problèmes)
7. [Configuration de Test](#7-configuration-de-test)

---

## 1. Tests Rapides

### Vérification des dépendances

```bash
npm run check:deps
```

### Test de connexion à l'API

```bash
npm run sync:test
```

### Test complet de l'API

```bash
./scripts/test_api.sh http://localhost:8000
```

---

## 2. Tests en Ligne de Commande

### Script test_api.sh

Ce script utilise curl pour tester tous les endpoints de l'API ERPNext.

```bash
# Usage basique
./scripts/test_api.sh

# Avec URL personnalisée
./scripts/test_api.sh http://192.168.1.100:8000

# Avec variables d'environnement
ERPNEXT_USER=admin ERPNEXT_PASSWORD=admin123 ./scripts/test_api.sh
```

**Tests effectués:**
- Accessibilité du serveur
- Authentification (login/logout)
- Récupération des Items
- Récupération des Customers
- Récupération du POS Profile
- Récupération du Stock

### Script test_full_flow.sh

Ce script simule un flux de vente complet.

```bash
# Usage
./scripts/test_full_flow.sh http://localhost:8000
```

**Étapes du flux:**
1. Connexion au serveur
2. Récupération des produits
3. Récupération d'un client
4. Récupération du POS Profile
5. Création d'une facture POS (test)
6. Vérification du stock
7. Déconnexion

---

## 3. Tests dans React Native

### Importer les modules de test

```javascript
import {
  testSuite,
  TestRunner,
  TEST_CATEGORIES,
  TEST_STATUS
} from './src/api';
```

### Exécuter tous les tests

```javascript
// Configuration
const config = {
  serverUrl: 'http://192.168.1.100:8000',
  username: 'pos_user@example.com',
  password: 'pos_password_123',
  timeout: 15000,
  verbose: true
};

// Exécuter tous les tests
const results = await testSuite.runAll(config);

console.log('Résumé:', results.summary);
console.log('Taux de réussite:', results.successRate + '%');
console.log('Recommandations:', results.recommendations);
```

### Exécuter une catégorie de tests

```javascript
// Tester uniquement la connexion
const connectionResults = await testSuite.runCategory(
  TEST_CATEGORIES.CONNECTION,
  config
);

// Tester uniquement les produits
const itemsResults = await testSuite.runCategory(
  TEST_CATEGORIES.ITEMS,
  config
);
```

### Écouter les événements de test

```javascript
// Ajouter un listener
const removeListener = testSuite.addListener((event) => {
  switch (event.event) {
    case 'suite_started':
      console.log('Début des tests:', event.totalTests);
      break;

    case 'test_completed':
      const { name, status } = event.test;
      console.log(`${name}: ${status}`);
      break;

    case 'suite_completed':
      console.log('Tests terminés:', event.summary);
      break;
  }
});

// Exécuter les tests
await testSuite.runAll(config);

// Retirer le listener
removeListener();
```

### Utiliser TestRunner directement

```javascript
import { TestRunner } from './src/api/TestConnection';

const runner = new TestRunner({
  serverUrl: 'http://localhost:8000',
  username: 'admin',
  password: 'admin123'
});

const report = await runner.runAllTests();
console.log(report);
```

---

## 4. Catégories de Tests

| Catégorie | Description | Tests |
|-----------|-------------|-------|
| `dependencies` | Vérification des packages | Packages npm installés |
| `connection` | Accessibilité serveur | Ping serveur, API disponible |
| `authentication` | Login/Logout | Authentification, session |
| `items` | Produits | Liste, détail, catégories |
| `customers` | Clients | Liste, création |
| `pos` | Configuration POS | POS Profile, Warehouse, Price List |
| `mapping` | Transformation données | Item→Product, Receipt→Invoice |
| `offline` | Mode hors ligne | Queue, détection réseau |
| `sync` | Synchronisation | Statut sync, queue |

---

## 5. Interprétation des Résultats

### Statuts de test

| Statut | Signification |
|--------|---------------|
| `PASSED` | Test réussi ✅ |
| `FAILED` | Test échoué (erreur fonctionnelle) ❌ |
| `ERROR` | Erreur technique (timeout, exception) ⚠️ |
| `SKIPPED` | Test ignoré ⏭️ |

### Structure du rapport

```javascript
{
  summary: {
    total: 20,        // Nombre total de tests
    passed: 18,       // Tests réussis
    failed: 1,        // Tests échoués
    errors: 0,        // Erreurs techniques
    skipped: 1,       // Tests ignorés
    successRate: '94.7%',
    duration: 5432    // Durée en ms
  },
  results: [
    { name: 'Serveur accessible', status: 'passed', duration: 234 },
    { name: 'Authentification', status: 'passed', duration: 567 },
    // ...
  ],
  recommendations: [
    'Tous les tests ont réussi - Configuration OK!'
  ]
}
```

### Exemple de sortie console

```
==========================================
  TEST API ERPNEXT - TAILPOS
==========================================

--- CONNEXION ---
  [OK] Serveur accessible (234ms)
  [OK] API Frappe disponible (123ms)

--- AUTHENTIFICATION ---
  [OK] Login (456ms)
  [OK] Get Logged User (89ms)
  [OK] Logout (67ms)

--- ITEMS ---
  [OK] Récupérer liste Items (345ms)
  [OK] Récupérer Item par code (234ms)

==========================================
  RÉSUMÉ
==========================================
  Total:    20
  Réussis:  18
  Échoués:  1
  Erreurs:  0
  Taux:     94.7%
==========================================
```

---

## 6. Résolution des Problèmes

### Échec de connexion

**Symptôme:** `Serveur accessible` échoue

**Solutions:**
1. Vérifiez que ERPNext est démarré
2. Vérifiez l'URL (http vs https, port correct)
3. Vérifiez le pare-feu / accès réseau
4. Testez avec curl: `curl http://localhost:8000`

### Échec d'authentification

**Symptôme:** `Authentification` échoue

**Solutions:**
1. Vérifiez le username et password
2. Vérifiez que l'utilisateur existe dans ERPNext
3. Vérifiez que l'utilisateur a les rôles appropriés
4. Vérifiez les clés API si vous utilisez l'authentification par token

### Échec des tests Items

**Symptôme:** `Récupérer liste Items` échoue

**Solutions:**
1. Créez des Items dans ERPNext
2. Vérifiez les permissions de l'utilisateur sur le doctype Item
3. Vérifiez que la Company est configurée

### Échec des tests POS

**Symptôme:** `Configuration POS Profile` échoue

**Solutions:**
1. Créez un POS Profile dans ERPNext
2. Configurez un Warehouse dans le POS Profile
3. Configurez une Price List
4. Configurez les modes de paiement (Cash, etc.)

### Échec des tests Offline

**Symptôme:** Tests queue offline échouent

**Solutions:**
1. Vérifiez que PouchDB est correctement installé
2. Vérifiez les permissions SQLite sur le device
3. Nettoyez le cache: `npm run clean:cache`

---

## 7. Configuration de Test

### Fichier de configuration

Créez un fichier `src/api/config.json` pour les tests:

```json
{
  "serverUrl": "http://localhost:8000",
  "username": "pos_user@example.com",
  "password": "pos_password_123",
  "company": "My Company",
  "warehouse": "Main Store - MC",
  "posProfile": "POS-001"
}
```

### Variables d'environnement

Pour les scripts shell:

```bash
export ERPNEXT_URL=http://localhost:8000
export ERPNEXT_USER=pos_user@example.com
export ERPNEXT_PASSWORD=pos_password_123

./scripts/test_api.sh
```

### Configuration dans React Native

```javascript
import ApiConfig from './src/api/ApiConfig';

// Configurer avant les tests
await ApiConfig.saveConfig({
  serverUrl: 'http://192.168.1.100:8000',
  username: 'pos_user@example.com',
  password: 'pos_password_123',
  company: 'My Company',
  warehouse: 'Main Store',
  posProfile: 'POS-001'
});
```

---

## Scripts NPM Disponibles

| Script | Commande | Description |
|--------|----------|-------------|
| `check:deps` | `npm run check:deps` | Vérifie les dépendances |
| `test:api` | `npm run test:api` | Lance le script de test API |
| `sync:test` | `npm run sync:test` | Teste la connexion sync |
| `clean:cache` | `npm run clean:cache` | Nettoie le cache Metro |

---

## Checklist avant Production

- [ ] Tous les tests de connexion passent
- [ ] Authentification fonctionne
- [ ] Items sont récupérés correctement
- [ ] Customers sont récupérés correctement
- [ ] POS Profile est configuré
- [ ] Mode offline fonctionne
- [ ] Synchronisation fonctionne

---

*Documentation générée pour TailPOS v1.4.0 avec API v2.3.0*
