/**
 * ApiConfig.js
 *
 * Gestion de la configuration pour la connexion a ERPNext.
 * Ce module gere la sauvegarde, le chargement et la validation
 * de la configuration API.
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

import { AsyncStorage } from 'react-native';

// ============================================================================
// CONSTANTES DE CONFIGURATION PAR DEFAUT
// ============================================================================

// Cle de stockage AsyncStorage
export const STORAGE_KEY = '@TailPOS:ApiConfig';

// Timeout par defaut pour les requetes (30 secondes)
export const DEFAULT_TIMEOUT = 30000;

// Entrepot par defaut (a modifier selon votre configuration ERPNext)
export const DEFAULT_WAREHOUSE = 'Stores - TC';

// Liste de prix par defaut
export const DEFAULT_PRICE_LIST = 'Standard Selling';

// Intervalle de synchronisation par defaut (5 minutes)
export const SYNC_INTERVAL = 300000;

// Intervalle de synchronisation en arriere-plan (1 minute)
export const BACKGROUND_SYNC_INTERVAL = 60000;

// Nombre maximum de tentatives de synchronisation
export const MAX_SYNC_RETRIES = 3;

// Delai entre les tentatives de synchronisation (en ms)
export const SYNC_RETRY_DELAY = 5000;

// Taille maximale de la queue offline
export const MAX_OFFLINE_QUEUE_SIZE = 1000;

// ============================================================================
// CLASSE DE CONFIGURATION
// ============================================================================

class ApiConfig {
  constructor() {
    // Configuration du serveur
    this._serverUrl = '';
    this._username = '';
    this._password = '';

    // Configuration ERPNext
    this._warehouse = DEFAULT_WAREHOUSE;
    this._priceList = DEFAULT_PRICE_LIST;
    this._company = '';
    this._posProfile = '';

    // Configuration de synchronisation
    this._syncInterval = SYNC_INTERVAL;
    this._backgroundSyncEnabled = true;

    // Modes de fonctionnement
    this._offlineMode = false;
    this._debugMode = false;

    // Etat de la configuration
    this._isConfigured = false;
    this._lastLoadTime = null;
  }

  // ==========================================================================
  // GETTERS ET SETTERS
  // ==========================================================================

  get serverUrl() {
    return this._serverUrl;
  }

  set serverUrl(value) {
    // Normaliser l'URL (supprimer le slash final)
    this._serverUrl = value ? value.replace(/\/$/, '') : '';
  }

  get username() {
    return this._username;
  }

  set username(value) {
    this._username = value || '';
  }

  get password() {
    return this._password;
  }

  set password(value) {
    this._password = value || '';
  }

  get warehouse() {
    return this._warehouse;
  }

  set warehouse(value) {
    this._warehouse = value || DEFAULT_WAREHOUSE;
  }

  get priceList() {
    return this._priceList;
  }

  set priceList(value) {
    this._priceList = value || DEFAULT_PRICE_LIST;
  }

  get company() {
    return this._company;
  }

  set company(value) {
    this._company = value || '';
  }

  get posProfile() {
    return this._posProfile;
  }

  set posProfile(value) {
    this._posProfile = value || '';
  }

  get syncInterval() {
    return this._syncInterval;
  }

  set syncInterval(value) {
    this._syncInterval = value > 0 ? value : SYNC_INTERVAL;
  }

  get backgroundSyncEnabled() {
    return this._backgroundSyncEnabled;
  }

  set backgroundSyncEnabled(value) {
    this._backgroundSyncEnabled = Boolean(value);
  }

  get offlineMode() {
    return this._offlineMode;
  }

  set offlineMode(value) {
    this._offlineMode = Boolean(value);
  }

  get debugMode() {
    return this._debugMode;
  }

  set debugMode(value) {
    this._debugMode = Boolean(value);
  }

  get isConfigured() {
    return this._isConfigured;
  }

  // ==========================================================================
  // METHODES PRINCIPALES
  // ==========================================================================

  /**
   * Sauvegarde la configuration dans AsyncStorage
   * @param {Object} config - Configuration a sauvegarder
   * @returns {Promise<boolean>} True si sauvegarde reussie
   */
  async saveConfig(config) {
    this._log('Sauvegarde de la configuration');

    try {
      // Valider la configuration avant de sauvegarder
      const validationResult = this.validateConfig(config);
      if (!validationResult.isValid) {
        this._log('Configuration invalide', validationResult.errors);
        return false;
      }

      // Mettre a jour les proprietes locales
      if (config.serverUrl !== undefined) this.serverUrl = config.serverUrl;
      if (config.username !== undefined) this.username = config.username;
      if (config.password !== undefined) this.password = config.password;
      if (config.warehouse !== undefined) this.warehouse = config.warehouse;
      if (config.priceList !== undefined) this.priceList = config.priceList;
      if (config.company !== undefined) this.company = config.company;
      if (config.posProfile !== undefined) this.posProfile = config.posProfile;
      if (config.syncInterval !== undefined) this.syncInterval = config.syncInterval;
      if (config.backgroundSyncEnabled !== undefined) this.backgroundSyncEnabled = config.backgroundSyncEnabled;
      if (config.offlineMode !== undefined) this.offlineMode = config.offlineMode;
      if (config.debugMode !== undefined) this.debugMode = config.debugMode;

      // Creer l'objet a sauvegarder
      // Note: Le mot de passe est encode en base64 (pas securise, mais mieux que rien)
      const configToSave = {
        serverUrl: this._serverUrl,
        username: this._username,
        password: this._encodePassword(this._password),
        warehouse: this._warehouse,
        priceList: this._priceList,
        company: this._company,
        posProfile: this._posProfile,
        syncInterval: this._syncInterval,
        backgroundSyncEnabled: this._backgroundSyncEnabled,
        offlineMode: this._offlineMode,
        debugMode: this._debugMode,
        savedAt: new Date().toISOString(),
        version: '2.0.0',
      };

      // Sauvegarder dans AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));

      this._isConfigured = true;
      this._log('Configuration sauvegardee avec succes');

      return true;
    } catch (error) {
      this._log('Erreur lors de la sauvegarde', error);
      return false;
    }
  }

  /**
   * Charge la configuration depuis AsyncStorage
   * @returns {Promise<Object|null>} Configuration chargee ou null
   */
  async loadConfig() {
    this._log('Chargement de la configuration');

    try {
      const configString = await AsyncStorage.getItem(STORAGE_KEY);

      if (!configString) {
        this._log('Aucune configuration trouvee');
        this._isConfigured = false;
        return null;
      }

      const config = JSON.parse(configString);

      // Restaurer les proprietes
      this.serverUrl = config.serverUrl || '';
      this.username = config.username || '';
      this.password = this._decodePassword(config.password || '');
      this.warehouse = config.warehouse || DEFAULT_WAREHOUSE;
      this.priceList = config.priceList || DEFAULT_PRICE_LIST;
      this.company = config.company || '';
      this.posProfile = config.posProfile || '';
      this.syncInterval = config.syncInterval || SYNC_INTERVAL;
      this.backgroundSyncEnabled = config.backgroundSyncEnabled !== false;
      this.offlineMode = config.offlineMode || false;
      this.debugMode = config.debugMode || false;

      this._isConfigured = Boolean(this._serverUrl && this._username);
      this._lastLoadTime = new Date();

      this._log('Configuration chargee', {
        serverUrl: this._serverUrl,
        username: this._username,
        warehouse: this._warehouse,
        isConfigured: this._isConfigured,
      });

      return this.getConfig();
    } catch (error) {
      this._log('Erreur lors du chargement', error);
      this._isConfigured = false;
      return null;
    }
  }

  /**
   * Valide la configuration fournie
   * @param {Object} config - Configuration a valider
   * @returns {Object} Resultat de la validation {isValid, errors}
   */
  validateConfig(config) {
    const errors = [];

    // Verifier l'URL du serveur
    if (config.serverUrl !== undefined) {
      if (!config.serverUrl || config.serverUrl.trim() === '') {
        errors.push('L\'URL du serveur est requise');
      } else if (!this._isValidUrl(config.serverUrl)) {
        errors.push('L\'URL du serveur n\'est pas valide');
      }
    }

    // Verifier le nom d'utilisateur
    if (config.username !== undefined) {
      if (!config.username || config.username.trim() === '') {
        errors.push('Le nom d\'utilisateur est requis');
      }
    }

    // Verifier le mot de passe
    if (config.password !== undefined) {
      if (!config.password || config.password.trim() === '') {
        errors.push('Le mot de passe est requis');
      }
    }

    // Verifier l'intervalle de synchronisation
    if (config.syncInterval !== undefined) {
      if (config.syncInterval < 10000) {
        errors.push('L\'intervalle de synchronisation doit etre d\'au moins 10 secondes');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Efface completement la configuration
   * @returns {Promise<boolean>} True si effacement reussi
   */
  async clearConfig() {
    this._log('Effacement de la configuration');

    try {
      // Effacer de AsyncStorage
      await AsyncStorage.removeItem(STORAGE_KEY);

      // Reinitialiser les proprietes
      this._serverUrl = '';
      this._username = '';
      this._password = '';
      this._warehouse = DEFAULT_WAREHOUSE;
      this._priceList = DEFAULT_PRICE_LIST;
      this._company = '';
      this._posProfile = '';
      this._syncInterval = SYNC_INTERVAL;
      this._backgroundSyncEnabled = true;
      this._offlineMode = false;
      this._debugMode = false;
      this._isConfigured = false;

      this._log('Configuration effacee');
      return true;
    } catch (error) {
      this._log('Erreur lors de l\'effacement', error);
      return false;
    }
  }

  /**
   * Verifie si la configuration est complete et valide
   * @returns {boolean} True si configure
   */
  isFullyConfigured() {
    return Boolean(
      this._serverUrl &&
      this._username &&
      this._password &&
      this._isConfigured
    );
  }

  /**
   * Retourne la configuration actuelle (sans le mot de passe en clair)
   * @returns {Object} Configuration actuelle
   */
  getConfig() {
    return {
      serverUrl: this._serverUrl,
      username: this._username,
      hasPassword: Boolean(this._password),
      warehouse: this._warehouse,
      priceList: this._priceList,
      company: this._company,
      posProfile: this._posProfile,
      syncInterval: this._syncInterval,
      backgroundSyncEnabled: this._backgroundSyncEnabled,
      offlineMode: this._offlineMode,
      debugMode: this._debugMode,
      isConfigured: this._isConfigured,
    };
  }

  /**
   * Retourne la configuration complete (incluant le mot de passe)
   * A utiliser avec precaution
   * @returns {Object} Configuration complete
   */
  getFullConfig() {
    return {
      ...this.getConfig(),
      password: this._password,
    };
  }

  /**
   * Met a jour partiellement la configuration
   * @param {Object} updates - Proprietes a mettre a jour
   * @returns {Promise<boolean>} True si mise a jour reussie
   */
  async updateConfig(updates) {
    const currentConfig = this.getFullConfig();
    const newConfig = { ...currentConfig, ...updates };
    return await this.saveConfig(newConfig);
  }

  // ==========================================================================
  // METHODES UTILITAIRES
  // ==========================================================================

  /**
   * Verifie si une URL est valide
   * @param {string} url - URL a verifier
   * @returns {boolean} True si valide
   */
  _isValidUrl(url) {
    try {
      // Verifier le format basique
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return false;
      }

      // Essayer de creer un objet URL
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Encode le mot de passe en base64
   * Note: Ce n'est pas une solution de securite, juste une obfuscation basique
   * @param {string} password - Mot de passe en clair
   * @returns {string} Mot de passe encode
   */
  _encodePassword(password) {
    if (!password) return '';
    try {
      // Utiliser btoa ou une alternative pour React Native
      return Buffer.from(password).toString('base64');
    } catch (e) {
      // Fallback si Buffer n'est pas disponible
      return password;
    }
  }

  /**
   * Decode le mot de passe depuis base64
   * @param {string} encoded - Mot de passe encode
   * @returns {string} Mot de passe en clair
   */
  _decodePassword(encoded) {
    if (!encoded) return '';
    try {
      return Buffer.from(encoded, 'base64').toString('utf8');
    } catch (e) {
      // Fallback si Buffer n'est pas disponible
      return encoded;
    }
  }

  /**
   * Affiche un log en mode debug
   * @param {string} message - Message a afficher
   * @param {any} data - Donnees supplementaires
   */
  _log(message, data = null) {
    if (this._debugMode) {
      const timestamp = new Date().toISOString();
      if (data) {
        console.log(`[ApiConfig ${timestamp}] ${message}:`, data);
      } else {
        console.log(`[ApiConfig ${timestamp}] ${message}`);
      }
    }
  }

  // ==========================================================================
  // METHODES STATIQUES DE VALIDATION
  // ==========================================================================

  /**
   * Valide le format d'une URL de serveur
   * @param {string} url - URL a valider
   * @returns {Object} {isValid, message}
   */
  static validateServerUrl(url) {
    if (!url || url.trim() === '') {
      return { isValid: false, message: 'L\'URL est requise' };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { isValid: false, message: 'L\'URL doit commencer par http:// ou https://' };
    }

    try {
      new URL(url);
      return { isValid: true, message: 'URL valide' };
    } catch (e) {
      return { isValid: false, message: 'Format d\'URL invalide' };
    }
  }

  /**
   * Valide les identifiants
   * @param {string} username - Nom d'utilisateur
   * @param {string} password - Mot de passe
   * @returns {Object} {isValid, message}
   */
  static validateCredentials(username, password) {
    if (!username || username.trim() === '') {
      return { isValid: false, message: 'Le nom d\'utilisateur est requis' };
    }

    if (!password || password.trim() === '') {
      return { isValid: false, message: 'Le mot de passe est requis' };
    }

    if (password.length < 4) {
      return { isValid: false, message: 'Le mot de passe est trop court' };
    }

    return { isValid: true, message: 'Identifiants valides' };
  }
}

// Exporter une instance unique (singleton)
const apiConfig = new ApiConfig();
export default apiConfig;

// Exporter aussi la classe pour les tests
export { ApiConfig };
