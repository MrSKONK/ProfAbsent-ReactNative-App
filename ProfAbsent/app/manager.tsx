import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/useAuth";
import { LinearGradient } from 'expo-linear-gradient';
import { notifyRequestStatusChange } from "../utils/useNotifications";


type AbsenceStatus = "en_attente" | "approuve" | "rejete" | "annule";

interface AbsenceRequest {
    id: number;
    type: string;
    startDate: string;
    endDate: string;
    status: AbsenceStatus;
    reason: string | null;
    createdAt: string | null;
    userName: string;
    userId: string;
    documents?: {
        id_document: number;
        nom_fichier: string;
        type_mime: string;
        url_fichier: string;
    }[];
}

const STATUS_LABELS: Record<AbsenceStatus, string> = {
    en_attente: "En attente",
    approuve: "Approuvée",
    rejete: "Refusée",
    annule: "Annulée",
};

const STATUS_COLORS: Record<AbsenceStatus, string> = {
    en_attente: "#f1c40f",
    approuve: "#2ecc71",
    rejete: "#e74c3c",
    annule: "#95a5a6",
};

const formatDate = (iso: string | null) => {
    if (!iso) {
        return "";
    }

    try {
        return new Date(iso).toLocaleDateString("fr-FR");
    } catch {
        return iso;
    }
};

const formatStatus = (status: AbsenceStatus) => STATUS_LABELS[status] ?? status;

