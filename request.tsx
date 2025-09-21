import React, { useMemo, useState, useEffect } from "react";
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
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../utils/supabase';

interface FormData {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;   // ISO YYYY-MM-DD
  type: string;
  reason: string;
}

interface Errors {
  startDate?: string;
  endDate?: string;
  type?: string;
  reason?: string;
}

export default function Request() {
    const router = useRouter();
    const [formData, setFormData] = useState<FormData>({
      startDate: '',
      endDate: '',
      type: '',
      reason: '',
    });
    const [errors, setErrors] = useState<Errors>({});
    const [loading, setLoading] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [types, setTypes] = useState<{ id: number; nom: string }[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    // Helpers
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    const formatDisplay = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('fr-FR');
    };

    const addMonths = (date: Date, months: number) => {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    };

    const startOfWeekMonday = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay(); // 0=Sun..6=Sat
      const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
      d.setDate(d.getDate() + diff);
      d.setHours(0,0,0,0);
      return d;
    };


    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth()+1, 0);

  type WeekRow = Date[];
    const monthWeeks: WeekRow[] = useMemo(() => {
      const first = firstDayOfMonth(currentMonth);
      const last = lastDayOfMonth(currentMonth);
      let cursor = startOfWeekMonday(first);
      const end = (() => { const monday = startOfWeekMonday(last); const friday = new Date(monday); friday.setDate(friday.getDate() + 4); return friday; })();
      const weeks: WeekRow[] = [];
      let row: WeekRow = [];
      while (cursor <= end) {
        const dow = cursor.getDay();
        if (dow >= 1 && dow <= 5) { // Mon-Fri only
          row.push(new Date(cursor));
          if (row.length === 5) {
            weeks.push(row);
            row = [];
          }
        }
        const next = new Date(cursor);
        next.setDate(cursor.getDate() + 1);
        cursor = next;
      }
      if (row.length > 0) {
        // pad remaining weekdays of last row with next month weekdays to complete 5 cells
        while (row.length < 5) {
          const lastCell = row[row.length - 1];
          const next = new Date(lastCell);
          next.setDate(lastCell.getDate() + 1);
          // ensure it's weekday
          if (next.getDay() >= 1 && next.getDay() <= 5) {
            row.push(next);
          }
        }
        weeks.push(row);
      }
      return weeks;
  }, [currentMonth]);

    const isSameDay = (a?: string, b?: string) => !!a && !!b && a === b;
    const isBetween = (iso: string, start?: string, end?: string) => {
      if (!start || !end) return false;
      return iso > start && iso < end;
    };

    const onSelectDate = (date: Date) => {
      const iso = toISO(date);
      const { startDate, endDate } = formData;
      if (!startDate) {
        setFormData(prev => ({ ...prev, startDate: iso }));
        return;
      }
      if (startDate && !endDate) {
        if (iso < startDate) {
          // restart range
          setFormData(prev => ({ ...prev, startDate: iso, endDate: '' }));
        } else if (iso === startDate) {
          // same day selection - set both
          setFormData(prev => ({ ...prev, startDate: iso, endDate: iso }));
          setShowCalendarModal(false);
        } else {
          setFormData(prev => ({ ...prev, endDate: iso }));
          setShowCalendarModal(false);
        }
        return;
      }
      // both exist -> restart from new start
      setFormData(prev => ({ ...prev, startDate: iso, endDate: '' }));
    };

    useEffect(() => {
      let mounted = true;
      const loadTypes = async () => {
        setTypesLoading(true);
        try {
          const { data, error } = await supabase
            .from('absence_types')
            .select('id_absence_type, nom')
            .eq('est_actif', true)
            .order('nom');
          if (error) throw error;
          if (!mounted) return;
          const list = (data || []).map((r: any) => ({ id: r.id_absence_type as number, nom: r.nom as string }));
          setTypes(list);
        } catch (e) {
          console.warn('Erreur chargement types:', (e as any)?.message);
        } finally {
          if (mounted) setTypesLoading(false);
        }
      };
      loadTypes();
      return () => { mounted = false; };
    }, []);

    // Validation du formulaire
    const validateForm = () => {
      const newErrors: Errors = {};

      // Date de début
      if (!formData.startDate.trim()) {
        newErrors.startDate = 'La date de début est requise';
      }

      // Date de fin
      if (!formData.endDate.trim()) {
        newErrors.endDate = 'La date de fin est requise';
      }

      // Type d'absence
      if (!selectedTypeId) {
        newErrors.type = 'Veuillez sélectionner un type d\'absence';
      }

      // Motif
      if (!formData.reason.trim()) {
        newErrors.reason = 'Le motif est requis';
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

  // plus de saisie libre pour les dates (calendrier uniquement)

    // Mise à jour des champs
    const updateField = (field: keyof FormData, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: undefined }));
      }
    };

    // Sélection du type d'absence
    const selectType = (type: { id: number; nom: string }) => {
      updateField('type', type.nom);
      setSelectedTypeId(type.id);
      setShowTypeModal(false);
    };

    // Soumission de la demande
    const submitRequestTreatment = async () => {
        if (!validateForm()) {
          return;
        }

        setLoading(true);

        try {
          // Récupérer l'utilisateur courant
          const { data: userRes, error: userErr } = await supabase.auth.getUser();
          if (userErr) throw userErr;
          const user = userRes?.user;
          if (!user) throw new Error('Aucune session utilisateur');

          // Insérer la demande
          const { error } = await supabase
            .from('absence_requests')
            .insert({
              id_utilisateur: user.id,
              id_type_absence: selectedTypeId,
              date_debut: formData.startDate,
              date_fin: formData.endDate,
              motif: formData.reason,
              statut: 'en_attente',
            });
          if (error) throw error;

          Alert.alert('Demande soumise', 'Votre demande d\'absence a été envoyée avec succès.', [
            { text: 'OK', onPress: () => router.back() }
          ]);

          // Réinitialiser le formulaire
          setFormData({ startDate: '', endDate: '', type: '', reason: '' });
          setSelectedTypeId(null);
          setErrors({});
        } catch (e) {
          Alert.alert('Erreur', (e as any)?.message || 'Une erreur s\'est produite lors de l\'envoi');
        } finally {
          setLoading(false);
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
              <Text style={styles.title}>Demande d&apos;absence</Text>
              <Text style={styles.subtitle}>Remplissez le formulaire ci-dessous</Text>

              {/* Date de début */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Date de début</Text>
                <TouchableOpacity
                  style={[styles.input, errors.startDate && styles.inputError, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                  onPress={() => setShowCalendarModal(true)}
                >
                  <Text style={styles.inputText}>{formatDisplay(formData.startDate) || 'Sélectionner une date'}</Text>
                  <Ionicons name="calendar-outline" size={20} color="#7f8c8d" />
                </TouchableOpacity>
                {errors.startDate && (
                  <Text style={styles.errorText}>{errors.startDate}</Text>
                )}
              </View>

              {/* Date de fin */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Date de fin</Text>
                <TouchableOpacity
                  style={[styles.input, errors.endDate && styles.inputError, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                  onPress={() => setShowCalendarModal(true)}
                >
                  <Text style={styles.inputText}>{formatDisplay(formData.endDate) || 'Sélectionner une date'}</Text>
                  <Ionicons name="calendar-outline" size={20} color="#7f8c8d" />
                </TouchableOpacity>
                {errors.endDate && (
                  <Text style={styles.errorText}>{errors.endDate}</Text>
                )}
              </View>

              {/* Type d'absence */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Type d&apos;absence</Text>
                <TouchableOpacity
                  style={[styles.dropdown, errors.type && styles.inputError]}
                  onPress={() => setShowTypeModal(true)}
                >
                  <Text style={[
                    styles.dropdownText,
                    !formData.type && styles.placeholderText
                  ]}>
                    {formData.type || "-- Sélectionnez un type --"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#7f8c8d" />
                </TouchableOpacity>
                {errors.type && (
                  <Text style={styles.errorText}>{errors.type}</Text>
                )}
              </View>

              {/* Motif */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Motif de l&apos;absence</Text>
                <TextInput
                  style={[styles.input, styles.textArea, errors.reason && styles.inputError]}
                  placeholder="Décrivez le motif de votre absence..."
                  placeholderTextColor="#95a5a6"
                  value={formData.reason}
                  onChangeText={(value) => updateField('reason', value)}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  returnKeyType="done"
                />
                {errors.reason && (
                  <Text style={styles.errorText}>{errors.reason}</Text>
                )}
              </View>

              {/* Bouton de soumission */}
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.buttonDisabled]}
                onPress={submitRequestTreatment}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Soumettre la demande</Text>
                )}
              </TouchableOpacity>

              {/* Bouton retour */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backButtonText}>Retour à l&apos;accueil</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Modal de sélection du type */}
          <Modal
            visible={showTypeModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowTypeModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Type d&apos;absence</Text>
                
                {typesLoading ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator color="#3498db" />
                  </View>
                ) : (
                  types.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={styles.modalOption}
                      onPress={() => selectType(type)}
                    >
                      <Text style={styles.modalOptionText}>{type.nom}</Text>
                      {selectedTypeId === type.id && (
                        <Ionicons name="checkmark" size={20} color="#3498db" />
                      )}
                    </TouchableOpacity>
                  ))
                )}

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowTypeModal(false)}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Modal calendrier (jours ouvrés seulement) */}
          <Modal
            visible={showCalendarModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowCalendarModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { paddingHorizontal: 12 }]}> 
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <TouchableOpacity onPress={() => setCurrentMonth(prev => addMonths(prev, -1))} style={{ padding: 8 }}>
                    <Ionicons name="chevron-back" size={20} color="#2c3e50" />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#2c3e50' }}>
                    {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity onPress={() => setCurrentMonth(prev => addMonths(prev, 1))} style={{ padding: 8 }}>
                    <Ionicons name="chevron-forward" size={20} color="#2c3e50" />
                  </TouchableOpacity>
                </View>

                {/* Entêtes Lundi->Vendredi */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 }}>
                  {['Lun','Mar','Mer','Jeu','Ven'].map((d) => (
                    <Text key={d} style={{ width: 52, textAlign: 'center', color: '#7f8c8d', fontWeight: '600' }}>{d}</Text>
                  ))}
                </View>

                <ScrollView style={{ maxHeight: 320 }}>
                  {monthWeeks.map((week, wi) => (
                    <View key={wi} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      {week.map((date, di) => {
                        const iso = toISO(date);
                        const inMonth = date.getMonth() === currentMonth.getMonth();
                        const isStart = isSameDay(iso, formData.startDate);
                        const isEnd = isSameDay(iso, formData.endDate);
                        const inRange = isBetween(iso, formData.startDate, formData.endDate);
                        const bg = isStart || isEnd ? '#3498db' : (inRange ? '#d6eaff' : (inMonth ? 'white' : '#ecf0f1'));
                        const color = isStart || isEnd ? 'white' : '#2c3e50';
                        return (
                          <TouchableOpacity
                            key={di}
                            style={{ width: 52, height: 44, borderRadius: 8, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e9ecef' }}
                            onPress={() => onSelectDate(date)}
                          >
                            <Text style={{ color, fontWeight: '600' }}>{date.getDate()}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                  <TouchableOpacity style={[styles.modalCancelButton, { flex: 1, marginRight: 8, backgroundColor: '#bdc3c7', borderWidth: 0 }]} onPress={() => setShowCalendarModal(false)}>
                    <Text style={styles.modalCancelText}>Fermer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalCancelButton, { flex: 1 }]}
                    onPress={() => setShowCalendarModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Valider</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
        maxWidth: 500,
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
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
        paddingTop: 16,
    },
    inputError: {
        borderColor: '#e74c3c',
        backgroundColor: '#fdf2f2',
    },
  inputText: {
    fontSize: 16,
    color: '#2c3e50',
  },
    errorText: {
        color: '#e74c3c',
        fontSize: 14,
        marginTop: 8,
        marginLeft: 4,
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
    submitButton: {
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
    submitButtonText: {
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
        maxWidth: 350,
        maxHeight: '70%',
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
        fontSize: 20,
        fontWeight: '600',
        color: '#2c3e50',
        textAlign: 'center',
        marginBottom: 20,
    },
    modalOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 8,
        borderRadius: 8,
        marginBottom: 4,
    },
    modalOptionText: {
        fontSize: 16,
        color: '#2c3e50',
        flex: 1,
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
});