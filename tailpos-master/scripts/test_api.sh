#!/bin/bash

#############################################
# test_api.sh - Test de l'API ERPNext
#
# Script de test utilisant curl pour verifier
# la connexion et les endpoints de l'API ERPNext.
#
# Usage:
#   ./scripts/test_api.sh [server_url]
#   ./scripts/test_api.sh http://192.168.1.100:8000
#
# Prerequis:
#   - curl installe
#   - Serveur ERPNext accessible
#   - Utilisateur POS configure
#
# @author TailPOS Integration
# @version 2.0.0
# @date 2025-01-17
#############################################

# ============================================
# CONFIGURATION
# ============================================

# URL du serveur (argument ou defaut)
SERVER_URL="${1:-http://localhost:8000}"

# Credentials (a modifier selon votre configuration)
USERNAME="${ERPNEXT_USER:-pos_user@example.com}"
PASSWORD="${ERPNEXT_PASSWORD:-pos_password_123}"

# Fichier temporaire pour les cookies
COOKIE_FILE="/tmp/erpnext_test_cookies_$$.txt"

# ============================================
# COULEURS POUR L'AFFICHAGE
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ============================================
# COMPTEURS
# ============================================

PASSED=0
FAILED=0
SKIPPED=0
TOTAL=0

# ============================================
# FONCTIONS UTILITAIRES
# ============================================

# Afficher un titre
print_title() {
    echo ""
    echo -e "${BLUE}${BOLD}=========================================="
    echo -e "  $1"
    echo -e "==========================================${NC}"
    echo ""
}

# Afficher un sous-titre
print_section() {
    echo ""
    echo -e "${CYAN}--- $1 ---${NC}"
}

# Executer un test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected="$3"
    local skip_on_fail="${4:-false}"

    ((TOTAL++))

    echo -n "  Testing: $test_name... "

    # Executer la commande
    result=$(eval "$command" 2>&1)
    exit_code=$?

    # Verifier le resultat
    if [ $exit_code -eq 0 ] && echo "$result" | grep -q "$expected"; then
        echo -e "${GREEN}[PASSED]${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}[FAILED]${NC}"
        ((FAILED++))

        if [ "$skip_on_fail" = "true" ]; then
            echo -e "    ${YELLOW}(Erreur critique - tests suivants peuvent echouer)${NC}"
        fi

        # Afficher les details en mode verbose
        if [ "${VERBOSE:-false}" = "true" ]; then
            echo "    Expected: $expected"
            echo "    Got: ${result:0:200}..."
        fi

        return 1
    fi
}

# Executer un test optionnel (ne compte pas comme echec)
run_optional_test() {
    local test_name="$1"
    local command="$2"
    local expected="$3"

    echo -n "  Testing (optional): $test_name... "

    result=$(eval "$command" 2>&1)

    if echo "$result" | grep -q "$expected"; then
        echo -e "${GREEN}[PASSED]${NC}"
        ((PASSED++))
        ((TOTAL++))
        return 0
    else
        echo -e "${YELLOW}[SKIPPED]${NC}"
        ((SKIPPED++))
        ((TOTAL++))
        return 1
    fi
}

# Nettoyer avant de quitter
cleanup() {
    rm -f "$COOKIE_FILE"
}

trap cleanup EXIT

# ============================================
# DEBUT DES TESTS
# ============================================

print_title "TEST API ERPNEXT - TAILPOS"

echo -e "Serveur:    ${BOLD}$SERVER_URL${NC}"
echo -e "Utilisateur: ${BOLD}$USERNAME${NC}"
echo -e "Date:       $(date '+%Y-%m-%d %H:%M:%S')"

# ============================================
# 1. TESTS DE CONNEXION
# ============================================

print_section "Tests de Connexion"

# Test 1.1: Serveur accessible
run_test "Serveur accessible" \
    "curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 '$SERVER_URL'" \
    "200\|302\|301" \
    "true"

# Test 1.2: Endpoint API disponible
run_test "Endpoint API disponible" \
    "curl -s -o /dev/null -w '%{http_code}' '$SERVER_URL/api/method/frappe.auth.get_logged_user'" \
    "200\|401\|403"

# ============================================
# 2. TESTS D'AUTHENTIFICATION
# ============================================

print_section "Tests d'Authentification"

# Test 2.1: Login
run_test "Login" \
    "curl -s -c '$COOKIE_FILE' -X POST '$SERVER_URL/api/method/login' -H 'Content-Type: application/json' -d '{\"usr\":\"$USERNAME\",\"pwd\":\"$PASSWORD\"}'" \
    "message" \
    "true"

# Test 2.2: Get logged user
run_test "Get logged user" \
    "curl -s -b '$COOKIE_FILE' '$SERVER_URL/api/method/frappe.auth.get_logged_user'" \
    "message"

# ============================================
# 3. TESTS DES PRODUITS
# ============================================

