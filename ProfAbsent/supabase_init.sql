-- ==========================================
-- SCRIPT SUPABASE POUR PROFABSENT
-- À exécuter dans Supabase SQL Editor
-- ==========================================

-- 1. 👤 Table profiles - Profils utilisateurs étendus
CREATE TABLE IF NOT EXISTS profiles (
  id_profile UUID PRIMARY KEY,
  nom_complet TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Professeur', 'Personnel Administratif', 'Gestionnaire')),
  departement TEXT,
  telephone numeric(15,0),
  email TEXT,
  date_embauche DATE,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS pour profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Créer une fonction pour vérifier le rôle sans récursion
CREATE OR REPLACE FUNCTION is_manager(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id_profile = user_id AND role = 'Gestionnaire'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id_profile);

CREATE POLICY "Managers can view all profiles" ON profiles
  FOR SELECT USING (is_manager(auth.uid()));

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id_profile);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id_profile);

-- 2. 📝 Table absence_types - Types d'absence
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

CREATE POLICY "Everyone can view absence types" ON absence_types
  FOR SELECT USING (est_actif = TRUE);

-- 3. 📋 Table absence_requests - Demandes d'absence
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
  proposition_remplacement BOOLEAN DEFAULT FALSE,
  date_remplacement DATE,
  heure_debut_remplacement TIME,
  heure_fin_remplacement TIME,
  salle_remplacement TEXT,
  classe_remplacement TEXT,
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  date_modification TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS pour absence_requests
ALTER TABLE absence_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests" ON absence_requests
  FOR SELECT USING (auth.uid() = id_utilisateur);

CREATE POLICY "Users can create own requests" ON absence_requests
  FOR INSERT WITH CHECK (auth.uid() = id_utilisateur);

CREATE POLICY "Users can update own pending requests" ON absence_requests
  FOR UPDATE USING (auth.uid() = id_utilisateur AND statut = 'en_attente');

CREATE POLICY "Managers can view all requests" ON absence_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id_profile = auth.uid() AND role = 'Gestionnaire'
    )
  );

CREATE POLICY "Managers can approve requests" ON absence_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id_profile = auth.uid() AND role = 'Gestionnaire'
    )
  );

-- 4. 📊 Table absence_balances - Soldes de congés
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

CREATE POLICY "Users can view own balances" ON absence_balances
  FOR SELECT USING (auth.uid() = id_utilisateur);

CREATE POLICY "Managers can view all balances" ON absence_balances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id_profile = auth.uid() AND role = 'Gestionnaire'
    )
  );

-- 5. 🔔 Table notifications - Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id_notification SERIAL PRIMARY KEY,
  id_utilisateur UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  titre TEXT NOT NULL,
  message TEXT NOT NULL,
  type_notification TEXT NOT NULL CHECK (type_notification IN ('demande_approuvee', 'demande_rejetee', 'demande_soumise', 'rappel', 'info')),
  est_lu BOOLEAN DEFAULT FALSE,
  id_demande_associee INTEGER REFERENCES absence_requests(id_absence_request),
  date_creation TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS pour notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = id_utilisateur);

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = id_utilisateur);

-- 6. 📎 Table absence_documents - Documents joints aux demandes d'absence
CREATE TABLE IF NOT EXISTS absence_documents (
  id_document SERIAL PRIMARY KEY,
  id_absence_request INTEGER REFERENCES absence_requests(id_absence_request) ON DELETE CASCADE NOT NULL,
  nom_fichier TEXT NOT NULL,
  type_mime TEXT NOT NULL,
  taille_octets INTEGER NOT NULL,
  url_fichier TEXT NOT NULL, -- URL Supabase Storage
  date_upload TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS pour absence_documents
ALTER TABLE absence_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents of own requests" ON absence_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM absence_requests ar 
      WHERE ar.id_absence_request = absence_documents.id_absence_request 
      AND ar.id_utilisateur = auth.uid()
    )
  );

CREATE POLICY "Users can insert documents to own requests" ON absence_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM absence_requests ar 
      WHERE ar.id_absence_request = absence_documents.id_absence_request 
      AND ar.id_utilisateur = auth.uid()
    )
  );

CREATE POLICY "Managers can view all documents" ON absence_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id_profile = auth.uid() AND role = 'Gestionnaire'
    )
  );

-- ==========================================
-- CONFIGURATION SUPABASE STORAGE
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
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id_profile = auth.uid() AND role = 'Gestionnaire'
    )
  );

-- ==========================================
-- FIX: Permettre aux gestionnaires de voir tous les profils
-- À exécuter dans Supabase SQL Editor
-- ==========================================

-- D'abord, supprimer la politique problématique si elle existe
DROP POLICY IF EXISTS "Managers can view all profiles" ON profiles;

-- Créer une fonction pour vérifier le rôle sans récursion
CREATE OR REPLACE FUNCTION is_manager(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id_profile = user_id AND role = 'Gestionnaire'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajouter une politique permettant aux gestionnaires de voir tous les profils
-- En utilisant SECURITY DEFINER, la fonction contourne le RLS
CREATE POLICY "Managers can view all profiles" ON profiles
  FOR SELECT USING (is_manager(auth.uid()));

-- Vérifier les politiques existantes
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';
