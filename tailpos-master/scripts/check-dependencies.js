#!/usr/bin/env node

/**
 * check-dependencies.js
 *
 * Script de verification des dependances TailPOS API.
 * A executer avant le build: node scripts/check-dependencies.js
 *
 * Ce script verifie que toutes les dependances necessaires a la couche API
 * sont correctement installees dans le projet.
 *
 * Usage:
 *   node scripts/check-dependencies.js
 *   npm run check:deps
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Dependances requises pour la couche API
 * Format: { package: version }
 * '*' = toute version acceptee
 */
const REQUIRED_DEPS = {
  // Base de donnees locale
  'pouchdb-react-native': '*',
  'pouchdb-adapter-react-native-sqlite': '*',
  'pouchdb-find': '*',
  'pouchdb-upsert': '*',
  'react-native-sqlite-2': '*',

  // Utilitaires
  'uuid': '*',
  'valid-url': '*',
  'lodash': '*'
};

/**
 * Dependances optionnelles (warning si manquantes)
 */
const OPTIONAL_DEPS = {
  'is-float': '*',
  'email-validator': '*'
};

/**
 * Dependances incompatibles (erreur si presentes avec mauvaise version)
 */
const INCOMPATIBLE_DEPS = {
  // Les nouveaux packages ne sont pas compatibles avec RN < 0.60
  '@react-native-async-storage/async-storage': 'RN >= 0.60 requis',
  '@react-native-community/netinfo': 'RN >= 0.60 requis'
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Lit et parse package.json
 */
function readPackageJson() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');

  try {
    const content = fs.readFileSync(packageJsonPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Erreur: Impossible de lire package.json');
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Obtient toutes les dependances du projet
 */
function getAllDependencies(packageJson) {
  return {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };
}

/**
 * Parse une version semver simplifiee
 */
function parseVersion(version) {
  if (!version) return null;

  // Nettoyer la version
  const clean = version.replace(/^[\^~>=<]+/, '');
  const parts = clean.split('.');

  return {
    major: parseInt(parts[0], 10) || 0,
    minor: parseInt(parts[1], 10) || 0,
    patch: parseInt(parts[2], 10) || 0,
    raw: version
  };
}

/**
 * Verifie si React Native est en mode legacy (< 0.60)
 */
function isLegacyReactNative(dependencies) {
  const rnVersion = dependencies['react-native'];
  if (!rnVersion) return true;

  const parsed = parseVersion(rnVersion);
  return parsed.major === 0 && parsed.minor < 60;
}

// ============================================================================
// VERIFICATION PRINCIPALE
// ============================================================================

function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('    VERIFICATION DES DEPENDANCES TAILPOS API');
  console.log('='.repeat(60));
  console.log('');

  const packageJson = readPackageJson();
  const dependencies = getAllDependencies(packageJson);

  // Informations sur le projet
  console.log(`Projet: ${packageJson.name} v${packageJson.version}`);
  console.log(`React Native: ${dependencies['react-native'] || 'non trouve'}`);
  console.log(`React: ${dependencies['react'] || 'non trouve'}`);
  console.log('');

  const isLegacy = isLegacyReactNative(dependencies);
  console.log(`Mode: ${isLegacy ? 'Legacy (RN < 0.60)' : 'Modern (RN >= 0.60)'}`);

  if (isLegacy) {
    console.log('Note: AsyncStorage et NetInfo sont inclus dans react-native');
  }
  console.log('');

  // Resultats
  const results = {
    present: [],
    missing: [],
    optional_missing: [],
    incompatible: [],
    warnings: []
  };

  // Verifier les dependances requises
  console.log('DEPENDANCES REQUISES:');
  console.log('-'.repeat(50));

  for (const [dep, requiredVersion] of Object.entries(REQUIRED_DEPS)) {
    const installedVersion = dependencies[dep];

    if (installedVersion) {
      console.log(`  [OK] ${dep}: ${installedVersion}`);
      results.present.push({ name: dep, version: installedVersion });
    } else {
      console.log(`  [X]  ${dep}: MANQUANT`);
      results.missing.push({ name: dep, version: requiredVersion });
    }
  }
  console.log('');

  // Verifier les dependances optionnelles
  console.log('DEPENDANCES OPTIONNELLES:');
  console.log('-'.repeat(50));

  for (const [dep, requiredVersion] of Object.entries(OPTIONAL_DEPS)) {
    const installedVersion = dependencies[dep];

    if (installedVersion) {
      console.log(`  [OK] ${dep}: ${installedVersion}`);
      results.present.push({ name: dep, version: installedVersion, optional: true });
    } else {
      console.log(`  [~]  ${dep}: non installe (optionnel)`);
      results.optional_missing.push({ name: dep });
    }
  }
  console.log('');

  // Verifier les dependances incompatibles
  if (isLegacy) {
    console.log('VERIFICATION DE COMPATIBILITE:');
    console.log('-'.repeat(50));

    for (const [dep, reason] of Object.entries(INCOMPATIBLE_DEPS)) {
      const installedVersion = dependencies[dep];

      if (installedVersion) {
        console.log(`  [!] ${dep}: INSTALLE mais incompatible`);
        console.log(`      Raison: ${reason}`);
        results.incompatible.push({ name: dep, reason });
      } else {
        console.log(`  [OK] ${dep}: non installe (correct pour RN < 0.60)`);
      }
    }
    console.log('');
  }

  // Resume
  console.log('='.repeat(60));
  console.log('RESUME:');
  console.log('-'.repeat(50));
  console.log(`  Dependances installees: ${results.present.length}`);
  console.log(`  Dependances manquantes: ${results.missing.length}`);
  console.log(`  Optionnelles manquantes: ${results.optional_missing.length}`);

  if (results.incompatible.length > 0) {
    console.log(`  Incompatibles detectees: ${results.incompatible.length}`);
  }
  console.log('');

  // Code de sortie et commandes d'installation
  if (results.missing.length > 0) {
    console.log('ERREUR: Des dependances requises sont manquantes!');
    console.log('');
    console.log('Pour installer les dependances manquantes, executez:');
    console.log('');

    const missingNames = results.missing.map(d => d.name).join(' ');
    console.log(`  npm install ${missingNames}`);
    console.log('');
    console.log('Ou avec yarn:');
    console.log('');
    console.log(`  yarn add ${missingNames}`);
    console.log('');
    console.log('='.repeat(60));

    process.exit(1);
  }

  if (results.incompatible.length > 0) {
    console.log('ATTENTION: Des packages incompatibles sont installes!');
    console.log('');
    console.log('Pour les supprimer:');
    console.log('');

    const incompatNames = results.incompatible.map(d => d.name).join(' ');
    console.log(`  npm uninstall ${incompatNames}`);
    console.log('');
  }

  console.log('OK: Toutes les dependances requises sont installees!');
  console.log('='.repeat(60));
  console.log('');

  process.exit(0);
}

// ============================================================================
// EXECUTION
// ============================================================================

main();
