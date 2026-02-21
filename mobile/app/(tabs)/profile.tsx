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
    { key: 'transport', label: 'Transport', emoji: '🚗', placeholder: 'car, bike, walk, or transit' },
    { key: 'exercise_preferences', label: 'Exercise', emoji: '🏃', placeholder: 'e.g. gym at 6 PM' },
    { key: 'sleep_target', label: 'Sleep Target (hours)', emoji: '😴', placeholder: '7.5' },
    { key: 'hobbies', label: 'Hobbies', emoji: '🎮', placeholder: 'reading, gaming, cooking...' },
];

export default function ProfileScreen() {
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [saveStatus, setSaveStatus] = useState('');
    const [serverStatus, setServerStatus] = useState<string | null>(null);

    // Fetch profile on mount
    useEffect(() => {
        fetchProfile();
        checkHealth();
    }, []);

    const checkHealth = useCallback(async () => {
        try {
            const health = await api.healthCheck();
            setServerStatus(health.status === 'healthy' ? 'connected' : 'error');
        } catch {
            setServerStatus('offline');
        }
    }, []);

    const fetchProfile = useCallback(async () => {
        setIsFetching(true);
        setError('');

        try {
            const response = await api.chat('Show me my current profile settings. List each field and its value.');
            // Try to extract field values from the response
            const text = response.response;
            const newData: Record<string, string> = {};

            for (const field of PROFILE_FIELDS) {
                // Look for patterns like "Name: John" or "name: John" in the response
                const regex = new RegExp(`${field.label}[:\\s]+([^\\n]+)`, 'i');
                const match = text.match(regex);
                if (match) {
                    newData[field.key] = match[1].trim().replace(/^\*\*|\*\*$/g, '');
                }
            }

            if (Object.keys(newData).length > 0) {
                setFormData(newData);
            }
        } catch (err: any) {
            // Not critical — user can fill in manually
            console.log('Could not fetch existing profile:', err.message);
        } finally {
            setIsFetching(false);
        }
    }, []);

    const saveProfile = useCallback(async () => {
        const filledFields = Object.entries(formData).filter(([_, v]) => v.trim());
        if (filledFields.length === 0) {
            Alert.alert('No data', 'Please fill in at least some fields before saving.');
            return;
        }

        setIsSaving(true);
        setError('');
        setSaveStatus('');

        try {
            // Build a natural language message for the agent to save the profile
            const parts = filledFields.map(([key, value]) => {
                const field = PROFILE_FIELDS.find(f => f.key === key);
                return `${field?.label || key}: ${value}`;
            });

            const message = `Save my profile with these details:\n${parts.join('\n')}`;
            const response = await api.chat(message);

            setSaveStatus('✅ Profile saved!');
            setTimeout(() => setSaveStatus(''), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to save profile');
        } finally {
            setIsSaving(false);
        }
    }, [formData]);

    const updateField = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Server Status Badge */}
            <View style={styles.statusBar}>
                <View style={[
                    styles.statusDot,
                    { backgroundColor: serverStatus === 'connected' ? Colors.success : serverStatus === 'offline' ? Colors.error : Colors.warning }
                ]} />
                <Text style={styles.statusText}>
                    {serverStatus === 'connected' ? 'Backend connected' : serverStatus === 'offline' ? 'Backend offline' : 'Checking...'}
                </Text>
            </View>

            {/* Header */}
            <Text style={styles.title}>Your Profile</Text>
            <Text style={styles.subtitle}>
                These preferences help the agent optimize your day plan.
            </Text>

            {isFetching ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={styles.loadingText}>Loading your profile...</Text>
                </View>
            ) : (
                <>
                    {/* Profile Fields */}
                    {PROFILE_FIELDS.map((field) => (
                        <View key={field.key} style={styles.fieldContainer}>
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
                            <ActivityIndicator color="#FFF" />
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
        color: '#FFF',
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
