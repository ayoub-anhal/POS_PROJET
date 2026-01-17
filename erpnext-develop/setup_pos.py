#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
setup_pos.py

Script de configuration automatique d'ERPNext pour TailPOS.
Configure les utilisateurs, entrepots, profils POS et donnees d'exemple.

Usage:
    bench --site [site_name] execute setup_pos.main

Ou depuis Python:
    import setup_pos
    setup_pos.main()

@author TailPOS Integration
@version 2.0.0
@date 2025-01-17
"""

import frappe
from frappe import _
import json
import os
import secrets
import string
from datetime import datetime

# ============================================================================
# CONSTANTES DE CONFIGURATION
# ============================================================================

# Utilisateur POS par defaut
POS_USER_EMAIL = "pos_user@example.com"
POS_USER_FIRST_NAME = "POS"
POS_USER_LAST_NAME = "User"
POS_USER_PASSWORD = "pos_password_123"

# Entrepot par defaut
DEFAULT_WAREHOUSE = "Main Store - MS"
DEFAULT_WAREHOUSE_ABBR = "MS"

# Liste de prix
DEFAULT_PRICE_LIST = "Standard Selling"

# Profil POS
DEFAULT_POS_PROFILE = "Default POS Profile"

# Company
DEFAULT_COMPANY = "My Company"
DEFAULT_COMPANY_ABBR = "MC"
DEFAULT_CURRENCY = "EUR"

# Client par defaut
DEFAULT_CUSTOMER = "Walk-in Customer"

# Produits d'exemple
SAMPLE_ITEMS = [
    {"item_code": "ITEM-001", "item_name": "Produit Test 1", "rate": 100, "barcode": "1000000001"},
    {"item_code": "ITEM-002", "item_name": "Produit Test 2", "rate": 250, "barcode": "1000000002"},
    {"item_code": "ITEM-003", "item_name": "Produit Test 3", "rate": 50, "barcode": "1000000003"},
    {"item_code": "ITEM-004", "item_name": "Produit Test 4", "rate": 500, "barcode": "1000000004"},
    {"item_code": "ITEM-005", "item_name": "Produit Test 5", "rate": 75, "barcode": "1000000005"},
]

# Stock initial
INITIAL_STOCK_QTY = 100

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

def generate_api_key():
    """Genere une cle API aleatoire."""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))

def generate_api_secret():
    """Genere un secret API aleatoire."""
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(40))

def log_info(message):
    """Affiche un message d'information."""
    print(f"[INFO] {message}")
    frappe.log_error(message, "TailPOS Setup - Info")

def log_error(message):
    """Affiche un message d'erreur."""
    print(f"[ERROR] {message}")
    frappe.log_error(message, "TailPOS Setup - Error")

def log_success(message):
    """Affiche un message de succes."""
    print(f"[SUCCESS] {message}")

# ============================================================================
# FONCTION: CREATION DE LA COMPANY
# ============================================================================

def create_company():
    """
    Cree ou recupere la company par defaut.

    Returns:
        str: Nom de la company
    """
    log_info(f"Verification de la company '{DEFAULT_COMPANY}'...")

    try:
        # Verifier si une company existe deja
        existing_companies = frappe.get_all("Company", limit=1)

        if existing_companies:
            company_name = existing_companies[0].name
            log_info(f"Company existante trouvee: {company_name}")
            return company_name

        # Creer une nouvelle company
        log_info(f"Creation de la company '{DEFAULT_COMPANY}'...")

        company = frappe.get_doc({
            "doctype": "Company",
            "company_name": DEFAULT_COMPANY,
            "abbr": DEFAULT_COMPANY_ABBR,
            "default_currency": DEFAULT_CURRENCY,
            "country": "France",
            "enable_perpetual_inventory": 1,
            "create_chart_of_accounts_based_on": "Standard Template",
            "chart_of_accounts": "Plan Comptable General (France)"
        })

        company.insert(ignore_permissions=True)
        frappe.db.commit()

        log_success(f"Company '{DEFAULT_COMPANY}' creee avec succes")
        return company.name

    except frappe.DuplicateEntryError:
        log_info(f"Company '{DEFAULT_COMPANY}' existe deja")
        return DEFAULT_COMPANY
    except Exception as e:
        log_error(f"Erreur creation company: {str(e)}")
        raise

