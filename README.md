# ProfAbsent React Native Team Project
Contexte:
  Le collège souhaite désormais confier cette mission à des étudiants afin de 
  • finaliser le lien entre l’application et la base de données, 
  • développer une interface de connexion, 
  • permettre aux enseignants de saisir et consulter leurs demandes, 
  • donner à la direction un tableau de validation des absences.

# ProfAbsent — Application Expo + Supabase

> Gestion simple des demandes d'absence pour les enseignants/personnels. Projet Expo Router (React Native) avec backend Supabase.

## 🚀 Fonctionnalités

- Onboarding et authentification (Supabase Auth ou mode développement)
- Tableau de bord avec statistiques et dernières demandes
- Création, consultation et édition (si en attente) des demandes d'absence
- Profil utilisateur (lecture/édition de champs de base)
- Pages utilitaires: Diagnostic connexion, Espace gestionnaire (placeholder)

## 🧱 Stack technique

- React Native via Expo 54 (Expo Router)
- Supabase (Auth, Tables, RLS)
- AsyncStorage (état d’onboarding)
- TypeScript, ESLint

## 📦 Prérequis

- Node.js 18+ recommandé
- Compte Supabase et projet actif
- Expo Go ou un émulateur Android/iOS pour les tests

## 🔧 Installation

Dans un terminal PowerShell (Windows):

```powershell
# Installer les dépendances
npm install

# Lancer l'app (ouvre le DevTools Expo)

```

Scripts utiles:

- `npm start` → démarre Expo
- `npm run android` → ouvre sur un émulateur Android (si disponible)
- `npm run ios` → ouvre sur un simulateur iOS (macOS requis)
- `npm run web` → démarre sur le web
- `npm run lint` → lint du projet

## 🔐 Configuration Supabase (env)

Le projet nécessite un URL Supabase et une clé anonyme (anon key). Créez un fichier `.env` à la racine du dossier `ProfAbsent` en vous basant sur `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Remarques importantes:
- Le fichier `utils/supabase.ts` contient actuellement des valeurs en dur pour faciliter le développement. Pour un dépôt public, remplacez-les par les variables d’environnement ci-dessus (ou gardez-les synchronisées manuellement).
- Ne commitez jamais de clés sensibles en production. Les clés anonymes Supabase ne donnent qu’un accès public limité, mais restent à traiter avec précaution.

## 🗃️ Base de données Supabase

Un script d’initialisation est fourni: `supabase_init.sql`.
Il crée les tables suivantes (avec RLS):

- `profiles` — profil utilisateur étendu
- `absence_types` — types d’absence disponibles
- `absence_requests` — demandes d’absence des utilisateurs
- `absence_balances` — soldes de congés par type/année
- `notifications` — notifications liées aux demandes

Attention aux alignements schéma ↔ code:
- Le code utilise le champ `role` dans `profiles`, mais le SQL fourni définit `fonction`. Harmonisez en choisissant l’un des deux (recommandé: `role`).
- Le code suppose que `profiles.id_profile` est l’UUID de l’utilisateur (égal à `auth.users.id`). Dans le SQL fourni, `id_profile` est `SERIAL`. À ajuster.

Patch SQL recommandé (exemple) si vous partez de zéro:

```sql
-- Exemple: faire coïncider le schéma avec le code existant
DROP TABLE IF EXISTS profiles CASCADE;
CREATE TABLE profiles (
  id_profile UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom_complet TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Professeur','Personnel administratif','Gestionnaire')),
  departement TEXT,
  telephone TEXT,
  date_embauche DATE,
  date_creation TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  date_modification TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id_profile);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id_profile);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id_profile);
