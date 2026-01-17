/**
 * dependencies.js
 *
 * Verification des dependances requises pour la couche API TailPOS.
 * Ce fichier verifie que toutes les dependances sont correctement installees
 * et compatibles avec la version de React Native utilisee.
 *
 * IMPORTANT: TailPOS utilise React Native 0.55.3
 * - AsyncStorage est inclus dans react-native (pas de package separe)
 * - NetInfo est inclus dans react-native (pas de package separe)
 * - Les packages @react-native-community/* ne sont PAS necessaires
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

// ============================================================================
// CONFIGURATION DES DEPENDANCES
// ============================================================================

/**
 * Liste des dependances requises pour la couche API
 * Chaque entree contient:
 * - name: Nom du package NPM
 * - importPath: Chemin d'import
 * - required: Si la dependance est obligatoire
 * - description: Description de l'usage
 * - minVersion: Version minimale requise (optionnel)
 */
export const REQUIRED_DEPENDENCIES = [
  {
    name: 'pouchdb-react-native',
    importPath: 'pouchdb-react-native',
    required: true,
    description: 'Base de donnees locale pour le stockage offline',
    minVersion: '6.0.0'
  },
  {
    name: 'pouchdb-adapter-react-native-sqlite',
    importPath: 'pouchdb-adapter-react-native-sqlite',
    required: true,
    description: 'Adapter SQLite pour PouchDB',
    minVersion: '1.0.0'
  },
  {
    name: 'pouchdb-find',
    importPath: 'pouchdb-find',
    required: true,
    description: 'Plugin de recherche pour PouchDB',
    minVersion: '6.0.0'
  },
  {
    name: 'pouchdb-upsert',
    importPath: 'pouchdb-upsert',
    required: true,
    description: 'Plugin upsert pour PouchDB',
    minVersion: '2.0.0'
  },
  {
    name: 'react-native-sqlite-2',
    importPath: 'react-native-sqlite-2',
    required: true,
    description: 'SQLite pour React Native',
    minVersion: '1.5.0'
  },
  {
    name: 'uuid',
    importPath: 'uuid',
    required: true,
    description: 'Generation d\'identifiants uniques',
    minVersion: '3.0.0'
  },
  {
    name: 'valid-url',
    importPath: 'valid-url',
    required: true,
    description: 'Validation des URLs',
    minVersion: '1.0.0'
  },
  {
    name: 'lodash',
    importPath: 'lodash',
    required: false,
    description: 'Utilitaires JavaScript (debounce, throttle, etc.)',
    minVersion: '4.0.0'
  }
];

/**
 * Dependances incluses dans React Native 0.55.x
 * Ces modules n'ont pas besoin d'etre installes separement
 */
export const REACT_NATIVE_INCLUDED = [
  {
    name: 'AsyncStorage',
    importPath: 'react-native',
    description: 'Stockage cle-valeur asynchrone',
    note: 'Inclus dans react-native pour RN < 0.60'
  },
  {
    name: 'NetInfo',
    importPath: 'react-native',
    description: 'Detection du statut reseau',
    note: 'Inclus dans react-native pour RN < 0.60'
  }
];

// ============================================================================
// FONCTIONS DE VERIFICATION
// ============================================================================

/**
 * Verifie si toutes les dependances sont disponibles
 *
 * @returns {Object} Resultat de la verification
 * {
 *   allPresent: boolean,
 *   allRequiredPresent: boolean,
 *   missing: Array<{name, required}>,
 *   present: Array<{name, version}>,
 *   message: string
 * }
 */
export function checkDependencies() {
  const missing = [];
  const present = [];

  for (const dep of REQUIRED_DEPENDENCIES) {
    try {
      // Tenter d'importer le module
      const module = require(dep.importPath);

      // Essayer d'obtenir la version
      let version = 'installed';
      try {
        const packageJson = require(`${dep.importPath}/package.json`);
        version = packageJson.version || 'installed';
      } catch (e) {
        // Version non disponible, ce n'est pas grave
      }

      present.push({
        name: dep.name,
        version: version,
        required: dep.required
      });
    } catch (error) {
      missing.push({
        name: dep.name,
        required: dep.required,
        description: dep.description
      });
    }
  }

  const allPresent = missing.length === 0;
  const requiredMissing = missing.filter(d => d.required);
  const allRequiredPresent = requiredMissing.length === 0;

  let message;
  if (allPresent) {
    message = 'Toutes les dependances sont installees';
  } else if (allRequiredPresent) {
    const optionalMissing = missing.filter(d => !d.required).map(d => d.name);
    message = `Dependances optionnelles manquantes: ${optionalMissing.join(', ')}`;
  } else {
    const requiredNames = requiredMissing.map(d => d.name);
    message = `ERREUR: Dependances requises manquantes: ${requiredNames.join(', ')}. ` +
              `Executez: npm install ${requiredNames.join(' ')}`;
  }

  return {
    allPresent,
    allRequiredPresent,
    missing,
    present,
    message,
    reactNativeVersion: getReactNativeVersion()
  };
}

