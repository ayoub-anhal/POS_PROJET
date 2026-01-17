/**
 * sync.js
 *
 * Module de gestion de la synchronisation pour l'ecran des parametres.
 * Fournit les fonctions pour configurer et tester la connexion ERPNext.
 *
 * MODIFICATION Phase 3: Remplacement complet de FrappeFetch
 * - Ancien: Frappe.createClient() + tailpos_sync
 * - Nouveau: FrappeAPI + ApiConfig + SyncService
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

// ============================================================================
// NOUVEAU: Import de la nouvelle couche API (Phase 3)
// Remplace: import Frappe from "react-native-frappe-fetch";
// ============================================================================
import { FrappeAPI, ApiConfig, SyncService, ApiError, ERROR_CODES } from "../../api";

// Pour la validation d'URL
var validUrl = require("valid-url");

// Pour les notifications
import { Toast } from "native-base";

// ============================================================================
// FONCTION PRINCIPALE DE SYNCHRONISATION
// ============================================================================

/**
 * MODIFIE Phase 3: Synchronise les donnees avec le serveur ERPNext
 * Cette fonction configure la connexion et lance une synchronisation complete.
 *
 * @param {string} url - URL du serveur ERPNext (ex: https://erp.example.com)
 * @param {Object} credentials - Identifiants {username, password}
 * @returns {Promise<Object>} Resultat {success, message, data}
 */
