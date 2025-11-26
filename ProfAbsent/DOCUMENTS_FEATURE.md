# 📎 Fonctionnalité Documents Justificatifs

## Vue d'ensemble

Cette fonctionnalité permet aux utilisateurs de joindre des documents justificatifs (certificats médicaux, etc.) à leurs demandes d'absence lorsque cela est requis par le type d'absence.

## Fonctionnalités ajoutées

### 🔧 Base de données

- **Nouvelle table** : `absence_documents` pour stocker les métadonnées des fichiers
- **Bucket Supabase Storage** : `absence-documents` pour le stockage sécurisé des fichiers
- **Politiques RLS** : Accès contrôlé - utilisateurs voient leurs documents, gestionnaires voient tous

### 👤 Interface Utilisateur (Demande)

- **Détection automatique** : Affichage conditionnel du champ document selon le type d'absence
- **Sélection de fichiers** : Intégration avec `expo-document-picker`
- **Types supportés** : Images (JPEG, PNG) et PDF (max 10MB)
- **Validation** : Document obligatoire pour les types nécessitant un certificat
- **Prévisualisation** : Affichage du nom et taille du fichier sélectionné
- **Suppression** : Possibilité de retirer le document sélectionné

### 👨‍💼 Interface Gestionnaire

- **Affichage des documents** : Liste des documents joints à chaque demande
- **Consultation** : Génération d'URL signées temporaires pour l'accès sécurisé
- **Icônes différenciées** : PDF vs Images

## Types d'absence nécessitant un certificat

- **Congé maladie** : Certificat médical obligatoire
- **Congé maternité/paternité** : Certificat médical obligatoire

## Sécurité

- **Stockage chiffré** : Supabase Storage avec politiques RLS
- **URLs temporaires** : Accès limité dans le temps (1h)
- **Validation côté serveur** : Types MIME et taille des fichiers contrôlés
- **Isolation des données** : Chaque utilisateur n'accède qu'à ses propres documents

## Installation requise

```bash
npm install expo-document-picker
```

## Prochaines améliorations possibles

- [ ] Ouverture native des documents (PDF viewer intégré)
- [ ] Compression automatique des images
- [ ] Support de formats supplémentaires
- [ ] Notifications email avec pièces jointes
- [ ] Historique des téléchargements par les gestionnaires
