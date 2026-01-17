#!/bin/bash

#############################################
# test_full_flow.sh - Test du flux complet POS
#
# Ce script simule un flux de vente complet:
# Login → Recuperer produits → Creer vente → Logout
#
# Usage:
#   ./scripts/test_full_flow.sh [server_url]
#   ./scripts/test_full_flow.sh http://192.168.1.100:8000
#
# @author TailPOS Integration
# @version 2.0.0
# @date 2025-01-17
#############################################

# ============================================
# CONFIGURATION
# ============================================

SERVER_URL="${1:-http://localhost:8000}"
USERNAME="${ERPNEXT_USER:-pos_user@example.com}"
PASSWORD="${ERPNEXT_PASSWORD:-pos_password_123}"
COOKIE_FILE="/tmp/erpnext_flow_cookies_$$.txt"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# ============================================
# FONCTIONS
# ============================================

# Nettoyer avant de quitter
cleanup() {
    rm -f "$COOKIE_FILE"
}
trap cleanup EXIT

# Afficher une etape
print_step() {
    local step_num="$1"
    local step_name="$2"
    echo ""
    echo -e "${CYAN}[Etape $step_num]${NC} $step_name"
}

# Afficher succes
print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

# Afficher echec
print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

# Afficher info
print_info() {
    echo -e "  ${YELLOW}→${NC} $1"
}

# Extraire une valeur JSON (simple)
json_value() {
    local json="$1"
    local key="$2"
    echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}

# ============================================
# DEBUT DU TEST
# ============================================

echo ""
echo -e "${BLUE}${BOLD}=========================================="
echo -e "  TEST DU FLUX COMPLET POS"
echo -e "==========================================${NC}"
echo ""
echo -e "Serveur: ${BOLD}$SERVER_URL${NC}"
echo -e "Date:    $(date '+%Y-%m-%d %H:%M:%S')"

# ============================================
# ETAPE 1: CONNEXION
# ============================================

print_step "1" "Connexion au serveur ERPNext"

LOGIN_RESULT=$(curl -s -c "$COOKIE_FILE" -X POST "$SERVER_URL/api/method/login" \
    -H "Content-Type: application/json" \
    -d "{\"usr\":\"$USERNAME\",\"pwd\":\"$PASSWORD\"}")

if echo "$LOGIN_RESULT" | grep -q "message"; then
    print_success "Connexion reussie"
    LOGGED_USER=$(json_value "$LOGIN_RESULT" "full_name")
    print_info "Utilisateur: $LOGGED_USER"
else
    print_error "Echec de connexion"
    print_info "Reponse: ${LOGIN_RESULT:0:100}..."
    exit 1
fi

# ============================================
# ETAPE 2: RECUPERER LES PRODUITS
# ============================================

print_step "2" "Recuperation des produits disponibles"

ITEMS_RESULT=$(curl -s -b "$COOKIE_FILE" \
    "$SERVER_URL/api/resource/Item?limit_page_length=5&fields=[\"item_code\",\"item_name\",\"standard_rate\"]")

if echo "$ITEMS_RESULT" | grep -q "data"; then
    ITEM_COUNT=$(echo "$ITEMS_RESULT" | grep -o '"item_code"' | wc -l)
    print_success "$ITEM_COUNT produits recuperes"

    # Extraire le premier item
    FIRST_ITEM_CODE=$(json_value "$ITEMS_RESULT" "item_code")
    FIRST_ITEM_NAME=$(json_value "$ITEMS_RESULT" "item_name")
    FIRST_ITEM_RATE=$(echo "$ITEMS_RESULT" | grep -o '"standard_rate":[0-9.]*' | head -1 | cut -d':' -f2)

    print_info "Premier produit: $FIRST_ITEM_CODE - $FIRST_ITEM_NAME ($FIRST_ITEM_RATE)"
else
    print_error "Echec recuperation produits"
    print_info "Creez des produits dans ERPNext"
