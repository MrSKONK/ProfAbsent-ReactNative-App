-- ==========================================
-- SCRIPT SUPABASE POUR PROFABSENT
-- À exécuter dans Supabase SQL Editor
-- Version nettoyée et consolidée
-- ==========================================

-- ==========================================
-- FONCTIONS UTILITAIRES
-- ==========================================

-- Fonction pour vérifier le rôle sans récursion (SECURITY DEFINER contourne RLS)
CREATE OR REPLACE FUNCTION is_manager(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id_profile = user_id AND role = 'Gestionnaire'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 1. 👤 Table profiles - Profils utilisateurs étendus
-- ==========================================

CREATE TABLE IF NOT EXISTS profiles (
  id_profile UUID PRIMARY KEY,
  nom_complet TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Professeur', 'Personnel Administratif', 'Gestionnaire')),
  departement TEXT,
  telephone numeric(15,0),
  email TEXT,
  date_embauche DATE,
  push_token TEXT, -- Token Expo Push Notifications
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour le token push
CREATE INDEX IF NOT EXISTS idx_profiles_push_token ON profiles(push_token);

-- Commentaires
COMMENT ON COLUMN profiles.push_token IS 'Token Expo Push Notifications pour envoyer des notifications à l''utilisateur';

-- RLS pour profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id_profile);

DROP POLICY IF EXISTS "Managers can view all profiles" ON profiles;
CREATE POLICY "Managers can view all profiles" ON profiles
  FOR SELECT USING (is_manager(auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id_profile);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id_profile);

-- ==========================================
-- 2. 📝 Table absence_types - Types d'absence
-- ==========================================

CREATE TABLE IF NOT EXISTS absence_types (
  id_absence_type SERIAL PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  description TEXT,
  jours_max_par_an INTEGER,
  necessite_certificat_medical BOOLEAN DEFAULT FALSE,
  est_actif BOOLEAN DEFAULT TRUE,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insérer les types d'absence par défaut
INSERT INTO absence_types (nom, description, jours_max_par_an, necessite_certificat_medical) VALUES
('Congés payés', 'Congés payés annuels', 25, FALSE),
('RTT', 'Réduction du temps de travail', 12, FALSE),
('Congé maladie', 'Arrêt maladie', NULL, TRUE),
('Congé maternité/paternité', 'Congé maternité ou paternité', NULL, TRUE),
('Formation', 'Congé de formation', NULL, FALSE),
('Congé sans solde', 'Congé sans rémunération', NULL, FALSE),
('Autre', 'Autre type d''absence', NULL, FALSE)
ON CONFLICT (nom) DO NOTHING;

-- RLS pour absence_types
ALTER TABLE absence_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view absence types" ON absence_types;
CREATE POLICY "Everyone can view absence types" ON absence_types
  FOR SELECT USING (est_actif = TRUE);

-- ==========================================
-- 3. 📋 Table absence_requests - Demandes d'absence
-- ==========================================

CREATE TABLE IF NOT EXISTS absence_requests (
  id_absence_request SERIAL PRIMARY KEY,
  id_utilisateur UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  id_type_absence INTEGER REFERENCES absence_types(id_absence_type) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  motif TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'rejete', 'annule')),
  commentaire_gestionnaire TEXT,
  approuve_par UUID REFERENCES auth.users(id),
  date_approbation TIMESTAMP WITH TIME ZONE,
  -- Colonnes de remplacement
  proposition_remplacement BOOLEAN DEFAULT FALSE,
  date_remplacement DATE,
  heure_debut_remplacement TIME,
  heure_fin_remplacement TIME,
  salle_remplacement TEXT,
  classe_remplacement TEXT,
  -- Timestamps
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Commentaires pour les colonnes de remplacement
COMMENT ON COLUMN absence_requests.proposition_remplacement IS 'Indique si un remplacement est proposé pour cette absence';
COMMENT ON COLUMN absence_requests.date_remplacement IS 'Date du cours de remplacement proposé';
COMMENT ON COLUMN absence_requests.heure_debut_remplacement IS 'Heure de début du cours de remplacement';
COMMENT ON COLUMN absence_requests.heure_fin_remplacement IS 'Heure de fin du cours de remplacement';
COMMENT ON COLUMN absence_requests.salle_remplacement IS 'Salle où se tiendra le cours de remplacement';
COMMENT ON COLUMN absence_requests.classe_remplacement IS 'Classe concernée par le cours de remplacement';

-- RLS pour absence_requests
ALTER TABLE absence_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own requests" ON absence_requests;
CREATE POLICY "Users can view own requests" ON absence_requests
  FOR SELECT USING (auth.uid() = id_utilisateur);

DROP POLICY IF EXISTS "Users can create own requests" ON absence_requests;
CREATE POLICY "Users can create own requests" ON absence_requests
  FOR INSERT WITH CHECK (auth.uid() = id_utilisateur);

DROP POLICY IF EXISTS "Users can update own pending requests" ON absence_requests;
CREATE POLICY "Users can update own pending requests" ON absence_requests
  FOR UPDATE USING (auth.uid() = id_utilisateur AND statut = 'en_attente');

DROP POLICY IF EXISTS "Managers can view all requests" ON absence_requests;
CREATE POLICY "Managers can view all requests" ON absence_requests
  FOR SELECT USING (is_manager(auth.uid()));

DROP POLICY IF EXISTS "Managers can approve requests" ON absence_requests;
CREATE POLICY "Managers can approve requests" ON absence_requests
  FOR UPDATE USING (is_manager(auth.uid()));

-- ==========================================
-- 4. 📊 Table absence_balances - Soldes de congés
-- ==========================================

CREATE TABLE IF NOT EXISTS absence_balances (
  id_absence_balance SERIAL PRIMARY KEY,
  id_utilisateur UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  id_type_absence INTEGER REFERENCES absence_types(id_absence_type) NOT NULL,
  annee INTEGER NOT NULL,
  jours_total DECIMAL(4,1) NOT NULL DEFAULT 0,
  jours_utilises DECIMAL(4,1) NOT NULL DEFAULT 0,
  jours_restants DECIMAL(4,1) GENERATED ALWAYS AS (jours_total - jours_utilises) STORED,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(id_utilisateur, id_type_absence, annee)
);

-- RLS pour absence_balances
ALTER TABLE absence_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own balances" ON absence_balances;
CREATE POLICY "Users can view own balances" ON absence_balances
  FOR SELECT USING (auth.uid() = id_utilisateur);

DROP POLICY IF EXISTS "Managers can view all balances" ON absence_balances;
CREATE POLICY "Managers can view all balances" ON absence_balances
  FOR SELECT USING (is_manager(auth.uid()));

-- ==========================================
-- 5. 🔔 Table notifications - Historique des notifications in-app
-- ==========================================

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  id_utilisateur UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titre VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type_notification VARCHAR(50) NOT NULL CHECK (type_notification IN ('demande_approuvee', 'demande_rejetee', 'demande_soumise', 'rappel', 'info')),
  id_demande_associee INTEGER REFERENCES absence_requests(id_absence_request) ON DELETE SET NULL,
  est_lu BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_notifications_utilisateur ON notifications(id_utilisateur);
CREATE INDEX IF NOT EXISTS idx_notifications_non_lues ON notifications(id_utilisateur, est_lu) WHERE est_lu = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(created_at DESC);

-- Commentaires
COMMENT ON TABLE notifications IS 'Historique des notifications in-app pour les utilisateurs';
COMMENT ON COLUMN notifications.id_utilisateur IS 'Utilisateur destinataire de la notification';
COMMENT ON COLUMN notifications.titre IS 'Titre de la notification';
COMMENT ON COLUMN notifications.message IS 'Contenu détaillé de la notification';
COMMENT ON COLUMN notifications.type_notification IS 'Type: demande_approuvee, demande_rejetee, demande_soumise, rappel, info';
COMMENT ON COLUMN notifications.id_demande_associee IS 'Référence optionnelle à une demande d''absence';
COMMENT ON COLUMN notifications.est_lu IS 'Indique si la notification a été lue';

-- RLS pour notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = id_utilisateur);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = id_utilisateur)
  WITH CHECK (auth.uid() = id_utilisateur);

