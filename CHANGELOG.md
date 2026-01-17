# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [2.3.0] - 2025-01-17

### Ajouté
- **Phase 8: Tests et validation**
  - `TestConnection.js` - Suite de tests de connexion complète
  - `TestSuite.js` - Suite de tests intégrée pour React Native
  - `test_api.sh` - Script shell pour tester l'API avec curl
  - `test_full_flow.sh` - Script shell pour tester un flux de vente complet
  - `TESTING.md` - Documentation des tests
- **Phase 9: Documentation**
  - `README.md` - Documentation principale du projet
  - `INSTALLATION.md` - Guide d'installation pas à pas
  - `API_REFERENCE.md` - Référence complète de l'API
  - `TROUBLESHOOTING.md` - Guide de dépannage
  - `CHANGELOG.md` - Historique des versions
  - `CONTRIBUTING.md` - Guide de contribution
  - `PROJECT_STRUCTURE.md` - Structure du projet

### Modifié
- `index.js` - Ajout des exports pour TestConnection et TestSuite
- Version de l'API mise à jour vers 2.3.0

---

## [2.2.0] - 2025-01-17

### Ajouté
- **Phase 7: Vérification des dépendances**
  - `dependencies.js` - Module de vérification des dépendances npm
  - Fonction `checkDependencies()` pour vérifier les packages requis
  - Fonction `checkReactNativeCompatibility()` pour la compatibilité RN 0.55.3
  - Constantes `REQUIRED_DEPENDENCIES` et `REACT_NATIVE_INCLUDED`

### Modifié
- `index.js` - Export du module dependencies, vérification au chargement

---

## [2.1.0] - 2025-01-17

### Ajouté
- **Phase 6: Gestion du mode offline**
  - `OfflineQueue.js` - Queue de stockage des opérations hors ligne
    - Stockage persistant avec PouchDB/SQLite
    - Retry automatique avec backoff exponentiel
    - Traitement par batch des opérations
  - `NetworkMonitor.js` - Surveillance de l'état réseau
    - Détection automatique online/offline
    - Ping serveur périodique
    - Événements pour changement d'état
    - Historique de connectivité

### Modifié
- `SyncService.js` - Intégration avec OfflineQueue et NetworkMonitor
- `index.js` - Export des modules Phase 6

---

## [2.0.0] - 2025-01-17

### Ajouté
- **Phase 5: Mapping des données**
  - `DataMapper.js` - Transformation bidirectionnelle des données
    - Mapping Items ERPNext ↔ Products TailPOS
    - Mapping Customers ERPNext ↔ Customers TailPOS
    - Mapping POS Invoice ERPNext ↔ Receipts TailPOS
    - Mapping Categories/Item Groups
    - Utilitaires: UUID, dates, sanitization
  - `DataValidator.js` - Validation des données avec schémas
    - Schémas pour items, customers, receipts, config
    - Validation avec messages d'erreur détaillés
    - Sanitization automatique des données

### Modifié
- `SyncService.js` - Utilisation de DataMapper pour les transformations
- `index.js` - Export des modules Phase 5

---

## [1.3.0] - 2025-01-17

### Ajouté
- **Phase 4: Service de synchronisation**
  - `SyncService.js` - Service de synchronisation bidirectionnelle
    - Sync des items (ERPNext → TailPOS)
    - Sync des customers (ERPNext → TailPOS)
    - Push des receipts (TailPOS → ERPNext)
    - Queue locale pour opérations hors ligne
    - Retry automatique en cas d'échec

### Modifié
- `index.js` - Export de SyncService et constantes associées

---

## [1.2.0] - 2025-01-17

### Ajouté
- **Phase 3: Configuration API**
  - `ApiConfig.js` - Gestion de la configuration persistante
    - Stockage sécurisé avec AsyncStorage
    - Configuration: serverUrl, username, password, company, warehouse, posProfile
    - Constantes de configuration (timeouts, intervals)

### Modifié
- `FrappeAPI.js` - Support de la configuration externe
- `index.js` - Export de ApiConfig et constantes

---

## [1.1.0] - 2025-01-17

### Ajouté
- **Phase 2: Client API Frappe**
  - `FrappeAPI.js` - Client API REST pour ERPNext
    - Authentification (login, logout, session)
    - CRUD Items (get, create, update)
    - CRUD Customers (get, create, update)
    - POS Invoice (create, get)
    - Stock (balance, bins, warehouses)
    - Gestion des erreurs avec codes
  - `ApiError` - Classe d'erreur personnalisée
  - `ERROR_CODES` - Constantes pour les codes d'erreur

---

## [1.0.0] - 2025-01-17

### Ajouté
- **Phase 1: Structure initiale**
  - Création du dossier `src/api/`
  - `index.js` - Point d'entrée du module API
  - Sauvegarde de la base de code existante
  - Structure de base pour l'intégration ERPNext

---

## [0.x.x] - Versions TailPOS originales

### Base
- Application POS React Native originale
- Stockage local avec Realm
- Interface utilisateur MobX-State-Tree
- Support imprimante Bluetooth

---

## Types de changements

- **Ajouté** pour les nouvelles fonctionnalités
- **Modifié** pour les changements dans les fonctionnalités existantes
- **Déprécié** pour les fonctionnalités qui seront supprimées
- **Retiré** pour les fonctionnalités supprimées
- **Corrigé** pour les corrections de bugs
- **Sécurité** pour les vulnérabilités corrigées

---

## Roadmap

### Version 2.4.0 (Prochaine)
- [ ] Phase 10: Scripts d'automatisation
  - Script d'installation automatique
  - Script de déploiement
  - Script de backup/restore

### Version 3.0.0 (Future)
- [ ] Support multi-entreprise
- [ ] Synchronisation temps réel (WebSocket)
- [ ] Rapports et analytics
- [ ] Support tablette avec interface étendue

---

*Maintenu par l'équipe TailPOS Integration*
