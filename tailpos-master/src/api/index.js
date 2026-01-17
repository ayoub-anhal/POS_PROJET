/**
 * TailPOS API Module
 *
 * Ce module fournit une couche d'abstraction pour communiquer avec ERPNext
 * en utilisant l'API REST standard de Frappe au lieu des endpoints personnalises.
 *
 * Fichiers dans ce module:
 * - FrappeAPI.js       : Client API principal pour ERPNext
 * - ApiConfig.js       : Gestion de la configuration (URL, credentials)
 * - SyncService.js     : Service de synchronisation bidirectionnelle
 * - DataMapper.js      : Transformation des donnees entre TailPOS et ERPNext
 * - DataValidator.js   : Validation des donnees et schemas
 * - OfflineQueue.js    : Gestion de la queue hors ligne (Phase 6)
 * - NetworkMonitor.js  : Surveillance du reseau (Phase 6)
 * - dependencies.js    : Verification des dependances (Phase 7)
 * - TestConnection.js  : Tests de connexion (Phase 8)
 * - TestSuite.js       : Suite de tests integree (Phase 8)
 *
 * @author TailPOS Integration
 * @version 2.3.0
 * @date 2025-01-17
 */

// ============================================================================
// VERIFICATION DES DEPENDANCES (Phase 7)
// ============================================================================

import {
  checkDependencies,
  logDependencyStatus,
  getQuickStatus,
  checkReactNativeCompatibility,
  REQUIRED_DEPENDENCIES,
  REACT_NATIVE_INCLUDED
} from './dependencies';

// Verifier les dependances au chargement du module (en mode dev)
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const depStatus = checkDependencies();
  if (!depStatus.allRequiredPresent) {
    console.warn('[TailPOS API] ATTENTION: ' + depStatus.message);
  }
}

// ============================================================================
// EXPORTS DES MODULES API
// ============================================================================

// Client API principal - Gere toutes les communications avec ERPNext
export { default as FrappeAPI, ApiError, ERROR_CODES, FrappeAPI as FrappeAPIClass } from './FrappeAPI';

// Configuration API - Gestion des parametres de connexion
export {
  default as ApiConfig,
  ApiConfig as ApiConfigClass,
  STORAGE_KEY,
  DEFAULT_TIMEOUT,
  DEFAULT_WAREHOUSE,
  DEFAULT_PRICE_LIST,
  SYNC_INTERVAL,
  BACKGROUND_SYNC_INTERVAL,
  MAX_SYNC_RETRIES,
  SYNC_RETRY_DELAY,
  MAX_OFFLINE_QUEUE_SIZE,
} from './ApiConfig';

// Service de synchronisation - Gere la sync bidirectionnelle
export {
  default as SyncService,
  SyncService as SyncServiceClass,
  SYNC_TYPES,
  SYNC_STATUS,
  QUEUE_OPERATION_TYPES,
} from './SyncService';

// ============================================================================
// EXPORTS PHASE 5: DATA MAPPING ET VALIDATION
// ============================================================================

// DataMapper - Transformation des donnees entre ERPNext et TailPOS
export {
  default as DataMapper,
  // Items
  mapErpItemToTailposProduct,
  mapTailposProductToErpItem,
  mapItemsList,
  // Customers
  mapErpCustomerToTailpos,
  mapTailposCustomerToErp,
  mapCustomersList,
  // Receipts
  mapTailposReceiptToErpInvoice,
  mapErpInvoiceToTailposReceipt,
  mapReceiptLines,
  mapPayment,
  // Categories
  mapErpCategoryToTailpos,
  mapTailposCategoryToErp,
  mapCategoriesList,
  // Utils
  generateUUID,
  formatDate,
  formatTime,
  formatDateTime,
  parseDate,
  generateBarcode,
  generateColorShape,
  sanitizeString,
  roundPrice,
  toNumber,
  isEmpty,
  setDebugMode,
  // Validation (from DataMapper)
  validateItemMapping,
  validateCustomerMapping,
  validateReceiptMapping,
  // Constants
  SYNC_STATUS as MAPPER_SYNC_STATUS,
  PAYMENT_TYPES,
  FIELD_MAPPINGS,
  DEFAULT_MAPPING_CONFIG,
  DEFAULT_COLORS,
  DEFAULT_SHAPES,
  // Errors
  MappingError,
} from './DataMapper';

