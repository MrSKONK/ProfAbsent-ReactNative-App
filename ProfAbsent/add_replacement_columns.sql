-- Migration : Ajout des colonnes de remplacement pour la table absence_requests
-- Date de création : 23 novembre 2025
-- Description : Ajoute les champs nécessaires pour gérer les propositions de remplacement

-- Ajouter les colonnes de remplacement
ALTER TABLE absence_requests
ADD COLUMN IF NOT EXISTS proposition_remplacement BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS date_remplacement DATE,
ADD COLUMN IF NOT EXISTS heure_debut_remplacement TIME,
ADD COLUMN IF NOT EXISTS heure_fin_remplacement TIME,
ADD COLUMN IF NOT EXISTS salle_remplacement TEXT,
ADD COLUMN IF NOT EXISTS classe_remplacement TEXT;

-- Commentaires pour documenter les colonnes
COMMENT ON COLUMN absence_requests.proposition_remplacement IS 'Indique si un remplacement est proposé pour cette absence';
COMMENT ON COLUMN absence_requests.date_remplacement IS 'Date du cours de remplacement proposé';
COMMENT ON COLUMN absence_requests.heure_debut_remplacement IS 'Heure de début du cours de remplacement';
COMMENT ON COLUMN absence_requests.heure_fin_remplacement IS 'Heure de fin du cours de remplacement';
COMMENT ON COLUMN absence_requests.salle_remplacement IS 'Salle où se tiendra le cours de remplacement';
COMMENT ON COLUMN absence_requests.classe_remplacement IS 'Classe concernée par le cours de remplacement';
