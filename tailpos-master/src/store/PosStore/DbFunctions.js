/**
 * DbFunctions.js
 *
 * Fonctions de gestion de la base de donnees locale PouchDB
 * et de synchronisation avec ERPNext.
 *
 * MODIFICATION Phase 3: Remplacement de FrappeFetch par la nouvelle couche API
 * - Ancien: FrappeFetch + tailpos_sync.sync_pos.sync_data
 * - Nouveau: FrappeAPI + SyncService (API REST Frappe standard)
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

import PouchDB from "pouchdb-react-native";
import SQLite from "react-native-sqlite-2";
import SQLiteAdapterFactory from "pouchdb-adapter-react-native-sqlite";
import { getRoot } from "mobx-state-tree";
import { NetInfo } from "react-native";
import { Toast } from "native-base";

// ============================================================================
// NOUVEAU: Import de la nouvelle couche API (Phase 3)
// Remplace: import FrappeFetch from "react-native-frappe-fetch";
// ============================================================================
import { FrappeAPI, ApiConfig, SyncService, ApiError, ERROR_CODES } from "../../api";

// Pour la validation d'URL
var validUrl = require("valid-url");

// Import pour les jobs en arriere-plan
import BackgroundJob from "react-native-background-job";

// ============================================================================
// CONFIGURATION POUCHDB
// ============================================================================

/**
 * Ouvre une base de donnees PouchDB avec l'adaptateur SQLite
 * @param {string} dbName - Nom de la base de donnees
 * @param {boolean} withSync - Activer la synchronisation (non utilise actuellement)
 * @returns {PouchDB} Instance de la base de donnees
 */
export function openAndSyncDB(dbName, withSync = false) {
  const SQLiteAdapter = SQLiteAdapterFactory(SQLite);
  PouchDB.plugin(SQLiteAdapter);
  const db = new PouchDB(dbName + ".db", { adapter: "react-native-sqlite" });
  PouchDB.plugin(require("pouchdb-find"));
  PouchDB.plugin(require("pouchdb-upsert"));
  return db;
}

/**
 * Synchronise une base de donnees avec le serveur distant
 * NOTE: Cette fonction utilisait l'ancien serveur TailPOS (db.tailpos.com)
 * Elle est conservee pour compatibilite mais n'est plus utilisee
 * @deprecated Utiliser SyncService a la place
 */
export function syncDB(db, dbName, session) {
  // ANCIEN CODE - conserve pour reference
  // Server URL
  const url = `https://${session.db_name}:${session.token}@db.tailpos.com/${
    session.db_name
  }-${dbName}`;
  const opts = { live: true, retry: true };

  // Sync from
  return db.replicate.from(url).on("complete", function(info) {
    db.sync(url, opts);
  });
}

// ============================================================================
// FONCTIONS DE SYNCHRONISATION - MODIFIEES PHASE 3
// ============================================================================

/**
 * NOUVEAU: Fonction principale de synchronisation avec ERPNext
 * Remplace l'ancienne fonction qui utilisait tailpos_sync
 *
 * @param {string} jsonObject - Donnees JSON a synchroniser (pour compatibilite)
 * @param {string} type - Type de synchronisation ("forceSync" ou "sync")
 * @param {string} trashObj - Objets a supprimer (JSON string)
 * @param {Object} credentials - Identifiants {url, user_name, password, deviceId}
 * @param {boolean} jobStatus - True si appele depuis un job en arriere-plan
 * @param {Object} store - Reference au store MobX
 * @returns {Promise<Object>} Resultat de la synchronisation
 */
