import { supabase } from './supabase';
import { DEV_MODE, DEV_USERS } from './devAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
  departement?: string;
}

export const getCurrentUserProfile = async (): Promise<UserProfile | null> => {
  try {
    if (DEV_MODE) {
      // Mode développement
      const devSession = await AsyncStorage.getItem('devSession');
      if (devSession === 'true') {
        // En mode dev, on pourrait récupérer l'utilisateur depuis le localStorage
        // ou utiliser un utilisateur par défaut pour les tests
        const devUserEmail = await AsyncStorage.getItem('devUserEmail');
        const devUser = DEV_USERS.find(u => u.email === devUserEmail) || DEV_USERS[0];
        
        return {
          id: `dev-user-${devUser.email}`,
          email: devUser.email,
          fullName: devUser.fullName,
          role: devUser.role,
          departement: devUser.departement
        };
      }
      return null;
    } else {
      // Mode production avec Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return null;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id_profile, nom_complet, role, departement')
        .eq('id_profile', session.user.id)
        .single();

      if (error || !profile) {
        console.warn('Erreur lors de la récupération du profil:', error?.message);
        return null;
      }

      return {
        id: profile.id_profile,
        email: session.user.email || '',
        fullName: profile.nom_complet,
        role: profile.role,
        departement: profile.departement
      };
    }
  } catch (error) {
    console.error('Erreur dans getCurrentUserProfile:', error);
    return null;
  }
};

export const getUserRole = async (): Promise<string | null> => {
  const profile = await getCurrentUserProfile();
  return profile?.role || null;
};

export const isManager = async (): Promise<boolean> => {
  const role = await getUserRole();
  return role === 'Gestionnaire';
};