import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from "../../utils/supabase";

interface AbsenceRequest {
    id: number;
    [key: string]: any;
}

export default function Manager() {
    const router = useRouter();
    const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
    const [loading, setLoading] = useState(false);

    const afficherDonnees = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('absence_request')
                .select('*'); 

            if (error) {
                console.error('Erreur lors de la récupération des données :', error);
                return;
            }

            console.log('Données récupérées :', data);
            setAbsenceRequests(data || []);
        } 
        catch (err) {
            console.error('Erreur inattendue :', err);
        } 
        finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        afficherDonnees();
    }, []);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Gestionnaire</Text>
                <Text style={styles.subtitle}>Panneau administration</Text>

                        <FlatList
                            data={absenceRequests}
                            keyExtractor={(item: AbsenceRequest, index: number) => index.toString()}
                            renderItem={({ item }: { item: AbsenceRequest }) => (
                                <View style={styles.requestItem}>
                                    <Text>{JSON.stringify(item)}</Text>
                                </View>
                            )}
                        />
                                <View style={styles.requestItem}>
                                    <Text>{JSON.stringify(item)}</Text>
                                </View>
                            )}
                        />
                    </View>
                )}
                
                <View style={styles.buttonContainer}>
                    <Button 
                        title="Voir les demandes d'absence" 
                        onPress={() => router.push('/request')} 
                    />
                </View>
                
                <View style={styles.buttonContainer}>
                    <Button 
                        title="Gérer les utilisateurs" 
                        onPress={() => console.log('Gérer les utilisateurs')} 
                    />
                </View>
                
                <View style={styles.buttonContainer}>
                    <Button 
                        title="Paramètres" 
                        onPress={() => console.log('Paramètres')} 
                    />
                </View>
                
                <View style={styles.buttonContainer}>
                    <Button 
                        title="Retour à l'accueil" 
                        onPress={() => router.back()} 
                    />
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#5e43a1',
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 30,
        color: '#666',
    },
    buttonContainer: {
        width: '100%',
        marginBottom: 15,
    },
    dataContainer: {
        width: '100%',
        marginBottom: 20,
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: 8,
    },
    dataTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#333',
    },
    requestItem: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
});
