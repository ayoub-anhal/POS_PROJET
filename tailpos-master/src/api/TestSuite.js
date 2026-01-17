/**
 * TestSuite.js
 *
 * Suite de tests integree pour TailPOS.
 * Peut etre appelee depuis l'interface utilisateur React Native
 * pour verifier la configuration et le bon fonctionnement de l'API.
 *
 * Usage:
 *   import { testSuite, TEST_CATEGORIES } from './api/TestSuite';
 *
 *   // Executer tous les tests
 *   const results = await testSuite.runAll(config);
 *
 *   // Executer une categorie
 *   const results = await testSuite.runCategory(TEST_CATEGORIES.CONNECTION, config);
 *
 *   // Ecouter les evenements
 *   testSuite.addListener((event) => {
 *     console.log('Test event:', event);
 *   });
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

// ============================================================================
// IMPORTS
// ============================================================================

import FrappeAPI from './FrappeAPI';
import ApiConfig from './ApiConfig';
import SyncService from './SyncService';
import {
  mapErpItemToTailposProduct,
  mapTailposProductToErpItem,
  mapErpCustomerToTailpos,
  mapTailposCustomerToErp,
  mapTailposReceiptToErpInvoice
} from './DataMapper';
import offlineQueue, { QUEUE_ITEM_STATUS } from './OfflineQueue';
import networkMonitor from './NetworkMonitor';
import { checkDependencies } from './dependencies';

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Categories de tests
 */
export const TEST_CATEGORIES = {
  DEPENDENCIES: 'dependencies',
  CONNECTION: 'connection',
  AUTHENTICATION: 'authentication',
  ITEMS: 'items',
  CUSTOMERS: 'customers',
  POS: 'pos',
  MAPPING: 'mapping',
  OFFLINE: 'offline',
  SYNC: 'sync'
};

/**
 * Statuts de tests
 */
export const TEST_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  PASSED: 'passed',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  ERROR: 'error'
};

/**
 * Priorites de tests
 */
export const TEST_PRIORITY = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

// ============================================================================
// CLASSE TESTSUITE
// ============================================================================

/**
 * Suite de tests pour TailPOS
 */
class TestSuite {
  constructor() {
    /** @type {Array} Liste des tests enregistres */
    this.tests = [];

    /** @type {Array} Resultats des tests */
    this.results = [];

    /** @type {boolean} Tests en cours */
    this.isRunning = false;

    /** @type {string|null} Test en cours */
    this.currentTest = null;

    /** @type {Array<Function>} Listeners pour les evenements */
    this.listeners = [];

    /** @type {Object} Configuration par defaut */
    this.defaultConfig = {
      serverUrl: '',
      username: '',
      password: '',
      timeout: 10000,
      verbose: true,
      stopOnError: false
    };

    // Enregistrer les tests par defaut
    this._registerDefaultTests();
  }

  // ==========================================================================
  // ENREGISTREMENT DES TESTS
  // ==========================================================================

  /**
   * Enregistrer un test
   *
   * @param {string} name - Nom du test
   * @param {string} category - Categorie (TEST_CATEGORIES)
   * @param {Function} testFn - Fonction de test async
   * @param {Object} options - Options
   */
  registerTest(name, category, testFn, options = {}) {
    this.tests.push({
      id: `${category}_${name.replace(/\s+/g, '_').toLowerCase()}`,
      name,
      category,
      testFn,
      timeout: options.timeout || 10000,
      skip: options.skip || false,
      priority: options.priority || TEST_PRIORITY.MEDIUM,
      dependencies: options.dependencies || [],
      description: options.description || ''
    });
  }

