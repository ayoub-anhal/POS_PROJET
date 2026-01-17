/**
 * DataMapper.js
 *
 * Module de transformation bidirectionnelle des donnees entre ERPNext et TailPOS.
 * Gere le mapping des produits, clients, ventes et categories.
 *
 * @author TailPOS Integration
 * @version 2.0.0
 * @date 2025-01-17
 */

// ============================================================================
// CONSTANTES DE MAPPING
// ============================================================================

/**
 * Statuts de synchronisation
 */
export const SYNC_STATUS = {
  PENDING: "pending",
  SYNCING: "syncing",
  SYNCED: "synced",
  ERROR: "error",
  CONFLICT: "conflict"
};

/**
 * Types de paiement avec correspondance ERPNext <-> TailPOS
 */
export const PAYMENT_TYPES = {
  CASH: { tailpos: "Cash", erp: "Cash" },
  CARD: { tailpos: "Card", erp: "Credit Card" },
  CREDIT_CARD: { tailpos: "Card", erp: "Credit Card" },
  MOBILE: { tailpos: "Mobile", erp: "Mobile Money" },
  BANK: { tailpos: "Bank", erp: "Bank Transfer" },
  CHEQUE: { tailpos: "Cheque", erp: "Cheque" }
};

/**
 * Couleurs par defaut pour les categories TailPOS
 */
export const DEFAULT_COLORS = [
  "red", "blue", "green", "yellow", "purple",
  "orange", "gray", "pink", "teal", "indigo"
];

/**
 * Formes par defaut pour les categories TailPOS
 */
export const DEFAULT_SHAPES = ["circle", "square", "triangle", "star", "diamond"];

/**
 * Mapping des champs entre ERPNext et TailPOS
 */
export const FIELD_MAPPINGS = {
  item: {
    "item_code": "sku",
    "item_name": "name",
    "standard_rate": "price",
    "barcode": "barcode",
    "item_group": "category",
    "description": "description",
    "image": "image",
    "stock_qty": "stock"
  },
  customer: {
    "customer_name": "name",
    "email_id": "email",
    "mobile_no": "phoneNumber",
    "primary_address": "address"
  },
  receipt: {
    "grand_total": "total",
    "base_net_total": "subtotal",
    "total_taxes_and_charges": "taxesValue"
  }
};

/**
 * Configuration par defaut pour le mapping
 */
export const DEFAULT_MAPPING_CONFIG = {
  currency: "EUR",
  company: "My Company",
  warehouse: "Main Store - MS",
  priceList: "Standard Selling",
  posProfile: "Default POS Profile",
  taxRate: 20,
  decimalPlaces: 2
};

// ============================================================================
// CLASSE D'ERREUR DE MAPPING
// ============================================================================

/**
 * Erreur personnalisee pour les problemes de mapping
 */
export class MappingError extends Error {
  /**
   * Cree une nouvelle erreur de mapping
   * @param {string} message - Message d'erreur
   * @param {string} field - Champ concerne
   * @param {*} sourceData - Donnees source
   */
  constructor(message, field = null, sourceData = null) {
    super(message);
    this.name = "MappingError";
    this.field = field;
    this.sourceData = sourceData;
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
      timestamp: this.timestamp
    };
  }
}

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Genere un UUID v4 unique
 * @returns {string} UUID genere
 */
export function generateUUID() {
  // Implementation compatible React Native
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Formate une date au format YYYY-MM-DD
 * @param {Date|string} date - Date a formater
 * @returns {string} Date formatee
 */
export function formatDate(date) {
  if (!date) return new Date().toISOString().split('T')[0];

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];

  return d.toISOString().split('T')[0];
}

/**
 * Formate une heure au format HH:mm:ss
 * @param {Date|string} date - Date/heure a formater
 * @returns {string} Heure formatee
 */
export function formatTime(date) {
  if (!date) return new Date().toISOString().split('T')[1].split('.')[0];

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[1].split('.')[0];

  return d.toISOString().split('T')[1].split('.')[0];
}

/**
 * Formate une date au format ISO
 * @param {Date|string} date - Date a formater
 * @returns {string} Date ISO
 */
