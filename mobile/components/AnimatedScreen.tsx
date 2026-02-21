import React, { useEffect } from 'react';
import { ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSpring,
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    SlideInRight,
    SlideInLeft,
    ZoomIn,
} from 'react-native-reanimated';

// Re-export layout animations for easy use across the app
export const Animations = {
    FadeIn,
    FadeInDown,
    FadeInUp,
    SlideInRight,
    SlideInLeft,
    ZoomIn,
};

interface AnimatedEntryProps {
    children: React.ReactNode;
    delay?: number;
    duration?: number;
    style?: ViewStyle | ViewStyle[];
    type?: 'fadeUp' | 'fadeIn' | 'scaleIn' | 'slideRight';
}

/**
 * Wraps child components with a smooth entrance animation.
 * Use `delay` to stagger multiple items for a cascading effect.
 */
export function AnimatedEntry({
    children,
    delay = 0,
    duration = 600,
    style,
    type = 'fadeUp',
}: AnimatedEntryProps) {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(type === 'fadeUp' ? 30 : 0);
    const translateX = useSharedValue(type === 'slideRight' ? -40 : 0);
    const scale = useSharedValue(type === 'scaleIn' ? 0.85 : 1);

    useEffect(() => {
        opacity.value = withDelay(
            delay,
            withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
        );
        if (type === 'fadeUp') {
            translateY.value = withDelay(
                delay,
                withSpring(0, { damping: 20, stiffness: 90 })
            );
        }
        if (type === 'slideRight') {
            translateX.value = withDelay(
                delay,
                withSpring(0, { damping: 20, stiffness: 90 })
            );
        }
        if (type === 'scaleIn') {
            scale.value = withDelay(
                delay,
                withSpring(1, { damping: 12, stiffness: 100 })
            );
        }
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [
            { translateY: translateY.value },
            { translateX: translateX.value },
            { scale: scale.value },
        ],
    }));

    return (
        <Animated.View style={[animStyle, style]}>
            {children}
        </Animated.View>
    );
}

interface PulseProps {
    children: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
    intensity?: number;
}

/**
 * Wraps a child in a subtle infinite pulsing animation.
 * Great for CTA buttons or sleep buttons.
 */
export function PulseAnimation({ children, style, intensity = 0.04 }: PulseProps) {
    const scale = useSharedValue(1);

    useEffect(() => {
        const pulse = () => {
            scale.value = withTiming(1 + intensity, { duration: 1200, easing: Easing.inOut(Easing.ease) }, () => {
                scale.value = withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) });
            });
        };
        pulse();
        const interval = setInterval(pulse, 2400);
        return () => clearInterval(interval);
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={[animStyle, style]}>
            {children}
        </Animated.View>
    );
}
