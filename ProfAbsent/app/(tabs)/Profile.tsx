import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../utils/useAuth';
import { DEV_MODE, DEV_CREDENTIALS } from '../../utils/devAuth';

interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department?: string;
  phone?: string;
  startDate?: string;
  createdAtDisplay?: string;
}

interface FormData {
  fullName: string;
  department: string;
  phone: string;
}

interface Errors {
  fullName?: string;
  department?: string;
  phone?: string;
}

const Profile = () => {
    const router = useRouter();
    const { signOut } = useAuth();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [formData, setFormData] = useState<FormData>({
      fullName: '',
      department: '',
      phone: '',
    });
    const [errors, setErrors] = useState<Errors>({});
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [initializing, setInitializing] = useState(true);

    // Chargement des vraies données depuis Supabase
    useEffect(() => {
      let mounted = true;
      const load = async () => {
        try {
          if (DEV_MODE) {
            // Mode développement - utiliser des données fictives
            const devUser: UserProfile = {
              id: 'dev-user-id',
              fullName: 'Utilisateur Test',
              email: DEV_CREDENTIALS.email,
              role: 'Professeur',
              department: 'Informatique',
              phone: '0123456789',
              startDate: '01/01/2023',
              createdAtDisplay: 'Créé en mode développement'
            };
            
            if (mounted) {
              setUser(devUser);
              setFormData({
                fullName: devUser.fullName,
                department: devUser.department || '',
                phone: devUser.phone || '',
              });
            }
          } else {
            // Mode production - utiliser Supabase
            const { data: userRes, error: userErr } = await supabase.auth.getUser();
            if (userErr) throw userErr;
            const authUser = userRes?.user;
            if (!authUser) throw new Error('Aucune session utilisateur');

            const { data: profile, error: profErr } = await supabase
              .from('profiles')
              .select('id_profile, nom_complet, role, departement, telephone, date_embauche, date_creation')
              .eq('id_profile', authUser.id)
              .maybeSingle();
            if (profErr) throw profErr;

            let createdAtDisplay: string | undefined = undefined;
            if (profile?.date_creation) {
              const d = new Date(profile.date_creation);
              const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
              const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              createdAtDisplay = `Crée le ${date} à ${time}`;
            }

            const u: UserProfile = {
              id: authUser.id,
              fullName: profile?.nom_complet || (authUser.user_metadata as any)?.full_name || authUser.email?.split('@')[0] || '',
              email: authUser.email || '',
              role: profile?.role || (authUser.user_metadata as any)?.role || 'Professeur',
              department: profile?.departement || '',
              phone: profile?.telephone || '',
              startDate: profile?.date_embauche ? new Date(profile.date_embauche).toLocaleDateString('fr-FR') : undefined,
              createdAtDisplay,
            };
            if (!mounted) return;
            setUser(u);
            setFormData({ fullName: u.fullName, department: u.department || '', phone: u.phone || '' });
          }
        } catch (e) {
          console.warn('Chargement profil échoué:', (e as any)?.message);
        } finally {
          if (mounted) setInitializing(false);
        }
      };
      load();
      return () => { mounted = false; };
    }, []);

    // Validation du formulaire
    const validateForm = () => {
      const newErrors: Errors = {};

      if (!formData.fullName.trim()) {
        newErrors.fullName = 'Le nom complet est requis';
      }

      if (!formData.department.trim()) {
        newErrors.department = 'Le département est requis';
      }

      if (formData.phone && !/^[+]?[\d\s\-\(\)]{10,}$/.test(formData.phone)) {
        newErrors.phone = 'Format de téléphone invalide';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    // Mise à jour des champs
    const updateField = (field: keyof FormData, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: undefined }));
      }
    };

    // Sauvegarder les modifications
    const saveProfile = async () => {
      if (!validateForm()) {
        return;
      }

      setLoading(true);

      try {
        if (!user) return;
        const { error } = await supabase
          .from('profiles')
          .update({
            nom_complet: formData.fullName,
            departement: formData.department,
            telephone: formData.phone,
            date_modification: new Date().toISOString(),
          })
          .eq('id_profile', user.id);
        if (error) throw error;

        Alert.alert('Profil mis à jour', 'Vos informations ont été sauvegardées avec succès.', [{ text: 'OK' }]);

        // Mettre à jour les données utilisateur
        setUser({
          ...user,
          fullName: formData.fullName,
          department: formData.department,
          phone: formData.phone,
        });
        setIsEditing(false);
      } catch (e) {
        Alert.alert('Erreur', (e as any)?.message || 'Une erreur s\'est produite lors de la sauvegarde');
      } finally {
        setLoading(false);
      }
    };

    // Annuler les modifications
    const cancelEdit = () => {
      if (user) {
        setFormData({
          fullName: user.fullName,
          department: user.department || '',
          phone: user.phone || '',
        });
      }
      setErrors({});
      setIsEditing(false);
    };

    // Déconnexion
    const handleLogout = () => {
      Alert.alert(
        'Déconnexion',
        'Êtes-vous sûr de vouloir vous déconnecter ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Déconnecter', 
            style: 'destructive',
            onPress: async () => {
              try {
                await signOut();
                router.replace('/login');
              } catch (error) {
                console.error('Erreur lors de la déconnexion:', error);
                Alert.alert('Erreur', 'Impossible de se déconnecter');
              }
            }
          }
        ]
      );
    };

    if (initializing || !user) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Chargement du profil...</Text>
        </View>
      );
    }
    
    return (
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* En-tête du profil */}
            <LinearGradient
              colors={['#74b9ff', '#0984e3']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
              style={styles.headerContainer}
            >
              <View style={styles.profileHeader}>
                <View style={styles.avatarContainer}>
                  <Ionicons name="person" size={40} color="white" />
                </View>
                <Text style={styles.userName}>{user.fullName}</Text>
                <Text style={styles.userRole}>{user.role}</Text>
              </View>
            </LinearGradient>

            {/* Informations du profil */}
            <View style={styles.formContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Informations personnelles</Text>
                <TouchableOpacity
                  onPress={() => isEditing ? cancelEdit() : setIsEditing(true)}
                  style={styles.editButton}
                >
                  <Ionicons 
                    name={isEditing ? "close" : "pencil"} 
                    size={20} 
                    color="#3498db" 
                  />
                </TouchableOpacity>
              </View>

              {/* Email (non modifiable) */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <View style={[styles.input, styles.inputDisabled]}>
                  <Text style={styles.inputText}>{user.email}</Text>
                </View>
              </View>

              {/* Nom complet */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nom complet</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, errors.fullName && styles.inputError]}
                    value={formData.fullName}
                    onChangeText={(value) => updateField('fullName', value)}
                    placeholder="Votre nom complet"
                    placeholderTextColor="#95a5a6"
                  />
                ) : (
                  <View style={styles.input}>
                    <Text style={styles.inputText}>{user.fullName}</Text>
                  </View>
                )}
                {errors.fullName && (
                  <Text style={styles.errorText}>{errors.fullName}</Text>
                )}
              </View>

              {/* Département */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Département</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, errors.department && styles.inputError]}
                    value={formData.department}
                    onChangeText={(value) => updateField('department', value)}
                    placeholder="Votre département"
                    placeholderTextColor="#95a5a6"
                  />
                ) : (
                  <View style={styles.input}>
                    <Text style={styles.inputText}>{user.department || 'Non renseigné'}</Text>
                  </View>
                )}
                {errors.department && (
                  <Text style={styles.errorText}>{errors.department}</Text>
                )}
              </View>

              {/* Téléphone */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Téléphone</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, errors.phone && styles.inputError]}
                    value={formData.phone}
                    onChangeText={(value) => updateField('phone', value)}
                    placeholder="Votre numéro de téléphone"
                    placeholderTextColor="#95a5a6"
                    keyboardType="phone-pad"
                  />
                ) : (
                  <View style={styles.input}>
                    <Text style={styles.inputText}>{user.phone || 'Non renseigné'}</Text>
                  </View>
                )}
                {errors.phone && (
                  <Text style={styles.errorText}>{errors.phone}</Text>
                )}
              </View>

              {/* Création du profil */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Création du profil</Text>
                <View style={[styles.input, styles.inputDisabled]}>
                  <Text style={styles.inputText}>{user.createdAtDisplay || 'Non renseigné'}</Text>
                </View>
              </View>

              {/* Boutons d'action */}
              {isEditing ? (
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.saveButton, loading && styles.buttonDisabled]}
                    onPress={saveProfile}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.saveButtonText}>Sauvegarder</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={cancelEdit}
                  >
                    <Text style={styles.cancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                  >
                    <Ionicons name="log-out-outline" size={20} color="#e74c3c" />
                    <Text style={styles.logoutButtonText}>Se déconnecter</Text>
                  </TouchableOpacity>
                </View>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
  headerContainer: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  profileHeader: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    margin: 20,
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
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2c3e50',
  },
  editButton: {
    padding: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 52,
    justifyContent: 'center',
  },
  inputDisabled: {
    backgroundColor: '#ecf0f1',
    borderColor: '#d5dbdb',
  },
  inputText: {
    fontSize: 16,
    color: '#2c3e50',
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
  buttonContainer: {
    marginTop: 24,
  },
  saveButton: {
    backgroundColor: '#27ae60',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#27ae60',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  cancelButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e74c3c',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  backButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  backButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '500',
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
    shadowOpacity: 0.1,
  },
});

export default Profile;
