import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';
import { DEV_MODE } from './devAuth';
import { UserProfile, getCurrentUserProfile } from './userUtils';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    checkAuthAndOnboarding();
    
    // Écouter les changements d'état d'authentification Supabase
    if (!DEV_MODE) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const isAuth = !!session?.user;
        setIsAuthenticated(isAuth);
        
        if (isAuth) {
          // Récupérer le profil utilisateur lors de la connexion
          const profile = await getCurrentUserProfile();
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const checkAuthAndOnboarding = async () => {
    try {
      console.log('Début checkAuthAndOnboarding, DEV_MODE:', DEV_MODE);
      
      // Vérifier l'onboarding
      const onboarding = await AsyncStorage.getItem('onboardingCompleted');
      const isOnboardingDone = onboarding === 'true';
      console.log('Onboarding status:', isOnboardingDone);
      setIsOnboardingCompleted(isOnboardingDone);

      // Vérifier l'authentification
      if (DEV_MODE) {
        console.log('Mode DEV activé');
        // En mode dev, vérifier si une session dev existe
        const devSession = await AsyncStorage.getItem('devSession');
        const isAuth = devSession === 'true';
        console.log('Dev session status:', isAuth);
        setIsAuthenticated(isAuth);
        
        if (isAuth) {
          const profile = await getCurrentUserProfile();
          setUserProfile(profile);
        }
      } else {
        console.log('Mode production, utilisation de Supabase');
        // Mode production, utiliser Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Erreur lors de la récupération de session Supabase:', error);
          setIsAuthenticated(false);
        } else {
          const isAuth = !!session?.user;
          console.log('Supabase session status:', isAuth);
          setIsAuthenticated(isAuth);
          
          if (isAuth) {
            const profile = await getCurrentUserProfile();
            setUserProfile(profile);
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification auth/onboarding:', error);
      setIsAuthenticated(false);
      setIsOnboardingCompleted(false);
      setUserProfile(null);
    } finally {
      console.log('Fin checkAuthAndOnboarding, setIsLoading(false)');
      setIsLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      setIsOnboardingCompleted(true);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde onboarding:', error);
    }
  };

  const signOut = async () => {
    try {
      if (DEV_MODE) {
        // Mode dev, supprimer la session dev
        await AsyncStorage.removeItem('devSession');
        await AsyncStorage.removeItem('devUserEmail');
      } else {
        // Mode production, déconnexion Supabase
        await supabase.auth.signOut();
      }
      setIsAuthenticated(false);
      setUserProfile(null);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  const setDevAuthentication = async (isAuth: boolean, userEmail?: string) => {
    try {
      if (isAuth) {
        await AsyncStorage.setItem('devSession', 'true');
        if (userEmail) {
          await AsyncStorage.setItem('devUserEmail', userEmail);
        }
        // Récupérer le profil en mode dev
        const profile = await getCurrentUserProfile();
        setUserProfile(profile);
      } else {
        await AsyncStorage.removeItem('devSession');
        await AsyncStorage.removeItem('devUserEmail');
        setUserProfile(null);
      }
      setIsAuthenticated(isAuth);
    } catch (error) {
      console.error('Erreur lors de la mise à jour auth dev:', error);
    }
  };

  const isManager = () => {
    return userProfile?.role === 'Gestionnaire';
  };

  return {
    isAuthenticated,
    isOnboardingCompleted,
    isLoading,
    userProfile,
    isManager,
    completeOnboarding,
    signOut,
    checkAuthAndOnboarding,
    setDevAuthentication,
  };
};