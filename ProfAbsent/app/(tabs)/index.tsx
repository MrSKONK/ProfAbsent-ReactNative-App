import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from "../../utils/supabase";

type RecentRequest = {
    id: number;
    type: string;
    date: string;
    status: string;
    color: string;
    hasDocuments?: boolean;
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

const formatDateRange = (startISO: string, endISO: string) => {
    try {
        const start = new Date(startISO);
        const end = new Date(endISO);
        const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
        return `${fmt(start)} → ${fmt(end)}`;
    } catch {
        return `${startISO} → ${endISO}`;
    }
};

// Compte les jours ouvrés (lundi à vendredi) inclusivement entre deux dates ISO
const countBusinessDays = (startISO: string, endISO: string) => {
    if (!startISO || !endISO) return 0;
    const start = new Date(startISO + 'T00:00:00');
    const end = new Date(endISO + 'T00:00:00');
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end < start) return 0;

    let count = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        const day = cursor.getDay(); // 0=dim, 6=sam
        if (day >= 1 && day <= 5) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
};

const MyRequests = () => {
    const router = useRouter();
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
        const [stats, setStats] = useState<{ pending: number; daysRemaining: number; approved: number }>({ pending: 0, daysRemaining: 0, approved: 0 });
    const [firstName, setFirstName] = useState<string>('');
    const [greeting, setGreeting] = useState<string>('Bonjour');

        const isMountedRef = useRef(true);
        useEffect(() => {
            isMountedRef.current = true;
            return () => { isMountedRef.current = false; };
        }, []);

        const fetchData = useCallback(async () => {
            setLoading(true);
            setError(null);
            try {
                const { data: userRes, error: userErr } = await supabase.auth.getUser();
                if (userErr) throw userErr;
                const user = userRes?.user;
                if (!user) throw new Error('Aucune session utilisateur.');

                const currentYear = new Date().getFullYear();

                const recentQ = supabase
                    .from('absence_requests')
                    .select('id_absence_request, date_debut, date_fin, statut, absence_types ( nom ), absence_documents ( id_document )')
                    .eq('id_utilisateur', user.id)
                    .order('date_creation', { ascending: false })
                    .limit(3);

                const pendingQ = supabase
                    .from('absence_requests')
                    .select('id_absence_request', { count: 'exact', head: true })
                    .eq('id_utilisateur', user.id)
                    .eq('statut', 'en_attente');

                const approvedQ = supabase
                    .from('absence_requests')
                    .select('id_absence_request', { count: 'exact', head: true })
                    .eq('id_utilisateur', user.id)
                    .eq('statut', 'approuve');

                const balancesQ = supabase
                    .from('absence_balances')
                    .select('jours_restants')
                    .eq('id_utilisateur', user.id)
                    .eq('annee', currentYear);

                const profileQ = supabase
                    .from('profiles')
                    .select('nom_complet')
                    .eq('id_profile', user.id)
                    .maybeSingle();

                const [recentRes, pendingRes, approvedRes, balancesRes, profileRes] = await Promise.all([recentQ, pendingQ, approvedQ, balancesQ, profileQ]);

                if (recentRes.error) throw recentRes.error;
                if (pendingRes.error) throw pendingRes.error;
                if (approvedRes.error) throw approvedRes.error;
                if (balancesRes.error) throw balancesRes.error;
                if (profileRes.error && profileRes.error.code !== 'PGRST116') throw profileRes.error;

                const recents: RecentRequest[] = (recentRes.data || []).map((r: any) => {
                    const meta = statusToMeta(r.statut);
                    const typeName: string = r.absence_types?.nom ?? 'Type inconnu';
                    const wd = countBusinessDays(r.date_debut, r.date_fin);
                    const hasDocuments = r.absence_documents && r.absence_documents.length > 0;
                    return {
                        id: r.id_absence_request,
                        type: typeName,
                        date: `${formatDateRange(r.date_debut, r.date_fin)} · ${wd} j ouvrés`,
                        status: meta.label,
                        color: meta.color,
                        hasDocuments,
                    };
                });

                const pending = pendingRes.count ?? 0;
                const approved = approvedRes.count ?? 0;
                const daysRemaining = (balancesRes.data || []).reduce(
                    (sum: number, row: any) => sum + (Number(row.jours_restants) || 0),
                    0
                );

                if (isMountedRef.current) {
                    setRecentRequests(recents);
                    setStats({ pending, daysRemaining, approved });
                    const fullName: string = (profileRes.data as any)?.nom_complet
                        || (user.user_metadata as any)?.full_name
                        || (user.email?.split('@')[0] ?? '');
                    const candidate = fullName.trim();
                    const f = candidate;
                    setFirstName(f);
                }
            } catch (e: any) {
                if (isMountedRef.current) setError(e?.message ?? 'Erreur lors du chargement des données');
            } finally {
                if (isMountedRef.current) setLoading(false);
            }
        }, []);

        useEffect(() => {
            fetchData();
        }, [fetchData]);

        useFocusEffect(
            useCallback(() => {
                // Recalcule le salut et recharge les données au focus
                const h = new Date().getHours();
                setGreeting(h >= 18 ? 'Bonsoir' : 'Bonjour');
                fetchData();
            }, [fetchData])
        );

    return (
                <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* En-tête de bienvenue */}
            <LinearGradient
                colors={['#74b9ff', '#0984e3']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.welcomeContainer}
            >
                <View style={styles.welcomeContent}>
                    <Text style={styles.welcomeTitle}>{greeting} {firstName ? `${firstName} !` : '!'}</Text>
                    <Text style={styles.welcomeSubtitle}>Gérez vos demandes d&apos;absence en toute simplicité</Text>
                </View>
            </LinearGradient>

                        {loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#0984e3" />
                            </View>
                        )}
                        {error && !loading && (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

            {/* Statistiques rapides */}
            <View style={styles.statsContainer}>
                <Text style={styles.sectionTitle}>Vue d&apos;ensemble</Text>
                <View style={styles.statsGrid}>
                                        <View style={styles.statCard}>
                                                <View style={[styles.statIcon, { backgroundColor: '#f39c1220' }]}>
                                                        <Ionicons name={"hourglass-outline" as any} size={24} color="#f39c12" />
                                                </View>
                                                <Text style={styles.statValue}>{stats.pending}</Text>
                                                <Text style={styles.statLabel}>Demandes en cours</Text>
                                        </View>
                                        <View style={styles.statCard}>
                                                <View style={[styles.statIcon, { backgroundColor: '#3498db20' }]}>
                                                        <Ionicons name={"calendar-outline" as any} size={24} color="#3498db" />
                                                </View>
                                                <Text style={styles.statValue}>{stats.daysRemaining}</Text>
                                                <Text style={styles.statLabel}>Jours restants</Text>
                                        </View>
                                        <View style={styles.statCard}>
                                                <View style={[styles.statIcon, { backgroundColor: '#27ae6020' }]}>
                                                        <Ionicons name={"checkmark-circle-outline" as any} size={24} color="#27ae60" />
                                                </View>
                                                <Text style={styles.statValue}>{stats.approved}</Text>
                                                <Text style={styles.statLabel}>Demandes approuvées</Text>
                                        </View>
                </View>
            </View>

            {/* Actions rapides */}
            <View style={styles.actionsContainer}>
                <Text style={styles.sectionTitle}>Actions rapides</Text>
                <View style={styles.actionsGrid}>
                    <TouchableOpacity 
                        style={styles.actionCard}
                        onPress={() => router.push('/request')}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#3498db20' }]}>
                            <Ionicons name="add-circle-outline" size={28} color="#3498db" />
                        </View>
                        <Text style={styles.actionTitle}>Nouvelle demande</Text>
                        <Text style={styles.actionSubtitle}>Créer une absence</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.actionCard}
                        onPress={() => router.push('/(tabs)/requests/recap')}
                    >
                        
                        <View style={[styles.actionIcon, { backgroundColor: '#27ae6020' }]}>
                            <Ionicons name="folder-outline" size={28} color="#27ae60" />
                        </View>
                        <Text style={styles.actionTitle}>Docs</Text>
                        <Text style={styles.actionSubtitle}>Mes documents</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        style={styles.actionCard}
                        onPress={() => router.push('/Profile')}
                    >
                        <View style={[styles.actionIcon, { backgroundColor: '#9b59b620' }]}>
                            <Ionicons name="person-outline" size={28} color="#9b59b6" />
                        </View>
                        <Text style={styles.actionTitle}>Mon profil</Text>
                        <Text style={styles.actionSubtitle}>Mes infos</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Demandes récentes */}
            <View style={styles.recentContainer}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Demandes récentes</Text>
                    <TouchableOpacity 
                        style={styles.viewAllButton}
                        onPress={() => router.push('/(tabs)/requests/all')}
                    >
                        <Text style={styles.viewAllText}>Voir tout</Text>
                        <Ionicons name="chevron-forward" size={16} color="#3498db" />
                    </TouchableOpacity>
                </View>
                {(!loading && recentRequests.length === 0) && (
                  <Text style={{ color: '#7f8c8d' }}>Aucune demande récente.</Text>
                )}
                {recentRequests.map((request) => (
                  <View key={request.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                          <Text style={styles.requestType}>{request.type}</Text>
                          <View style={[styles.statusBadge, { backgroundColor: request.color }]}>
                              <Text style={styles.statusText}>{request.status}</Text>
                          </View>
                      </View>
                      <Text style={styles.requestDate}>{request.date}</Text>
                      <View style={styles.requestFooter}>
                                                    <TouchableOpacity
                                                        style={styles.detailsButton}
                                                        onPress={() => router.push(`/(tabs)/requests/${request.id}`)}
                                                    >
                              <Text style={styles.detailsButtonText}>Voir détails</Text>
                              <Ionicons name="chevron-forward" size={16} color="#3498db" />
                          </TouchableOpacity>
                      </View>
                  </View>
                ))}
            </View>

            {/* Espacement en bas */}
            <View style={styles.bottomSpacing} />
        </ScrollView>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    loadingContainer: {
        paddingVertical: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorBox: {
        backgroundColor: '#fdecea',
        borderColor: '#f5c6cb',
        borderWidth: 1,
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 20,
        marginBottom: 16,
    },
    errorText: {
        color: '#e74c3c',
    },
    welcomeContainer: {
        margin: 20,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    welcomeContent: {
        padding: 24,
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    welcomeSubtitle: {
        fontSize: 16,
        color: 'white',
        opacity: 0.9,
    },
    statsContainer: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 4,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    statIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#2c3e50',
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#7f8c8d',
        textAlign: 'center',
    },
    actionsContainer: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    actionsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    actionCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        alignItems: 'center',
        flex: 1,
        marginHorizontal: 4,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    actionIcon: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    actionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 4,
        textAlign: 'center',
    },
    actionSubtitle: {
        fontSize: 12,
        color: '#7f8c8d',
        textAlign: 'center',
    },
    recentContainer: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    viewAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3498db',
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
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    requestType: {
        fontSize: 16,
        fontWeight: '600',
        color: '#2c3e50',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    requestDate: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 12,
    },
    requestFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    detailsButtonText: {
        color: '#3498db',
        fontSize: 14,
        fontWeight: '500',
        marginRight: 4,
    },
    bottomSpacing: {
        height: 20,
    },
});
export default MyRequests;
