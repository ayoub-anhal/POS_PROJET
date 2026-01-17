/**
 * NetworkMonitor.js
 *
 * Module de surveillance du reseau pour TailPOS.
 * Detecte les changements de connexion et verifie l'accessibilite du serveur ERPNext.
 *
 * Caracteristiques:
 * - Surveillance continue du statut reseau
 * - Detection du type de connexion (WiFi, Cellular)
 * - Ping periodique vers le serveur ERPNext
 * - Evenements: onConnect, onDisconnect, onConnectionChange
 * - Historique des changements de connexion
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

import { NetInfo } from "react-native";

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Intervalle de ping par defaut (30 secondes)
 */
export const DEFAULT_PING_INTERVAL = 30000;

/**
 * Timeout pour le ping (5 secondes)
 */
export const PING_TIMEOUT = 5000;

/**
 * Nombre maximum d'entrees dans l'historique
 */
export const MAX_HISTORY_SIZE = 50;

/**
 * Types de connexion
 */
export const CONNECTION_TYPES = {
  WIFI: "wifi",
  CELLULAR: "cellular",
  ETHERNET: "ethernet",
  BLUETOOTH: "bluetooth",
  VPN: "vpn",
  NONE: "none",
  UNKNOWN: "unknown"
};

/**
 * Etats du moniteur
 */
export const MONITOR_STATES = {
  STOPPED: "stopped",
  STARTING: "starting",
  RUNNING: "running",
  ERROR: "error"
};

/**
 * Types d'evenements
 */
export const NETWORK_EVENTS = {
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  TYPE_CHANGED: "type_changed",
  SERVER_REACHABLE: "server_reachable",
  SERVER_UNREACHABLE: "server_unreachable",
  PING_SUCCESS: "ping_success",
  PING_FAILED: "ping_failed"
};

// ============================================================================
// CLASSE NetworkMonitor
// ============================================================================

/**
 * Moniteur de reseau pour TailPOS
 */
export class NetworkMonitor {
  constructor() {
    /** @type {boolean} Connecte au reseau */
    this.isConnected = false;

    /** @type {string|null} Type de connexion actuel */
    this.connectionType = null;

    /** @type {boolean} Internet accessible */
    this.isInternetReachable = false;

    /** @type {boolean} Serveur ERPNext accessible */
    this.isServerReachable = false;

    /** @type {string|null} URL du serveur a surveiller */
    this.serverUrl = null;

    /** @type {string} Etat du moniteur */
    this.state = MONITOR_STATES.STOPPED;

    /** @type {Array<Function>} Listeners pour les evenements */
    this.listeners = [];

    /** @type {NodeJS.Timeout|null} Intervalle de ping */
    this.pingInterval = null;

    /** @type {number} Intervalle entre les pings (ms) */
    this.pingIntervalMs = DEFAULT_PING_INTERVAL;

    /** @type {Function|null} Unsubscribe de NetInfo */
    this.netInfoUnsubscribe = null;

    /** @type {Array<Object>} Historique des changements */
    this.history = [];

    /** @type {Object|null} Dernier resultat de ping */
    this.lastPingResult = null;

    /** @type {Date|null} Date du dernier ping reussi */
    this.lastSuccessfulPing = null;

    /** @type {number} Nombre de pings consecutifs echoues */
    this.consecutiveFailedPings = 0;

    /** @type {boolean} Mode debug */
    this.debugMode = false;

    /** @type {Object} Statistiques */
    this.stats = {
      totalPings: 0,
      successfulPings: 0,
      failedPings: 0,
      averageLatency: 0,
      latencies: []
    };
  }

  // ==========================================================================
  // DEMARRAGE ET ARRET
  // ==========================================================================

