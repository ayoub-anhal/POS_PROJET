/**
 * SyncService.js
 *
 * Service de synchronisation bidirectionnelle entre TailPOS et ERPNext.
 * Ce module gere la synchronisation des donnees (items, clients, ventes)
 * ainsi que la queue offline pour les operations hors connexion.
 *
 * MODIFICATION Phase 6: Integration de OfflineQueue et NetworkMonitor
 * - Utilisation de la nouvelle queue offline robuste
 * - Surveillance reseau amelioree
 * - Methode saveReceipt pour enregistrer les ventes
 *
 * @author TailPOS Integration
 * @version 2.1.0
 * @date 2025-01-17
 */

import { NetInfo } from 'react-native';
import { Toast } from 'native-base';
import FrappeAPI, { ApiError, ERROR_CODES } from './FrappeAPI';
import ApiConfig, {
  MAX_SYNC_RETRIES,
  SYNC_RETRY_DELAY,
  MAX_OFFLINE_QUEUE_SIZE,
} from './ApiConfig';
import { openAndSyncDB } from '../store/PosStore/DbFunctions';

// ============================================================================
// NOUVEAU: Import des modules offline (Phase 6)
// ============================================================================
import offlineQueue, {
  QUEUE_ITEM_TYPES,
  QUEUE_ITEM_STATUS,
  QUEUE_PRIORITY,
} from './OfflineQueue';
import networkMonitor, { NETWORK_EVENTS } from './NetworkMonitor';

// ============================================================================
// CONSTANTES
// ============================================================================

// Types de synchronisation
export const SYNC_TYPES = {
  FULL: 'full',           // Synchronisation complete
  INCREMENTAL: 'incremental', // Synchronisation incrementale
  ITEMS_ONLY: 'items',    // Items seulement
  CUSTOMERS_ONLY: 'customers', // Clients seulement
  RECEIPTS_ONLY: 'receipts',   // Ventes seulement
};

// Statuts de synchronisation
export const SYNC_STATUS = {
  IDLE: 'idle',           // En attente
  SYNCING: 'syncing',     // En cours
  SUCCESS: 'success',     // Reussi
  ERROR: 'error',         // Erreur
  OFFLINE: 'offline',     // Hors ligne
};

// Types d'operations dans la queue offline
export const QUEUE_OPERATION_TYPES = {
  CREATE_INVOICE: 'create_invoice',
  CREATE_CUSTOMER: 'create_customer',
  UPDATE_ITEM: 'update_item',
};

// ============================================================================
// CLASSE SYNCSERVICE
// ============================================================================

class SyncService {
  constructor() {
    // Etat de synchronisation
    this._isSyncing = false;
    this._lastSyncTime = null;
    this._lastSyncStatus = SYNC_STATUS.IDLE;
    this._syncErrors = [];

    // Queue offline
    this._offlineQueue = [];
    this._isProcessingQueue = false;

    // Statistiques
    this._stats = {
      itemsSynced: 0,
      customersSynced: 0,
      receiptsSynced: 0,
      errorCount: 0,
      lastFullSync: null,
    };

    // Callbacks
    this._onSyncStart = null;
    this._onSyncComplete = null;
    this._onSyncError = null;
    this._onProgressUpdate = null;

    // Mode debug
    this._debugMode = false;

    // Bases de donnees PouchDB
    this._itemsDb = null;
    this._customersDb = null;
    this._receiptsDb = null;
    this._categoriesDb = null;
    this._offlineQueueDb = null;
  }

  // ==========================================================================
  // INITIALISATION
  // ==========================================================================

  /**
   * Initialise le service de synchronisation
   * @param {Object} options - Options d'initialisation
   */
  async initialize(options = {}) {
    this._log('Initialisation du service de synchronisation');

    // Configurer le mode debug
    if (options.debugMode !== undefined) {
      this._debugMode = options.debugMode;
    }

    // Configurer les callbacks
    if (options.onSyncStart) this._onSyncStart = options.onSyncStart;
    if (options.onSyncComplete) this._onSyncComplete = options.onSyncComplete;
    if (options.onSyncError) this._onSyncError = options.onSyncError;
    if (options.onProgressUpdate) this._onProgressUpdate = options.onProgressUpdate;

    // Initialiser les bases de donnees
    try {
      this._itemsDb = openAndSyncDB('items');
      this._customersDb = openAndSyncDB('customers');
      this._receiptsDb = openAndSyncDB('receipts');
      this._categoriesDb = openAndSyncDB('categories');
      this._offlineQueueDb = openAndSyncDB('offlineQueue');

      // Charger la queue offline existante (ancienne methode)
      await this._loadOfflineQueue();

      // ================================================================
      // NOUVEAU: Initialiser la nouvelle queue offline (Phase 6)
      // ================================================================
      await this._initializeOfflineSystem(options);

      this._log('Service de synchronisation initialise');
    } catch (error) {
      this._log('Erreur lors de l\'initialisation', error);
    }
  }

