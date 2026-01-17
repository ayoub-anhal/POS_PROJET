# Configuration ERPNext pour TailPOS

Guide complet pour configurer ERPNext comme backend de TailPOS.

**Version**: 2.0.0
**Date**: 2025-01-17

---

## Table des matieres

1. [Prerequis](#prerequis)
2. [Installation Frappe Bench](#installation-frappe-bench)
3. [Creation du site](#creation-du-site)
4. [Installation ERPNext](#installation-erpnext)
5. [Configuration CORS](#configuration-cors)
6. [Configuration POS](#configuration-pos)
7. [Test de l'API](#test-de-lapi)
8. [Configuration TailPOS](#configuration-tailpos)
9. [Problemes courants](#problemes-courants)
10. [Commandes utiles](#commandes-utiles)

---

## Prerequis

### Systeme d'exploitation
- Ubuntu 20.04 / 22.04 LTS (recommande)
- Debian 10 / 11
- macOS (developpement uniquement)

### Logiciels requis

| Logiciel | Version | Commande de verification |
|----------|---------|--------------------------|
| Python | 3.10 ou 3.11 | `python3 --version` |
| MariaDB | 10.6+ | `mariadb --version` |
| Redis | 6+ | `redis-server --version` |
| Node.js | 18 LTS | `node --version` |
| npm | 8+ | `npm --version` |
| yarn | 1.22+ | `yarn --version` |
| git | 2.x | `git --version` |

### Installation des prerequis (Ubuntu/Debian)

```bash
# Mise a jour du systeme
sudo apt-get update && sudo apt-get upgrade -y

# Python et outils de developpement
sudo apt-get install -y python3-dev python3-pip python3-venv
sudo apt-get install -y build-essential libffi-dev

# MariaDB
sudo apt-get install -y mariadb-server mariadb-client
sudo apt-get install -y libmariadb-dev

# Redis
sudo apt-get install -y redis-server

# Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Yarn
sudo npm install -g yarn

# wkhtmltopdf (pour les PDFs)
sudo apt-get install -y wkhtmltopdf

# Autres dependances
sudo apt-get install -y xvfb libfontconfig
```

### Configuration MariaDB

```bash
# Securiser l'installation
sudo mysql_secure_installation

# Se connecter a MariaDB
sudo mysql -u root -p

# Creer l'utilisateur frappe
CREATE USER 'frappe'@'localhost' IDENTIFIED BY 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON *.* TO 'frappe'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EXIT;
```

Modifier `/etc/mysql/mariadb.conf.d/50-server.cnf`:

```ini
[mysqld]
character-set-client-handshake = FALSE
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

[mysql]
default-character-set = utf8mb4
```

Redemarrer MariaDB:

```bash
sudo systemctl restart mariadb
```

---

## Installation Frappe Bench

```bash
# Installer frappe-bench
pip3 install frappe-bench

# Verifier l'installation
bench --version

# Initialiser un nouveau bench (version 15)
bench init --frappe-branch version-15 frappe-bench

# Aller dans le dossier bench
cd frappe-bench
```

---

## Creation du site

```bash
# Creer un nouveau site
bench new-site site1.local \
    --admin-password admin \
    --mariadb-root-password votre_mot_de_passe_root

# Ajouter le site au fichier hosts (optionnel)
echo "127.0.0.1 site1.local" | sudo tee -a /etc/hosts

# Definir comme site par defaut
bench use site1.local
```

---

## Installation ERPNext

```bash
# Telecharger ERPNext
bench get-app erpnext --branch version-15

# Installer sur le site
bench --site site1.local install-app erpnext

# Lancer le setup wizard (interface web)
bench start
# Puis ouvrir http://localhost:8000 dans le navigateur
```

---

## Configuration CORS

### Option 1: Via le fichier site_config.json

Copier le template de configuration:

```bash
cp ../erpnext-develop/site_config_template.json sites/site1.local/site_config.json
```

Editer `sites/site1.local/site_config.json` et modifier:
- `db_name`: Nom de votre base de donnees
- `db_password`: Mot de passe de la base
- `admin_password`: Mot de passe administrateur

### Option 2: Via le script Python

```bash
# Executer le script de configuration CORS
bench --site site1.local execute cors_config.setup_for_tailpos
```

### Verification

```bash
# Verifier la configuration
bench --site site1.local execute cors_config.check_cors_config
```

---

## Configuration POS

### Execution du script de setup

```bash
# Copier les scripts dans le bench
cp ../erpnext-develop/setup_pos.py apps/erpnext/

# Executer le setup
bench --site site1.local execute setup_pos.main
```

Ce script va creer automatiquement:
- Un utilisateur POS avec API Key
- Un entrepot principal
- Une liste de prix
- Un profil POS
- Un client par defaut
- 5 produits d'exemple avec stock

### Verification du setup

```bash
# Lister les utilisateurs
bench --site site1.local execute "frappe.get_all('User', fields=['email'])"

# Lister les produits
bench --site site1.local execute "frappe.get_all('Item', fields=['item_code', 'item_name'])"

# Verifier le profil POS
bench --site site1.local execute "frappe.get_doc('POS Profile', 'Default POS Profile')"
```

### Fichier de credentials

Apres execution de `setup_pos.py`, un fichier `pos_credentials.json` est genere:

```bash
cat pos_credentials.json
```

Contenu exemple:
```json
{
  "generated_date": "2025-01-17T10:30:00",
  "pos_user": {
    "email": "pos_user@example.com",
    "password": "pos_password_123",
    "api_key": "abc123xyz789...",
    "api_secret": "secret456..."
  },
  "server": {
    "url": "http://localhost:8000"
  }
}
```

---

## Test de l'API

### Test de connexion (login)

```bash
curl -X POST http://localhost:8000/api/method/login \
  -H "Content-Type: application/json" \
  -d '{
    "usr": "pos_user@example.com",
    "pwd": "pos_password_123"
  }'
```

Reponse attendue:
```json
{
  "message": "Logged In",
  "full_name": "POS User"
}
```

### Test avec API Key

```bash
# Recuperer les produits
curl -X GET "http://localhost:8000/api/resource/Item?limit_page_length=5" \
  -H "Authorization: token api_key:api_secret"

# Exemple avec vraies cles:
curl -X GET "http://localhost:8000/api/resource/Item?limit_page_length=5" \
  -H "Authorization: token abc123xyz789:secret456def"
```

### Test du stock

```bash
curl -X GET "http://localhost:8000/api/method/erpnext.stock.utils.get_stock_balance" \
  -H "Authorization: token api_key:api_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "item_code": "ITEM-001",
    "warehouse": "Main Store - MC"
  }'
```

### Test creation facture POS

```bash
curl -X POST "http://localhost:8000/api/resource/POS Invoice" \
  -H "Authorization: token api_key:api_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": "Walk-in Customer",
    "pos_profile": "Default POS Profile",
    "items": [
      {
        "item_code": "ITEM-001",
        "qty": 1,
        "rate": 100
      }
    ],
    "payments": [
      {
        "mode_of_payment": "Cash",
        "amount": 100
      }
    ]
  }'
```

---

## Configuration TailPOS

### Parametres a configurer dans TailPOS

Ouvrir l'application TailPOS et aller dans Settings > Server Configuration:

| Parametre | Valeur |
|-----------|--------|
| Server URL | `http://VOTRE_IP:8000` |
| Username | `pos_user@example.com` |
| Password | `pos_password_123` |
| Warehouse | `Main Store - MC` |
| Price List | `Standard Selling` |

### Pour connexion reseau local

Si TailPOS est sur un appareil mobile:

1. Trouver l'IP du serveur:
   ```bash
   hostname -I
   # ou
   ip addr show
   ```

2. Configurer le pare-feu:
   ```bash
   sudo ufw allow 8000/tcp
   sudo ufw allow 9000/tcp
   ```

3. Utiliser l'IP dans TailPOS:
   - `http://192.168.1.100:8000` (exemple)

---

## Problemes courants

### CORS bloque

**Symptome**: Erreur "Access-Control-Allow-Origin" dans la console

**Solution**:
```bash
# Verifier la configuration
bench --site site1.local execute cors_config.check_cors_config

# Forcer la configuration
bench --site site1.local execute cors_config.enable_cors

# Redemarrer
bench restart
```

### Erreur d'authentification

**Symptome**: "Invalid credentials" ou "Login required"

**Solutions**:
1. Verifier que l'utilisateur existe:
   ```bash
   bench --site site1.local execute "frappe.db.exists('User', 'pos_user@example.com')"
   ```

2. Reinitialiser le mot de passe:
   ```bash
   bench --site site1.local set-password pos_user@example.com nouveau_mot_de_passe
   ```

3. Regenerer les cles API:
   ```bash
   bench --site site1.local execute setup_pos.setup_api_access --args "['pos_user@example.com']"
   ```

### Pas de produits

**Symptome**: Liste des produits vide

**Solutions**:
1. Verifier les produits:
   ```bash
   bench --site site1.local execute "frappe.get_all('Item')"
   ```

2. Recreer les produits d'exemple:
   ```bash
   bench --site site1.local execute setup_pos.create_sample_items --args "['My Company', 'Main Store - MC', 'Standard Selling']"
   ```

### Erreur de stock

**Symptome**: "Insufficient stock" ou stock a 0

**Solution**:
```bash
# Verifier le stock
bench --site site1.local execute "frappe.get_all('Bin', filters={'item_code': 'ITEM-001'}, fields=['actual_qty'])"

# Creer une entree de stock
bench --site site1.local execute setup_pos.create_stock_entry --args "['ITEM-001', 'Main Store - MC', 100, 'My Company']"
```

### Timeout / Serveur ne repond pas

**Solutions**:
1. Verifier que bench est demarre:
   ```bash
   bench start
   ```

2. Verifier les ports:
   ```bash
   netstat -tlpn | grep -E '8000|9000|11000|12000|13000'
   ```

3. Verifier les logs:
   ```bash
   tail -f logs/frappe.log
   tail -f logs/worker.log
   ```

---

## Commandes utiles

### Gestion du bench

```bash
# Demarrer en mode developpement
bench start

# Demarrer en arriere-plan (production)
bench setup production
sudo supervisorctl restart all

# Voir les logs
bench logs

# Mettre a jour
bench update
```

### Gestion du site

```bash
# Liste des sites
bench --site site1.local list-apps

# Backup
bench --site site1.local backup

# Restore
bench --site site1.local restore backup.sql.gz

# Console Frappe
bench --site site1.local console
```

### Base de donnees

```bash
# Acces direct a la DB
bench --site site1.local mariadb

# Export des donnees
bench --site site1.local export-fixtures
```

### Debug

```bash
# Activer le mode debug
bench --site site1.local set-config developer_mode 1

# Voir les requetes SQL
bench --site site1.local set-config logging 1

# Clear cache
bench --site site1.local clear-cache
```

---

## Support

Pour toute question ou probleme:

1. Verifier les logs: `bench logs`
2. Consulter la documentation Frappe: https://frappeframework.com/docs
3. Forum ERPNext: https://discuss.erpnext.com

---

**Fin du guide de configuration**
