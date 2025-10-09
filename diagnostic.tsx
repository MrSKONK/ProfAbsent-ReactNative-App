import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase, testSupabaseConnection } from '../utils/supabase';
import { DEV_MODE, DEV_CREDENTIALS } from '../utils/devAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DiagnosticScreen() {
  const router = useRouter();
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runInitialDiagnostic();
  }, []);

  const runInitialDiagnostic = async () => {
    setLoading(true);
    const info: any = {
      devMode: DEV_MODE,
      supabaseUrl: 'https://ilmjvlbbvrysatjxbvae.supabase.co',
      timestamp: new Date().toISOString(),
    };

    try {
      const connectionTest = await testSupabaseConnection();
      info.supabaseConnection = connectionTest;
    } catch (error: any) {
      info.supabaseConnection = { success: false, error: error?.message || 'Erreur inconnue' };
    }

    setDiagnosticInfo(info);
    setLoading(false);
  };

  const testLogin = async () => {
    setLoading(true);
    try {
      console.log('Test de connexion avec Supabase...');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'testpassword123',
      });

      Alert.alert(
        'Résultat du test',
        error ? `Erreur: ${error.message}` : 'Connexion réussie (utilisateur test)',
        [{ text: 'OK' }]
      );

      console.log('Résultat test login:', { data, error });
    } catch (err: any) {
      Alert.alert('Erreur de test', err?.message || 'Erreur inconnue');
      console.error('Erreur test login:', err);
    } finally {
      setLoading(false);
    }
  };

  const createTestUser = async () => {
    setLoading(true);
    try {
      console.log('Création d\'un utilisateur test...');
      const { data, error } = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'testpassword123',
        options: {
          data: {
            full_name: 'Utilisateur Test',
            role: 'Professeur',
          },
        },
      });

      Alert.alert(
        'Résultat de création',
        error ? `Erreur: ${error.message}` : 'Utilisateur test créé avec succès',
        [{ text: 'OK' }]
      );

      console.log('Résultat création utilisateur:', { data, error });
    } catch (err: any) {
      Alert.alert('Erreur de création', err?.message || 'Erreur inconnue');
      console.error('Erreur création utilisateur:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetOnboarding = async () => {
    setLoading(true);
    try {
      await AsyncStorage.removeItem('onboardingCompleted');
      Alert.alert('Onboarding réinitialisé', 'Vous verrez à nouveau l’onboarding au prochain démarrage.', [{ text: 'OK' }]);
      // Optionnel: revenir à la racine pour déclencher la logique de redirection
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Erreur', err?.message || 'Impossible de réinitialiser l’onboarding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#f8f9fa', '#ecf0f1']}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#3498db" />
        </TouchableOpacity>
        <Text style={styles.title}>Diagnostic Authentification</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations système</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>Mode: {DEV_MODE ? 'Développement' : 'Production'}</Text>
            <Text style={styles.infoText}>URL Supabase: Configurée</Text>
            <Text style={styles.infoText}>
              Connexion Supabase: {diagnosticInfo.supabaseConnection?.success ? '✅ OK' : '❌ Erreur'}
            </Text>
            {!diagnosticInfo.supabaseConnection?.success && (
              <Text style={styles.errorText}>
                {diagnosticInfo.supabaseConnection?.error?.message || 'Erreur inconnue'}
              </Text>
            )}
          </View>
        </View>

        {DEV_MODE && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mode Développement</Text>
            <View style={styles.infoCard}>
              <Text style={styles.infoText}>Email de test: {DEV_CREDENTIALS.email}</Text>
              <Text style={styles.infoText}>Mot de passe: {DEV_CREDENTIALS.password}</Text>
              <Text style={styles.warningText}>
                ⚠️ En mode développement, utilisez ces identifiants pour vous connecter
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tests</Text>
          
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: '#3498db' }]}
            onPress={runInitialDiagnostic}
            disabled={loading}
          >
            <Text style={styles.testButtonText}>🔄 Rafraîchir le diagnostic</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: '#e74c3c' }]}
            onPress={testLogin}
            disabled={loading}
          >
            <Text style={styles.testButtonText}>🧪 Test de connexion</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: '#27ae60' }]}
            onPress={createTestUser}
            disabled={loading}
          >
            <Text style={styles.testButtonText}>👤 Créer utilisateur test</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: '#8e44ad' }]}
            onPress={resetOnboarding}
            disabled={loading}
          >
            <Text style={styles.testButtonText}>🧼 Réinitialiser l’onboarding</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Solutions</Text>
          <View style={styles.infoCard}>
            <Text style={styles.solutionTitle}>1. Vérifiez votre configuration Supabase</Text>
            <Text style={styles.solutionText}>• Assurez-vous que votre projet Supabase est actif</Text>
            <Text style={styles.solutionText}>• Vérifiez les paramètres d&apos;authentification</Text>
            
            <Text style={styles.solutionTitle}>2. Créez un compte d&apos;abord</Text>
            <Text style={styles.solutionText}>• Utilisez la page d&apos;inscription avant de vous connecter</Text>
            
            <Text style={styles.solutionTitle}>3. Mode développement</Text>
            <Text style={styles.solutionText}>• Activez DEV_MODE=true dans devAuth.ts pour tester</Text>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#e74c3c',
    fontStyle: 'italic',
  },
  warningText: {
    fontSize: 14,
    color: '#f39c12',
    fontWeight: '500',
    marginTop: 8,
  },
  testButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  solutionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 12,
    marginBottom: 4,
  },
  solutionText: {
    fontSize: 13,
    color: '#7f8c8d',
    marginLeft: 8,
    marginBottom: 2,
  },
});