  /**
   * NOUVEAU: Initialise le systeme offline (Phase 6)
   * @param {Object} options - Options
   */
  async _initializeOfflineSystem(options = {}) {
    this._log('Initialisation du systeme offline...');

    try {
      // Initialiser la queue offline
      await offlineQueue.initialize({
        api: FrappeAPI,
        mappingConfig: {
          company: ApiConfig.company,
          warehouse: ApiConfig.warehouse,
          priceList: ApiConfig.priceList,
          posProfile: ApiConfig.posProfile,
          currency: ApiConfig.currency || 'EUR',
        },
        debugMode: this._debugMode,
      });

      // Configurer les listeners de la queue
      offlineQueue.addListener((event) => {
        this._handleOfflineQueueEvent(event);
      });

      // Demarrer le moniteur reseau
      const serverUrl = ApiConfig.getFullConfig()?.serverUrl;
      if (serverUrl) {
        await networkMonitor.start(serverUrl, {
          pingIntervalMs: 30000,
          debugMode: this._debugMode,
        });

        // Configurer les listeners reseau
        networkMonitor.addListener((event) => {
          this._handleNetworkEvent(event);
        });
      }

      this._log('Systeme offline initialise');

    } catch (error) {
      this._log('Erreur initialisation systeme offline', error);
    }
  }

  /**
   * NOUVEAU: Gere les evenements de la queue offline
   * @param {Object} event - Evenement
   */
  _handleOfflineQueueEvent(event) {
    this._log('Evenement queue offline:', event.event);

    switch (event.event) {
      case 'processing_started':
        this._log('Traitement de la queue demarre');
        break;

      case 'processing_completed':
        this._log('Traitement de la queue termine');
        break;

      case 'item_processed':
        this._log(`Item traite avec succes: ${event.item?.type}`);
        break;

      case 'item_failed':
        this._log(`Item echoue: ${event.item?._id}`, event.error);
        if (this._onSyncError) {
          this._onSyncError(new Error(event.error));
        }
        break;
    }
  }

  /**
   * NOUVEAU: Gere les evenements reseau
   * @param {Object} event - Evenement
   */
  _handleNetworkEvent(event) {
    this._log('Evenement reseau:', event.type);

    switch (event.type) {
      case NETWORK_EVENTS.CONNECTED:
        this._log('Connexion retablie, traitement de la queue...');
        // La queue se traite automatiquement via OfflineQueue
        break;

      case NETWORK_EVENTS.DISCONNECTED:
        this._log('Connexion perdue');
        this._lastSyncStatus = SYNC_STATUS.OFFLINE;
        break;

      case NETWORK_EVENTS.SERVER_UNREACHABLE:
        this._log('Serveur ERPNext non accessible');
        break;
    }
  }

  // ==========================================================================
  // B) METHODES DE SYNCHRONISATION
  // ==========================================================================

