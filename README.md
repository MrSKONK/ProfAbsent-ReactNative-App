# 📚 Documentation Technique - ProfAbsent

## 🎯 Vue d'ensemble du projet

**ProfAbsent** est une application mobile React Native dédiée à la gestion des demandes d'absence dans un établissement scolaire. Elle utilise **Supabase** comme backend et permet aux professeurs et au personnel administratif de gérer efficacement leurs demandes d'absence.

### Architecture technique

- **Frontend** : React Native avec Expo
- **Backend** : Supabase (PostgreSQL + API REST)
- **Authentification** : Supabase Auth avec gestion des rôles
- **Navigation** : Expo Router
- **État global** : React Hooks personnalisés

---

## 🔐 Partie 1 : Système d'authentification

### 📂 Fichiers concernés

- `app/login.tsx` - Interface de connexion
- `app/register.tsx` - Interface d'inscription
- `utils/supabase.ts` - Configuration client Supabase
- `utils/useAuth.ts` - Hook d'authentification global
- `utils/devAuth.ts` - Système d'authentification développement

### 🔄 Flux d'authentification complet

#### 1. **login.tsx** - Composant de connexion

**Responsabilités :**

- Validation des champs email/mot de passe
- Gestion des erreurs de connexion spécifiques
- Support mode développement et production
- Création automatique de profil utilisateur

**Fonctionnalités clés :**

```typescript
// Validation en temps réel
const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Gestion d'erreurs personnalisées
if (error.message.includes("Invalid login credentials")) {
  errorMessage = "Email ou mot de passe incorrect";
} else if (error.message.includes("Email not confirmed")) {
  errorMessage = "Veuillez confirmer votre email";
}
```

**États gérés :**

- `formData` : Données du formulaire (email, password)
- `errors` : Erreurs de validation par champ
- `loading` : État de chargement pour l'UI

#### 2. **register.tsx** - Composant d'inscription

**Responsabilités :**

- Formulaire d'inscription complet avec validation
- Sélection de rôle via modal
- Création automatique du profil utilisateur
- Gestion des métadonnées utilisateur

**Validation avancée :**

```typescript
// Validation mot de passe
if (formData.password.length < 6) {
  newErrors.password = "Le mot de passe doit contenir au moins 6 caractères";
}

// Validation confirmation
if (formData.password !== formData.confirmPassword) {
  newErrors.confirmPassword = "Les mots de passe ne correspondent pas";
}
```

**Champs du formulaire :**

- Nom complet (requis)
- Email (validation format)
- Mot de passe + confirmation (6 caractères minimum)
- Fonction (Professeur/Personnel administratif)
- Département (requis)
- Téléphone (optionnel, validation format)

#### 3. **supabase.ts** - Configuration backend

**Responsabilités :**

