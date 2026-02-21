import React, { useState, useCallback, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import Colors from '../../constants/Colors';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { AnimatedEntry, PulseAnimation } from '../../components/AnimatedScreen';

export default function SleepScreen() {
    const { user } = useAuth();
    const [isLogging, setIsLogging] = useState(false);
    const [wakeTime, setWakeTime] = useState('');
    const [agentResponse, setAgentResponse] = useState('');
    const [error, setError] = useState('');
    const [sleepHistory, setSleepHistory] = useState('');
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hasLoggedSleep, setHasLoggedSleep] = useState(false);

    const logSleep = useCallback(async () => {
        if (!user) {
            setError('User session not found. Please log in again.');
            return;
        }
        setIsLogging(true);
        setError('');

        try {
            const bedtime = new Date().toISOString();
            const response = await api.logSleep(bedtime, user.user_id);

            setAgentResponse(response.response);
            setHasLoggedSleep(true);

            if (response.wake_time) {
                const wake = new Date(response.wake_time);
                setWakeTime(wake.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
        } catch (err: any) {
            setError(err.message || 'Failed to log sleep');
        } finally {
            setIsLogging(false);
        }
    }, [user]);

    const fetchSleepHistory = useCallback(async () => {
        if (!user) return;
        setIsLoadingHistory(true);
        try {
            const response = await api.chat('Show my sleep history for the last 7 days', user.user_id);
            setSleepHistory(response.response);
        } catch (err: any) {
            setSleepHistory('Could not fetch sleep history: ' + (err.message || 'Unknown error'));
        } finally {
            setIsLoadingHistory(false);
        }
    }, [user]);

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Stars Background Simulation */}
            <View style={styles.starsContainer}>
                {[...Array(20)].map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.star,
                            {
                                top: Math.random() * 200,
                                left: Math.random() * 300 + 20,
                                width: Math.random() * 3 + 1,
                                height: Math.random() * 3 + 1,
                                opacity: Math.random() * 0.7 + 0.3,
                            },
                        ]}
                    />
                ))}
            </View>

            {/* Moon */}
            <AnimatedEntry type="scaleIn" delay={0}>
                <View style={styles.moonContainer}>
                    <Text style={styles.moonEmoji}>🌙</Text>
                </View>
            </AnimatedEntry>

            {!hasLoggedSleep ? (
                <>
                    {/* Main Sleep Button */}
                    <AnimatedEntry delay={150}>
                        <Text style={styles.title}>Ready for bed?</Text>
                    </AnimatedEntry>
                    <AnimatedEntry delay={300}>
                        <Text style={styles.subtitle}>
                            Tap below to log your bedtime.{'\n'}I'll calculate your optimal wake time.
                        </Text>
                    </AnimatedEntry>

                    <AnimatedEntry type="scaleIn" delay={450}>
                        <PulseAnimation intensity={0.03}>
                            <TouchableOpacity
                                style={[styles.sleepButton, isLogging && styles.sleepButtonDisabled]}
                                onPress={logSleep}
                                disabled={isLogging}
                                activeOpacity={0.8}
                            >
                                {isLogging ? (
                                    <ActivityIndicator size="large" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Text style={styles.sleepButtonEmoji}>😴</Text>
                                        <Text style={styles.sleepButtonText}>Going to Sleep</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </PulseAnimation>
                    </AnimatedEntry>

                    {error ? (
                        <View style={styles.errorCard}>
                            <Text style={styles.errorText}>⚠️ {error}</Text>
                        </View>
                    ) : null}
                </>
            ) : (
                <>
                    {/* Sleep Logged State */}
                    <Text style={styles.goodnightTitle}>Good Night! 🌟</Text>

                    {wakeTime ? (
                        <View style={styles.wakeTimeCard}>
                            <Text style={styles.wakeTimeLabel}>Alarm set for</Text>
                            <Text style={styles.wakeTimeValue}>{wakeTime}</Text>
                            <Text style={styles.wakeTimeSubtext}>⏰ I'll generate your morning plan then</Text>
                        </View>
                    ) : null}

                    {agentResponse ? (
                        <View style={styles.responseCard}>
                            <Text style={styles.responseText}>{agentResponse}</Text>
                        </View>
                    ) : null}

                    {/* Reset Button */}
                    <TouchableOpacity
                        style={styles.resetButton}
                        onPress={() => {
                            setHasLoggedSleep(false);
                            setWakeTime('');
                            setAgentResponse('');
                        }}
                    >
                        <Text style={styles.resetButtonText}>↩ Log another bedtime</Text>
                    </TouchableOpacity>
                </>
            )}

            {/* Sleep History Section */}
            <View style={styles.divider} />
            <TouchableOpacity
                style={styles.historyButton}
                onPress={fetchSleepHistory}
                disabled={isLoadingHistory}
            >
                {isLoadingHistory ? (
                    <ActivityIndicator size="small" color={Colors.sleepAccent} />
                ) : (
                    <Text style={styles.historyButtonText}>📊 View Sleep History</Text>
                )}
            </TouchableOpacity>

            {sleepHistory ? (
                <View style={styles.historyCard}>
                    <Text style={styles.historyText}>{sleepHistory}</Text>
                </View>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.sleepBg,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 40,
        alignItems: 'center',
    },
    starsContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 250,
    },
    star: {
        position: 'absolute',
        backgroundColor: Colors.sleepStar,
        borderRadius: 10,
    },
    moonContainer: {
        marginTop: 20,
        marginBottom: 16,
    },
    moonEmoji: {
        fontSize: 64,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
    },
    sleepButton: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#0A0A0A',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        marginBottom: 24,
    },
    sleepButtonDisabled: {
        opacity: 0.7,
    },
    sleepButtonEmoji: {
        fontSize: 40,
        marginBottom: 8,
    },
    sleepButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    goodnightTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 20,
    },
    wakeTimeCard: {
        backgroundColor: Colors.sleepAccent + '20',
        borderRadius: 16,
        paddingHorizontal: 32,
        paddingVertical: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.sleepAccent + '40',
        marginBottom: 16,
        width: '100%',
    },
    wakeTimeLabel: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    wakeTimeValue: {
        fontSize: 42,
        fontWeight: '800',
        color: Colors.sleepMoon,
        marginBottom: 8,
    },
    wakeTimeSubtext: {
        fontSize: 12,
        color: Colors.textMuted,
    },
    responseCard: {
        backgroundColor: Colors.surfaceLight,
        borderRadius: 12,
        padding: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 16,
    },
    responseText: {
        color: Colors.text,
        fontSize: 14,
        lineHeight: 21,
    },
    resetButton: {
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    resetButtonText: {
        color: Colors.sleepAccent,
        fontSize: 14,
        fontWeight: '600',
    },
    errorCard: {
        backgroundColor: Colors.error + '15',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.error + '40',
        width: '100%',
    },
    errorText: {
        color: Colors.error,
        fontSize: 14,
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: Colors.border,
        width: '100%',
        marginVertical: 24,
    },
    historyButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: Colors.surfaceLight,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 12,
    },
    historyButtonText: {
        color: Colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    historyCard: {
        backgroundColor: Colors.surfaceLight,
        borderRadius: 12,
        padding: 16,
        width: '100%',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    historyText: {
        color: Colors.text,
        fontSize: 14,
        lineHeight: 21,
    },
});
