import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from '../utils/supabase';
import { DEV_MODE, devLogin } from '../utils/devAuth';
import { useAuth } from '../utils/useAuth';

interface FormData {
  email: string;
  password: string;
}

interface Errors {
  email?: string;
  password?: string;
}

export default function Login() {
    const router = useRouter();
    const { setDevAuthentication } = useAuth();
    const [formData, setFormData] = useState<FormData>({
      email: '',
      password: '',
    });
    const [errors, setErrors] = useState<Errors>({});
    const [loading, setLoading] = useState(false);

    // Validation de l'email
    const validateEmail = (email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    // Validation du formulaire
    const validateForm = () => {
      const newErrors: Errors = {};

      // Email
      if (!formData.email.trim()) {
        newErrors.email = 'L\'email est requis';
      } else if (!validateEmail(formData.email)) {
        newErrors.email = 'Email invalide';
      }

      // Mot de passe
      if (!formData.password) {
        newErrors.password = 'Le mot de passe est requis';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validateForm()) {
          return;
        }

        setLoading(true);

        try {
          console.log('Tentative de connexion avec:', formData.email);
          
          if (DEV_MODE) {
            // Mode développement - utiliser les identifiants de test
            const result = await devLogin(formData.email, formData.password);
            
            if (result.success) {
              console.log('Connexion dev réussie:', result.user);
              // Marquer l'authentification en mode dev
              await setDevAuthentication(true);
              router.replace('/');
            } else {
              Alert.alert('Erreur de connexion', result.error);
            }
          } else {
            // Mode production - utiliser Supabase avec gestion d'erreur améliorée
            console.log('Tentative de connexion Supabase...');
            
            const { data, error } = await supabase.auth.signInWithPassword({
              email: formData.email.trim().toLowerCase(),
              password: formData.password,
            });

            console.log('Réponse Supabase:', { data, error });

            if (error) {
              console.error('Erreur Supabase:', error);
              
              // Gestion spécifique des erreurs
              let errorMessage = 'Une erreur de connexion s\'est produite';
              
              if (error.message.includes('Invalid login credentials')) {
                errorMessage = 'Email ou mot de passe incorrect. Vérifiez vos identifiants.';
              } else if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Veuillez confirmer votre email avant de vous connecter.';
              } else if (error.message.includes('Too many requests')) {
                errorMessage = 'Trop de tentatives. Attendez quelques minutes avant de réessayer.';
              } else {
                errorMessage = error.message;
              }
              
              Alert.alert('Erreur de connexion', errorMessage);
            } else if (data.user) {
              console.log('Connexion réussie:', data);
              
              try {
                // Vérifier/créer le profil utilisateur
                const userId = data.user.id;
                const userEmail = data.user.email;
                
                if (userId && userEmail) {
                  const { data: existingProfile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id_profile, nom_complet, role')
                    .eq('id_profile', userId)
                    .maybeSingle();
                  
                  if (profileError && !profileError.message.includes('No rows')) {
                    console.warn('Erreur vérification profil:', profileError.message);
                  }
                  
                  if (!existingProfile) {
                    // Créer le profil s'il n'existe pas
                    const metadata = data.user.user_metadata || {};
                    const fullName = metadata.full_name || userEmail.split('@')[0];
                    const role = metadata.role || 'Professeur';
                    const departement = metadata.departement || null;
                    const telephone = metadata.telephone || null;
                    
                    const { error: insertError } = await supabase
                      .from('profiles')
                      .insert({
                        id_profile: userId,
                        nom_complet: fullName,
                        role: role,
                        departement: departement,
                        telephone: telephone
                      });
                    
                    if (insertError) {
                      console.warn('Erreur création profil:', insertError.message);
                    } else {
                      console.log('Profil créé avec succès');
                    }
                  } else {
                    console.log('Profil existant trouvé:', existingProfile);
                  }
                }
              } catch (profileErr) {
                console.warn('Erreur gestion profil:', (profileErr as any)?.message);
                // Continue même si la gestion du profil échoue
              }
              
              // Connexion réussie - rediriger vers l'application principale
              router.replace('/');
            } else {
              Alert.alert('Erreur', 'Aucune donnée utilisateur reçue');
            }
          }
        } catch (err) {
          console.error('Erreur catch:', err);
          Alert.alert('Erreur', 'Une erreur inattendue s\'est produite. Vérifiez votre connexion internet.');
        } finally {
          setLoading(false);
        }
    };

    // Mise à jour des champs
    const updateField = (field: keyof FormData, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      // Effacer l'erreur pour ce champ
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: undefined }));
      }
    };
    
    return (
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formContainer}>
              <Text style={styles.title}>Connexion</Text>
              <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>

              {/* Email */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Adresse email"
                  placeholderTextColor="#95a5a6"
                  value={formData.email}
                  onChangeText={(value) => updateField('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email}</Text>
                )}
              </View>

              {/* Mot de passe */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="Mot de passe"
                  placeholderTextColor="#95a5a6"
                  value={formData.password}
                  onChangeText={(value) => updateField('password', value)}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                {errors.password && (
                  <Text style={styles.errorText}>{errors.password}</Text>
                )}
              </View>

              {/* Bouton de connexion */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.loginButtonText}>Se connecter</Text>
                )}
              </TouchableOpacity>

              {/* Bouton retour */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backButtonText}>Retour à l&apos;accueil</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.registerLink}
                onPress={() => router.push('/register')}
              >
                <Text style={styles.registerLinkText}>
                  Pas de compte ? <Text style={styles.registerLinkHighlight}>S&apos;inscrire</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.diagnosticLink}
                onPress={() => router.push('/diagnostic')}
              >
                <Text style={styles.diagnosticLinkText}>
                  🔧 Problème de connexion ? <Text style={styles.diagnosticLinkHighlight}>Diagnostic</Text>
                </Text>
              </TouchableOpacity>

              {/* Bouton de test rapide en mode développement */}
              {DEV_MODE && (
                <TouchableOpacity
                  style={[styles.testButton, { marginTop: 12 }]}
                  onPress={() => {
                    setFormData({ email: 'test@test.com', password: 'password123' });
                  }}
                >
                  <Text style={styles.testButtonText}>🧪 Remplir avec les identifiants de test</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    formContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
        maxWidth: 400,
        alignSelf: 'center',
        width: '100%',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2c3e50',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
        marginBottom: 32,
    },
    inputContainer: {
        marginBottom: 20,
    },
    input: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#e9ecef',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    inputError: {
        borderColor: '#e74c3c',
        backgroundColor: '#fdf2f2',
    },
    errorText: {
        color: '#e74c3c',
        fontSize: 14,
        marginTop: 8,
        marginLeft: 4,
    },
    loginButton: {
        backgroundColor: '#3498db',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#3498db',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonDisabled: {
        backgroundColor: '#bdc3c7',
        shadowOpacity: 0.1,
    },
    loginButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '600',
    },
    backButton: {
        backgroundColor: 'transparent',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#bdc3c7',
    },
    backButtonText: {
        color: '#7f8c8d',
        fontSize: 16,
        fontWeight: '500',
    },
    registerLink: {
        alignItems: 'center',
        marginTop: 20,
        padding: 8,
    },
    registerLinkText: {
        color: '#7f8c8d',
        fontSize: 16,
    },
    registerLinkHighlight: {
        color: '#3498db',
        fontWeight: '600',
    },
    diagnosticLink: {
        alignItems: 'center',
        marginTop: 12,
        padding: 8,
    },
    diagnosticLinkText: {
        color: '#7f8c8d',
        fontSize: 14,
    },
    diagnosticLinkHighlight: {
        color: '#e74c3c',
        fontWeight: '600',
    },
    testButton: {
        alignItems: 'center',
        marginTop: 12,
        padding: 8,
        backgroundColor: '#f39c12',
        borderRadius: 8,
    },
    testButtonText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
});