export function formatDateTime(date) {
  if (!date) return new Date().toISOString();

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString();

  return d.toISOString();
}

/**
 * Parse une chaine de date en objet Date
 * @param {string} dateString - Chaine de date
 * @returns {Date|null} Objet Date ou null
 */
export function parseDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Genere un code-barres a partir d'un code article
 * @param {string} itemCode - Code de l'article
 * @returns {string} Code-barres EAN-13
 */
export function generateBarcode(itemCode) {
  if (!itemCode) return "";

  // Generer un code numerique a partir du code article
  let numericCode = "";
  for (let i = 0; i < itemCode.length && numericCode.length < 12; i++) {
    const char = itemCode.charCodeAt(i);
    numericCode += (char % 10).toString();
  }

  // Completer a 12 chiffres
  while (numericCode.length < 12) {
    numericCode += "0";
  }
  numericCode = numericCode.substring(0, 12);

  // Calculer le chiffre de controle EAN-13
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(numericCode[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;

  return numericCode + checkDigit.toString();
}

/**
 * Genere une couleur et forme aleatoire pour une categorie
 * @param {string} categoryName - Nom de la categorie
 * @returns {Array<Object>} Tableau colorAndShape
 */
export function generateColorShape(categoryName) {
  // Utiliser le nom de la categorie pour generer une couleur deterministe
  let hash = 0;
  const name = categoryName || "default";
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;
  }

  const colorIndex = Math.abs(hash) % DEFAULT_COLORS.length;
  const shapeIndex = Math.abs(hash >> 4) % DEFAULT_SHAPES.length;

  return [{
    color: DEFAULT_COLORS[colorIndex],
    shape: DEFAULT_SHAPES[shapeIndex]
  }];
}

/**
 * Nettoie une chaine de caracteres
 * @param {string} str - Chaine a nettoyer
 * @returns {string} Chaine nettoyee
 */
export function sanitizeString(str) {
  if (str === null || str === undefined) return "";
  return String(str).trim();
}

/**
 * Arrondit un prix au nombre de decimales specifie
 * @param {number} price - Prix a arrondir
 * @param {number} decimals - Nombre de decimales (defaut: 2)
 * @returns {number} Prix arrondi
 */
export function roundPrice(price, decimals = 2) {
  if (price === null || price === undefined || isNaN(price)) return 0;
  const multiplier = Math.pow(10, decimals);
  return Math.round(parseFloat(price) * multiplier) / multiplier;
}

/**
 * Convertit une valeur en nombre
 * @param {*} value - Valeur a convertir
 * @param {number} defaultValue - Valeur par defaut
 * @returns {number} Nombre converti
 */
export function toNumber(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue;
  const num = parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Verifie si une valeur est vide (null, undefined, chaine vide)
 * @param {*} value - Valeur a verifier
 * @returns {boolean} True si vide
 */
export function isEmpty(value) {
  return value === null || value === undefined || value === "";
}

/**
 * Mode debug pour les logs
 */
let debugMode = false;

/**
 * Active/desactive le mode debug
 * @param {boolean} enabled - Activer le debug
 */
export function setDebugMode(enabled) {
  debugMode = enabled;
}

/**
 * Log de debug
 * @param {string} message - Message a logger
 * @param {*} data - Donnees supplementaires
 */
function debugLog(message, data = null) {
  if (debugMode) {
    console.log(`[DataMapper] ${message}`, data || "");
  }
}

// ============================================================================
// MAPPING DES PRODUITS (Items)
// ============================================================================

/**
 * Convertit un Item ERPNext en Product TailPOS
 *
 * @param {Object} erpItem - Item au format ERPNext
 * @returns {Object} Product au format TailPOS
 * @throws {MappingError} Si l'item est invalide
 */
export function mapErpItemToTailposProduct(erpItem) {
  debugLog("Mapping ERPNext Item -> TailPOS Product", erpItem?.item_code);

  if (!erpItem) {
    throw new MappingError("Item ERPNext null ou undefined", "erpItem");
  }

  try {
    // Extraire le code-barres
    let barcode = "";
    if (erpItem.barcodes && erpItem.barcodes.length > 0) {
      barcode = erpItem.barcodes[0].barcode || "";
    } else if (erpItem.barcode) {
      barcode = erpItem.barcode;
    }

    // Extraire le stock
    let stockQty = 0;
    if (erpItem.stock_qty !== undefined) {
      stockQty = toNumber(erpItem.stock_qty, 0);
    } else if (erpItem.actual_qty !== undefined) {
      stockQty = toNumber(erpItem.actual_qty, 0);
    } else if (erpItem.bin && erpItem.bin.length > 0) {
      stockQty = toNumber(erpItem.bin[0].actual_qty, 0);
    }

    // Construire le produit TailPOS
    const tailposProduct = {
      _id: generateUUID(),
      name: sanitizeString(erpItem.item_name || erpItem.name),
      price: roundPrice(erpItem.standard_rate || 0),
      sku: sanitizeString(erpItem.item_code || erpItem.name),
      barcode: sanitizeString(barcode),
      category: sanitizeString(erpItem.item_group || "Products"),
      colorAndShape: generateColorShape(erpItem.item_group),
      taxes: 0, // Sera calcule separement si necessaire
      description: sanitizeString(erpItem.description || ""),
      image: sanitizeString(erpItem.image || ""),
      stock: stockQty,
      soldBy: "Each",
      syncStatus: SYNC_STATUS.SYNCED,
      syncId: sanitizeString(erpItem.name || erpItem.item_code),
      dateUpdated: formatDateTime(new Date()),

      // Champs supplementaires pour reference
      _erpData: {
        name: erpItem.name,
        item_code: erpItem.item_code,
        stock_uom: erpItem.stock_uom,
        is_stock_item: erpItem.is_stock_item,
        has_variants: erpItem.has_variants,
        variant_of: erpItem.variant_of,
        disabled: erpItem.disabled
      }
    };

    debugLog("Product TailPOS cree", tailposProduct.sku);
    return tailposProduct;

  } catch (error) {
    throw new MappingError(
      `Erreur mapping item: ${error.message}`,
      "erpItem",
      erpItem
    );
  }
}

/**
 * Convertit un Product TailPOS en Item ERPNext
 *
 * @param {Object} tailposProduct - Product au format TailPOS
 * @param {Object} config - Configuration optionnelle
 * @returns {Object} Item au format ERPNext
 * @throws {MappingError} Si le produit est invalide
 */
export function mapTailposProductToErpItem(tailposProduct, config = {}) {
  debugLog("Mapping TailPOS Product -> ERPNext Item", tailposProduct?.sku);

  if (!tailposProduct) {
    throw new MappingError("Product TailPOS null ou undefined", "tailposProduct");
  }

  const cfg = { ...DEFAULT_MAPPING_CONFIG, ...config };

  try {
    const erpItem = {
      doctype: "Item",
      item_code: sanitizeString(tailposProduct.sku || tailposProduct.syncId),
      item_name: sanitizeString(tailposProduct.name),
      item_group: sanitizeString(tailposProduct.category || "Products"),
      stock_uom: "Nos",
      is_stock_item: 1,
      is_sales_item: 1,
      is_purchase_item: 1,
      include_item_in_manufacturing: 0,
      standard_rate: roundPrice(tailposProduct.price),
      description: sanitizeString(tailposProduct.description || tailposProduct.name),
      disabled: 0
    };

    // Ajouter le code-barres si present
    if (tailposProduct.barcode) {
      erpItem.barcodes = [{
        barcode: sanitizeString(tailposProduct.barcode),
        barcode_type: "EAN"
      }];
    }

    // Ajouter l'image si presente
    if (tailposProduct.image && !tailposProduct.image.startsWith("data:")) {
      erpItem.image = tailposProduct.image;
    }

    debugLog("Item ERPNext cree", erpItem.item_code);
    return erpItem;

  } catch (error) {
    throw new MappingError(
      `Erreur mapping product: ${error.message}`,
      "tailposProduct",
      tailposProduct
    );
  }
}

/**
 * Convertit une liste d'Items ERPNext en Products TailPOS
 *
 * @param {Array} erpItems - Liste d'items ERPNext
 * @returns {Array} Liste de products TailPOS
 */
export function mapItemsList(erpItems) {
  debugLog(`Mapping ${erpItems?.length || 0} items ERPNext`);

  if (!erpItems || !Array.isArray(erpItems)) {
    return [];
  }

  const products = [];
  const errors = [];

  for (const item of erpItems) {
    try {
      // Ignorer les items desactives
      if (item.disabled === 1) {
        debugLog("Item ignore (disabled)", item.item_code);
        continue;
      }

      const product = mapErpItemToTailposProduct(item);
      products.push(product);
    } catch (error) {
      errors.push({
        item_code: item?.item_code,
        error: error.message
      });
      debugLog("Erreur mapping item", { item_code: item?.item_code, error: error.message });
    }
  }

  if (errors.length > 0) {
    console.warn(`[DataMapper] ${errors.length} erreurs lors du mapping des items`);
  }

  debugLog(`${products.length} products mappes avec succes`);
  return products;
}

// ============================================================================
// MAPPING DES CLIENTS (Customers)
// ============================================================================

/**
 * Convertit un Customer ERPNext en Customer TailPOS
 *
 * @param {Object} erpCustomer - Customer au format ERPNext
 * @returns {Object} Customer au format TailPOS
 * @throws {MappingError} Si le customer est invalide
 */
export function mapErpCustomerToTailpos(erpCustomer) {
  debugLog("Mapping ERPNext Customer -> TailPOS Customer", erpCustomer?.name);

  if (!erpCustomer) {
    throw new MappingError("Customer ERPNext null ou undefined", "erpCustomer");
  }

  try {
    // Extraire l'adresse
    let address = "";
    if (erpCustomer.primary_address) {
      address = erpCustomer.primary_address;
    } else if (erpCustomer.customer_primary_address) {
      address = erpCustomer.customer_primary_address;
    }

    const tailposCustomer = {
      _id: generateUUID(),
      name: sanitizeString(erpCustomer.customer_name || erpCustomer.name),
      email: sanitizeString(erpCustomer.email_id || ""),
      phoneNumber: sanitizeString(erpCustomer.mobile_no || erpCustomer.phone || ""),
      address: sanitizeString(address),
      note: sanitizeString(erpCustomer.customer_details || ""),
      syncStatus: SYNC_STATUS.SYNCED,
      syncId: sanitizeString(erpCustomer.name),
      dateUpdated: formatDateTime(new Date()),

      // Donnees supplementaires
      _erpData: {
        name: erpCustomer.name,
        customer_type: erpCustomer.customer_type,
        customer_group: erpCustomer.customer_group,
        territory: erpCustomer.territory,
        disabled: erpCustomer.disabled
      }
    };

    debugLog("Customer TailPOS cree", tailposCustomer.name);
    return tailposCustomer;

  } catch (error) {
    throw new MappingError(
      `Erreur mapping customer: ${error.message}`,
      "erpCustomer",
      erpCustomer
    );
  }
}

/**
 * Convertit un Customer TailPOS en Customer ERPNext
 *
 * @param {Object} tailposCustomer - Customer au format TailPOS
 * @returns {Object} Customer au format ERPNext
 * @throws {MappingError} Si le customer est invalide
 */
export function mapTailposCustomerToErp(tailposCustomer) {
  debugLog("Mapping TailPOS Customer -> ERPNext Customer", tailposCustomer?.name);

  if (!tailposCustomer) {
    throw new MappingError("Customer TailPOS null ou undefined", "tailposCustomer");
  }

  try {
    const erpCustomer = {
      doctype: "Customer",
      customer_name: sanitizeString(tailposCustomer.name),
      customer_type: "Individual",
      customer_group: "Individual",
      territory: "All Territories"
    };

    // Ajouter l'email si present
    if (tailposCustomer.email) {
      erpCustomer.email_id = sanitizeString(tailposCustomer.email);
    }

    // Ajouter le telephone si present
    if (tailposCustomer.phoneNumber) {
      erpCustomer.mobile_no = sanitizeString(tailposCustomer.phoneNumber);
    }

    // Utiliser syncId comme nom si disponible
    if (tailposCustomer.syncId) {
      erpCustomer.name = tailposCustomer.syncId;
    }

    debugLog("Customer ERPNext cree", erpCustomer.customer_name);
    return erpCustomer;

  } catch (error) {
    throw new MappingError(
      `Erreur mapping customer: ${error.message}`,
      "tailposCustomer",
      tailposCustomer
    );
  }
}

/**
 * Convertit une liste de Customers ERPNext en Customers TailPOS
 *
 * @param {Array} erpCustomers - Liste de customers ERPNext
 * @returns {Array} Liste de customers TailPOS
 */
export function mapCustomersList(erpCustomers) {
  debugLog(`Mapping ${erpCustomers?.length || 0} customers ERPNext`);

  if (!erpCustomers || !Array.isArray(erpCustomers)) {
    return [];
  }

  const customers = [];

  for (const customer of erpCustomers) {
    try {
      // Ignorer les customers desactives
      if (customer.disabled === 1) {
        continue;
      }

      const mapped = mapErpCustomerToTailpos(customer);
      customers.push(mapped);
    } catch (error) {
      debugLog("Erreur mapping customer", { name: customer?.name, error: error.message });
    }
  }

  debugLog(`${customers.length} customers mappes avec succes`);
  return customers;
}

// ============================================================================
// MAPPING DES VENTES (Receipts / POS Invoices)
// ============================================================================

/**
 * Convertit un Receipt TailPOS en POS Invoice ERPNext
 *
 * @param {Object} receipt - Receipt au format TailPOS
 * @param {Object} config - Configuration (company, warehouse, etc.)
 * @returns {Object} POS Invoice au format ERPNext
 * @throws {MappingError} Si le receipt est invalide
 */
export function mapTailposReceiptToErpInvoice(receipt, config = {}) {
  debugLog("Mapping TailPOS Receipt -> ERPNext POS Invoice", receipt?.receiptNumber);

  if (!receipt) {
    throw new MappingError("Receipt TailPOS null ou undefined", "receipt");
  }

  const cfg = { ...DEFAULT_MAPPING_CONFIG, ...config };

  try {
    const receiptDate = parseDate(receipt.date) || new Date();

    // Determiner le client
    let customerName = cfg.defaultCustomer || "Walk-in Customer";
    if (receipt.customer && receipt.customer !== "walk-in") {
      customerName = receipt.customerName || receipt.customer;
    }

    // Construire la facture POS
    const posInvoice = {
      doctype: "POS Invoice",
      naming_series: "ACC-PSINV-.YYYY.-",
      customer: customerName,
      posting_date: formatDate(receiptDate),
      posting_time: formatTime(receiptDate),
      due_date: formatDate(receiptDate),
      company: cfg.company,
      currency: cfg.currency,
      selling_price_list: cfg.priceList,
      price_list_currency: cfg.currency,
      pos_profile: cfg.posProfile,
      is_pos: 1,
      update_stock: 1,
      set_warehouse: cfg.warehouse,

      // Items
      items: mapReceiptLines(receipt.lines || [], cfg),

      // Paiements
      payments: mapPayment(receipt.payment, cfg),

      // Totaux
      base_net_total: roundPrice(receipt.subtotal || 0),
      net_total: roundPrice(receipt.subtotal || 0),
      base_grand_total: roundPrice(receipt.total || 0),
      grand_total: roundPrice(receipt.total || 0),
      paid_amount: roundPrice(receipt.payment?.amount || receipt.total || 0),
      change_amount: roundPrice(receipt.payment?.change || 0),

      // Statut
      docstatus: 0, // Brouillon, sera soumis apres

      // Reference TailPOS
      tailpos_receipt_id: receipt._id,
      tailpos_receipt_number: receipt.receiptNumber
    };

    // Ajouter les taxes si presentes
    if (receipt.taxesValue && receipt.taxesValue > 0) {
      posInvoice.taxes = [{
        charge_type: "On Net Total",
        account_head: cfg.taxAccount || `VAT - ${cfg.company.substring(0, 2).toUpperCase()}`,
        description: "TVA",
        rate: cfg.taxRate || 20,
        tax_amount: roundPrice(receipt.taxesValue)
      }];
      posInvoice.total_taxes_and_charges = roundPrice(receipt.taxesValue);
    }

    // Ajouter la remise si presente
    if (receipt.discountValue && receipt.discountValue > 0) {
      posInvoice.discount_amount = roundPrice(receipt.discountValue);
      posInvoice.apply_discount_on = "Grand Total";
    }

    debugLog("POS Invoice ERPNext cree", posInvoice.tailpos_receipt_number);
    return posInvoice;

  } catch (error) {
    throw new MappingError(
      `Erreur mapping receipt: ${error.message}`,
      "receipt",
      receipt
    );
  }
}

/**
 * Convertit une POS Invoice ERPNext en Receipt TailPOS
 *
 * @param {Object} invoice - POS Invoice au format ERPNext
 * @returns {Object} Receipt au format TailPOS
 * @throws {MappingError} Si l'invoice est invalide
 */
export function mapErpInvoiceToTailposReceipt(invoice) {
  debugLog("Mapping ERPNext POS Invoice -> TailPOS Receipt", invoice?.name);

  if (!invoice) {
    throw new MappingError("POS Invoice ERPNext null ou undefined", "invoice");
  }

  try {
    // Parser la date et l'heure
    const postingDate = invoice.posting_date || formatDate(new Date());
    const postingTime = invoice.posting_time || formatTime(new Date());
    const dateTime = new Date(`${postingDate}T${postingTime}`);

    // Mapper les lignes
    const lines = (invoice.items || []).map(item => ({
      item: item.item_code,
      item_name: item.item_name,
      qty: toNumber(item.qty, 1),
      price: roundPrice(item.rate),
      discount: roundPrice(item.discount_amount || 0),
      amount: roundPrice(item.amount)
    }));

    // Mapper le paiement
    const payment = {
      type: "Cash",
      amount: roundPrice(invoice.paid_amount || invoice.grand_total),
      received: roundPrice(invoice.paid_amount || invoice.grand_total),
      change: roundPrice(invoice.change_amount || 0)
    };

    if (invoice.payments && invoice.payments.length > 0) {
      const erpPayment = invoice.payments[0];
      payment.type = mapErpPaymentTypeToTailpos(erpPayment.mode_of_payment);
      payment.amount = roundPrice(erpPayment.amount);
    }

    const receipt = {
      _id: invoice.tailpos_receipt_id || generateUUID(),
      date: formatDateTime(dateTime),
      receiptNumber: extractReceiptNumber(invoice.name),
      customer: invoice.customer,
      customerName: invoice.customer_name || invoice.customer,
      lines: lines,
      taxesValue: roundPrice(invoice.total_taxes_and_charges || 0),
      discountValue: roundPrice(invoice.discount_amount || 0),
      subtotal: roundPrice(invoice.net_total),
      total: roundPrice(invoice.grand_total),
      payment: payment,
      syncStatus: SYNC_STATUS.SYNCED,
      syncId: invoice.name,
      status: invoice.docstatus === 1 ? "completed" : "draft",
      dateUpdated: formatDateTime(new Date())
    };

    debugLog("Receipt TailPOS cree", receipt.receiptNumber);
    return receipt;

  } catch (error) {
    throw new MappingError(
      `Erreur mapping invoice: ${error.message}`,
      "invoice",
      invoice
    );
  }
}

/**
 * Convertit les lignes de receipt TailPOS en items ERPNext
 *
 * @param {Array} lines - Lignes du receipt
 * @param {Object} config - Configuration
 * @returns {Array} Items au format ERPNext
 */
export function mapReceiptLines(lines, config = {}) {
  if (!lines || !Array.isArray(lines)) {
    return [];
  }

  const cfg = { ...DEFAULT_MAPPING_CONFIG, ...config };

  return lines.map((line, index) => {
    const qty = toNumber(line.qty, 1);
    const rate = roundPrice(line.price);
    const discount = roundPrice(line.discount || 0);
    const amount = roundPrice(qty * rate - discount);

    return {
      idx: index + 1,
      item_code: sanitizeString(line.item || line.sku),
      item_name: sanitizeString(line.item_name || line.name),
      qty: qty,
      rate: rate,
      amount: amount,
      discount_amount: discount,
      warehouse: cfg.warehouse,
      income_account: cfg.incomeAccount,
      cost_center: cfg.costCenter
    };
  });
}

/**
 * Convertit le paiement TailPOS en paiements ERPNext
 *
 * @param {Object} payment - Paiement TailPOS
 * @param {Object} config - Configuration
 * @returns {Array} Paiements au format ERPNext
 */
export function mapPayment(payment, config = {}) {
  if (!payment) {
    return [];
  }

  const cfg = { ...DEFAULT_MAPPING_CONFIG, ...config };

  // Trouver le mode de paiement ERPNext correspondant
  const paymentType = payment.type || "Cash";
  let modeOfPayment = "Cash";

  for (const [key, mapping] of Object.entries(PAYMENT_TYPES)) {
    if (mapping.tailpos.toLowerCase() === paymentType.toLowerCase()) {
      modeOfPayment = mapping.erp;
      break;
    }
  }

  return [{
    mode_of_payment: modeOfPayment,
    amount: roundPrice(payment.amount || 0),
    default: 1
  }];
}

/**
 * Convertit un type de paiement ERPNext en type TailPOS
 *
 * @param {string} erpPaymentType - Type de paiement ERPNext
 * @returns {string} Type de paiement TailPOS
 */
function mapErpPaymentTypeToTailpos(erpPaymentType) {
  if (!erpPaymentType) return "Cash";

  for (const [key, mapping] of Object.entries(PAYMENT_TYPES)) {
    if (mapping.erp.toLowerCase() === erpPaymentType.toLowerCase()) {
      return mapping.tailpos;
    }
  }

  return "Cash";
}

/**
 * Extrait le numero de receipt d'un nom d'invoice ERPNext
 *
 * @param {string} invoiceName - Nom de l'invoice (ex: ACC-PSINV-2024-00001)
 * @returns {number} Numero de receipt
 */
function extractReceiptNumber(invoiceName) {
  if (!invoiceName) return 0;

  // Extraire les chiffres a la fin du nom
  const match = invoiceName.match(/(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return 0;
}

// ============================================================================
// MAPPING DES CATEGORIES
// ============================================================================

/**
 * Convertit un Item Group ERPNext en Category TailPOS
 *
 * @param {Object} itemGroup - Item Group au format ERPNext
 * @returns {Object} Category au format TailPOS
 * @throws {MappingError} Si l'item group est invalide
 */
export function mapErpCategoryToTailpos(itemGroup) {
  debugLog("Mapping ERPNext Item Group -> TailPOS Category", itemGroup?.name);

  if (!itemGroup) {
    throw new MappingError("Item Group ERPNext null ou undefined", "itemGroup");
  }

  try {
    const category = {
      _id: generateUUID(),
      name: sanitizeString(itemGroup.item_group_name || itemGroup.name),
      colorAndShape: generateColorShape(itemGroup.name),
      syncStatus: SYNC_STATUS.SYNCED,
      syncId: sanitizeString(itemGroup.name),
      dateUpdated: formatDateTime(new Date()),

      // Donnees supplementaires
      _erpData: {
        name: itemGroup.name,
        parent_item_group: itemGroup.parent_item_group,
        is_group: itemGroup.is_group
      }
    };

    debugLog("Category TailPOS creee", category.name);
    return category;

  } catch (error) {
    throw new MappingError(
      `Erreur mapping category: ${error.message}`,
      "itemGroup",
      itemGroup
    );
  }
}

/**
 * Convertit une Category TailPOS en Item Group ERPNext
 *
 * @param {Object} category - Category au format TailPOS
 * @returns {Object} Item Group au format ERPNext
 * @throws {MappingError} Si la category est invalide
 */
export function mapTailposCategoryToErp(category) {
  debugLog("Mapping TailPOS Category -> ERPNext Item Group", category?.name);

  if (!category) {
    throw new MappingError("Category TailPOS null ou undefined", "category");
  }

  try {
    const itemGroup = {
      doctype: "Item Group",
      item_group_name: sanitizeString(category.name),
      parent_item_group: "All Item Groups",
      is_group: 0
    };

    // Utiliser syncId comme nom si disponible
    if (category.syncId) {
      itemGroup.name = category.syncId;
    }

    debugLog("Item Group ERPNext cree", itemGroup.item_group_name);
    return itemGroup;

  } catch (error) {
    throw new MappingError(
      `Erreur mapping category: ${error.message}`,
      "category",
      category
    );
  }
}

/**
 * Convertit une liste d'Item Groups ERPNext en Categories TailPOS
 *
 * @param {Array} itemGroups - Liste d'item groups ERPNext
 * @returns {Array} Liste de categories TailPOS
 */
export function mapCategoriesList(itemGroups) {
  debugLog(`Mapping ${itemGroups?.length || 0} item groups ERPNext`);

  if (!itemGroups || !Array.isArray(itemGroups)) {
    return [];
  }

  const categories = [];

  for (const group of itemGroups) {
    try {
      // Ignorer les groupes parents (is_group = 1)
      if (group.is_group === 1) {
        continue;
      }

      const mapped = mapErpCategoryToTailpos(group);
      categories.push(mapped);
    } catch (error) {
      debugLog("Erreur mapping category", { name: group?.name, error: error.message });
    }
  }

  debugLog(`${categories.length} categories mappees avec succes`);
  return categories;
}

// ============================================================================
// FONCTIONS DE VALIDATION
// ============================================================================

/**
 * Valide un mapping d'item
 *
 * @param {Object} item - Item a valider
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateItemMapping(item) {
  const errors = [];

  if (!item) {
    return { valid: false, errors: ["Item est null ou undefined"] };
  }

  // Verifier les champs requis pour TailPOS
  if (isEmpty(item.name) && isEmpty(item.item_name)) {
    errors.push("Le nom du produit est requis");
  }

  if (isEmpty(item.sku) && isEmpty(item.item_code)) {
    errors.push("Le code produit (SKU) est requis");
  }

  if ((item.price === undefined && item.standard_rate === undefined) ||
      (item.price < 0 || item.standard_rate < 0)) {
    errors.push("Le prix doit etre un nombre positif");
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Valide un mapping de customer
 *
 * @param {Object} customer - Customer a valider
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateCustomerMapping(customer) {
  const errors = [];

  if (!customer) {
    return { valid: false, errors: ["Customer est null ou undefined"] };
  }

  // Verifier les champs requis
  if (isEmpty(customer.name) && isEmpty(customer.customer_name)) {
    errors.push("Le nom du client est requis");
  }

  // Valider l'email si present
  if (customer.email && !isEmpty(customer.email)) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customer.email)) {
      errors.push("Format d'email invalide");
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Valide un mapping de receipt
 *
 * @param {Object} receipt - Receipt a valider
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateReceiptMapping(receipt) {
  const errors = [];

  if (!receipt) {
    return { valid: false, errors: ["Receipt est null ou undefined"] };
  }

  // Verifier les lignes
  if (!receipt.lines || receipt.lines.length === 0) {
    errors.push("Le receipt doit contenir au moins une ligne");
  }

  // Verifier le total
  if (receipt.total === undefined || receipt.total < 0) {
    errors.push("Le total doit etre un nombre positif");
  }

  // Verifier le paiement
  if (!receipt.payment) {
    errors.push("Les informations de paiement sont requises");
  } else if (receipt.payment.amount === undefined || receipt.payment.amount < 0) {
    errors.push("Le montant du paiement doit etre un nombre positif");
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// EXPORT PAR DEFAUT
// ============================================================================

/**
 * Export par defaut - Objet DataMapper avec toutes les fonctions
 */
const DataMapper = {
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

  // Validation
  validateItemMapping,
  validateCustomerMapping,
  validateReceiptMapping,

  // Constants
  SYNC_STATUS,
  PAYMENT_TYPES,
  FIELD_MAPPINGS,
  DEFAULT_MAPPING_CONFIG,
  DEFAULT_COLORS,
  DEFAULT_SHAPES,

  // Errors
  MappingError
};

export default DataMapper;
