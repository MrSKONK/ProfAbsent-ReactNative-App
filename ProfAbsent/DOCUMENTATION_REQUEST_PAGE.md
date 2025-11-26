# Documentation - Page de demande d'absence (`request.tsx`)

## Vue d'ensemble

Cette page permet aux utilisateurs de soumettre des demandes d'absence via un formulaire React Native avec calendrier personnalisé. Elle utilise Supabase pour la gestion des données et propose une interface utilisateur moderne avec validation en temps réel.

## Architecture générale

### États principaux

- `formData`: Données du formulaire (dates, type, motif)
- `errors`: Erreurs de validation pour chaque champ
- `loading`: État de chargement lors de la soumission
- `showTypeModal`: Contrôle l'affichage du modal de sélection de type
- `showCalendarModal`: Contrôle l'affichage du calendrier personnalisé
- `types`: Liste des types d'absence disponibles
- `selectedTypeId`: ID du type d'absence sélectionné
- `currentMonth`: Mois actuellement affiché dans le calendrier

## Système de gestion des dates - Analyse détaillée

### 1. Format et stockage des dates

```typescript
interface FormData {
  startDate: string; // Format ISO YYYY-MM-DD
  endDate: string; // Format ISO YYYY-MM-DD
  type: string;
  reason: string;
}
```

**Principe** : Les dates sont stockées au format ISO (YYYY-MM-DD) pour assurer la cohérence avec la base de données et éviter les problèmes de timezone.

### 2. Fonctions utilitaires de dates

#### `toISO(d: Date) => string`

- **Rôle** : Convertit un objet Date JavaScript en chaîne ISO (YYYY-MM-DD)
- **Implementation** : `d.toISOString().slice(0, 10)`
- **Usage** : Standardiser le format de stockage des dates

#### `formatDisplay(iso?: string) => string`

- **Rôle** : Convertit une date ISO en format d'affichage français (DD/MM/YYYY)
- **Implementation** :
  ```typescript
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00"); // Ajoute l'heure pour éviter les décalages timezone
  return d.toLocaleDateString("fr-FR");
  ```
- **Particularité** : Ajoute 'T00:00:00' pour forcer l'heure à minuit et éviter les décalages de timezone

#### `addMonths(date: Date, months: number) => Date`

- **Rôle** : Ajouter/soustraire des mois pour la navigation du calendrier
- **Implementation** : Calcul sécurisé pour éviter les erreurs de débordement de mois

#### `startOfWeekMonday(date: Date) => Date`

- **Rôle** : Trouve le lundi de la semaine contenant une date donnée
- **Logique** :
  ```typescript
  const day = d.getDay(); // 0=Dimanche, 1=Lundi, ..., 6=Samedi
  const diff = day === 0 ? -6 : 1 - day; // Calcul du décalage vers le lundi
  d.setDate(d.getDate() + diff);
  ```
- **Particularité** : Traite le dimanche (0) comme un cas spécial (-6 jours)

### 3. Génération du calendrier (jours ouvrés uniquement)

#### Principe de construction

Le calendrier ne montre que les jours de semaine (lundi à vendredi) organisés en semaines :

```typescript
const monthWeeks: WeekRow[] = useMemo(() => {
  const first = firstDayOfMonth(currentMonth); // Premier jour du mois
  const last = lastDayOfMonth(currentMonth); // Dernier jour du mois
  let cursor = startOfWeekMonday(first); // Commence au lundi de la première semaine
  const end = (() => {
    const monday = startOfWeekMonday(last);
    const friday = new Date(monday);
    friday.setDate(friday.getDate() + 4);
    return friday;
  })(); // Termine au vendredi de la dernière semaine

  const weeks: WeekRow[] = [];
  let row: WeekRow = [];

  while (cursor <= end) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) {
      // Lundi(1) à Vendredi(5) seulement
      row.push(new Date(cursor));
      if (row.length === 5) {
        // Une semaine complète (5 jours ouvrés)
        weeks.push(row);
        row = [];
      }
    }
    cursor.setDate(cursor.getDate() + 1); // Jour suivant
  }

  // Compléter la dernière semaine si nécessaire
  if (row.length > 0) {
    while (row.length < 5) {
      const lastCell = row[row.length - 1];
      const next = new Date(lastCell);
      next.setDate(lastCell.getDate() + 1);
      if (next.getDay() >= 1 && next.getDay() <= 5) {
        row.push(next);
      }
    }
    weeks.push(row);
  }

  return weeks;
}, [currentMonth]);
```

#### Caractéristiques du calendrier :