  /**
   * Enregistrer les tests par defaut
   */
  _registerDefaultTests() {
    // --- TESTS DEPENDENCIES ---
    this.registerTest(
      'Verification des dependances',
      TEST_CATEGORIES.DEPENDENCIES,
      async () => {
        const status = checkDependencies();
        if (!status.allRequiredPresent) {
          throw new Error(`Dependances manquantes: ${status.missing.map(d => d.name).join(', ')}`);
        }
        return {
          message: 'Toutes les dependances sont installees',
          details: {
            installed: status.present.length,
            missing: status.missing.length
          }
        };
      },
      { priority: TEST_PRIORITY.CRITICAL, description: 'Verifie que tous les packages requis sont installes' }
    );

    // --- TESTS CONNECTION ---
    this.registerTest(
      'Serveur accessible',
      TEST_CATEGORIES.CONNECTION,
      async (config) => {
        const url = config.serverUrl || ApiConfig.serverUrl;
        if (!url) {
          throw new Error('URL du serveur non configuree');
        }

        const response = await fetch(url, {
          method: 'HEAD',
          timeout: 5000
        });

        if (!response.ok && response.status >= 500) {
          throw new Error(`Serveur en erreur: HTTP ${response.status}`);
        }

        return {
          message: `Serveur accessible (HTTP ${response.status})`,
          details: { url, statusCode: response.status }
        };
      },
      { priority: TEST_PRIORITY.CRITICAL }
    );

    this.registerTest(
      'API Frappe disponible',
      TEST_CATEGORIES.CONNECTION,
      async (config) => {
        const url = config.serverUrl || ApiConfig.serverUrl;
        const apiUrl = `${url}/api/method/frappe.auth.get_logged_user`;

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        // 401/403 signifie que l'API repond
        if (response.status < 500) {
          return {
            message: 'API Frappe fonctionnelle',
            details: { statusCode: response.status }
          };
        }

        throw new Error(`API non disponible: HTTP ${response.status}`);
      },
      { priority: TEST_PRIORITY.CRITICAL }
    );

    // --- TESTS AUTHENTICATION ---
    this.registerTest(
      'Authentification',
      TEST_CATEGORIES.AUTHENTICATION,
      async (config) => {
        const username = config.username || ApiConfig.username;
        const password = config.password || ApiConfig.password;

        if (!username || !password) {
          throw new Error('Identifiants non configures');
        }

        const result = await FrappeAPI.login(username, password);

        if (!result.success) {
          throw new Error(result.message || 'Echec authentification');
        }

        // Logout apres test
        await FrappeAPI.logout();

        return {
          message: 'Authentification reussie',
          details: { user: result.user }
        };
      },
      { priority: TEST_PRIORITY.CRITICAL }
    );

    // --- TESTS ITEMS ---
    this.registerTest(
      'Recuperation des produits',
      TEST_CATEGORIES.ITEMS,
      async () => {
        const items = await FrappeAPI.getItems({}, null, 5);

        if (!items || items.length === 0) {
          throw new Error('Aucun produit trouve');
        }

        return {
          message: `${items.length} produits recuperes`,
          details: { count: items.length, items: items.map(i => i.item_code) }
        };
      },
      { priority: TEST_PRIORITY.HIGH }
    );

    this.registerTest(
      'Recuperation des categories',
      TEST_CATEGORIES.ITEMS,
      async () => {
        const groups = await FrappeAPI.getItemGroups(10);

        return {
          message: `${groups.length} categories recuperees`,
          details: { count: groups.length, groups: groups.map(g => g.name) }
        };
      },
      { priority: TEST_PRIORITY.MEDIUM }
    );

    // --- TESTS CUSTOMERS ---
    this.registerTest(
      'Recuperation des clients',
      TEST_CATEGORIES.CUSTOMERS,
      async () => {
        const customers = await FrappeAPI.getCustomers({}, 5);

        return {
          message: `${customers.length} clients recuperes`,
          details: { count: customers.length }
        };
      },
      { priority: TEST_PRIORITY.HIGH }
    );

    // --- TESTS POS ---
    this.registerTest(
      'Configuration POS Profile',
      TEST_CATEGORIES.POS,
      async () => {
        const profile = await FrappeAPI.getPOSProfile();

        if (!profile) {
          throw new Error('Aucun POS Profile configure');
        }

        return {
          message: `POS Profile: ${profile.name}`,
          details: { profile: profile.name, warehouse: profile.warehouse }
        };
      },
      { priority: TEST_PRIORITY.HIGH }
    );

    // --- TESTS MAPPING ---
    this.registerTest(
      'Mapping Item -> Product',
      TEST_CATEGORIES.MAPPING,
      async () => {
        const mockItem = {
          item_code: 'TEST-001',
          item_name: 'Produit Test',
          description: 'Description test',
          standard_rate: 99.99,
          stock_uom: 'Nos',
          item_group: 'Products',
          barcode: '1234567890123'
        };

        const product = mapErpItemToTailposProduct(mockItem);

        if (!product._id || !product.name || product.price === undefined) {
          throw new Error('Mapping incomplet');
        }

        return {
          message: 'Mapping Item reussi',
          details: { input: mockItem.item_code, output: product._id }
        };
      },
      { priority: TEST_PRIORITY.MEDIUM }
    );

    this.registerTest(
      'Mapping Receipt -> Invoice',
      TEST_CATEGORIES.MAPPING,
      async () => {
        const mockReceipt = {
          _id: 'receipt-test-001',
          receiptNumber: 'REC-2025-001',
          date: new Date().toISOString(),
          customer: 'Test Customer',
          lines: [
            { item_code: 'ITEM-001', qty: 2, price: 50 }
          ],
          netTotal: 100,
          discountValue: 0
        };

        const invoice = mapTailposReceiptToErpInvoice(mockReceipt, {
          warehouse: 'Main Store',
          posProfile: 'POS-001'
        });

        if (!invoice.customer || !invoice.items || invoice.items.length === 0) {
          throw new Error('Structure Invoice invalide');
        }

        return {
          message: 'Mapping Receipt reussi',
          details: { customer: invoice.customer, items: invoice.items.length }
        };
      },
      { priority: TEST_PRIORITY.MEDIUM }
    );

    // --- TESTS OFFLINE ---
    this.registerTest(
      'Queue offline - Initialisation',
      TEST_CATEGORIES.OFFLINE,
      async () => {
        const status = await offlineQueue.initialize();

        return {
          message: status.success ? 'Queue offline initialisee' : 'Deja initialisee',
          details: { initialized: offlineQueue.isInitialized }
        };
      },
      { priority: TEST_PRIORITY.MEDIUM }
    );

    this.registerTest(
      'Queue offline - Statistiques',
      TEST_CATEGORIES.OFFLINE,
      async () => {
        const stats = await offlineQueue.getQueueStats();

        return {
          message: `Queue: ${stats.total} items (${stats.pending} en attente)`,
          details: stats
        };
      },
      { priority: TEST_PRIORITY.LOW }
    );

    this.registerTest(
      'Moniteur reseau',
      TEST_CATEGORIES.OFFLINE,
      async () => {
        const status = networkMonitor.getNetworkStatus();

        return {
          message: `Reseau: ${status.isConnected ? 'Connecte' : 'Deconnecte'} (${status.connectionType || 'inconnu'})`,
          details: status
        };
      },
      { priority: TEST_PRIORITY.MEDIUM }
    );

    // --- TESTS SYNC ---
    this.registerTest(
      'Statut synchronisation',
      TEST_CATEGORIES.SYNC,
      async () => {
        const status = SyncService.getSyncStatus();

        return {
          message: `Sync: ${status.lastSyncStatus} (queue: ${status.offlineQueueCount})`,
          details: status
        };
      },
      { priority: TEST_PRIORITY.LOW }
    );
  }

