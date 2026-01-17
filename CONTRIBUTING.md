# Guide de Contribution

Merci de votre intérêt pour contribuer à TailPOS ERPNext Integration! Ce document explique comment participer au projet.

---

## Table des Matières

1. [Code de Conduite](#code-de-conduite)
2. [Comment Contribuer](#comment-contribuer)
3. [Configuration de l'Environnement](#configuration-de-lenvironnement)
4. [Standards de Code](#standards-de-code)
5. [Process de Pull Request](#process-de-pull-request)
6. [Signaler des Bugs](#signaler-des-bugs)
7. [Proposer des Fonctionnalités](#proposer-des-fonctionnalités)

---

## Code de Conduite

### Nos Standards

- Utiliser un langage accueillant et inclusif
- Respecter les différents points de vue et expériences
- Accepter les critiques constructives avec grâce
- Se concentrer sur ce qui est le mieux pour la communauté
- Faire preuve d'empathie envers les autres membres

### Comportements Inacceptables

- Langage ou images à caractère sexuel
- Trolling, commentaires insultants ou désobligeants
- Harcèlement public ou privé
- Publication d'informations privées sans consentement

---

## Comment Contribuer

### Types de Contributions

1. **Corrections de bugs** - Corriger des problèmes existants
2. **Nouvelles fonctionnalités** - Ajouter des capacités
3. **Documentation** - Améliorer ou traduire la documentation
4. **Tests** - Ajouter ou améliorer les tests
5. **Revue de code** - Réviser les Pull Requests

### Étapes Générales

```bash
# 1. Fork le repository
# (Cliquer sur "Fork" sur GitHub)

# 2. Cloner votre fork
git clone https://github.com/VOTRE_USERNAME/POS_PROJET.git
cd POS_PROJET

# 3. Ajouter le remote upstream
git remote add upstream https://github.com/ORIGINAL_OWNER/POS_PROJET.git

# 4. Créer une branche de travail
git checkout -b feature/ma-nouvelle-fonctionnalite

# 5. Faire vos modifications
# ...

# 6. Commiter vos changements
git add .
git commit -m "feat: ajoute la fonctionnalité X"

# 7. Pousser vers votre fork
git push origin feature/ma-nouvelle-fonctionnalite

# 8. Créer une Pull Request sur GitHub
```

---

## Configuration de l'Environnement

### Prérequis

- Node.js 16.x ou supérieur
- npm ou yarn
- Android Studio (pour le développement mobile)
- ERPNext v15 (pour les tests d'intégration)

### Installation

```bash
# Cloner le projet
git clone https://github.com/VOTRE_USERNAME/POS_PROJET.git
cd POS_PROJET/tailpos-master

# Installer les dépendances
npm install

# Vérifier les dépendances
npm run check:deps

# Lancer les tests
npm run test:api
```

### Configuration pour les Tests

```bash
# Créer le fichier de configuration de test
cat > src/api/config.json << EOF
{
  "serverUrl": "http://localhost:8000",
  "username": "test_user@example.com",
  "password": "test_password",
  "company": "Test Company",
  "warehouse": "Test Warehouse - TC",
  "posProfile": "Test POS"
}
EOF
```

---

## Standards de Code

### Style JavaScript

Nous suivons les conventions ESLint standard avec quelques personnalisations:

```javascript
// ✅ Bon
const getUserById = async (userId) => {
  const user = await api.getUser(userId);
  return user;
};

// ❌ Mauvais
async function getUserById(userId) {
    var user = await api.getUser(userId)
    return user
}
```

### Conventions de Nommage

| Type | Convention | Exemple |
|------|------------|---------|
| Variables | camelCase | `userName`, `itemCount` |
| Constantes | UPPER_SNAKE_CASE | `API_URL`, `MAX_RETRIES` |
| Classes | PascalCase | `FrappeAPI`, `SyncService` |
| Fichiers | PascalCase.js | `DataMapper.js`, `ApiConfig.js` |
| Fonctions | camelCase | `fetchItems()`, `createInvoice()` |

### Documentation du Code

```javascript
/**
 * Récupère la liste des items depuis ERPNext
 *
 * @param {Object} options - Options de requête
 * @param {string[]} options.fields - Champs à retourner
 * @param {Array} options.filters - Filtres de recherche
 * @param {number} options.limit - Nombre max de résultats
 * @returns {Promise<Array>} Liste des items
 * @throws {ApiError} Si la requête échoue
 *
 * @example
 * const items = await api.getItems({
 *   fields: ['name', 'item_name'],
 *   limit: 100
 * });
 */
async getItems(options = {}) {
  // ...
}
```

### Structure des Fichiers

```javascript
/**
 * Description du module
 *
 * @module NomDuModule
 * @author Votre Nom
 * @version 1.0.0
 */

// 1. Imports
import { dependency } from 'package';

// 2. Constantes
const CONSTANT_VALUE = 'value';

// 3. Classes / Fonctions principales
class MainClass {
  // ...
}

// 4. Fonctions utilitaires
function helperFunction() {
  // ...
}

// 5. Exports
export { MainClass, helperFunction };
export default MainClass;
```

---

## Process de Pull Request

### Avant de Soumettre

- [ ] Le code respecte les standards de style
- [ ] Tous les tests existants passent
- [ ] Les nouvelles fonctionnalités ont des tests
- [ ] La documentation est mise à jour
- [ ] Le CHANGELOG est mis à jour (si applicable)

### Format du Titre

Utilisez le format [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Types:
- feat: Nouvelle fonctionnalité
- fix: Correction de bug
- docs: Documentation uniquement
- style: Formatage (pas de changement de code)
- refactor: Refactoring (pas de nouvelle fonctionnalité ni bug fix)
- test: Ajout ou modification de tests
- chore: Maintenance (build, CI, etc.)
```

**Exemples:**
```
feat(api): ajoute le support pour les remises
fix(sync): corrige la synchronisation des stocks négatifs
docs(readme): met à jour les instructions d'installation
test(validator): ajoute des tests pour la validation des items
```

### Template de Pull Request

```markdown
## Description
[Description claire des changements]

## Type de changement
- [ ] Bug fix (changement non-breaking qui corrige un problème)
- [ ] Nouvelle fonctionnalité (changement non-breaking qui ajoute une fonctionnalité)
- [ ] Breaking change (fix ou fonctionnalité qui casserait la compatibilité)
- [ ] Documentation

## Comment tester
1. [Étape 1]
2. [Étape 2]
3. [Vérifier que...]

## Checklist
- [ ] Mon code suit le style du projet
- [ ] J'ai fait une auto-revue de mon code
- [ ] J'ai commenté mon code aux endroits difficiles à comprendre
- [ ] J'ai mis à jour la documentation
- [ ] Mes changements ne génèrent pas de nouveaux warnings
- [ ] J'ai ajouté des tests qui prouvent que mon fix/feature fonctionne
- [ ] Les tests unitaires passent localement
```

### Processus de Revue

1. **Soumission** - Créez votre PR avec une description complète
2. **CI/CD** - Les tests automatiques sont exécutés
3. **Revue** - Un mainteneur révise le code
4. **Feedback** - Répondez aux commentaires et faites les modifications
5. **Approbation** - La PR est approuvée
6. **Merge** - La PR est fusionnée dans main

---

## Signaler des Bugs

### Avant de Signaler

1. Vérifiez les [Issues existantes](https://github.com/OWNER/POS_PROJET/issues)
2. Consultez le [guide de dépannage](./TROUBLESHOOTING.md)
3. Testez avec la dernière version

### Template de Bug Report

```markdown
## Description du Bug
[Description claire et concise]

## Étapes pour Reproduire
1. Aller à '...'
2. Cliquer sur '...'
3. Voir l'erreur

## Comportement Attendu
[Ce qui devrait se passer]

## Comportement Actuel
[Ce qui se passe réellement]

## Screenshots
[Si applicable]

## Environnement
- OS: [ex: Windows 11]
- Version TailPOS: [ex: 1.4.0]
- Version ERPNext: [ex: 15.0.0]
- Version Node: [ex: 18.17.0]

## Logs
```
[Coller les logs pertinents ici]
```

## Contexte Additionnel
[Toute autre information pertinente]
```

---

## Proposer des Fonctionnalités

### Template de Feature Request

```markdown
## Résumé
[Description courte de la fonctionnalité]

## Motivation
[Pourquoi cette fonctionnalité serait utile?]

## Description Détaillée
[Explication détaillée de la fonctionnalité proposée]

## Alternatives Considérées
[Autres approches que vous avez envisagées]

## Contexte Additionnel
[Mockups, exemples, liens vers des fonctionnalités similaires]
```

---

## Ressources

- [Documentation ERPNext](https://docs.erpnext.com/)
- [Documentation React Native](https://reactnative.dev/docs/getting-started)
- [API Frappe](https://frappeframework.com/docs/user/en/api)

---

## Questions?

Si vous avez des questions sur la contribution:

1. Ouvrez une [Discussion](https://github.com/OWNER/POS_PROJET/discussions)
2. Rejoignez notre [Discord/Slack] (si applicable)
3. Envoyez un email à [maintainer@example.com]

---

Merci de contribuer à TailPOS ERPNext Integration!
