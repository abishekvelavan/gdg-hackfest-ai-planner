import React, { useState, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import Colors from '../../constants/Colors';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { AnimatedEntry } from '../../components/AnimatedScreen';

type ProfileField = {
    key: string;
    label: string;
    emoji: string;
    placeholder: string;
    multiline?: boolean;
};

const PROFILE_FIELDS: ProfileField[] = [
    { key: 'name', label: 'Name', emoji: '👤', placeholder: 'Your name' },
    { key: 'work_hours', label: 'Work Hours', emoji: '🏢', placeholder: 'e.g. 9 AM - 5 PM' },
    { key: 'home_address', label: 'Home Address', emoji: '🏠', placeholder: 'Your home address' },
    { key: 'office_address', label: 'Office Address', emoji: '🏬', placeholder: 'Work/school address' },
    { key: 'energy_type', label: 'Energy Type', emoji: '⚡', placeholder: 'morning person or night owl' },
    { key: 'peak_focus_hours', label: 'Peak Focus Hours', emoji: '🎯', placeholder: 'e.g. 9 AM - 12 PM' },
    { key: 'transport', label: 'Transport (comma separated)', emoji: '🚗', placeholder: 'car, bike, walk, or transit' },
    { key: 'exercise_preferences', label: 'Exercise Preferences', emoji: '🏃', placeholder: 'e.g. gym at 6 PM' },
    { key: 'hobbies', label: 'Hobbies (comma separated)', emoji: '🎮', placeholder: 'reading, gaming, cooking...' },
];

export default function ProfileScreen() {
    const { user, logout } = useAuth();
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [saveStatus, setSaveStatus] = useState('');
    const [serverStatus, setServerStatus] = useState<string | null>(null);

    // Fetch profile on mount
    useEffect(() => {
        if (user) {
            fetchProfile();
            checkHealth();
        }
    }, [user]);

    const checkHealth = useCallback(async () => {
        try {
            const health = await api.healthCheck();
            setServerStatus(health.status === 'healthy' ? 'connected' : 'error');
        } catch {
            setServerStatus('offline');
        }
    }, []);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        setIsFetching(true);
        setError('');

        try {
            const profile = await api.getProfile(user.user_id);
            if (profile) {
                // Flatten complex structure for simple text inputs if needed
                const simpleData: Record<string, string> = { ...profile };

                // Handle complex fields like transport (array) or exercise (list of dicts)
                if (Array.isArray(profile.transport)) {
                    simpleData.transport = profile.transport.join(', ');
                }
                if (Array.isArray(profile.exercise)) {
                    simpleData.exercise_preferences = profile.exercise.map((e: any) => `${e.activity} at ${e.time}`).join(', ');
                }
                if (Array.isArray(profile.hobbies)) {
                    simpleData.hobbies = profile.hobbies.map((h: any) => h.activity ? `${h.activity} at ${h.time}` : h).join(', ');
                }

                setFormData(simpleData);
            }
        } catch (err: any) {
            console.log('Could not fetch existing profile:', err.message);
            setError('Failed to load profile from server.');
        } finally {
            setIsFetching(false);
        }
    }, [user]);

    const saveProfile = useCallback(async () => {
        if (!user) return;
        setIsSaving(true);
        setError('');
        setSaveStatus('');

        try {
            await api.saveProfile(formData, user.user_id);
            setSaveStatus('✅ Profile saved!');
            setTimeout(() => setSaveStatus(''), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to save profile');
        } finally {
            setIsSaving(false);
        }
    }, [formData, user]);

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout', style: 'destructive', onPress: async () => {
                    await logout();
                }
            },
        ]);
    };

    const updateField = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Server Status Badge */}
            <AnimatedEntry delay={0} type="fadeIn">
                <View style={styles.statusBar}>
                    <View style={[
                        styles.statusDot,
                        { backgroundColor: serverStatus === 'connected' ? Colors.success : serverStatus === 'offline' ? Colors.error : Colors.warning }
                    ]} />
                    <Text style={styles.statusText}>
                        {serverStatus === 'connected' ? 'Backend connected' : serverStatus === 'offline' ? 'Backend offline' : 'Checking...'}
                    </Text>
                </View>
            </AnimatedEntry>

            {/* Header */}
            <AnimatedEntry delay={100}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Your Profile</Text>
                        <Text style={styles.userEmail}>{user?.email}</Text>
                    </View>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.subtitle}>
                    These preferences help the agent optimize your day plan.
                </Text>
            </AnimatedEntry>

            {isFetching ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading your profile...</Text>
                </View>
            ) : (
                <>
                    {/* Profile Fields */}
                    {PROFILE_FIELDS.map((field, index) => (
                        <AnimatedEntry key={field.key} delay={200 + index * 80}>
                            <View style={styles.fieldContainer}>
                                <Text style={styles.fieldLabel}>
                                    {field.emoji} {field.label}
                                </Text>
                                <TextInput
                                    style={[styles.fieldInput, field.multiline && styles.fieldInputMultiline]}
                                    value={formData[field.key] || ''}
                                    onChangeText={(value) => updateField(field.key, value)}
                                    placeholder={field.placeholder}
                                    placeholderTextColor={Colors.textMuted}
                                    multiline={field.multiline}
                                />
                            </View>
                        </AnimatedEntry>
                    ))}

                    {/* Error */}
                    {error ? (
                        <View style={styles.errorCard}>
                            <Text style={styles.errorText}>⚠️ {error}</Text>
                        </View>
                    ) : null}

                    {/* Save Status */}
                    {saveStatus ? (
                        <Text style={styles.saveStatusText}>{saveStatus}</Text>
                    ) : null}

                    {/* Save Button */}
                    <TouchableOpacity
                        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                        onPress={saveProfile}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.saveButtonText}>💾 Save Profile</Text>
                        )}
                    </TouchableOpacity>

                    {/* Refresh Button */}
                    <TouchableOpacity style={styles.refreshButton} onPress={fetchProfile}>
                        <Text style={styles.refreshButtonText}>🔄 Refresh from server</Text>
                    </TouchableOpacity>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    statusBar: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        marginBottom: 12,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        color: Colors.textMuted,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 6,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    userEmail: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    logoutButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: Colors.error + '20',
        borderWidth: 1,
        borderColor: Colors.error + '40',
    },
    logoutText: {
        color: Colors.error,
        fontSize: 13,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 24,
        lineHeight: 20,
    },
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        color: Colors.textSecondary,
        fontSize: 14,
        marginTop: 12,
    },
    fieldContainer: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 6,
    },
    fieldInput: {
        backgroundColor: Colors.surfaceLight,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: Colors.text,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    fieldInputMultiline: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    errorCard: {
        backgroundColor: Colors.error + '15',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: Colors.error + '40',
        marginBottom: 12,
    },
    errorText: {
        color: Colors.error,
        fontSize: 14,
        textAlign: 'center',
    },
    saveStatusText: {
        color: Colors.success,
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 12,
    },
    saveButton: {
        backgroundColor: Colors.primary,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveButtonText: {
        color: '#000000',
        fontSize: 16,
        fontWeight: '700',
    },
    refreshButton: {
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 8,
    },
    refreshButtonText: {
        color: Colors.textSecondary,
        fontSize: 14,
    },
});
