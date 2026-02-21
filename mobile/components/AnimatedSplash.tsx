import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSpring,
    withRepeat,
    withSequence,
    Easing,
    interpolate,
    runOnJS,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Floating particle component
function Particle({ delay, startX, startY, size, duration }: {
    delay: number;
    startX: number;
    startY: number;
    size: number;
    duration: number;
}) {
    const progress = useSharedValue(0);
    const opacity = useSharedValue(0);

    useEffect(() => {
        opacity.value = withDelay(delay, withTiming(0.6, { duration: 800 }));
        progress.value = withDelay(
            delay,
            withRepeat(
                withTiming(1, { duration, easing: Easing.linear }),
                -1,
                false
            )
        );
    }, []);

    const animStyle = useAnimatedStyle(() => {
        const translateY = interpolate(progress.value, [0, 1], [startY, startY - 200]);
        const translateX = interpolate(
            progress.value,
            [0, 0.25, 0.5, 0.75, 1],
            [startX, startX + 15, startX - 10, startX + 8, startX]
        );
        const scale = interpolate(progress.value, [0, 0.5, 1], [0.5, 1.2, 0.3]);
        const particleOpacity = interpolate(progress.value, [0, 0.2, 0.8, 1], [0, 0.7, 0.5, 0]);

        return {
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: '#FFFFFF',
            opacity: particleOpacity * opacity.value,
            transform: [{ translateX }, { translateY }, { scale }],
        };
    });

    return <Animated.View style={animStyle} />;
}

// Connecting line between particles
function GlowLine({ delay, x1, y1, angle, length }: {
    delay: number;
    x1: number;
    y1: number;
    angle: number;
    length: number;
}) {
    const opacity = useSharedValue(0);

    useEffect(() => {
        opacity.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(0.3, { duration: 1500 }),
                    withTiming(0, { duration: 1500 })
                ),
                -1,
                false
            )
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        left: x1,
        top: y1,
        width: length,
        height: 1,
        backgroundColor: '#FFFFFF',
        opacity: opacity.value,
        transform: [{ rotate: `${angle}deg` }],
    }));

    return <Animated.View style={animStyle} />;
}

// Scanning ring animation
function ScanRing({ delay }: { delay: number }) {
    const scale = useSharedValue(0.2);
    const opacity = useSharedValue(0);

    useEffect(() => {
        scale.value = withDelay(
            delay,
            withRepeat(
                withTiming(3, { duration: 3000, easing: Easing.out(Easing.cubic) }),
                -1,
                false
            )
        );
        opacity.value = withDelay(
            delay,
            withRepeat(
                withSequence(
                    withTiming(0.4, { duration: 500 }),
                    withTiming(0, { duration: 2500 })
                ),
                -1,
                false
            )
        );
    }, []);

    const animStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));

    return <Animated.View style={animStyle} />;
}

interface AnimatedSplashProps {
    onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
    // Logo animation values
    const logoScale = useSharedValue(0);
    const logoOpacity = useSharedValue(0);
    const taglineOpacity = useSharedValue(0);
    const taglineTranslateY = useSharedValue(20);
    const containerOpacity = useSharedValue(1);

    // Generate particle data
    const particles = useMemo(() =>
        Array.from({ length: 25 }, (_, i) => ({
            id: i,
            delay: Math.random() * 2000,
            startX: Math.random() * SCREEN_W,
            startY: SCREEN_H * 0.3 + Math.random() * SCREEN_H * 0.6,
            size: Math.random() * 4 + 1,
            duration: 4000 + Math.random() * 3000,
        })),
        []);

    // Generate glow lines
    const glowLines = useMemo(() =>
        Array.from({ length: 8 }, (_, i) => ({
            id: i,
            delay: Math.random() * 3000,
            x1: Math.random() * SCREEN_W,
            y1: Math.random() * SCREEN_H,
            angle: Math.random() * 360,
            length: 40 + Math.random() * 80,
        })),
        []);

    useEffect(() => {
        // Phase 1: Logo appears with spring
        logoOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
        logoScale.value = withDelay(400, withSpring(1, { damping: 12, stiffness: 80 }));

        // Phase 2: Tagline fades up
        taglineOpacity.value = withDelay(1200, withTiming(1, { duration: 600 }));
        taglineTranslateY.value = withDelay(1200, withSpring(0, { damping: 15 }));

        // Phase 3: Entire splash fades out
        const timeout = setTimeout(() => {
            containerOpacity.value = withTiming(0, { duration: 500 }, () => {
                runOnJS(onFinish)();
            });
        }, 3000);

        return () => clearTimeout(timeout);
    }, []);

    const logoAnimStyle = useAnimatedStyle(() => ({
        opacity: logoOpacity.value,
        transform: [{ scale: logoScale.value }],
    }));

    const taglineAnimStyle = useAnimatedStyle(() => ({
        opacity: taglineOpacity.value,
        transform: [{ translateY: taglineTranslateY.value }],
    }));

    const containerAnimStyle = useAnimatedStyle(() => ({
        opacity: containerOpacity.value,
    }));

    return (
        <Animated.View style={[styles.container, containerAnimStyle]}>
            {/* Animated particle background */}
            <View style={styles.particleLayer}>
                {particles.map(p => (
                    <Particle
                        key={p.id}
                        delay={p.delay}
                        startX={p.startX}
                        startY={p.startY}
                        size={p.size}
                        duration={p.duration}
                    />
                ))}
            </View>

            {/* Glow lines */}
            <View style={styles.particleLayer}>
                {glowLines.map(l => (
                    <GlowLine
                        key={l.id}
                        delay={l.delay}
                        x1={l.x1}
                        y1={l.y1}
                        angle={l.angle}
                        length={l.length}
                    />
                ))}
            </View>

            {/* Scan rings behind logo */}
            <View style={styles.logoContainer}>
                <ScanRing delay={600} />
                <ScanRing delay={1600} />

                {/* Logo */}
                <Animated.View style={[styles.logoWrapper, logoAnimStyle]}>
                    <Image
                        source={require('../assets/images/icon.png')}
                        style={styles.logo}
                    />
                </Animated.View>

                {/* Tagline */}
                <Animated.View style={taglineAnimStyle}>
                    <Animated.Text style={styles.tagline}>
                        Tomorrow's Intelligence
                    </Animated.Text>
                </Animated.View>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
    },
    particleLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    logoContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoWrapper: {
        marginBottom: 20,
    },
    logo: {
        width: 140,
        height: 140,
        borderRadius: 32,
    },
    tagline: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '300',
        letterSpacing: 3,
        textTransform: 'uppercase',
        opacity: 0.9,
    },
});