# ============================================================================
# FONCTION: CREATION DE L'UTILISATEUR POS
# ============================================================================

def create_pos_user():
    """
    Cree l'utilisateur POS avec les roles necessaires.

    Returns:
        dict: Informations de l'utilisateur {email, api_key, api_secret, roles}
    """
    log_info(f"Verification de l'utilisateur POS '{POS_USER_EMAIL}'...")

    try:
        # Verifier si l'utilisateur existe
        if frappe.db.exists("User", POS_USER_EMAIL):
            log_info(f"Utilisateur '{POS_USER_EMAIL}' existe deja")
            user = frappe.get_doc("User", POS_USER_EMAIL)
        else:
            # Creer l'utilisateur
            log_info(f"Creation de l'utilisateur '{POS_USER_EMAIL}'...")

            user = frappe.get_doc({
                "doctype": "User",
                "email": POS_USER_EMAIL,
                "first_name": POS_USER_FIRST_NAME,
                "last_name": POS_USER_LAST_NAME,
                "enabled": 1,
                "send_welcome_email": 0,
                "user_type": "System User"
            })

            user.insert(ignore_permissions=True)

            # Definir le mot de passe
            frappe.db.set_value("User", POS_USER_EMAIL, "new_password", POS_USER_PASSWORD)

            log_success(f"Utilisateur '{POS_USER_EMAIL}' cree")

        # Ajouter les roles necessaires
        required_roles = ["POS User", "Sales User", "Stock User", "Item Manager"]

        for role_name in required_roles:
            # Verifier que le role existe
            if not frappe.db.exists("Role", role_name):
                log_info(f"Creation du role '{role_name}'...")
                role = frappe.get_doc({
                    "doctype": "Role",
                    "role_name": role_name
                })
                role.insert(ignore_permissions=True)

            # Ajouter le role a l'utilisateur s'il ne l'a pas
            has_role = frappe.db.exists("Has Role", {
                "parent": POS_USER_EMAIL,
                "role": role_name
            })

            if not has_role:
                user.append("roles", {"role": role_name})
                log_info(f"Role '{role_name}' ajoute a l'utilisateur")

        user.save(ignore_permissions=True)

        # Generer les cles API
        api_key, api_secret = setup_api_access(POS_USER_EMAIL)

        frappe.db.commit()

        log_success(f"Utilisateur POS configure avec succes")

        return {
            "email": POS_USER_EMAIL,
            "password": POS_USER_PASSWORD,
            "api_key": api_key,
            "api_secret": api_secret,
            "roles": required_roles
        }

    except Exception as e:
        log_error(f"Erreur creation utilisateur POS: {str(e)}")
        raise

# ============================================================================
# FONCTION: CREATION DE L'ENTREPOT
# ============================================================================