// DataValidator - Schemas et validation des donnees
export {
  default as DataValidator,
  // Fonction principale
  validate,
  // Validations specialisees
  isValidItem,
  validateItem,
  isValidCustomer,
  validateCustomer,
  isValidReceipt,
  validateReceipt,
  isValidConfig,
  validateConfig,
  isValidCategory,
  validateCategory,
  // Utilitaires
  sanitizeData,
  getErrorMessages,
  // Schemas
  itemSchema,
  customerSchema,
  receiptSchema,
  configSchema,
  categorySchema,
  // Types et constantes
  DATA_TYPES,
  VALIDATION_RESULT,
  // Erreurs
  ValidationError,
} from './DataValidator';

// ============================================================================
// EXPORTS PHASE 6: GESTION OFFLINE
// ============================================================================

// OfflineQueue - Gestion de la queue des operations hors ligne
export {
  default as offlineQueue,
  OfflineQueue,
  QUEUE_ITEM_TYPES,
  QUEUE_ITEM_STATUS,
  QUEUE_PRIORITY,
  QUEUE_STORAGE_KEY,
  QUEUE_DB_NAME,
  MAX_RETRY_ATTEMPTS,
  RETRY_DELAY_BASE,
  BATCH_SIZE,
} from './OfflineQueue';

// NetworkMonitor - Surveillance du reseau
export {
  default as networkMonitor,
  NetworkMonitor,
  CONNECTION_TYPES,
  MONITOR_STATES,
  NETWORK_EVENTS,
  DEFAULT_PING_INTERVAL,
  PING_TIMEOUT,
  MAX_HISTORY_SIZE,
} from './NetworkMonitor';

// ============================================================================
// EXPORTS PHASE 7: VERIFICATION DES DEPENDANCES
// ============================================================================

// Dependencies - Verification des dependances
export {
  checkDependencies,
  logDependencyStatus,
  getQuickStatus,
  checkReactNativeCompatibility,
  REQUIRED_DEPENDENCIES,
  REACT_NATIVE_INCLUDED
} from './dependencies';

// ============================================================================
// EXPORTS PHASE 8: TESTS ET VALIDATION
// ============================================================================

// TestConnection - Tests de connexion et fonctionnalites
export {
  TestRunner,
  runAllTests,
  createTestRunner,
  TEST_CONFIG,
  TEST_CATEGORIES as CONNECTION_TEST_CATEGORIES,
  TEST_RESULT_TEMPLATE
} from './TestConnection';

// TestSuite - Suite de tests integree pour React Native
export {
  testSuite,
  TestSuite,
  TEST_CATEGORIES,
  TEST_STATUS,
  TEST_PRIORITY
} from './TestSuite';

// Version de l'API
export const API_VERSION = '2.3.0';

// Constantes API
export const API_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/method/login',
  LOGOUT: '/api/method/logout',
  GET_LOGGED_USER: '/api/method/frappe.auth.get_logged_user',

  // Items/Products
  ITEM_LIST: '/api/resource/Item',
  ITEM_DETAIL: '/api/resource/Item/', // + {name}
  ITEM_GROUP_LIST: '/api/resource/Item Group',

  // Stock
  STOCK_BALANCE: '/api/method/erpnext.stock.utils.get_stock_balance',
  STOCK_ENTRY: '/api/resource/Stock Entry',
  STOCK_LEDGER: '/api/resource/Stock Ledger Entry',
  BIN: '/api/resource/Bin',

  // Sales/POS
  POS_INVOICE: '/api/resource/POS Invoice',
  POS_PROFILE: '/api/resource/POS Profile',
  SALES_INVOICE: '/api/resource/Sales Invoice',

  // Customers
  CUSTOMER_LIST: '/api/resource/Customer',
  CUSTOMER_DETAIL: '/api/resource/Customer/', // + {name}

  // Generic
  GET_LIST: '/api/method/frappe.client.get_list',
  INSERT: '/api/method/frappe.client.insert',
  GET_VALUE: '/api/method/frappe.client.get_value',
  SET_VALUE: '/api/method/frappe.client.set_value',
};

console.log('[TailPOS API] Module loaded - Version ' + API_VERSION);
