import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../utils/supabase';

type Request = {
  id: number;
  type: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  date_creation: string;
  motif: string | null;
  proposition_remplacement: boolean;
};

const statusToMeta = (statut: string) => {
  switch (statut) {
    case 'en_attente':
      return { label: 'En attente', color: '#f39c12', icon: 'time-outline' };
    case 'approuve':
      return { label: 'Approuvé', color: '#27ae60', icon: 'checkmark-circle-outline' };
    case 'rejete':
      return { label: 'Rejeté', color: '#e74c3c', icon: 'close-circle-outline' };
    case 'annule':
      return { label: 'Annulé', color: '#7f8c8d', icon: 'ban-outline' };
    default:
      return { label: statut, color: '#7f8c8d', icon: 'help-circle-outline' };
  }
};

const formatDateRange = (startISO: string, endISO: string) => {
  try {
    const start = new Date(startISO);
    const end = new Date(endISO);
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    if (startISO === endISO) {
      return fmt(start);
    }
    return `${fmt(start)} → ${fmt(end)}`;
  } catch {
    return `${startISO} → ${endISO}`;
  }
};

const formatDate = (iso: string) => {
  try {
    const date = new Date(iso);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
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

export default function AllRequests() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('tous');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchRequests = useCallback(async (isRefreshing = false) => {
    if (!isRefreshing) setLoading(true);
    setError(null);
    
    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userRes?.user;
      if (!user) throw new Error('Aucune session utilisateur.');

      let query = supabase
        .from('absence_requests')
        .select('id_absence_request, date_debut, date_fin, statut, motif, date_creation, proposition_remplacement, absence_types ( nom )')
        .eq('id_utilisateur', user.id)
        .order('date_creation', { ascending: false });

      // Filtrer par statut si nécessaire
      if (filterStatus !== 'tous') {
        query = query.eq('statut', filterStatus);
      }

      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;

      if (isMountedRef.current) {
        const mappedRequests: Request[] = (data || []).map((row: any) => ({
          id: row.id_absence_request,
          type: row.absence_types?.nom ?? 'Type inconnu',
          date_debut: row.date_debut,
          date_fin: row.date_fin,
          statut: row.statut,
          date_creation: row.date_creation,
          motif: row.motif,
          proposition_remplacement: row.proposition_remplacement ?? false,
        }));
        setRequests(mappedRequests);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e?.message ?? 'Erreur lors du chargement des demandes');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [filterStatus]);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [fetchRequests])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests(true);
  }, [fetchRequests]);

  const filteredRequests = requests;

  const stats = {
    total: requests.length,
    en_attente: requests.filter(r => r.statut === 'en_attente').length,
    approuve: requests.filter(r => r.statut === 'approuve').length,
    rejete: requests.filter(r => r.statut === 'rejete').length,
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.title}>Mes demandes</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#f39c12' }]}>{stats.en_attente}</Text>
          <Text style={styles.statLabel}>En attente</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#27ae60' }]}>{stats.approuve}</Text>
          <Text style={styles.statLabel}>Approuvées</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#e74c3c' }]}>{stats.rejete}</Text>
          <Text style={styles.statLabel}>Rejetées</Text>
        </View>
      </View>

      {/* Filtres */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterStatus === 'tous' && styles.filterChipActive]}
          onPress={() => setFilterStatus('tous')}
        >
          <Text style={[styles.filterChipText, filterStatus === 'tous' && styles.filterChipTextActive]}>
            Tous ({stats.total})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterStatus === 'en_attente' && styles.filterChipActive]}
          onPress={() => setFilterStatus('en_attente')}
        >
          <Text style={[styles.filterChipText, filterStatus === 'en_attente' && styles.filterChipTextActive]}>
            En attente ({stats.en_attente})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterStatus === 'approuve' && styles.filterChipActive]}
          onPress={() => setFilterStatus('approuve')}
        >
          <Text style={[styles.filterChipText, filterStatus === 'approuve' && styles.filterChipTextActive]}>
            Approuvées ({stats.approuve})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterStatus === 'rejete' && styles.filterChipActive]}
          onPress={() => setFilterStatus('rejete')}
        >
          <Text style={[styles.filterChipText, filterStatus === 'rejete' && styles.filterChipTextActive]}>
            Rejetées ({stats.rejete})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterStatus === 'annule' && styles.filterChipActive]}
          onPress={() => setFilterStatus('annule')}
        >
          <Text style={[styles.filterChipText, filterStatus === 'annule' && styles.filterChipTextActive]}>
            Annulées
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Liste des demandes */}
      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0984e3" />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchRequests()}>
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
          {filteredRequests.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={64} color="#bdc3c7" />
              <Text style={styles.emptyText}>
                {filterStatus === 'tous' 
                  ? 'Aucune demande pour le moment' 
                  : `Aucune demande ${statusToMeta(filterStatus).label.toLowerCase()}`}
              </Text>
            </View>
          ) : (
            filteredRequests.map((request) => {
              const meta = statusToMeta(request.statut);
              const days = countBusinessDays(request.date_debut, request.date_fin);
              
              return (
                <View key={request.id} style={styles.requestCard}>
                  <TouchableOpacity
                    onPress={() => router.push(`/requests/${request.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.requestHeader}>
                      <View style={styles.requestHeaderLeft}>
                        <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                        <Text style={styles.requestType}>{request.type}</Text>
                        {request.proposition_remplacement && (
                          <View style={styles.replacementBadge}>
                            <Ionicons name="swap-horizontal" size={12} color="#3498db" />
                          </View>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: meta.color }]}> 
                        <Text style={styles.statusBadgeText}>{meta.label}</Text>
                      </View>
                    </View>

                    <View style={styles.requestBody}>
                      <View style={styles.requestRow}>
                        <Ionicons name="calendar-outline" size={16} color="#7f8c8d" />
                        <Text style={styles.requestDate}>
                          {formatDateRange(request.date_debut, request.date_fin)}
                        </Text>
                        <Text style={styles.requestDays}>• {days} j ouvrés</Text>
                      </View>

                      {request.motif && (
                        <View style={styles.requestRow}>
                          <Ionicons name="text-outline" size={16} color="#7f8c8d" />
                          <Text style={styles.requestMotif} numberOfLines={2}>
                            {request.motif}
                          </Text>
                        </View>
                      )}

                      <View style={styles.requestFooter}>
                        <Text style={styles.requestCreatedAt}>
                          Créée le {formatDate(request.date_creation)}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color="#7f8c8d" />
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ marginTop: 8, alignSelf: 'flex-end' }}
                    onPress={() => router.push(`/requests/${request.id}` as any)}
                  >
                    <Text style={{ color: '#3498db', fontWeight: '600' }}>Voir détails</Text>
                  </TouchableOpacity>
                </View>
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
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
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
  },
  statLabel: {
    fontSize: 11,
    color: '#7f8c8d',
    marginTop: 2,
  },
  filtersContainer: {
    maxHeight: 50,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filtersContent: {
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterChipActive: {
    backgroundColor: '#0984e3',
    borderColor: '#0984e3',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  filterChipTextActive: {
    color: 'white',
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
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 16,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  requestHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  requestType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    flex: 1,
  },
  replacementBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  requestBody: {
    gap: 8,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestDate: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '500',
  },
  requestDays: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  requestMotif: {
    fontSize: 13,
    color: '#7f8c8d',
    flex: 1,
  },
  requestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  requestCreatedAt: {
    fontSize: 11,
    color: '#95a5a6',
  },
});