  /**
   * Demarrer la surveillance du reseau
   *
   * @param {string} serverUrl - URL du serveur ERPNext a surveiller
   * @param {Object} options - Options de configuration
   * @param {number} options.pingIntervalMs - Intervalle entre les pings
   * @param {boolean} options.debugMode - Activer les logs de debug
   * @returns {Promise<Object>} Statut initial
   */
  async start(serverUrl, options = {}) {
    if (this.state === MONITOR_STATES.RUNNING) {
      this.debugLog("Moniteur deja en cours d'execution");
      return this.getStatus();
    }

    this.state = MONITOR_STATES.STARTING;
    this.serverUrl = serverUrl;
    this.pingIntervalMs = options.pingIntervalMs || DEFAULT_PING_INTERVAL;
    this.debugMode = options.debugMode || false;

    this.debugLog(`Demarrage du moniteur reseau pour: ${serverUrl}`);

    try {
      // Verifier le statut reseau initial
      await this.checkNetworkState();

      // Configurer l'ecouteur NetInfo
      this.setupNetInfoListener();

      // Effectuer un ping initial si connecte
      if (this.isConnected) {
        await this.pingServer();
      }

      // Demarrer les pings periodiques
      this.startPingInterval();

      this.state = MONITOR_STATES.RUNNING;

      this.debugLog("Moniteur demarre avec succes");

      // Ajouter a l'historique
      this.addToHistory({
        event: "monitor_started",
        serverUrl,
        networkStatus: this.getNetworkStatus()
      });

      return this.getStatus();

    } catch (error) {
      this.state = MONITOR_STATES.ERROR;
      console.error("[NetworkMonitor] Erreur demarrage:", error);
      throw error;
    }
  }

  /**
   * Arreter la surveillance du reseau
   */
  stop() {
    this.debugLog("Arret du moniteur reseau");

    // Arreter les pings periodiques
    this.stopPingInterval();

    // Retirer l'ecouteur NetInfo
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    this.state = MONITOR_STATES.STOPPED;

    // Ajouter a l'historique
    this.addToHistory({
      event: "monitor_stopped"
    });

    // Notifier les listeners
    this.notifyListeners({
      type: "monitor_stopped"
    });
  }

  /**
   * Redemarrer la surveillance
   *
   * @returns {Promise<Object>} Nouveau statut
   */
  async restart() {
    const serverUrl = this.serverUrl;
    const options = {
      pingIntervalMs: this.pingIntervalMs,
      debugMode: this.debugMode
    };

    this.stop();
    await this.sleep(100);
    return await this.start(serverUrl, options);
  }

  // ==========================================================================
  // SURVEILLANCE RESEAU
  // ==========================================================================

