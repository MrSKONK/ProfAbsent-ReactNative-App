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
import * as DocumentPicker from 'expo-document-picker';
import { printToFileAsync } from 'expo-print';
import { shareAsync } from 'expo-sharing';
import { generatePdfHtml } from '../../utils/pdfTemplate';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { notifyManagersNewRequest, scheduleAbsenceReminder } from '../../utils/useNotifications';

interface FormData {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;   // ISO YYYY-MM-DD
  type: string;
  reason: string;
  propositionRemplacement: boolean;
  dateRemplacement: string;
  heureDebutRemplacement: string;
  heureFinRemplacement: string;
  salleRemplacement: string;
  classeRemplacement: string;
}

interface Errors {
  startDate?: string;
  endDate?: string;
  type?: string;
  reason?: string;
  document?: string;
  dateRemplacement?: string;
  heureDebutRemplacement?: string;
  heureFinRemplacement?: string;
  salleRemplacement?: string;
  classeRemplacement?: string;
}

interface SelectedDocument {
  uri: string;
  name: string;
  type: string;
  size: number;
}

export default function Request() {
    const router = useRouter();
    const [formData, setFormData] = useState<FormData>({
      startDate: '',
      endDate: '',
      type: '',
      reason: '',
      propositionRemplacement: false,
      dateRemplacement: '',
      heureDebutRemplacement: '',
      heureFinRemplacement: '',
      salleRemplacement: '',
      classeRemplacement: '',
    });
    const [errors, setErrors] = useState<Errors>({});
    const [loading, setLoading] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [types, setTypes] = useState<{ id: number; nom: string; needsCertificate: boolean }[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<SelectedDocument | null>(null);
  const [documentRequired, setDocumentRequired] = useState(false);
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showReplacementCalendarModal, setShowReplacementCalendarModal] = useState(false);
    const [showStartTimeModal, setShowStartTimeModal] = useState(false);
    const [showEndTimeModal, setShowEndTimeModal] = useState(false);
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [showClassModal, setShowClassModal] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [replacementMonth, setReplacementMonth] = useState(() => {
      const d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    // ========== SYSTÈME DE GESTION DES DATES ==========
    
    /**
     * Convertit un objet Date en format ISO (YYYY-MM-DD)
     * Ce format est utilisé pour le stockage et les comparaisons de dates
     * @param d - Objet Date JavaScript
     * @returns string - Date au format ISO (ex: "2025-09-25")
     */
    const toISO = (d: Date) => d.toISOString().slice(0, 10);
    
    /**
     * Convertit une date ISO en format d'affichage français (DD/MM/YYYY)
     * Ajoute 'T00:00:00' pour forcer l'heure à minuit et éviter les décalages timezone
     * @param iso - Date au format ISO (ex: "2025-09-25")
     * @returns string - Date formatée pour l'affichage français (ex: "25/09/2025")
     */
    const formatDisplay = (iso?: string) => {
      if (!iso) return '';
      const d = new Date(iso + 'T00:00:00'); // Force l'heure à minuit pour éviter les décalages
      return d.toLocaleDateString('fr-FR');
    };

    /**
     * Ajoute ou soustrait des mois à une date pour la navigation du calendrier
     * Retourne toujours le 1er jour du mois résultant
     * @param date - Date de base
     * @param months - Nombre de mois à ajouter (peut être négatif)
     * @returns Date - Premier jour du mois résultant
     */
    const addMonths = (date: Date, months: number) => {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    };

    /**
     * Trouve le lundi de la semaine contenant la date donnée
     * Utilisé pour aligner le calendrier sur les semaines commençant le lundi
     * @param date - Date de référence
     * @returns Date - Lundi de la semaine (heure mise à 00:00:00)
     */
    const startOfWeekMonday = (date: Date) => {
      const d = new Date(date);
      const day = d.getDay(); // 0=Dimanche, 1=Lundi, ..., 6=Samedi
      const diff = (day === 0 ? -6 : 1 - day); // Calcul du décalage vers le lundi
      d.setDate(d.getDate() + diff);
      d.setHours(0,0,0,0);
      return d;
    };


    /**
     * Retourne le premier jour du mois pour une date donnée
     */
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
    
    /**
     * Retourne le dernier jour du mois pour une date donnée
     */
    const lastDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth()+1, 0);

    type WeekRow = Date[]; // Une semaine = tableau de 5 dates (Lun-Ven)
    
    /**
     * GÉNÉRATION DU CALENDRIER - JOURS OUVRÉS UNIQUEMENT
     * 
     * Ce calendrier ne montre que les jours de semaine (Lundi à Vendredi).
     * Il organise les dates en semaines de 5 jours, ce qui correspond aux jours 
     * travaillés dans un contexte professionnel.
     * 
     * Structure: 
     * - Chaque semaine = 5 dates (Lun, Mar, Mer, Jeu, Ven)
     * - Peut inclure des dates du mois précédent/suivant pour compléter les semaines
     * - Optimisé avec useMemo pour éviter les recalculs inutiles
     */
    const monthWeeks: WeekRow[] = useMemo(() => {
      // Délimitation du mois à afficher
      const first = firstDayOfMonth(currentMonth);  // 1er jour du mois
      const last = lastDayOfMonth(currentMonth);    // Dernier jour du mois
      
      // Point de départ : lundi de la première semaine du mois
      let cursor = startOfWeekMonday(first);
      
      // Point d'arrivée : vendredi de la dernière semaine du mois
      const end = (() => { 
        const monday = startOfWeekMonday(last); 
        const friday = new Date(monday); 
        friday.setDate(friday.getDate() + 4); // Lundi + 4 jours = Vendredi
        return friday; 
      })();
      
      const weeks: WeekRow[] = [];
      let row: WeekRow = [];
      
      // Parcours jour par jour de cursor à end
      while (cursor <= end) {
        const dow = cursor.getDay(); // Jour de la semaine (0=Dim, 1=Lun, ..., 6=Sam)
        
        if (dow >= 1 && dow <= 5) { // Lundi(1) à Vendredi(5) uniquement
          row.push(new Date(cursor));
          
          if (row.length === 5) { // Semaine complète (5 jours ouvrés)
            weeks.push(row);
            row = [];
          }
        }
        
        // Passage au jour suivant
        const next = new Date(cursor);
        next.setDate(cursor.getDate() + 1);
        cursor = next;
      }
      // Complétion de la dernière semaine si nécessaire
      if (row.length > 0) {
        // Complète les jours manquants pour avoir exactement 5 jours ouvrés
        while (row.length < 5) {
          const lastCell = row[row.length - 1];
          const next = new Date(lastCell);
          next.setDate(lastCell.getDate() + 1);
          
          // S'assurer que c'est un jour ouvré
          if (next.getDay() >= 1 && next.getDay() <= 5) {
            row.push(next);
          }
        }
        weeks.push(row);
      }
      return weeks;
  }, [currentMonth]);

    // Créneaux horaires disponibles (basés sur le planning scolaire)
    const availableTimes = useMemo(() => {
      return ['06:10', '07:10', '08:10', '09:25', '10:25', '11:25', '12:20', '13:00', '14:00', '15:00', '16:00', '16:55', '17:20', '18:10', '19:10'];
    }, []);

    // Salles disponibles
    const availableRooms = useMemo(() => {
      return ['801', '802', '803', '804', '811', '812', '813', '814', '821', '822', '823', '824'];
    }, []);

    // Classes disponibles
    const availableClasses = useMemo(() => {
      return ['BTS SIO 1', 'BTS SIO 2', 'BTS GPME 1', 'BTS GPME 2', 'BTS CG 1', 'BTS CG 2'];
    }, []);

    // Génération du calendrier pour le remplacement
    const replacementWeeks: WeekRow[] = useMemo(() => {
      const first = firstDayOfMonth(replacementMonth);
      const last = lastDayOfMonth(replacementMonth);
      let cursor = startOfWeekMonday(first);
      const end = (() => { 
        const monday = startOfWeekMonday(last); 
        const friday = new Date(monday); 
        friday.setDate(friday.getDate() + 4);
        return friday; 
      })();
      
      const weeks: WeekRow[] = [];
      let row: WeekRow = [];
      
      while (cursor <= end) {
        const dow = cursor.getDay();
        if (dow >= 1 && dow <= 5) {
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
        while (row.length < 5) {
          const lastCell = row[row.length - 1];
          const next = new Date(lastCell);
          next.setDate(lastCell.getDate() + 1);
          if (next.getDay() >= 1 && next.getDay() <= 5) {
            row.push(next);
          }
        }
        weeks.push(row);
      }
      return weeks;
  }, [replacementMonth]);

    // ========== FONCTIONS DE COMPARAISON DES DATES ==========
    
    /**
     * Vérifie si deux dates ISO sont identiques
     * @param a - Première date au format ISO
     * @param b - Seconde date au format ISO
     * @returns boolean - true si les dates sont identiques
     */
    const isSameDay = (a?: string, b?: string) => !!a && !!b && a === b;
    
    /**
     * Vérifie si une date est comprise entre deux autres (exclusif des bornes)
     * Utilise la comparaison lexicographique des chaînes ISO (YYYY-MM-DD)
     * @param iso - Date à tester
     * @param start - Date de début de la plage
     * @param end - Date de fin de la plage
     * @returns boolean - true si la date est dans la plage (exclusif)
     */
    const isBetween = (iso: string, start?: string, end?: string) => {
      if (!start || !end) return false;
      return iso > start && iso < end;
    };

    /**
     * LOGIQUE DE SÉLECTION DES DATES
     * 
     * Gère la sélection intelligente des plages de dates avec 3 cas :
     * 1. Aucune date sélectionnée -> définit la date de début
     * 2. Date de début seulement -> définit la date de fin (ou redémarre si antérieure)
     * 3. Plage complète -> redémarre une nouvelle sélection
     * 
     * Empêche la sélection de dates antérieures à aujourd'hui
     * 
     * @param date - Date cliquée dans le calendrier
     */
    const onSelectDate = (date: Date) => {
      const iso = toISO(date);
      const today = toISO(new Date());
      
      // Empêcher la sélection de dates passées
      if (iso < today) {
        return;
      }
      
      const { startDate, endDate } = formData;
      
      // CAS 1: Aucune date sélectionnée
      if (!startDate) {
        setFormData(prev => ({ ...prev, startDate: iso }));
        return;
      }
      
      // CAS 2: Date de début sélectionnée, pas de fin
      if (startDate && !endDate) {
        if (iso < startDate) {
          // Nouvelle date antérieure -> redémarre la sélection
          setFormData(prev => ({ ...prev, startDate: iso, endDate: '' }));
        } else if (iso === startDate) {
          // Même jour -> sélection d'une journée unique
          setFormData(prev => ({ ...prev, startDate: iso, endDate: iso }));
          setShowCalendarModal(false);
        } else {
          // Date postérieure -> complète la plage
          setFormData(prev => ({ ...prev, endDate: iso }));
          setShowCalendarModal(false);
        }
        return;
      }
      
      // CAS 3: Plage complète existante -> redémarre une nouvelle sélection
      setFormData(prev => ({ ...prev, startDate: iso, endDate: '' }));
    };

    useEffect(() => {
      let mounted = true;
      const loadTypes = async () => {
        setTypesLoading(true);
        try {
          const { data, error } = await supabase
            .from('absence_types')
            .select('id_absence_type, nom, necessite_certificat_medical')
            .eq('est_actif', true)
            .order('nom');
          if (error) throw error;
          if (!mounted) return;
          const list = (data || []).map((r: any) => ({ 
            id: r.id_absence_type as number, 
            nom: r.nom as string,
            needsCertificate: r.necessite_certificat_medical as boolean
          }));
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

      // Document si requis
      if (documentRequired && !selectedDocument) {
        newErrors.document = 'Un document justificatif est requis pour ce type d\'absence';
      }

      // Validation des champs de remplacement si proposition = OUI
      if (formData.propositionRemplacement) {
        if (!formData.dateRemplacement.trim()) {
          newErrors.dateRemplacement = 'La date de remplacement est requise';
        }
        if (!formData.heureDebutRemplacement.trim()) {
          newErrors.heureDebutRemplacement = 'L\'heure de début est requise';
        }
        if (!formData.heureFinRemplacement.trim()) {
          newErrors.heureFinRemplacement = 'L\'heure de fin est requise';
        }
        if (!formData.salleRemplacement.trim()) {
          newErrors.salleRemplacement = 'La salle est requise';
        }
        if (!formData.classeRemplacement.trim()) {
          newErrors.classeRemplacement = 'La classe concernée est requise';
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

  // ========== GESTION DU FORMULAIRE ==========
  // Note: Plus de saisie libre pour les dates (calendrier uniquement pour garantir la cohérence)

    // Mise à jour des champs
    const updateField = (field: keyof FormData, value: string | boolean) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field as keyof Errors]) {
        setErrors(prev => ({ ...prev, [field]: undefined }));
      }
    };

    // Sélection du type d'absence
    const selectType = (type: { id: number; nom: string; needsCertificate: boolean }) => {
      updateField('type', type.nom);
      setSelectedTypeId(type.id);
      setDocumentRequired(type.needsCertificate);
      setShowTypeModal(false);
      
      // Réinitialiser le document si le nouveau type n'en nécessite pas
      if (!type.needsCertificate) {
        setSelectedDocument(null);
        if (errors.document) {
          setErrors(prev => ({ ...prev, document: undefined }));
        }
      }
    };

    // Sélection de document
    const pickDocument = async () => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf'],
          copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setSelectedDocument({
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType || 'application/octet-stream',
            size: asset.size || 0,
          });
          
          // Effacer l'erreur de document si elle existe
          if (errors.document) {
            setErrors(prev => ({ ...prev, document: undefined }));
          }
        }
      } catch (error) {
        console.error('Erreur lors de la sélection du document:', error);
        Alert.alert('Erreur', 'Impossible de sélectionner le document');
      }
    };

    // Supprimer le document sélectionné
    const removeDocument = () => {
      setSelectedDocument(null);
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

          // Insérer la demande d'absence
          const { data: requestData, error: requestError } = await supabase
            .from('absence_requests')
            .insert({
              id_utilisateur: user.id,
              id_type_absence: selectedTypeId,
              date_debut: formData.startDate,
              date_fin: formData.endDate,
              motif: formData.reason,
              statut: 'en_attente',
              proposition_remplacement: formData.propositionRemplacement,
              date_remplacement: formData.propositionRemplacement ? formData.dateRemplacement : null,
              heure_debut_remplacement: formData.propositionRemplacement ? formData.heureDebutRemplacement : null,
              heure_fin_remplacement: formData.propositionRemplacement ? formData.heureFinRemplacement : null,
              salle_remplacement: formData.propositionRemplacement ? formData.salleRemplacement : null,
              classe_remplacement: formData.propositionRemplacement ? formData.classeRemplacement : null,
            })
            .select('id_absence_request')
            .single();
          
          if (requestError) throw requestError;

          // Récupérer le profil pour les notifications
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('nom_complet')
            .eq('id_profile', user.id)
            .single();

          // Notifier les gestionnaires de la nouvelle demande
          try {
            const typeName = types.find((t: { id: number; nom: string }) => t.id === selectedTypeId)?.nom || 'absence';
            await notifyManagersNewRequest(
              requestData.id_absence_request,
              userProfile?.nom_complet || 'Un employé',
              typeName,
              new Date(formData.startDate).toLocaleDateString('fr-FR')
            );
          } catch (notifError) {
            console.error('Erreur notification gestionnaires:', notifError);
          }

          // Planifier un rappel 1 jour avant l'absence (si approuvée, ce sera fait côté gestionnaire)
          try {
            const typeName = types.find((t: { id: number; nom: string }) => t.id === selectedTypeId)?.nom || 'absence';
            await scheduleAbsenceReminder(
              requestData.id_absence_request,
              formData.startDate,
              typeName,
              1 // 1 jour avant
            );
          } catch (reminderError) {
            console.error('Erreur planification rappel:', reminderError);
          }

          // Uploader le document si nécessaire
          if (selectedDocument && requestData) {
            const fileExt = selectedDocument.name.split('.').pop();
            const fileName = `${user.id}/${requestData.id_absence_request}_${Date.now()}.${fileExt}`;
            
            // Créer un FormData pour l'upload
            const formData = new FormData();
            formData.append('file', {
              uri: selectedDocument.uri,
              type: selectedDocument.type,
              name: selectedDocument.name,
            } as any);

            // Lire le fichier en ArrayBuffer
            const response = await fetch(selectedDocument.uri);
            const arrayBuffer = await response.arrayBuffer();
            const fileData = new Uint8Array(arrayBuffer);

            // Upload vers Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('absence-documents')
              .upload(fileName, fileData, {
                contentType: selectedDocument.type,
              });

            if (uploadError) throw uploadError;

            // Enregistrer les métadonnées du document
            const { error: docError } = await supabase
              .from('absence_documents')
              .insert({
                id_absence_request: requestData.id_absence_request,
                nom_fichier: selectedDocument.name,
                type_mime: selectedDocument.type,
                taille_octets: selectedDocument.size,
                url_fichier: uploadData.path,
              });

            if (docError) throw docError;
          }

          // Génération du PDF
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('nom_complet, role')
              .eq('id_profile', user.id)
              .single();

            const [nom, ...prenomParts] = (profile?.nom_complet || 'Inconnu').split(' ');
            const prenom = prenomParts.join(' ');

            // Chargement des images en base64 pour le PDF
            const loadBase64Image = async (module: any) => {
              try {
                const asset = Asset.fromModule(module);
                await asset.downloadAsync();
                if (!asset.localUri) return undefined;
                const base64 = await FileSystem.readAsStringAsync(asset.localUri, { encoding: 'base64' });
                const ext = asset.localUri.split('.').pop()?.toLowerCase();
                const mime = ext === 'png' ? 'image/png' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png');
                return `data:${mime};base64,${base64}`;
              } catch (e) {
                console.warn('Erreur chargement image PDF:', e);
                return undefined;
              }
            };

            const logoRfBase64 = await loadBase64Image(require('../../assets/images/Republique-francaise-logo.svg.png'));
            const logoLyceeBase64 = await loadBase64Image(require('../../assets/images/Logo LGT Baimbcho.jpg'));

            const pdfHtml = generatePdfHtml({
              nom: nom || '',
              prenom: prenom || '',
              grade: profile?.role || '',
              typeAbsence: 'autorisation', // Par défaut, à adapter selon la logique métier si besoin
              isPonctuel: formData.startDate === formData.endDate,
              dateDebut: formatDisplay(formData.startDate) || '',
              dateFin: formatDisplay(formData.endDate) || '',
              dateReprise: formatDisplay(formData.endDate) || '', // Simplification: reprise le lendemain de la fin ? Ou à saisir ?
              motif: formData.reason,
              piecesJointes: selectedDocument ? selectedDocument.name : 'Aucune',
              remplacement: formData.propositionRemplacement 
                ? `${formatDisplay(formData.dateRemplacement)} de ${formData.heureDebutRemplacement} à ${formData.heureFinRemplacement} - Salle ${formData.salleRemplacement} - Classe ${formData.classeRemplacement}`
                : 'Aucun remplacement proposé',
              dateDemande: new Date().toLocaleDateString('fr-FR'),
              logoRfBase64,
              logoLyceeBase64,
            });

            const { uri } = await printToFileAsync({ html: pdfHtml });
            
            // Uploader le PDF automatiquement dans Supabase
            let pdfSaved = false;
            try {
              // Lire le PDF généré
              const pdfBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
              const pdfData = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
              
              // Générer un nom de fichier unique
              const pdfFileName = `${user.id}/${requestData.id_absence_request}_recapitulatif_${Date.now()}.pdf`;
              
              // Upload vers Supabase Storage
              const { data: pdfUploadData, error: pdfUploadError } = await supabase.storage
                .from('absence-documents')
                .upload(pdfFileName, pdfData, {
                  contentType: 'application/pdf',
                });

              if (pdfUploadError) {
                console.error('Erreur upload PDF:', pdfUploadError);
              } else {
                // Enregistrer les métadonnées du PDF
                const { error: pdfDocError } = await supabase
                  .from('absence_documents')
                  .insert({
                    id_absence_request: requestData.id_absence_request,
                    nom_fichier: `Récapitulatif_${formData.startDate}_${formData.endDate}.pdf`,
                    type_mime: 'application/pdf',
                    taille_octets: pdfData.length,
                    url_fichier: pdfUploadData.path,
                  });

                if (pdfDocError) {
                  console.error('Erreur enregistrement métadonnées PDF:', pdfDocError);
                } else {
                  pdfSaved = true;
                  console.log('PDF sauvegardé avec succès');
                }
              }
            } catch (uploadErr) {
              console.error('Erreur sauvegarde PDF:', uploadErr);
            }
            
            Alert.alert(
              'Demande soumise',
              pdfSaved 
                ? 'Votre demande d\'absence a été envoyée et le récapitulatif PDF a été sauvegardé. Voulez-vous aussi le télécharger ?'
                : 'Votre demande d\'absence a été envoyée avec succès. Voulez-vous télécharger le justificatif PDF ?',
              [
                { 
                  text: 'Non', 
                  onPress: () => router.back(),
                  style: 'cancel'
                },
                { 
                  text: 'Oui, télécharger', 
                  onPress: async () => {
                    await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
                    router.back();
                  } 
                }
              ]
            );
          } catch (pdfError) {
            console.error('Erreur génération PDF:', pdfError);
            // Fallback si erreur PDF mais succès soumission
            Alert.alert('Demande soumise', 'Votre demande a été envoyée, mais le PDF n\'a pas pu être généré.', [
              { text: 'OK', onPress: () => router.back() }
            ]);
          }

          // Réinitialiser le formulaire
          setFormData({ startDate: '', endDate: '', type: '', reason: '', propositionRemplacement: false, dateRemplacement: '', heureDebutRemplacement: '', heureFinRemplacement: '', salleRemplacement: '', classeRemplacement: '' });
          setSelectedTypeId(null);
          setSelectedDocument(null);
          setDocumentRequired(false);
          setErrors({});
        } catch (e) {
          console.error('Erreur soumission:', e);
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

              {/* Document justificatif (si requis) */}
              {documentRequired && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>
                    Document justificatif <Text style={{ color: '#e74c3c' }}>*</Text>
                  </Text>
                  <Text style={styles.documentHint}>
                    Un certificat médical est requis pour ce type d&apos;absence
                  </Text>
                  
                  {!selectedDocument ? (
                    <TouchableOpacity
                      style={[styles.documentButton, errors.document && styles.inputError]}
                      onPress={pickDocument}
                    >
                      <Ionicons name="document-attach-outline" size={24} color="#3498db" />
                      <Text style={styles.documentButtonText}>Choisir un document</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.documentPreview, errors.document && styles.inputError]}>
                      <View style={styles.documentInfo}>
                        <Ionicons name="document-text-outline" size={20} color="#27ae60" />
                        <View style={styles.documentDetails}>
                          <Text style={styles.documentName} numberOfLines={1}>
                            {selectedDocument.name}
                          </Text>
                          <Text style={styles.documentSize}>
                            {(selectedDocument.size / 1024 / 1024).toFixed(2)} MB
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity onPress={removeDocument} style={styles.removeDocumentButton}>
                        <Ionicons name="close-circle" size={24} color="#e74c3c" />
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {errors.document && (
                    <Text style={styles.errorText}>{errors.document}</Text>
                  )}
                </View>
              )}

              {/* Proposition de remplacement */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Proposition de remplacement ?</Text>
                <View style={styles.replacementChoiceContainer}>
                  <TouchableOpacity
                    style={[
                      styles.choiceButton,
                      formData.propositionRemplacement && styles.choiceButtonActive
                    ]}
                    onPress={() => updateField('propositionRemplacement', true)}
                  >
                    <Text style={[
                      styles.choiceButtonText,
                      formData.propositionRemplacement && styles.choiceButtonTextActive
                    ]}>OUI</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.choiceButton,
                      !formData.propositionRemplacement && styles.choiceButtonActive
                    ]}
                    onPress={() => updateField('propositionRemplacement', false)}
                  >
                    <Text style={[
                      styles.choiceButtonText,
                      !formData.propositionRemplacement && styles.choiceButtonTextActive
                    ]}>NON</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Détails du remplacement (si OUI) */}
              {formData.propositionRemplacement && (
                <>
                  {/* Date de remplacement */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Date de remplacement</Text>
                    <TouchableOpacity
                      style={[styles.input, errors.dateRemplacement && styles.inputError, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                      onPress={() => setShowReplacementCalendarModal(true)}
                    >
                      <Text style={styles.inputText}>{formatDisplay(formData.dateRemplacement) || 'Sélectionner une date'}</Text>
                      <Ionicons name="calendar-outline" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                    {errors.dateRemplacement && (
                      <Text style={styles.errorText}>{errors.dateRemplacement}</Text>
                    )}
                  </View>

                  {/* Heure de début */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Heure de début</Text>
                    <TouchableOpacity
                      style={[styles.dropdown, errors.heureDebutRemplacement && styles.inputError]}
                      onPress={() => setShowStartTimeModal(true)}
                    >
                      <Text style={[
                        styles.dropdownText,
                        !formData.heureDebutRemplacement && styles.placeholderText
                      ]}>
                        {formData.heureDebutRemplacement || "-- Sélectionnez l'heure de début --"}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                    {errors.heureDebutRemplacement && (
                      <Text style={styles.errorText}>{errors.heureDebutRemplacement}</Text>
                    )}
                  </View>

                  {/* Heure de fin */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Heure de fin</Text>
                    <TouchableOpacity
                      style={[styles.dropdown, errors.heureFinRemplacement && styles.inputError]}
                      onPress={() => setShowEndTimeModal(true)}
                    >
                      <Text style={[
                        styles.dropdownText,
                        !formData.heureFinRemplacement && styles.placeholderText
                      ]}>
                        {formData.heureFinRemplacement || "-- Sélectionnez l'heure de fin --"}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                    {errors.heureFinRemplacement && (
                      <Text style={styles.errorText}>{errors.heureFinRemplacement}</Text>
                    )}
                  </View>

                  {/* Salle */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Salle</Text>
                    <TouchableOpacity
                      style={[styles.dropdown, errors.salleRemplacement && styles.inputError]}
                      onPress={() => setShowRoomModal(true)}
                    >
                      <Text style={[
                        styles.dropdownText,
                        !formData.salleRemplacement && styles.placeholderText
                      ]}>
                        {formData.salleRemplacement || "-- Sélectionnez une salle --"}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                    {errors.salleRemplacement && (
                      <Text style={styles.errorText}>{errors.salleRemplacement}</Text>
                    )}
                  </View>

                  {/* Classe concernée */}
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Classe concernée</Text>
                    <TouchableOpacity
                      style={[styles.dropdown, errors.classeRemplacement && styles.inputError]}
                      onPress={() => setShowClassModal(true)}
                    >
                      <Text style={[
                        styles.dropdownText,
                        !formData.classeRemplacement && styles.placeholderText
                      ]}>
                        {formData.classeRemplacement || "-- Sélectionnez une classe --"}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                    {errors.classeRemplacement && (
                      <Text style={styles.errorText}>{errors.classeRemplacement}</Text>
                    )}
                  </View>
                </>
              )}

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
                  <ScrollView style={{ maxHeight: 400 }}>
                    {types.map((type) => (
                      <TouchableOpacity
                        key={type.id}
                        style={styles.modalOption}
                        onPress={() => selectType(type)}
                      >
                        <View style={styles.typeOptionContent}>
                          <Text style={styles.modalOptionText}>{type.nom}</Text>
                          {type.needsCertificate && (
                            <View style={styles.certificateRequired}>
                              <Ionicons name="document-text" size={14} color="#f39c12" />
                              <Text style={styles.certificateText}>Certificat requis</Text>
                            </View>
                          )}
                        </View>
                        {selectedTypeId === type.id && (
                          <Ionicons name="checkmark" size={20} color="#3498db" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
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
                        const today = toISO(new Date());
                        const isPast = iso < today;
                        const inMonth = date.getMonth() === currentMonth.getMonth();
                        const isStart = isSameDay(iso, formData.startDate);
                        const isEnd = isSameDay(iso, formData.endDate);
                        const inRange = isBetween(iso, formData.startDate, formData.endDate);
                        
                        let bg, color, opacity = 1;
                        
                        if (isPast) {
                          // Jours passés - grisés et non cliquables
                          bg = '#f8f9fa';
                          color = '#bdc3c7';
                          opacity = 0.5;
                        } else if (isStart || isEnd) {
                          // Dates sélectionnées
                          bg = '#3498db';
                          color = 'white';
                        } else if (inRange) {
                          // Dans la plage sélectionnée
                          bg = '#d6eaff';
                          color = '#2c3e50';
                        } else if (inMonth) {
                          // Jours du mois courant
                          bg = 'white';
                          color = '#2c3e50';
                        } else {
                          // Jours des mois adjacents
                          bg = '#ecf0f1';
                          color = '#2c3e50';
                        }
                        
                        return (
                          <TouchableOpacity
                            key={di}
                            style={{ 
                              width: 52, 
                              height: 44, 
                              borderRadius: 8, 
                              backgroundColor: bg, 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              borderWidth: 1, 
                              borderColor: '#e9ecef',
                              opacity 
                            }}
                            onPress={() => !isPast && onSelectDate(date)}
                            disabled={isPast}
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

          {/* Modal calendrier de remplacement */}
          <Modal
            visible={showReplacementCalendarModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowReplacementCalendarModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { paddingHorizontal: 12 }]}> 
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <TouchableOpacity onPress={() => setReplacementMonth(prev => addMonths(prev, -1))} style={{ padding: 8 }}>
                    <Ionicons name="chevron-back" size={20} color="#2c3e50" />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#2c3e50' }}>
                    {replacementMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </Text>
                  <TouchableOpacity onPress={() => setReplacementMonth(prev => addMonths(prev, 1))} style={{ padding: 8 }}>
                    <Ionicons name="chevron-forward" size={20} color="#2c3e50" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 }}>
                  {['Lun','Mar','Mer','Jeu','Ven'].map((d) => (
                    <Text key={d} style={{ width: 52, textAlign: 'center', color: '#7f8c8d', fontWeight: '600' }}>{d}</Text>
                  ))}
                </View>

                <ScrollView style={{ maxHeight: 320 }}>
                  {replacementWeeks.map((week, wi) => (
                    <View key={wi} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      {week.map((date, di) => {
                        const iso = toISO(date);
                        const today = toISO(new Date());
                        const isPast = iso < today;
                        const inMonth = date.getMonth() === replacementMonth.getMonth();
                        const isSelected = iso === formData.dateRemplacement;
                        
                        let bg, color, opacity = 1;
                        
                        if (isPast) {
                          bg = '#f8f9fa';
                          color = '#bdc3c7';
                          opacity = 0.5;
                        } else if (isSelected) {
                          bg = '#3498db';
                          color = 'white';
                        } else if (inMonth) {
                          bg = 'white';
                          color = '#2c3e50';
                        } else {
                          bg = '#ecf0f1';
                          color = '#2c3e50';
                        }
                        
                        return (
                          <TouchableOpacity
                            key={di}
                            style={{ 
                              width: 52, 
                              height: 44, 
                              borderRadius: 8, 
                              backgroundColor: bg, 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              borderWidth: 1, 
                              borderColor: '#e9ecef',
                              opacity 
                            }}
                            onPress={() => {
                              if (!isPast) {
                                updateField('dateRemplacement', iso);
                                setShowReplacementCalendarModal(false);
                              }
                            }}
                            disabled={isPast}
                          >
                            <Text style={{ color, fontWeight: '600' }}>{date.getDate()}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                  <TouchableOpacity style={[styles.modalCancelButton, { flex: 1, marginRight: 8, backgroundColor: '#bdc3c7', borderWidth: 0 }]} onPress={() => setShowReplacementCalendarModal(false)}>
                    <Text style={styles.modalCancelText}>Fermer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalCancelButton, { flex: 1 }]}
                    onPress={() => setShowReplacementCalendarModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Valider</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Modal sélection de l'heure de début */}
          <Modal
            visible={showStartTimeModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowStartTimeModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Heure de début</Text>
                
                <ScrollView style={{ maxHeight: 400 }}>
                  {availableTimes.map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={styles.modalOption}
                      onPress={() => {
                        updateField('heureDebutRemplacement', time);
                        setShowStartTimeModal(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{time}</Text>
                      {formData.heureDebutRemplacement === time && (
                        <Ionicons name="checkmark" size={20} color="#3498db" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowStartTimeModal(false)}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Modal sélection de l'heure de fin */}
          <Modal
            visible={showEndTimeModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowEndTimeModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Heure de fin</Text>
                
                <ScrollView style={{ maxHeight: 400 }}>
                  {availableTimes.map((time) => (
                    <TouchableOpacity
                      key={time}
                      style={styles.modalOption}
                      onPress={() => {
                        updateField('heureFinRemplacement', time);
                        setShowEndTimeModal(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{time}</Text>
                      {formData.heureFinRemplacement === time && (
                        <Ionicons name="checkmark" size={20} color="#3498db" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowEndTimeModal(false)}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Modal sélection de la salle */}
          <Modal
            visible={showRoomModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowRoomModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Salle</Text>
                
                <ScrollView style={{ maxHeight: 400 }}>
                  {availableRooms.map((room) => (
                    <TouchableOpacity
                      key={room}
                      style={styles.modalOption}
                      onPress={() => {
                        updateField('salleRemplacement', room);
                        setShowRoomModal(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>Salle {room}</Text>
                      {formData.salleRemplacement === room && (
                        <Ionicons name="checkmark" size={20} color="#3498db" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowRoomModal(false)}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Modal sélection de la classe */}
          <Modal
            visible={showClassModal}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setShowClassModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Classe concernée</Text>
                
                <ScrollView style={{ maxHeight: 400 }}>
                  {availableClasses.map((classe) => (
                    <TouchableOpacity
                      key={classe}
                      style={styles.modalOption}
                      onPress={() => {
                        updateField('classeRemplacement', classe);
                        setShowClassModal(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{classe}</Text>
                      {formData.classeRemplacement === classe && (
                        <Ionicons name="checkmark" size={20} color="#3498db" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowClassModal(false)}
                >
                  <Text style={styles.modalCancelText}>Annuler</Text>
                </TouchableOpacity>
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
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e9ecef',
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
    // Styles pour les documents
    documentHint: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 12,
        fontStyle: 'italic',
    },
    documentButton: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        borderWidth: 1,
        borderColor: '#e9ecef',
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    documentButtonText: {
        fontSize: 16,
        color: '#3498db',
        fontWeight: '500',
    },
    documentPreview: {
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#e9ecef',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    documentInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    documentDetails: {
        flex: 1,
    },
    documentName: {
        fontSize: 16,
        color: '#2c3e50',
        fontWeight: '500',
        marginBottom: 2,
    },
    documentSize: {
        fontSize: 14,
        color: '#7f8c8d',
    },
    removeDocumentButton: {
        padding: 4,
    },
    // Styles pour les options de type avec certificat
    typeOptionContent: {
        flex: 1,
        marginRight: 8,
    },
    certificateRequired: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        paddingTop: 4,
        gap: 6,
    },
    certificateText: {
        fontSize: 11,
        color: '#f39c12',
        fontWeight: '600',
    },
    // Styles pour la proposition de remplacement
    replacementChoiceContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    choiceButton: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e9ecef',
    },
    choiceButtonActive: {
        backgroundColor: '#e3f2fd',
        borderColor: '#3498db',
    },
    choiceButtonText: {
        fontSize: 16,
        color: '#7f8c8d',
        fontWeight: '600',
    },
    choiceButtonTextActive: {
        color: '#3498db',
    },
});