def create_warehouse(company_name):
    """
    Cree l'entrepot principal pour le POS.

    Args:
        company_name: Nom de la company

    Returns:
        str: Nom de l'entrepot
    """
    warehouse_name = f"{DEFAULT_WAREHOUSE.split(' - ')[0]} - {company_name[:2].upper()}"

    log_info(f"Verification de l'entrepot '{warehouse_name}'...")

    try:
        # Verifier si l'entrepot existe
        if frappe.db.exists("Warehouse", warehouse_name):
            log_info(f"Entrepot '{warehouse_name}' existe deja")
            return warehouse_name

        # Verifier s'il existe un entrepot parent
        parent_warehouse = frappe.db.get_value("Warehouse",
            {"company": company_name, "is_group": 1}, "name")

        if not parent_warehouse:
            # Creer l'entrepot racine
            parent_warehouse = f"All Warehouses - {company_name[:2].upper()}"
            if not frappe.db.exists("Warehouse", parent_warehouse):
                root = frappe.get_doc({
                    "doctype": "Warehouse",
                    "warehouse_name": "All Warehouses",
                    "company": company_name,
                    "is_group": 1
                })
                root.insert(ignore_permissions=True)
                log_info(f"Entrepot racine cree: {parent_warehouse}")

        # Creer l'entrepot principal
        log_info(f"Creation de l'entrepot '{warehouse_name}'...")

        warehouse = frappe.get_doc({
            "doctype": "Warehouse",
            "warehouse_name": DEFAULT_WAREHOUSE.split(" - ")[0],
            "company": company_name,
            "parent_warehouse": parent_warehouse,
            "is_group": 0,
            "warehouse_type": "Store"
        })

        warehouse.insert(ignore_permissions=True)
        frappe.db.commit()

        log_success(f"Entrepot '{warehouse.name}' cree avec succes")
        return warehouse.name

    except frappe.DuplicateEntryError:
        log_info(f"Entrepot existe deja")
        return warehouse_name
    except Exception as e:
        log_error(f"Erreur creation entrepot: {str(e)}")
        raise

# ============================================================================
# FONCTION: CREATION DE LA LISTE DE PRIX
# ============================================================================

def create_price_list():
    """
    Verifie/cree la liste de prix par defaut.

    Returns:
        str: Nom de la liste de prix
    """
    log_info(f"Verification de la liste de prix '{DEFAULT_PRICE_LIST}'...")

    try:
        # Verifier si la liste existe
        if frappe.db.exists("Price List", DEFAULT_PRICE_LIST):
            log_info(f"Liste de prix '{DEFAULT_PRICE_LIST}' existe deja")
            return DEFAULT_PRICE_LIST

        # Creer la liste de prix
        log_info(f"Creation de la liste de prix '{DEFAULT_PRICE_LIST}'...")

        price_list = frappe.get_doc({
            "doctype": "Price List",
            "price_list_name": DEFAULT_PRICE_LIST,
            "currency": DEFAULT_CURRENCY,
            "selling": 1,
            "buying": 0,
            "enabled": 1
        })

        price_list.insert(ignore_permissions=True)
        frappe.db.commit()

        log_success(f"Liste de prix '{DEFAULT_PRICE_LIST}' creee")
        return DEFAULT_PRICE_LIST

    except frappe.DuplicateEntryError:
        return DEFAULT_PRICE_LIST
    except Exception as e:
        log_error(f"Erreur creation liste de prix: {str(e)}")
        raise

# ============================================================================
# FONCTION: CREATION DU PROFIL POS
# ============================================================================