export function sync(
  jsonObject,
  type,
  trashObj,
  credentials,
  jobStatus,
  store,
) {
  return NetInfo.isConnected.fetch().then(async isConnected => {
    if (isConnected) {
      // NOUVEAU: Utiliser la nouvelle API au lieu de FrappeFetch
      try {
        // Preparer les credentials pour la nouvelle API
        const apiCredentials = credentials_info(credentials);

        // Configurer l'API Frappe
        FrappeAPI.setConfig(
          apiCredentials.url,
          apiCredentials.username,
          apiCredentials.password
        );

        // Lancer la synchronisation via le nouveau service
        return await syncWithNewAPI(apiCredentials, type, jobStatus, store);

      } catch (error) {
        console.error("[DbFunctions] Erreur sync:", error);
        showToastDanger("Erreur de synchronisation: " + error.message);

        if (store && store.stateStore) {
          store.stateStore.setIsNotSyncing();
        }
        BackgroundJob.cancel({ jobKey: "AutomaticSync" });

        throw error;
      }
    } else {
      showToastDanger("Pas de connexion Internet. Verifiez votre connexion.");
      return null;
    }
  });
}

/**
 * NOUVEAU: Synchronisation utilisant la nouvelle couche API
 * Cette fonction remplace sync_now qui utilisait FrappeFetch
 *
 * @param {Object} credentials - {url, username, password}
 * @param {string} type - Type de sync
 * @param {boolean} jobStatus - Job en arriere-plan?
 * @param {Object} store - Store MobX
 * @returns {Promise<Object>} Resultat
 */
async function syncWithNewAPI(credentials, type, jobStatus, store) {
  console.log("[DbFunctions] Demarrage syncWithNewAPI, type:", type);

  try {
    // Verifier que l'URL est valide
    if (!credentials.url || !validUrl.isWebUri(credentials.url)) {
      throw new Error("URL invalide. Configurez l'URL dans les parametres.");
    }

    // Se connecter a ERPNext
    const loginResult = await FrappeAPI.login(
      credentials.username,
      credentials.password
    );

    console.log("[DbFunctions] Connexion reussie:", loginResult);

    // Initialiser le service de synchronisation
    await SyncService.initialize({
      debugMode: ApiConfig.debugMode || false,
      onProgressUpdate: (message, percentage) => {
        console.log(`[Sync] ${percentage}% - ${message}`);
      },
      onSyncError: (error) => {
        console.error("[Sync] Erreur:", error);
      },
    });

    // Lancer la synchronisation appropriee
    let result;
    if (type === "forceSync") {
      // Synchronisation complete
      result = await SyncService.syncAll();
    } else {
      // Synchronisation incrementale
      result = await SyncService.syncAll();
    }

    console.log("[DbFunctions] Resultat sync:", result);

    // Formater le resultat pour compatibilite avec l'ancien format
    return {
      status: result.success,
      data: result.results ? formatSyncResultsForLegacy(result.results) : [],
      deleted_documents: [],
      message: result.message,
    };

  } catch (error) {
    console.error("[DbFunctions] Erreur syncWithNewAPI:", error);

    // Gerer les erreurs specifiques
    if (error instanceof ApiError) {
      switch (error.code) {
        case ERROR_CODES.AUTH_ERROR:
          showToastDanger("Erreur d'authentification. Verifiez vos identifiants.");
          break;
        case ERROR_CODES.NETWORK_ERROR:
          showToastDanger("Erreur reseau. Verifiez votre connexion.");
          break;
        case ERROR_CODES.SERVER_ERROR:
          showToastDanger("Erreur serveur ERPNext. Reessayez plus tard.");
          break;
        default:
          showToastDanger("Erreur: " + error.message);
      }
    }

    // Annuler le job en arriere-plan en cas d'erreur
    BackgroundJob.cancel({ jobKey: "AutomaticSync" });

    if (store && store.stateStore) {
      store.stateStore.setIsNotSyncing();
    }

    throw error;
  }
}

/**
 * ANCIEN: sync_now - Conserve pour reference mais remplace par syncWithNewAPI
 * @deprecated Utiliser syncWithNewAPI a la place
 */
export function sync_now(site_credentials, tailpos_object, jobStatus, store) {
  console.warn("[DbFunctions] sync_now est deprecie, utilisez syncWithNewAPI");

  // Rediriger vers la nouvelle fonction
  return syncWithNewAPI(
    {
      url: site_credentials.url,
      username: site_credentials.username,
      password: site_credentials.password,
    },
    tailpos_object.typeOfSync || "sync",
    jobStatus,
    store
  );
}

