import React, { useState, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Linking,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function ConnectGoogleScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [connected, setConnected] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const checkStatus = useCallback(async () => {
        if (!user) return;
        try {
            const { connected: isConnected } = await api.getGoogleStatus(user.user_id);
            setConnected(isConnected);
        } catch {
            setConnected(false);
        }
    }, [user]);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const openGoogleAuth = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { auth_url } = await api.getGoogleAuthUrl(user.user_id);
            const supported = await Linking.canOpenURL(auth_url);
            if (supported) {
                await Linking.openURL(auth_url);
            } else {
                Alert.alert('Error', 'Cannot open browser. Please try again.');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to get Google sign-in link.');
        } finally {
            setLoading(false);
        }
    };

    const syncAndContinue = async () => {
        if (!user) return;
        setSyncing(true);
        try {
            await api.getGoogleSync(user.user_id);
            setConnected(true);
        } catch (_) {
            // Sync may fail if not connected yet; still allow continue
        } finally {
            setSyncing(false);
        }
        router.replace('/(tabs)');
    };

    const skipToApp = () => {
        router.replace('/(tabs)');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.emoji}>📬</Text>
            <Text style={styles.title}>Connect Google</Text>
            <Text style={styles.subtitle}>
                Link your Gmail, Calendar, and Google Tasks so your day plan can include emails, events, and to-dos.
            </Text>

            {connected === true ? (
                <View style={styles.connectedBox}>
                    <Text style={styles.connectedText}>✓ Google connected</Text>
                    <TouchableOpacity
                        style={[styles.primaryButton, syncing && styles.buttonDisabled]}
                        onPress={syncAndContinue}
                        disabled={syncing}
                    >
                        {syncing ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Sync & continue</Text>
                        )}
                    </TouchableOpacity>
                </View>
            ) : (
                <>
                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.buttonDisabled]}
                        onPress={openGoogleAuth}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Connect with Google</Text>
                        )}
                    </TouchableOpacity>
                    <Text style={styles.hint}>
                        You’ll sign in in your browser, then return here.
                    </Text>
                    <TouchableOpacity style={styles.refreshButton} onPress={checkStatus}>
                        <Text style={styles.refreshText}>I’ve connected — refresh status</Text>
                    </TouchableOpacity>
                </>
            )}

            <TouchableOpacity style={styles.skipButton} onPress={skipToApp}>
                <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        paddingTop: 80,
        paddingHorizontal: 28,
    },
    emoji: {
        fontSize: 56,
        textAlign: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    primaryButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
    hint: {
        fontSize: 13,
        color: Colors.textMuted,
        textAlign: 'center',
        marginBottom: 20,
    },
    refreshButton: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    refreshText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    connectedBox: {
        marginBottom: 24,
    },
    connectedText: {
        color: Colors.success,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 16,
    },
    skipButton: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
    },
    skipText: {
        color: Colors.textMuted,
        fontSize: 14,
    },
});
