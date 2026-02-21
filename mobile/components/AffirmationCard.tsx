import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay
} from 'react-native-reanimated';
import Colors from '../constants/Colors';

type AffirmationCardProps = {
    text: string;
    onDismiss?: () => void;
};

export function AffirmationCard({ text, onDismiss }: AffirmationCardProps) {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(20);

    useEffect(() => {
        opacity.value = withDelay(300, withTiming(1, { duration: 800 }));
        translateY.value = withDelay(300, withTiming(0, { duration: 800 }));
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            opacity: opacity.value,
            transform: [{ translateY: translateY.value }],
        };
    });

    return (
        <Animated.View style={[styles.card, animatedStyle]}>
            <View style={styles.content}>
                <Text style={styles.quoteIcon}>✨</Text>
                <Text style={styles.text}>{text}</Text>

                {onDismiss && (
                    <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
                        <Text style={styles.closeIcon}>✕</Text>
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: 16,
        backgroundColor: Colors.primary + '20', // highly transparent primary
        borderWidth: 1,
        borderColor: Colors.primary + '50',
        overflow: 'hidden',
    },
    content: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    quoteIcon: {
        fontSize: 24,
        marginRight: 12,
        marginTop: -4,
    },
    text: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
        color: Colors.text,
        fontWeight: '500',
        fontStyle: 'italic',
    },
    closeButton: {
        marginLeft: 12,
        padding: 4,
    },
    closeIcon: {
        fontSize: 16,
        color: Colors.textSecondary,
    },
});