/**
 * NOUVEAU: Teste la connexion au serveur ERPNext
 *
 * @param {string} url - URL du serveur
 * @param {string} username - Nom d'utilisateur
 * @param {string} password - Mot de passe
 * @returns {Promise<Object>} {success, message}
 */
export async function testConnection(url, username, password) {
  console.log("[DbFunctions] Test de connexion a:", url);

  try {
    // Valider l'URL
    if (!validUrl.isWebUri(url.toLowerCase())) {
      return {
        success: false,
        message: "URL invalide. Format attendu: https://votre-serveur.com"
      };
    }

    // Configurer et tester
    FrappeAPI.setConfig(url, username, password);
    FrappeAPI.setDebugMode(true);

    const result = await FrappeAPI.login(username, password);

    // Deconnecter apres le test
    await FrappeAPI.logout();

    return {
      success: true,
      message: "Connexion reussie au serveur ERPNext",
      user: result
    };

  } catch (error) {
    console.error("[DbFunctions] Echec test connexion:", error);

    let message = "Echec de connexion";
    if (error instanceof ApiError) {
      switch (error.code) {
        case ERROR_CODES.AUTH_ERROR:
          message = "Identifiants incorrects";
          break;
        case ERROR_CODES.NETWORK_ERROR:
          message = "Impossible de contacter le serveur";
          break;
        case ERROR_CODES.TIMEOUT_ERROR:
          message = "Le serveur ne repond pas (timeout)";
          break;
        default:
          message = error.message;
      }
    }

    return {
      success: false,
      message: message
    };
  }
}

/**
 * NOUVEAU: Synchronise les produits depuis ERPNext
 * @returns {Promise<Array>} Liste des produits synchronises
 */
export async function syncItemsFromERPNext() {
  try {
    const result = await SyncService.syncItems();
    return result;
  } catch (error) {
    console.error("[DbFunctions] Erreur syncItems:", error);
    throw error;
  }
}

/**
 * NOUVEAU: Synchronise les clients depuis ERPNext
 * @returns {Promise<Array>} Liste des clients synchronises
 */
export async function syncCustomersFromERPNext() {
  try {
    const result = await SyncService.syncCustomers();
    return result;
  } catch (error) {
    console.error("[DbFunctions] Erreur syncCustomers:", error);
    throw error;
  }
}

/**
 * NOUVEAU: Envoie les ventes vers ERPNext
 * @returns {Promise<Object>} Resultat de l'envoi
 */
export async function syncReceiptsToERPNext() {
  try {
    const result = await SyncService.syncReceipts();
    return result;
  } catch (error) {
    console.error("[DbFunctions] Erreur syncReceipts:", error);
    throw error;
  }
}

// ============================================================================
// FONCTIONS UTILITAIRES - CONSERVEES
// ============================================================================

/**
 * Extrait les informations de credentials dans un format standard
 * @param {Object} credentials - Credentials bruts
 * @returns {Object} {url, username, password}
 */
export function credentials_info(credentials) {
  return {
    url: (credentials.url || "").toLowerCase(),
    username: credentials.user_name || credentials.username || "",
    password: credentials.password || "",
  };
}

/**
 * Prepare les donnees TailPOS pour la synchronisation
 * CONSERVE pour compatibilite avec l'ancien code
 * @param {string} jsonObject - Donnees JSON
 * @param {string} type - Type de sync
 * @param {string} trashObj - Objets supprimes
 * @param {Object} credentials - Identifiants
 * @returns {Object} Donnees formatees
 */
export function tailpos_data(jsonObject, type, trashObj, credentials) {
  return {
    tailposData: JSON.parse(jsonObject),
    trashObject: JSON.parse(trashObj),
    deviceId: credentials.deviceId,
    typeOfSync: type,
  };
}

/**
 * Sauvegarde un snapshot dans la base PouchDB
 * @param {PouchDB} db - Instance de base de donnees
 * @param {Object} snapshot - Donnees a sauvegarder
 */