- Initialisation client Supabase
- Configuration persistance session
- Fonctions utilitaires de test

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: AsyncStorage, // Persistance mobile
  },
});
```

#### 4. **useAuth.ts** - Hook d'authentification global

**Responsabilités :**

- État global d'authentification
- Gestion session utilisateur
- Profil utilisateur et rôles
- Support mode développement

**États exportés :**

```typescript
return {
  isAuthenticated, // Statut de connexion
  isOnboardingCompleted, // Onboarding terminé
  isLoading, // Chargement en cours
  userProfile, // Données profil utilisateur
  isManager, // Fonction utilitaire rôle
  completeOnboarding, // Marquer onboarding terminé
  signOut, // Déconnexion
  setDevAuthentication, // Mode développement
};
```

### 🔗 Liaison avec Supabase

#### Processus de connexion :

1. **Saisie utilisateur** → Validation frontend
2. **Appel Supabase** → `supabase.auth.signInWithPassword()`
3. **Vérification profil** → Lecture table `profiles`
4. **Création profil** → Si inexistant, insertion automatique
5. **Redirection** → Page principale de l'app

#### Processus d'inscription :

1. **Formulaire complet** → Validation multi-critères
2. **Création utilisateur** → `supabase.auth.signUp()`
3. **Métadonnées** → Stockage dans `user_metadata`
4. **Profil automatique** → Insertion table `profiles`
5. **Confirmation email** → Selon configuration Supabase

### ⚡ Gestion des erreurs

**Erreurs de connexion :**

- Identifiants incorrects
- Email non confirmé
- Trop de tentatives
- Erreurs réseau

**Erreurs d'inscription :**

- Utilisateur déjà existant
- Mot de passe trop faible
- Email invalide
- Inscription désactivée

### 👥 Répartition des tâches

| Développeur | Responsabilité               | Justification                                  |
| ----------- | ---------------------------- | ---------------------------------------------- |
| **Dev 1**   | `login.tsx` + validation     | Composant critique, logique complexe d'erreurs |
| **Dev 2**   | `register.tsx` + formulaires | Interface utilisateur, validation multi-champs |
| **Dev 3**   | `utils/` (supabase, useAuth) | Infrastructure, hooks partagés, configuration  |

---

## 📅 Partie 2 : Gestion des demandes d'absences

### 📂 Fichier concerné

- `app/(tabs)/request.tsx` - Formulaire de demande d'absence

### 🏗️ Fonctionnement global

Le composant `request.tsx` implémente un système sophistiqué de demande d'absence avec :

- **Calendrier interactif** pour sélection de dates
- **Types d'absence dynamiques** depuis Supabase
- **Validation métier** adaptée au contexte professionnel
- **Interface optimisée mobile** avec modals

### 📊 Structure des données Supabase

#### Table `absence_requests`

```sql
CREATE TABLE absence_requests (
  id_absence_request SERIAL PRIMARY KEY,
  id_utilisateur UUID REFERENCES auth.users(id),
  id_type_absence INTEGER REFERENCES absence_types(id_absence_type),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  motif TEXT NOT NULL,
  statut TEXT DEFAULT 'en_attente',
  approuve_par UUID REFERENCES auth.users(id),
  date_creation TIMESTAMP DEFAULT now()
);
```

#### Table `absence_types`

```sql
CREATE TABLE absence_types (
  id_absence_type SERIAL PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  jours_max_par_an INTEGER,
  necessite_certificat_medical BOOLEAN DEFAULT FALSE,
  est_actif BOOLEAN DEFAULT TRUE
);
```

### 🗓️ Système de calendrier avancé

#### Logique de gestion des dates

**Formats et conversions :**

```typescript
// Conversion Date → ISO (stockage)
const toISO = (d: Date) => d.toISOString().slice(0, 10);

// Conversion ISO → Affichage français
const formatDisplay = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00"); // Évite décalages timezone
  return d.toLocaleDateString("fr-FR");
};
```

**Calendrier jours ouvrés uniquement :**

- Affichage Lundi → Vendredi exclusivement
- Navigation mensuelle fluide
- Prévention sélection dates passées
- Sélection plage intelligente

**Logique de sélection :**

```typescript
const onSelectDate = (date: Date) => {
  // CAS 1: Aucune date → Définit début
  if (!startDate) {
    setFormData((prev) => ({ ...prev, startDate: iso }));
    return;
  }

  // CAS 2: Début seul → Définit fin ou redémarre
  if (startDate && !endDate) {
    if (iso < startDate) {
      // Redémarre si antérieure
      setFormData((prev) => ({ ...prev, startDate: iso, endDate: "" }));
    } else {
      // Complète la plage
      setFormData((prev) => ({ ...prev, endDate: iso }));
    }
    return;
  }

  // CAS 3: Plage complète → Nouveau départ
  setFormData((prev) => ({ ...prev, startDate: iso, endDate: "" }));
};
```

### 📋 Validation et soumission

#### Validation formulaire :

```typescript
const validateForm = () => {
  const newErrors: Errors = {};

  if (!formData.startDate.trim()) {
    newErrors.startDate = "La date de début est requise";
  }

  if (!selectedTypeId) {
    newErrors.type = "Veuillez sélectionner un type d'absence";
  }

  return Object.keys(newErrors).length === 0;
};
```

#### Processus de soumission :

1. **Validation frontend** → Vérification champs obligatoires
2. **Récupération utilisateur** → Session Supabase active
3. **Insertion base** → Table `absence_requests`
4. **Confirmation utilisateur** → Alert de succès
5. **Réinitialisation** → Formulaire vidé pour nouvelle demande

### 🎯 États et hooks utilisés

```typescript
// État formulaire principal
const [formData, setFormData] = useState<FormData>({
  startDate: "",
  endDate: "",
  type: "",
  reason: "",
});

// Gestion types d'absence
const [types, setTypes] = useState<{ id: number; nom: string }[]>([]);
const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);