export default function Manager() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading, signOut } = useAuth();
    const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [managerId, setManagerId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    const checkUserRole = useCallback(async () => {
        console.log('[Manager] checkUserRole start');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            console.log('[Manager] session:', session);

            if (!session?.user) {
                setIsAuthorized(false);
                return;
            }

            setManagerId(session.user.id);

            const { data: userData, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id_profile", session.user.id)
                .single();

            if (error) {
                console.error("Erreur lors de la récupération du rôle:", error);
                setIsAuthorized(false);
                return;
            }

            const role = userData?.role;
            console.log('[Manager] role:', role);
            const isManager = role === "Gestionnaire";
            setIsAuthorized(isManager);

            if (!isManager) {
                Alert.alert(
                    "Accès refusé",
                    `Votre rôle actuel: ${role || "Non défini"}. Vous devez avoir le rôle Gestionnaire pour accéder à cette page.`,
                    [{ text: "OK", onPress: () => router.back() }]
                );
            }
        } catch (error) {
            console.error("Erreur lors de la vérification du rôle:", error);
            setIsAuthorized(false);
        }
    }, [router]);

    const afficherDonnees = useCallback(async () => {
        console.log('[Manager] afficherDonnees called');
        try {
            setLoading(true);
            // Récupérer les demandes d'absence
            const { data, error } = await supabase
                .from("absence_requests")
                .select(`
                    id_absence_request,
                    date_debut,
                    date_fin,
                    statut,
                    motif,
                    date_creation,
                    id_utilisateur,
                    absence_types(nom),
                    absence_documents(id_document, nom_fichier, type_mime, url_fichier, taille_octets)
                `)
                .order("date_creation", { ascending: false })
                .limit(5);
            
            console.log('[Manager] absence_requests response:', { data, error });

            if (error) {
                console.error("Erreur lors de la récupération des données :", error);
                Alert.alert("Erreur", "Impossible de récupérer les demandes récentes.");
                setAbsenceRequests([]);
                return;
            }

            // Récupérer les profils des utilisateurs séparément
            let profilesMap = new Map<string, string>();
            if (data && data.length > 0) {
                const userIds = [...new Set(data.map(item => item.id_utilisateur))];
                console.log('[Manager] User IDs à rechercher:', userIds);
                
                const { data: profilesData, error: profilesError } = await supabase
                    .from("profiles")
                    .select("id_profile, nom_complet")
                    .in("id_profile", userIds);
                
                console.log('[Manager] Profiles response:', { profilesData, profilesError });
                
                if (!profilesError && profilesData) {
                    profilesMap = new Map(
                        profilesData.map(p => [p.id_profile, p.nom_complet])
                    );
                    console.log('[Manager] ProfilesMap créée:', Array.from(profilesMap.entries()));
                }
            }

            const mapped: AbsenceRequest[] = (data ?? []).map((item: any) => {
                const userName = profilesMap.get(item.id_utilisateur) || `Utilisateur ${item.id_utilisateur.slice(0, 8)}...`;
                console.log('[Manager] Mapping item:', item.id_absence_request, 'id_utilisateur:', item.id_utilisateur, 'userName:', userName);
                return {
                    id: item.id_absence_request,
                    type: item.absence_types?.nom ?? "Type inconnu",
                    startDate: item.date_debut,
                    endDate: item.date_fin,
                    status: item.statut as AbsenceStatus,
                    reason: item.motif ?? null,
                    createdAt: item.date_creation ?? null,
                    userName: userName,
                    userId: item.id_utilisateur,
                    documents: item.absence_documents || [],
                };
            });

            setAbsenceRequests(mapped);
        } catch (error) {
            console.error("Erreur inattendue :", error);
            Alert.alert("Erreur", "Une erreur inattendue est survenue.");
            setAbsenceRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const updateRequestStatus = useCallback(
        async (id: number, status: "approuve" | "rejete", userId: string, requestType: string) => {
            if (!managerId) {
                Alert.alert("Action impossible", "Identifiant gestionnaire manquant. Veuillez réessayer.");
                return;
            }

            try {
                setUpdatingId(id);

                const payload: Record<string, any> = {
                    statut: status,
                    approuve_par: managerId,
                    date_modification: new Date().toISOString(),
                    date_approbation: status === "approuve" ? new Date().toISOString() : null,
                };

                const { error } = await supabase
                    .from("absence_requests")
                    .update(payload)
                    .eq("id_absence_request", id);

                if (error) {
                    console.error("Erreur lors de la mise à jour du statut :", error);
                    Alert.alert("Erreur", "Impossible de mettre à jour la demande.");
                    return;
                }

                // Envoyer une notification push à l'utilisateur
                try {
                    await notifyRequestStatusChange(
                        id,
                        userId,
                        status,
                        requestType
                    );
                    console.log('[Manager] Notification envoyée à l\'utilisateur:', userId);
                } catch (notifError) {
                    console.error('[Manager] Erreur lors de l\'envoi de la notification:', notifError);
                    // On ne bloque pas le processus si la notification échoue
                }

                await afficherDonnees();
            } catch (error) {
                console.error("Erreur inattendue lors de la mise à jour :", error);
                Alert.alert("Erreur", "Une erreur inattendue est survenue.");
            } finally {
                setUpdatingId(null);
            }
        },
        [afficherDonnees, managerId]
    );

    // Fonction pour télécharger/voir un document
    const viewDocument = useCallback(async (document: { url_fichier: string; nom_fichier: string }) => {
        try {
            const { data, error } = await supabase.storage
                .from('absence-documents')
                .createSignedUrl(document.url_fichier, 3600); // URL valide 1h

            if (error) throw error;

            if (data?.signedUrl) {
                // Ouvrir le document dans le navigateur
                const supported = await Linking.canOpenURL(data.signedUrl);
                
                if (supported) {
                    await Linking.openURL(data.signedUrl);
                } else {
                    Alert.alert(
                        'Document',
                        `Document: ${document.nom_fichier}\n\nImpossible d'ouvrir automatiquement le document.`,
                        [
                            { text: 'Fermer', style: 'cancel' },
                            { 
                                text: 'Copier URL', 
                                onPress: () => {
                                    console.log('URL du document:', data.signedUrl);
                                }
                            }
                        ]
                    );
                }
            }
        } catch (error) {
            console.error('Erreur lors de la récupération du document:', error);
            Alert.alert('Erreur', 'Impossible d\'accéder au document');
        }
    }, []);

    useEffect(() => {
        checkUserRole();
    }, [checkUserRole]);

    useEffect(() => {
        if (isAuthorized === true) {
            afficherDonnees();
        }
    }, [afficherDonnees, isAuthorized]);

    // Actualiser les données quand la page devient active
    useFocusEffect(
        useCallback(() => {
            if (isAuthorized === true) {
                afficherDonnees();
            }
        }, [afficherDonnees, isAuthorized])
    );

    if (authLoading || isAuthorized === null) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color="#5e43a1" />
                <Text style={styles.loadingText}>Vérification des autorisations...</Text>
            </View>
        );
    }

    if (!isAuthenticated || isAuthorized === false) {
        return (
            <View style={[styles.container, styles.centerContent]}>
                <Text style={styles.errorTitle}>Accès refusé</Text>
                <Text style={styles.errorText}>
                    Vous devez être connecté avec le rôle &apos;Gestionnaire&apos; pour accéder à cette page.
                </Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>Retour</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* En-tête avec gradient */}
            <LinearGradient
                colors={['#74b9ff', '#0984e3']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
                style={styles.welcomeContainer}
            >
                <View style={styles.welcomeContent}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.welcomeTitle}>Panneau d&apos;administration</Text>
                        <Text style={styles.welcomeSubtitle}>Gérez les demandes d&apos;absence des employés</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => afficherDonnees()}
                            style={styles.headerButton}
                        >
                            <Ionicons name="reload" size={20} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                Alert.alert(
                                    'Déconnexion',
                                    'Êtes-vous sûr de vouloir vous déconnecter ?',
                                    [
                                        { text: 'Annuler', style: 'cancel' },
                                        {
                                            text: 'Déconnexion',
                                            style: 'destructive',
                                            onPress: async () => {
                                                await signOut();
                                                router.replace('/login');
                                            }
                                        }
                                    ]
                                );
                            }}
                            style={styles.headerButton}
                        >
                            <Ionicons name="log-out" size={20} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.content}>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#0984e3" />
                    </View>
                ) : (
                    <View style={styles.requestsContainer}>
                        <Text style={styles.sectionTitle}>Demandes récentes</Text>
                        {absenceRequests.length > 0 ? (
                            absenceRequests.map((item) => {
                                const isPending = item.status === "en_attente";
                                const isDisabled = !isPending || updatingId === item.id;

                                return (
                                    <View key={item.id} style={styles.requestCard}>
                                        <View style={styles.cardHeader}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.requestTitle}>Demande #{item.id}</Text>
                                                <Text style={styles.requestUser}>
                                                    <Ionicons name="person-outline" size={14} color="#7f8c8d" /> {item.userName}
                                                </Text>
                                            </View>
                                            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] }]}>
                                                <Text style={styles.statusText}>{formatStatus(item.status)}</Text>
                                            </View>
                                        </View>
                                        <Text style={styles.requestInfo}>Type : {item.type}</Text>
                                        <Text style={styles.requestInfo}>
                                            Période : {formatDate(item.startDate)} → {formatDate(item.endDate)}
                                        </Text>
                                        {item.reason ? <Text style={styles.requestInfo}>Motif : {item.reason}</Text> : null}
                                        {item.createdAt ? (
                                            <Text style={styles.requestMeta}>Soumise le {formatDate(item.createdAt)}</Text>
                                        ) : null}

                                        {/* Affichage des documents joints */}
                                        {item.documents && item.documents.length > 0 && (
                                            <View style={styles.documentsSection}>
                                                <Text style={styles.documentsTitle}>Documents joints :</Text>
                                                {item.documents.map((doc) => (
                                                    <TouchableOpacity
                                                        key={doc.id_document}
                                                        style={styles.documentItem}
                                                        onPress={() => viewDocument(doc)}
                                                    >
                                                        <Ionicons 
                                                            name={doc.type_mime.includes('pdf') ? 'document-text' : 'image'} 
                                                            size={16} 
                                                            color="#3498db" 
                                                        />
                                                        <Text style={styles.documentName}>{doc.nom_fichier}</Text>
                                                        <Ionicons name="eye-outline" size={16} color="#3498db" />
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}

                                        <View style={styles.actionsRow}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.actionButton,
                                                    styles.actionButtonSpacer,
                                                    styles.approveButton,
                                                    isDisabled && styles.actionButtonDisabled,
                                                ]}
                                                onPress={() => updateRequestStatus(item.id, "approuve", item.userId, item.type)}
                                                disabled={isDisabled}
                                            >
                                                {updatingId === item.id ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <Text style={styles.actionButtonText}>Approuver</Text>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.actionButton, styles.rejectButton, isDisabled && styles.actionButtonDisabled]}
                                                onPress={() => updateRequestStatus(item.id, "rejete", item.userId, item.type)}
                                                disabled={isDisabled}
                                            >
                                                {updatingId === item.id ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <Text style={styles.actionButtonText}>Refuser</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })
                        ) : (
                            <Text style={styles.emptyText}>Aucune demande d&apos;absence disponible.</Text>
                        )}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f9fa',
    },
    welcomeContainer: {
        marginTop: 60,
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
    },
    welcomeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 24,
    },
    welcomeTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
    },
    welcomeSubtitle: {
        fontSize: 14,
        color: 'white',
        opacity: 0.9,
    },
    headerButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        paddingHorizontal: 20,
    },
    primaryButton: {
        width: "100%",
        backgroundColor: "#5e43a1",
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 15,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    secondaryButton: {
        width: "100%",
        backgroundColor: "#0984e3",
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 15,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    loadingContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    requestsContainer: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#2c3e50',
        marginBottom: 16,
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
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    requestTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#2c3e50',
        marginBottom: 4,
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    statusText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    requestInfo: {
        fontSize: 14,
        color: '#2c3e50',
        marginBottom: 8,
        lineHeight: 20,
    },
    requestUser: {
        fontSize: 14,
        color: '#7f8c8d',
        marginBottom: 8,
    },
    requestMeta: {
        fontSize: 12,
        color: '#95a5a6',
        marginTop: 4,
        marginBottom: 12,
    },
    actionsRow: {
        flexDirection: 'row',
        marginTop: 12,
        gap: 8,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    actionButtonSpacer: {
        marginRight: 0,
    },
    approveButton: {
        backgroundColor: '#27ae60',
    },
    rejectButton: {
        backgroundColor: '#e74c3c',
    },
    actionButtonDisabled: {
        opacity: 0.5,
        elevation: 0,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#e74c3c',
        marginBottom: 15,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    backButton: {
        backgroundColor: 'transparent',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 32,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#7f8c8d',
    },
    backButtonText: {
        color: '#7f8c8d',
        fontSize: 16,
        fontWeight: '600',
    },
    emptyText: {
        fontSize: 16,
        color: '#7f8c8d',
        textAlign: 'center',
        paddingVertical: 20,
    },
    // Styles pour les documents
    documentsSection: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#f1f3f5',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#dee2e6',
    },
    documentsTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: '#495057',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    documentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'white',
        borderRadius: 8,
        marginBottom: 6,
        gap: 10,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    documentName: {
        flex: 1,
        fontSize: 14,
        color: '#2c3e50',
        fontWeight: '500',
    },
});