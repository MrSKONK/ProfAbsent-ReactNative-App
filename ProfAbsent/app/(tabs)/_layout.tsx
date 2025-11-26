import React from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, Alert } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../utils/useAuth';

const LogoutButton = () => {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { 
          text: 'Déconnexion', 
          style: 'destructive', 
          onPress: async () => {
            await signOut();
            router.replace('/login');
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity 
      onPress={handleLogout}
      style={{ marginRight: 15, padding: 5 }}
    >
      <Ionicons name="log-out" size={24} color="white" />
    </TouchableOpacity>
  );
}

// Composant pour le dégradé du header
const HeaderBackground = () => (
  <LinearGradient
    colors={['#2c3e50', '#3498db', '#74b9ff']}
    start={{x: 0, y: 0}}
    end={{x: 1, y: 1}}
    style={{ flex: 1 }}
  />
);

// Composant pour le dégradé de la tab bar
const TabBarBackground = () => (
  <LinearGradient
    colors={['#74b9ff', '#0984e3']}
    start={{x: 0, y: 0}}
    end={{x: 0, y: 1}}
    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
  />
);

export default function TabsLayout() {
  const router = useRouter();
  const { isAuthenticated, isManager, isLoading } = useAuth();

  // Protection contre les gestionnaires - ils ne peuvent pas accéder aux tabs
  React.useEffect(() => {
    if (!isLoading && isAuthenticated && isManager()) {
      console.log('Gestionnaire détecté, redirection vers /manager');
      router.replace('/manager');
    }
  }, [isAuthenticated, isManager, isLoading, router]);

  return (
    <Tabs
      screenOptions={{
        headerBackground: () => <HeaderBackground />,
        headerTintColor: 'white',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerRight: () => <LogoutButton />,
        tabBarBackground: () => <TabBarBackground />,
        tabBarActiveTintColor: 'white',
        tabBarInactiveTintColor: '#dfe6e9',
        tabBarStyle: {
          backgroundColor: 'transparent',
        },
      }}>

      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen 
        name="request" 
        options={{ 
          title: 'Demande d\'Absence',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={color} />
          ),
        }} 
      />
      <Tabs.Screen 
        name="Profile" 
        options={{ 
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }} 
      />
      {/* Détails de demande: route cachée dans la tab bar */}
      <Tabs.Screen
        name="requests/[id]"
        options={{
          href: null,
          title: 'Détails demande',
        }}
      />
      <Tabs.Screen
        name="requests/[all]"
        options={{
          href: null,
          title: 'Toutes les demandes',
        }}
      />
    </Tabs>
  );  
}