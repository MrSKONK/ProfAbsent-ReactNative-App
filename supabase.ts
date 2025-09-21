import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ilmjvlbbvrysatjxbvae.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsbWp2bGJidnJ5c2F0anhidmFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxNTI5OTYsImV4cCI6MjA3MzcyODk5Nn0.ig0zm2fIS-DSrgspwWeHPudhGcBdG2k-TsBIlVGM7VM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Fonction utilitaire pour tester la connexion
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    console.log('Test connexion Supabase:', { data, error });
    return { success: !error, data, error };
  } catch (err) {
    console.error('Erreur test connexion:', err);
    return { success: false, error: err };
  }
};