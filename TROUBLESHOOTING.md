# 🔧 Guide de Dépannage - TailPOS ERPNext

Ce guide vous aide à résoudre les problèmes courants lors de l'utilisation de TailPOS avec ERPNext.

---

## Table des Matières

1. [Problèmes de Connexion](#1-problèmes-de-connexion)
2. [Problèmes d'Authentification](#2-problèmes-dauthentification)
3. [Problèmes de Synchronisation](#3-problèmes-de-synchronisation)
4. [Problèmes de Stock](#4-problèmes-de-stock)
5. [Problèmes React Native / Build](#5-problèmes-react-native--build)
6. [Problèmes ERPNext](#6-problèmes-erpnext)
7. [Problèmes de Performance](#7-problèmes-de-performance)
8. [Logs et Diagnostic](#8-logs-et-diagnostic)

---

## 1. Problèmes de Connexion

### 1.1 "Serveur inaccessible" / Network Error

**Symptômes:**
- Message "Network Error" ou "Serveur inaccessible"
- Timeout lors de la connexion
- L'application reste bloquée sur "Connexion..."

**Diagnostic:**
```bash
# Tester l'accès au serveur
curl http://SERVEUR:8000

# Vérifier le port
netstat -an | grep 8000

# Ping le serveur
ping ADRESSE_IP_SERVEUR
```

**Solutions:**

1. **Vérifier que ERPNext est démarré:**
```bash
cd ~/frappe-bench
bench start
```

2. **Vérifier l'URL dans la configuration:**
```javascript
// src/api/config.json
{
  "serverUrl": "http://192.168.1.100:8000"  // Pas de / à la fin!
}
```

3. **Vérifier le pare-feu:**
```bash
# Linux
sudo ufw allow 8000/tcp
sudo ufw status

# Windows
netsh advfirewall firewall add rule name="ERPNext" dir=in action=allow protocol=tcp localport=8000
```

4. **ERPNext écoute sur toutes les interfaces:**
```bash
bench set-config -g host 0.0.0.0
bench restart
```

5. **Sur Android - Problème de cleartext HTTP:**
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<application
  android:usesCleartextTraffic="true"
  ...>
```

### 1.2 "CORS Error" / Cross-Origin

**Symptômes:**
- Erreur "Access-Control-Allow-Origin" dans la console
- Requêtes bloquées par le navigateur

**Solutions:**

1. **Configurer CORS dans ERPNext:**
```bash
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
bench restart
```

2. **Configuration nginx (si reverse proxy):**
```nginx
location / {
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization';
    # ... reste de la config
}
```

### 1.3 "Connection Timeout"

**Symptômes:**
- Les requêtes prennent trop de temps
- Erreur timeout après 30 secondes

**Solutions:**

1. **Augmenter le timeout:**
```javascript
const api = new FrappeAPI('http://server:8000', {
  timeout: 60000  // 60 secondes
});
```

2. **Vérifier la charge du serveur:**
```bash
# CPU et mémoire
top

# Processus bench
ps aux | grep bench
```

3. **Vérifier les workers Gunicorn:**
```bash
bench set-config -g gunicorn_workers 4
bench restart
```

---

## 2. Problèmes d'Authentification

### 2.1 "Invalid login credentials"

**Symptômes:**
- Message "Invalid login credentials"
- Impossible de se connecter

**Diagnostic:**
```bash
# Tester le login avec curl
curl -X POST http://SERVEUR:8000/api/method/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "usr=USER&pwd=PASSWORD"
```

**Solutions:**

1. **Vérifier les identifiants:**
   - L'utilisateur existe dans ERPNext
   - Le mot de passe est correct
   - L'utilisateur est activé (Enabled = Yes)

2. **Réinitialiser le mot de passe:**
```bash
bench --site site1.local set-admin-password NewPassword123
```

3. **Vérifier les rôles de l'utilisateur:**
   - Setup > User > [utilisateur]
   - Vérifier les rôles: Sales User, POS User, Stock User

### 2.2 "Permission denied" / 403 Forbidden

**Symptômes:**
- Erreur 403 sur certaines requêtes
- "Permission denied for Item"

**Solutions:**

1. **Vérifier les permissions utilisateur:**
   - Setup > Role Permission Manager
   - Vérifier que le rôle a accès au DocType

2. **Attribuer le POS Profile à l'utilisateur:**
   - Selling > POS Profile > [profile]
   - Onglet "User Permissions" > Ajouter l'utilisateur

3. **Vérifier les User Permissions:**
   - Setup > User Permission
   - Ajouter les permissions Company, Warehouse, etc.

### 2.3 Session expirée

**Symptômes:**
- Déconnexion automatique
- "Session expired" après un moment

**Solutions:**

1. **Augmenter la durée de session:**
```bash
cd ~/frappe-bench/sites/site1.local
nano site_config.json
```

```json
{
  "session_expiry": "24:00:00"
}
```

2. **Implémenter le refresh automatique:**
```javascript
// Dans l'application
setInterval(async () => {
  if (await api.isAuthenticated()) {
    await api.getLoggedUser(); // Refresh session
  }
}, 10 * 60 * 1000); // Toutes les 10 minutes
```

---

## 3. Problèmes de Synchronisation

### 3.1 "Sync failed" / Échec de synchronisation

**Symptômes:**
- La synchronisation échoue
- Produits non mis à jour

**Diagnostic:**
```javascript
// Activer les logs détaillés
import { SyncService } from './src/api';
SyncService.setDebugMode(true);

const result = await syncService.syncAll();
console.log('Sync result:', result);
```

**Solutions:**

1. **Vérifier la connexion réseau:**
```javascript
import { networkMonitor } from './src/api';
console.log('Online:', networkMonitor.isOnline());
```

2. **Vérifier les données de configuration:**
```javascript
import { ApiConfig } from './src/api';
const config = await ApiConfig.loadConfig();
console.log('Config:', config);
```

3. **Traiter la queue hors ligne:**
```javascript
import { offlineQueue } from './src/api';
const pending = await offlineQueue.getPendingItems();
console.log('Pending:', pending.length);
await offlineQueue.processQueue();
```

### 3.2 Données désynchronisées

**Symptômes:**
- Les prix ne correspondent pas
- Produits manquants dans TailPOS

**Solutions:**

1. **Forcer une synchronisation complète:**
```javascript
await syncService.fullSync({ force: true });
```

2. **Vider le cache local:**
```javascript
// Realm
const realm = getRealm();
realm.write(() => {
  realm.deleteAll();
});

// Puis resync
await syncService.syncAll();
```

3. **Vérifier les filtres de sync:**
```javascript
// S'assurer que les items sont "is_sales_item = 1"
const items = await api.getItems({
  filters: [['is_sales_item', '=', 1]]
});
```

### 3.3 Factures non envoyées

**Symptômes:**
- Ventes enregistrées localement mais pas dans ERPNext
- Queue qui ne se vide pas

**Solutions:**

1. **Vérifier la queue offline:**
```javascript
const queue = await offlineQueue.getAll();
queue.forEach(item => {
  console.log(item.type, item.status, item.error);
});
```

2. **Retraiter les éléments en erreur:**
```javascript
await offlineQueue.retryFailed();
```

3. **Vérifier les données de la facture:**
```javascript
// Les champs obligatoires
const invoice = {
  customer: 'CUST-001',      // Doit exister
  company: 'Ma Société',      // Doit correspondre
  pos_profile: 'Caisse 1',    // Doit exister
  items: [...]                 // Au moins un item
};
```

---

## 4. Problèmes de Stock

### 4.1 Stock incorrect

**Symptômes:**
- Le stock affiché ne correspond pas à ERPNext
- Quantités négatives

**Diagnostic:**
```bash
# Dans ERPNext, vérifier le stock
bench --site site1.local console
> frappe.db.get_value('Bin', {'item_code': 'PROD-001', 'warehouse': 'Store - XX'}, 'actual_qty')
```

**Solutions:**

1. **Réconcilier le stock:**
   - Stock > Stock Reconciliation > New
   - Sélectionner l'entrepôt et corriger les quantités

2. **Vérifier l'entrepôt configuré:**
```javascript
// L'entrepôt dans la config doit correspondre exactement
{
  "warehouse": "Magasin Principal - MS"  // Avec l'abréviation!
}
```

3. **Resynchroniser le stock:**
```javascript
await syncService.syncStock();
```

### 4.2 "Insufficient Stock"

**Symptômes:**
- Erreur lors de la création de facture
- "Cannot deliver more than available"

**Solutions:**

1. **Vérifier le stock disponible:**
```javascript
const stock = await api.getStockBalance('PROD-001', 'Warehouse - XX');
if (stock < quantity) {
  alert('Stock insuffisant');
}
```

2. **Permettre le stock négatif (temporairement):**
   - Stock > Stock Settings
   - Cocher "Allow Negative Stock"

3. **Créer une réception de stock:**
   - Stock > Stock Entry > New
   - Type: Material Receipt

---

## 5. Problèmes React Native / Build

### 5.1 "SDK location not found"

**Symptômes:**
- Erreur build Android
- "SDK location not found"

**Solution:**
```bash
cd android
echo "sdk.dir=C:\\Users\\USERNAME\\AppData\\Local\\Android\\Sdk" > local.properties
# OU sur Linux/Mac
echo "sdk.dir=$HOME/Android/Sdk" > local.properties
```

### 5.2 "Gradle build failed"

**Symptômes:**
- Erreur lors du build
- "Could not resolve dependencies"

**Solutions:**

1. **Nettoyer et reconstruire:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

2. **Invalider les caches:**
```bash
rm -rf node_modules
rm -rf android/app/build
npm install
```

3. **Vérifier la version de Gradle:**
```properties
# android/gradle/wrapper/gradle-wrapper.properties
distributionUrl=https\://services.gradle.org/distributions/gradle-6.9-all.zip
```

### 5.3 Metro Bundler issues

**Symptômes:**
- "Unable to resolve module"
- Metro ne démarre pas

**Solutions:**

1. **Reset le cache Metro:**
```bash
npm start -- --reset-cache
```

2. **Nettoyer complètement:**
```bash
watchman watch-del-all
rm -rf node_modules
rm -rf $TMPDIR/react-*
rm -rf $TMPDIR/metro-*
npm install
npm start -- --reset-cache
```

### 5.4 "React Native version mismatch"

**Solution:**
```bash
# Vérifier la version dans package.json
# react-native: 0.55.3 pour ce projet

# Réinstaller les dépendances
rm -rf node_modules
npm install
```

---

## 6. Problèmes ERPNext

### 6.1 "bench: command not found"

**Solution:**
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 6.2 MariaDB "Access denied"

**Solution:**
```bash
sudo mysql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'nouveau_mot_de_passe';
FLUSH PRIVILEGES;
EXIT;
```

### 6.3 "Port 8000 already in use"

**Solution:**
```bash
# Trouver le processus
lsof -i :8000

# Le tuer
kill -9 <PID>

# Ou changer de port
bench set-config webserver_port 8001
```

### 6.4 Redis connection error

**Solution:**
```bash
sudo systemctl restart redis-server
redis-cli ping  # Doit répondre PONG
```

### 6.5 "Site not found"

**Solution:**
```bash
cd ~/frappe-bench
bench use site1.local
bench --site site1.local migrate
```

---

## 7. Problèmes de Performance

### 7.1 Application lente

**Solutions:**

1. **Limiter les données synchronisées:**
```javascript
// Ne sync que les items actifs
const items = await api.getItems({
  filters: [
    ['is_sales_item', '=', 1],
    ['disabled', '=', 0]
  ],
  limit_page_length: 500
});
```

2. **Activer la pagination:**
```javascript
const PAGE_SIZE = 100;
let page = 0;
let hasMore = true;

while (hasMore) {
  const items = await api.getItems({
    limit_start: page * PAGE_SIZE,
    limit_page_length: PAGE_SIZE
  });
  hasMore = items.length === PAGE_SIZE;
  page++;
}
```

3. **Optimiser les requêtes:**
```javascript
// Demander uniquement les champs nécessaires
const items = await api.getItems({
  fields: ['name', 'item_name', 'standard_rate']
});
```

### 7.2 Synchronisation lente

**Solutions:**

1. **Sync incrémentale:**
```javascript
await syncService.syncItems({
  modifiedAfter: lastSyncDate
});
```

2. **Sync en arrière-plan:**
```javascript
// Utiliser le NetworkMonitor
networkMonitor.on('online', async () => {
  await syncService.syncAll();
});
```

---

## 8. Logs et Diagnostic

### 8.1 Activer les logs détaillés

```javascript
// API
import { FrappeAPI } from './src/api';
const api = new FrappeAPI(url, { debug: true });

// DataMapper
import { setDebugMode } from './src/api';
setDebugMode(true);
```

### 8.2 Logs ERPNext

```bash
# Logs Frappe
tail -f ~/frappe-bench/logs/frappe.log

# Logs workers
tail -f ~/frappe-bench/logs/worker.log

# Logs web
tail -f ~/frappe-bench/logs/web.log
```

### 8.3 Script de diagnostic

```bash
# Exécuter le diagnostic complet
./scripts/test_api.sh http://SERVEUR:8000
./scripts/test_full_flow.sh http://SERVEUR:8000
```

### 8.4 Rapport de diagnostic

```javascript
import { testSuite } from './src/api';

const report = await testSuite.runAll({
  serverUrl: 'http://server:8000',
  username: 'user',
  password: 'pass',
  verbose: true
});

console.log('Taux de réussite:', report.successRate);
console.log('Recommandations:', report.recommendations);
```

---

## Checklist Rapide

| Problème | Première chose à vérifier |
|----------|---------------------------|
| Connexion échoue | ERPNext démarré? URL correcte? |
| Auth échoue | Utilisateur existe? Rôles attribués? |
| Sync échoue | Réseau OK? Queue pleine? |
| Stock incorrect | Bon entrepôt configuré? |
| Build échoue | SDK Android installé? Gradle clean? |
| Performance | Limiter les données? Pagination? |

---

## Besoin d'aide supplémentaire?

1. Consultez la [documentation API](./API_REFERENCE.md)
2. Vérifiez le [guide d'installation](./INSTALLATION.md)
3. Exécutez les [tests de diagnostic](./tailpos-master/TESTING.md)

---

*Guide de dépannage TailPOS v1.4.0*
