/**
 * OfflineQueue.js
 *
 * Module de gestion de la queue offline pour TailPOS.
 * Stocke les transactions localement et les synchronise automatiquement
 * quand la connexion revient.
 *
 * Caracteristiques:
 * - Persistance avec PouchDB
 * - Retry avec backoff exponentiel
 * - Priorite des transactions (ventes = haute priorite)
 * - Traitement par batch
 * - Surveillance reseau automatique
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

import PouchDB from "pouchdb-react-native";
import SQLite from "react-native-sqlite-2";
import SQLiteAdapterFactory from "pouchdb-adapter-react-native-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NetInfo } from "react-native";

// Import des utilitaires du DataMapper
import { generateUUID, formatDateTime } from "./DataMapper";
import { mapTailposReceiptToErpInvoice, mapTailposCustomerToErp } from "./DataMapper";

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Cle de stockage pour les metadonnees de la queue
 */
export const QUEUE_STORAGE_KEY = "@TailPOS:OfflineQueue";

/**
 * Nom de la base de donnees PouchDB
 */
export const QUEUE_DB_NAME = "tailpos_offline_queue";

/**
 * Nombre maximum de tentatives avant echec definitif
 */
export const MAX_RETRY_ATTEMPTS = 5;

/**
 * Delai de base pour le retry (ms) - augmente exponentiellement
 */
export const RETRY_DELAY_BASE = 1000;

/**
 * Nombre d'items a traiter par batch
 */
export const BATCH_SIZE = 10;

/**
 * Delai entre les batches (ms)
 */
export const BATCH_DELAY = 500;

/**
 * Types d'items dans la queue
 */
export const QUEUE_ITEM_TYPES = {
  RECEIPT: "receipt",
  CUSTOMER: "customer",
  ITEM_UPDATE: "item_update",
  STOCK_ADJUSTMENT: "stock_adjustment",
  PAYMENT: "payment"
};

/**
 * Statuts des items dans la queue
 */
export const QUEUE_ITEM_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  SUCCESS: "success",
  FAILED: "failed",
  RETRY: "retry",
  CANCELLED: "cancelled"
};

/**
 * Niveaux de priorite (plus bas = plus prioritaire)
 */
export const QUEUE_PRIORITY = {
  CRITICAL: 0, // Ventes avec paiement
  HIGH: 1,     // Ventes normales
  MEDIUM: 2,   // Clients
  LOW: 3,      // Mises a jour de stock
  BACKGROUND: 4 // Autres operations
};

// ============================================================================
// CLASSE OfflineQueue
// ============================================================================

/**
 * Gestionnaire de queue offline pour les operations TailPOS
 */
export class OfflineQueue {
  constructor() {
    /** @type {PouchDB|null} Base de donnees locale */
    this.db = null;

    /** @type {boolean} Indique si la queue est en cours de traitement */
    this.isProcessing = false;

    /** @type {boolean} Indique si la queue est initialisee */
    this.isInitialized = false;

    /** @type {Object} Statut reseau actuel */
    this.networkStatus = {
      isConnected: false,
      type: null,
      isInternetReachable: false
    };

    /** @type {Array<Function>} Listeners pour les evenements */
    this.listeners = [];

    /** @type {Object} Timeouts pour les retries programmes */
    this.retryTimeouts = {};

    /** @type {Function|null} Unsubscribe de NetInfo */
    this.networkUnsubscribe = null;

    /** @type {boolean} Mode debug */
    this.debugMode = false;

    /** @type {Object|null} Reference a FrappeAPI (injectee) */
    this.api = null;

    /** @type {Object} Configuration de mapping */
    this.mappingConfig = {};
  }

  // ==========================================================================
  // INITIALISATION
  // ==========================================================================