print_section "Tests des Produits (Items)"

# Test 3.1: Recuperer liste Items
run_test "Get Items list" \
    "curl -s -b '$COOKIE_FILE' '$SERVER_URL/api/resource/Item?limit_page_length=5'" \
    "data"

# Test 3.2: Recuperer Item Groups
run_test "Get Item Groups" \
    "curl -s -b '$COOKIE_FILE' '$SERVER_URL/api/resource/Item%20Group?limit_page_length=5'" \
    "data"

# ============================================
# 4. TESTS DES CLIENTS
# ============================================

print_section "Tests des Clients (Customers)"

# Test 4.1: Recuperer liste Customers
run_test "Get Customers list" \
    "curl -s -b '$COOKIE_FILE' '$SERVER_URL/api/resource/Customer?limit_page_length=5'" \
    "data"

# Test 4.2: Creer Customer (optionnel - peut echouer selon permissions)
TEST_CUSTOMER="Test_API_$(date +%s)"
run_optional_test "Create Customer" \
    "curl -s -b '$COOKIE_FILE' -X POST '$SERVER_URL/api/resource/Customer' -H 'Content-Type: application/json' -d '{\"customer_name\":\"$TEST_CUSTOMER\",\"customer_type\":\"Individual\"}'" \
    "name"

# ============================================
# 5. TESTS POS
# ============================================

print_section "Tests POS"

# Test 5.1: Recuperer POS Profile
run_test "Get POS Profile" \
    "curl -s -b '$COOKIE_FILE' '$SERVER_URL/api/resource/POS%20Profile?limit_page_length=1'" \
    "data"

# Test 5.2: Recuperer Warehouses
run_test "Get Warehouses" \
    "curl -s -b '$COOKIE_FILE' '$SERVER_URL/api/resource/Warehouse?limit_page_length=5'" \
    "data"

# Test 5.3: Recuperer Price Lists
run_test "Get Price Lists" \
    "curl -s -b '$COOKIE_FILE' '$SERVER_URL/api/resource/Price%20List?limit_page_length=5'" \
    "data"

# ============================================
# 6. TESTS STOCK
# ============================================

print_section "Tests Stock"

# Recuperer le premier item pour le test de stock
FIRST_ITEM=$(curl -s -b "$COOKIE_FILE" "$SERVER_URL/api/resource/Item?limit_page_length=1" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$FIRST_ITEM" ]; then
    # Recuperer le premier warehouse
    FIRST_WAREHOUSE=$(curl -s -b "$COOKIE_FILE" "$SERVER_URL/api/resource/Warehouse?limit_page_length=1" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -n "$FIRST_WAREHOUSE" ]; then
        run_test "Get Stock Balance" \
            "curl -s -b '$COOKIE_FILE' '$SERVER_URL/api/method/erpnext.stock.utils.get_stock_balance?item_code=$FIRST_ITEM&warehouse=$FIRST_WAREHOUSE'" \
            "message"
    else
        echo -e "  ${YELLOW}[SKIP] Get Stock Balance - Aucun warehouse trouve${NC}"
        ((SKIPPED++))
        ((TOTAL++))
    fi
else
    echo -e "  ${YELLOW}[SKIP] Get Stock Balance - Aucun item trouve${NC}"
    ((SKIPPED++))
    ((TOTAL++))
fi

# ============================================
# 7. TEST DECONNEXION
# ============================================

print_section "Test Deconnexion"

# Test 7.1: Logout
run_test "Logout" \
    "curl -s -b '$COOKIE_FILE' -X POST '$SERVER_URL/api/method/logout'" \
    "message"

# ============================================
# RESUME
# ============================================

print_title "RESUME DES TESTS"

echo -e "  Tests executes: ${BOLD}$TOTAL${NC}"
echo -e "  Reussis:        ${GREEN}${BOLD}$PASSED${NC}"
echo -e "  Echoues:        ${RED}${BOLD}$FAILED${NC}"
echo -e "  Ignores:        ${YELLOW}${BOLD}$SKIPPED${NC}"

# Calculer le taux de reussite
if [ $((TOTAL - SKIPPED)) -gt 0 ]; then
    RATE=$((PASSED * 100 / (TOTAL - SKIPPED)))
    echo -e "  Taux reussite:  ${BOLD}$RATE%${NC}"
fi

echo ""

# ============================================
# CODE DE SORTIE
# ============================================

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}${BOLD}✓ Tous les tests ont reussi!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}${BOLD}✗ Certains tests ont echoue.${NC}"
    echo ""
    echo "Recommandations:"
    echo "  1. Verifiez que ERPNext est demarre"
    echo "  2. Verifiez les identifiants de connexion"
    echo "  3. Verifiez les permissions de l'utilisateur POS"
    echo "  4. Consultez les logs ERPNext pour plus de details"
    echo ""
    exit 1
fi
