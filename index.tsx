import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../utils/useAuth';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isOnboardingCompleted, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isOnboardingCompleted) {
        // Première utilisation - afficher l'onboarding
        router.replace('/onboarding');
      } else if (isAuthenticated) {
        // Utilisateur connecté - aller au dashboard via push puis replace
        router.push('/(tabs)' as any);
      } else {
        // Pas de session active - aller à la page de connexion
        router.replace('/login');
      }
    }
  }, [isLoading, isOnboardingCompleted, isAuthenticated, router]);

  return (
    <LinearGradient
      colors={['#2c3e50', '#3498db', '#74b9ff']}
      style={styles.container}
    >
      <View style={styles.content}>
        <ActivityIndicator size="large" color="white" />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
});