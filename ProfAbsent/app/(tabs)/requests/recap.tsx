import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../../utils/supabase';

type Document = {
  id: number;
  nom_fichier: string;
  type_mime: string;
  taille_octets: number;
  url_fichier: string;
  date_upload: string;
  request_id: number;
  request_type: string;
  request_date_debut: string;
  request_date_fin: string;
  request_statut: string;
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

const formatDate = (iso: string) => {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

export default function RecapDocuments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchDocuments = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    setError(null);
    
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userRes?.user;
      if (!user) throw new Error('Aucune session utilisateur.');

      // Récupérer tous les documents avec les infos de la demande associée
      const { data, error: fetchError } = await supabase
        .from('absence_documents')
        .select(`
          id_document,
          nom_fichier,
          type_mime,
          taille_octets,
          url_fichier,
          date_upload,
          absence_requests!inner (
            id_absence_request,
            id_utilisateur,
            date_debut,
            date_fin,
            statut,
            absence_types ( nom )
          )
        `)
        .eq('absence_requests.id_utilisateur', user.id)
        .order('date_upload', { ascending: false });

      if (fetchError) throw fetchError;

      if (isMountedRef.current) {
        const mappedDocs: Document[] = (data || []).map((row: any) => ({
          id: row.id_document,
          nom_fichier: row.nom_fichier,
          type_mime: row.type_mime,
          taille_octets: row.taille_octets,
          url_fichier: row.url_fichier,
          date_upload: row.date_upload,
          request_id: row.absence_requests?.id_absence_request,
          request_type: row.absence_requests?.absence_types?.nom ?? 'Type inconnu',
          request_date_debut: row.absence_requests?.date_debut,
          request_date_fin: row.absence_requests?.date_fin,
          request_statut: row.absence_requests?.statut,
        }));
        setDocuments(mappedDocs);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e?.message ?? 'Erreur lors du chargement des documents');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDocuments();
    }, [fetchDocuments])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDocuments(true);
  }, [fetchDocuments]);

  const viewDocument = async (doc: Document) => {
    try {
      // Si c'est une URL publique, on peut l'ouvrir directement
      if (doc.url_fichier.startsWith('http')) {
        const supported = await Linking.canOpenURL(doc.url_fichier);
        if (supported) {
          await Linking.openURL(doc.url_fichier);
        } else {
          Alert.alert('Erreur', 'Impossible d\'ouvrir ce document');
        }
        return;
      }

      // Sinon, télécharger depuis Supabase Storage
      const { data, error } = await supabase.storage
        .from('absence-documents')
        .download(doc.url_fichier);

      if (error) throw error;

      // Convertir le blob en base64
      const reader = new FileReader();
      reader.readAsDataURL(data);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];

        // Sauvegarder temporairement
        const fileUri = FileSystem.cacheDirectory + doc.nom_fichier;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Partager/ouvrir le fichier
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
        } else {
          Alert.alert('Info', 'Le partage n\'est pas disponible sur cet appareil');
        }
      };
    } catch (error) {
      console.error('Erreur lors de l\'ouverture du document:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir ce document');
    }
  };

  const getDocumentIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'document-text';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('word')) return 'document';
    return 'document-attach';
  };

  const stats = {
    total: documents.length,
    pdf: documents.filter(d => d.type_mime.includes('pdf')).length,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.title}>Mes documents</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="folder-outline" size={24} color="#3498db" />
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Documents</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="document-text-outline" size={24} color="#e74c3c" />
          <Text style={styles.statNumber}>{stats.pdf}</Text>
          <Text style={styles.statLabel}>PDF</Text>
        </View>
      </View>

      {/* Liste des documents */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0984e3" />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchDocuments()}>
            <Text style={styles.retryBtnText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0984e3']} />
          }
        >
          {documents.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-outline" size={64} color="#bdc3c7" />
              <Text style={styles.emptyText}>Aucun document pour le moment</Text>
              <Text style={styles.emptySubtext}>
                Les documents joints à vos demandes d'absence apparaîtront ici
              </Text>
            </View>
          ) : (
            documents.map((doc) => {
              const meta = statusToMeta(doc.request_statut);
              
              return (
                <TouchableOpacity 
                  key={doc.id} 
                  style={styles.documentCard}
                  onPress={() => viewDocument(doc)}
                  activeOpacity={0.7}
                >
                  <View style={styles.documentIcon}>
                    <Ionicons 
                      name={getDocumentIcon(doc.type_mime) as any} 
                      size={32} 
                      color={doc.type_mime.includes('pdf') ? '#e74c3c' : '#3498db'} 
                    />
                  </View>
                  
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName} numberOfLines={1}>
                      {doc.nom_fichier}
                    </Text>
                    
                    <View style={styles.documentMeta}>
                      <Text style={styles.documentSize}>
                        {formatFileSize(doc.taille_octets)}
                      </Text>
                      <Text style={styles.documentDate}>
                        • {formatDate(doc.date_upload)}
                      </Text>
                    </View>

                    <View style={styles.requestInfo}>
                      <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                      <Text style={styles.requestType} numberOfLines={1}>
                        {doc.request_type}
                      </Text>
                      <Text style={styles.requestDates}>
                        ({formatDate(doc.request_date_debut)} - {formatDate(doc.request_date_fin)})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.documentActions}>
                    <Ionicons name="open-outline" size={20} color="#7f8c8d" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2c3e50',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryBtn: {
    backgroundColor: '#0984e3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 8,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  documentIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  documentSize: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  documentDate: {
    fontSize: 12,
    color: '#95a5a6',
    marginLeft: 4,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  requestType: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  requestDates: {
    fontSize: 11,
    color: '#95a5a6',
    marginLeft: 4,
  },
  documentActions: {
    padding: 8,
  },
});
