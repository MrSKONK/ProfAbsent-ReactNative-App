import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../utils/useAuth';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isOnboardingCompleted, isLoading, isManager } = useAuth();

  // Debug logs
  console.log('SplashScreen - isLoading:', isLoading);
  console.log('SplashScreen - isAuthenticated:', isAuthenticated);
  console.log('SplashScreen - isOnboardingCompleted:', isOnboardingCompleted);

  useEffect(() => {
    console.log('SplashScreen useEffect - isLoading:', isLoading);
    console.log('SplashScreen useEffect - isAuthenticated:', isAuthenticated);
    console.log('SplashScreen useEffect - isOnboardingCompleted:', isOnboardingCompleted);
    
    if (!isLoading && isOnboardingCompleted !== null) {
      console.log('SplashScreen - not loading, checking conditions...');
      if (!isOnboardingCompleted) {
        console.log('SplashScreen - redirecting to onboarding');
        router.replace('/onboarding');
      } else if (isAuthenticated === true) {
        console.log('SplashScreen - user authenticated, checking if manager...');
        if (isManager()) {
          console.log('SplashScreen - redirecting manager to /manager');
          router.replace('/manager');
        } else {
          console.log('SplashScreen - redirecting user to /(tabs)');
          router.replace('/(tabs)');
        }
      } else if (isAuthenticated === false) {
        console.log('SplashScreen - not authenticated, redirecting to login');
        router.replace('/login');
      }
      // Si isAuthenticated est null, on attend qu'il soit résolu
    }
  }, [isLoading, isOnboardingCompleted, isAuthenticated, isManager, router]);

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