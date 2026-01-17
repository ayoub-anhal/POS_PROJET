/**
 * DataValidator.js
 *
 * Module de validation des donnees pour la synchronisation TailPOS <-> ERPNext.
 * Fournit des schemas et fonctions de validation pour les produits, clients et ventes.
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

// ============================================================================
// TYPES DE VALIDATION
// ============================================================================

/**
 * Types de donnees supportes
 */
export const DATA_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  ARRAY: 'array',
  OBJECT: 'object',
  DATE: 'date',
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  UUID: 'uuid',
  BARCODE: 'barcode'
};

/**
 * Resultats de validation
 */
export const VALIDATION_RESULT = {
  VALID: 'valid',
  INVALID: 'invalid',
  WARNING: 'warning'
};

// ============================================================================
// SCHEMAS DE VALIDATION
// ============================================================================

/**
 * Schema de validation pour un Item (produit)
 */
export const itemSchema = {
  name: 'Item',
  fields: {
    // Champs requis
    name: {
      type: DATA_TYPES.STRING,
      required: true,
      minLength: 1,
      maxLength: 200,
      description: "Nom du produit"
    },
    sku: {
      type: DATA_TYPES.STRING,
      required: true,
      minLength: 1,
      maxLength: 50,
      pattern: /^[A-Za-z0-9\-_]+$/,
      description: "Code produit (SKU)"
    },
    price: {
      type: DATA_TYPES.NUMBER,
      required: true,
      min: 0,
      max: 9999999.99,
      description: "Prix de vente"
    },

    // Champs optionnels
    barcode: {
      type: DATA_TYPES.BARCODE,
      required: false,
      description: "Code-barres EAN/UPC"
    },
    category: {
      type: DATA_TYPES.STRING,
      required: false,
      maxLength: 100,
      default: "Products",
      description: "Categorie du produit"
    },
    description: {
      type: DATA_TYPES.STRING,
      required: false,
      maxLength: 1000,
      description: "Description du produit"
    },
    stock: {
      type: DATA_TYPES.NUMBER,
      required: false,
      min: 0,
      default: 0,
      description: "Quantite en stock"
    },
    image: {
      type: DATA_TYPES.STRING,
      required: false,
      description: "URL ou base64 de l'image"
    },
    taxes: {
      type: DATA_TYPES.NUMBER,
      required: false,
      min: 0,
      max: 100,
      default: 0,
      description: "Taux de taxe (%)"
    },
    syncId: {
      type: DATA_TYPES.STRING,
      required: false,
      description: "ID de synchronisation ERPNext"
    },
    syncStatus: {
      type: DATA_TYPES.STRING,
      required: false,
      enum: ['pending', 'syncing', 'synced', 'error', 'conflict'],
      default: 'pending',
      description: "Statut de synchronisation"
    }
  }
};

/**
 * Schema de validation pour un Customer (client)
 */
export const customerSchema = {
  name: 'Customer',
  fields: {
    // Champs requis
    name: {
      type: DATA_TYPES.STRING,
      required: true,
      minLength: 1,
      maxLength: 200,
      description: "Nom du client"
    },

    // Champs optionnels
    email: {
      type: DATA_TYPES.EMAIL,
      required: false,
      description: "Adresse email"
    },
    phoneNumber: {
      type: DATA_TYPES.PHONE,
      required: false,
      description: "Numero de telephone"
    },
    address: {
      type: DATA_TYPES.STRING,
      required: false,
      maxLength: 500,
      description: "Adresse postale"
    },
    note: {
      type: DATA_TYPES.STRING,
      required: false,
      maxLength: 1000,
      description: "Notes sur le client"
    },
    syncId: {
      type: DATA_TYPES.STRING,
      required: false,
      description: "ID de synchronisation ERPNext"
    },
    syncStatus: {
      type: DATA_TYPES.STRING,
      required: false,
      enum: ['pending', 'syncing', 'synced', 'error', 'conflict'],
      default: 'pending',
      description: "Statut de synchronisation"
    }
  }
};

/**
 * Schema de validation pour un Receipt (vente)
 */