// Interface utilisateur
const [showCalendarModal, setShowCalendarModal] = useState(false);
const [showTypeModal, setShowTypeModal] = useState(false);
const [loading, setLoading] = useState(false);
```

### 👥 Répartition des tâches

| Développeur | Responsabilité                    | Justification                               |
| ----------- | --------------------------------- | ------------------------------------------- |
| **Dev 1**   | Système calendrier + dates        | Logique complexe, algorithmes de génération |
| **Dev 2**   | Interface formulaire + validation | UX/UI, composants visuels, interactions     |
| **Dev 3**   | Intégration Supabase + soumission | Backend, gestion données, états             |

---

## 🧑‍💼 Partie 3 : Espace Manager

### 📂 Fichier concerné

- `app/manager.tsx` - Interface de gestion pour les managers

### 🎯 Fonctions principales

#### 1. **Contrôle d'accès par rôle**

```typescript
const checkUserRole = useCallback(async () => {
  const { data: userData, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id_profile", session.user.id)
    .single();

  const isManager = userData?.role === "Gestionnaire";
  setIsAuthorized(isManager);
});
```

#### 2. **Affichage des demandes récentes**

```typescript
const afficherDonnees = useCallback(async () => {
  const { data, error } = await supabase
    .from("absence_requests")
    .select(
      `
      id_absence_request,
      date_debut,
      date_fin,
      statut,
      motif,
      absence_types ( nom )
    `
    )
    .order("date_creation", { ascending: false })
    .limit(5);
});
```

#### 3. **Actions de validation/refus**

```typescript
const updateRequestStatus = useCallback(
  async (id: number, status: "approuve" | "rejete") => {
    const payload = {
      statut: status,
      approuve_par: managerId,
      date_modification: new Date().toISOString(),
      date_approbation: status === "approuve" ? new Date().toISOString() : null,
    };

    await supabase
      .from("absence_requests")
      .update(payload)
      .eq("id_absence_request", id);
  }
);
```

### 🔐 Distinction des rôles utilisateurs

Le système implémente un contrôle d'accès granulaire :

**Rôles définis :**

- `Professeur` : Peut uniquement créer des demandes
- `Personnel administratif` : Peut créer des demandes
- `Gestionnaire` : Peut voir et valider toutes les demandes

**Vérification en temps réel :**

```typescript
// Vérification côté client
const isManager = userProfile?.role === 'Gestionnaire';

// Sécurisation côté base (RLS Policies)
CREATE POLICY "Managers can view all requests" ON absence_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id_profile = auth.uid() AND fonction = 'Gestionnaire'
    )
  );
```

### 📊 Interface de gestion

**Affichage par demande :**

- **En-tête** : Numéro demande + badge statut coloré
- **Détails** : Type, période, motif, date de création
- **Actions** : Boutons Approuver/Refuser (si en attente)

**États visuels :**

```typescript
const STATUS_COLORS: Record<AbsenceStatus, string> = {
  en_attente: "#f1c40f", // Jaune
  approuve: "#2ecc71", // Vert
  rejete: "#e74c3c", // Rouge
  annule: "#95a5a6", // Gris
};
```

### 🔄 Hooks et composants personnalisés

```typescript
// Hook d'authentification
const { isAuthenticated, isLoading } = useAuth();

// États locaux de gestion
const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
const [updatingId, setUpdatingId] = useState<number | null>(null);
const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
```

### 👥 Répartition des tâches

| Développeur | Responsabilité                    | Justification                              |
| ----------- | --------------------------------- | ------------------------------------------ |
| **Dev 1**   | Interface + composants visuels    | UI/UX, design responsive, animations       |
| **Dev 2**   | Logique métier + rôles            | Sécurité, contrôle d'accès, business logic |
| **Dev 3**   | Intégration Supabase + temps réel | Backend, API, synchronisation données      |

---

## ⚙️ Architecture Supabase (Backend)

### 🗄️ Tables principales

#### 1. **profiles** - Profils utilisateurs étendus

```sql
CREATE TABLE profiles (
  id_profile UUID PRIMARY KEY,           -- Lié à auth.users(id)
  nom_complet TEXT NOT NULL,
  fonction TEXT CHECK (fonction IN ('Professeur', 'Personnel Administratif', 'Gestionnaire')),
  departement TEXT,
  telephone NUMERIC(15,0),
  date_creation TIMESTAMP DEFAULT now()
);
```

#### 2. **absence_types** - Types d'absence configurables

```sql
CREATE TABLE absence_types (
  id_absence_type SERIAL PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,             -- "Congés payés", "RTT", etc.
  description TEXT,
  jours_max_par_an INTEGER,             -- Limite annuelle
  necessite_certificat_medical BOOLEAN,
  est_actif BOOLEAN DEFAULT TRUE
);
```

#### 3. **absence_requests** - Demandes d'absence

```sql
CREATE TABLE absence_requests (
  id_absence_request SERIAL PRIMARY KEY,
  id_utilisateur UUID REFERENCES auth.users(id),
  id_type_absence INTEGER REFERENCES absence_types(id_absence_type),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  statut TEXT DEFAULT 'en_attente',
  approuve_par UUID REFERENCES auth.users(id),
  date_approbation TIMESTAMP
);
```

### 🔒 Sécurité RLS (Row Level Security)

#### Policies principales :

**Pour les profils :**

```sql
-- Utilisateurs voient leur propre profil
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id_profile);
```

**Pour les demandes :**

```sql
-- Utilisateurs voient leurs propres demandes
CREATE POLICY "Users can view own requests" ON absence_requests
  FOR SELECT USING (auth.uid() = id_utilisateur);