1. **Jours ouvrés uniquement** : Seuls lundi-vendredi sont affichés
2. **Structure en grille** : 5 colonnes (Lun-Ven) × N lignes (semaines)
3. **Débordement de mois** : Peut montrer des jours du mois suivant pour compléter les semaines
4. **Optimisation** : Utilise `useMemo` pour éviter les recalculs inutiles

### 4. Logique de sélection des dates

#### Fonction `onSelectDate(date: Date)`

Gère la sélection des dates avec une logique de plage :

```typescript
const onSelectDate = (date: Date) => {
  const iso = toISO(date);
  const { startDate, endDate } = formData;

  // Cas 1 : Aucune date sélectionnée
  if (!startDate) {
    setFormData((prev) => ({ ...prev, startDate: iso }));
    return;
  }

  // Cas 2 : Date de début sélectionnée, pas de fin
  if (startDate && !endDate) {
    if (iso < startDate) {
      // Nouvelle date antérieure : redémarre la sélection
      setFormData((prev) => ({ ...prev, startDate: iso, endDate: "" }));
    } else if (iso === startDate) {
      // Même jour : sélection d'une journée unique
      setFormData((prev) => ({ ...prev, startDate: iso, endDate: iso }));
      setShowCalendarModal(false);
    } else {
      // Date postérieure : complète la plage
      setFormData((prev) => ({ ...prev, endDate: iso }));
      setShowCalendarModal(false);
    }
    return;
  }

  // Cas 3 : Plage complète existante : redémarre
  setFormData((prev) => ({ ...prev, startDate: iso, endDate: "" }));
};
```

#### États visuels des dates :

- **`isStart`** : Date de début (fond bleu)
- **`isEnd`** : Date de fin (fond bleu)
- **`inRange`** : Date dans la plage (fond bleu clair)
- **`inMonth`** : Date du mois courant (fond blanc)
- **Hors mois** : Dates d'autres mois (fond gris clair)

### 5. Fonctions de comparaison de dates

#### `isSameDay(a?: string, b?: string) => boolean`

- Vérifie si deux dates ISO sont identiques
- Gère les valeurs undefined/null de façon sécurisée

#### `isBetween(iso: string, start?: string, end?: string) => boolean`

- Vérifie si une date est dans une plage (exclusif des bornes)
- Utilise la comparaison de chaînes (les dates ISO se comparent lexicographiquement)

## Formulaire et validation

### Champs du formulaire

1. **Dates de début/fin** : Sélection via calendrier personnalisé
2. **Type d'absence** : Dropdown avec données Supabase
3. **Motif** : Zone de texte libre

### Validation

- Tous les champs sont obligatoires
- Les dates doivent être sélectionnées via le calendrier
- Validation en temps réel (les erreurs disparaissent lors de la correction)

### Soumission

```typescript
const submitRequestTreatment = async () => {
  // 1. Validation du formulaire
  if (!validateForm()) return;

  // 2. Récupération de l'utilisateur courant (Supabase Auth)
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  // 3. Insertion en base de données
  const { error } = await supabase.from("absence_requests").insert({
    id_utilisateur: user.id,
    id_type_absence: selectedTypeId,
    date_debut: formData.startDate, // Format ISO
    date_fin: formData.endDate, // Format ISO
    motif: formData.reason,
    statut: "en_attente",
  });

  // 4. Retour utilisateur et nettoyage
};
```

## Points techniques remarquables

### 1. Gestion des timezones

- Utilisation systématique du format ISO YYYY-MM-DD
- Ajout de 'T00:00:00' lors de la conversion pour l'affichage
- Évite les décalages horaires automatiques du navigateur

### 2. Performance

- `useMemo` pour le calcul du calendrier
- États séparés pour éviter les re-renders inutiles
- Chargement asynchrone des types d'absence

### 3. UX/UI

- Calendrier modal responsive
- Navigation mensuelle fluide
- Sélection intuitive de plages de dates
- Feedback visuel immédiat
- Validation en temps réel

### 4. Sécurité

- Validation côté client ET serveur (via Supabase)
- Authentification utilisateur requise
- Nettoyage des données après soumission

## Structure de la base de données (inférée)

### Table `absence_requests`

- `id_utilisateur`: UUID (référence utilisateur)
- `id_type_absence`: INTEGER (référence type d'absence)
- `date_debut`: DATE (format YYYY-MM-DD)
- `date_fin`: DATE (format YYYY-MM-DD)
- `motif`: TEXT
- `statut`: ENUM ('en_attente', ...)

### Table `absence_types`

- `id_absence_type`: INTEGER (clé primaire)
- `nom`: VARCHAR (nom du type)
- `est_actif`: BOOLEAN (type disponible ou non)

Cette architecture assure une gestion robuste et user-friendly des demandes d'absence avec un focus particulier sur l'ergonomie de sélection des dates en contexte professionnel (jours ouvrés uniquement).
