import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, TextInput, Modal, Alert, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../../utils/supabase';

type Detail = {
  id: number;
  type: string;
  statut: string;
  date_debut: string;
  date_fin: string;
  motif: string | null;
  date_creation?: string | null;
  date_modification?: string | null;
  proposition_remplacement?: boolean | null;
  date_remplacement?: string | null;
  heure_debut_remplacement?: string | null;
  heure_fin_remplacement?: string | null;
  salle_remplacement?: string | null;
  classe_remplacement?: string | null;
};

const statusToMeta = (statut: string) => {
  switch (statut) {
    case 'en_attente':
      return { label: 'En attente', color: '#f39c12' };
    case 'approuve':
      return { label: 'Approuvé', color: '#27ae60' };
    case 'rejete':
      return { label: 'Rejeté', color: '#e74c3c' };
    case 'annule':
      return { label: 'Annulé', color: '#7f8c8d' };
    default:
      return { label: statut, color: '#7f8c8d' };
  }
};

const fmtDate = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const fmtRange = (startISO: string, endISO: string) => {
  try {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(start)} → ${fmt(end)}`;
  } catch {
    return `${startISO} → ${endISO}`;
  }
};

const countBusinessDays = (startISO: string, endISO: string) => {
  if (!startISO || !endISO) return 0;
  const start = new Date(startISO + 'T00:00:00');
  const end = new Date(endISO + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

// Constantes pour les champs de remplacement
const availableTimes = ['06:10','07:10','08:10','09:25','10:25','11:25','12:20','13:00','14:00','15:00','16:00','16:55','17:20','18:10','19:10'];
const availableRooms = ['801','802','803','804','811','812','813','814','821','822','823','824'];
const availableClasses = ['BTS SIO 1','BTS SIO 2','BTS GPME 1','BTS GPME 2','BTS CG 1','BTS CG 2'];

export default function RequestDetails() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const idParam = params.id as string | undefined;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  // Edition
  const [editing, setEditing] = useState(false);
  const [types, setTypes] = useState<{ id: number; nom: string }[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [typeLabel, setTypeLabel] = useState('');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  // États pour les champs de remplacement
  const [propositionRemplacement, setPropositionRemplacement] = useState(false);
  const [dateRemplacement, setDateRemplacement] = useState('');
  const [heureDebutRemplacement, setHeureDebutRemplacement] = useState('');
  const [heureFinRemplacement, setHeureFinRemplacement] = useState('');
  const [salleRemplacement, setSalleRemplacement] = useState('');
  const [classeRemplacement, setClasseRemplacement] = useState('');
  const [showReplacementCalendar, setShowReplacementCalendar] = useState(false);
  const [replacementMonth, setReplacementMonth] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const isMountedRef = useRef(true);
  const initialRef = useRef<{ typeId: number | null; typeLabel: string; reason: string; startDate: string; endDate: string }>({ typeId: null, typeLabel: '', reason: '', startDate: '', endDate: '' });
  const [documents, setDocuments] = useState<{ id: number; nom_fichier: string; type_mime: string; url_fichier: string; taille_octets: number }[]>([]);
  const [newDocument, setNewDocument] = useState<{ uri: string; name: string; type: string; size: number } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (!idParam) { setError('Identifiant manquant'); setLoading(false); return; }
    const id = Number(idParam);
    if (Number.isNaN(id)) { setError('Identifiant invalide'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      // Optionnel: vérifier session
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userRes?.user;
      if (!user) throw new Error('Aucune session utilisateur.');

      const { data, error } = await supabase
        .from('absence_requests')
        .select('id_absence_request, date_debut, date_fin, statut, motif, date_creation, date_modification, proposition_remplacement, date_remplacement, heure_debut_remplacement, heure_fin_remplacement, salle_remplacement, classe_remplacement, absence_types ( nom, id_absence_type )')
        .eq('id_absence_request', id)
        .single();
      if (error) throw error;

      // Récupérer les documents associés
      const { data: docsData, error: docsError } = await supabase
        .from('absence_documents')
        .select('id_document, nom_fichier, type_mime, url_fichier, taille_octets')
        .eq('id_absence_request', id);
      
      if (docsError) console.error('Erreur chargement documents:', docsError);

      const row: any = data;
      const d: Detail = {
        id: row.id_absence_request,
        type: row.absence_types?.nom ?? 'Type inconnu',
        statut: row.statut,
        date_debut: row.date_debut,
        date_fin: row.date_fin,
        motif: row.motif ?? null,
        date_creation: row.date_creation ?? null,
        date_modification: row.date_modification ?? null,
        proposition_remplacement: row.proposition_remplacement ?? null,
        date_remplacement: row.date_remplacement ?? null,
        heure_debut_remplacement: row.heure_debut_remplacement ?? null,
        heure_fin_remplacement: row.heure_fin_remplacement ?? null,
        salle_remplacement: row.salle_remplacement ?? null,
        classe_remplacement: row.classe_remplacement ?? null,
      };
      if (isMountedRef.current) {
        setDetail(d);
        setTypeId(row.absence_types?.id_absence_type ?? null);
        setTypeLabel(row.absence_types?.nom ?? '');
        setReason(row.motif ?? '');
        setStartDate(row.date_debut);
        setEndDate(row.date_fin);
        setPropositionRemplacement(row.proposition_remplacement ?? false);
        setDateRemplacement(row.date_remplacement ?? '');
        setHeureDebutRemplacement(row.heure_debut_remplacement ?? '');
        setHeureFinRemplacement(row.heure_fin_remplacement ?? '');
        setSalleRemplacement(row.salle_remplacement ?? '');
        setClasseRemplacement(row.classe_remplacement ?? '');
        setDocuments((docsData || []).map(doc => ({
          id: doc.id_document,
          nom_fichier: doc.nom_fichier,
          type_mime: doc.type_mime,
          url_fichier: doc.url_fichier,
          taille_octets: doc.taille_octets,
        })));
        initialRef.current = {
          typeId: row.absence_types?.id_absence_type ?? null,
          typeLabel: row.absence_types?.nom ?? '',
          reason: row.motif ?? '',
          startDate: row.date_debut,
          endDate: row.date_fin,
        };
      }
    } catch (e: any) {
      if (isMountedRef.current) setError(e?.message ?? 'Erreur lors du chargement');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [idParam]);

  useEffect(() => { load(); }, [load]);

  // Charger les types d'absence actifs pour l'édition
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setTypesLoading(true);
      try {
        const { data, error } = await supabase
          .from('absence_types')
          .select('id_absence_type, nom')
          .eq('est_actif', true)
          .order('nom');
        if (error) throw error;
        if (mounted) {
          const list = (data || []).map((r: any) => ({ id: r.id_absence_type as number, nom: r.nom as string }));
          setTypes(list);
        }
      } catch {
        // noop
      } finally {
        if (mounted) setTypesLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, []);

  const meta = statusToMeta(detail?.statut || '');
  const wd = detail ? countBusinessDays(detail.date_debut, detail.date_fin) : 0;

  // Outils calendrier (jours ouvrés)
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const startOfWeekMonday = (date: Date) => { const d = new Date(date); const day = d.getDay(); const diff = (day === 0 ? -6 : 1 - day); d.setDate(d.getDate() + diff); d.setHours(0,0,0,0); return d; };
  const addMonths = (date: Date, months: number) => { const d = new Date(date); d.setMonth(d.getMonth() + months); return new Date(d.getFullYear(), d.getMonth(), 1); };
  type WeekRow = Date[];
  const monthWeeks: WeekRow[] = useMemo(() => {
    const first = firstDayOfMonth(currentMonth);
    const last = lastDayOfMonth(currentMonth);
    let cursor = startOfWeekMonday(first);
    const end = (() => { const monday = startOfWeekMonday(last); const friday = new Date(monday); friday.setDate(friday.getDate() + 4); return friday; })();
    const weeks: WeekRow[] = []; let row: WeekRow = [];
    while (cursor <= end) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) {
        row.push(new Date(cursor));
        if (row.length === 5) { weeks.push(row); row = []; }
      }
      const next = new Date(cursor); next.setDate(cursor.getDate() + 1); cursor = next;
    }
    if (row.length > 0) {
      while (row.length < 5) { const lastCell = row[row.length - 1]; const next = new Date(lastCell); next.setDate(lastCell.getDate() + 1); if (next.getDay() >= 1 && next.getDay() <= 5) row.push(next); }
      weeks.push(row);
    }
    return weeks;
  }, [currentMonth]);
  
  // Calendrier pour les remplacements
  const replacementWeeks: WeekRow[] = useMemo(() => {
    const first = firstDayOfMonth(replacementMonth);
    const last = lastDayOfMonth(replacementMonth);
    let cursor = startOfWeekMonday(first);
    const end = (() => { const monday = startOfWeekMonday(last); const friday = new Date(monday); friday.setDate(friday.getDate() + 4); return friday; })();
    const weeks: WeekRow[] = []; let row: WeekRow = [];
    while (cursor <= end) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) {
        row.push(new Date(cursor));
        if (row.length === 5) { weeks.push(row); row = []; }
      }
      const next = new Date(cursor); next.setDate(cursor.getDate() + 1); cursor = next;
    }
    if (row.length > 0) {
      while (row.length < 5) { const lastCell = row[row.length - 1]; const next = new Date(lastCell); next.setDate(lastCell.getDate() + 1); if (next.getDay() >= 1 && next.getDay() <= 5) row.push(next); }
      weeks.push(row);
    }
    return weeks;
  }, [replacementMonth]);
  
  const formatDisplay = (iso?: string) => { if (!iso) return ''; const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('fr-FR'); };
  const isSameDay = (a?: string, b?: string) => !!a && !!b && a === b;
  const isBetween = (iso: string, start?: string, end?: string) => { if (!start || !end) return false; return iso > start && iso < end; };
  const isDateValid = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today;
  };

  const onSelectDate = (date: Date) => {
    const iso = toISO(date);
    
    // Vérifier si la date est valide (pas antérieure à aujourd'hui)
    if (!isDateValid(date)) {
      Alert.alert(
        "Date invalide",
        "Vous ne pouvez pas sélectionner une date antérieure à aujourd'hui."
      );
      return;
    }

    if (!startDate) { 
      setStartDate(iso); 
      return; 
    }

    if (startDate && !endDate) {
      if (iso < startDate) { 
        setStartDate(iso); 
        setEndDate(''); 
      }
      else if (iso === startDate) { 
        setStartDate(iso); 
        setEndDate(iso); 
        setShowCalendar(false); 
      }
      else { 
        setEndDate(iso); 
        setShowCalendar(false); 
      }
      return;
    }
    setStartDate(iso); 
    setEndDate('');
  };

  const onSelectReplacementDate = (date: Date) => {
    const iso = toISO(date);
    
    // Vérifier si la date est valide (pas antérieure à aujourd'hui)
    if (!isDateValid(date)) {
      Alert.alert(
        "Date invalide",
        "Vous ne pouvez pas sélectionner une date antérieure à aujourd'hui."
      );
      return;
    }

    setDateRemplacement(iso);
    setShowReplacementCalendar(false);
  };

  const canEdit = detail?.statut === 'en_attente';
  const [saving, setSaving] = useState(false);
  const isDirty = useCallback(() => {
    const init = initialRef.current;
    return (
      init.typeId !== typeId ||
      (init.reason || '').trim() !== (reason || '').trim() ||
      init.startDate !== startDate ||
      init.endDate !== endDate
    );
  }, [typeId, reason, startDate, endDate]);

  const resetEdits = () => {
    const init = initialRef.current;
    setTypeId(init.typeId);
    setTypeLabel(init.typeLabel);
    setReason(init.reason);
    setStartDate(init.startDate);
    setEndDate(init.endDate);
    setPropositionRemplacement(detail?.proposition_remplacement ?? false);
    setDateRemplacement(detail?.date_remplacement ?? '');
    setHeureDebutRemplacement(detail?.heure_debut_remplacement ?? '');
    setHeureFinRemplacement(detail?.heure_fin_remplacement ?? '');
    setSalleRemplacement(detail?.salle_remplacement ?? '');
    setClasseRemplacement(detail?.classe_remplacement ?? '');
    setNewDocument(null);
  };

  // Fonctions pour gérer les documents
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setNewDocument({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
          size: asset.size || 0,
        });
      }
    } catch (error) {
      console.error('Erreur sélection document:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le document');
    }
  };

  const viewDocument = async (doc: { url_fichier: string; nom_fichier: string }) => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) return;

      const { data, error } = await supabase.storage
        .from('absence-documents')
        .createSignedUrl(doc.url_fichier, 3600);

      if (error) throw error;

      if (data?.signedUrl) {
        // Ouvrir le document dans le navigateur
        const supported = await Linking.canOpenURL(data.signedUrl);
        
        if (supported) {
          await Linking.openURL(data.signedUrl);
        } else {
          Alert.alert(
            'Document',
            `${doc.nom_fichier}\n\nImpossible d'ouvrir automatiquement le document.`,
            [
              { text: 'Fermer', style: 'cancel' },
              { text: 'Copier URL', onPress: () => console.log('URL:', data.signedUrl) }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Erreur accès document:', error);
      Alert.alert('Erreur', 'Impossible d\'accéder au document');
    }
  };

  const deleteDocument = async (docId: number) => {
    if (!canEdit) return;
    
    Alert.alert(
      'Supprimer le document',
      'Êtes-vous sûr de vouloir supprimer ce document ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const doc = documents.find(d => d.id === docId);
              if (!doc) return;

              // Supprimer du storage
              const { error: storageError } = await supabase.storage
                .from('absence-documents')
                .remove([doc.url_fichier]);

              if (storageError) console.error('Erreur suppression storage:', storageError);

              // Supprimer de la BDD
              const { error: dbError } = await supabase
                .from('absence_documents')
                .delete()
                .eq('id_document', docId);

              if (dbError) throw dbError;

              await load();
              Alert.alert('Succès', 'Document supprimé');
            } catch (error) {
              console.error('Erreur suppression document:', error);
              Alert.alert('Erreur', 'Impossible de supprimer le document');
            }
          }
        }
      ]
    );
  };

  const onSave = async () => {
    if (!canEdit || !detail) return;
    if (!startDate || !endDate) { alert('Veuillez sélectionner une période'); return; }
    if (!typeId) { alert("Veuillez choisir un type d'absence"); return; }
    if (!reason.trim()) { alert('Veuillez saisir un motif'); return; }
    
    // Validation des champs de remplacement
    if (propositionRemplacement) {
      if (!dateRemplacement) { alert('Veuillez sélectionner une date de remplacement'); return; }
      if (!heureDebutRemplacement) { alert('Veuillez sélectionner une heure de début'); return; }
      if (!heureFinRemplacement) { alert('Veuillez sélectionner une heure de fin'); return; }
      if (!salleRemplacement) { alert('Veuillez sélectionner une salle'); return; }
      if (!classeRemplacement) { alert('Veuillez sélectionner une classe'); return; }
    }
    
    setSaving(true);
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userRes?.user; if (!user) throw new Error('Aucune session utilisateur');
      
      // Mettre à jour la demande
      const { error } = await supabase
        .from('absence_requests')
        .update({
          id_type_absence: typeId,
          date_debut: startDate,
          date_fin: endDate,
          motif: reason,
          proposition_remplacement: propositionRemplacement,
          date_remplacement: propositionRemplacement ? dateRemplacement : null,
          heure_debut_remplacement: propositionRemplacement ? heureDebutRemplacement : null,
          heure_fin_remplacement: propositionRemplacement ? heureFinRemplacement : null,
          salle_remplacement: propositionRemplacement ? salleRemplacement : null,
          classe_remplacement: propositionRemplacement ? classeRemplacement : null,
        })
        .eq('id_absence_request', detail.id)
        .eq('id_utilisateur', user.id);
      if (error) throw error;

      // Uploader le nouveau document si présent
      if (newDocument) {
        const fileExt = newDocument.name.split('.').pop();
        const fileName = `${user.id}/${detail.id}_${Date.now()}.${fileExt}`;
        
        const response = await fetch(newDocument.uri);
        const arrayBuffer = await response.arrayBuffer();
        const fileData = new Uint8Array(arrayBuffer);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('absence-documents')
          .upload(fileName, fileData, {
            contentType: newDocument.type,
          });

        if (uploadError) throw uploadError;

        const { error: docError } = await supabase
          .from('absence_documents')
          .insert({
            id_absence_request: detail.id,
            nom_fichier: newDocument.name,
            type_mime: newDocument.type,
            taille_octets: newDocument.size,
            url_fichier: uploadData.path,
          });

        if (docError) throw docError;
      }

      await load();
      setEditing(false);
      setNewDocument(null);
    } catch (e: any) {
      alert(e?.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (editing && isDirty()) {
              Alert.alert(
                'Quitter sans sauvegarder ?',
                'Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter ?',
                [
                  { text: 'Continuer l\'édition', style: 'cancel' },
                  { text: 'Quitter', style: 'destructive', onPress: () => router.back() },
                ]
              );
            } else {
              router.back();
            }
          }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.title}>Détails de la demande</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0984e3" />
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && detail && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.type}>{editing ? 'Modifier la demande' : detail.type}</Text>
            <View style={[styles.badge, { backgroundColor: meta.color }]}>
              <Text style={styles.badgeText}>{meta.label}</Text>
            </View>
          </View>

          {!editing ? (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Période</Text>
                <Text style={styles.sectionValue}>{`${fmtRange(detail.date_debut, detail.date_fin)} · ${wd} j ouvrés`}</Text>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Motif</Text>
                <Text style={styles.sectionValue}>{detail.motif || '—'}</Text>
              </View>

              {/* Informations de remplacement */}
              {detail.proposition_remplacement && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Proposition de remplacement</Text>
                  <View style={{ marginTop: 8, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, borderWidth: 1, borderColor: '#e9ecef' }}>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: '#7f8c8d', fontSize: 12, marginBottom: 2 }}>Date</Text>
                      <Text style={{ color: '#2c3e50', fontSize: 14, fontWeight: '600' }}>{formatDisplay(detail.date_remplacement ?? undefined) || '—'}</Text>
                    </View>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: '#7f8c8d', fontSize: 12, marginBottom: 2 }}>Heure</Text>
                      <Text style={{ color: '#2c3e50', fontSize: 14, fontWeight: '600' }}>{`${detail.heure_debut_remplacement || '—'} - ${detail.heure_fin_remplacement || '—'}`}</Text>
                    </View>
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ color: '#7f8c8d', fontSize: 12, marginBottom: 2 }}>Salle</Text>
                      <Text style={{ color: '#2c3e50', fontSize: 14, fontWeight: '600' }}>{detail.salle_remplacement || '—'}</Text>
                    </View>
                    <View>
                      <Text style={{ color: '#7f8c8d', fontSize: 12, marginBottom: 2 }}>Classe concernée</Text>
                      <Text style={{ color: '#2c3e50', fontSize: 14, fontWeight: '600' }}>{detail.classe_remplacement || '—'}</Text>
                    </View>
                  </View>
                </View>
              )}
              
              {/* Documents joints */}
              {documents.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Documents joints</Text>
                  {documents.map((doc) => (
                    <TouchableOpacity
                      key={doc.id}
                      style={styles.documentItem}
                      onPress={() => viewDocument(doc)}
                    >
                      <Ionicons 
                        name={doc.type_mime.includes('pdf') ? 'document-text' : 'image'} 
                        size={20} 
                        color="#3498db" 
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.documentName}>{doc.nom_fichier}</Text>
                        <Text style={styles.documentSize}>
                          {(doc.taille_octets / 1024 / 1024).toFixed(2)} MB
                        </Text>
                      </View>
                      <Ionicons name="eye-outline" size={20} color="#3498db" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              
              {(() => {
                const disabled = !canEdit;
                return (
                  <>
                    <TouchableOpacity
                      style={[styles.primaryBtn, disabled && styles.btnDisabled]}
                      onPress={() => setEditing(true)}
                      disabled={disabled}
                    >
                      <Text style={styles.primaryBtnText}>Modifier la demande</Text>
                    </TouchableOpacity>
                    {disabled && (
                      <View style={styles.infoRow}>
                        <Ionicons name="information-circle-outline" size={16} color="#7f8c8d" />
                        <Text style={styles.infoText}>Cette demande n’est plus modifiable car elle est {meta.label.toLowerCase()}.</Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Type d’absence</Text>
                <TouchableOpacity style={styles.input} onPress={() => setShowTypeModal(true)}>
                  <Text style={styles.inputText}>{typeLabel || '—'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Période</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.input, { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setShowCalendar(true)}>
                    <Text style={styles.inputText}>{formatDisplay(startDate) || 'Date début'}</Text>
                    <Ionicons name="calendar-outline" size={20} color="#7f8c8d" />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.input, { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} onPress={() => setShowCalendar(true)}>
                    <Text style={styles.inputText}>{formatDisplay(endDate) || 'Date fin'}</Text>
                    <Ionicons name="calendar-outline" size={20} color="#7f8c8d" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Motif</Text>
                <TextInput style={[styles.input, styles.textArea]} multiline numberOfLines={4} textAlignVertical="top" value={reason} onChangeText={setReason} placeholder="Décrivez le motif" />
              </View>
              
              {/* Section Remplacement */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Proposition de remplacement ?</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.choiceButton, propositionRemplacement && styles.choiceButtonActive]}
                    onPress={() => setPropositionRemplacement(true)}
                  >
                    <Text style={[styles.choiceButtonText, propositionRemplacement && styles.choiceButtonTextActive]}>OUI</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.choiceButton, !propositionRemplacement && styles.choiceButtonActive]}
                    onPress={() => {
                      setPropositionRemplacement(false);
                      setDateRemplacement('');
                      setHeureDebutRemplacement('');
                      setHeureFinRemplacement('');
                      setSalleRemplacement('');
                      setClasseRemplacement('');
                    }}
                  >
                    <Text style={[styles.choiceButtonText, !propositionRemplacement && styles.choiceButtonTextActive]}>NON</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {propositionRemplacement && (
                <View style={styles.replacementSection}>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Date de remplacement</Text>
                    <TouchableOpacity 
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                      onPress={() => setShowReplacementCalendar(true)}
                    >
                      <Text style={styles.inputText}>{formatDisplay(dateRemplacement) || 'Sélectionner une date'}</Text>
                      <Ionicons name="calendar-outline" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Heure de début</Text>
                    <TouchableOpacity 
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                      onPress={() => setShowStartTimeModal(true)}
                    >
                      <Text style={styles.inputText}>{heureDebutRemplacement || 'Sélectionner l\'heure de début'}</Text>
                      <Ionicons name="time-outline" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Heure de fin</Text>
                    <TouchableOpacity 
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                      onPress={() => setShowEndTimeModal(true)}
                    >
                      <Text style={styles.inputText}>{heureFinRemplacement || 'Sélectionner l\'heure de fin'}</Text>
                      <Ionicons name="time-outline" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Salle</Text>
                    <TouchableOpacity 
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                      onPress={() => setShowRoomModal(true)}
                    >
                      <Text style={styles.inputText}>{salleRemplacement || 'Sélectionner une salle'}</Text>
                      <Ionicons name="business-outline" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Classe concernée</Text>
                    <TouchableOpacity 
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                      onPress={() => setShowClassModal(true)}
                    >
                      <Text style={styles.inputText}>{classeRemplacement || 'Sélectionner une classe'}</Text>
                      <Ionicons name="people-outline" size={20} color="#7f8c8d" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Gestion des documents en mode édition */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Documents</Text>
                
                {/* Documents existants */}
                {documents.map((doc) => (
                  <View key={doc.id} style={styles.documentItem}>
                    <Ionicons 
                      name={doc.type_mime.includes('pdf') ? 'document-text' : 'image'} 
                      size={20} 
                      color="#3498db" 
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.documentName}>{doc.nom_fichier}</Text>
                      <Text style={styles.documentSize}>
                        {(doc.taille_octets / 1024 / 1024).toFixed(2)} MB
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => viewDocument(doc)} style={{ marginRight: 8 }}>
                      <Ionicons name="eye-outline" size={20} color="#3498db" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteDocument(doc.id)}>
                      <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                ))}
                
                {/* Nouveau document */}
                {newDocument ? (
                  <View style={styles.documentItem}>
                    <Ionicons 
                      name={newDocument.type.includes('pdf') ? 'document-text' : 'image'} 
                      size={20} 
                      color="#27ae60" 
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.documentName}>{newDocument.name}</Text>
                      <Text style={styles.documentSize}>
                        {(newDocument.size / 1024 / 1024).toFixed(2)} MB • Nouveau
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setNewDocument(null)}>
                      <Ionicons name="close-circle" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addDocumentBtn} onPress={pickDocument}>
                    <Ionicons name="add-circle-outline" size={20} color="#3498db" />
                    <Text style={{ color: '#3498db', marginLeft: 8 }}>Ajouter un document</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={resetEdits}>
                  <Text style={styles.secondaryBtnText}>Réinitialiser</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    if (isDirty()) {
                      Alert.alert(
                        'Annuler les modifications ?',
                        'Vos changements non sauvegardés seront perdus.',
                        [
                          { text: 'Continuer', style: 'cancel' },
                          { text: 'Annuler et quitter', style: 'destructive', onPress: () => { resetEdits(); setEditing(false); } },
                        ]
                      );
                    } else {
                      setEditing(false);
                    }
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.divider} />

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Créée le</Text>
              <Text style={styles.metaValue}>{fmtDate(detail.date_creation)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Modifiée le</Text>
              <Text style={styles.metaValue}>{fmtDate(detail.date_modification)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Modal Type d'absence */}
      <Modal
        visible={showTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Type d’absence</Text>
            {typesLoading ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator color="#3498db" />
              </View>
            ) : (
              types.map((t) => (
                <TouchableOpacity key={t.id} style={styles.modalOption} onPress={() => { setTypeId(t.id); setTypeLabel(t.nom); setShowTypeModal(false); }}>
                  <Text style={styles.modalOptionText}>{t.nom}</Text>
                  {typeId === t.id && <Ionicons name="checkmark" size={20} color="#3498db" />}
                </TouchableOpacity>
              ))
            )}
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowTypeModal(false)}>
              <Text style={styles.modalCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Calendrier jours ouvrés */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCalendar(false)}
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
                    const isStart = isSameDay(iso, startDate);
                    const isEnd = isSameDay(iso, endDate);
                    const inRange = isBetween(iso, startDate, endDate);
                    const bg = isStart || isEnd ? '#3498db' : (inRange ? '#d6eaff' : (inMonth ? 'white' : '#ecf0f1'));
                    const color = isStart || isEnd ? 'white' : '#2c3e50';
                    return (
                      <TouchableOpacity key={di} style={{ width: 52, height: 44, borderRadius: 8, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e9ecef' }} onPress={() => onSelectDate(date)}>
                        <Text style={{ color, fontWeight: '600' }}>{date.getDate()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalCancelButton, { flex: 1, marginRight: 8, backgroundColor: '#bdc3c7', borderWidth: 0 }]} onPress={() => setShowCalendar(false)}>
                <Text style={styles.modalCancelText}>Fermer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalCancelButton, { flex: 1 }]} onPress={() => setShowCalendar(false)}>
                <Text style={styles.modalCancelText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Calendrier remplacement */}
      <Modal
        visible={showReplacementCalendar}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReplacementCalendar(false)}
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
                    const inMonth = date.getMonth() === replacementMonth.getMonth();
                    const isSelected = isSameDay(iso, dateRemplacement);
                    const bg = isSelected ? '#3498db' : (inMonth ? 'white' : '#ecf0f1');
                    const color = isSelected ? 'white' : '#2c3e50';
                    return (
                      <TouchableOpacity key={di} style={{ width: 52, height: 44, borderRadius: 8, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e9ecef' }} onPress={() => onSelectReplacementDate(date)}>
                        <Text style={{ color, fontWeight: '600' }}>{date.getDate()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalCancelButton, { flex: 1, marginRight: 8, backgroundColor: '#bdc3c7', borderWidth: 0 }]} onPress={() => setShowReplacementCalendar(false)}>
                <Text style={styles.modalCancelText}>Fermer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalCancelButton, { flex: 1 }]} onPress={() => setShowReplacementCalendar(false)}>
                <Text style={styles.modalCancelText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Heure de début */}
      <Modal
        visible={showStartTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStartTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Heure de début</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {availableTimes.map((time) => (
                <TouchableOpacity key={time} style={styles.modalOption} onPress={() => { setHeureDebutRemplacement(time); setShowStartTimeModal(false); }}>
                  <Text style={styles.modalOptionText}>{time}</Text>
                  {heureDebutRemplacement === time && <Ionicons name="checkmark" size={20} color="#3498db" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowStartTimeModal(false)}>
              <Text style={styles.modalCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Heure de fin */}
      <Modal
        visible={showEndTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndTimeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Heure de fin</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {availableTimes.map((time) => (
                <TouchableOpacity key={time} style={styles.modalOption} onPress={() => { setHeureFinRemplacement(time); setShowEndTimeModal(false); }}>
                  <Text style={styles.modalOptionText}>{time}</Text>
                  {heureFinRemplacement === time && <Ionicons name="checkmark" size={20} color="#3498db" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowEndTimeModal(false)}>
              <Text style={styles.modalCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Salle */}
      <Modal
        visible={showRoomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoomModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Salle</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {availableRooms.map((room) => (
                <TouchableOpacity key={room} style={styles.modalOption} onPress={() => { setSalleRemplacement(room); setShowRoomModal(false); }}>
                  <Text style={styles.modalOptionText}>{room}</Text>
                  {salleRemplacement === room && <Ionicons name="checkmark" size={20} color="#3498db" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowRoomModal(false)}>
              <Text style={styles.modalCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Classe concernée */}
      <Modal
        visible={showClassModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClassModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Classe concernée</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {availableClasses.map((classe) => (
                <TouchableOpacity key={classe} style={styles.modalOption} onPress={() => { setClasseRemplacement(classe); setShowClassModal(false); }}>
                  <Text style={styles.modalOptionText}>{classe}</Text>
                  {classeRemplacement === classe && <Ionicons name="checkmark" size={20} color="#3498db" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowClassModal(false)}>
              <Text style={styles.modalCancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecf0f1'
  },
  title: { fontSize: 20, fontWeight: '700', color: '#2c3e50' },
  centerBox: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  errorBox: {
    backgroundColor: '#fdecea', borderColor: '#f5c6cb', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 16,
  },
  errorText: { color: '#e74c3c' },
  card: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  type: { fontSize: 18, fontWeight: '700', color: '#2c3e50', flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: '600' },
  section: { marginBottom: 12 },
  sectionLabel: { color: '#7f8c8d', fontSize: 12, marginBottom: 4 },
  sectionValue: { color: '#2c3e50', fontSize: 16 },
  divider: { height: 1, backgroundColor: '#ecf0f1', marginVertical: 8 },
  metaGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  metaItem: { flex: 1 },
  metaLabel: { color: '#7f8c8d', fontSize: 12 },
  metaValue: { color: '#2c3e50', fontSize: 14, fontWeight: '600' },
  // Inputs + boutons
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  inputText: { color: '#2c3e50', fontSize: 14 },
  textArea: { minHeight: 96 },
  primaryBtn: {
    backgroundColor: '#3498db',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { backgroundColor: '#bdc3c7' },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#95a5a6',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  secondaryBtnText: { color: '#2c3e50', fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  infoText: { color: '#7f8c8d', fontSize: 12, flex: 1 },
  // Documents
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 2,
  },
  documentSize: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  addDocumentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  // Styles pour les champs de remplacement
  choiceButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  choiceButtonActive: {
    backgroundColor: '#0984e3',
    borderColor: '#0984e3',
  },
  choiceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#636e72',
  },
  choiceButtonTextActive: {
    color: 'white',
  },
  replacementSection: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  // Modales
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 24,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#2c3e50', marginBottom: 12 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionText: { color: '#2c3e50', fontSize: 14 },
  modalCancelButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelText: { color: '#2c3e50', fontWeight: '600' },
});