export function saveSnapshotToDB(db, snapshot) {
  let updateObj = false;
  db.upsert(snapshot._id, function(doc) {
    if (!doc._id) {
      doc = snapshot;
      updateObj = true;
    } else {
      Object.keys(snapshot).forEach(function(key) {
        if (!(key === "_rev")) {
          if (doc[key] !== snapshot[key]) {
            doc[key] = snapshot[key];
            updateObj = true;
          }
        }
      });
    }
    if (updateObj) {
      return doc;
    } else {
      return updateObj;
    }
  });
}

/**
 * Edite les champs d'un objet
 * @param {Object} obj - Objet a modifier
 * @param {Object} data - Nouvelles donnees
 */
export function editFields(obj, data) {
  Object.keys(data).forEach(function(key) {
    if (!(key === "_id")) {
      obj[key] = data[key];
    }
  });
}

/**
 * Supprime un objet de la base de donnees
 * @param {Object} obj - Objet a supprimer
 * @param {PouchDB} db - Instance de base de donnees
 */
export function deleteObject(obj, db) {
  db.get(obj._id).then(doc => {
    db.remove(doc);
  });
  getRoot(obj).delete(obj);
}

/**
 * Recupere des lignes de la base de donnees
 * @param {Object} obj - Store cible
 * @param {PouchDB} db - Instance de base de donnees
 * @param {number} numberRows - Nombre de lignes
 * @param {Object} rowsOptions - Options de requete
 * @returns {Promise<Array>} Lignes recuperees
 */
export function getRows(obj, db, numberRows, rowsOptions) {
  return new Promise((resolve, reject) => {
    rowsOptions.limit = numberRows;
    rowsOptions.include_docs = true;
    db.allDocs(rowsOptions).then(entries => {
      if (entries && entries.rows.length > 0) {
        rowsOptions.startkey = entries.rows[entries.rows.length - 1].id;
        rowsOptions.skip = 1;
        for (var i = 0; i < entries.rows.length; i++) {
          if (entries.rows[i].doc.name || entries.rows[i].doc.role) {
            obj.add(JSON.parse(JSON.stringify(entries.rows[i].doc)));
          }
        }
      }
    });
    resolve(obj.rows);
  });
}

// ============================================================================
// FONCTIONS UTILITAIRES PRIVEES
// ============================================================================

/**
 * Affiche un toast d'erreur
 * @param {string} message - Message a afficher
 */
function showToastDanger(message) {
  Toast.show({
    text: message,
    type: "danger",
    duration: 5000,
  });
}

/**
 * Affiche un toast de succes
 * @param {string} message - Message a afficher
 */
function showToastSuccess(message) {
  Toast.show({
    text: message,
    type: "success",
    duration: 3000,
  });
}

/**
 * NOUVEAU: Formate les resultats de sync pour compatibilite legacy
 * Convertit le nouveau format en ancien format attendu par syncInBackground
 *
 * @param {Object} results - Resultats du nouveau SyncService
 * @returns {Array} Donnees au format legacy
 */
function formatSyncResultsForLegacy(results) {
  const legacyData = [];

  // Convertir les items
  if (results.items && results.items.items) {
    results.items.items.forEach(item => {
      legacyData.push({
        tableNames: "Item",
        syncObject: item,
      });
    });
  }

  // Convertir les categories
  if (results.categories && results.categories.items) {
    results.categories.items.forEach(category => {
      legacyData.push({
        tableNames: "Categories",
        syncObject: category,
      });
    });
  }

  // Convertir les clients
  if (results.customers && results.customers.items) {
    results.customers.items.forEach(customer => {
      legacyData.push({
        tableNames: "Customer",
        syncObject: customer,
      });
    });
  }

  return legacyData;
}

// ============================================================================
// EXPORTS SUPPLEMENTAIRES POUR COMPATIBILITE
// ============================================================================

// Re-exporter les elements de l'API pour un acces facile
export { FrappeAPI, ApiConfig, SyncService };