  // ==========================================================================
  // EXECUTION DES TESTS
  // ==========================================================================

  /**
   * Executer tous les tests
   *
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Rapport
   */
  async runAll(config = {}) {
    if (this.isRunning) {
      throw new Error('Tests deja en cours d\'execution');
    }

    this.isRunning = true;
    this.results = [];
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };

    this.notifyListeners({
      event: 'suite_started',
      totalTests: this.tests.length,
      config: mergedConfig
    });

    // Trier par priorite
    const sortedTests = [...this.tests].sort((a, b) => a.priority - b.priority);

    for (const test of sortedTests) {
      if (test.skip) {
        this.results.push({
          ...test,
          status: TEST_STATUS.SKIPPED,
          duration: 0,
          message: 'Test ignore'
        });
        continue;
      }

      const result = await this.runSingleTest(test, mergedConfig);
      this.results.push(result);

      this.notifyListeners({
        event: 'test_completed',
        test: result,
        progress: this.results.length / sortedTests.length
      });

      // Arreter si erreur critique et option activee
      if ((result.status === TEST_STATUS.FAILED || result.status === TEST_STATUS.ERROR) &&
          mergedConfig.stopOnError) {
        break;
      }
    }

    this.isRunning = false;
    const duration = Date.now() - startTime;