DROP POLICY IF EXISTS "Allow notification insertion" ON notifications;
CREATE POLICY "Allow notification insertion" ON notifications
  FOR INSERT WITH CHECK (true);

-- Fonction pour marquer toutes les notifications comme lues
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE notifications
  SET est_lu = TRUE
  WHERE id_utilisateur = auth.uid() AND est_lu = FALSE;
END;
$$;

-- ==========================================
-- 6. 📎 Table absence_documents - Documents joints aux demandes d'absence
-- ==========================================

CREATE TABLE IF NOT EXISTS absence_documents (
  id_document SERIAL PRIMARY KEY,
  id_absence_request INTEGER REFERENCES absence_requests(id_absence_request) ON DELETE CASCADE NOT NULL,
  nom_fichier TEXT NOT NULL,
  type_mime TEXT NOT NULL,
  taille_octets INTEGER NOT NULL,
  url_fichier TEXT NOT NULL,
  date_upload TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS pour absence_documents
ALTER TABLE absence_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view documents of own requests" ON absence_documents;
CREATE POLICY "Users can view documents of own requests" ON absence_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM absence_requests ar 
      WHERE ar.id_absence_request = absence_documents.id_absence_request 
      AND ar.id_utilisateur = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert documents to own requests" ON absence_documents;
CREATE POLICY "Users can insert documents to own requests" ON absence_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM absence_requests ar 
      WHERE ar.id_absence_request = absence_documents.id_absence_request 
      AND ar.id_utilisateur = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can view all documents" ON absence_documents;
CREATE POLICY "Managers can view all documents" ON absence_documents
  FOR SELECT USING (is_manager(auth.uid()));

-- ==========================================
-- 7. 📦 CONFIGURATION SUPABASE STORAGE
-- ==========================================

-- Créer le bucket pour les documents d'absence
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'absence-documents',
  'absence-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can upload documents to own requests" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents of own requests" ON storage.objects;
DROP POLICY IF EXISTS "Managers can view all documents" ON storage.objects;

-- Politiques pour le bucket absence-documents
CREATE POLICY "Users can upload documents to own requests" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'absence-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view documents of own requests" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'absence-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Managers can view all documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'absence-documents' AND
    is_manager(auth.uid())
  );
