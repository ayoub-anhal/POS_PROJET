/**
 * SyncStore.js
 *
 * Store MobX-State-Tree pour la gestion de la synchronisation.
 *
 * MODIFICATION Phase 3: Integration avec la nouvelle couche API
 * - Ajout de nouvelles actions pour utiliser SyncService
 * - Conservation de la compatibilite avec l'ancien code
 * - Ajout de proprietes d'etat de synchronisation
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

import { types } from "mobx-state-tree";
import { openAndSyncDB, sync, saveSnapshotToDB } from "./DbFunctions";
import { assignUUID } from "./Utils";

// ============================================================================
// NOUVEAU: Import de la nouvelle couche API (Phase 3)
// ============================================================================
import { SyncService, SYNC_STATUS, SYNC_TYPES, ApiConfig } from "../../api";

// ============================================================================
// BASE DE DONNEES TRASH
// ============================================================================

let trash = openAndSyncDB("trash", true);

/**
 * Modele pour les elements supprimes (trash)
 */
export const Trash = types
  .model("Trash", {
    _id: types.identifier(),
    trashId: types.optional(types.string, ""),
    table_name: types.optional(types.string, ""),
  })
  .preProcessSnapshot(snapshot => assignUUID(snapshot, "Item"))
  .actions(self => ({
    postProcessSnapshot(snapshot) {
      saveSnapshotToDB(trash, snapshot);
    },
  }));

// ============================================================================
// SYNCSTORE - STORE PRINCIPAL DE SYNCHRONISATION
// ============================================================================

