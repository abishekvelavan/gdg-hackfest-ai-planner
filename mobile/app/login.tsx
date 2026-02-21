import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { AnimatedEntry } from '../components/AnimatedScreen';

const Colors = {
    bg: '#000000',
    surface: '#0A0A0A',
    surfaceLight: '#141414',
    primary: '#FFFFFF',
    primaryDark: '#D4D4D4',
    text: '#FFFFFF',
    textSecondary: '#A3A3A3',
    textMuted: '#525252',
    border: '#333333',
    error: '#FF4444',
    success: '#00FF00',
};

export default function LoginScreen() {
    const router = useRouter();
    const { user, loading: authLoading, login, register } = useAuth();

    const [isSignup, setIsSignup] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Handle initial app load / auto-login
    useEffect(() => {
        let mounted = true;
        const checkExistingSession = async () => {
            if (!authLoading && user) {
                try {
                    const profile = await api.getProfile(user.user_id);
                    if (mounted) {
                        if (profile && profile.name) {
                            router.replace('/(tabs)');
                        } else {
                            router.replace('/welcome');
                        }
                    }
                } catch (e) {
                    if (mounted) router.replace('/welcome');
                }
            }
        };
        checkExistingSession();
        return () => { mounted = false; };
    }, [user, authLoading]);

    const handleSubmit = async () => {
        setError('');

        if (!email.trim() || !password.trim()) {
            setError('Email and password are required');
            return;
        }

        if (isSignup && password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            if (isSignup) {
                await register(email, password, name);
                // Newly registered users always go to onboarding
                router.replace('/welcome');
            } else {
                await login(email, password);
                // The useEffect will automatically pick up the new user state and route accordingly
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
            setLoading(false); // Only stop loading if there is an error, otherwise let the redirect happen
        }
    };

    if (authLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                <AnimatedEntry type="scaleIn" delay={0}>
                    <View style={styles.header}>
                        <Image
                            source={require('../assets/images/icon.png')}
                            style={styles.logoImage}
                        />
                        <Text style={styles.subtitle}>
                            {isSignup ? 'Create your account' : 'Welcome back!'}
                        </Text>
                    </View>
                </AnimatedEntry>

                <AnimatedEntry delay={200}>
                    <View style={styles.form}>
                        {isSignup && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>NAME</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Your full name"
                                    placeholderTextColor={Colors.textMuted}
                                    autoCapitalize="words"
                                />
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>EMAIL</Text>
                            <TextInput
                                style={styles.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="you@example.com"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>PASSWORD</Text>
                            <TextInput
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="••••••••"
                                placeholderTextColor={Colors.textMuted}
                                secureTextEntry
                            />
                        </View>

                        {isSignup && (
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>CONFIRM PASSWORD</Text>
                                <TextInput
                                    style={styles.input}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="••••••••"
                                    placeholderTextColor={Colors.textMuted}
                                    secureTextEntry
                                />
                            </View>
                        )}

                        {error ? (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>⚠️ {error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {isSignup ? 'Create Account' : 'Log In'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.switchButton}
                            onPress={() => {
                                setIsSignup(!isSignup);
                                setError('');
                            }}
                        >
                            <Text style={styles.switchText}>
                                {isSignup
                                    ? 'Already have an account? '
                                    : "Don't have an account? "}
                                <Text style={styles.switchTextBold}>
                                    {isSignup ? 'Log In' : 'Sign Up'}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </AnimatedEntry>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingVertical: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoImage: {
        width: 120,
        height: 120,
        borderRadius: 28,
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 8,
    },
    tagline: {
        fontSize: 14,
        color: Colors.textMuted,
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 17,
        color: Colors.textSecondary,
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        gap: 6,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textSecondary,
        letterSpacing: 1.2,
        marginLeft: 4,
    },
    input: {
        backgroundColor: Colors.surfaceLight,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 15,
        fontSize: 16,
        color: Colors.text,
        borderWidth: 1.5,
        borderColor: Colors.border,
    },
    errorContainer: {
        backgroundColor: Colors.error + '15',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.error + '30',
    },
    errorText: {
        color: Colors.error,
        fontSize: 14,
        textAlign: 'center',
    },
    button: {
        backgroundColor: Colors.primary,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#000000',
        fontSize: 17,
        fontWeight: '700',
    },
    switchButton: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    switchText: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    switchTextBold: {
        color: Colors.primary,
        fontWeight: '700',
    },
});