  /**
   * Initialiser la queue offline
   *
   * @param {Object} options - Options d'initialisation
   * @param {Object} options.api - Instance de FrappeAPI
   * @param {Object} options.mappingConfig - Configuration pour le mapping
   * @param {boolean} options.debugMode - Activer les logs de debug
   * @returns {Promise<Object>} Statut d'initialisation
   */
  async initialize(options = {}) {
    this.debugLog("Initialisation de OfflineQueue...");

    if (this.isInitialized) {
      this.debugLog("Queue deja initialisee");
      return { success: true, alreadyInitialized: true };
    }

    try {
      // Configurer les options
      this.api = options.api || null;
      this.mappingConfig = options.mappingConfig || {};
      this.debugMode = options.debugMode || false;

      // Creer/ouvrir la base de donnees PouchDB
      await this.initDatabase();

      // Configurer l'ecoute du reseau
      this.setupNetworkListener();

      // Verifier le statut reseau actuel
      await this.checkNetworkStatus();

      // Charger les metadonnees sauvegardees
      await this.loadMetadata();

      this.isInitialized = true;

      this.debugLog("Queue initialisee avec succes");

      // Notifier les listeners
      this.notifyListeners({
        event: "initialized",
        networkStatus: this.networkStatus
      });

      // Si connecte, tenter de traiter la queue existante
      if (this.networkStatus.isConnected) {
        this.debugLog("Connexion detectee, traitement de la queue...");
        // Lancer en arriere-plan
        setTimeout(() => this.processQueue(), 1000);
      }

      return {
        success: true,
        networkStatus: this.networkStatus,
        stats: await this.getQueueStats()
      };

    } catch (error) {
      console.error("[OfflineQueue] Erreur initialisation:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Initialiser la base de donnees PouchDB
   */
  async initDatabase() {
    try {
      // Configurer l'adaptateur SQLite
      const SQLiteAdapter = SQLiteAdapterFactory(SQLite);
      PouchDB.plugin(SQLiteAdapter);
      PouchDB.plugin(require("pouchdb-find"));

      // Ouvrir la base de donnees
      this.db = new PouchDB(QUEUE_DB_NAME + ".db", {
        adapter: "react-native-sqlite"
      });

      // Creer les index pour les requetes
      await this.db.createIndex({
        index: { fields: ["status", "priority", "createdAt"] }
      });

      await this.db.createIndex({
        index: { fields: ["type", "status"] }
      });

      this.debugLog("Base de donnees initialisee");

    } catch (error) {
      console.error("[OfflineQueue] Erreur init DB:", error);
      throw error;
    }
  }

  /**
   * Configurer l'ecouteur de changement de reseau
   */
  setupNetworkListener() {
    try {
      // Utiliser NetInfo pour detecter les changements
      this.networkUnsubscribe = NetInfo.addEventListener(state => {
        const wasConnected = this.networkStatus.isConnected;
        const isNowConnected = state.isConnected && state.isInternetReachable;

        this.networkStatus = {
          isConnected: isNowConnected,
          type: state.type,
          isInternetReachable: state.isInternetReachable
        };

        this.debugLog(`Changement reseau: ${state.type}, connecte: ${isNowConnected}`);

        // Notifier les listeners
        this.notifyListeners({
          event: "network_change",
          networkStatus: this.networkStatus,
          wasConnected,
          isNowConnected
        });

        // Si la connexion vient de revenir, traiter la queue
        if (!wasConnected && isNowConnected) {
          this.debugLog("Connexion retablie, lancement du traitement...");
          this.notifyListeners({ event: "connection_restored" });
          setTimeout(() => this.processQueue(), 500);
        }

        // Si la connexion est perdue, arreter le traitement
        if (wasConnected && !isNowConnected) {
          this.debugLog("Connexion perdue");
          this.notifyListeners({ event: "connection_lost" });
        }
      });

      this.debugLog("Listener reseau configure");

    } catch (error) {
      console.error("[OfflineQueue] Erreur setup network listener:", error);
    }
  }

  /**
   * Verifier le statut reseau actuel
   *
   * @returns {Promise<Object>} Statut reseau
   */
  async checkNetworkStatus() {
    try {
      const state = await NetInfo.fetch();

      this.networkStatus = {
        isConnected: state.isConnected && state.isInternetReachable,
        type: state.type,
        isInternetReachable: state.isInternetReachable
      };

      this.debugLog(`Statut reseau: ${state.type}, connecte: ${this.networkStatus.isConnected}`);

      return this.networkStatus;

    } catch (error) {
      console.error("[OfflineQueue] Erreur check network:", error);
      return {
        isConnected: false,
        type: "unknown",
        isInternetReachable: false
      };
    }
  }

  /**
   * Charger les metadonnees sauvegardees
   */
  async loadMetadata() {
    try {
      const data = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (data) {
        const metadata = JSON.parse(data);
        this.debugLog("Metadonnees chargees:", metadata);
      }
    } catch (error) {
      this.debugLog("Pas de metadonnees existantes");
    }
  }

  /**
   * Sauvegarder les metadonnees
   */
  async saveMetadata() {
    try {
      const stats = await this.getQueueStats();
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({
        lastUpdated: new Date().toISOString(),
        stats
      }));
    } catch (error) {
      console.error("[OfflineQueue] Erreur sauvegarde metadata:", error);
    }
  }

  /**
   * Injecter l'API Frappe
   *
   * @param {Object} api - Instance de FrappeAPI
   */
  setApi(api) {
    this.api = api;
    this.debugLog("API injectee");
  }

  /**
   * Configurer les options de mapping
   *
   * @param {Object} config - Configuration de mapping
   */
  setMappingConfig(config) {
    this.mappingConfig = { ...this.mappingConfig, ...config };
    this.debugLog("Config mapping mise a jour");
  }

  // ==========================================================================
  // GESTION DE LA QUEUE
  // ==========================================================================

  /**
   * Ajouter un item a la queue offline
   *
   * @param {string} type - Type d'item (QUEUE_ITEM_TYPES)
   * @param {Object} data - Donnees a synchroniser
   * @param {number} priority - Priorite (QUEUE_PRIORITY)
   * @returns {Promise<Object>} Item cree
   */
  async addToQueue(type, data, priority = QUEUE_PRIORITY.MEDIUM) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const now = new Date().toISOString();

    const queueItem = {
      _id: `queue_${generateUUID()}`,
      type: type,
      data: data,
      priority: priority,
      status: QUEUE_ITEM_STATUS.PENDING,
      retryCount: 0,
      maxRetries: MAX_RETRY_ATTEMPTS,
      createdAt: now,
      updatedAt: now,
      nextRetryAt: null,
      error: null,
      result: null,
      metadata: {
        deviceId: data.deviceId || null,
        userId: data.userId || null
      }
    };

    try {
      // Sauvegarder dans PouchDB
      const result = await this.db.put(queueItem);
      queueItem._rev = result.rev;

      this.debugLog(`Item ajoute a la queue: ${type}`, queueItem._id);

      // Notifier les listeners
      this.notifyListeners({
        event: "item_added",
        item: queueItem
      });

      // Sauvegarder les metadonnees
      await this.saveMetadata();

      // Si connecte, tenter de traiter immediatement
      if (this.networkStatus.isConnected && !this.isProcessing) {
        this.debugLog("Connecte, traitement immediat...");
        setTimeout(() => this.processQueue(), 100);
      }

      return {
        success: true,
        item: queueItem,
        queued: !this.networkStatus.isConnected
      };

    } catch (error) {
      console.error("[OfflineQueue] Erreur ajout queue:", error);
      throw error;
    }
  }

  /**
   * Ajouter une vente (receipt) a la queue
   * Priorite haute car critique
   *
   * @param {Object} receipt - Receipt TailPOS
   * @returns {Promise<Object>} Resultat
   */
  async addReceipt(receipt) {
    this.debugLog("Ajout receipt a la queue:", receipt._id || receipt.receiptNumber);

    // Determiner la priorite selon le montant
    let priority = QUEUE_PRIORITY.HIGH;
    if (receipt.total > 1000) {
      priority = QUEUE_PRIORITY.CRITICAL;
    }

    return await this.addToQueue(
      QUEUE_ITEM_TYPES.RECEIPT,
      receipt,
      priority
    );
  }

  /**
   * Ajouter un client a la queue
   *
   * @param {Object} customer - Customer TailPOS
   * @returns {Promise<Object>} Resultat
   */
  async addCustomer(customer) {
    this.debugLog("Ajout customer a la queue:", customer.name);

    return await this.addToQueue(
      QUEUE_ITEM_TYPES.CUSTOMER,
      customer,
      QUEUE_PRIORITY.MEDIUM
    );
  }

  /**
   * Ajouter une mise a jour de produit a la queue
   *
   * @param {Object} item - Item a mettre a jour
   * @returns {Promise<Object>} Resultat
   */
  async addItemUpdate(item) {
    this.debugLog("Ajout item update a la queue:", item.sku);

    return await this.addToQueue(
      QUEUE_ITEM_TYPES.ITEM_UPDATE,
      item,
      QUEUE_PRIORITY.LOW
    );
  }

  /**
   * Ajouter un ajustement de stock a la queue
   *
   * @param {Object} adjustment - Donnees d'ajustement
   * @returns {Promise<Object>} Resultat
   */
  async addStockAdjustment(adjustment) {
    this.debugLog("Ajout stock adjustment a la queue");

    return await this.addToQueue(
      QUEUE_ITEM_TYPES.STOCK_ADJUSTMENT,
      adjustment,
      QUEUE_PRIORITY.LOW
    );
  }

  /**
   * Recuperer tous les items de la queue
   *
   * @param {string|null} status - Filtrer par statut (optionnel)
   * @returns {Promise<Array>} Liste des items
   */
  async getQueueItems(status = null) {
    if (!this.db) {
      return [];
    }

    try {
      let selector = {};

      if (status) {
        selector.status = status;
      }

      const result = await this.db.find({
        selector: selector,
        sort: [{ priority: "asc" }, { createdAt: "asc" }]
      });

      return result.docs;

    } catch (error) {
      // Fallback: utiliser allDocs
      try {
        const result = await this.db.allDocs({ include_docs: true });
        let items = result.rows
          .map(row => row.doc)
          .filter(doc => doc._id.startsWith("queue_"));

        if (status) {
          items = items.filter(item => item.status === status);
        }

        // Trier par priorite puis par date
        items.sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }
          return new Date(a.createdAt) - new Date(b.createdAt);
        });

        return items;

      } catch (fallbackError) {
        console.error("[OfflineQueue] Erreur getQueueItems:", fallbackError);
        return [];
      }
    }
  }

  /**
   * Recuperer un item specifique
   *
   * @param {string} itemId - ID de l'item
   * @returns {Promise<Object|null>} Item ou null
   */
  async getQueueItem(itemId) {
    if (!this.db) return null;

    try {
      return await this.db.get(itemId);
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Mettre a jour le statut d'un item
   *
   * @param {string} itemId - ID de l'item
   * @param {string} status - Nouveau statut
   * @param {string|null} error - Message d'erreur (optionnel)
   * @param {Object|null} result - Resultat du traitement (optionnel)
   * @returns {Promise<Object>} Item mis a jour
   */
  async updateItemStatus(itemId, status, error = null, result = null) {
    try {
      const item = await this.db.get(itemId);

      item.status = status;
      item.updatedAt = new Date().toISOString();

      if (error !== null) {
        item.error = error;
      }

      if (result !== null) {
        item.result = result;
      }

      const updateResult = await this.db.put(item);
      item._rev = updateResult.rev;

      this.debugLog(`Item ${itemId} mis a jour: ${status}`);

      // Notifier les listeners
      this.notifyListeners({
        event: "item_updated",
        item,
        newStatus: status
      });

      return item;

    } catch (error) {
      console.error("[OfflineQueue] Erreur update status:", error);
      throw error;
    }
  }

  /**
   * Supprimer un item de la queue
   *
   * @param {string} itemId - ID de l'item
   * @returns {Promise<boolean>} Succes
   */
  async removeFromQueue(itemId) {
    try {
      const item = await this.db.get(itemId);
      await this.db.remove(item);

      this.debugLog(`Item ${itemId} supprime de la queue`);

      // Notifier les listeners
      this.notifyListeners({
        event: "item_removed",
        itemId
      });

      return true;

    } catch (error) {
      if (error.status === 404) {
        return true; // Deja supprime
      }
      console.error("[OfflineQueue] Erreur suppression:", error);
      return false;
    }
  }

  /**
   * Vider toute la queue
   *
   * @returns {Promise<number>} Nombre d'items supprimes
   */
  async clearQueue() {
    try {
      const items = await this.getQueueItems();
      let count = 0;

      for (const item of items) {
        await this.db.remove(item);
        count++;
      }

      this.debugLog(`Queue videe: ${count} items supprimes`);

      // Notifier les listeners
      this.notifyListeners({
        event: "queue_cleared",
        count
      });

      await this.saveMetadata();

      return count;

    } catch (error) {
      console.error("[OfflineQueue] Erreur clear queue:", error);
      throw error;
    }
  }

  // ==========================================================================
  // TRAITEMENT DE LA QUEUE
  // ==========================================================================

  /**
   * Traiter la queue offline
   * Appele quand la connexion revient
   *
   * @returns {Promise<Object>} Resultat du traitement
   */
  async processQueue() {
    // Verifier si deja en traitement
    if (this.isProcessing) {
      this.debugLog("Queue deja en cours de traitement");
      return { success: false, reason: "already_processing" };
    }

    // Verifier la connexion
    const networkStatus = await this.checkNetworkStatus();
    if (!networkStatus.isConnected) {
      this.debugLog("Pas de connexion, traitement reporte");
      return { success: false, reason: "no_connection" };
    }

    // Verifier que l'API est configuree
    if (!this.api) {
      this.debugLog("API non configuree");
      return { success: false, reason: "no_api" };
    }

    this.isProcessing = true;
    this.notifyListeners({ event: "processing_started" });

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: []
    };

    try {
      // Recuperer les items pending et retry
      const allItems = await this.getQueueItems();
      const pendingItems = allItems.filter(
        item => item.status === QUEUE_ITEM_STATUS.PENDING ||
                item.status === QUEUE_ITEM_STATUS.RETRY
      );

      this.debugLog(`${pendingItems.length} items a traiter`);

      if (pendingItems.length === 0) {
        this.isProcessing = false;
        this.notifyListeners({ event: "processing_completed", results });
        return { success: true, results };
      }

      // Trier par priorite
      pendingItems.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

      // Traiter par batch
      for (let i = 0; i < pendingItems.length; i += BATCH_SIZE) {
        const batch = pendingItems.slice(i, i + BATCH_SIZE);

        this.notifyListeners({
          event: "batch_started",
          batchIndex: Math.floor(i / BATCH_SIZE),
          batchSize: batch.length,
          totalItems: pendingItems.length
        });

        const batchResults = await this.processBatch(batch);

        results.processed += batchResults.length;
        results.success += batchResults.filter(r => r.success).length;
        results.failed += batchResults.filter(r => !r.success).length;
        results.errors.push(...batchResults.filter(r => r.error).map(r => r.error));

        // Verifier la connexion entre chaque batch
        const stillConnected = await this.checkNetworkStatus();
        if (!stillConnected.isConnected) {
          this.debugLog("Connexion perdue, arret du traitement");
          break;
        }

        // Pause entre les batches
        if (i + BATCH_SIZE < pendingItems.length) {
          await this.sleep(BATCH_DELAY);
        }
      }

      this.debugLog(`Traitement termine: ${results.success}/${results.processed} reussis`);

      this.notifyListeners({
        event: "processing_completed",
        results
      });

      await this.saveMetadata();

      return { success: true, results };

    } catch (error) {
      console.error("[OfflineQueue] Erreur traitement queue:", error);

      this.notifyListeners({
        event: "processing_error",
        error: error.message
      });

      return { success: false, error: error.message, results };

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Traiter un batch d'items
   *
   * @param {Array} items - Items a traiter
   * @returns {Promise<Array>} Resultats
   */
  async processBatch(items) {
    const results = [];

    for (const item of items) {
      try {
        // Marquer comme en traitement
        await this.updateItemStatus(item._id, QUEUE_ITEM_STATUS.PROCESSING);

        // Traiter l'item
        const result = await this.processItem(item);

        // Marquer comme reussi et supprimer
        await this.updateItemStatus(
          item._id,
          QUEUE_ITEM_STATUS.SUCCESS,
          null,
          result
        );

        // Supprimer apres succes
        await this.removeFromQueue(item._id);

        results.push({
          item,
          result,
          success: true
        });

        this.notifyListeners({
          event: "item_processed",
          item,
          result,
          success: true
        });

      } catch (error) {
        console.error(`[OfflineQueue] Erreur traitement item ${item._id}:`, error);

        results.push({
          item,
          error: error.message,
          success: false
        });

        await this.handleItemError(item, error);
      }
    }

    return results;
  }

  /**
   * Traiter un item individuel selon son type
   *
   * @param {Object} item - Item a traiter
   * @returns {Promise<Object>} Resultat
   */
  async processItem(item) {
    this.debugLog(`Traitement item: ${item.type}`, item._id);

    switch (item.type) {
      case QUEUE_ITEM_TYPES.RECEIPT:
        return await this.processReceipt(item);

      case QUEUE_ITEM_TYPES.CUSTOMER:
        return await this.processCustomer(item);

      case QUEUE_ITEM_TYPES.ITEM_UPDATE:
        return await this.processItemUpdate(item);

      case QUEUE_ITEM_TYPES.STOCK_ADJUSTMENT:
        return await this.processStockAdjustment(item);

      default:
        throw new Error(`Type d'item inconnu: ${item.type}`);
    }
  }

  /**
   * Traiter une vente (receipt)
   *
   * @param {Object} queueItem - Item de la queue
   * @returns {Promise<Object>} Resultat
   */
  async processReceipt(queueItem) {
    const receipt = queueItem.data;

    this.debugLog("Traitement receipt:", receipt.receiptNumber || receipt._id);

    // Convertir en POS Invoice ERPNext
    const posInvoice = mapTailposReceiptToErpInvoice(receipt, this.mappingConfig);

    // Envoyer a ERPNext
    const result = await this.api.createPOSInvoice(posInvoice);

    this.debugLog("Receipt envoye avec succes:", result.name);

    return {
      erpInvoiceName: result.name,
      receiptId: receipt._id,
      receiptNumber: receipt.receiptNumber
    };
  }

  /**
   * Traiter un client
   *
   * @param {Object} queueItem - Item de la queue
   * @returns {Promise<Object>} Resultat
   */
  async processCustomer(queueItem) {
    const customer = queueItem.data;

    this.debugLog("Traitement customer:", customer.name);

    // Convertir au format ERPNext
    const erpCustomer = mapTailposCustomerToErp(customer);

    // Verifier si le client existe deja
    try {
      const existing = await this.api.getCustomer(customer.syncId || customer.name);
      if (existing) {
        // Mettre a jour
        const result = await this.api.updateCustomer(existing.name, erpCustomer);
        return { action: "updated", name: result.name };
      }
    } catch (e) {
      // Client n'existe pas, on va le creer
    }

    // Creer le client
    const result = await this.api.createCustomer(erpCustomer);

    this.debugLog("Customer cree avec succes:", result.name);

    return {
      action: "created",
      erpCustomerName: result.name,
      customerId: customer._id
    };
  }

  /**
   * Traiter une mise a jour de produit
   *
   * @param {Object} queueItem - Item de la queue
   * @returns {Promise<Object>} Resultat
   */
  async processItemUpdate(queueItem) {
    const item = queueItem.data;

    this.debugLog("Traitement item update:", item.sku);

    // Mettre a jour dans ERPNext
    const result = await this.api.updateItem(item.syncId || item.sku, {
      standard_rate: item.price,
      description: item.description
    });

    return {
      action: "updated",
      itemCode: result.item_code
    };
  }

  /**
   * Traiter un ajustement de stock
   *
   * @param {Object} queueItem - Item de la queue
   * @returns {Promise<Object>} Resultat
   */
  async processStockAdjustment(queueItem) {
    const adjustment = queueItem.data;

    this.debugLog("Traitement stock adjustment:", adjustment.item_code);

    // Creer une Stock Entry dans ERPNext
    const stockEntry = {
      doctype: "Stock Entry",
      stock_entry_type: adjustment.type || "Material Receipt",
      items: [{
        item_code: adjustment.item_code,
        qty: adjustment.qty,
        t_warehouse: adjustment.warehouse || this.mappingConfig.warehouse
      }]
    };

    const result = await this.api.request("POST", "/api/resource/Stock Entry", stockEntry);

    return {
      action: "adjusted",
      stockEntryName: result.name,
      itemCode: adjustment.item_code,
      qty: adjustment.qty
    };
  }

  // ==========================================================================
  // GESTION DES ERREURS ET RETRY
  // ==========================================================================

  /**
   * Gerer une erreur sur un item
   *
   * @param {Object} item - Item en erreur
   * @param {Error} error - Erreur survenue
   */
  async handleItemError(item, error) {
    const newRetryCount = (item.retryCount || 0) + 1;

    this.debugLog(`Erreur item ${item._id}: ${error.message} (tentative ${newRetryCount})`);

    if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
      // Trop de tentatives, marquer comme echoue
      await this.updateItemStatus(
        item._id,
        QUEUE_ITEM_STATUS.FAILED,
        error.message
      );

      this.notifyListeners({
        event: "item_failed",
        item,
        error: error.message,
        retryCount: newRetryCount
      });

    } else {
      // Programmer un retry avec delai exponentiel
      const delay = RETRY_DELAY_BASE * Math.pow(2, newRetryCount);
      const nextRetryAt = new Date(Date.now() + delay).toISOString();

      try {
        const currentItem = await this.db.get(item._id);

        await this.db.put({
          ...currentItem,
          status: QUEUE_ITEM_STATUS.RETRY,
          retryCount: newRetryCount,
          error: error.message,
          nextRetryAt: nextRetryAt,
          updatedAt: new Date().toISOString()
        });

        this.debugLog(`Retry programme dans ${delay}ms pour ${item._id}`);

        // Programmer le retry
        this.scheduleRetry(item._id, delay);

        this.notifyListeners({
          event: "item_retry_scheduled",
          item,
          retryCount: newRetryCount,
          nextRetryAt,
          delay
        });

      } catch (updateError) {
        console.error("[OfflineQueue] Erreur mise a jour retry:", updateError);
      }
    }
  }

  /**
   * Programmer un retry pour un item
   *
   * @param {string} itemId - ID de l'item
   * @param {number} delay - Delai en ms
   */
  scheduleRetry(itemId, delay) {
    // Annuler le retry existant si present
    if (this.retryTimeouts[itemId]) {
      clearTimeout(this.retryTimeouts[itemId]);
    }

    this.retryTimeouts[itemId] = setTimeout(async () => {
      try {
        const networkStatus = await this.checkNetworkStatus();

        if (networkStatus.isConnected) {
          const item = await this.getQueueItem(itemId);

          if (item && item.status === QUEUE_ITEM_STATUS.RETRY) {
            this.debugLog(`Retry automatique pour ${itemId}`);

            await this.updateItemStatus(item._id, QUEUE_ITEM_STATUS.PROCESSING);

            try {
              const result = await this.processItem(item);
              await this.updateItemStatus(item._id, QUEUE_ITEM_STATUS.SUCCESS, null, result);
              await this.removeFromQueue(item._id);

              this.notifyListeners({
                event: "item_retry_success",
                item,
                result
              });

            } catch (error) {
              await this.handleItemError(item, error);
            }
          }
        } else {
          // Pas de connexion, reprogrammer
          this.scheduleRetry(itemId, delay);
        }

      } catch (error) {
        console.error(`[OfflineQueue] Erreur retry ${itemId}:`, error);
      }

      delete this.retryTimeouts[itemId];

    }, delay);
  }

  /**
   * Retry manuel d'un item echoue
   *
   * @param {string} itemId - ID de l'item
   * @returns {Promise<Object>} Resultat
   */
  async retryItem(itemId) {
    const item = await this.getQueueItem(itemId);

    if (!item) {
      throw new Error("Item non trouve");
    }

    this.debugLog(`Retry manuel pour ${itemId}`);

    // Reinitialiser le compteur et le statut
    try {
      const currentItem = await this.db.get(itemId);

      await this.db.put({
        ...currentItem,
        status: QUEUE_ITEM_STATUS.PENDING,
        retryCount: 0,
        error: null,
        nextRetryAt: null,
        updatedAt: new Date().toISOString()
      });

      // Tenter de traiter immediatement si connecte
      const networkStatus = await this.checkNetworkStatus();
      if (networkStatus.isConnected && !this.isProcessing) {
        setTimeout(() => this.processQueue(), 100);
      }

      return { success: true, queued: true };

    } catch (error) {
      console.error("[OfflineQueue] Erreur retry manuel:", error);
      throw error;
    }
  }

  /**
   * Retry tous les items echoues
   *
   * @returns {Promise<Object>} Resultat
   */
  async retryAllFailed() {
    const items = await this.getQueueItems(QUEUE_ITEM_STATUS.FAILED);

    this.debugLog(`Retry de ${items.length} items echoues`);

    let retried = 0;

    for (const item of items) {
      try {
        await this.retryItem(item._id);
        retried++;
      } catch (error) {
        console.error(`[OfflineQueue] Erreur retry ${item._id}:`, error);
      }
    }

    return {
      success: true,
      total: items.length,
      retried
    };
  }

  // ==========================================================================
  // LISTENERS ET NOTIFICATIONS
  // ==========================================================================

  /**
   * Ajouter un listener pour les evenements de la queue
   *
   * @param {Function} callback - Fonction appelee lors des evenements
   * @returns {Function} Fonction pour retirer le listener
   */
  addListener(callback) {
    this.listeners.push(callback);

    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notifier tous les listeners
   *
   * @param {Object} event - Evenement a notifier
   */
  notifyListeners(event) {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error("[OfflineQueue] Erreur dans listener:", error);
      }
    });
  }

  // ==========================================================================
  // STATISTIQUES ET STATUT
  // ==========================================================================

  /**
   * Obtenir les statistiques de la queue
   *
   * @returns {Promise<Object>} Statistiques
   */
  async getQueueStats() {
    const items = await this.getQueueItems();

    const stats = {
      total: items.length,
      pending: 0,
      processing: 0,
      retry: 0,
      failed: 0,
      success: 0,
      byType: {
        receipts: 0,
        customers: 0,
        itemUpdates: 0,
        stockAdjustments: 0
      },
      byPriority: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      oldestPending: null,
      isProcessing: this.isProcessing,
      networkStatus: this.networkStatus
    };

    for (const item of items) {
      // Par statut
      switch (item.status) {
        case QUEUE_ITEM_STATUS.PENDING:
          stats.pending++;
          break;
        case QUEUE_ITEM_STATUS.PROCESSING:
          stats.processing++;
          break;
        case QUEUE_ITEM_STATUS.RETRY:
          stats.retry++;
          break;
        case QUEUE_ITEM_STATUS.FAILED:
          stats.failed++;
          break;
        case QUEUE_ITEM_STATUS.SUCCESS:
          stats.success++;
          break;
      }

      // Par type
      switch (item.type) {
        case QUEUE_ITEM_TYPES.RECEIPT:
          stats.byType.receipts++;
          break;
        case QUEUE_ITEM_TYPES.CUSTOMER:
          stats.byType.customers++;
          break;
        case QUEUE_ITEM_TYPES.ITEM_UPDATE:
          stats.byType.itemUpdates++;
          break;
        case QUEUE_ITEM_TYPES.STOCK_ADJUSTMENT:
          stats.byType.stockAdjustments++;
          break;
      }

      // Par priorite
      switch (item.priority) {
        case QUEUE_PRIORITY.CRITICAL:
          stats.byPriority.critical++;
          break;
        case QUEUE_PRIORITY.HIGH:
          stats.byPriority.high++;
          break;
        case QUEUE_PRIORITY.MEDIUM:
          stats.byPriority.medium++;
          break;
        case QUEUE_PRIORITY.LOW:
        case QUEUE_PRIORITY.BACKGROUND:
          stats.byPriority.low++;
          break;
      }

      // Plus ancien en attente
      if (item.status === QUEUE_ITEM_STATUS.PENDING ||
          item.status === QUEUE_ITEM_STATUS.RETRY) {
        if (!stats.oldestPending ||
            new Date(item.createdAt) < new Date(stats.oldestPending)) {
          stats.oldestPending = item.createdAt;
        }
      }
    }

    return stats;
  }

  /**
   * Obtenir le statut complet de la queue
   *
   * @returns {Promise<Object>} Statut
   */
  async getStatus() {
    const stats = await this.getQueueStats();
    const networkStatus = await this.checkNetworkStatus();

    return {
      ...stats,
      networkStatus,
      hasFailedItems: stats.failed > 0,
      hasPendingItems: stats.pending > 0 || stats.retry > 0,
      isHealthy: stats.failed === 0 && networkStatus.isConnected,
      isInitialized: this.isInitialized
    };
  }

  // ==========================================================================
  // NETTOYAGE
  // ==========================================================================

  /**
   * Nettoyer les items traites avec succes (plus vieux que X jours)
   *
   * @param {number} daysToKeep - Jours a conserver
   * @returns {Promise<number>} Nombre d'items supprimes
   */
  async cleanupOldItems(daysToKeep = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const items = await this.getQueueItems(QUEUE_ITEM_STATUS.SUCCESS);
    const oldItems = items.filter(
      item => new Date(item.updatedAt) < cutoffDate
    );

    let count = 0;
    for (const item of oldItems) {
      await this.removeFromQueue(item._id);
      count++;
    }

    this.debugLog(`Nettoyage: ${count} anciens items supprimes`);

    return count;
  }

  /**
   * Detruire la queue (pour reset complet)
   *
   * @returns {Promise<void>}
   */
  async destroy() {
    this.debugLog("Destruction de la queue...");

    // Annuler tous les timeouts
    Object.values(this.retryTimeouts).forEach(clearTimeout);
    this.retryTimeouts = {};

    // Retirer le listener reseau
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    // Detruire la base de donnees
    if (this.db) {
      try {
        await this.db.destroy();
      } catch (error) {
        console.error("[OfflineQueue] Erreur destruction DB:", error);
      }
      this.db = null;
    }

    // Nettoyer AsyncStorage
    try {
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    } catch (error) {
      console.error("[OfflineQueue] Erreur suppression AsyncStorage:", error);
    }

    this.listeners = [];
    this.isProcessing = false;
    this.isInitialized = false;

    this.debugLog("Queue detruite");
  }

  // ==========================================================================
  // UTILITAIRES
  // ==========================================================================

  /**
   * Log de debug
   *
   * @param {string} message - Message
   * @param {*} data - Donnees supplementaires
   */
  debugLog(message, data = null) {
    if (this.debugMode) {
      if (data) {
        console.log(`[OfflineQueue] ${message}`, data);
      } else {
        console.log(`[OfflineQueue] ${message}`);
      }
    }
  }

  /**
   * Activer/desactiver le mode debug
   *
   * @param {boolean} enabled - Activer
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  /**
   * Pause asynchrone
   *
   * @param {number} ms - Duree en ms
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// INSTANCE SINGLETON
// ============================================================================

/**
 * Instance singleton de la queue offline
 */
const offlineQueue = new OfflineQueue();

// ============================================================================
// EXPORTS
// ============================================================================

export {
  offlineQueue,
  QUEUE_STORAGE_KEY,
  QUEUE_DB_NAME,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_BASE,
  BATCH_SIZE
};

export default offlineQueue;