  /**
   * Effectue une synchronisation complete
   * @returns {Promise<Object>} Resultat de la synchronisation
   */
  async syncAll() {
    this._log('Demarrage synchronisation complete');

    if (this._isSyncing) {
      this._log('Synchronisation deja en cours');
      return { success: false, message: 'Synchronisation deja en cours' };
    }

    // Verifier la connexion
    const isOnline = await this.checkNetworkStatus();
    if (!isOnline) {
      this._lastSyncStatus = SYNC_STATUS.OFFLINE;
      return { success: false, message: 'Pas de connexion internet' };
    }

    this._isSyncing = true;
    this._lastSyncStatus = SYNC_STATUS.SYNCING;
    this._syncErrors = [];

    // Notifier le debut
    if (this._onSyncStart) {
      this._onSyncStart();
    }

    const results = {
      items: { success: false, count: 0 },
      categories: { success: false, count: 0 },
      customers: { success: false, count: 0 },
      receipts: { success: false, count: 0 },
    };

    try {
      // 1. Synchroniser les categories
      this._updateProgress('Synchronisation des categories...', 10);
      results.categories = await this.syncCategories();

      // 2. Synchroniser les items
      this._updateProgress('Synchronisation des produits...', 30);
      results.items = await this.syncItems();

      // 3. Synchroniser les clients
      this._updateProgress('Synchronisation des clients...', 60);
      results.customers = await this.syncCustomers();

      // 4. Envoyer les ventes locales
      this._updateProgress('Envoi des ventes...', 80);
      results.receipts = await this.syncReceipts();

      // 5. Traiter la queue offline
      this._updateProgress('Traitement de la queue offline...', 95);
      await this.processOfflineQueue();

      // Mettre a jour les statistiques
      this._stats.itemsSynced += results.items.count;
      this._stats.customersSynced += results.customers.count;
      this._stats.receiptsSynced += results.receipts.count;
      this._stats.lastFullSync = new Date();

      this._lastSyncTime = new Date();
      this._lastSyncStatus = SYNC_STATUS.SUCCESS;

      this._updateProgress('Synchronisation terminee', 100);
      this._log('Synchronisation complete terminee', results);

      // Notifier la fin
      if (this._onSyncComplete) {
        this._onSyncComplete(results);
      }

      return {
        success: true,
        message: 'Synchronisation reussie',
        results,
        timestamp: this._lastSyncTime,
      };

    } catch (error) {
      this._lastSyncStatus = SYNC_STATUS.ERROR;
      this._syncErrors.push({
        type: 'full_sync',
        error: error.message,
        timestamp: new Date(),
      });
      this._stats.errorCount++;

      this._log('Erreur synchronisation complete', error);

      if (this._onSyncError) {
        this._onSyncError(error);
      }

      return {
        success: false,
        message: error.message,
        results,
        errors: this._syncErrors,
      };

    } finally {
      this._isSyncing = false;
    }
  }

  /**
   * Synchronise les produits depuis ERPNext vers la base locale
   * @returns {Promise<Object>} Resultat {success, count, errors}
   */
  async syncItems() {
    this._log('Synchronisation des items');

    let syncedCount = 0;
    const errors = [];

    try {
      // Recuperer les items depuis ERPNext
      const erpnextItems = await FrappeAPI.getItems({}, null, 500);

      this._log(`${erpnextItems.length} items recuperes depuis ERPNext`);

      // Pour chaque item ERPNext
      for (const erpItem of erpnextItems) {
        try {
          // Transformer en format TailPOS
          const tailposItem = this._mapErpnextItemToTailpos(erpItem);

          // Verifier si l'item existe deja localement
          const existingItem = await this._findLocalItem(tailposItem._id);

          if (existingItem) {
            // Mettre a jour si modifie
            if (this._isItemModified(existingItem, tailposItem)) {
              await this._updateLocalItem(tailposItem);
              syncedCount++;
            }
          } else {
            // Ajouter le nouvel item
            await this._addLocalItem(tailposItem);
            syncedCount++;
          }

        } catch (itemError) {
          errors.push({
            item: erpItem.name,
            error: itemError.message,
          });
        }
      }

      this._log(`${syncedCount} items synchronises`);

      return {
        success: true,
        count: syncedCount,
        total: erpnextItems.length,
        errors: errors,
      };

    } catch (error) {
      this._log('Erreur synchronisation items', error);
      return {
        success: false,
        count: syncedCount,
        errors: [error.message],
      };
    }
  }

  /**
   * Synchronise les categories depuis ERPNext
   * @returns {Promise<Object>} Resultat
   */
  async syncCategories() {
    this._log('Synchronisation des categories');

    let syncedCount = 0;

    try {
      // Recuperer les groupes d'articles depuis ERPNext
      const itemGroups = await FrappeAPI.getItemGroups(100);

      for (const group of itemGroups) {
        try {
          const category = {
            _id: group.name,
            name: group.name,
            parent: group.parent_item_group || '',
            colorAndShape: JSON.stringify([{ color: 'gray', shape: 'square' }]),
            dateUpdated: Date.now(),
            syncStatus: true,
          };

          // Verifier si existe
          const existing = await this._findLocalCategory(category._id);
          if (existing) {
            await this._updateLocalCategory(category);
          } else {
            await this._addLocalCategory(category);
          }
          syncedCount++;

        } catch (e) {
          this._log('Erreur sync categorie', e);
        }
      }

      return { success: true, count: syncedCount };

    } catch (error) {
      this._log('Erreur synchronisation categories', error);
      return { success: false, count: syncedCount };
    }
  }

