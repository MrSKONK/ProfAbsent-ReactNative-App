import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "../utils/supabase";
import { useAuth } from "../utils/useAuth";

type AbsenceStatus = "en_attente" | "approuve" | "rejete" | "annule";

interface AbsenceRequest {
    id: number;
    type: string;
    startDate: string;
    endDate: string;
    status: AbsenceStatus;
    reason: string | null;
    createdAt: string | null;
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

const LogoutButton = () => {
    const router = useRouter();
    const { signOut } = useAuth();

    const handleLogout = () => {
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
    };

    return (
        <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutButton}
        >
            <Ionicons name="log-out" size={24} color="#e74c3c" />
        </TouchableOpacity>
    );
};

export default function Manager() {
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
    const [managerId, setManagerId] = useState<string | null>(null);
    const [updatingId, setUpdatingId] = useState<number | null>(null);

    const checkUserRole = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

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
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("absence_requests")
                .select(`
                    id_absence_request,
                    date_debut,
                    date_fin,
                    statut,
                    motif,
                    date_creation,
                    absence_types ( nom )
                `)
                .order("date_creation", { ascending: false })
                .limit(5);

            if (error) {
                console.error("Erreur lors de la récupération des données :", error);
                Alert.alert("Erreur", "Impossible de récupérer les demandes récentes.");
                setAbsenceRequests([]);
                return;
            }

            const mapped: AbsenceRequest[] = (data ?? []).map((item: any) => ({
                id: item.id_absence_request,
                type: item.absence_types?.nom ?? "Type inconnu",
                startDate: item.date_debut,
                endDate: item.date_fin,
                status: item.statut as AbsenceStatus,
                reason: item.motif ?? null,
                createdAt: item.date_creation ?? null,
            }));

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
        async (id: number, status: "approuve" | "rejete") => {
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

    useEffect(() => {
        checkUserRole();
    }, [checkUserRole]);

    useEffect(() => {
        if (isAuthorized === true) {
            afficherDonnees();
        }
    }, [afficherDonnees, isAuthorized]);

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
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Gestionnaire</Text>
                        <Text style={styles.subtitle}>Panneau administration</Text>
                    </View>
                    <LogoutButton />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#5e43a1" />
                ) : (
                    <View style={styles.dataContainer}>
                        <Text style={styles.dataTitle}>Demandes d&apos;absence récentes</Text>
                        {absenceRequests.length > 0 ? (
                            absenceRequests.map((item) => {
                                const isPending = item.status === "en_attente";
                                const isDisabled = !isPending || updatingId === item.id;

                                return (
                                    <View key={item.id} style={styles.requestItem}>
                                        <View style={styles.requestHeader}>
                                            <Text style={styles.requestTitle}>Demande #{item.id}</Text>
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

                                        <View style={styles.actionsRow}>
                                            <TouchableOpacity
                                                style={[
                                                    styles.actionButton,
                                                    styles.actionButtonSpacer,
                                                    styles.approveButton,
                                                    isDisabled && styles.actionButtonDisabled,
                                                ]}
                                                onPress={() => updateRequestStatus(item.id, "approuve")}
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
                                                onPress={() => updateRequestStatus(item.id, "rejete")}
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
        backgroundColor: "white",
        marginTop: 30,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        width: '100%',
        marginBottom: 20,
    },
    logoutButton: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#f8f9fa',
        borderWidth: 1,
        borderColor: '#e74c3c',
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 10,
        color: "#5e43a1",
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 30,
        color: "#666",
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
    backButton: {
        width: "100%",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderColor: "#666",
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 15,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
    backButtonText: {
        color: "#666",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
    dataContainer: {
        width: "100%",
        marginBottom: 20,
        padding: 10,
        backgroundColor: "#fff",
        borderRadius: 8,
    },
    dataTitle: {
        fontSize: 18,
        fontWeight: "bold",
        marginBottom: 10,
        color: "#333",
    },
    requestItem: {
        padding: 12,
        borderRadius: 12,
        backgroundColor: "#f9f8ff",
        marginBottom: 12,
    },
    requestHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    requestTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#2d3436",
    },
    statusBadge: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
    },
    statusText: {
        color: "#fff",
        fontWeight: "600",
    },
    requestInfo: {
        fontSize: 14,
        color: "#2d3436",
        marginBottom: 4,
    },
    requestMeta: {
        fontSize: 12,
        color: "#636e72",
        marginBottom: 10,
    },
    actionsRow: {
        flexDirection: "row",
        marginTop: 12,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    actionButtonSpacer: {
        marginRight: 10,
    },
    approveButton: {
        backgroundColor: "#27ae60",
    },
    rejectButton: {
        backgroundColor: "#c0392b",
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    actionButtonText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "600",
    },
    centerContent: {
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: "#666",
        textAlign: "center",
    },
    errorTitle: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#e74c3c",
        marginBottom: 15,
        textAlign: "center",
    },
    errorText: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        marginBottom: 30,
        lineHeight: 24,
    },
    emptyText: {
        fontSize: 16,
        color: "#666",
        textAlign: "center",
        paddingVertical: 20,
    },
});