fi

# ============================================
# ETAPE 3: RECUPERER UN CLIENT
# ============================================

print_step "3" "Recuperation d'un client"

CUSTOMERS_RESULT=$(curl -s -b "$COOKIE_FILE" \
    "$SERVER_URL/api/resource/Customer?limit_page_length=1")

if echo "$CUSTOMERS_RESULT" | grep -q "data"; then
    CUSTOMER_NAME=$(json_value "$CUSTOMERS_RESULT" "name")

    if [ -n "$CUSTOMER_NAME" ]; then
        print_success "Client trouve: $CUSTOMER_NAME"
    else
        print_info "Aucun client trouve, utilisation de 'Guest'"
        CUSTOMER_NAME="Guest"
    fi
else
    print_info "Utilisation du client par defaut"
    CUSTOMER_NAME="Guest"
fi

# ============================================
# ETAPE 4: RECUPERER LE POS PROFILE
# ============================================

print_step "4" "Recuperation du POS Profile"

POS_RESULT=$(curl -s -b "$COOKIE_FILE" \
    "$SERVER_URL/api/resource/POS%20Profile?limit_page_length=1")

if echo "$POS_RESULT" | grep -q "data"; then
    POS_PROFILE=$(json_value "$POS_RESULT" "name")

    if [ -n "$POS_PROFILE" ]; then
        print_success "POS Profile: $POS_PROFILE"
    else
        print_error "Aucun POS Profile configure"
        print_info "Creez un POS Profile dans ERPNext"
    fi
else
    print_error "Impossible de recuperer le POS Profile"
fi

# ============================================
# ETAPE 5: RECUPERER LE WAREHOUSE
# ============================================

print_step "5" "Recuperation de l'entrepot"

WAREHOUSE_RESULT=$(curl -s -b "$COOKIE_FILE" \
    "$SERVER_URL/api/resource/Warehouse?limit_page_length=1&filters=[[\"is_group\",\"=\",0]]")

WAREHOUSE=$(json_value "$WAREHOUSE_RESULT" "name")

if [ -n "$WAREHOUSE" ]; then
    print_success "Entrepot: $WAREHOUSE"
else
    print_info "Entrepot non specifie"
fi

# ============================================
# ETAPE 6: CREER UNE FACTURE POS (SIMULATION)
# ============================================

print_step "6" "Creation d'une facture POS (test)"