  /**
   * Synchronise les clients depuis ERPNext vers la base locale
   * @returns {Promise<Object>} Resultat
   */
  async syncCustomers() {
    this._log('Synchronisation des clients');

    let syncedCount = 0;
    const errors = [];

    try {
      // Recuperer les clients depuis ERPNext
      const erpnextCustomers = await FrappeAPI.getCustomers({}, 500);

      this._log(`${erpnextCustomers.length} clients recuperes depuis ERPNext`);

      for (const erpCustomer of erpnextCustomers) {
        try {
          // Transformer en format TailPOS
          const tailposCustomer = this._mapErpnextCustomerToTailpos(erpCustomer);

          // Verifier si le client existe deja
          const existingCustomer = await this._findLocalCustomer(tailposCustomer._id);

          if (existingCustomer) {
            await this._updateLocalCustomer(tailposCustomer);
          } else {
            await this._addLocalCustomer(tailposCustomer);
          }
          syncedCount++;

        } catch (customerError) {
          errors.push({
            customer: erpCustomer.name,
            error: customerError.message,
          });
        }
      }

      this._log(`${syncedCount} clients synchronises`);

      return {
        success: true,
        count: syncedCount,
        total: erpnextCustomers.length,
        errors: errors,
      };

    } catch (error) {
      this._log('Erreur synchronisation clients', error);
      return {
        success: false,
        count: syncedCount,
        errors: [error.message],
      };
    }
  }

  /**
   * Envoie les ventes locales (receipts) vers ERPNext
   * @returns {Promise<Object>} Resultat
   */
  async syncReceipts() {
    this._log('Synchronisation des ventes vers ERPNext');

    let syncedCount = 0;
    const errors = [];

    try {
      // Recuperer les ventes non synchronisees
      const unsyncedReceipts = await this._getUnsyncedReceipts();

      this._log(`${unsyncedReceipts.length} ventes a synchroniser`);

      for (const receipt of unsyncedReceipts) {
        try {
          await this.syncSingleReceipt(receipt);
          syncedCount++;
        } catch (receiptError) {
          errors.push({
            receipt: receipt._id,
            error: receiptError.message,
          });
          // Ajouter a la queue offline pour reessayer plus tard
          await this.addToOfflineQueue(receipt, QUEUE_OPERATION_TYPES.CREATE_INVOICE);
        }
      }

      this._log(`${syncedCount} ventes synchronisees`);

      return {
        success: true,
        count: syncedCount,
        total: unsyncedReceipts.length,
        errors: errors,
      };

    } catch (error) {
      this._log('Erreur synchronisation ventes', error);
      return {
        success: false,
        count: syncedCount,
        errors: [error.message],
      };
    }
  }

  /**
   * Synchronise une seule vente vers ERPNext
   * @param {Object} receipt - Vente a synchroniser
   * @returns {Promise<Object>} Facture creee
   */
  async syncSingleReceipt(receipt) {
    this._log('Synchronisation vente', { id: receipt._id });

    // Transformer le receipt en POS Invoice
    const invoiceData = this._mapReceiptToPOSInvoice(receipt);

    // Creer la facture dans ERPNext
    const createdInvoice = await FrappeAPI.createPOSInvoice(invoiceData);

    // Marquer comme synchronise localement
    await this._markReceiptAsSynced(receipt._id, createdInvoice.name);

    this._log('Vente synchronisee', { local: receipt._id, erpnext: createdInvoice.name });

    return createdInvoice;
  }

  // ==========================================================================
  // C) GESTION DE LA QUEUE OFFLINE
  // ==========================================================================