```

Vérifiez également que les colonnes utilisées dans le code existent:
- `absence_requests`: `id_utilisateur (UUID)`, `id_type_absence`, `date_debut`, `date_fin`, `motif`, `statut`, `date_creation`, `date_modification`
- `absence_types`: `id_absence_type`, `nom`, `est_actif`
- `absence_balances`: `jours_restants`, `annee`

## 🧭 Flux applicatif

1) `app/index.tsx` (écran de lancement) décide de la navigation:
- si onboarding non terminé → `app/onboarding.tsx`
- si connecté → `app/(tabs)`
- sinon → `app/login.tsx`

2) Authentification:
- `app/login.tsx` (connexion) et `app/register.tsx` (inscription) via Supabase
- Mode dév optionnel: `utils/devAuth.ts` (`DEV_MODE`) pour contourner Supabase en local

3) Utilisation:
- `app/(tabs)/index.tsx` (Accueil) affiche stats + dernières demandes
- `app/(tabs)/request.tsx` pour créer une demande (sélecteur de jours ouvrés inclus)
- `app/(tabs)/requests/[id].tsx` pour voir/éditer une demande « en attente »
- `app/(tabs)/Profile.tsx` pour consulter/éditer son profil

## 📁 Documentation des fichiers essentiels

- `app/_layout.tsx` — Déclare la pile de navigation (Stack) sans header, inclut les routes: `splash` (index), `onboarding`, `login`, `register`, `diagnostic`, `(tabs)`, `manager`.
- `app/index.tsx` — « Splash logicielle »: lit l’état d’onboarding + session Supabase via `useAuth` et redirige.
- `app/onboarding.tsx` — Carousel de bienvenue. Appelle `completeOnboarding()` et redirige vers l’inscription.
- `app/login.tsx` — Formulaire de connexion. Supporte `DEV_MODE` (via `devAuth.ts`) et Supabase (`supabase.auth.signInWithPassword`). Crée le profil si manquant.
- `app/register.tsx` — Inscription Supabase (`auth.signUp`) avec métadonnées (nom, rôle, département, téléphone). Insère un profil si la session est active.
- `app/diagnostic.tsx` — Outils de diagnostic (test de connexion Supabase, création utilisateur test, etc.).
- `app/manager.tsx` — Écran « Gestionnaire » (placeholder) pour futures fonctions d’admin.
- `app/(tabs)/_layout.tsx` — Définition des onglets (Accueil, Demande, Profil), header et tab bar avec dégradés, actions (Paramètres, Déconnexion).
- `app/(tabs)/index.tsx` — Tableau de bord: salut personnalisé, stats (en attente, jours restants, approuvées), dernières demandes (avec lien détails).
- `app/(tabs)/request.tsx` — Création d’une demande: sélecteur de type (depuis `absence_types` actifs), calendrier « jours ouvrés » (lun→ven), insertion dans `absence_requests`.
- `app/(tabs)/requests/[id].tsx` — Détails d’une demande: affiche statut/couleurs, période, motif; si statut `en_attente`, permet l’édition (type, période, motif) et sauvegarde.
- `app/(tabs)/Profile.tsx` — Profil utilisateur: charge depuis `profiles`, édition des champs (nom, département, téléphone) et mise à jour.
- `utils/supabase.ts` — Client Supabase initialisé (polyfill URL), helper `testSupabaseConnection`. À adapter pour lire `process.env.EXPO_PUBLIC_*`.
- `utils/useAuth.ts` — Hook d’auth + onboarding (AsyncStorage `onboardingCompleted`), expose `signOut` et `checkAuthAndOnboarding`.
- `utils/devAuth.ts` — Mode dév: identifiants de test et simulateurs de login/register.
- `supabase_init.sql` — Script SQL complet (tables + RLS). À ajuster pour faire coïncider `profiles`/`absence_requests` avec les attentes du code (voir section Base de données).
- `app.json` — Configuration Expo (icônes, splash, Android edge-to-edge, plugins, typedRoutes, reactCompiler).

## 🧪 Conseils de test rapide

- Activez `DEV_MODE` dans `utils/devAuth.ts` pour tester les écrans sans Supabase.
- En mode Supabase, vérifiez que le profil est bien créé après la connexion/inscription (table `profiles`).
- Si vous voyez un écran vide après le splash, c’est souvent dû à une session manquante ou un onboarding non marqué. Ouvrez `app/diagnostic.tsx` depuis la page de connexion.

## ❗ Dépannage (FAQ)

- « Impossible de charger les types d’absence » → Vérifiez que la table `absence_types` contient des lignes actives (`est_actif = true`).
- « Profil introuvable » → Assurez-vous que `profiles.id_profile` est l’UUID de l’utilisateur et que la colonne `role` existe.
- « 401/403 avec RLS » → Revoyez les Policies dans le SQL; la plupart des requêtes supposent que l’utilisateur ne peut lire/modifier que ses données.

## 📝 Licence

MIT — libre d’utilisation et de contribution.