export const receiptSchema = {
  name: 'Receipt',
  fields: {
    // Champs requis
    lines: {
      type: DATA_TYPES.ARRAY,
      required: true,
      minItems: 1,
      description: "Lignes de la vente",
      itemSchema: {
        item: { type: DATA_TYPES.STRING, required: true },
        qty: { type: DATA_TYPES.NUMBER, required: true, min: 0.001 },
        price: { type: DATA_TYPES.NUMBER, required: true, min: 0 }
      }
    },
    total: {
      type: DATA_TYPES.NUMBER,
      required: true,
      min: 0,
      description: "Total de la vente"
    },
    payment: {
      type: DATA_TYPES.OBJECT,
      required: true,
      description: "Informations de paiement",
      objectSchema: {
        type: { type: DATA_TYPES.STRING, required: true },
        amount: { type: DATA_TYPES.NUMBER, required: true, min: 0 }
      }
    },

    // Champs optionnels
    date: {
      type: DATA_TYPES.DATE,
      required: false,
      default: () => new Date().toISOString(),
      description: "Date de la vente"
    },
    receiptNumber: {
      type: DATA_TYPES.NUMBER,
      required: false,
      min: 1,
      description: "Numero de ticket"
    },
    customer: {
      type: DATA_TYPES.STRING,
      required: false,
      description: "ID ou nom du client"
    },
    customerName: {
      type: DATA_TYPES.STRING,
      required: false,
      description: "Nom du client"
    },
    subtotal: {
      type: DATA_TYPES.NUMBER,
      required: false,
      min: 0,
      description: "Sous-total avant taxes"
    },
    taxesValue: {
      type: DATA_TYPES.NUMBER,
      required: false,
      min: 0,
      default: 0,
      description: "Montant des taxes"
    },
    discountValue: {
      type: DATA_TYPES.NUMBER,
      required: false,
      min: 0,
      default: 0,
      description: "Montant de la remise"
    },
    status: {
      type: DATA_TYPES.STRING,
      required: false,
      enum: ['draft', 'completed', 'cancelled', 'refunded'],
      default: 'completed',
      description: "Statut de la vente"
    },
    syncId: {
      type: DATA_TYPES.STRING,
      required: false,
      description: "ID de synchronisation ERPNext"
    },
    syncStatus: {
      type: DATA_TYPES.STRING,
      required: false,
      enum: ['pending', 'syncing', 'synced', 'error', 'conflict'],
      default: 'pending',
      description: "Statut de synchronisation"
    }
  }
};

/**
 * Schema de validation pour la configuration API
 */
export const configSchema = {
  name: 'ApiConfig',
  fields: {
    serverUrl: {
      type: DATA_TYPES.URL,
      required: true,
      description: "URL du serveur ERPNext"
    },
    username: {
      type: DATA_TYPES.STRING,
      required: true,
      minLength: 1,
      description: "Nom d'utilisateur"
    },
    password: {
      type: DATA_TYPES.STRING,
      required: true,
      minLength: 1,
      description: "Mot de passe"
    },
    warehouse: {
      type: DATA_TYPES.STRING,
      required: false,
      default: "Main Store - MS",
      description: "Entrepot par defaut"
    },
    priceList: {
      type: DATA_TYPES.STRING,
      required: false,
      default: "Standard Selling",
      description: "Liste de prix"
    },
    company: {
      type: DATA_TYPES.STRING,
      required: false,
      description: "Nom de la company"
    },
    posProfile: {
      type: DATA_TYPES.STRING,
      required: false,
      default: "Default POS Profile",
      description: "Profil POS"
    }
  }
};

/**
 * Schema de validation pour une categorie
 */
export const categorySchema = {
  name: 'Category',
  fields: {
    name: {
      type: DATA_TYPES.STRING,
      required: true,
      minLength: 1,
      maxLength: 100,
      description: "Nom de la categorie"
    },
    colorAndShape: {
      type: DATA_TYPES.ARRAY,
      required: false,
      description: "Couleur et forme pour l'affichage"
    },
    syncId: {
      type: DATA_TYPES.STRING,
      required: false,
      description: "ID de synchronisation ERPNext"
    }
  }
};

// ============================================================================
// CLASSE D'ERREUR DE VALIDATION
// ============================================================================

/**
 * Erreur de validation personnalisee
 */