  /**
   * Ajoute une operation a la queue offline
   * @param {Object} item - Donnees de l'operation
   * @param {string} type - Type d'operation
   * @returns {Promise<boolean>} Succes
   */
  async addToOfflineQueue(item, type) {
    this._log('Ajout a la queue offline', { type });

    // Verifier la taille de la queue
    if (this._offlineQueue.length >= MAX_OFFLINE_QUEUE_SIZE) {
      this._log('Queue offline pleine, suppression des anciennes entrees');
      this._offlineQueue.shift(); // Supprimer la plus ancienne
    }

    const queueItem = {
      _id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type,
      data: item,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      lastRetry: null,
      status: 'pending',
    };

    this._offlineQueue.push(queueItem);

    // Sauvegarder dans la base locale
    try {
      await this._offlineQueueDb.upsert(queueItem._id, () => queueItem);
    } catch (error) {
      this._log('Erreur sauvegarde queue', error);
    }

    return true;
  }

  /**
   * Traite la queue offline quand la connexion revient
   * @returns {Promise<Object>} Resultat du traitement
   */
  async processOfflineQueue() {
    if (this._isProcessingQueue) {
      this._log('Traitement de la queue deja en cours');
      return { processed: 0, errors: 0 };
    }

    const isOnline = await this.checkNetworkStatus();
    if (!isOnline) {
      this._log('Pas de connexion, queue non traitee');
      return { processed: 0, errors: 0, reason: 'offline' };
    }

    this._isProcessingQueue = true;
    let processed = 0;
    let errors = 0;

    this._log(`Traitement de ${this._offlineQueue.length} elements en queue`);

    const itemsToProcess = [...this._offlineQueue];

    for (const queueItem of itemsToProcess) {
      if (queueItem.retryCount >= MAX_SYNC_RETRIES) {
        this._log('Element en queue abandonne apres trop de tentatives', queueItem._id);
        await this._removeFromOfflineQueue(queueItem._id);
        continue;
      }

      try {
        await this._processQueueItem(queueItem);
        await this._removeFromOfflineQueue(queueItem._id);
        processed++;

      } catch (error) {
        this._log('Erreur traitement queue item', error);
        queueItem.retryCount++;
        queueItem.lastRetry = new Date().toISOString();
        queueItem.lastError = error.message;
        errors++;

        // Attendre avant la prochaine tentative
        await this._delay(SYNC_RETRY_DELAY);
      }
    }

    this._isProcessingQueue = false;

    this._log(`Queue traitee: ${processed} reussis, ${errors} erreurs`);

    return { processed, errors };
  }

  /**
   * Traite un element de la queue
   * @param {Object} queueItem - Element a traiter
   */
  async _processQueueItem(queueItem) {
    switch (queueItem.type) {
      case QUEUE_OPERATION_TYPES.CREATE_INVOICE:
        await this.syncSingleReceipt(queueItem.data);
        break;

      case QUEUE_OPERATION_TYPES.CREATE_CUSTOMER:
        await FrappeAPI.createCustomer(queueItem.data);
        break;

      default:
        this._log('Type d\'operation inconnu', queueItem.type);
    }
  }

  /**
   * Retourne le statut de la queue offline
   * @returns {Object} Statut de la queue
   */
  getOfflineQueueStatus() {
    return {
      count: this._offlineQueue.length,
      items: this._offlineQueue.map(item => ({
        id: item._id,
        type: item.type,
        createdAt: item.createdAt,
        retryCount: item.retryCount,
        status: item.status,
      })),
      isProcessing: this._isProcessingQueue,
    };
  }

  // ==========================================================================
  // D) UTILITAIRES
  // ==========================================================================

