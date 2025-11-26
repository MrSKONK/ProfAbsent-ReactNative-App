import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://ilmjvlbbvrysatjxbvae.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsbWp2bGJidnJ5c2F0anhidmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNTI5OTYsImV4cCI6MjA3MzcyODk5Nn0.ig0zm2fIS-DSrgspwWeHPudhGcBdG2k-TsBIlVGM7VM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: AsyncStorage,
  },
});

// Fonction utilitaire pour tester la connexion
export const testSupabaseConnection = async () => {
  try {
    console.log('Test de connexion Supabase...');
    const { data, error } = await supabase.auth.getSession();
    console.log('Test connexion Supabase:', { data, error });
    return { success: !error, data, error };
  } catch (err) {
    console.error('Erreur test connexion:', err);
    return { success: false, error: err };
  }
};

// Fonction pour créer un utilisateur de test
export const createTestUser = async () => {
  try {
    console.log('Création utilisateur de test...');
    const testEmail = 'test@profabsent.com';
    const testPassword = 'TestPassword123!';
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: 'Utilisateur Test',
          role: 'Professeur',
          departement: 'Test',
        },
      },
    });
    
    console.log('Résultat création utilisateur test:', { data, error });
    return { success: !error, data, error, credentials: { email: testEmail, password: testPassword } };
  } catch (err) {
    console.error('Erreur création utilisateur test:', err);
    return { success: false, error: err };
  }
};

// Fonction pour tester la connexion avec l'utilisateur de test
export const testLogin = async () => {
  try {
    console.log('Test de connexion utilisateur...');
    const testEmail = 'test@profabsent.com';
    const testPassword = 'TestPassword123!';
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    
    console.log('Résultat test connexion:', { data, error });
    return { success: !error, data, error };
  } catch (err) {
    console.error('Erreur test connexion:', err);
    return { success: false, error: err };
  }
};