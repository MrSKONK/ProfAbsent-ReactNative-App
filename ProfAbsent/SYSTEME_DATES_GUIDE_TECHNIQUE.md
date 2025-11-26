# Système de gestion des dates - Guide technique détaillé

## Architecture du système de dates

### 1. Philosophie générale

Le système de dates de cette application suit plusieurs principes clés :

- **Cohérence** : Toutes les dates sont stockées au format ISO (YYYY-MM-DD)
- **Robustesse** : Gestion des timezones et des cas limites
- **UX optimisée** : Calendrier visuel intuitif avec sélection de plages
- **Contexte métier** : Focus sur les jours ouvrés (Lundi-Vendredi)

### 2. Format de stockage : ISO 8601

```typescript
// ✅ Correct - Format de stockage
const dateISO = "2025-09-25"; // YYYY-MM-DD

// ❌ Évité - Formats variables
const dateFR = "25/09/2025"; // DD/MM/YYYY
const dateUS = "09/25/2025"; // MM/DD/YYYY
```

**Avantages du format ISO :**

- Comparaison lexicographique directe : `"2025-09-25" > "2025-09-20"` ✅
- Compatibilité base de données universelle
- Pas d'ambiguïté jour/mois
- Tri naturel

### 3. Conversion et affichage

#### Fonction `toISO(date: Date): string`

```typescript
const toISO = (d: Date) => d.toISOString().slice(0, 10);
```

- Extrait la partie date de l'ISO complet (`2025-09-25T10:30:00.000Z` → `2025-09-25`)
- Évite les problèmes de timezone en ne gardant que la date

#### Fonction `formatDisplay(iso: string): string`

```typescript
const formatDisplay = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00"); // ⚠️ Point crucial
  return d.toLocaleDateString("fr-FR");
};
```

**Point crucial** : L'ajout de `'T00:00:00'` force l'heure à minuit. Sans cela :

```typescript
// ❌ Problème potentiel
new Date("2025-09-25"); // Peut créer 2025-09-24T22:00:00 selon le timezone

// ✅ Solution
new Date("2025-09-25T00:00:00"); // Force 2025-09-25T00:00:00
```

### 4. Calendrier personnalisé - Jours ouvrés uniquement

#### Structure du calendrier

Le calendrier affiche uniquement les jours de semaine (Lundi à Vendredi) pour correspondre au contexte professionnel :

```
┌─────┬─────┬─────┬─────┬─────┐
│ LUN │ MAR │ MER │ JEU │ VEN │
├─────┼─────┼─────┼─────┼─────┤
│  2  │  3  │  4  │  5  │  6  │
│  9  │ 10  │ 11  │ 12  │ 13  │
│ 16  │ 17  │ 18  │ 19  │ 20  │
│ 23  │ 24  │ 25  │ 26  │ 27  │
│ 30  │  1  │  2  │  3  │  4  │ ← Déborde sur le mois suivant
└─────┴─────┴─────┴─────┴─────┘
```

#### Algorithme de génération

1. **Délimitation du mois** :

   ```typescript
   const first = firstDayOfMonth(currentMonth); // 1er septembre 2025
   const last = lastDayOfMonth(currentMonth); // 30 septembre 2025
   ```

2. **Extension aux semaines complètes** :

   ```typescript
   let cursor = startOfWeekMonday(first); // Lundi de la 1ère semaine
   const end = startOfWeekMonday(last) + 4; // Vendredi de la dernière semaine
   ```

3. **Filtrage des jours ouvrés** :
   ```typescript
   while (cursor <= end) {
     const dow = cursor.getDay();
     if (dow >= 1 && dow <= 5) {
       // Lundi(1) à Vendredi(5) seulement
       row.push(new Date(cursor));
     }
     cursor = nextDay(cursor);
   }
   ```

#### Fonction `startOfWeekMonday(date: Date)`

Cette fonction est cruciale pour aligner le calendrier :

```typescript
const startOfWeekMonday = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Dimanche, 1=Lundi, ..., 6=Samedi
  const diff = day === 0 ? -6 : 1 - day; // Calcul du décalage
  d.setDate(d.getDate() + diff);
  return d;
};
```

**Table de conversion** :
| Jour actuel | day | Calcul | Décalage | Résultat |
|-------------|-----|---------|----------|-----------|
| Dimanche | 0 | -6 | -6 jours | Lundi précédent |
| Lundi | 1 | 0 | 0 jour | Même jour |
| Mardi | 2 | -1 | -1 jour | Lundi |
| Mercredi | 3 | -2 | -2 jours | Lundi |
| Jeudi | 4 | -3 | -3 jours | Lundi |
| Vendredi | 5 | -4 | -4 jours | Lundi |
| Samedi | 6 | -5 | -5 jours | Lundi |

### 5. Sélection de plages de dates

#### États de sélection

