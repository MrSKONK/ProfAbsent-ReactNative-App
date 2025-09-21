import React from "react";
import { View, Text, Button, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";

export default function Manager() {
    const router = useRouter();

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Gestionnaire</Text>
                <Text style={styles.subtitle}>Panneau administration</Text>
                
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
});