  /**
   * Verifie la connexion internet
   * @returns {Promise<boolean>} True si connecte
   */
  async checkNetworkStatus() {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected;
    } catch (error) {
      return false;
    }
  }

  /**
   * Retourne l'etat de la synchronisation
   * @returns {Object} Etat
   */
  getSyncStatus() {
    return {
      isSyncing: this._isSyncing,
      lastSyncTime: this._lastSyncTime,
      lastSyncStatus: this._lastSyncStatus,
      errors: this._syncErrors,
      stats: this._stats,
      offlineQueueCount: this._offlineQueue.length,
    };
  }

  /**
   * Reinitialise la synchronisation
   */
  async resetSync() {
    this._log('Reinitialisation de la synchronisation');

    this._isSyncing = false;
    this._lastSyncTime = null;
    this._lastSyncStatus = SYNC_STATUS.IDLE;
    this._syncErrors = [];
    this._offlineQueue = [];
    this._stats = {
      itemsSynced: 0,
      customersSynced: 0,
      receiptsSynced: 0,
      errorCount: 0,
      lastFullSync: null,
    };

    // Vider la queue offline dans la base
    try {
      const allDocs = await this._offlineQueueDb.allDocs({ include_docs: true });
      for (const row of allDocs.rows) {
        if (row.doc) {
          await this._offlineQueueDb.remove(row.doc);
        }
      }
    } catch (error) {
      this._log('Erreur reinitialisation queue', error);
    }
  }

  // ==========================================================================
  // METHODES PRIVEES - MAPPING DES DONNEES
  // ==========================================================================

  /**
   * Transforme un item ERPNext en format TailPOS
   */
  _mapErpnextItemToTailpos(erpItem) {
    return {
      _id: erpItem.item_code || erpItem.name,
      name: erpItem.item_name || erpItem.name,
      description: erpItem.description || '',
      soldBy: erpItem.stock_uom === 'Nos' ? 'Each' : (erpItem.stock_uom || 'Each'),
      price: parseFloat(erpItem.standard_rate) || 0,
      sku: erpItem.item_code || '',
      barcode: erpItem.barcode || '',
      category: erpItem.item_group || 'No Category',
      colorAndShape: JSON.stringify([{ color: 'gray', shape: 'square' }]),
      colorOrImage: erpItem.image ? 'Image' : 'Color',
      imagePath: erpItem.image || '',
      favorite: '',
      taxes: '[]',
      tax: 0,
      dateUpdated: Date.now(),
      syncStatus: true,
    };
  }

  /**
   * Transforme un client ERPNext en format TailPOS
   */
  _mapErpnextCustomerToTailpos(erpCustomer) {
    return {
      _id: erpCustomer.name,
      name: erpCustomer.customer_name || erpCustomer.name,
      email: erpCustomer.email_id || '',
      phoneNumber: erpCustomer.mobile_no || '',
      note: '',
      dateUpdated: Date.now(),
      syncStatus: true,
    };
  }

  /**
   * Transforme un receipt TailPOS en POS Invoice ERPNext
   */
  _mapReceiptToPOSInvoice(receipt) {
    // Parser les lignes du receipt
    let receiptLines = [];
    try {
      receiptLines = typeof receipt.lines === 'string'
        ? JSON.parse(receipt.lines)
        : (receipt.lines || []);
    } catch (e) {
      receiptLines = [];
    }

    return {
      customer: receipt.customer || 'Guest',
      posting_date: this._formatDate(receipt.date || new Date()),
      posting_time: this._formatTime(receipt.date || new Date()),
      warehouse: ApiConfig.warehouse,
      pos_profile: ApiConfig.posProfile,
      grand_total: parseFloat(receipt.netTotal) || 0,
      items: receiptLines.map(line => ({
        item_code: line.item_code || line.sku || line._id,
        qty: parseFloat(line.qty) || 1,
        rate: parseFloat(line.price) || 0,
      })),
      payments: [{
        mode_of_payment: 'Cash',
        amount: parseFloat(receipt.netTotal) || 0,
      }],
      discount_amount: parseFloat(receipt.discountValue) || 0,
    };
  }

  // ==========================================================================
  // METHODES PRIVEES - OPERATIONS BASE DE DONNEES
  // ==========================================================================

  async _findLocalItem(id) {
    try {
      return await this._itemsDb.get(id);
    } catch (e) {
      return null;
    }
  }

  async _addLocalItem(item) {
    await this._itemsDb.upsert(item._id, () => item);
  }

  async _updateLocalItem(item) {
    await this._itemsDb.upsert(item._id, (doc) => ({ ...doc, ...item }));
  }

  async _findLocalCategory(id) {
    try {
      return await this._categoriesDb.get(id);
    } catch (e) {
      return null;
    }
  }

  async _addLocalCategory(category) {
    await this._categoriesDb.upsert(category._id, () => category);
  }

  async _updateLocalCategory(category) {
    await this._categoriesDb.upsert(category._id, (doc) => ({ ...doc, ...category }));
  }

  async _findLocalCustomer(id) {
    try {
      return await this._customersDb.get(id);
    } catch (e) {
      return null;
    }
  }

  async _addLocalCustomer(customer) {
    await this._customersDb.upsert(customer._id, () => customer);
  }

  async _updateLocalCustomer(customer) {
    await this._customersDb.upsert(customer._id, (doc) => ({ ...doc, ...customer }));
  }

  async _getUnsyncedReceipts() {
    try {
      const result = await this._receiptsDb.allDocs({ include_docs: true });
      return result.rows
        .filter(row => row.doc && row.doc.syncStatus === false)
        .map(row => row.doc);
    } catch (e) {
      return [];
    }
  }

  async _markReceiptAsSynced(localId, erpnextId) {
    await this._receiptsDb.upsert(localId, (doc) => ({
      ...doc,
      syncStatus: true,
      erpnextInvoice: erpnextId,
      syncedAt: new Date().toISOString(),
    }));
  }

  async _loadOfflineQueue() {
    try {
      const result = await this._offlineQueueDb.allDocs({ include_docs: true });
      this._offlineQueue = result.rows
        .filter(row => row.doc && row.doc.type)
        .map(row => row.doc);
      this._log(`${this._offlineQueue.length} elements charges dans la queue offline`);
    } catch (e) {
      this._offlineQueue = [];
    }
  }

  async _removeFromOfflineQueue(id) {
    // Retirer de la memoire
    this._offlineQueue = this._offlineQueue.filter(item => item._id !== id);

    // Retirer de la base
    try {
      const doc = await this._offlineQueueDb.get(id);
      await this._offlineQueueDb.remove(doc);
    } catch (e) {
      // Ignorer si non trouve
    }
  }

  // ==========================================================================
  // METHODES PRIVEES - UTILITAIRES
  // ==========================================================================

  _isItemModified(existing, newItem) {
    return existing.name !== newItem.name ||
           existing.price !== newItem.price ||
           existing.barcode !== newItem.barcode ||
           existing.category !== newItem.category;
  }

  _formatDate(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  _formatTime(date) {
    const d = new Date(date);
    return d.toTimeString().split(' ')[0];
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _updateProgress(message, percentage) {
    this._log(`Progression: ${percentage}% - ${message}`);
    if (this._onProgressUpdate) {
      this._onProgressUpdate(message, percentage);
    }
  }

  _log(message, data = null) {
    if (this._debugMode || ApiConfig.debugMode) {
      const timestamp = new Date().toISOString();
      if (data) {
        console.log(`[SyncService ${timestamp}] ${message}:`, data);
      } else {
        console.log(`[SyncService ${timestamp}] ${message}`);
      }
    }
  }

  // ==========================================================================
  // NOUVELLES METHODES PHASE 6: GESTION OFFLINE AMELIOREE
  // ==========================================================================

  /**
   * NOUVEAU: Enregistre une vente et l'ajoute a la queue si hors ligne
   * Cette methode est la methode recommandee pour enregistrer les ventes
   *
   * @param {Object} receipt - Vente a enregistrer
   * @returns {Promise<Object>} Resultat {success, queued, syncedImmediately}
   */
  async saveReceipt(receipt) {
    this._log('Enregistrement de la vente', { id: receipt._id || receipt.receiptNumber });

    try {
      // 1. Sauvegarder localement dans PouchDB
      const localReceipt = {
        ...receipt,
        _id: receipt._id || `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: new Date().toISOString(),
        syncStatus: false,
      };

      await this._receiptsDb.upsert(localReceipt._id, () => localReceipt);
      this._log('Vente sauvegardee localement', localReceipt._id);

      // 2. Ajouter a la queue offline
      const queueResult = await offlineQueue.addReceipt(localReceipt);
      this._log('Vente ajoutee a la queue offline');

      // 3. Verifier si on peut synchroniser immediatement
      const isOnline = networkMonitor.isServerAvailable();

      if (isOnline) {
        this._log('En ligne, tentative de synchronisation immediate...');

        // La queue va traiter automatiquement
        // On peut aussi forcer le traitement
        setTimeout(async () => {
          try {
            await offlineQueue.processQueue();
          } catch (e) {
            this._log('Erreur traitement queue apres save', e);
          }
        }, 500);

        return {
          success: true,
          receiptId: localReceipt._id,
          queued: false,
          syncedImmediately: true,
          message: 'Vente enregistree et en cours de synchronisation',
        };
      } else {
        this._log('Hors ligne, vente en queue pour synchronisation ulterieure');

        return {
          success: true,
          receiptId: localReceipt._id,
          queued: true,
          syncedImmediately: false,
          message: 'Vente enregistree, sera synchronisee quand la connexion reviendra',
        };
      }

    } catch (error) {
      this._log('Erreur enregistrement vente', error);

      // Meme en cas d'erreur, essayer de sauvegarder dans la queue
      try {
        await offlineQueue.addReceipt(receipt);
      } catch (queueError) {
        this._log('Erreur ajout queue de secours', queueError);
      }

      return {
        success: false,
        error: error.message,
        queued: true,
        message: 'Erreur, vente ajoutee a la queue de secours',
      };
    }
  }

  /**
   * NOUVEAU: Enregistre un client et l'ajoute a la queue si hors ligne
   *
   * @param {Object} customer - Client a enregistrer
   * @returns {Promise<Object>} Resultat
   */
  async saveCustomer(customer) {
    this._log('Enregistrement du client', { name: customer.name });

    try {
      // Sauvegarder localement
      const localCustomer = {
        ...customer,
        _id: customer._id || `customer_${Date.now()}`,
        savedAt: new Date().toISOString(),
        syncStatus: false,
      };

      await this._customersDb.upsert(localCustomer._id, () => localCustomer);

      // Ajouter a la queue offline
      await offlineQueue.addCustomer(localCustomer);

      const isOnline = networkMonitor.isServerAvailable();

      if (isOnline) {
        setTimeout(() => offlineQueue.processQueue(), 500);
      }

      return {
        success: true,
        customerId: localCustomer._id,
        queued: !isOnline,
      };

    } catch (error) {
      this._log('Erreur enregistrement client', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * NOUVEAU: Force le traitement de la queue offline
   *
   * @returns {Promise<Object>} Resultat du traitement
   */
  async forceProcessQueue() {
    this._log('Traitement force de la queue');
    return await offlineQueue.processQueue();
  }

  /**
   * NOUVEAU: Retourne le statut complet de la queue offline
   *
   * @returns {Promise<Object>} Statut de la queue
   */
  async getOfflineQueueStats() {
    return await offlineQueue.getQueueStats();
  }

  /**
   * NOUVEAU: Retourne le statut du reseau
   *
   * @returns {Object} Statut reseau
   */
  getNetworkStatus() {
    return networkMonitor.getStatus();
  }

  /**
   * NOUVEAU: Verifie si le serveur est accessible
   *
   * @returns {boolean} True si accessible
   */
  isServerAvailable() {
    return networkMonitor.isServerAvailable();
  }

  /**
   * NOUVEAU: Verifie si on est en ligne
   *
   * @returns {boolean} True si en ligne
   */
  isOnline() {
    return networkMonitor.isNetworkAvailable();
  }

  /**
   * NOUVEAU: Retry un item de la queue echoue
   *
   * @param {string} itemId - ID de l'item
   * @returns {Promise<Object>} Resultat
   */
  async retryQueueItem(itemId) {
    return await offlineQueue.retryItem(itemId);
  }

  /**
   * NOUVEAU: Retry tous les items echoues
   *
   * @returns {Promise<Object>} Resultat
   */
  async retryAllFailedItems() {
    return await offlineQueue.retryAllFailed();
  }

  /**
   * NOUVEAU: Nettoie les anciens items de la queue
   *
   * @param {number} daysToKeep - Jours a conserver
   * @returns {Promise<number>} Nombre d'items supprimes
   */
  async cleanupQueue(daysToKeep = 7) {
    return await offlineQueue.cleanupOldItems(daysToKeep);
  }

  /**
   * NOUVEAU: Obtenir un resume complet du statut
   *
   * @returns {Promise<Object>} Resume
   */
  async getFullStatus() {
    const syncStatus = this.getSyncStatus();
    const queueStats = await this.getOfflineQueueStats();
    const networkStatus = this.getNetworkStatus();

    return {
      sync: syncStatus,
      queue: queueStats,
      network: networkStatus,
      isHealthy: networkStatus.network?.isServerReachable && queueStats.failed === 0,
    };
  }
}

// Exporter une instance unique (singleton)
const syncService = new SyncService();
export default syncService;

// Exporter aussi la classe pour les tests
export { SyncService };

// Exporter les references aux modules offline pour un acces direct si necessaire
export { offlineQueue, networkMonitor };
