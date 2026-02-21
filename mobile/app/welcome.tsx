import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import { api } from '../services/api';

const { width } = Dimensions.get('window');

const STEPS = [
    {
        key: 'name',
        emoji: '👋',
        title: 'What should I call you?',
        subtitle: 'Let\'s start with your name',
        placeholder: 'Your name',
        field: 'Name',
    },
    {
        key: 'location',
        emoji: '📍',
        title: 'Where are you based?',
        subtitle: 'Your home and work/school addresses',
        fields: [
            { key: 'home_address', placeholder: 'Home address', label: 'Home Address' },
            { key: 'office_address', placeholder: 'Work/school address', label: 'Office Address' },
        ],
    },
    {
        key: 'timings',
        emoji: '🕐',
        title: 'Your schedule',
        subtitle: 'When do you work or study?',
        fields: [
            { key: 'work_hours', placeholder: 'e.g. 9 AM - 5 PM', label: 'Work Hours' },
            { key: 'energy_type', placeholder: 'Morning person or night owl?', label: 'Energy Type' },
            { key: 'peak_focus_hours', placeholder: 'e.g. 9 AM - 12 PM', label: 'Peak Focus Hours' },
        ],
    },
    {
        key: 'hobbies',
        emoji: '🎯',
        title: 'Hobbies & preferences',
        subtitle: 'What do you enjoy? How do you commute?',
        fields: [
            { key: 'hobbies', placeholder: 'Reading, gaming, cooking...', label: 'Hobbies' },
            { key: 'transport', placeholder: 'Car, bike, walk, transit', label: 'Transport' },
            { key: 'exercise_preferences', placeholder: 'e.g. gym at 6 PM', label: 'Exercise' },
        ],
    },
    {
        key: 'goals',
        emoji: '🚀',
        title: 'Your goals',
        subtitle: 'What do you want to achieve? How much sleep do you need?',
        fields: [
            { key: 'goals', placeholder: 'What are your goals for the day planner?', label: 'Goals', multiline: true },
            { key: 'sleep_target', placeholder: '7.5', label: 'Sleep target (hours)' },
        ],
    },
];

export default function WelcomeScreen() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const step = STEPS[currentStep];
    const isLastStep = currentStep === STEPS.length - 1;
    const isFirstStep = currentStep === 0;

    const updateField = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const canProceed = () => {
        if (step.key === 'name') {
            return (formData['name'] || '').trim().length > 0;
        }
        return true; // other steps are optional
    };

    const handleNext = async () => {
        if (isLastStep) {
            await saveProfile();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const saveProfile = async () => {
        setIsSaving(true);
        setError('');

        try {
            // Build a natural profile message for the agent
            const parts: string[] = [];
            if (formData.name) parts.push(`Name: ${formData.name}`);
            if (formData.home_address) parts.push(`Home Address: ${formData.home_address}`);
            if (formData.office_address) parts.push(`Office Address: ${formData.office_address}`);
            if (formData.work_hours) parts.push(`Work Hours: ${formData.work_hours}`);
            if (formData.energy_type) parts.push(`Energy Type: ${formData.energy_type}`);
            if (formData.peak_focus_hours) parts.push(`Peak Focus Hours: ${formData.peak_focus_hours}`);
            if (formData.transport) parts.push(`Transport: ${formData.transport}`);
            if (formData.exercise_preferences) parts.push(`Exercise Preferences: ${formData.exercise_preferences}`);
            if (formData.sleep_target) parts.push(`Sleep Target: ${formData.sleep_target} hours`);
            if (formData.hobbies) parts.push(`Hobbies: ${formData.hobbies}`);
            if (formData.goals) parts.push(`Goals: ${formData.goals}`);

            const message = `Save my profile with these details:\n${parts.join('\n')}`;
            await api.chat(message);

            // Navigate to main app
            router.replace('/(tabs)');
        } catch (err: any) {
            setError(err.message || 'Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                {STEPS.map((_, idx) => (
                    <View
                        key={idx}
                        style={[
                            styles.progressDot,
                            idx <= currentStep && styles.progressDotActive,
                        ]}
                    />
                ))}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Step Header */}
                <Text style={styles.stepEmoji}>{step.emoji}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSubtitle}>{step.subtitle}</Text>

                {/* Single field step (name) */}
                {step.key === 'name' && (
                    <View style={styles.fieldContainer}>
                        <TextInput
                            style={styles.fieldInputLarge}
                            value={formData['name'] || ''}
                            onChangeText={(v) => updateField('name', v)}
                            placeholder={step.placeholder}
                            placeholderTextColor={Colors.textMuted}
                            autoFocus
                            autoCapitalize="words"
                        />
                    </View>
                )}

                {/* Multi-field steps */}
                {'fields' in step && step.fields && step.fields.map((field: any) => (
                    <View key={field.key} style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <TextInput
                            style={[styles.fieldInput, field.multiline && styles.fieldInputMultiline]}
                            value={formData[field.key] || ''}
                            onChangeText={(v) => updateField(field.key, v)}
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
            </ScrollView>

            {/* Bottom Navigation */}
            <View style={styles.bottomBar}>
                {!isFirstStep ? (
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                ) : (
                    <View />
                )}

                <TouchableOpacity
                    style={[
                        styles.nextButton,
                        !canProceed() && styles.nextButtonDisabled,
                        isLastStep && styles.finishButton,
                    ]}
                    onPress={handleNext}
                    disabled={!canProceed() || isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <Text style={styles.nextButtonText}>
                            {isLastStep ? '🚀 Let\'s Go!' : 'Next →'}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Skip Link */}
            {!isLastStep && (
                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={() => router.replace('/(tabs)')}
                >
                    <Text style={styles.skipText}>Skip for now</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
        paddingTop: 60,
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 40,
        marginBottom: 20,
    },
    progressDot: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.surfaceElevated,
    },
    progressDotActive: {
        backgroundColor: Colors.primary,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 28,
        paddingTop: 20,
        paddingBottom: 20,
    },
    stepEmoji: {
        fontSize: 56,
        textAlign: 'center',
        marginBottom: 16,
    },
    stepTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 8,
    },
    stepSubtitle: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    fieldContainer: {
        marginBottom: 18,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    fieldInput: {
        backgroundColor: Colors.surfaceLight,
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: Colors.text,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    fieldInputLarge: {
        backgroundColor: Colors.surfaceLight,
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 18,
        fontSize: 22,
        color: Colors.text,
        borderWidth: 1.5,
        borderColor: Colors.primary + '60',
        textAlign: 'center',
    },
    fieldInputMultiline: {
        minHeight: 90,
        textAlignVertical: 'top',
    },
    errorCard: {
        backgroundColor: Colors.error + '15',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: Colors.error + '40',
        marginTop: 8,
    },
    errorText: {
        color: Colors.error,
        fontSize: 14,
        textAlign: 'center',
    },
    bottomBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingVertical: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    backButton: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backButtonText: {
        color: Colors.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    },
    nextButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 14,
        minWidth: 120,
        alignItems: 'center',
    },
    nextButtonDisabled: {
        backgroundColor: Colors.surfaceElevated,
    },
    finishButton: {
        backgroundColor: Colors.success,
        paddingHorizontal: 32,
    },
    nextButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: 12,
        paddingBottom: 20,
    },
    skipText: {
        color: Colors.textMuted,
        fontSize: 13,
    },
});
