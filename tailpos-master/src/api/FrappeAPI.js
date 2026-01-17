/**
 * FrappeAPI.js
 *
 * Client API pour communiquer avec ERPNext via l'API REST standard de Frappe.
 * Ce module remplace les appels aux endpoints personnalises tailpos_sync
 * par les endpoints standard de Frappe/ERPNext.
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

import { NetInfo } from 'react-native';
import { API_ENDPOINTS } from './index';

// ============================================================================
// CLASSE D'ERREUR PERSONNALISEE
// ============================================================================

/**
 * Classe pour les erreurs API personnalisees
 * Permet de categoriser les types d'erreurs pour un meilleur traitement
 */
export class ApiError extends Error {
  constructor(message, code, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// Codes d'erreur
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',       // Pas de connexion internet
  AUTH_ERROR: 'AUTH_ERROR',             // Erreur d'authentification
  NOT_FOUND: 'NOT_FOUND',               // Ressource non trouvee
  SERVER_ERROR: 'SERVER_ERROR',         // Erreur serveur (5xx)
  VALIDATION_ERROR: 'VALIDATION_ERROR', // Erreur de validation des donnees
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',       // Timeout de la requete
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',       // Erreur inconnue
};

// ============================================================================
// CLASSE PRINCIPALE FRAPPEAPI
// ============================================================================

class FrappeAPI {
  constructor() {
    // Configuration du serveur
    this._serverUrl = '';
    this._username = '';
    this._password = '';

    // Session et authentification
    this._sessionCookies = '';
    this._isLoggedIn = false;
    this._currentUser = null;

    // Configuration des requetes
    this._timeout = 30000; // 30 secondes par defaut
    this._debugMode = false;

    // Headers par defaut
    this._defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  // ==========================================================================
  // A) CONFIGURATION ET INITIALISATION
  // ==========================================================================

  /**
   * Configure les parametres de connexion au serveur ERPNext
   * @param {string} url - URL du serveur (ex: https://erp.example.com)
   * @param {string} username - Nom d'utilisateur
   * @param {string} password - Mot de passe
   */
  setConfig(url, username, password) {
    // Normaliser l'URL (supprimer le slash final si present)
    this._serverUrl = url.replace(/\/$/, '');
    this._username = username;
    this._password = password;

    this._log('Configuration mise a jour', { url: this._serverUrl, username });
  }

  /**
   * Recupere la configuration actuelle
   * @returns {Object} Configuration (sans le mot de passe)
   */
  getConfig() {
    return {
      serverUrl: this._serverUrl,
      username: this._username,
      isLoggedIn: this._isLoggedIn,
      currentUser: this._currentUser,
    };
  }

  /**
   * Active ou desactive le mode debug
   * @param {boolean} enabled - Activer le debug
   */
  setDebugMode(enabled) {
    this._debugMode = enabled;
  }

  /**
   * Definit le timeout des requetes
   * @param {number} timeout - Timeout en millisecondes
   */
  setTimeout(timeout) {
    this._timeout = timeout;
  }

  // ==========================================================================
  // B) METHODES D'AUTHENTIFICATION
  // ==========================================================================

  /**
   * Connecte l'utilisateur au serveur ERPNext
   * @param {string} username - Nom d'utilisateur (optionnel si deja configure)
   * @param {string} password - Mot de passe (optionnel si deja configure)
   * @returns {Promise<Object>} Informations utilisateur
   * @throws {ApiError} En cas d'echec de connexion
   */
  async login(username = null, password = null) {
    const user = username || this._username;
    const pass = password || this._password;

    if (!user || !pass) {
      throw new ApiError(
        'Identifiants manquants',
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    this._log('Tentative de connexion', { username: user });

    try {
      const response = await this._request('POST', API_ENDPOINTS.LOGIN, {
        usr: user,
        pwd: pass,
      });

      // Sauvegarder les cookies de session depuis les headers
      if (response.headers && response.headers.get) {
        const cookies = response.headers.get('set-cookie');
        if (cookies) {
          this._sessionCookies = cookies;
        }
      }

      const data = await response.json();

      if (data.message === 'Logged In' || data.full_name) {
        this._isLoggedIn = true;
        this._currentUser = {
          username: user,
          fullName: data.full_name || user,
          message: data.message,
        };
        this._username = user;
        this._password = pass;

        this._log('Connexion reussie', this._currentUser);
        return this._currentUser;
      } else {
        throw new ApiError(
          data.message || 'Echec de la connexion',
          ERROR_CODES.AUTH_ERROR,
          data
        );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      this._log('Erreur de connexion', error);
      throw new ApiError(
        'Impossible de se connecter au serveur',
        ERROR_CODES.NETWORK_ERROR,
        error.message
      );
    }
  }

  /**
   * Deconnecte l'utilisateur du serveur ERPNext
   * @returns {Promise<boolean>} True si deconnexion reussie
   */
  async logout() {
    this._log('Tentative de deconnexion');

    try {
      await this._request('POST', API_ENDPOINTS.LOGOUT);

      // Effacer les donnees de session
      this._sessionCookies = '';
      this._isLoggedIn = false;
      this._currentUser = null;

      this._log('Deconnexion reussie');
      return true;
    } catch (error) {
      // Meme en cas d'erreur, on efface la session locale
      this._sessionCookies = '';
      this._isLoggedIn = false;
      this._currentUser = null;

      this._log('Erreur lors de la deconnexion', error);
      return false;
    }
  }

  /**
   * Verifie si l'utilisateur est actuellement connecte
   * @returns {Promise<boolean>} True si connecte
   */
  async isAuthenticated() {
    if (!this._isLoggedIn || !this._sessionCookies) {
      return false;
    }

    try {
      const response = await this._request('GET', API_ENDPOINTS.GET_LOGGED_USER);
      const data = await response.json();

      if (data.message && data.message !== 'Guest') {
        return true;
      }

      // Session expiree
      this._isLoggedIn = false;
      return false;
    } catch (error) {
      this._isLoggedIn = false;
      return false;
    }
  }

  // ==========================================================================
  // C) METHODES POUR LES PRODUITS/ITEMS
  // ==========================================================================

  /**
   * Recupere la liste des produits depuis ERPNext
   * @param {Object} filters - Filtres a appliquer (ex: {item_group: "Products"})
   * @param {Array} fields - Champs a recuperer
   * @param {number} limit - Nombre maximum de resultats
   * @param {number} start - Index de depart (pagination)
   * @returns {Promise<Array>} Liste des produits
   */
  async getItems(filters = {}, fields = null, limit = 100, start = 0) {
    this._log('Recuperation des items', { filters, limit, start });

    // Champs par defaut a recuperer
    const defaultFields = [
      'name',
      'item_code',
      'item_name',
      'description',
      'item_group',
      'stock_uom',
      'standard_rate',
      'image',
      'barcode',
      'disabled',
    ];

    const params = {
      fields: JSON.stringify(fields || defaultFields),
      limit_page_length: limit,
      limit_start: start,
    };

    // Ajouter les filtres si presents
    if (Object.keys(filters).length > 0) {
      const filterArray = Object.entries(filters).map(([key, value]) => {
        return [key, '=', value];
      });
      params.filters = JSON.stringify(filterArray);
    }

    // Filtrer les items actifs par defaut
    if (!filters.hasOwnProperty('disabled')) {
      params.filters = params.filters || '[]';
      const existingFilters = JSON.parse(params.filters);
      existingFilters.push(['disabled', '=', 0]);
      params.filters = JSON.stringify(existingFilters);
    }

    try {
      const response = await this._request('GET', API_ENDPOINTS.ITEM_LIST, null, params);
      const data = await response.json();

      this._log(`${data.data ? data.data.length : 0} items recuperes`);
      return data.data || [];
    } catch (error) {
      this._log('Erreur recuperation items', error);
      throw new ApiError(
        'Impossible de recuperer les produits',
        ERROR_CODES.SERVER_ERROR,
        error.message
      );
    }
  }

  /**
   * Recupere les details d'un produit specifique par son code
   * @param {string} itemCode - Code de l'article
   * @returns {Promise<Object>} Details du produit
   */
  async getItemByCode(itemCode) {
    this._log('Recuperation item par code', { itemCode });

    try {
      const response = await this._request(
        'GET',
        `${API_ENDPOINTS.ITEM_DETAIL}${encodeURIComponent(itemCode)}`
      );
      const data = await response.json();

      if (data.data) {
        return data.data;
      }

      throw new ApiError(
        `Produit ${itemCode} non trouve`,
        ERROR_CODES.NOT_FOUND
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Erreur lors de la recuperation du produit ${itemCode}`,
        ERROR_CODES.SERVER_ERROR,
        error.message
      );
    }
  }

  /**
   * Recherche un produit par son code-barres
   * @param {string} barcode - Code-barres a rechercher
   * @returns {Promise<Object|null>} Produit trouve ou null
   */
  async getItemByBarcode(barcode) {
    this._log('Recherche item par code-barres', { barcode });

    try {
      // Rechercher dans la table Item Barcode
      const params = {
        fields: JSON.stringify(['name', 'item_code', 'item_name', 'standard_rate', 'stock_uom', 'image']),
        filters: JSON.stringify([['barcode', '=', barcode]]),
        limit_page_length: 1,
      };

      const response = await this._request('GET', API_ENDPOINTS.ITEM_LIST, null, params);
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        this._log('Item trouve par code-barres', data.data[0]);
        return data.data[0];
      }

      // Si pas trouve, essayer la recherche dans Item Barcode doctype
      const barcodeParams = {
        doctype: 'Item Barcode',
        filters: JSON.stringify([['barcode', '=', barcode]]),
        fields: JSON.stringify(['parent']),
      };

      const barcodeResponse = await this._request(
        'GET',
        API_ENDPOINTS.GET_LIST,
        null,
        barcodeParams
      );
      const barcodeData = await barcodeResponse.json();

      if (barcodeData.message && barcodeData.message.length > 0) {
        // Recuperer l'item associe
        return await this.getItemByCode(barcodeData.message[0].parent);
      }

      this._log('Aucun item trouve pour ce code-barres');
      return null;
    } catch (error) {
      this._log('Erreur recherche par code-barres', error);
      return null;
    }
  }

  /**
   * Recupere les groupes d'articles (categories)
   * @param {number} limit - Nombre maximum de resultats
   * @returns {Promise<Array>} Liste des groupes
   */
  async getItemGroups(limit = 100) {
    this._log('Recuperation des groupes d\'articles');

    try {
      const params = {
        fields: JSON.stringify(['name', 'parent_item_group', 'is_group', 'image']),
        limit_page_length: limit,
      };

      const response = await this._request('GET', API_ENDPOINTS.ITEM_GROUP_LIST, null, params);
      const data = await response.json();

      return data.data || [];
    } catch (error) {
      this._log('Erreur recuperation groupes', error);
      throw new ApiError(
        'Impossible de recuperer les categories',
        ERROR_CODES.SERVER_ERROR,
        error.message
      );
    }
  }

  // ==========================================================================
  // D) METHODES POUR LE STOCK
  // ==========================================================================

  /**
   * Recupere le solde de stock pour un article dans un entrepot
   * @param {string} itemCode - Code de l'article
   * @param {string} warehouse - Nom de l'entrepot
   * @returns {Promise<number>} Quantite en stock
   */
  async getStockBalance(itemCode, warehouse) {
    this._log('Recuperation solde stock', { itemCode, warehouse });

    try {
      const params = {
        item_code: itemCode,
        warehouse: warehouse,
      };

      const response = await this._request('GET', API_ENDPOINTS.STOCK_BALANCE, null, params);
      const data = await response.json();

      // La reponse contient le solde dans message
      const balance = data.message || 0;
      this._log(`Stock pour ${itemCode}: ${balance}`);

      return parseFloat(balance) || 0;
    } catch (error) {
      this._log('Erreur recuperation stock', error);
      return 0;
    }
  }

  /**
   * Recupere le stock de tous les articles d'un entrepot
   * @param {string} warehouse - Nom de l'entrepot
   * @param {number} limit - Limite de resultats
   * @returns {Promise<Array>} Liste des stocks par article
   */
  async getStockForAllItems(warehouse, limit = 500) {
    this._log('Recuperation stock pour tous les items', { warehouse });

    try {
      const params = {
        fields: JSON.stringify(['item_code', 'warehouse', 'actual_qty', 'projected_qty']),
        filters: JSON.stringify([['warehouse', '=', warehouse]]),
        limit_page_length: limit,
      };

      const response = await this._request('GET', '/api/resource/Bin', null, params);
      const data = await response.json();

      return data.data || [];
    } catch (error) {
      this._log('Erreur recuperation stock global', error);
      return [];
    }
  }

  // ==========================================================================
  // E) METHODES POUR LES VENTES/POS
  // ==========================================================================

  /**
   * Cree une facture POS dans ERPNext
   * @param {Object} invoiceData - Donnees de la facture
   * @returns {Promise<Object>} Facture creee
   */
  async createPOSInvoice(invoiceData) {
    this._log('Creation facture POS', invoiceData);

    // Validation des donnees requises
    if (!invoiceData.customer) {
      throw new ApiError(
        'Le client est requis pour creer une facture',
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (!invoiceData.items || invoiceData.items.length === 0) {
      throw new ApiError(
        'Au moins un article est requis',
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    try {
      // Construire l'objet facture POS
      const posInvoice = {
        doctype: 'POS Invoice',
        customer: invoiceData.customer,
        posting_date: invoiceData.posting_date || this._getCurrentDate(),
        posting_time: invoiceData.posting_time || this._getCurrentTime(),
        pos_profile: invoiceData.pos_profile || '',
        is_pos: 1,
        update_stock: 1,
        items: invoiceData.items.map(item => ({
          item_code: item.item_code,
          qty: item.qty || 1,
          rate: item.rate || item.price,
          amount: item.amount || (item.qty * (item.rate || item.price)),
          warehouse: item.warehouse || invoiceData.warehouse,
        })),
        payments: invoiceData.payments || [{
          mode_of_payment: 'Cash',
          amount: invoiceData.grand_total || this._calculateTotal(invoiceData.items),
        }],
      };

      // Ajouter les taxes si presentes
      if (invoiceData.taxes && invoiceData.taxes.length > 0) {
        posInvoice.taxes = invoiceData.taxes;
      }

      // Ajouter la remise si presente
      if (invoiceData.discount_amount) {
        posInvoice.discount_amount = invoiceData.discount_amount;
      }

      const response = await this._request('POST', API_ENDPOINTS.POS_INVOICE, posInvoice);
      const data = await response.json();

      if (data.data) {
        this._log('Facture POS creee', data.data.name);
        return data.data;
      }

      throw new ApiError(
        'Erreur lors de la creation de la facture',
        ERROR_CODES.SERVER_ERROR,
        data
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      this._log('Erreur creation facture POS', error);
      throw new ApiError(
        'Impossible de creer la facture POS',
        ERROR_CODES.SERVER_ERROR,
        error.message
      );
    }
  }

  /**
   * Soumet une facture POS (la valide)
   * @param {string} invoiceName - Nom de la facture
   * @returns {Promise<Object>} Facture soumise
   */
  async submitPOSInvoice(invoiceName) {
    this._log('Soumission facture POS', { invoiceName });

    try {
      const response = await this._request(
        'POST',
        '/api/method/frappe.client.submit',
        {
          doc: {
            doctype: 'POS Invoice',
            name: invoiceName,
          },
        }
      );
      const data = await response.json();

      return data.message || data.data;
    } catch (error) {
      this._log('Erreur soumission facture', error);
      throw new ApiError(
        'Impossible de soumettre la facture',
        ERROR_CODES.SERVER_ERROR,
        error.message
      );
    }
  }

  /**
   * Recupere le profil POS actif pour l'utilisateur
   * @returns {Promise<Object|null>} Profil POS ou null
   */
  async getPOSProfile() {
    this._log('Recuperation profil POS');

    try {
      const params = {
        fields: JSON.stringify(['name', 'warehouse', 'company', 'currency', 'write_off_account']),
        filters: JSON.stringify([['disabled', '=', 0]]),
        limit_page_length: 1,
      };

      const response = await this._request('GET', API_ENDPOINTS.POS_PROFILE, null, params);
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        return data.data[0];
      }

      return null;
    } catch (error) {
      this._log('Erreur recuperation profil POS', error);
      return null;
    }
  }

  /**
   * Verifie si une session POS est ouverte
   * @returns {Promise<Object|null>} Session POS ou null
   */
  async getPOSOpeningEntry() {
    this._log('Verification session POS ouverte');

    try {
      const params = {
        fields: JSON.stringify(['name', 'pos_profile', 'user', 'posting_date']),
        filters: JSON.stringify([
          ['status', '=', 'Open'],
          ['docstatus', '=', 1],
        ]),
        limit_page_length: 1,
      };

      const response = await this._request('GET', '/api/resource/POS Opening Entry', null, params);
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        return data.data[0];
      }

      return null;
    } catch (error) {
      this._log('Erreur verification session POS', error);
      return null;
    }
  }

  // ==========================================================================
  // F) METHODES POUR LES CLIENTS
  // ==========================================================================

  /**
   * Recupere la liste des clients
   * @param {Object} filters - Filtres a appliquer
   * @param {number} limit - Nombre maximum de resultats
   * @returns {Promise<Array>} Liste des clients
   */
  async getCustomers(filters = {}, limit = 100) {
    this._log('Recuperation des clients', { filters, limit });

    try {
      const params = {
        fields: JSON.stringify([
          'name',
          'customer_name',
          'customer_type',
          'customer_group',
          'territory',
          'mobile_no',
          'email_id',
        ]),
        limit_page_length: limit,
      };

      if (Object.keys(filters).length > 0) {
        const filterArray = Object.entries(filters).map(([key, value]) => {
          return [key, '=', value];
        });
        params.filters = JSON.stringify(filterArray);
      }

      const response = await this._request('GET', API_ENDPOINTS.CUSTOMER_LIST, null, params);
      const data = await response.json();

      return data.data || [];
    } catch (error) {
      this._log('Erreur recuperation clients', error);
      throw new ApiError(
        'Impossible de recuperer les clients',
        ERROR_CODES.SERVER_ERROR,
        error.message
      );
    }
  }

  /**
   * Recupere les details d'un client specifique
   * @param {string} customerName - Nom du client
   * @returns {Promise<Object>} Details du client
   */
  async getCustomerByName(customerName) {
    this._log('Recuperation client', { customerName });

    try {
      const response = await this._request(
        'GET',
        `${API_ENDPOINTS.CUSTOMER_DETAIL}${encodeURIComponent(customerName)}`
      );
      const data = await response.json();

      if (data.data) {
        return data.data;
      }

      throw new ApiError(
        `Client ${customerName} non trouve`,
        ERROR_CODES.NOT_FOUND
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        `Erreur lors de la recuperation du client ${customerName}`,
        ERROR_CODES.SERVER_ERROR,
        error.message
      );
    }
  }

  /**
   * Cree un nouveau client dans ERPNext
   * @param {Object} customerData - Donnees du client
   * @returns {Promise<Object>} Client cree
   */
  async createCustomer(customerData) {
    this._log('Creation client', customerData);

    // Validation
    if (!customerData.customer_name) {
      throw new ApiError(
        'Le nom du client est requis',
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    try {
      const customer = {
        doctype: 'Customer',
        customer_name: customerData.customer_name,
        customer_type: customerData.customer_type || 'Individual',
        customer_group: customerData.customer_group || 'All Customer Groups',
        territory: customerData.territory || 'All Territories',
        mobile_no: customerData.mobile_no || customerData.phone || '',
        email_id: customerData.email_id || customerData.email || '',
      };

      const response = await this._request('POST', API_ENDPOINTS.CUSTOMER_LIST, customer);
      const data = await response.json();

      if (data.data) {
        this._log('Client cree', data.data.name);
        return data.data;
      }

      throw new ApiError(
        'Erreur lors de la creation du client',
        ERROR_CODES.SERVER_ERROR,
        data
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      this._log('Erreur creation client', error);
      throw new ApiError(
        'Impossible de creer le client',
        ERROR_CODES.SERVER_ERROR,
        error.message
      );
    }
  }

  // ==========================================================================
  // G) METHODE GENERIQUE DE REQUETE
  // ==========================================================================

  /**
   * Methode de base pour effectuer toutes les requetes HTTP
   * @param {string} method - Methode HTTP (GET, POST, PUT, DELETE)
   * @param {string} endpoint - Endpoint API
   * @param {Object} data - Donnees a envoyer (POST/PUT)
   * @param {Object} params - Parametres URL (GET)
   * @returns {Promise<Response>} Reponse fetch
   */
  async _request(method, endpoint, data = null, params = null) {
    // Verifier la connexion reseau
    const isConnected = await this._checkNetwork();
    if (!isConnected) {
      throw new ApiError(
        'Pas de connexion internet',
        ERROR_CODES.NETWORK_ERROR
      );
    }

    // Construire l'URL
    let url = `${this._serverUrl}${endpoint}`;

    // Ajouter les parametres GET
    if (params && Object.keys(params).length > 0) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');
      url += `?${queryString}`;
    }

    // Preparer les headers
    const headers = { ...this._defaultHeaders };

    // Ajouter les cookies de session si presents
    if (this._sessionCookies) {
      headers['Cookie'] = this._sessionCookies;
    }

    // Preparer les options de la requete
    const options = {
      method,
      headers,
      credentials: 'include', // Inclure les cookies
    };

    // Ajouter le body pour POST/PUT
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    this._log(`Requete ${method}`, { url, data });

    try {
      // Executer la requete avec timeout
      const response = await this._fetchWithTimeout(url, options, this._timeout);

      // Verifier le code de statut HTTP
      if (!response.ok) {
        await this._handleHttpError(response);
      }

      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new ApiError(
          'La requete a expire',
          ERROR_CODES.TIMEOUT_ERROR
        );
      }

      throw new ApiError(
        error.message || 'Erreur reseau',
        ERROR_CODES.NETWORK_ERROR,
        error
      );
    }
  }

  /**
   * Execute une requete fetch avec timeout
   * @param {string} url - URL de la requete
   * @param {Object} options - Options fetch
   * @param {number} timeout - Timeout en ms
   * @returns {Promise<Response>} Reponse
   */
  async _fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  /**
   * Gere les erreurs HTTP
   * @param {Response} response - Reponse HTTP
   */
  async _handleHttpError(response) {
    let errorMessage = `Erreur HTTP ${response.status}`;
    let errorCode = ERROR_CODES.SERVER_ERROR;
    let details = null;

    try {
      const errorData = await response.json();
      details = errorData;

      if (errorData.message) {
        errorMessage = errorData.message;
      } else if (errorData._server_messages) {
        const messages = JSON.parse(errorData._server_messages);
        errorMessage = messages[0] || errorMessage;
      }
    } catch (e) {
      // Pas de JSON dans la reponse
    }

    switch (response.status) {
      case 401:
      case 403:
        errorCode = ERROR_CODES.AUTH_ERROR;
        errorMessage = 'Session expiree ou acces refuse';
        this._isLoggedIn = false;
        break;
      case 404:
        errorCode = ERROR_CODES.NOT_FOUND;
        break;
      case 417:
        errorCode = ERROR_CODES.VALIDATION_ERROR;
        break;
      case 500:
      case 502:
      case 503:
        errorCode = ERROR_CODES.SERVER_ERROR;
        errorMessage = 'Le serveur a rencontre une erreur';
        break;
    }

    throw new ApiError(errorMessage, errorCode, details);
  }

  // ==========================================================================
  // H) METHODES UTILITAIRES
  // ==========================================================================

  /**
   * Verifie la connexion reseau
   * @returns {Promise<boolean>} True si connecte
   */
  async _checkNetwork() {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected;
    } catch (error) {
      // Si NetInfo echoue, on suppose qu'on est connecte
      return true;
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
        console.log(`[FrappeAPI ${timestamp}] ${message}:`, data);
      } else {
        console.log(`[FrappeAPI ${timestamp}] ${message}`);
      }
    }
  }

  /**
   * Retourne la date actuelle au format ERPNext
   * @returns {string} Date au format YYYY-MM-DD
   */
  _getCurrentDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Retourne l'heure actuelle au format ERPNext
   * @returns {string} Heure au format HH:MM:SS
   */
  _getCurrentTime() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  }

  /**
   * Calcule le total d'une liste d'items
   * @param {Array} items - Liste des items
   * @returns {number} Total
   */
  _calculateTotal(items) {
    return items.reduce((total, item) => {
      const qty = item.qty || 1;
      const rate = item.rate || item.price || 0;
      return total + (qty * rate);
    }, 0);
  }
}

// Exporter une instance unique (singleton)
const frappeAPI = new FrappeAPI();
export default frappeAPI;

// Exporter aussi la classe pour les tests
export { FrappeAPI };
