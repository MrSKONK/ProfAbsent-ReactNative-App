import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

interface RouteGuardProps {
  children: React.ReactNode;
  requireManager?: boolean;
  blockManager?: boolean;
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ 
  children, 
  requireManager = false, 
  blockManager = false 
}) => {
  const router = useRouter();
  const { isAuthenticated, isManager, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        // Pas connecté - rediriger vers login
        router.replace('/login');
        return;
      }

      if (requireManager && !isManager()) {
        // Page réservée aux gestionnaires mais utilisateur n'est pas gestionnaire
        console.log('Accès refusé - page réservée aux gestionnaires');
        router.replace('/(tabs)');
        return;
      }

      if (blockManager && isManager()) {
        // Page interdite aux gestionnaires
        console.log('Accès refusé - gestionnaire redirigé vers page manager');
        router.replace('/manager');
        return;
      }
    }
  }, [isLoading, isAuthenticated, isManager, requireManager, blockManager, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null; // Sera redirigé vers login
  }

  if (requireManager && !isManager()) {
    return null; // Sera redirigé vers tabs
  }

  if (blockManager && isManager()) {
    return null; // Sera redirigé vers manager
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
});