def create_pos_profile(company_name, warehouse_name, price_list_name):
    """
    Cree le profil POS par defaut.

    Args:
        company_name: Nom de la company
        warehouse_name: Nom de l'entrepot
        price_list_name: Nom de la liste de prix

    Returns:
        str: Nom du profil POS
    """
    log_info(f"Verification du profil POS '{DEFAULT_POS_PROFILE}'...")

    try:
        # Verifier si le profil existe
        if frappe.db.exists("POS Profile", DEFAULT_POS_PROFILE):
            log_info(f"Profil POS '{DEFAULT_POS_PROFILE}' existe deja")
            return DEFAULT_POS_PROFILE

        # Recuperer les comptes necessaires
        write_off_account = frappe.db.get_value("Account", {
            "company": company_name,
            "account_type": "Expense Account",
            "is_group": 0
        }, "name")

        write_off_cost_center = frappe.db.get_value("Cost Center", {
            "company": company_name,
            "is_group": 0
        }, "name")

        income_account = frappe.db.get_value("Account", {
            "company": company_name,
            "account_type": "Income Account",
            "is_group": 0
        }, "name")

        expense_account = frappe.db.get_value("Account", {
            "company": company_name,
            "account_type": "Expense Account",
            "is_group": 0
        }, "name")

        # Recuperer le compte de caisse (Cash)
        cash_account = frappe.db.get_value("Account", {
            "company": company_name,
            "account_type": "Cash",
            "is_group": 0
        }, "name")

        if not cash_account:
            # Essayer de trouver un compte bancaire
            cash_account = frappe.db.get_value("Account", {
                "company": company_name,
                "account_type": "Bank",
                "is_group": 0
            }, "name")

        # Creer le profil POS
        log_info(f"Creation du profil POS '{DEFAULT_POS_PROFILE}'...")

        pos_profile = frappe.get_doc({
            "doctype": "POS Profile",
            "name": DEFAULT_POS_PROFILE,
            "company": company_name,
            "warehouse": warehouse_name,
            "selling_price_list": price_list_name,
            "currency": DEFAULT_CURRENCY,
            "write_off_account": write_off_account,
            "write_off_cost_center": write_off_cost_center,
            "income_account": income_account,
            "expense_account": expense_account,
            "customer": DEFAULT_CUSTOMER,
            "disabled": 0
        })

        # Ajouter les modes de paiement
        if cash_account:
            pos_profile.append("payments", {
                "mode_of_payment": "Cash",
                "default": 1,
                "account": cash_account
            })

        # Ajouter l'utilisateur POS applicable
        pos_profile.append("applicable_for_users", {
            "user": POS_USER_EMAIL,
            "default": 1
        })

        pos_profile.insert(ignore_permissions=True)
        frappe.db.commit()

        log_success(f"Profil POS '{DEFAULT_POS_PROFILE}' cree avec succes")
        return pos_profile.name

    except frappe.DuplicateEntryError:
        return DEFAULT_POS_PROFILE
    except Exception as e:
        log_error(f"Erreur creation profil POS: {str(e)}")
        # Ne pas lever l'erreur pour continuer le setup
        return None

# ============================================================================
# FONCTION: CREATION DU CLIENT PAR DEFAUT
# ============================================================================

def create_customer():
    """
    Cree le client par defaut pour les ventes comptoir.

    Returns:
        str: Nom du client
    """
    log_info(f"Verification du client '{DEFAULT_CUSTOMER}'...")

    try:
        # Verifier si le client existe
        if frappe.db.exists("Customer", DEFAULT_CUSTOMER):
            log_info(f"Client '{DEFAULT_CUSTOMER}' existe deja")
            return DEFAULT_CUSTOMER

        # Creer le client
        log_info(f"Creation du client '{DEFAULT_CUSTOMER}'...")

        customer = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": DEFAULT_CUSTOMER,
            "customer_type": "Individual",
            "customer_group": "Individual",
            "territory": "All Territories"
        })

        customer.insert(ignore_permissions=True)
        frappe.db.commit()

        log_success(f"Client '{DEFAULT_CUSTOMER}' cree avec succes")
        return customer.name

    except frappe.DuplicateEntryError:
        return DEFAULT_CUSTOMER
    except Exception as e:
        log_error(f"Erreur creation client: {str(e)}")
        raise

# ============================================================================
# FONCTION: CREATION DES PRODUITS D'EXEMPLE
# ============================================================================

