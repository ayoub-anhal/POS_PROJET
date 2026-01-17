#!/usr/bin/env node

/**
 * test-sync.js
 *
 * Script de test de la connexion et synchronisation avec ERPNext.
 * A executer pour verifier que la configuration API fonctionne.
 *
 * Usage:
 *   node scripts/test-sync.js
 *   npm run sync:test
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ============================================================================
// CONFIGURATION
// ============================================================================

// Lire la configuration depuis le fichier de credentials
const CONFIG_PATH = path.join(__dirname, '..', 'src', 'api', 'config.json');

/**
 * Configuration par defaut (si pas de fichier config)
 */
const DEFAULT_CONFIG = {
  serverUrl: 'http://localhost:8000',
  apiKey: '',
  apiSecret: ''
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Charge la configuration
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('Impossible de charger config.json:', error.message);
  }

  // Essayer les variables d'environnement
  if (process.env.ERPNEXT_URL) {
    return {
      serverUrl: process.env.ERPNEXT_URL,
      apiKey: process.env.ERPNEXT_API_KEY || '',
      apiSecret: process.env.ERPNEXT_API_SECRET || ''
    };
  }

  return DEFAULT_CONFIG;
}

/**
 * Effectue une requete HTTP/HTTPS
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: 10000
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// ============================================================================
// TESTS
// ============================================================================

/**
 * Test 1: Verifier que le serveur est accessible
 */
