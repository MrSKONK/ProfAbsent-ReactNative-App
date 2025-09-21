import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../utils/supabase';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthAndOnboarding();
  }, []);

  const checkAuthAndOnboarding = async () => {
    try {
      // Vérifier l'onboarding
      const onboarding = await AsyncStorage.getItem('onboardingCompleted');
      setIsOnboardingCompleted(onboarding === 'true');

      // Vérifier l'authentification
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.user);
    } catch (error) {
      console.error('Erreur lors de la vérification auth/onboarding:', error);
      setIsAuthenticated(false);
      setIsOnboardingCompleted(false);
    } finally {
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
      await supabase.auth.signOut();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return {
    isAuthenticated,
    isOnboardingCompleted,
    isLoading,
    completeOnboarding,
    signOut,
    checkAuthAndOnboarding,
  };
};