-- ==========================================
-- MIGRATION: Ajouter le support des notifications push
-- À exécuter dans Supabase SQL Editor
-- ==========================================

-- Ajouter la colonne push_token à la table profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Créer un index pour rechercher rapidement par token
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token);

-- Commentaire sur la colonne
COMMENT ON COLUMN profiles.push_token IS 'Token Expo Push Notifications pour envoyer des notifications à l''utilisateur';
