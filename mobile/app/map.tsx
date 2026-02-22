import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';

export default function MapScreen() {
    const { url } = useLocalSearchParams<{ url?: string }>();
    const router = useRouter();
    const uri = url ? decodeURIComponent(url) : '';

    useEffect(() => {
        if (uri) Linking.openURL(uri).catch(() => {});
    }, [uri]);

    return (
        <>
            <Stack.Screen options={{ title: 'Map & routes', headerShown: true }} />
            <View style={styles.centered}>
                {uri ? (
                    <Text style={styles.hint}>
                        Map should have opened in your browser or Maps app. If not, tap below.
                    </Text>
                ) : null}
                {uri ? (
                    <TouchableOpacity style={styles.button} onPress={() => Linking.openURL(uri)}>
                        <Text style={styles.buttonText}>Open map in browser</Text>
                    </TouchableOpacity>
                ) : (
                    <Text style={styles.hint}>No map URL provided.</Text>
                )}
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>← Back to plan</Text>
                </TouchableOpacity>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    hint: {
        color: '#999',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
    },
    button: {
        backgroundColor: '#fff',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 12,
        marginBottom: 24,
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '600',
    },
    backButton: {
        paddingVertical: 12,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 15,
    },
});