def create_sample_items(company_name, warehouse_name, price_list_name):
    """
    Cree les produits d'exemple avec stock initial.

    Args:
        company_name: Nom de la company
        warehouse_name: Nom de l'entrepot
        price_list_name: Nom de la liste de prix

    Returns:
        list: Liste des produits crees
    """
    log_info("Creation des produits d'exemple...")

    created_items = []

    # Verifier/creer le groupe de produits
    if not frappe.db.exists("Item Group", "Products"):
        try:
            item_group = frappe.get_doc({
                "doctype": "Item Group",
                "item_group_name": "Products",
                "parent_item_group": "All Item Groups"
            })
            item_group.insert(ignore_permissions=True)
            log_info("Groupe 'Products' cree")
        except:
            pass

    for item_data in SAMPLE_ITEMS:
        try:
            item_code = item_data["item_code"]

            # Verifier si le produit existe
            if frappe.db.exists("Item", item_code):
                log_info(f"Produit '{item_code}' existe deja")
                created_items.append({
                    "item_code": item_code,
                    "barcode": item_data["barcode"],
                    "exists": True
                })
                continue

            # Creer le produit
            log_info(f"Creation du produit '{item_code}'...")

            item = frappe.get_doc({
                "doctype": "Item",
                "item_code": item_code,
                "item_name": item_data["item_name"],
                "item_group": "Products",
                "stock_uom": "Nos",
                "is_stock_item": 1,
                "is_sales_item": 1,
                "is_purchase_item": 1,
                "include_item_in_manufacturing": 0,
                "standard_rate": item_data["rate"],
                "valuation_rate": item_data["rate"] * 0.7,  # Cout = 70% du prix
                "opening_stock": INITIAL_STOCK_QTY,
                "description": f"Produit de test: {item_data['item_name']}"
            })

            # Ajouter le code-barres
            item.append("barcodes", {
                "barcode": item_data["barcode"],
                "barcode_type": "EAN"
            })

            item.insert(ignore_permissions=True)

            # Creer le prix de vente
            item_price = frappe.get_doc({
                "doctype": "Item Price",
                "item_code": item_code,
                "price_list": price_list_name,
                "price_list_rate": item_data["rate"],
                "currency": DEFAULT_CURRENCY,
                "selling": 1
            })
            item_price.insert(ignore_permissions=True)

            # Creer l'entree de stock initiale
            try:
                create_stock_entry(item_code, warehouse_name, INITIAL_STOCK_QTY, company_name)
            except Exception as stock_error:
                log_error(f"Erreur stock pour {item_code}: {str(stock_error)}")

            created_items.append({
                "item_code": item_code,
                "barcode": item_data["barcode"],
                "rate": item_data["rate"],
                "exists": False
            })

            log_success(f"Produit '{item_code}' cree avec stock initial")

        except frappe.DuplicateEntryError:
            log_info(f"Produit '{item_code}' existe deja")
            created_items.append({
                "item_code": item_code,
                "barcode": item_data["barcode"],
                "exists": True
            })
        except Exception as e:
            log_error(f"Erreur creation produit '{item_code}': {str(e)}")

    frappe.db.commit()

    log_success(f"{len(created_items)} produits configures")
    return created_items

def create_stock_entry(item_code, warehouse, qty, company):
    """
    Cree une entree de stock pour initialiser le stock d'un produit.

    Args:
        item_code: Code du produit
        warehouse: Entrepot cible
        qty: Quantite
        company: Company
    """
    try:
        stock_entry = frappe.get_doc({
            "doctype": "Stock Entry",
            "stock_entry_type": "Material Receipt",
            "company": company,
            "items": [{
                "item_code": item_code,
                "t_warehouse": warehouse,
                "qty": qty,
                "basic_rate": frappe.db.get_value("Item", item_code, "valuation_rate") or 100
            }]
        })

        stock_entry.insert(ignore_permissions=True)
        stock_entry.submit()

    except Exception as e:
        log_error(f"Erreur creation stock entry: {str(e)}")

# ============================================================================
# FONCTION: CONFIGURATION DE L'ACCES API
# ============================================================================

def setup_api_access(user_email):
    """
    Configure l'acces API pour un utilisateur.

    Args:
        user_email: Email de l'utilisateur

    Returns:
        tuple: (api_key, api_secret)
    """
    log_info(f"Configuration de l'acces API pour '{user_email}'...")

    try:
        user = frappe.get_doc("User", user_email)

        # Generer une nouvelle API Key si necessaire
        api_key = user.api_key
        if not api_key:
            api_key = generate_api_key()
            user.api_key = api_key

        # Generer un nouveau API Secret
        api_secret = generate_api_secret()
        user.api_secret = api_secret

        user.save(ignore_permissions=True)
        frappe.db.commit()

        log_success(f"API Key generee pour '{user_email}'")

        return api_key, api_secret

    except Exception as e:
        log_error(f"Erreur configuration API: {str(e)}")
        return None, None

# ============================================================================
# FONCTION: SAUVEGARDE DES CREDENTIALS
# ============================================================================

