#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cors_config.py

Script pour configurer CORS dans ERPNext/Frappe.
Permet les connexions depuis TailPOS mobile et autres applications externes.

Usage:
    bench --site [site_name] execute cors_config.enable_cors
    bench --site [site_name] execute cors_config.configure_api_settings

Ou depuis Python:
    import cors_config
    cors_config.enable_cors()

@author TailPOS Integration
@version 2.0.0
@date 2025-01-17
"""

import frappe
from frappe import _
import json
import os

# ============================================================================
# CONSTANTES
# ============================================================================

# Headers CORS a ajouter
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Frappe-CSRF-Token, X-Frappe-Site-Name',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'  # 24 heures
}

# ============================================================================
# FONCTION: ACTIVATION CORS
# ============================================================================

def enable_cors(origins="*"):
    """
    Active CORS pour les origines specifiees.

    Args:
        origins: Origines autorisees ("*" pour toutes, ou liste d'URLs)

    Returns:
        bool: True si succes
    """
    print("[CORS] Activation de CORS...")

    try:
        # Methode 1: Via site_config.json
        site_config_path = frappe.get_site_path('site_config.json')

        if os.path.exists(site_config_path):
            with open(site_config_path, 'r') as f:
                config = json.load(f)

            # Configurer CORS
            config['allow_cors'] = origins
            config['ignore_csrf'] = 1

            # Ajouter les parametres API si absents
            if 'api_settings' not in config:
                config['api_settings'] = {}

            config['api_settings']['enable_api'] = 1
            config['api_settings']['allow_api_key_authentication'] = 1

            with open(site_config_path, 'w') as f:
                json.dump(config, f, indent=2)

            print(f"[CORS] Configuration mise a jour dans {site_config_path}")
        else:
            print(f"[CORS] Fichier {site_config_path} non trouve")
            return False

        # Methode 2: Via frappe.local si disponible
        try:
            frappe.local.conf.allow_cors = origins
            frappe.local.conf.ignore_csrf = 1
        except:
            pass

        print("[CORS] CORS active avec succes")
        return True

    except Exception as e:
        print(f"[CORS] Erreur: {str(e)}")
        return False

# ============================================================================
# FONCTION: HEADERS CORS
# ============================================================================

def add_cors_headers(response=None):
    """
    Ajoute les headers CORS a une reponse.

    Args:
        response: Objet response (optionnel)

    Returns:
        dict: Headers CORS a ajouter
    """
    if response:
        for header, value in CORS_HEADERS.items():
            response.headers[header] = value

    return CORS_HEADERS

def get_cors_headers():
    """
    Retourne les headers CORS configures.

    Returns:
        dict: Headers CORS
    """
    return CORS_HEADERS.copy()

# ============================================================================
# FONCTION: CONFIGURATION API
# ============================================================================

def configure_api_settings(rate_limit=1000, rate_limit_window=3600):
    """
    Configure les parametres de l'API ERPNext.

    Args:
        rate_limit: Nombre maximum de requetes par fenetre
        rate_limit_window: Fenetre de temps en secondes

    Returns:
        bool: True si succes
    """
    print("[API] Configuration des parametres API...")

    try:
        # Configurer via site_config
        site_config_path = frappe.get_site_path('site_config.json')

        if os.path.exists(site_config_path):
            with open(site_config_path, 'r') as f:
                config = json.load(f)

            # Ajouter/mettre a jour les parametres API
            config['api_settings'] = {
                'enable_api': 1,
                'allow_api_key_authentication': 1,
                'rate_limit': rate_limit,
                'rate_limit_window': rate_limit_window
            }

            with open(site_config_path, 'w') as f:
                json.dump(config, f, indent=2)

            print(f"[API] Rate limit: {rate_limit} requetes / {rate_limit_window}s")

        # Essayer de configurer via System Settings
        try:
            if frappe.db.exists("DocType", "System Settings"):
                system_settings = frappe.get_doc('System Settings')

                # Activer l'API si le champ existe
                if hasattr(system_settings, 'enable_api'):
                    system_settings.enable_api = 1
                    system_settings.save(ignore_permissions=True)
                    print("[API] System Settings mis a jour")
        except Exception as e:
            print(f"[API] Note: System Settings non modifie: {str(e)}")

        print("[API] Parametres API configures avec succes")
        return True

    except Exception as e:
        print(f"[API] Erreur: {str(e)}")
        return False

# ============================================================================
# FONCTION: DESACTIVATION CSRF
# ============================================================================

def disable_csrf():
    """
    Desactive la verification CSRF pour les requetes API.
    ATTENTION: A utiliser uniquement en developpement ou pour les API mobiles.

    Returns:
        bool: True si succes
    """
    print("[CSRF] Desactivation de la verification CSRF...")

    try:
        site_config_path = frappe.get_site_path('site_config.json')

        with open(site_config_path, 'r') as f:
            config = json.load(f)

        config['ignore_csrf'] = 1

        with open(site_config_path, 'w') as f:
            json.dump(config, f, indent=2)

        print("[CSRF] Verification CSRF desactivee")
        print("[CSRF] ATTENTION: Cette configuration reduit la securite!")
        return True

    except Exception as e:
        print(f"[CSRF] Erreur: {str(e)}")
        return False

# ============================================================================
# FONCTION: VERIFICATION CONFIGURATION
# ============================================================================

def check_cors_config():
    """
    Verifie la configuration CORS actuelle.

    Returns:
        dict: Configuration actuelle
    """
    print("[CHECK] Verification de la configuration CORS...")

    config_status = {
        'cors_enabled': False,
        'csrf_disabled': False,
        'api_enabled': False,
        'origins': None
    }

    try:
        site_config_path = frappe.get_site_path('site_config.json')

        if os.path.exists(site_config_path):
            with open(site_config_path, 'r') as f:
                config = json.load(f)

            config_status['cors_enabled'] = 'allow_cors' in config
            config_status['origins'] = config.get('allow_cors')
            config_status['csrf_disabled'] = config.get('ignore_csrf', 0) == 1

            api_settings = config.get('api_settings', {})
            config_status['api_enabled'] = api_settings.get('enable_api', 0) == 1

            print(f"[CHECK] CORS active: {config_status['cors_enabled']}")
            print(f"[CHECK] Origines: {config_status['origins']}")
            print(f"[CHECK] CSRF desactive: {config_status['csrf_disabled']}")
            print(f"[CHECK] API active: {config_status['api_enabled']}")

    except Exception as e:
        print(f"[CHECK] Erreur: {str(e)}")

    return config_status

# ============================================================================
# FONCTION: CONFIGURATION COMPLETE
# ============================================================================

def setup_for_tailpos():
    """
    Configure CORS et API specifiquement pour TailPOS.
    Applique tous les parametres necessaires.

    Returns:
        bool: True si succes
    """
    print("\n" + "="*50)
    print("  CONFIGURATION CORS POUR TAILPOS")
    print("="*50 + "\n")

    success = True

    # 1. Activer CORS
    if not enable_cors("*"):
        success = False

    # 2. Configurer l'API
    if not configure_api_settings(rate_limit=1000):
        success = False

    # 3. Verification finale
    print("\n[FINAL] Verification de la configuration...")
    check_cors_config()

    if success:
        print("\n[SUCCESS] Configuration terminee!")
        print("\nIMPORTANT: Redemarrez bench pour appliquer les changements:")
        print("  bench restart")
    else:
        print("\n[WARNING] Certaines configurations ont echoue.")

    return success

# ============================================================================
# MIDDLEWARE CORS (optionnel)
# ============================================================================

def cors_middleware(get_response):
    """
    Middleware CORS pour ajouter les headers a toutes les reponses.
    A utiliser avec Frappe hooks si necessaire.

    Args:
        get_response: Fonction de reponse originale

    Returns:
        function: Nouvelle fonction de reponse avec headers CORS
    """
    def middleware(request):
        # Gerer les requetes OPTIONS (preflight)
        if request.method == 'OPTIONS':
            from werkzeug.wrappers import Response
            response = Response()
            add_cors_headers(response)
            return response

        # Traiter la requete normale
        response = get_response(request)

        # Ajouter les headers CORS
        add_cors_headers(response)

        return response

    return middleware

# ============================================================================
# HOOK AFTER_REQUEST
# ============================================================================

def after_request(response):
    """
    Hook a ajouter dans hooks.py pour ajouter les headers CORS.

    Usage dans hooks.py:
        after_request = ["cors_config.after_request"]

    Args:
        response: Objet response Frappe

    Returns:
        response: Response avec headers CORS
    """
    add_cors_headers(response)
    return response

# ============================================================================
# POINT D'ENTREE
# ============================================================================

if __name__ == "__main__":
    # Execution directe
    setup_for_tailpos()