La sélection suit un automate à 3 états :

```
État 1: Vide
   │
   │ clic sur date
   ▼
État 2: Début seulement
   │
   ├─ clic antérieur → retour État 1 (nouveau début)
   ├─ clic identique → État 3 (journée unique)
   └─ clic postérieur → État 3 (plage)

État 3: Plage complète
   │
   │ clic quelconque
   ▼
État 1: Nouveau début
```

#### Logique de sélection

```typescript
const onSelectDate = (date: Date) => {
  const iso = toISO(date);
  const { startDate, endDate } = formData;

  if (!startDate) {
    // État 1 → État 2
    setFormData({ ...formData, startDate: iso });
  } else if (startDate && !endDate) {
    if (iso < startDate) {
      // Redémarrage avec nouvelle date de début
      setFormData({ ...formData, startDate: iso, endDate: "" });
    } else if (iso === startDate) {
      // Sélection d'une journée unique
      setFormData({ ...formData, endDate: iso });
    } else {
      // Plage normale
      setFormData({ ...formData, endDate: iso });
    }
  } else {
    // État 3 → État 1 (redémarrage)
    setFormData({ ...formData, startDate: iso, endDate: "" });
  }
};
```

### 6. Visualisation des états

#### Classes CSS dynamiques

```typescript
const isStart = isSameDay(iso, formData.startDate);
const isEnd = isSameDay(iso, formData.endDate);
const inRange = isBetween(iso, formData.startDate, formData.endDate);
const inMonth = date.getMonth() === currentMonth.getMonth();
```

#### Styles appliqués

| État      | Couleur de fond      | Couleur du texte | Description           |
| --------- | -------------------- | ---------------- | --------------------- |
| `isStart` | Bleu (#3498db)       | Blanc            | Date de début         |
| `isEnd`   | Bleu (#3498db)       | Blanc            | Date de fin           |
| `inRange` | Bleu clair (#d6eaff) | Noir             | Dates dans la plage   |
| `inMonth` | Blanc                | Noir             | Dates du mois courant |
| Hors mois | Gris clair (#ecf0f1) | Noir             | Dates d'autres mois   |

### 7. Optimisations et bonnes pratiques

#### Performance

- **`useMemo`** pour le calcul du calendrier (coûteux à recalculer)
- **États séparés** pour éviter les re-renders en cascade
- **Comparaisons de chaînes** plus rapides que les comparaisons d'objets Date

#### Robustesse

- **Validation des entrées** : toutes les fonctions gèrent les valeurs undefined/null
- **Immutabilité** : les dates sont copiées avant modification
- **Format unique** : un seul format de stockage (ISO) évite les erreurs de conversion

#### UX

- **Feedback visuel immédiat** lors de la sélection
- **Navigation mensuelle fluide** avec animations
- **Sélection intuitive** : clic pour commencer, clic pour finir
- **Gestion des erreurs** : redémarrage automatique en cas de sélection incohérente

### 8. Cas d'usage et exemples

#### Sélection d'une journée

```
1. Clic sur "25 septembre" → startDate = "2025-09-25", endDate = ""
2. Clic sur "25 septembre" → endDate = "2025-09-25" (journée unique)
```

#### Sélection d'une plage

```
1. Clic sur "23 septembre" → startDate = "2025-09-23", endDate = ""
2. Clic sur "27 septembre" → endDate = "2025-09-27" (plage de 5 jours)
```

#### Correction d'erreur

```
1. Clic sur "25 septembre" → startDate = "2025-09-25", endDate = ""
2. Clic sur "20 septembre" → startDate = "2025-09-20", endDate = "" (redémarrage)
```

### 9. Intégration base de données

#### Structure Supabase

```sql
CREATE TABLE absence_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_utilisateur UUID REFERENCES auth.users(id),
  date_debut DATE NOT NULL,    -- Format YYYY-MM-DD
  date_fin DATE NOT NULL,      -- Format YYYY-MM-DD
  motif TEXT NOT NULL,
  statut TEXT DEFAULT 'en_attente',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Insertion

```typescript
const { error } = await supabase.from("absence_requests").insert({
  id_utilisateur: user.id,
  date_debut: formData.startDate, // "2025-09-25"
  date_fin: formData.endDate, // "2025-09-27"
  motif: formData.reason,
  statut: "en_attente",
});
```

Le format ISO est directement compatible avec les types DATE de PostgreSQL/Supabase.

## Conclusion

Ce système de dates combine robustesse technique et excellence UX :

- **Cohérence** des données avec le format ISO
- **Performance** avec les optimisations React
- **Intuitivité** avec le calendrier visuel
- **Fiabilité** avec la gestion des cas limites
- **Contexte métier** avec les jours ouvrés uniquement

L'architecture modulaire permet des extensions faciles (validation des congés, jours fériés, etc.) tout en maintenant la simplicité d'usage.