export class ValidationError extends Error {
  /**
   * Cree une nouvelle erreur de validation
   * @param {string} message - Message d'erreur
   * @param {string} field - Champ concerne
   * @param {*} value - Valeur invalide
   * @param {string} rule - Regle violee
   */
  constructor(message, field = null, value = null, rule = null) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.value = value;
    this.rule = rule;
    this.timestamp = new Date().toISOString();
  }

  /**
   * Retourne une representation JSON de l'erreur
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      field: this.field,
      rule: this.rule,
      timestamp: this.timestamp
    };
  }
}

// ============================================================================
// FONCTIONS DE VALIDATION DE TYPE
// ============================================================================

/**
 * Valide une chaine de caracteres
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateString(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined) {
    if (rules.required) {
      errors.push("La valeur est requise");
    }
    return { valid: !rules.required, errors };
  }

  if (typeof value !== 'string') {
    errors.push("La valeur doit etre une chaine de caracteres");
    return { valid: false, errors };
  }

  if (rules.minLength && value.length < rules.minLength) {
    errors.push(`Minimum ${rules.minLength} caracteres requis`);
  }

  if (rules.maxLength && value.length > rules.maxLength) {
    errors.push(`Maximum ${rules.maxLength} caracteres autorises`);
  }

  if (rules.pattern && !rules.pattern.test(value)) {
    errors.push("Format invalide");
  }

  if (rules.enum && !rules.enum.includes(value)) {
    errors.push(`Valeur doit etre parmi: ${rules.enum.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide un nombre
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateNumber(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined) {
    if (rules.required) {
      errors.push("La valeur est requise");
    }
    return { valid: !rules.required, errors };
  }

  const num = parseFloat(value);
  if (isNaN(num)) {
    errors.push("La valeur doit etre un nombre");
    return { valid: false, errors };
  }

  if (rules.min !== undefined && num < rules.min) {
    errors.push(`La valeur minimale est ${rules.min}`);
  }

  if (rules.max !== undefined && num > rules.max) {
    errors.push(`La valeur maximale est ${rules.max}`);
  }

  if (rules.integer && !Number.isInteger(num)) {
    errors.push("La valeur doit etre un entier");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide un booleen
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateBoolean(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined) {
    if (rules.required) {
      errors.push("La valeur est requise");
    }
    return { valid: !rules.required, errors };
  }

  if (typeof value !== 'boolean') {
    // Accepter aussi 0/1
    if (value !== 0 && value !== 1) {
      errors.push("La valeur doit etre un booleen");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide un tableau
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateArray(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined) {
    if (rules.required) {
      errors.push("La valeur est requise");
    }
    return { valid: !rules.required, errors };
  }

  if (!Array.isArray(value)) {
    errors.push("La valeur doit etre un tableau");
    return { valid: false, errors };
  }

  if (rules.minItems && value.length < rules.minItems) {
    errors.push(`Minimum ${rules.minItems} elements requis`);
  }

  if (rules.maxItems && value.length > rules.maxItems) {
    errors.push(`Maximum ${rules.maxItems} elements autorises`);
  }

  // Valider chaque element si un schema d'item est fourni
  if (rules.itemSchema && value.length > 0) {
    value.forEach((item, index) => {
      const itemResult = validateObject(item, { objectSchema: rules.itemSchema });
      if (!itemResult.valid) {
        errors.push(`Element ${index + 1}: ${itemResult.errors.join(', ')}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide un objet
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateObject(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined) {
    if (rules.required) {
      errors.push("La valeur est requise");
    }
    return { valid: !rules.required, errors };
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    errors.push("La valeur doit etre un objet");
    return { valid: false, errors };
  }

  // Valider les proprietes si un schema est fourni
  if (rules.objectSchema) {
    for (const [fieldName, fieldRules] of Object.entries(rules.objectSchema)) {
      const fieldValue = value[fieldName];
      const fieldResult = validateField(fieldValue, fieldRules);
      if (!fieldResult.valid) {
        errors.push(`${fieldName}: ${fieldResult.errors.join(', ')}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide une date
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateDate(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined) {
    if (rules.required) {
      errors.push("La valeur est requise");
    }
    return { valid: !rules.required, errors };
  }

  let date;
  if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value);
  }

  if (isNaN(date.getTime())) {
    errors.push("Format de date invalide");
    return { valid: false, errors };
  }

  if (rules.minDate && date < new Date(rules.minDate)) {
    errors.push(`La date doit etre apres ${rules.minDate}`);
  }

  if (rules.maxDate && date > new Date(rules.maxDate)) {
    errors.push(`La date doit etre avant ${rules.maxDate}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide une adresse email
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateEmail(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined || value === '') {
    if (rules.required) {
      errors.push("L'email est requis");
    }
    return { valid: !rules.required, errors };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    errors.push("Format d'email invalide");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide un numero de telephone
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validatePhone(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined || value === '') {
    if (rules.required) {
      errors.push("Le telephone est requis");
    }
    return { valid: !rules.required, errors };
  }

  // Pattern flexible pour les numeros internationaux
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]*$/;
  if (!phoneRegex.test(value)) {
    errors.push("Format de telephone invalide");
  }

  // Verifier la longueur minimale (au moins 6 chiffres)
  const digitsOnly = value.replace(/\D/g, '');
  if (digitsOnly.length < 6) {
    errors.push("Le numero de telephone est trop court");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide une URL
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateUrl(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined || value === '') {
    if (rules.required) {
      errors.push("L'URL est requise");
    }
    return { valid: !rules.required, errors };
  }

  // Pattern pour HTTP/HTTPS URLs
  const urlRegex = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
  if (!urlRegex.test(value)) {
    errors.push("Format d'URL invalide (doit commencer par http:// ou https://)");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide un UUID
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateUuid(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined || value === '') {
    if (rules.required) {
      errors.push("L'UUID est requis");
    }
    return { valid: !rules.required, errors };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    errors.push("Format UUID invalide");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Valide un code-barres
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateBarcode(value, rules = {}) {
  const errors = [];

  if (value === null || value === undefined || value === '') {
    if (rules.required) {
      errors.push("Le code-barres est requis");
    }
    return { valid: !rules.required, errors };
  }

  // Verifier que c'est une chaine numerique
  if (!/^\d+$/.test(value)) {
    errors.push("Le code-barres doit contenir uniquement des chiffres");
    return { valid: false, errors };
  }

  // Verifier la longueur (EAN-8, EAN-13, UPC-A, etc.)
  const validLengths = [8, 12, 13, 14];
  if (!validLengths.includes(value.length)) {
    errors.push(`Longueur de code-barres invalide (attendu: ${validLengths.join(', ')} chiffres)`);
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// FONCTION DE VALIDATION PRINCIPALE
// ============================================================================

/**
 * Valide un champ selon ses regles
 * @param {*} value - Valeur a valider
 * @param {Object} rules - Regles de validation
 * @returns {Object} Resultat de validation
 */
