# Système de Gestion des Rôles et Redirection

## Résumé des Modifications

J'ai implémenté un système complet de gestion des rôles utilisateur avec redirection automatique pour les gestionnaires. Voici ce qui a été mis en place :

## 1. Modifications du Système d'Authentification

### `utils/userUtils.ts` (NOUVEAU)

- Fonctions utilitaires pour récupérer les informations utilisateur
- `getCurrentUserProfile()` : Récupère le profil complet de l'utilisateur connecté
- `getUserRole()` : Récupère uniquement le rôle de l'utilisateur
- `isManager()` : Vérifie si l'utilisateur est un gestionnaire
- Compatible avec le mode développement et production (Supabase)

### `utils/useAuth.ts` (MODIFIÉ)

- Ajout de la gestion du profil utilisateur avec `userProfile` state
- Nouvelle fonction `isManager()` pour vérifier le rôle
- Mise à jour de `setDevAuthentication()` pour stocker l'email en mode dev
- Récupération automatique du profil lors de la connexion

## 2. Modifications du Processus de Connexion

### `app/login.tsx` (MODIFIÉ)

- **Correction du bug** : Suppression du code erroné avec la variable `User` non définie
- **Mode Production** : Vérification du rôle en base de données après connexion Supabase
- **Mode Développement** : Vérification du rôle depuis les données de test
- **Redirection automatique** :
  - Gestionnaire → `/manager`
  - Autres rôles → `/` (page principale)

## 3. Protection des Routes

### `app/index.tsx` (MODIFIÉ)

- Vérification du rôle utilisateur au démarrage
- Redirection automatique des gestionnaires vers `/manager`
- Autres utilisateurs dirigés vers les tabs

### `app/(tabs)/_layout.tsx` (MODIFIÉ)

- Protection empêchant les gestionnaires d'accéder aux tabs
- Redirection automatique vers `/manager` si un gestionnaire tente d'accéder

### `app/manager.tsx` (MODIFIÉ)

- Utilisation du nouveau système d'authentification
- Protection renforcée contre l'accès non autorisé
- Redirection vers login si non connecté
- Redirection vers tabs si pas gestionnaire

## 4. Composant de Protection (Optionnel)

### `utils/RouteGuard.tsx` (NOUVEAU)

Composant réutilisable pour protéger n'importe quelle route :

```tsx
<RouteGuard requireManager={true}>
  {/* Contenu réservé aux gestionnaires */}
</RouteGuard>

<RouteGuard blockManager={true}>
  {/* Contenu interdit aux gestionnaires */}
</RouteGuard>
```

## 5. Flux de Redirection

### Pour les Gestionnaires :

1. **Connexion** → Vérification rôle en BDD → **Redirection vers `/manager`**
2. **Tentative d'accès aux tabs** → **Redirection forcée vers `/manager`**
3. **Démarrage de l'app** → **Redirection directe vers `/manager`**

### Pour les Autres Rôles :

1. **Connexion** → Vérification rôle → **Redirection vers `/` puis tabs**
2. **Tentative d'accès à `/manager`** → **Alerte + Redirection vers tabs**
3. **Démarrage de l'app** → **Accès normal aux tabs**

## 6. Mode Développement

### Utilisateurs de Test Disponibles :

- `admin@test.com` / `admin123` → **Gestionnaire** (redirigé vers /manager)
- `prof@test.com` / `prof123` → **Professeur** (accès normal aux tabs)
- `test@test.com` / `password123` → **Personnel Administratif** (accès normal aux tabs)

## 7. Sécurité

✅ **Vérification côté client** : Empêche la navigation non autorisée
✅ **Vérification en base de données** : Validation du rôle depuis Supabase
✅ **Redirection automatique** : Impossible de contourner les restrictions
✅ **Protection multi-niveaux** : Vérifications à la connexion, au démarrage et à la navigation

## Test du Système

1. **Activer le mode dev** : `DEV_MODE = true` dans `utils/devAuth.ts`
2. **Tester avec gestionnaire** : Se connecter avec `admin@test.com` / `admin123`
3. **Vérifier la redirection** : Doit aller directement sur `/manager`
4. **Tester avec professeur** : Se connecter avec `prof@test.com` / `prof123`
5. **Vérifier l'accès normal** : Doit aller sur les tabs normalement

Le système est maintenant entièrement fonctionnel et sécurisé !