const SyncStore = types
  .model("SyncStore", {
    // Proprietes existantes (conservees pour compatibilite)
    rows: types.optional(types.string, "[]"),
    trashRows: types.optional(types.string, "[]"),

    // NOUVEAU: Proprietes d'etat de synchronisation (Phase 3)
    syncStatus: types.optional(types.string, SYNC_STATUS.IDLE),
    lastSyncTime: types.maybeNull(types.Date),
    syncProgress: types.optional(types.number, 0),
    syncProgressMessage: types.optional(types.string, ""),
    syncError: types.maybeNull(types.string),
    itemsSynced: types.optional(types.number, 0),
    customersSynced: types.optional(types.number, 0),
    receiptsSynced: types.optional(types.number, 0),
  })
  .views(self => ({
    /**
     * NOUVEAU: Retourne true si une synchronisation est en cours
     */
    get isSyncing() {
      return self.syncStatus === SYNC_STATUS.SYNCING;
    },

    /**
     * NOUVEAU: Retourne true si la derniere sync a reussi
     */
    get isLastSyncSuccess() {
      return self.syncStatus === SYNC_STATUS.SUCCESS;
    },

    /**
     * NOUVEAU: Retourne le temps ecoule depuis la derniere sync
     */
    get timeSinceLastSync() {
      if (!self.lastSyncTime) return null;
      return Date.now() - self.lastSyncTime.getTime();
    },

    /**
     * NOUVEAU: Retourne un resume du statut de sync
     */
    get syncSummary() {
      return {
        status: self.syncStatus,
        lastSync: self.lastSyncTime,
        items: self.itemsSynced,
        customers: self.customersSynced,
        receipts: self.receiptsSynced,
        error: self.syncError,
      };
    },
  }))
  .actions(self => ({
    // ========================================================================
    // ACTIONS EXISTANTES (conservees pour compatibilite)
    // ========================================================================

    /**
     * Ajoute des donnees aux rows de synchronisation
     * @param {Object} data - Donnees a ajouter
     */
    add(data) {
      let rowsData = JSON.parse(self.rows);
      rowsData.push(data);
      self.rows = JSON.stringify(rowsData);
    },

    /**
     * Ajoute un element a la corbeille
     * @param {Object} data - Element a ajouter
     */
    addToTrash(data) {
      let dataObject = JSON.parse(self.trashRows);
      dataObject.push(data);
      self.trashRows = JSON.stringify(dataObject);
    },

    /**
     * Force la synchronisation de toutes les donnees
     * CONSERVE pour compatibilite avec l'ancien code
     * @returns {Promise<string>} JSON des donnees a synchroniser
     */
    async forceSync() {
      self.rows = "[]";
      let databaseNames = [
        "categories",
        "items",
        "discounts",
        "attendants",
        "receipts",
        "payments",
        "shifts",
        "customers",
        "company",
      ];
      let databaseNamesUpperCase = [
        "Categories",
        "Item",
        "Discounts",
        "Attendants",
        "Receipts",
        "Payments",
        "Shifts",
        "Customer",
        "Company",
      ];

      await trash.allDocs({ include_docs: true }).then(entries => {
        if (entries && entries.rows.length > 0) {
          for (let i = 0; i < entries.rows.length; i += 1) {
            if (entries.rows[i].doc.trashId) {
              JSON.parse(self.trashRows).push(
                JSON.parse(JSON.stringify(entries.rows[i].doc)),
              );
            }
          }
        }
      });

      return new Promise(function(resolve, reject) {
        for (let x = 0; x < databaseNames.length; x += 1) {
          openAndSyncDB(databaseNames[x])
            .allDocs({ include_docs: true })
            .then(entries => {
              if (entries && entries.rows.length > 0) {
                for (let i = 0; i < entries.rows.length; i += 1) {
                  if (
                    entries.rows[i].doc.name ||
                    entries.rows[i].doc.user_name ||
                    entries.rows[i].doc.status === "completed" ||
                    entries.rows[i].doc.status === "cancelled" ||
                    entries.rows[i].doc.receipt ||
                    entries.rows[i].doc.status === "Closed"
                  ) {
                    self.add({
                      dbName: databaseNamesUpperCase[x],
                      syncObject: entries.rows[i].doc,
                    });
                  }
                }
              }
            })
            .then(result => {
              if (databaseNames.length - 1 === x) {
                resolve(self.rows);
              }
            });
        }
      });
    },

    /**
     * Synchronise uniquement les donnees non synchronisees
     * CONSERVE pour compatibilite avec l'ancien code
     * @returns {Promise<string>} JSON des donnees a synchroniser
     */
    async selectedSync() {
      self.rows = "[]";
      let databaseNames = [
        "categories",
        "items",
        "discounts",
        "attendants",
        "receipts",
        "payments",
        "shifts",
        "customers",
      ];
      let databaseNamesUpperCase = [
        "Categories",
        "Item",
        "Discounts",
        "Attendants",
        "Receipts",
        "Payments",
        "Shifts",
        "Customer",
      ];

      await trash.allDocs({ include_docs: true }).then(entries => {
        if (entries && entries.rows.length > 0) {
          for (let i = 0; i < entries.rows.length; i += 1) {
            if (entries.rows[i].doc.trashId) {
              JSON.parse(self.trashRows).push(
                JSON.parse(JSON.stringify(entries.rows[i].doc)),
              );
            }
          }
        }
      });

      return new Promise(function(resolve, reject) {
        for (let x = 0; x < databaseNames.length; x += 1) {
          openAndSyncDB(databaseNames[x])
            .allDocs({ include_docs: true })
            .then(entries => {
              if (entries && entries.rows.length > 0) {
                for (let i = 0; i < entries.rows.length; i += 1) {
                  if (
                    (entries.rows[i].doc.name ||
                      entries.rows[i].doc.user_name ||
                      entries.rows[i].doc.status === "completed" ||
                      entries.rows[i].doc.status === "cancelled" ||
                      entries.rows[i].doc.receipt ||
                      entries.rows[i].doc.status === "Closed") &&
                    entries.rows[i].doc.syncStatus === false
                  ) {
                    self.add({
                      dbName: databaseNamesUpperCase[x],
                      syncObject: entries.rows[i].doc,
                    });
                  }
                }
              }
            })
            .then(result => {
              if (databaseNames.length - 1 === x) {
                resolve(self.rows);
              }
            });
        }
      });
    },

    /**
     * Lance la synchronisation avec le serveur
     * CONSERVE pour compatibilite - utilise l'ancienne methode
     * @param {string} objects - Donnees JSON
     * @param {string} type - Type de sync
     * @param {Object} credentials - Identifiants
     * @param {boolean} jobStatus - Job en arriere-plan
     * @param {Object} store - Reference au store
     * @returns {Promise<Object>} Resultat
     */
    async syncNow(objects, type, credentials, jobStatus, store) {
      let returnResult = [];

      let trashRowsValues = self.trashRows;
      self.trashRows = "[]";

      await sync(
        objects,
        type,
        trashRowsValues,
        credentials,
        jobStatus,
        store,
      ).then(result => {
        if (result) {
          returnResult = result;
        }
      });

      return returnResult;
    },

    // ========================================================================
    // NOUVELLES ACTIONS (Phase 3)
    // ========================================================================

    /**
     * NOUVEAU: Synchronise avec le serveur en utilisant la nouvelle API
     * Cette methode est recommandee pour les nouvelles implementations
     *
     * @param {Object} options - Options de synchronisation
     * @returns {Promise<Object>} Resultat de la synchronisation
     */
    async syncWithServer(options = {}) {
      console.log("[SyncStore] Demarrage syncWithServer");

      try {
        // Mettre a jour le statut
        self.setSyncStatus(SYNC_STATUS.SYNCING);
        self.setSyncError(null);
        self.setSyncProgress(0, "Initialisation...");

        // Verifier la configuration
        const config = await ApiConfig.loadConfig();
        if (!config || !ApiConfig.isFullyConfigured()) {
          throw new Error("Configuration API incomplete. Configurez la connexion ERPNext.");
        }

        // Initialiser le service de synchronisation
        await SyncService.initialize({
          debugMode: options.debugMode || ApiConfig.debugMode || false,
          onProgressUpdate: (message, percentage) => {
            self.setSyncProgress(percentage, message);
          },
          onSyncError: (error) => {
            console.error("[SyncStore] Erreur sync:", error);
            self.handleSyncError(error);
          },
          onSyncComplete: (results) => {
            console.log("[SyncStore] Sync complete:", results);
          },
        });

        // Lancer la synchronisation
        const result = await SyncService.syncAll();

        // Mettre a jour les statistiques
        if (result.success) {
          self.setSyncStatus(SYNC_STATUS.SUCCESS);
          self.setLastSyncTime(new Date());

          if (result.results) {
            self.updateSyncStats(result.results);
          }

          self.setSyncProgress(100, "Synchronisation terminee");
        } else {
          self.setSyncStatus(SYNC_STATUS.ERROR);
          self.setSyncError(result.message || "Echec de synchronisation");
        }

        console.log("[SyncStore] Resultat syncWithServer:", result);
        return result;

      } catch (error) {
        console.error("[SyncStore] Erreur syncWithServer:", error);
        self.setSyncStatus(SYNC_STATUS.ERROR);
        self.setSyncError(error.message);
        throw error;
      }
    },

    /**
     * NOUVEAU: Synchronise uniquement les produits
     * @returns {Promise<Object>} Resultat
     */
    async syncItems() {
      console.log("[SyncStore] Synchronisation des items");

      try {
        self.setSyncProgress(0, "Synchronisation des produits...");
        const result = await SyncService.syncItems();

        if (result.success) {
          self.itemsSynced = result.count || 0;
        }

        return result;
      } catch (error) {
        console.error("[SyncStore] Erreur syncItems:", error);
        throw error;
      }
    },

    /**
     * NOUVEAU: Synchronise uniquement les clients
     * @returns {Promise<Object>} Resultat
     */
    async syncCustomers() {
      console.log("[SyncStore] Synchronisation des clients");

      try {
        self.setSyncProgress(0, "Synchronisation des clients...");
        const result = await SyncService.syncCustomers();

        if (result.success) {
          self.customersSynced = result.count || 0;
        }

        return result;
      } catch (error) {
        console.error("[SyncStore] Erreur syncCustomers:", error);
        throw error;
      }
    },

    /**
     * NOUVEAU: Envoie les ventes vers ERPNext
     * @returns {Promise<Object>} Resultat
     */
    async syncReceipts() {
      console.log("[SyncStore] Envoi des ventes vers ERPNext");

      try {
        self.setSyncProgress(0, "Envoi des ventes...");
        const result = await SyncService.syncReceipts();

        if (result.success) {
          self.receiptsSynced = result.count || 0;
        }

        return result;
      } catch (error) {
        console.error("[SyncStore] Erreur syncReceipts:", error);
        throw error;
      }
    },

    /**
     * NOUVEAU: Met a jour le statut de synchronisation
     * @param {string} status - Nouveau statut (SYNC_STATUS)
     */
    setSyncStatus(status) {
      self.syncStatus = status;
    },

    /**
     * NOUVEAU: Met a jour l'heure de derniere synchronisation
     * @param {Date} time - Date/heure
     */
    setLastSyncTime(time) {
      self.lastSyncTime = time;
    },

    /**
     * NOUVEAU: Met a jour la progression de synchronisation
     * @param {number} progress - Pourcentage (0-100)
     * @param {string} message - Message de progression
     */
    setSyncProgress(progress, message = "") {
      self.syncProgress = progress;
      if (message) {
        self.syncProgressMessage = message;
      }
    },

    /**
     * NOUVEAU: Definit une erreur de synchronisation
     * @param {string|null} error - Message d'erreur ou null
     */
    setSyncError(error) {
      self.syncError = error;
    },

    /**
     * NOUVEAU: Met a jour les statistiques de synchronisation
     * @param {Object} results - Resultats de sync
     */
    updateSyncStats(results) {
      if (results.items) {
        self.itemsSynced = results.items.count || 0;
      }
      if (results.customers) {
        self.customersSynced = results.customers.count || 0;
      }
      if (results.receipts) {
        self.receiptsSynced = results.receipts.count || 0;
      }
    },

    /**
     * NOUVEAU: Gere les erreurs de synchronisation
     * @param {Error} error - Erreur survenue
     */
    handleSyncError(error) {
      console.error("[SyncStore] Erreur de synchronisation:", error);
      self.syncError = error.message || "Erreur inconnue";
      self.syncStatus = SYNC_STATUS.ERROR;
    },

    /**
     * NOUVEAU: Reinitialise l'etat de synchronisation
     */
    resetSyncState() {
      self.syncStatus = SYNC_STATUS.IDLE;
      self.syncProgress = 0;
      self.syncProgressMessage = "";
      self.syncError = null;
    },

    /**
     * NOUVEAU: Verifie si une synchronisation est necessaire
     * @param {number} maxAge - Age maximum en ms (defaut: 5 minutes)
     * @returns {boolean} True si sync necessaire
     */
    needsSync(maxAge = 300000) {
      if (!self.lastSyncTime) return true;
      const timeSince = Date.now() - self.lastSyncTime.getTime();
      return timeSince > maxAge;
    },

    /**
     * NOUVEAU: Recupere le statut de la queue offline
     * @returns {Object} Statut de la queue
     */
    getOfflineQueueStatus() {
      return SyncService.getOfflineQueueStatus();
    },

    /**
     * NOUVEAU: Traite la queue offline
     * @returns {Promise<Object>} Resultat
     */
    async processOfflineQueue() {
      return await SyncService.processOfflineQueue();
    },
  }));

// ============================================================================
// INSTANCE DU STORE
// ============================================================================

const Sync = SyncStore.create({});

export default Sync;

// Exporter aussi le type du store pour les tests
export { SyncStore };