function validateField(value, rules) {
  const type = rules.type || DATA_TYPES.STRING;

  switch (type) {
    case DATA_TYPES.STRING:
      return validateString(value, rules);
    case DATA_TYPES.NUMBER:
      return validateNumber(value, rules);
    case DATA_TYPES.BOOLEAN:
      return validateBoolean(value, rules);
    case DATA_TYPES.ARRAY:
      return validateArray(value, rules);
    case DATA_TYPES.OBJECT:
      return validateObject(value, rules);
    case DATA_TYPES.DATE:
      return validateDate(value, rules);
    case DATA_TYPES.EMAIL:
      return validateEmail(value, rules);
    case DATA_TYPES.PHONE:
      return validatePhone(value, rules);
    case DATA_TYPES.URL:
      return validateUrl(value, rules);
    case DATA_TYPES.UUID:
      return validateUuid(value, rules);
    case DATA_TYPES.BARCODE:
      return validateBarcode(value, rules);
    default:
      return { valid: true, errors: [] };
  }
}

/**
 * Valide des donnees selon un schema
 *
 * @param {Object} data - Donnees a valider
 * @param {Object} schema - Schema de validation
 * @returns {Object} Resultat { valid: boolean, errors: Object[], warnings: string[] }
 */
export function validate(data, schema) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    data: data
  };

  if (!data) {
    result.valid = false;
    result.errors.push({
      field: null,
      message: "Les donnees sont null ou undefined"
    });
    return result;
  }

  if (!schema || !schema.fields) {
    result.warnings.push("Aucun schema fourni, validation ignoree");
    return result;
  }

  // Valider chaque champ du schema
  for (const [fieldName, fieldRules] of Object.entries(schema.fields)) {
    const value = data[fieldName];
    const fieldResult = validateField(value, fieldRules);

    if (!fieldResult.valid) {
      result.valid = false;
      result.errors.push({
        field: fieldName,
        value: value,
        messages: fieldResult.errors,
        description: fieldRules.description
      });
    }

    // Appliquer la valeur par defaut si le champ est vide
    if ((value === null || value === undefined) && fieldRules.default !== undefined) {
      const defaultValue = typeof fieldRules.default === 'function'
        ? fieldRules.default()
        : fieldRules.default;
      result.data = { ...result.data, [fieldName]: defaultValue };
    }
  }

  return result;
}

// ============================================================================
// FONCTIONS DE VALIDATION SPECIALISEES
// ============================================================================

