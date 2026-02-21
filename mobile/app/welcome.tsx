import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '../constants/Colors';
import { api } from '../services/api';

// --- Selectable Chip Component ---
function Chip({
    label,
    selected,
    onPress,
    emoji,
}: {
    label: string;
    selected: boolean;
    onPress: () => void;
    emoji?: string;
}) {
    return (
        <TouchableOpacity
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {emoji && <Text style={styles.chipEmoji}>{emoji}</Text>}
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        </TouchableOpacity>
    );
}

// --- Multi-Select Chip Group ---
function ChipGroup({
    options,
    selected,
    onToggle,
    multi = false,
}: {
    options: { label: string; value: string; emoji?: string }[];
    selected: string[];
    onToggle: (value: string) => void;
    multi?: boolean;
}) {
    return (
        <View style={styles.chipGroup}>
            {options.map((opt) => (
                <Chip
                    key={opt.value}
                    label={opt.label}
                    emoji={opt.emoji}
                    selected={selected.includes(opt.value)}
                    onPress={() => onToggle(opt.value)}
                />
            ))}
        </View>
    );
}

// --- Stepper Control ---
function Stepper({
    value,
    min,
    max,
    step,
    unit,
    onValueChange,
}: {
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onValueChange: (v: number) => void;
}) {
    return (
        <View style={styles.stepperContainer}>
            <TouchableOpacity
                style={[styles.stepperButton, value <= min && styles.stepperButtonDisabled]}
                onPress={() => value > min && onValueChange(parseFloat((value - step).toFixed(1)))}
                disabled={value <= min}
            >
                <Text style={styles.stepperButtonText}>−</Text>
            </TouchableOpacity>
            <View style={styles.stepperValue}>
                <Text style={styles.stepperValueText}>{value}</Text>
                <Text style={styles.stepperUnitText}>{unit}</Text>
            </View>
            <TouchableOpacity
                style={[styles.stepperButton, value >= max && styles.stepperButtonDisabled]}
                onPress={() => value < max && onValueChange(parseFloat((value + step).toFixed(1)))}
                disabled={value >= max}
            >
                <Text style={styles.stepperButtonText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

// --- Time Picker Chips ---
const WORK_HOUR_OPTIONS = [
    { label: '9 AM – 5 PM', value: '9 AM - 5 PM', emoji: '🏢' },
    { label: '10 AM – 6 PM', value: '10 AM - 6 PM', emoji: '🏢' },
    { label: '8 AM – 4 PM', value: '8 AM - 4 PM', emoji: '🌅' },
    { label: 'Flexible', value: 'Flexible', emoji: '🔄' },
    { label: 'Night shift', value: 'Night shift', emoji: '🌙' },
    { label: 'Student', value: 'Student hours', emoji: '📚' },
];

const ENERGY_OPTIONS = [
    { label: 'Morning Person', value: 'morning person', emoji: '🌅' },
    { label: 'Night Owl', value: 'night owl', emoji: '🦉' },
    { label: 'Flexible', value: 'flexible', emoji: '⚡' },
];

const FOCUS_OPTIONS = [
    { label: '6–9 AM', value: '6 AM - 9 AM', emoji: '🌄' },
    { label: '9 AM–12 PM', value: '9 AM - 12 PM', emoji: '☀️' },
    { label: '12–3 PM', value: '12 PM - 3 PM', emoji: '🌤️' },
    { label: '3–6 PM', value: '3 PM - 6 PM', emoji: '🌆' },
    { label: '6–9 PM', value: '6 PM - 9 PM', emoji: '🌙' },
    { label: '9 PM–12 AM', value: '9 PM - 12 AM', emoji: '🦉' },
];

const TRANSPORT_OPTIONS = [
    { label: 'Car', value: 'car', emoji: '🚗' },
    { label: 'Bike', value: 'bike', emoji: '🚲' },
    { label: 'Walk', value: 'walk', emoji: '🚶' },
    { label: 'Transit', value: 'transit', emoji: '🚌' },
    { label: 'Train', value: 'train', emoji: '🚆' },
    { label: 'Scooter', value: 'scooter', emoji: '🛵' },
    { label: 'Other', value: '__other_transport__', emoji: '✏️' },
];

const EXERCISE_OPTIONS = [
    { label: 'Gym', value: 'gym', emoji: '🏋️' },
    { label: 'Running', value: 'running', emoji: '🏃' },
    { label: 'Yoga', value: 'yoga', emoji: '🧘' },
    { label: 'Swimming', value: 'swimming', emoji: '🏊' },
    { label: 'Cycling', value: 'cycling', emoji: '🚴' },
    { label: 'Sports', value: 'sports', emoji: '⚽' },
    { label: 'Walking', value: 'walking', emoji: '🚶' },
    { label: 'None', value: 'none', emoji: '🛋️' },
    { label: 'Other', value: '__other_exercise__', emoji: '✏️' },
];

const EXERCISE_TIME_OPTIONS = [
    { label: 'Morning', value: 'morning', emoji: '🌅' },
    { label: 'Afternoon', value: 'afternoon', emoji: '☀️' },
    { label: 'Evening', value: 'evening', emoji: '🌆' },
];

const HOBBY_OPTIONS = [
    { label: 'Reading', value: 'reading', emoji: '📚' },
    { label: 'Gaming', value: 'gaming', emoji: '🎮' },
    { label: 'Cooking', value: 'cooking', emoji: '👨‍🍳' },
    { label: 'Music', value: 'music', emoji: '🎵' },
    { label: 'Art', value: 'art', emoji: '🎨' },
    { label: 'Movies', value: 'movies', emoji: '🎬' },
    { label: 'Travel', value: 'travel', emoji: '✈️' },
    { label: 'Photography', value: 'photography', emoji: '📸' },
    { label: 'Gardening', value: 'gardening', emoji: '🌱' },
    { label: 'Writing', value: 'writing', emoji: '✍️' },
    { label: 'Social', value: 'social', emoji: '👥' },
    { label: 'Coding', value: 'coding', emoji: '💻' },
    { label: 'Other', value: '__other_hobby__', emoji: '✏️' },
];

const GOAL_OPTIONS = [
    { label: 'Be more productive', value: 'productivity', emoji: '📈' },
    { label: 'Better work-life balance', value: 'work-life balance', emoji: '⚖️' },
    { label: 'Exercise regularly', value: 'regular exercise', emoji: '💪' },
    { label: 'Sleep better', value: 'better sleep', emoji: '😴' },
    { label: 'Learn new things', value: 'learning', emoji: '🧠' },
    { label: 'Reduce stress', value: 'reduce stress', emoji: '🧘' },
    { label: 'Stay organized', value: 'stay organized', emoji: '📋' },
    { label: 'More free time', value: 'more free time', emoji: '🕐' },
    { label: 'Other', value: '__other_goal__', emoji: '✏️' },
];

export default function WelcomeScreen() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Form data
    const [name, setName] = useState('');
    const [homeAddress, setHomeAddress] = useState('');
    const [officeAddress, setOfficeAddress] = useState('');
    const [workHours, setWorkHours] = useState('');
    const [energyType, setEnergyType] = useState('');
    const [focusHours, setFocusHours] = useState('');
    const [transports, setTransports] = useState<string[]>([]);
    const [exercises, setExercises] = useState<string[]>([]);
    const [exerciseTime, setExerciseTime] = useState('');
    const [hobbies, setHobbies] = useState<string[]>([]);
    const [goals, setGoals] = useState<string[]>([]);
    const [sleepTarget, setSleepTarget] = useState(7.5);

    // "Other" custom text values
    const [customTransport, setCustomTransport] = useState('');
    const [customExercise, setCustomExercise] = useState('');
    const [customHobby, setCustomHobby] = useState('');
    const [customGoal, setCustomGoal] = useState('');

    const TOTAL_STEPS = 5;
    const isLastStep = currentStep === TOTAL_STEPS - 1;
    const isFirstStep = currentStep === 0;

    const toggleInArray = (arr: string[], value: string, setter: (v: string[]) => void) => {
        setter(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
    };

    const selectSingle = (value: string, setter: (v: string) => void) => {
        setter(value);
    };

    const canProceed = () => {
        if (currentStep === 0) return name.trim().length > 0;
        return true;
    };

    const handleNext = async () => {
        if (isLastStep) {
            await saveProfile();
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (!isFirstStep) setCurrentStep(prev => prev - 1);
    };

    const saveProfile = async () => {
        setIsSaving(true);
        setError('');

        try {
            // Merge selected options with custom "Other" text
            const allTransports = transports.filter(v => v !== '__other_transport__');
            if (transports.includes('__other_transport__') && customTransport.trim()) allTransports.push(customTransport.trim());
            const allExercises = exercises.filter(v => v !== '__other_exercise__');
            if (exercises.includes('__other_exercise__') && customExercise.trim()) allExercises.push(customExercise.trim());
            const allHobbies = hobbies.filter(v => v !== '__other_hobby__');
            if (hobbies.includes('__other_hobby__') && customHobby.trim()) allHobbies.push(customHobby.trim());
            const allGoals = goals.filter(v => v !== '__other_goal__');
            if (goals.includes('__other_goal__') && customGoal.trim()) allGoals.push(customGoal.trim());

            // Save directly to MongoDB via /api/profile
            await api.saveProfile({
                name,
                home_address: homeAddress,
                office_address: officeAddress,
                work_hours: workHours,
                energy_type: energyType,
                peak_focus_hours: focusHours,
                transport: allTransports,
                exercise: allExercises,
                exercise_time: exerciseTime,
                sleep_target: sleepTarget,
                hobbies: allHobbies,
                goals: allGoals,
            });

            router.replace('/(tabs)');
        } catch (err: any) {
            setError(err.message || 'Failed to save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const renderStep = () => {
        switch (currentStep) {
            // --- Step 0: Name ---
            case 0:
                return (
                    <>
                        <Text style={styles.stepEmoji}>👋</Text>
                        <Text style={styles.stepTitle}>Welcome!</Text>
                        <Text style={styles.stepSubtitle}>What should I call you?</Text>
                        <TextInput
                            style={styles.nameInput}
                            value={name}
                            onChangeText={setName}
                            placeholder="Your name"
                            placeholderTextColor={Colors.textMuted}
                            autoFocus
                            autoCapitalize="words"
                        />
                    </>
                );

            // --- Step 1: Location ---
            case 1:
                return (
                    <>
                        <Text style={styles.stepEmoji}>📍</Text>
                        <Text style={styles.stepTitle}>Where are you based?</Text>
                        <Text style={styles.stepSubtitle}>So I can plan routes & travel times</Text>
                        <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>🏠 HOME ADDRESS</Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={homeAddress}
                                onChangeText={setHomeAddress}
                                placeholder="Your home address"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
                        <View style={styles.fieldBlock}>
                            <Text style={styles.fieldLabel}>🏢 WORK / SCHOOL</Text>
                            <TextInput
                                style={styles.fieldInput}
                                value={officeAddress}
                                onChangeText={setOfficeAddress}
                                placeholder="Work or school address"
                                placeholderTextColor={Colors.textMuted}
                            />
                        </View>
                    </>
                );

            // --- Step 2: Schedule ---
            case 2:
                return (
                    <>
                        <Text style={styles.stepEmoji}>🕐</Text>
                        <Text style={styles.stepTitle}>Your schedule</Text>
                        <Text style={styles.stepSubtitle}>Pick what fits you best</Text>

                        <Text style={styles.sectionLabel}>Work / School Hours</Text>
                        <ChipGroup
                            options={WORK_HOUR_OPTIONS}
                            selected={workHours ? [workHours] : []}
                            onToggle={(v) => selectSingle(v, setWorkHours)}
                        />

                        <Text style={styles.sectionLabel}>Energy Type</Text>
                        <ChipGroup
                            options={ENERGY_OPTIONS}
                            selected={energyType ? [energyType] : []}
                            onToggle={(v) => selectSingle(v, setEnergyType)}
                        />

                        <Text style={styles.sectionLabel}>Peak Focus Hours</Text>
                        <ChipGroup
                            options={FOCUS_OPTIONS}
                            selected={focusHours ? [focusHours] : []}
                            onToggle={(v) => selectSingle(v, setFocusHours)}
                        />
                    </>
                );

            // --- Step 3: Lifestyle ---
            case 3:
                return (
                    <>
                        <Text style={styles.stepEmoji}>🎯</Text>
                        <Text style={styles.stepTitle}>Your lifestyle</Text>
                        <Text style={styles.stepSubtitle}>Select all that apply</Text>

                        <Text style={styles.sectionLabel}>How do you commute?</Text>
                        <ChipGroup
                            options={TRANSPORT_OPTIONS}
                            selected={transports}
                            onToggle={(v) => toggleInArray(transports, v, setTransports)}
                            multi
                        />
                        {transports.includes('__other_transport__') && (
                            <TextInput
                                style={styles.otherInput}
                                value={customTransport}
                                onChangeText={setCustomTransport}
                                placeholder="Type your transport..."
                                placeholderTextColor={Colors.textMuted}
                            />
                        )}

                        <Text style={styles.sectionLabel}>Exercise</Text>
                        <ChipGroup
                            options={EXERCISE_OPTIONS}
                            selected={exercises}
                            onToggle={(v) => toggleInArray(exercises, v, setExercises)}
                            multi
                        />
                        {exercises.includes('__other_exercise__') && (
                            <TextInput
                                style={styles.otherInput}
                                value={customExercise}
                                onChangeText={setCustomExercise}
                                placeholder="Type your exercise..."
                                placeholderTextColor={Colors.textMuted}
                            />
                        )}

                        {exercises.length > 0 && !exercises.includes('none') && (
                            <>
                                <Text style={styles.sectionLabel}>Preferred Exercise Time</Text>
                                <ChipGroup
                                    options={EXERCISE_TIME_OPTIONS}
                                    selected={exerciseTime ? [exerciseTime] : []}
                                    onToggle={(v) => selectSingle(v, setExerciseTime)}
                                />
                            </>
                        )}

                        <Text style={styles.sectionLabel}>Hobbies</Text>
                        <ChipGroup
                            options={HOBBY_OPTIONS}
                            selected={hobbies}
                            onToggle={(v) => toggleInArray(hobbies, v, setHobbies)}
                            multi
                        />
                        {hobbies.includes('__other_hobby__') && (
                            <TextInput
                                style={styles.otherInput}
                                value={customHobby}
                                onChangeText={setCustomHobby}
                                placeholder="Type your hobby..."
                                placeholderTextColor={Colors.textMuted}
                            />
                        )}
                    </>
                );

            // --- Step 4: Goals & Sleep ---
            case 4:
                return (
                    <>
                        <Text style={styles.stepEmoji}>🚀</Text>
                        <Text style={styles.stepTitle}>Goals & Sleep</Text>
                        <Text style={styles.stepSubtitle}>What matters most to you?</Text>

                        <Text style={styles.sectionLabel}>Your Goals</Text>
                        <ChipGroup
                            options={GOAL_OPTIONS}
                            selected={goals}
                            onToggle={(v) => toggleInArray(goals, v, setGoals)}
                            multi
                        />
                        {goals.includes('__other_goal__') && (
                            <TextInput
                                style={styles.otherInput}
                                value={customGoal}
                                onChangeText={setCustomGoal}
                                placeholder="Type your goal..."
                                placeholderTextColor={Colors.textMuted}
                            />
                        )}

                        <Text style={styles.sectionLabel}>Sleep Target</Text>
                        <Stepper
                            value={sleepTarget}
                            min={4}
                            max={12}
                            step={0.5}
                            unit="hours"
                            onValueChange={setSleepTarget}
                        />
                    </>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
                {[...Array(TOTAL_STEPS)].map((_, idx) => (
                    <View
                        key={idx}
                        style={[styles.progressDot, idx <= currentStep && styles.progressDotActive]}
                    />
                ))}
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {renderStep()}

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
        paddingTop: 56,
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 40,
        marginBottom: 12,
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
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 20,
    },
    stepEmoji: {
        fontSize: 52,
        textAlign: 'center',
        marginBottom: 12,
    },
    stepTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 6,
    },
    stepSubtitle: {
        fontSize: 15,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    nameInput: {
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
    fieldBlock: {
        marginBottom: 18,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginBottom: 6,
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
    otherInput: {
        backgroundColor: Colors.surfaceLight,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: Colors.text,
        borderWidth: 1,
        borderColor: Colors.primary + '50',
        marginTop: 10,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginTop: 20,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    chipGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceLight,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: Colors.border,
    },
    chipSelected: {
        backgroundColor: Colors.primary + '25',
        borderColor: Colors.primary,
    },
    chipEmoji: {
        fontSize: 14,
        marginRight: 6,
    },
    chipText: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    chipTextSelected: {
        color: Colors.primaryLight,
        fontWeight: '700',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        gap: 16,
    },
    stepperButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.border,
    },
    stepperButtonDisabled: {
        opacity: 0.3,
    },
    stepperButtonText: {
        fontSize: 24,
        color: Colors.text,
        fontWeight: '600',
    },
    stepperValue: {
        alignItems: 'center',
        minWidth: 80,
    },
    stepperValueText: {
        fontSize: 42,
        fontWeight: '800',
        color: Colors.primary,
    },
    stepperUnitText: {
        fontSize: 13,
        color: Colors.textMuted,
        marginTop: -4,
    },
    errorCard: {
        backgroundColor: Colors.error + '15',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: Colors.error + '40',
        marginTop: 16,
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
        paddingHorizontal: 24,
        paddingVertical: 14,
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
        paddingVertical: 10,
        paddingBottom: 18,
    },
    skipText: {
        color: Colors.textMuted,
        fontSize: 13,
    },
});
