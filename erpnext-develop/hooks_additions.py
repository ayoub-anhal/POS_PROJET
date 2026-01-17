#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hooks_additions.py

Additions au fichier hooks.py pour supporter TailPOS.
Ces configurations doivent etre ajoutees manuellement dans:
    erpnext/hooks.py

INSTRUCTIONS:
1. Ouvrir erpnext/hooks.py
2. Ajouter les sections marquees ci-dessous a la fin du fichier
3. Redemarrer bench: bench restart

@author TailPOS Integration
@version 2.0.0
@date 2025-01-17
"""

# ============================================================================
# DEBUT DES ADDITIONS TAILPOS - A COPIER DANS hooks.py
# ============================================================================

HOOKS_ADDITIONS = '''
# =============================================================================
# TAILPOS INTEGRATION - DEBUT
# Configuration pour supporter les connexions depuis TailPOS mobile
# =============================================================================

# -----------------------------------------------------------------------------
# CORS Configuration
# Permet les requetes cross-origin depuis l'application mobile
# -----------------------------------------------------------------------------

# Autoriser toutes les origines (pour developpement)
# En production, specifier les domaines autorises
allow_cors = "*"

# Desactiver la verification CSRF pour les appels API
# Necessaire pour les applications mobiles qui ne peuvent pas gerer les tokens CSRF
ignore_csrf = 1

# -----------------------------------------------------------------------------
# Headers HTTP personnalises
# Ajoutes a toutes les reponses du site
# -----------------------------------------------------------------------------

# website_context = {
#     "add_headers": {
#         "Access-Control-Allow-Origin": "*",
#         "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
#         "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Frappe-CSRF-Token",
#         "Access-Control-Allow-Credentials": "true"
#     }
# }

# -----------------------------------------------------------------------------
# API Whitelist
# Endpoints accessibles sans authentification complete
# Utile pour les endpoints publics ou de verification
# -----------------------------------------------------------------------------

# guest_methods = [
#     "frappe.auth.get_logged_user",
#     "erpnext.stock.utils.get_stock_balance"
# ]

# Methodes whitelist (accessibles via API)
# whitelisted_methods = [
#     "erpnext.selling.doctype.pos_invoice.pos_invoice.get_stock_availability",
#     "erpnext.accounts.doctype.pos_profile.pos_profile.get_pos_profile"
# ]

# -----------------------------------------------------------------------------
# Hooks after_request
# Ajoute les headers CORS a toutes les reponses
# -----------------------------------------------------------------------------

# Decommenter pour activer (necessite cors_config.py dans le path)
# after_request = ["cors_config.after_request"]

# -----------------------------------------------------------------------------
# Scheduler Jobs
# Taches planifiees pour la synchronisation TailPOS
# -----------------------------------------------------------------------------

# scheduler_events = {
#     # Synchronisation toutes les 5 minutes
#     "cron": {
#         "*/5 * * * *": [
#             "erpnext.tailpos_sync.sync_pending_transactions"
#         ]
#     },
#     # Nettoyage quotidien
#     "daily": [
#         "erpnext.tailpos_sync.cleanup_old_sync_logs"
#     ]
# }

# -----------------------------------------------------------------------------
# Fixtures
# Donnees a exporter/importer avec l'application
# -----------------------------------------------------------------------------

# fixtures = [
#     {
#         "doctype": "POS Profile",
#         "filters": [["name", "=", "Default POS Profile"]]
#     },
#     {
#         "doctype": "Custom Field",
#         "filters": [["name", "like", "Item-tailpos_%"]]
#     }
# ]

# -----------------------------------------------------------------------------
# Doc Events
# Hooks sur les evenements de documents
# -----------------------------------------------------------------------------

# doc_events = {
#     "POS Invoice": {
#         "on_submit": "erpnext.tailpos_sync.on_pos_invoice_submit",
#         "on_cancel": "erpnext.tailpos_sync.on_pos_invoice_cancel"
#     },
#     "Item": {
#         "after_insert": "erpnext.tailpos_sync.on_item_change",
#         "on_update": "erpnext.tailpos_sync.on_item_change"
#     },
#     "Customer": {
#         "after_insert": "erpnext.tailpos_sync.on_customer_change",
#         "on_update": "erpnext.tailpos_sync.on_customer_change"
#     }
# }

# -----------------------------------------------------------------------------
# Jinja Methods
# Methodes disponibles dans les templates Jinja
# -----------------------------------------------------------------------------

# jinja = {
#     "methods": [
#         "erpnext.tailpos_sync.get_tailpos_config"
#     ]
# }

# =============================================================================
# TAILPOS INTEGRATION - FIN
# =============================================================================
'''

# ============================================================================
# FIN DES ADDITIONS TAILPOS
# ============================================================================

def print_hooks_additions():
    """Affiche les additions a copier dans hooks.py"""
    print("\n" + "="*70)
    print("  ADDITIONS A COPIER DANS erpnext/hooks.py")
    print("="*70)
    print(HOOKS_ADDITIONS)
    print("="*70)
    print("\nINSTRUCTIONS:")
    print("1. Ouvrir le fichier: erpnext/hooks.py")
    print("2. Copier le contenu ci-dessus a la fin du fichier")
    print("3. Decommenter les sections necessaires")
    print("4. Sauvegarder et redemarrer: bench restart")
    print("="*70 + "\n")

def verify_hooks():
    """Verifie si les hooks TailPOS sont configures"""
    try:
        import erpnext.hooks as hooks

        checks = {
            'allow_cors': hasattr(hooks, 'allow_cors'),
            'ignore_csrf': hasattr(hooks, 'ignore_csrf'),
        }

        print("\n[VERIFICATION] Configuration hooks.py:")
        for key, value in checks.items():
            status = "OK" if value else "MANQUANT"
            print(f"  - {key}: {status}")

        return all(checks.values())

    except ImportError:
        print("[ERREUR] Impossible d'importer erpnext.hooks")
        return False

def get_minimal_config():
    """Retourne la configuration minimale requise"""
    return """
# Configuration minimale TailPOS dans hooks.py:

allow_cors = "*"
ignore_csrf = 1
"""

# ============================================================================
# SCRIPT DE VERIFICATION
# ============================================================================

if __name__ == "__main__":
    print_hooks_additions()