/**
 * Valide un item (produit)
 *
 * @param {Object} item - Item a valider
 * @returns {boolean} True si valide
 */
export function isValidItem(item) {
  const result = validate(item, itemSchema);
  return result.valid;
}

/**
 * Valide un item et retourne le resultat detaille
 *
 * @param {Object} item - Item a valider
 * @returns {Object} Resultat de validation
 */
export function validateItem(item) {
  return validate(item, itemSchema);
}

/**
 * Valide un customer (client)
 *
 * @param {Object} customer - Customer a valider
 * @returns {boolean} True si valide
 */
export function isValidCustomer(customer) {
  const result = validate(customer, customerSchema);
  return result.valid;
}

/**
 * Valide un customer et retourne le resultat detaille
 *
 * @param {Object} customer - Customer a valider
 * @returns {Object} Resultat de validation
 */
export function validateCustomer(customer) {
  return validate(customer, customerSchema);
}

/**
 * Valide un receipt (vente)
 *
 * @param {Object} receipt - Receipt a valider
 * @returns {boolean} True si valide
 */
export function isValidReceipt(receipt) {
  const result = validate(receipt, receiptSchema);
  return result.valid;
}

/**
 * Valide un receipt et retourne le resultat detaille
 *
 * @param {Object} receipt - Receipt a valider
 * @returns {Object} Resultat de validation
 */
export function validateReceipt(receipt) {
  return validate(receipt, receiptSchema);
}

/**
 * Valide une configuration API
 *
 * @param {Object} config - Configuration a valider
 * @returns {boolean} True si valide
 */
export function isValidConfig(config) {
  const result = validate(config, configSchema);
  return result.valid;
}

/**
 * Valide une configuration et retourne le resultat detaille
 *
 * @param {Object} config - Configuration a valider
 * @returns {Object} Resultat de validation
 */
export function validateConfig(config) {
  return validate(config, configSchema);
}

/**
 * Valide une categorie
 *
 * @param {Object} category - Categorie a valider
 * @returns {boolean} True si valide
 */
export function isValidCategory(category) {
  const result = validate(category, categorySchema);
  return result.valid;
}

/**
 * Valide une categorie et retourne le resultat detaille
 *
 * @param {Object} category - Categorie a valider
 * @returns {Object} Resultat de validation
 */
export function validateCategory(category) {
  return validate(category, categorySchema);
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Nettoie et normalise les donnees selon un schema
 *
 * @param {Object} data - Donnees a nettoyer
 * @param {Object} schema - Schema a utiliser
 * @returns {Object} Donnees nettoyees
 */
export function sanitizeData(data, schema) {
  if (!data || !schema || !schema.fields) {
    return data;
  }

  const sanitized = {};

  for (const [fieldName, fieldRules] of Object.entries(schema.fields)) {
    let value = data[fieldName];

    // Appliquer la valeur par defaut si vide
    if (value === null || value === undefined) {
      if (fieldRules.default !== undefined) {
        value = typeof fieldRules.default === 'function'
          ? fieldRules.default()
          : fieldRules.default;
      }
    }

    // Normaliser selon le type
    if (value !== null && value !== undefined) {
      switch (fieldRules.type) {
        case DATA_TYPES.STRING:
        case DATA_TYPES.EMAIL:
        case DATA_TYPES.PHONE:
        case DATA_TYPES.URL:
          value = String(value).trim();
          break;
        case DATA_TYPES.NUMBER:
          value = parseFloat(value) || 0;
          break;
        case DATA_TYPES.BOOLEAN:
          value = Boolean(value);
          break;
      }
    }

    if (value !== undefined) {
      sanitized[fieldName] = value;
    }
  }

  // Conserver les champs non definis dans le schema
  for (const [key, value] of Object.entries(data)) {
    if (!(key in sanitized)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extrait les erreurs de validation sous forme de messages lisibles
 *
 * @param {Object} validationResult - Resultat de validation
 * @returns {string[]} Liste de messages d'erreur
 */
export function getErrorMessages(validationResult) {
  if (!validationResult || !validationResult.errors) {
    return [];
  }

  return validationResult.errors.map(error => {
    if (error.field) {
      return `${error.field}: ${error.messages.join(', ')}`;
    }
    return error.message || "Erreur de validation";
  });
}

// ============================================================================
// EXPORT PAR DEFAUT
// ============================================================================

/**
 * Export par defaut - Objet DataValidator avec toutes les fonctions
 */
const DataValidator = {
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
  ValidationError
};

export default DataValidator;