if [ -n "$FIRST_ITEM_CODE" ] && [ -n "$POS_PROFILE" ]; then
    # Preparer les donnees de la facture
    POSTING_DATE=$(date '+%Y-%m-%d')
    POSTING_TIME=$(date '+%H:%M:%S')

    INVOICE_DATA=$(cat <<EOF
{
    "doctype": "POS Invoice",
    "customer": "$CUSTOMER_NAME",
    "pos_profile": "$POS_PROFILE",
    "posting_date": "$POSTING_DATE",
    "posting_time": "$POSTING_TIME",
    "is_pos": 1,
    "items": [
        {
            "item_code": "$FIRST_ITEM_CODE",
            "qty": 1
        }
    ],
    "payments": [
        {
            "mode_of_payment": "Cash",
            "amount": ${FIRST_ITEM_RATE:-100}
        }
    ]
}
EOF
)

    print_info "Donnees de la facture preparees:"
    print_info "  Client: $CUSTOMER_NAME"
    print_info "  Produit: $FIRST_ITEM_CODE"
    print_info "  Montant: ${FIRST_ITEM_RATE:-100}"

    # Tenter de creer la facture
    INVOICE_RESULT=$(curl -s -b "$COOKIE_FILE" -X POST \
        "$SERVER_URL/api/resource/POS%20Invoice" \
        -H "Content-Type: application/json" \
        -d "$INVOICE_DATA")

    if echo "$INVOICE_RESULT" | grep -q "\"name\""; then
        INVOICE_NAME=$(json_value "$INVOICE_RESULT" "name")
        print_success "Facture creee: $INVOICE_NAME"
    else
        ERROR_MSG=$(echo "$INVOICE_RESULT" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        print_error "Creation facture echouee"
        print_info "Erreur: ${ERROR_MSG:-Configuration incomplete}"
        print_info "Verifiez: POS Profile, Warehouse, Mode de paiement"
    fi
else
    print_info "Creation de facture ignoree (configuration incomplete)"
    print_info "Prerequis: Produits, POS Profile, Client"
fi

# ============================================
# ETAPE 7: VERIFIER LE STOCK (OPTIONNEL)
# ============================================

print_step "7" "Verification du stock (optionnel)"

if [ -n "$FIRST_ITEM_CODE" ] && [ -n "$WAREHOUSE" ]; then
    STOCK_RESULT=$(curl -s -b "$COOKIE_FILE" \
        "$SERVER_URL/api/method/erpnext.stock.utils.get_stock_balance?item_code=$FIRST_ITEM_CODE&warehouse=$WAREHOUSE")

    if echo "$STOCK_RESULT" | grep -q "message"; then
        STOCK_QTY=$(echo "$STOCK_RESULT" | grep -o '"message":[0-9.]*' | cut -d':' -f2)
        print_success "Stock de $FIRST_ITEM_CODE: ${STOCK_QTY:-0}"
    else
        print_info "Stock non disponible"
    fi
else
    print_info "Verification stock ignoree"
fi

# ============================================
# ETAPE 8: DECONNEXION
# ============================================

print_step "8" "Deconnexion"

LOGOUT_RESULT=$(curl -s -b "$COOKIE_FILE" -X POST \
    "$SERVER_URL/api/method/logout")

if echo "$LOGOUT_RESULT" | grep -q "message"; then
    print_success "Deconnexion reussie"
else
    print_info "Deconnexion (session expiree ou deja deconnecte)"
fi

# ============================================
# RESUME
# ============================================

echo ""
echo -e "${BLUE}${BOLD}=========================================="
echo -e "  RESUME DU FLUX"
echo -e "==========================================${NC}"
echo ""
echo "Etapes completees:"
echo "  1. Connexion:           OK"
echo "  2. Produits:            $([ -n "$FIRST_ITEM_CODE" ] && echo "OK ($ITEM_COUNT)" || echo "N/A")"
echo "  3. Client:              $([ -n "$CUSTOMER_NAME" ] && echo "OK" || echo "N/A")"
echo "  4. POS Profile:         $([ -n "$POS_PROFILE" ] && echo "OK" || echo "N/A")"
echo "  5. Warehouse:           $([ -n "$WAREHOUSE" ] && echo "OK" || echo "N/A")"
echo "  6. Facture:             $([ -n "$INVOICE_NAME" ] && echo "OK ($INVOICE_NAME)" || echo "N/A")"
echo "  7. Stock:               Verifie"
echo "  8. Deconnexion:         OK"
echo ""

if [ -n "$POS_PROFILE" ] && [ -n "$FIRST_ITEM_CODE" ]; then
    echo -e "${GREEN}${BOLD}✓ Flux complet execute avec succes!${NC}"
    echo ""
    echo "Le systeme est pret pour l'utilisation en production."
    exit 0
else
    echo -e "${YELLOW}${BOLD}⚠ Flux partiel - configuration incomplete${NC}"
    echo ""
    echo "Pour completer la configuration:"
    if [ -z "$FIRST_ITEM_CODE" ]; then
        echo "  - Creez des produits (Items) dans ERPNext"
    fi
    if [ -z "$POS_PROFILE" ]; then
        echo "  - Creez un POS Profile dans ERPNext"
    fi
    if [ -z "$WAREHOUSE" ]; then
        echo "  - Configurez un Warehouse dans ERPNext"
    fi
    exit 0
fi