/**
 * Verifie une dependance specifique
 *
 * @param {string} packageName - Nom du package a verifier
 * @returns {Object} { present: boolean, version: string|null, error: string|null }
 */
export function checkSingleDependency(packageName) {
  try {
    const module = require(packageName);

    let version = null;
    try {
      const packageJson = require(`${packageName}/package.json`);
      version = packageJson.version;
    } catch (e) {
      // Version non disponible
    }

    return {
      present: true,
      version,
      error: null
    };
  } catch (error) {
    return {
      present: false,
      version: null,
      error: error.message
    };
  }
}

/**
 * Obtient la version de React Native
 *
 * @returns {string|null} Version de React Native
 */
export function getReactNativeVersion() {
  try {
    const rnPackage = require('react-native/package.json');
    return rnPackage.version;
  } catch (e) {
    return null;
  }
}

/**
 * Verifie si la version de React Native est compatible
 * avec les imports AsyncStorage/NetInfo depuis react-native
 *
 * @returns {Object} { isLegacy: boolean, version: string, note: string }
 */
export function checkReactNativeCompatibility() {
  const version = getReactNativeVersion();

  if (!version) {
    return {
      isLegacy: true, // Assumer legacy par defaut
      version: 'unknown',
      note: 'Version React Native non detectee'
    };
  }

  // Parser la version
  const parts = version.split('.');
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);

  // RN < 0.60 = legacy (AsyncStorage/NetInfo inclus)
  // RN >= 0.60 = modern (packages separes requis)
  const isLegacy = major === 0 && minor < 60;

  let note;
  if (isLegacy) {
    note = 'AsyncStorage et NetInfo sont inclus dans react-native. ' +
           'Utilisez: import { AsyncStorage, NetInfo } from "react-native"';
  } else {
    note = 'Installez les packages separes: ' +
           '@react-native-async-storage/async-storage et @react-native-community/netinfo';
  }

  return {
    isLegacy,
    version,
    note
  };
}

// ============================================================================
// FONCTIONS DE LOGGING
// ============================================================================

/**
 * Affiche le statut des dependances dans la console
 *
 * @returns {Object} Statut des dependances
 */
export function logDependencyStatus() {
  const status = checkDependencies();
  const rnCompat = checkReactNativeCompatibility();

  console.log('');
  console.log('='.repeat(60));
  console.log('       STATUT DES DEPENDANCES TAILPOS API');
  console.log('='.repeat(60));
  console.log('');

  // Version React Native
  console.log(`React Native: ${rnCompat.version}`);
  console.log(`Mode: ${rnCompat.isLegacy ? 'Legacy (< 0.60)' : 'Modern (>= 0.60)'}`);
  console.log('');

  // Dependances presentes
  console.log('DEPENDANCES INSTALLEES:');
  console.log('-'.repeat(40));
  for (const dep of status.present) {
    const marker = dep.required ? '[REQ]' : '[OPT]';
    console.log(`  ${marker} ${dep.name}: ${dep.version}`);
  }
  console.log('');

  // Dependances manquantes
  if (status.missing.length > 0) {
    console.log('DEPENDANCES MANQUANTES:');
    console.log('-'.repeat(40));
    for (const dep of status.missing) {
      const marker = dep.required ? '[REQ] !' : '[OPT]';
      console.log(`  ${marker} ${dep.name}`);
      console.log(`        -> ${dep.description}`);
    }
    console.log('');
  }

  // Dependances React Native incluses
  if (rnCompat.isLegacy) {
    console.log('INCLUS DANS REACT NATIVE:');
    console.log('-'.repeat(40));
    for (const dep of REACT_NATIVE_INCLUDED) {
      console.log(`  [RN]  ${dep.name}: ${dep.note}`);
    }
    console.log('');
  }

  // Resume
  console.log('='.repeat(60));
  if (status.allRequiredPresent) {
    console.log('STATUT: OK - Toutes les dependances requises sont installees');
  } else {
    console.log('STATUT: ERREUR - Des dependances requises sont manquantes');
    console.log('');
    console.log('Pour installer les dependances manquantes:');
    const requiredMissing = status.missing.filter(d => d.required);
    console.log(`  npm install ${requiredMissing.map(d => d.name).join(' ')}`);
  }
  console.log('='.repeat(60));
  console.log('');

  return status;
}

/**
 * Verifie les dependances silencieusement et retourne un resume
 *
 * @returns {Object} Resume compact
 */
export function getQuickStatus() {
  const status = checkDependencies();
  const rnCompat = checkReactNativeCompatibility();

  return {
    ok: status.allRequiredPresent,
    reactNative: rnCompat.version,
    isLegacy: rnCompat.isLegacy,
    installed: status.present.length,
    missing: status.missing.filter(d => d.required).length,
    message: status.message
  };
}

// ============================================================================
// EXPORT PAR DEFAUT
// ============================================================================

export default {
  // Fonctions principales
  checkDependencies,
  checkSingleDependency,
  logDependencyStatus,
  getQuickStatus,

  // Compatibilite React Native
  checkReactNativeCompatibility,
  getReactNativeVersion,

  // Constantes
  REQUIRED_DEPENDENCIES,
  REACT_NATIVE_INCLUDED
};