  /**
   * Configurer l'ecouteur NetInfo
   */
  setupNetInfoListener() {
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      this.handleNetworkChange(state);
    });
  }

  /**
   * Gerer un changement de reseau
   *
   * @param {Object} state - Etat NetInfo
   */
  handleNetworkChange(state) {
    const wasConnected = this.isConnected;
    const previousType = this.connectionType;

    // Mettre a jour l'etat
    this.isConnected = state.isConnected;
    this.connectionType = state.type;
    this.isInternetReachable = state.isInternetReachable;

    this.debugLog(`Changement reseau: ${state.type}, connecte: ${state.isConnected}`);

    // Detecter les changements
    const connectionChanged = wasConnected !== this.isConnected;
    const typeChanged = previousType !== this.connectionType;

    if (connectionChanged || typeChanged) {
      // Ajouter a l'historique
      this.addToHistory({
        event: connectionChanged ?
          (this.isConnected ? NETWORK_EVENTS.CONNECTED : NETWORK_EVENTS.DISCONNECTED) :
          NETWORK_EVENTS.TYPE_CHANGED,
        previousType,
        currentType: this.connectionType,
        isConnected: this.isConnected
      });
    }

    // Notifier les listeners
    if (connectionChanged) {
      if (this.isConnected) {
        this.debugLog("Connexion retablie");
        this.notifyListeners({
          type: NETWORK_EVENTS.CONNECTED,
          connectionType: this.connectionType
        });

        // Lancer un ping immediat
        this.pingServer();

      } else {
        this.debugLog("Connexion perdue");
        this.isServerReachable = false;
        this.notifyListeners({
          type: NETWORK_EVENTS.DISCONNECTED
        });
      }
    }

    if (typeChanged && !connectionChanged) {
      this.notifyListeners({
        type: NETWORK_EVENTS.TYPE_CHANGED,
        previousType,
        currentType: this.connectionType
      });
    }
  }

  /**
   * Verifier l'etat reseau actuel
   *
   * @returns {Promise<Object>} Etat reseau
   */
  async checkNetworkState() {
    try {
      const state = await NetInfo.fetch();

      this.isConnected = state.isConnected;
      this.connectionType = state.type;
      this.isInternetReachable = state.isInternetReachable;

      this.debugLog(`Etat reseau: ${state.type}, connecte: ${state.isConnected}`);

      return {
        isConnected: this.isConnected,
        connectionType: this.connectionType,
        isInternetReachable: this.isInternetReachable
      };

    } catch (error) {
      console.error("[NetworkMonitor] Erreur verification reseau:", error);
      return {
        isConnected: false,
        connectionType: CONNECTION_TYPES.UNKNOWN,
        isInternetReachable: false
      };
    }
  }

  // ==========================================================================
  // PING DU SERVEUR
  // ==========================================================================

  /**
   * Demarrer les pings periodiques
   */
  startPingInterval() {
    this.stopPingInterval();

    this.pingInterval = setInterval(async () => {
      if (this.isConnected && this.serverUrl) {
        await this.pingServer();
      }
    }, this.pingIntervalMs);

    this.debugLog(`Pings periodiques demarres (intervalle: ${this.pingIntervalMs}ms)`);
  }

  /**
   * Arreter les pings periodiques
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Effectuer un ping vers le serveur ERPNext
   *
   * @param {string} url - URL du serveur (optionnel, utilise serverUrl par defaut)
   * @returns {Promise<Object>} Resultat du ping
   */
  async pingServer(url = null) {
    const targetUrl = url || this.serverUrl;

    if (!targetUrl) {
      return {
        success: false,
        error: "URL du serveur non configuree"
      };
    }

    const startTime = Date.now();
    this.stats.totalPings++;

    try {
      // Construire l'URL de ping (endpoint simple)
      const pingUrl = `${targetUrl}/api/method/frappe.auth.get_logged_user`;

      this.debugLog(`Ping vers: ${pingUrl}`);

      // Effectuer la requete avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT);

      const response = await fetch(pingUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;
      const success = response.status < 500; // Meme 401/403 signifie que le serveur repond

      // Mettre a jour les statistiques
      if (success) {
        this.stats.successfulPings++;
        this.stats.latencies.push(latency);

        // Garder les 100 dernieres latences
        if (this.stats.latencies.length > 100) {
          this.stats.latencies.shift();
        }

        // Calculer la latence moyenne
        this.stats.averageLatency = Math.round(
          this.stats.latencies.reduce((a, b) => a + b, 0) /
          this.stats.latencies.length
        );

        this.lastSuccessfulPing = new Date();
        this.consecutiveFailedPings = 0;
      } else {
        this.stats.failedPings++;
        this.consecutiveFailedPings++;
      }

      // Mettre a jour l'etat
      const wasReachable = this.isServerReachable;
      this.isServerReachable = success;

      this.lastPingResult = {
        success,
        latency,
        statusCode: response.status,
        timestamp: new Date().toISOString()
      };

      this.debugLog(`Ping ${success ? 'reussi' : 'echoue'}: ${latency}ms, status: ${response.status}`);

      // Notifier si le statut a change
      if (wasReachable !== this.isServerReachable) {
        this.addToHistory({
          event: success ? NETWORK_EVENTS.SERVER_REACHABLE : NETWORK_EVENTS.SERVER_UNREACHABLE,
          latency
        });

        this.notifyListeners({
          type: success ? NETWORK_EVENTS.SERVER_REACHABLE : NETWORK_EVENTS.SERVER_UNREACHABLE,
          latency
        });
      }

      // Notifier le resultat du ping
      this.notifyListeners({
        type: success ? NETWORK_EVENTS.PING_SUCCESS : NETWORK_EVENTS.PING_FAILED,
        latency,
        statusCode: response.status
      });

      return this.lastPingResult;

    } catch (error) {
      const latency = Date.now() - startTime;
      this.stats.failedPings++;
      this.consecutiveFailedPings++;

      const wasReachable = this.isServerReachable;
      this.isServerReachable = false;

      this.lastPingResult = {
        success: false,
        latency,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.debugLog(`Ping echoue: ${error.message}`);

      // Notifier si le statut a change
      if (wasReachable) {
        this.addToHistory({
          event: NETWORK_EVENTS.SERVER_UNREACHABLE,
          error: error.message
        });

        this.notifyListeners({
          type: NETWORK_EVENTS.SERVER_UNREACHABLE,
          error: error.message
        });
      }

      return this.lastPingResult;
    }
  }

  /**
   * Forcer un ping immediat
   *
   * @returns {Promise<Object>} Resultat du ping
   */
  async forcePing() {
    return await this.pingServer();
  }

  // ==========================================================================
  // LISTENERS
  // ==========================================================================

  /**
   * Ajouter un listener pour les evenements reseau
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
   * Retirer un listener
   *
   * @param {Function} callback - Listener a retirer
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  /**
   * Notifier tous les listeners
   *
   * @param {Object} event - Evenement a notifier
   */
  notifyListeners(event) {
    const eventWithStatus = {
      ...event,
      networkStatus: this.getNetworkStatus(),
      timestamp: new Date().toISOString()
    };

    this.listeners.forEach(callback => {
      try {
        callback(eventWithStatus);
      } catch (error) {
        console.error("[NetworkMonitor] Erreur dans listener:", error);
      }
    });
  }

  // ==========================================================================
  // HISTORIQUE
  // ==========================================================================

  /**
   * Ajouter une entree a l'historique
   *
   * @param {Object} entry - Entree a ajouter
   */
  addToHistory(entry) {
    this.history.push({
      ...entry,
      timestamp: new Date().toISOString()
    });

    // Limiter la taille de l'historique
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.shift();
    }
  }

  /**
   * Obtenir l'historique des evenements
   *
   * @param {number} limit - Nombre maximum d'entrees
   * @returns {Array} Historique
   */
  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  /**
   * Effacer l'historique
   */
  clearHistory() {
    this.history = [];
  }

  // ==========================================================================
  // STATUT ET INFORMATIONS
  // ==========================================================================

  /**
   * Obtenir le statut reseau actuel
   *
   * @returns {Object} Statut reseau
   */
  getNetworkStatus() {
    return {
      isConnected: this.isConnected,
      connectionType: this.connectionType,
      isInternetReachable: this.isInternetReachable,
      isServerReachable: this.isServerReachable
    };
  }

  /**
   * Obtenir le statut complet du moniteur
   *
   * @returns {Object} Statut complet
   */
  getStatus() {
    return {
      state: this.state,
      serverUrl: this.serverUrl,
      pingIntervalMs: this.pingIntervalMs,
      network: this.getNetworkStatus(),
      lastPingResult: this.lastPingResult,
      lastSuccessfulPing: this.lastSuccessfulPing?.toISOString() || null,
      consecutiveFailedPings: this.consecutiveFailedPings,
      stats: {
        ...this.stats,
        uptime: this.calculateUptime()
      }
    };
  }

  /**
   * Calculer le uptime (pourcentage de pings reussis)
   *
   * @returns {number} Pourcentage de uptime
   */
  calculateUptime() {
    if (this.stats.totalPings === 0) return 100;
    return Math.round(
      (this.stats.successfulPings / this.stats.totalPings) * 100
    );
  }

  /**
   * Verifier si le reseau est disponible
   *
   * @returns {boolean} True si connecte et internet accessible
   */
  isNetworkAvailable() {
    return this.isConnected && this.isInternetReachable;
  }

  /**
   * Verifier si le serveur est accessible
   *
   * @returns {boolean} True si serveur accessible
   */
  isServerAvailable() {
    return this.isNetworkAvailable() && this.isServerReachable;
  }

  /**
   * Obtenir le type de connexion en francais
   *
   * @returns {string} Type de connexion
   */
  getConnectionTypeLabel() {
    switch (this.connectionType) {
      case CONNECTION_TYPES.WIFI:
        return "WiFi";
      case CONNECTION_TYPES.CELLULAR:
        return "Donnees mobiles";
      case CONNECTION_TYPES.ETHERNET:
        return "Ethernet";
      case CONNECTION_TYPES.BLUETOOTH:
        return "Bluetooth";
      case CONNECTION_TYPES.VPN:
        return "VPN";
      case CONNECTION_TYPES.NONE:
        return "Non connecte";
      default:
        return "Inconnu";
    }
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
        console.log(`[NetworkMonitor] ${message}`, data);
      } else {
        console.log(`[NetworkMonitor] ${message}`);
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

  /**
   * Reinitialiser les statistiques
   */
  resetStats() {
    this.stats = {
      totalPings: 0,
      successfulPings: 0,
      failedPings: 0,
      averageLatency: 0,
      latencies: []
    };
    this.consecutiveFailedPings = 0;
    this.debugLog("Statistiques reinitialisees");
  }
}

// ============================================================================
// INSTANCE SINGLETON
// ============================================================================

/**
 * Instance singleton du moniteur reseau
 */
const networkMonitor = new NetworkMonitor();

// ============================================================================
// EXPORTS
// ============================================================================

export {
  networkMonitor,
  DEFAULT_PING_INTERVAL,
  PING_TIMEOUT,
  MAX_HISTORY_SIZE
};

export default networkMonitor;