    const summary = this.generateSummary(duration);

    this.notifyListeners({
      event: 'suite_completed',
      summary
    });

    return summary;
  }

  /**
   * Executer les tests d'une categorie
   *
   * @param {string} category - Categorie
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Rapport
   */
  async runCategory(category, config = {}) {
    if (this.isRunning) {
      throw new Error('Tests deja en cours d\'execution');
    }

    this.isRunning = true;
    this.results = [];
    const startTime = Date.now();
    const mergedConfig = { ...this.defaultConfig, ...config };

    const categoryTests = this.tests.filter(t => t.category === category);

    this.notifyListeners({
      event: 'category_started',
      category,
      totalTests: categoryTests.length
    });

    for (const test of categoryTests) {
      if (test.skip) {
        this.results.push({
          ...test,
          status: TEST_STATUS.SKIPPED,
          duration: 0,
          message: 'Test ignore'
        });
        continue;
      }

      const result = await this.runSingleTest(test, mergedConfig);
      this.results.push(result);

      this.notifyListeners({
        event: 'test_completed',
        test: result,
        progress: this.results.length / categoryTests.length
      });
    }

    this.isRunning = false;
    const duration = Date.now() - startTime;

    return this.generateSummary(duration);
  }

  /**
   * Executer un seul test
   *
   * @param {Object} test - Test a executer
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Resultat
   */
  async runSingleTest(test, config) {
    const startTime = Date.now();
    this.currentTest = test.name;

    this.notifyListeners({
      event: 'test_started',
      test: { name: test.name, category: test.category }
    });

    try {
      // Executer avec timeout
      const result = await Promise.race([
        test.testFn(config),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), test.timeout)
        )
      ]);

      return {
        id: test.id,
        name: test.name,
        category: test.category,
        status: TEST_STATUS.PASSED,
        duration: Date.now() - startTime,
        message: result?.message || 'Test reussi',
        details: result?.details || {}
      };

    } catch (error) {
      return {
        id: test.id,
        name: test.name,
        category: test.category,
        status: error.message === 'Timeout' ? TEST_STATUS.ERROR : TEST_STATUS.FAILED,
        duration: Date.now() - startTime,
        message: error.message,
        error: error.stack,
        details: {}
      };

    } finally {
      this.currentTest = null;
    }
  }

  // ==========================================================================
  // RAPPORT
  // ==========================================================================

  /**
   * Generer le resume des tests
   *
   * @param {number} duration - Duree totale
   * @returns {Object} Resume
   */
  generateSummary(duration) {
    const passed = this.results.filter(r => r.status === TEST_STATUS.PASSED).length;
    const failed = this.results.filter(r => r.status === TEST_STATUS.FAILED).length;
    const skipped = this.results.filter(r => r.status === TEST_STATUS.SKIPPED).length;
    const errors = this.results.filter(r => r.status === TEST_STATUS.ERROR).length;

    const total = this.results.length;
    const executed = total - skipped;

    return {
      total,
      passed,
      failed,
      skipped,
      errors,
      duration,
      successRate: executed > 0 ? ((passed / executed) * 100).toFixed(1) : 0,
      timestamp: new Date().toISOString(),
      results: this.results,
      recommendations: this.generateRecommendations(),
      byCategory: this.getResultsByCategory()
    };
  }

  /**
   * Obtenir les resultats par categorie
   *
   * @returns {Object} Resultats groupes
   */
  getResultsByCategory() {
    const byCategory = {};

    for (const result of this.results) {
      if (!byCategory[result.category]) {
        byCategory[result.category] = {
          total: 0,
          passed: 0,
          failed: 0
        };
      }

      byCategory[result.category].total++;
      if (result.status === TEST_STATUS.PASSED) {
        byCategory[result.category].passed++;
      } else if (result.status === TEST_STATUS.FAILED || result.status === TEST_STATUS.ERROR) {
        byCategory[result.category].failed++;
      }
    }

    return byCategory;
  }

  /**
   * Generer des recommandations
   *
   * @returns {Array<string>} Recommandations
   */
  generateRecommendations() {
    const recommendations = [];
    const failedByCategory = {};

    for (const result of this.results) {
      if (result.status === TEST_STATUS.FAILED || result.status === TEST_STATUS.ERROR) {
        if (!failedByCategory[result.category]) {
          failedByCategory[result.category] = [];
        }
        failedByCategory[result.category].push(result);
      }
    }

    // Recommandations par categorie
    if (failedByCategory[TEST_CATEGORIES.DEPENDENCIES]) {
      recommendations.push('Installez les dependances manquantes avec npm install');
    }

    if (failedByCategory[TEST_CATEGORIES.CONNECTION]) {
      recommendations.push('Verifiez que le serveur ERPNext est demarre et accessible');
      recommendations.push('Verifiez l\'URL du serveur dans la configuration');
    }

    if (failedByCategory[TEST_CATEGORIES.AUTHENTICATION]) {
      recommendations.push('Verifiez les identifiants de connexion');
      recommendations.push('Verifiez que l\'utilisateur existe dans ERPNext');
    }

    if (failedByCategory[TEST_CATEGORIES.ITEMS]) {
      recommendations.push('Creez des produits (Items) dans ERPNext');
      recommendations.push('Verifiez les permissions de l\'utilisateur');
    }

    if (failedByCategory[TEST_CATEGORIES.POS]) {
      recommendations.push('Creez et configurez un POS Profile dans ERPNext');
      recommendations.push('Configurez un Warehouse et une Price List');
    }

    if (recommendations.length === 0) {
      recommendations.push('Tous les tests ont reussi - Configuration OK!');
    }

    return [...new Set(recommendations)];
  }

  // ==========================================================================
  // LISTENERS
  // ==========================================================================

  /**
   * Ajouter un listener
   *
   * @param {Function} callback - Fonction de callback
   * @returns {Function} Fonction pour retirer le listener
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notifier les listeners
   *
   * @param {Object} event - Evenement
   */
  notifyListeners(event) {
    this.listeners.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[TestSuite] Erreur dans listener:', error);
      }
    });
  }

  // ==========================================================================
  // UTILITAIRES
  // ==========================================================================

  /**
   * Obtenir tous les tests enregistres
   *
   * @returns {Array} Tests
   */
  getTests() {
    return this.tests;
  }

  /**
   * Obtenir les tests par categorie
   *
   * @param {string} category - Categorie
   * @returns {Array} Tests
   */
  getTestsByCategory(category) {
    return this.tests.filter(t => t.category === category);
  }

  /**
   * Obtenir les derniers resultats
   *
   * @returns {Array} Resultats
   */
  getResults() {
    return this.results;
  }

  /**
   * Reinitialiser les resultats
   */
  reset() {
    this.results = [];
    this.currentTest = null;
    this.isRunning = false;
  }

  /**
   * Verifier si des tests sont en cours
   *
   * @returns {boolean} True si en cours
   */
  isTestRunning() {
    return this.isRunning;
  }

  /**
   * Obtenir le test en cours
   *
   * @returns {string|null} Nom du test
   */
  getCurrentTest() {
    return this.currentTest;
  }
}

// ============================================================================
// INSTANCE SINGLETON
// ============================================================================

/**
 * Instance singleton de la suite de tests
 */
const testSuite = new TestSuite();

// ============================================================================
// EXPORTS
// ============================================================================

export {
  testSuite,
  TestSuite,
  TEST_CATEGORIES,
  TEST_STATUS,
  TEST_PRIORITY
};

export default testSuite;
