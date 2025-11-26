-- Migration : Remplacer heure_remplacement par heure_debut_remplacement et heure_fin_remplacement
-- Date de création : 25 novembre 2025
-- Description : Transforme la colonne unique d'heure en deux colonnes distinctes pour début et fin

-- Ajouter les nouvelles colonnes si elles n'existent pas
ALTER TABLE absence_requests
ADD COLUMN IF NOT EXISTS heure_debut_remplacement TIME,
ADD COLUMN IF NOT EXISTS heure_fin_remplacement TIME;

-- Migrer les données existantes (copier heure_remplacement vers heure_debut_remplacement)
-- Note: heure_fin_remplacement restera NULL pour les anciennes demandes
UPDATE absence_requests
SET heure_debut_remplacement = heure_remplacement
WHERE heure_remplacement IS NOT NULL AND heure_debut_remplacement IS NULL;

-- Supprimer l'ancienne colonne si elle existe
ALTER TABLE absence_requests
DROP COLUMN IF EXISTS heure_remplacement;

-- Commentaires pour documenter les nouvelles colonnes
COMMENT ON COLUMN absence_requests.heure_debut_remplacement IS 'Heure de début du cours de remplacement';
COMMENT ON COLUMN absence_requests.heure_fin_remplacement IS 'Heure de fin du cours de remplacement';
