import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import Colors from '../constants/Colors';

const LOADING_MESSAGES = [
    'Curating your schedule...',
    'Checking your calendar & priorities...',
    'Building your personalized plan...',
];

interface DayPlanLoaderProps {
    message?: string;
    /** If true, show a rotating message from LOADING_MESSAGES (cycle every 2s). */
    rotatingMessage?: boolean;
    /** Compact layout for chat typing indicator (smaller orb, single line). */
    compact?: boolean;
}

export function DayPlanLoader({ message, rotatingMessage = false, compact = false }: DayPlanLoaderProps) {
    const rotationY = useSharedValue(0);
    const rotationX = useSharedValue(0);
    const innerScale = useSharedValue(1);
    const [displayMessage, setDisplayMessage] = React.useState(
        message ?? LOADING_MESSAGES[0]
    );

    useEffect(() => {
        rotationY.value = withRepeat(
            withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
            -1,
            false
        );
        rotationX.value = withRepeat(
            withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
            -1,
            false
        );
        innerScale.value = withRepeat(
            withTiming(1.15, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    useEffect(() => {
        if (!rotatingMessage) return;
        const i = setInterval(() => {
            setDisplayMessage((prev) => {
                const idx = LOADING_MESSAGES.indexOf(prev);
                return LOADING_MESSAGES[(idx + 1) % LOADING_MESSAGES.length];
            });
        }, 2200);
        return () => clearInterval(i);
    }, [rotatingMessage]);

    const ringStyle = useAnimatedStyle(() => {
        const rotateY = interpolate(rotationY.value, [0, 1], [0, 360]);
        const rotateX = interpolate(rotationX.value, [0, 1], [0, 180]);
        return {
            transform: [
                { perspective: 400 },
                { rotateY: `${rotateY}deg` },
                { rotateX: `${rotateX}deg` },
            ],
        };
    });

    const innerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: innerScale.value }],
    }));

    return (
        <View style={[styles.container, compact && styles.containerCompact]}>
            <View style={[styles.orbContainer, compact && styles.orbContainerCompact]}>
                <Animated.View style={[styles.ring, compact && styles.ringCompact, ringStyle]}>
                    <View style={[styles.ringInner, compact && styles.ringInnerCompact]} />
                </Animated.View>
                <Animated.View style={[styles.orb, compact && styles.orbCompact, innerStyle]} />
            </View>
            <Text style={[styles.message, compact && styles.messageCompact]} numberOfLines={1}>
                {displayMessage}
            </Text>
            {!compact && <Text style={styles.hint}>Using your profile, calendar & tasks</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
    },
    containerCompact: {
        paddingVertical: 16,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    orbContainer: {
        width: 100,
        height: 100,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    orbContainerCompact: {
        width: 36,
        height: 36,
        marginBottom: 0,
        marginRight: 12,
    },
    ring: {
        position: 'absolute',
        width: 88,
        height: 88,
        borderRadius: 44,
        borderWidth: 3,
        borderColor: Colors.primary + '99',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringCompact: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 2,
    },
    ringInner: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 1,
        borderColor: Colors.primary + '44',
    },
    ringInnerCompact: {
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    orb: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    orbCompact: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    message: {
        color: Colors.text,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 6,
    },
    messageCompact: {
        fontSize: 14,
        marginBottom: 0,
        flex: 1,
        textAlign: 'left',
    },
    hint: {
        color: Colors.textMuted,
        fontSize: 13,
        textAlign: 'center',
    },
});