async function testServerConnectivity(config) {
  console.log('\n[Test 1] Verification de la connectivite serveur...');
  console.log(`  URL: ${config.serverUrl}`);

  try {
    const response = await makeRequest(config.serverUrl);

    if (response.statusCode < 500) {
      console.log(`  [OK] Serveur accessible (HTTP ${response.statusCode})`);
      return true;
    } else {
      console.log(`  [ERREUR] Serveur en erreur (HTTP ${response.statusCode})`);
      return false;
    }
  } catch (error) {
    console.log(`  [ERREUR] Impossible de contacter le serveur: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Verifier l'endpoint API Frappe
 */
async function testFrappeAPI(config) {
  console.log('\n[Test 2] Verification de l\'API Frappe...');

  const apiUrl = `${config.serverUrl}/api/method/frappe.auth.get_logged_user`;
  console.log(`  URL: ${apiUrl}`);

  try {
    const headers = {};

    // Ajouter l'authentification si disponible
    if (config.apiKey && config.apiSecret) {
      headers['Authorization'] = `token ${config.apiKey}:${config.apiSecret}`;
    }

    const response = await makeRequest(apiUrl, { headers });

    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      console.log(`  [OK] API Frappe fonctionnelle`);
      console.log(`  Utilisateur: ${data.message || 'Guest'}`);
      return true;
    } else if (response.statusCode === 401 || response.statusCode === 403) {
      console.log(`  [WARN] API accessible mais non authentifie (HTTP ${response.statusCode})`);
      console.log('  Configurez les credentials API pour un acces complet');
      return true; // Le serveur repond, c'est OK
    } else {
      console.log(`  [ERREUR] Reponse inattendue (HTTP ${response.statusCode})`);
      return false;
    }
  } catch (error) {
    console.log(`  [ERREUR] ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Verifier l'acces aux Items (produits)
 */
async function testItemsAccess(config) {
  console.log('\n[Test 3] Verification de l\'acces aux Items...');

  const apiUrl = `${config.serverUrl}/api/resource/Item?limit_page_length=1`;
  console.log(`  URL: ${apiUrl}`);

  try {
    const headers = {};

    if (config.apiKey && config.apiSecret) {
      headers['Authorization'] = `token ${config.apiKey}:${config.apiSecret}`;
    }

    const response = await makeRequest(apiUrl, { headers });

    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      const itemCount = data.data ? data.data.length : 0;
      console.log(`  [OK] Acces aux Items fonctionne`);
      console.log(`  Items recuperes: ${itemCount}`);
      return true;
    } else if (response.statusCode === 401 || response.statusCode === 403) {
      console.log(`  [WARN] Acces refuse (HTTP ${response.statusCode})`);
      console.log('  Verifiez les permissions de l\'utilisateur API');
      return false;
    } else {
      console.log(`  [ERREUR] Reponse inattendue (HTTP ${response.statusCode})`);
      return false;
    }
  } catch (error) {
    console.log(`  [ERREUR] ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Verifier l'acces aux Customers (clients)
 */
async function testCustomersAccess(config) {
  console.log('\n[Test 4] Verification de l\'acces aux Customers...');

  const apiUrl = `${config.serverUrl}/api/resource/Customer?limit_page_length=1`;
  console.log(`  URL: ${apiUrl}`);

  try {
    const headers = {};

    if (config.apiKey && config.apiSecret) {
      headers['Authorization'] = `token ${config.apiKey}:${config.apiSecret}`;
    }

    const response = await makeRequest(apiUrl, { headers });

    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      const customerCount = data.data ? data.data.length : 0;
      console.log(`  [OK] Acces aux Customers fonctionne`);
      console.log(`  Customers recuperes: ${customerCount}`);
      return true;
    } else if (response.statusCode === 401 || response.statusCode === 403) {
      console.log(`  [WARN] Acces refuse (HTTP ${response.statusCode})`);
      return false;
    } else {
      console.log(`  [ERREUR] Reponse inattendue (HTTP ${response.statusCode})`);
      return false;
    }
  } catch (error) {
    console.log(`  [ERREUR] ${error.message}`);
    return false;
  }
}

// ============================================================================
// EXECUTION PRINCIPALE
// ============================================================================

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('    TEST DE CONNEXION TAILPOS -> ERPNEXT');
  console.log('='.repeat(60));

  // Charger la configuration
  const config = loadConfig();

  console.log('\nConfiguration:');
  console.log(`  Serveur: ${config.serverUrl}`);
  console.log(`  API Key: ${config.apiKey ? '***' + config.apiKey.slice(-4) : 'non configure'}`);
  console.log(`  API Secret: ${config.apiSecret ? '***' + config.apiSecret.slice(-4) : 'non configure'}`);

  // Executer les tests
  const results = {
    connectivity: false,
    frappeApi: false,
    items: false,
    customers: false
  };

  results.connectivity = await testServerConnectivity(config);

  if (results.connectivity) {
    results.frappeApi = await testFrappeAPI(config);

    if (results.frappeApi) {
      results.items = await testItemsAccess(config);
      results.customers = await testCustomersAccess(config);
    }
  }

  // Resume
  console.log('\n' + '='.repeat(60));
  console.log('RESUME DES TESTS:');
  console.log('-'.repeat(50));
  console.log(`  Connectivite serveur: ${results.connectivity ? 'OK' : 'ECHEC'}`);
  console.log(`  API Frappe: ${results.frappeApi ? 'OK' : 'ECHEC'}`);
  console.log(`  Acces Items: ${results.items ? 'OK' : 'ECHEC'}`);
  console.log(`  Acces Customers: ${results.customers ? 'OK' : 'ECHEC'}`);
  console.log('');

  const allPassed = Object.values(results).every(r => r);

  if (allPassed) {
    console.log('RESULTAT: TOUS LES TESTS PASSES!');
    console.log('La connexion avec ERPNext est fonctionnelle.');
  } else if (results.connectivity && results.frappeApi) {
    console.log('RESULTAT: CONNEXION OK, ACCES PARTIEL');
    console.log('Verifiez les permissions de l\'utilisateur API.');
  } else if (results.connectivity) {
    console.log('RESULTAT: SERVEUR ACCESSIBLE MAIS API NON FONCTIONNELLE');
    console.log('Verifiez que ERPNext est correctement configure.');
  } else {
    console.log('RESULTAT: ECHEC DE CONNEXION');
    console.log('Verifiez que le serveur ERPNext est en ligne.');
  }

  console.log('='.repeat(60));
  console.log('');

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