module.exports.syncData = async function(url, credentials) {
  const { username, password } = credentials;

  console.log("[sync.js] Demarrage syncData vers:", url);

  // Valider l'URL
  if (!validUrl.isWebUri(url.toLowerCase())) {
    console.log("[sync.js] URL invalide:", url);
    return {
      success: false,
      error: "URL invalide. Utilisez le format: https://votre-serveur.com"
    };
  }

  // Valider les identifiants
  if (!username || username.trim() === "") {
    return {
      success: false,
      error: "Le nom d'utilisateur est requis"
    };
  }

  if (!password || password.trim() === "") {
    return {
      success: false,
      error: "Le mot de passe est requis"
    };
  }

  try {
    // 1. Sauvegarder la configuration
    console.log("[sync.js] Sauvegarde de la configuration...");
    const configSaved = await ApiConfig.saveConfig({
      serverUrl: url,
      username: username,
      password: password
    });

    if (!configSaved) {
      return {
        success: false,
        error: "Impossible de sauvegarder la configuration"
      };
    }

    // 2. Configurer l'API Frappe
    console.log("[sync.js] Configuration de l'API...");
    FrappeAPI.setConfig(url, username, password);
    FrappeAPI.setDebugMode(true);

    // 3. Tester la connexion (login)
    console.log("[sync.js] Test de connexion...");
    const loginResult = await FrappeAPI.login(username, password);

    console.log("[sync.js] Connexion reussie:", loginResult);

    // 4. Initialiser le service de synchronisation
    console.log("[sync.js] Initialisation du service de sync...");
    await SyncService.initialize({
      debugMode: true,
      onProgressUpdate: (message, percentage) => {
        console.log(`[sync.js] Progression: ${percentage}% - ${message}`);
      },
      onSyncError: (error) => {
        console.error("[sync.js] Erreur sync:", error);
      }
    });

    // 5. Lancer la synchronisation complete
    console.log("[sync.js] Lancement de la synchronisation...");
    const syncResult = await SyncService.syncAll();

    console.log("[sync.js] Resultat sync:", syncResult);

    if (syncResult.success) {
      return {
        success: true,
        message: "Connexion et synchronisation reussies",
        data: {
          user: loginResult,
          itemsCount: syncResult.results?.items?.count || 0,
          customersCount: syncResult.results?.customers?.count || 0,
          categoriesCount: syncResult.results?.categories?.count || 0,
          receiptsCount: syncResult.results?.receipts?.count || 0
        }
      };
    } else {
      return {
        success: false,
        error: syncResult.message || "La synchronisation a echoue",
        partial: true,
        data: {
          user: loginResult,
          syncResult: syncResult
        }
      };
    }

  } catch (error) {
    console.error("[sync.js] Erreur syncData:", error);

    // Gerer les differents types d'erreurs
    let errorMessage = "Erreur inconnue";

    if (error instanceof ApiError) {
      switch (error.code) {
        case ERROR_CODES.AUTH_ERROR:
          errorMessage = "Identifiants incorrects. Verifiez votre nom d'utilisateur et mot de passe.";
          break;
        case ERROR_CODES.NETWORK_ERROR:
          errorMessage = "Impossible de contacter le serveur. Verifiez l'URL et votre connexion internet.";
          break;
        case ERROR_CODES.TIMEOUT_ERROR:
          errorMessage = "Le serveur ne repond pas (timeout). Reessayez plus tard.";
          break;
        case ERROR_CODES.SERVER_ERROR:
          errorMessage = "Erreur du serveur ERPNext. Contactez l'administrateur.";
          break;
        default:
          errorMessage = error.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

// ============================================================================
// FONCTION DE TEST DE CONNEXION
// ============================================================================

/**
 * NOUVEAU: Teste la connexion au serveur ERPNext sans synchroniser
 *
 * @param {string} url - URL du serveur
 * @param {Object} credentials - Identifiants {username, password}
 * @returns {Promise<Object>} Resultat {success, message, user}
 */
module.exports.testConnection = async function(url, credentials) {
  const { username, password } = credentials;

  console.log("[sync.js] Test de connexion a:", url);

  // Valider l'URL
  if (!validUrl.isWebUri(url.toLowerCase())) {
    return {
      success: false,
      error: "URL invalide. Format attendu: https://votre-serveur.com"
    };
  }

  // Valider les identifiants
  if (!username || !password) {
    return {
      success: false,
      error: "Nom d'utilisateur et mot de passe requis"
    };
  }

  try {
    // Configurer et tester
    FrappeAPI.setConfig(url, username, password);
    FrappeAPI.setDebugMode(true);

    // Tenter la connexion
    const result = await FrappeAPI.login(username, password);

    // Deconnecter apres le test
    await FrappeAPI.logout();

    return {
      success: true,
      message: "Connexion reussie au serveur ERPNext",
      user: result
    };

  } catch (error) {
    console.error("[sync.js] Echec test connexion:", error);

    let errorMessage = "Echec de connexion";

    if (error instanceof ApiError) {
      switch (error.code) {
        case ERROR_CODES.AUTH_ERROR:
          errorMessage = "Identifiants incorrects";
          break;
        case ERROR_CODES.NETWORK_ERROR:
          errorMessage = "Impossible de contacter le serveur. Verifiez l'URL.";
          break;
        case ERROR_CODES.TIMEOUT_ERROR:
          errorMessage = "Le serveur ne repond pas";
          break;
        default:
          errorMessage = error.message;
      }
    }

    return {
      success: false,
      error: errorMessage
    };
  }
};

// ============================================================================
// FONCTION DE CHARGEMENT DE LA CONFIGURATION
// ============================================================================

/**
 * NOUVEAU: Charge la configuration sauvegardee
 *
 * @returns {Promise<Object>} Configuration {exists, url, username} ou {exists: false}
 */
module.exports.loadSavedConfig = async function() {
  console.log("[sync.js] Chargement de la configuration sauvegardee...");

  try {
    const config = await ApiConfig.loadConfig();

    if (config && config.serverUrl) {
      console.log("[sync.js] Configuration trouvee:", config.serverUrl);

      return {
        exists: true,
        url: config.serverUrl,
        username: config.username,
        warehouse: config.warehouse,
        priceList: config.priceList,
        isConfigured: config.isConfigured
        // Note: Le mot de passe n'est pas retourne pour des raisons de securite
      };
    }

    console.log("[sync.js] Aucune configuration trouvee");
    return { exists: false };

  } catch (error) {
    console.error("[sync.js] Erreur chargement config:", error);
    return {
      exists: false,
      error: error.message
    };
  }
};

// ============================================================================
// FONCTION D'EFFACEMENT DE LA CONFIGURATION
// ============================================================================

/**
 * NOUVEAU: Efface completement la configuration sauvegardee
 *
 * @returns {Promise<Object>} Resultat {success}
 */
module.exports.clearConfig = async function() {
  console.log("[sync.js] Effacement de la configuration...");

  try {
    await ApiConfig.clearConfig();

    // Deconnecter l'utilisateur si connecte
    if (await FrappeAPI.isAuthenticated()) {
      await FrappeAPI.logout();
    }

    console.log("[sync.js] Configuration effacee");
    return { success: true };

  } catch (error) {
    console.error("[sync.js] Erreur effacement config:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================================================
// FONCTION DE MISE A JOUR DE LA CONFIGURATION
// ============================================================================

/**
 * NOUVEAU: Met a jour partiellement la configuration
 *
 * @param {Object} updates - Proprietes a mettre a jour
 * @returns {Promise<Object>} Resultat {success}
 */
module.exports.updateConfig = async function(updates) {
  console.log("[sync.js] Mise a jour de la configuration...", Object.keys(updates));

  try {
    const result = await ApiConfig.updateConfig(updates);

    if (result) {
      // Si l'URL ou les identifiants changent, reconfigurer l'API
      if (updates.serverUrl || updates.username || updates.password) {
        const config = ApiConfig.getFullConfig();
        FrappeAPI.setConfig(
          config.serverUrl,
          config.username,
          config.password
        );
      }

      return { success: true };
    }

    return {
      success: false,
      error: "Impossible de mettre a jour la configuration"
    };

  } catch (error) {
    console.error("[sync.js] Erreur mise a jour config:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================================================
// FONCTION DE SYNCHRONISATION RAPIDE
// ============================================================================

/**
 * NOUVEAU: Lance une synchronisation rapide (produits seulement)
 *
 * @returns {Promise<Object>} Resultat
 */
module.exports.quickSync = async function() {
  console.log("[sync.js] Synchronisation rapide...");

  try {
    // Verifier que la configuration existe
    if (!ApiConfig.isFullyConfigured()) {
      return {
        success: false,
        error: "Configuration incomplete. Configurez d'abord la connexion."
      };
    }

    // Lancer la sync des items
    await SyncService.initialize({ debugMode: false });
    const result = await SyncService.syncItems();

    return {
      success: result.success,
      itemsCount: result.count || 0,
      message: result.success ? "Produits synchronises" : "Echec de synchronisation"
    };

  } catch (error) {
    console.error("[sync.js] Erreur quick sync:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================================================
// FONCTION DE RECUPERATION DU STATUT
// ============================================================================

/**
 * NOUVEAU: Recupere le statut actuel de la synchronisation
 *
 * @returns {Object} Statut {isSyncing, lastSync, error, offlineQueue}
 */
module.exports.getSyncStatus = function() {
  const status = SyncService.getSyncStatus();
  const queueStatus = SyncService.getOfflineQueueStatus();

  return {
    isSyncing: status.isSyncing,
    lastSyncTime: status.lastSyncTime,
    lastSyncStatus: status.lastSyncStatus,
    syncError: status.errors.length > 0 ? status.errors[status.errors.length - 1] : null,
    stats: status.stats,
    offlineQueueCount: queueStatus.count,
    isProcessingQueue: queueStatus.isProcessing
  };
};

// ============================================================================
// FONCTION DE TRAITEMENT DE LA QUEUE OFFLINE
// ============================================================================

/**
 * NOUVEAU: Traite la queue des operations hors ligne
 *
 * @returns {Promise<Object>} Resultat
 */
module.exports.processOfflineQueue = async function() {
  console.log("[sync.js] Traitement de la queue offline...");

  try {
    const result = await SyncService.processOfflineQueue();

    return {
      success: true,
      processed: result.processed,
      errors: result.errors
    };

  } catch (error) {
    console.error("[sync.js] Erreur traitement queue:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================================================
// FONCTION DE VALIDATION D'URL
// ============================================================================

/**
 * NOUVEAU: Valide le format d'une URL
 *
 * @param {string} url - URL a valider
 * @returns {Object} {isValid, message}
 */
module.exports.validateUrl = function(url) {
  if (!url || url.trim() === "") {
    return {
      isValid: false,
      message: "L'URL est requise"
    };
  }

  const normalizedUrl = url.toLowerCase().trim();

  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    return {
      isValid: false,
      message: "L'URL doit commencer par http:// ou https://"
    };
  }

  if (!validUrl.isWebUri(normalizedUrl)) {
    return {
      isValid: false,
      message: "Format d'URL invalide"
    };
  }

  // Avertissement si HTTP (non securise)
  if (normalizedUrl.startsWith("http://") && !normalizedUrl.includes("localhost")) {
    return {
      isValid: true,
      message: "Attention: La connexion n'est pas securisee (HTTP)",
      warning: true
    };
  }

  return {
    isValid: true,
    message: "URL valide"
  };
};

// ============================================================================
// EXPORTS DES CONSTANTES UTILES
// ============================================================================

/**
 * Constantes exportees pour utilisation dans les composants
 */
module.exports.SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
  OFFLINE: 'offline'
};

/**
 * Configuration par defaut
 */
module.exports.DEFAULT_CONFIG = {
  warehouse: 'Stores - TC',
  priceList: 'Standard Selling',
  syncInterval: 300000, // 5 minutes
};
