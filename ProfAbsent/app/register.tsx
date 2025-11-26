import React, { useState } from 'react';
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
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../utils/supabase';
import { DEV_MODE, devRegister } from '../utils/devAuth';

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  department: string;
  phone: string;
}

interface Errors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  role?: string;
  department?: string;
  phone?: string;
}

const Register = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
    department: '',
    phone: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Validation de l'email
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validation du formulaire
  const validateForm = () => {
    const newErrors: Errors = {};

    // Nom complet
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Le nom complet est requis';
    }

    // Email
    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    // Mot de passe
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < 12) {
      newErrors.password = 'Le mot de passe doit contenir au moins 12 caractères';
    }

    // Confirmation du mot de passe
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'La confirmation du mot de passe est requise';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    // Fonction
    if (!formData.role) {
      newErrors.role = 'Veuillez sélectionner votre fonction';
    }

    // Département (requis comme dans l'édition du profil)
    if (!formData.department.trim()) {
      newErrors.department = 'Le département est requis';
    }

    // Téléphone (optionnel mais validé si présent)
    if (formData.phone && !/^[+]?[\d\s\-\(\)]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Format de téléphone invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Gestion de l'inscription
  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      console.log('Tentative d\'inscription avec:', formData.email);
      
      if (DEV_MODE) {
        // Mode développement
        const result = await devRegister(formData.email, formData.password, formData.fullName, formData.role);
        
        if (result.success) {
          console.log('Inscription dev réussie:', result.user);
          Alert.alert(
            'Inscription réussie',
            'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.',
            [{ text: 'OK', onPress: () => router.replace('/login') }]
          );
        } else {
          Alert.alert('Erreur', 'Erreur lors de l\'inscription');
        }
      } else {
        // Mode production - utiliser Supabase avec gestion d'erreur améliorée
        console.log('Tentative d\'inscription Supabase...');
        
        const { data, error } = await supabase.auth.signUp({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName.trim(),
              role: formData.role,
              departement: formData.department.trim() || null,
              telephone: formData.phone.trim() || null,
            },
          },
        });

        console.log('Réponse inscription Supabase:', { data, error });

        if (error) {
          console.error('Erreur inscription:', error);
          
          // Gestion spécifique des erreurs d'inscription
          let errorMessage = 'Une erreur s\'est produite lors de l\'inscription';
          
          if (error.message.includes('User already registered')) {
            errorMessage = 'Un compte existe déjà avec cette adresse email.';
          } else if (error.message.includes('Password should be at least')) {
            errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
          } else if (error.message.includes('Invalid email')) {
            errorMessage = 'L\'adresse email n\'est pas valide.';
          } else if (error.message.includes('Signup is disabled')) {
            errorMessage = 'L\'inscription est temporairement désactivée.';
          } else {
            errorMessage = error.message;
          }
          
          Alert.alert('Erreur d\'inscription', errorMessage);
        } else if (data.user) {
          console.log('Inscription réussie:', data);
          
          try {
            // Créer le profil utilisateur automatiquement
            const userId = data.user.id;
            const userEmail = data.user.email;
            
            if (userId && userEmail) {
              console.log('Création du profil utilisateur...');
              
              const { error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id_profile: userId,
                  nom_complet: formData.fullName.trim(),
                  role: formData.role,
                  departement: formData.department.trim() || null,
                  telephone: formData.phone.trim() ? parseFloat(formData.phone.trim().replace(/\D/g, '')) : null,
                  email: userEmail
                });
              
              if (insertError) {
                console.warn('Erreur création profil:', insertError.message);
                // Continuer même si la création du profil échoue
              } else {
                console.log('Profil créé avec succès');
              }
            }
          } catch (profileErr) {
            console.warn('Erreur gestion profil post-inscription:', (profileErr as any)?.message);
            // Continue même si la gestion du profil échoue
          }
          
          // Message de succès différent selon si l'email doit être confirmé
          const needsConfirmation = !data.session; // Pas de session = confirmation email requise
          
          if (needsConfirmation) {
            Alert.alert(
              'Inscription réussie',
              'Votre compte a été créé. Vérifiez votre email et cliquez sur le lien de confirmation, puis connectez-vous.',
              [{ text: 'OK', onPress: () => router.replace('/login') }]
            );
          } else {
            Alert.alert(
              'Inscription réussie',
              'Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.',
              [{ text: 'OK', onPress: () => router.replace('/login') }]
            );
          }
        } else {
          Alert.alert('Erreur', 'Aucune donnée utilisateur reçue lors de l\'inscription');
        }
      }
    } catch (err) {
      console.error('Erreur catch inscription:', err);
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

  // Sélection de rôle
  const selectRole = (role: string) => {
    updateField('role', role);
    setShowRoleModal(false);
  };

  // Obtenir le texte d'affichage pour le rôle
  const getRoleDisplayText = () => {
    if (!formData.role) {
      return '-- Sélectionnez votre fonction --';
    }
    return formData.role;
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
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Inscrivez-vous pour commencer</Text>

          {/* Nom complet */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              placeholder="Nom complet"
              placeholderTextColor="#95a5a6"
              value={formData.fullName}
              onChangeText={(value) => updateField('fullName', value)}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {errors.fullName && (
              <Text style={styles.errorText}>{errors.fullName}</Text>
            )}
          </View>

          {/* Fonction */}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={[styles.dropdown, errors.role && styles.inputError]}
              onPress={() => setShowRoleModal(true)}
            >
              <Text style={[
                styles.dropdownText,
                !formData.role && styles.placeholderText
              ]}>
                {getRoleDisplayText()}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
            {errors.role && (
              <Text style={styles.errorText}>{errors.role}</Text>
            )}
          </View>

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

          {/* Département */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, errors.department && styles.inputError]}
              placeholder="Département"
              placeholderTextColor="#95a5a6"
              value={formData.department}
              onChangeText={(value) => updateField('department', value)}
              autoCapitalize="words"
              returnKeyType="next"
            />
            {errors.department && (
              <Text style={styles.errorText}>{errors.department}</Text>
            )}
          </View>

          {/* Téléphone (optionnel) */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              placeholder="Téléphone (optionnel)"
              placeholderTextColor="#95a5a6"
              value={formData.phone}
              onChangeText={(value) => updateField('phone', value)}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
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
              returnKeyType="next"
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}
          </View>

          {/* Confirmation du mot de passe */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, errors.confirmPassword && styles.inputError]}
              placeholder="Confirmer le mot de passe"
              placeholderTextColor="#95a5a6"
              value={formData.confirmPassword}
              onChangeText={(value) => updateField('confirmPassword', value)}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>{errors.confirmPassword}</Text>
            )}
          </View>

          {/* Bouton d'inscription */}
          <TouchableOpacity
            style={[styles.registerButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.registerButtonText}>S&apos;inscrire</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginLinkText}>
              Déjà un compte ? <Text style={styles.loginLinkHighlight}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de sélection de fonction */}
      <Modal
        visible={showRoleModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sélectionnez votre fonction</Text>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => selectRole('Professeur')}
            >
              <View style={styles.radioButton}>
                {formData.role === 'Professeur' && (
                  <View style={styles.radioButtonSelected} />
                )}
              </View>
              <Text style={styles.modalOptionText}>Professeur</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => selectRole('Personnel administratif')}
            >
              <View style={styles.radioButton}>
                {formData.role === 'Personnel administratif' && (
                  <View style={styles.radioButtonSelected} />
                )}
              </View>
              <Text style={styles.modalOptionText}>Personnel administratif</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowRoleModal(false)}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

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
  registerButton: {
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
  registerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
  },
  dropdown: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
  },
  placeholderText: {
    color: '#95a5a6',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 16,
    color: '#2c3e50',
    marginLeft: 12,
  },
  modalCancelButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#bdc3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3498db',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 20,
    padding: 8,
  },
  loginLinkText: {
    color: '#7f8c8d',
    fontSize: 16,
  },
  loginLinkHighlight: {
    color: '#3498db',
    fontWeight: '600',
  },
});

export default Register;
