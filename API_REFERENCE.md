# 📚 Référence API - TailPOS ERPNext Integration

Documentation complète de l'API de synchronisation TailPOS-ERPNext.

---

## Table des Matières

1. [Authentification](#1-authentification)
2. [Produits (Items)](#2-produits-items)
3. [Clients (Customers)](#3-clients-customers)
4. [Ventes (POS Invoice)](#4-ventes-pos-invoice)
5. [Stock](#5-stock)
6. [Configuration POS](#6-configuration-pos)
7. [Codes d'Erreur](#7-codes-derreur)
8. [Classes et Modules](#8-classes-et-modules)

---

## 1. Authentification

### 1.1 Login

Authentifie un utilisateur auprès d'ERPNext.

**Endpoint:** `POST /api/method/login`

**Paramètres:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| usr | string | Oui | Email ou username |
| pwd | string | Oui | Mot de passe |

**Exemple de requête:**
```javascript
import { FrappeAPI } from './src/api';

const api = new FrappeAPI('http://localhost:8000');
const result = await api.login('user@example.com', 'password123');
```

**Réponse succès:**
```json
{
  "message": "Logged In",
  "home_page": "/desk",
  "full_name": "John Doe"
}
```

**Réponse erreur:**
```json
{
  "message": "Invalid login credentials",
  "exc_type": "AuthenticationError"
}
```

### 1.2 Logout

Déconnecte l'utilisateur actuel.

**Endpoint:** `GET /api/method/logout`

**Exemple:**
```javascript
await api.logout();
```

### 1.3 Get Logged User

Récupère l'utilisateur actuellement connecté.

**Endpoint:** `GET /api/method/frappe.auth.get_logged_user`

**Exemple:**
```javascript
const user = await api.getLoggedUser();
// Retourne: "user@example.com"
```

### 1.4 Vérifier la Session

**Exemple:**
```javascript
const isAuthenticated = await api.isAuthenticated();
// Retourne: true ou false
```

---

## 2. Produits (Items)

### 2.1 Liste des Produits

Récupère la liste des produits avec filtres optionnels.

**Endpoint:** `GET /api/resource/Item`

**Paramètres:**
| Paramètre | Type | Description |
|-----------|------|-------------|
| fields | array | Champs à retourner |
| filters | array | Filtres de recherche |
| limit_page_length | number | Nombre max de résultats |
| limit_start | number | Offset pour pagination |
| order_by | string | Tri des résultats |

**Exemple:**
```javascript
const items = await api.getItems({
  fields: ['name', 'item_name', 'standard_rate', 'stock_uom'],
  filters: [['is_sales_item', '=', 1]],
  limit_page_length: 100
});
```

**Réponse:**
```json
{
  "data": [
    {
      "name": "PROD-001",
      "item_name": "Produit Test",
      "standard_rate": 29.99,
      "stock_uom": "Nos"
    }
  ]
}
```

### 2.2 Détail d'un Produit

Récupère les détails complets d'un produit.

**Endpoint:** `GET /api/resource/Item/{name}`

**Exemple:**
```javascript
const item = await api.getItem('PROD-001');
```

**Réponse:**
```json
{
  "data": {
    "name": "PROD-001",
    "item_name": "Produit Test",
    "item_code": "PROD-001",
    "item_group": "Products",
    "stock_uom": "Nos",
    "standard_rate": 29.99,
    "description": "Description du produit",
    "is_sales_item": 1,
    "is_stock_item": 1,
    "image": "/files/product.jpg",
    "barcode": "123456789"
  }
}
```

### 2.3 Créer un Produit

Crée un nouveau produit dans ERPNext.

**Endpoint:** `POST /api/resource/Item`

**Exemple:**
```javascript
const newItem = await api.createItem({
  item_code: 'PROD-NEW',
  item_name: 'Nouveau Produit',
  item_group: 'Products',
  stock_uom: 'Nos',
  standard_rate: 19.99,
  is_sales_item: 1,
  is_stock_item: 1
});
```

### 2.4 Mettre à jour un Produit

Met à jour un produit existant.

**Endpoint:** `PUT /api/resource/Item/{name}`

**Exemple:**
```javascript
const updatedItem = await api.updateItem('PROD-001', {
  standard_rate: 34.99,
  description: 'Nouvelle description'
});
```

### 2.5 Catégories (Item Groups)

Récupère les catégories de produits.

**Endpoint:** `GET /api/resource/Item Group`

**Exemple:**
```javascript
const categories = await api.getItemGroups();
```

---

## 3. Clients (Customers)

### 3.1 Liste des Clients

**Endpoint:** `GET /api/resource/Customer`

**Exemple:**
```javascript
const customers = await api.getCustomers({
  fields: ['name', 'customer_name', 'mobile_no', 'email_id'],
  limit_page_length: 100
});
```

**Réponse:**
```json
{
  "data": [
    {
      "name": "CUST-001",
      "customer_name": "Jean Dupont",
      "mobile_no": "+33612345678",
      "email_id": "jean@example.com"
    }
  ]
}
```

### 3.2 Détail d'un Client

**Endpoint:** `GET /api/resource/Customer/{name}`

**Exemple:**
```javascript
const customer = await api.getCustomer('CUST-001');
```

### 3.3 Créer un Client

**Endpoint:** `POST /api/resource/Customer`

**Exemple:**
```javascript
const newCustomer = await api.createCustomer({
  customer_name: 'Nouveau Client',
  customer_type: 'Individual',
  customer_group: 'Retail',
  territory: 'France',
  mobile_no: '+33698765432',
  email_id: 'nouveau@example.com'
});
```

### 3.4 Mettre à jour un Client

**Endpoint:** `PUT /api/resource/Customer/{name}`

**Exemple:**
```javascript
const updated = await api.updateCustomer('CUST-001', {
  mobile_no: '+33612121212'
});
```

### 3.5 Rechercher un Client

**Exemple:**
```javascript
const results = await api.searchCustomers('Dupont');
```

---

## 4. Ventes (POS Invoice)

### 4.1 Créer une Facture POS

Crée une nouvelle facture de vente POS.

**Endpoint:** `POST /api/resource/POS Invoice`

**Exemple:**
```javascript
const invoice = await api.createPOSInvoice({
  customer: 'CUST-001',
  company: 'Ma Société',
  pos_profile: 'Caisse 1',
  selling_price_list: 'Vente Retail',
  set_warehouse: 'Magasin Principal - MS',
  items: [
    {
      item_code: 'PROD-001',
      qty: 2,
      rate: 29.99
    },
    {
      item_code: 'PROD-002',
      qty: 1,
      rate: 49.99
    }
  ],
  payments: [
    {
      mode_of_payment: 'Cash',
      amount: 109.97
    }
  ]
});
```

**Structure complète de la requête:**
```json
{
  "doctype": "POS Invoice",
  "customer": "CUST-001",
  "company": "Ma Société",
  "pos_profile": "Caisse 1",
  "selling_price_list": "Vente Retail",
  "set_warehouse": "Magasin Principal - MS",
  "posting_date": "2025-01-17",
  "posting_time": "14:30:00",
  "is_pos": 1,
  "items": [
    {
      "item_code": "PROD-001",
      "item_name": "Produit Test",
      "qty": 2,
      "rate": 29.99,
      "amount": 59.98,
      "uom": "Nos",
      "warehouse": "Magasin Principal - MS"
    }
  ],
  "payments": [
    {
      "mode_of_payment": "Cash",
      "amount": 59.98
    }
  ],
  "docstatus": 1
}
```

**Réponse:**
```json
{
  "data": {
    "name": "POS-INV-2025-00001",
    "customer": "CUST-001",
    "grand_total": 109.97,
    "status": "Paid",
    "docstatus": 1
  }
}
```

### 4.2 Liste des Factures POS

**Endpoint:** `GET /api/resource/POS Invoice`

**Exemple:**
```javascript
const invoices = await api.getPOSInvoices({
  filters: [
    ['posting_date', '>=', '2025-01-01'],
    ['docstatus', '=', 1]
  ],
  order_by: 'creation desc',
  limit_page_length: 50
});
```

### 4.3 Détail d'une Facture

**Endpoint:** `GET /api/resource/POS Invoice/{name}`

**Exemple:**
```javascript
const invoice = await api.getPOSInvoice('POS-INV-2025-00001');
```

---

## 5. Stock

### 5.1 Consulter le Stock

Récupère le stock d'un article dans un entrepôt.

**Endpoint:** `GET /api/method/erpnext.stock.utils.get_stock_balance`

**Paramètres:**
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| item_code | string | Oui | Code de l'article |
| warehouse | string | Oui | Nom de l'entrepôt |

**Exemple:**
```javascript
const stock = await api.getStockBalance('PROD-001', 'Magasin Principal - MS');
// Retourne: 150.0
```

### 5.2 Liste des Entrepôts

**Endpoint:** `GET /api/resource/Warehouse`

**Exemple:**
```javascript
const warehouses = await api.getWarehouses({
  filters: [['is_group', '=', 0]],
  fields: ['name', 'warehouse_name', 'company']
});
```

### 5.3 Stock par Entrepôt (Bin)

**Endpoint:** `GET /api/resource/Bin`

**Exemple:**
```javascript
const bins = await api.getBins({
  filters: [['item_code', '=', 'PROD-001']],
  fields: ['warehouse', 'actual_qty', 'projected_qty']
});
```

**Réponse:**
```json
{
  "data": [
    {
      "warehouse": "Magasin Principal - MS",
      "actual_qty": 150.0,
      "projected_qty": 145.0
    }
  ]
}
```

### 5.4 Créer un Mouvement de Stock

**Endpoint:** `POST /api/resource/Stock Entry`

**Exemple - Réception de marchandise:**
```javascript
const stockEntry = await api.createStockEntry({
  stock_entry_type: 'Material Receipt',
  to_warehouse: 'Magasin Principal - MS',
  items: [
    {
      item_code: 'PROD-001',
      qty: 50,
      basic_rate: 15.00
    }
  ]
});
```

---

## 6. Configuration POS

### 6.1 POS Profile

**Endpoint:** `GET /api/resource/POS Profile/{name}`

**Exemple:**
```javascript
const profile = await api.getPOSProfile('Caisse 1');
```

**Réponse:**
```json
{
  "data": {
    "name": "Caisse 1",
    "company": "Ma Société",
    "warehouse": "Magasin Principal - MS",
    "selling_price_list": "Vente Retail",
    "currency": "EUR",
    "write_off_account": "Write Off - MS",
    "payments": [
      {
        "mode_of_payment": "Cash",
        "default": 1
      },
      {
        "mode_of_payment": "Card",
        "default": 0
      }
    ]
  }
}
```

### 6.2 Liste de Prix

**Endpoint:** `GET /api/resource/Item Price`

**Exemple:**
```javascript
const prices = await api.getItemPrices({
  filters: [
    ['price_list', '=', 'Vente Retail'],
    ['selling', '=', 1]
  ],
  fields: ['item_code', 'price_list_rate', 'currency']
});
```

### 6.3 Modes de Paiement

**Endpoint:** `GET /api/resource/Mode of Payment`

**Exemple:**
```javascript
const paymentModes = await api.getPaymentModes();
```

---

## 7. Codes d'Erreur

### 7.1 Codes API (ERROR_CODES)

| Code | Constante | Description |
|------|-----------|-------------|
| `NETWORK_ERROR` | Erreur réseau | Impossible de joindre le serveur |
| `AUTH_ERROR` | Erreur auth | Authentification échouée |
| `PERMISSION_ERROR` | Permission refusée | Droits insuffisants |
| `NOT_FOUND` | Non trouvé | Ressource inexistante |
| `VALIDATION_ERROR` | Validation échouée | Données invalides |
| `SERVER_ERROR` | Erreur serveur | Erreur interne ERPNext |
| `TIMEOUT_ERROR` | Timeout | Délai d'attente dépassé |
| `UNKNOWN_ERROR` | Erreur inconnue | Erreur non catégorisée |

### 7.2 Utilisation

```javascript
import { FrappeAPI, ApiError, ERROR_CODES } from './src/api';

try {
  await api.login('user', 'wrong_password');
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case ERROR_CODES.AUTH_ERROR:
        console.log('Identifiants incorrects');
        break;
      case ERROR_CODES.NETWORK_ERROR:
        console.log('Serveur inaccessible');
        break;
      default:
        console.log('Erreur:', error.message);
    }
  }
}
```

### 7.3 Structure ApiError

```javascript
{
  name: 'ApiError',
  code: 'AUTH_ERROR',
  message: 'Invalid login credentials',
  statusCode: 401,
  details: { /* données supplémentaires */ }
}
```

---

## 8. Classes et Modules

### 8.1 FrappeAPI

Client principal pour communiquer avec ERPNext.

```javascript
import { FrappeAPI } from './src/api';

// Initialisation
const api = new FrappeAPI('http://localhost:8000', {
  timeout: 30000,
  debug: true
});

// Méthodes disponibles
api.login(username, password)
api.logout()
api.getLoggedUser()
api.isAuthenticated()

api.getItems(options)
api.getItem(name)
api.createItem(data)
api.updateItem(name, data)
api.getItemGroups()

api.getCustomers(options)
api.getCustomer(name)
api.createCustomer(data)
api.updateCustomer(name, data)

api.createPOSInvoice(data)
api.getPOSInvoices(options)
api.getPOSInvoice(name)

api.getStockBalance(itemCode, warehouse)
api.getWarehouses(options)
api.getBins(options)

api.getPOSProfile(name)
api.getItemPrices(options)
```

### 8.2 ApiConfig

Gestion de la configuration persistante.

```javascript
import { ApiConfig } from './src/api';

// Sauvegarder la config
await ApiConfig.saveConfig({
  serverUrl: 'http://192.168.1.100:8000',
  username: 'pos_user@example.com',
  password: 'password123',
  company: 'Ma Société',
  warehouse: 'Magasin Principal - MS',
  posProfile: 'Caisse 1'
});

// Charger la config
const config = await ApiConfig.loadConfig();

// Supprimer la config
await ApiConfig.clearConfig();

// Vérifier si configuré
const isConfigured = await ApiConfig.isConfigured();
```

### 8.3 SyncService

Service de synchronisation bidirectionnelle.

```javascript
import { SyncService, SYNC_TYPES, SYNC_STATUS } from './src/api';

const syncService = new SyncService(api, config);

// Synchroniser les produits
await syncService.syncItems();

// Synchroniser les clients
await syncService.syncCustomers();

// Synchronisation complète
await syncService.syncAll();

// Envoyer les ventes en attente
await syncService.pushPendingReceipts();

// Obtenir le statut
const status = syncService.getStatus();
// { lastSync: Date, pending: 5, status: 'idle' }
```

### 8.4 DataMapper

Transformation des données entre formats.

```javascript
import {
  mapErpItemToTailposProduct,
  mapTailposReceiptToErpInvoice,
  mapErpCustomerToTailpos
} from './src/api';

// ERP Item → TailPOS Product
const product = mapErpItemToTailposProduct(erpItem);

// TailPOS Receipt → ERP Invoice
const invoice = mapTailposReceiptToErpInvoice(receipt, config);

// ERP Customer → TailPOS Customer
const customer = mapErpCustomerToTailpos(erpCustomer);
```

### 8.5 DataValidator

Validation des données.

```javascript
import {
  validate,
  validateItem,
  validateReceipt,
  isValidConfig
} from './src/api';

// Valider un item
const result = validateItem(itemData);
if (!result.valid) {
  console.log('Erreurs:', result.errors);
}

// Valider une config
if (!isValidConfig(config)) {
  throw new Error('Configuration invalide');
}
```

### 8.6 OfflineQueue

Gestion de la queue hors ligne.

```javascript
import { offlineQueue, QUEUE_ITEM_TYPES } from './src/api';

// Ajouter une opération
await offlineQueue.enqueue({
  type: QUEUE_ITEM_TYPES.CREATE_INVOICE,
  data: invoiceData,
  priority: 1
});

// Traiter la queue
await offlineQueue.processQueue();

// Obtenir les éléments en attente
const pending = await offlineQueue.getPendingItems();

// Vider la queue
await offlineQueue.clear();
```

### 8.7 NetworkMonitor

Surveillance de la connexion réseau.

```javascript
import { networkMonitor, NETWORK_EVENTS } from './src/api';

// Démarrer la surveillance
networkMonitor.start();

// Écouter les événements
networkMonitor.on(NETWORK_EVENTS.ONLINE, () => {
  console.log('Connexion rétablie');
  syncService.syncAll();
});

networkMonitor.on(NETWORK_EVENTS.OFFLINE, () => {
  console.log('Mode hors ligne');
});

// Vérifier l'état
const isOnline = networkMonitor.isOnline();

// Arrêter la surveillance
networkMonitor.stop();
```

### 8.8 TestSuite

Suite de tests intégrée.

```javascript
import { testSuite, TEST_CATEGORIES } from './src/api';

// Exécuter tous les tests
const results = await testSuite.runAll(config);

// Exécuter une catégorie
const authTests = await testSuite.runCategory(
  TEST_CATEGORIES.AUTHENTICATION,
  config
);

// Écouter les événements
testSuite.addListener((event) => {
  console.log(event.event, event.test?.name);
});
```

---

## Constantes Exportées

```javascript
// Depuis src/api/index.js
export {
  // Version
  API_VERSION,           // '2.3.0'
  API_ENDPOINTS,         // Tous les endpoints

  // Configuration
  STORAGE_KEY,
  DEFAULT_TIMEOUT,
  DEFAULT_WAREHOUSE,
  DEFAULT_PRICE_LIST,

  // Sync
  SYNC_TYPES,
  SYNC_STATUS,
  SYNC_INTERVAL,

  // Queue Offline
  QUEUE_ITEM_TYPES,
  QUEUE_ITEM_STATUS,
  QUEUE_PRIORITY,

  // Network
  CONNECTION_TYPES,
  MONITOR_STATES,
  NETWORK_EVENTS,

  // Mapping
  PAYMENT_TYPES,
  FIELD_MAPPINGS,

  // Validation
  DATA_TYPES,
  VALIDATION_RESULT,

  // Tests
  TEST_CATEGORIES,
  TEST_STATUS,
  TEST_PRIORITY,

  // Erreurs
  ERROR_CODES,
  ApiError,
  MappingError,
  ValidationError
};
```

---

*Documentation générée pour TailPOS API v2.3.0*