def save_credentials(credentials_data):
    """
    Sauvegarde les credentials dans un fichier JSON.

    Args:
        credentials_data: Dictionnaire des credentials
    """
    try:
        # Determiner le chemin du fichier
        bench_path = frappe.utils.get_bench_path()
        file_path = os.path.join(bench_path, "pos_credentials.json")

        # Ajouter la date de generation
        credentials_data["generated_date"] = datetime.now().isoformat()

        # Sauvegarder
        with open(file_path, 'w') as f:
            json.dump(credentials_data, f, indent=2)

        log_success(f"Credentials sauvegardes dans: {file_path}")

    except Exception as e:
        log_error(f"Erreur sauvegarde credentials: {str(e)}")
        # Afficher les credentials dans la console comme backup
        print("\n" + "="*60)
        print("CREDENTIALS (a sauvegarder manuellement):")
        print("="*60)
        print(json.dumps(credentials_data, indent=2))
        print("="*60 + "\n")

# ============================================================================
# FONCTION PRINCIPALE
# ============================================================================

def main():
    """
    Fonction principale - Execute toute la configuration.
    """
    print("\n" + "="*60)
    print("  CONFIGURATION ERPNEXT POUR TAILPOS")
    print("  Version 2.0.0")
    print("="*60 + "\n")

    try:
        # 1. Creer/recuperer la company
        company_name = create_company()
        print(f"[1/8] Company: {company_name}")

        # 2. Creer l'utilisateur POS
        pos_user = create_pos_user()
        print(f"[2/8] Utilisateur POS: {pos_user['email']}")

        # 3. Creer l'entrepot
        warehouse_name = create_warehouse(company_name)
        print(f"[3/8] Entrepot: {warehouse_name}")

        # 4. Creer la liste de prix
        price_list_name = create_price_list()
        print(f"[4/8] Liste de prix: {price_list_name}")

        # 5. Creer le client par defaut
        customer_name = create_customer()
        print(f"[5/8] Client: {customer_name}")

        # 6. Creer le profil POS
        pos_profile_name = create_pos_profile(company_name, warehouse_name, price_list_name)
        print(f"[6/8] Profil POS: {pos_profile_name or 'Non cree (voir logs)'}")

        # 7. Creer les produits d'exemple
        sample_items = create_sample_items(company_name, warehouse_name, price_list_name)
        print(f"[7/8] Produits: {len(sample_items)} produits configures")

        # 8. Preparer et sauvegarder les credentials
        credentials = {
            "generated_date": "",
            "pos_user": pos_user,
            "server": {
                "url": frappe.utils.get_url(),
                "site_name": frappe.local.site
            },
            "pos_profile": {
                "name": pos_profile_name,
                "warehouse": warehouse_name,
                "price_list": price_list_name,
                "company": company_name
            },
            "default_customer": customer_name,
            "sample_items": sample_items
        }

        save_credentials(credentials)
        print(f"[8/8] Credentials sauvegardes")

        # Resume final
        print("\n" + "="*60)
        print("  CONFIGURATION TERMINEE AVEC SUCCES!")
        print("="*60)
        print(f"""
Informations de connexion TailPOS:
----------------------------------
URL Serveur: {frappe.utils.get_url()}
Utilisateur: {pos_user['email']}
Mot de passe: {pos_user['password']}
API Key: {pos_user['api_key']}
API Secret: {pos_user['api_secret'][:10]}... (voir pos_credentials.json)

Entrepot: {warehouse_name}
Liste de prix: {price_list_name}
Client par defaut: {customer_name}

Produits d'exemple: {len(sample_items)} produits avec {INITIAL_STOCK_QTY} unites chacun
""")
        print("="*60 + "\n")

        return credentials

    except Exception as e:
        log_error(f"Erreur fatale: {str(e)}")
        frappe.db.rollback()
        print("\n[ERREUR] La configuration a echoue. Voir les logs pour details.")
        raise

# ============================================================================
# POINT D'ENTREE
# ============================================================================

if __name__ == "__main__":
    # Execution directe (pour tests)
    main()