-- Managers voient toutes les demandes
CREATE POLICY "Managers can view all requests" ON absence_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id_profile = auth.uid() AND fonction = 'Gestionnaire'
    )
  );
```

### 🔗 Relations entre tables

```
auth.users (Supabase Auth)
    ↓ (id_profile)
profiles (Données utilisateur étendues)
    ↓ (id_utilisateur)
absence_requests (Demandes)
    ↓ (id_type_absence)
absence_types (Configuration types)
```

### 📊 Tables additionnelles

#### 4. **absence_balances** - Soldes de congés

```sql
CREATE TABLE absence_balances (
  id_utilisateur UUID,
  id_type_absence INTEGER,
  annee INTEGER,
  jours_total DECIMAL(4,1),
  jours_utilises DECIMAL(4,1),
  jours_restants DECIMAL(4,1) GENERATED ALWAYS AS (jours_total - jours_utilises) STORED
);
```

#### 5. **notifications** - Système de notifications

```sql
CREATE TABLE notifications (
  id_notification SERIAL PRIMARY KEY,
  id_utilisateur UUID,
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  type_notification TEXT CHECK (type_notification IN ('demande_approuvee', 'demande_rejetee')),
  est_lu BOOLEAN DEFAULT FALSE
);
```

---

## 🧩 Présentation synthétique

### 📋 Résumé du fonctionnement global

**ProfAbsent** suit une architecture moderne et sécurisée :

1. **Authentification robuste** : Supabase Auth + profils utilisateurs
2. **Interface intuitive** : React Native + calendrier interactif
3. **Gestion des rôles** : Contrôle d'accès granulaire
4. **Backend scalable** : PostgreSQL + RLS policies
5. **Expérience utilisateur** : Validation temps réel + feedback visuel

### 🗺️ Flux utilisateur simplifié

```
📱 Connexion/Inscription
    ↓
🏠 Accueil (selon rôle)
    ↓
📅 Demande d'absence (Professeur/Personnel)
    ↓
⏳ Statut "En attente"
    ↓
👔 Validation Manager
    ↓
✅ Notification résultat
```

### 👥 Contribution par membre d'équipe

#### **Architecture Backend & Sécurité**

- Configuration Supabase et policies RLS
- Design base de données et relations
- Hooks d'authentification et gestion d'état

#### **Interface Utilisateur & UX**

- Composants React Native et navigation
- Calendrier interactif et formulaires
- Design system et responsive design

#### **Logique Métier & Intégrations**

- Validation données et règles business
- Intégration API Supabase
- Gestion erreurs et cas limites

### 🚀 Améliorations possibles

#### **Fonctionnalités avancées**

- **Notifications push** : Alertes temps réel via Expo Notifications
- **Export calendrier** : Intégration Google Calendar/Outlook
- **Historique complet** : Consultation demandes passées avec filtres
- **Workflow avancé** : Validation en cascade (N+1, RH, etc.)

#### **Optimisations techniques**

- **Cache intelligent** : React Query pour optimiser les appels API
- **Synchronisation offline** : Persistance locale et sync différée
- **Analytics** : Suivi utilisation avec Mixpanel/Analytics
- **Tests automatisés** : Jest + React Native Testing Library

#### **Améliorations UX/UI**

- **Mode sombre** : Thème adaptatif selon préférences système
- **Accessibilité** : Support lecteurs d'écran et navigation clavier
- **Personnalisation** : Thèmes métier et widgets configurables
- **Tutorial interactif** : Onboarding guidé pour nouveaux utilisateurs

---

## 📈 Conclusion

**ProfAbsent** représente une solution complète et moderne pour la gestion des absences en établissement scolaire. L'architecture choisie garantit **sécurité**, **scalabilité** et **maintenabilité**, tandis que l'interface utilisateur privilégie **simplicité** et **efficacité**.

Le choix de **React Native + Supabase** permet un développement rapide tout en conservant une base technique solide pour les évolutions futures. Le système de rôles et les policies RLS assurent une sécurité de niveau entreprise.

Cette documentation constitue une base solide pour la présentation du projet et peut être adaptée selon le contexte (soutenance, documentation client, guide développeur).
