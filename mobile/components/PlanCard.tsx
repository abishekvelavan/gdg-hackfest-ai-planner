import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Colors from '../constants/Colors';
import { DayPlan } from '../types';
import { EventTile } from './EventTile';

type PlanCardProps = {
    plan: DayPlan;
    onRefresh?: () => void;
};

export function PlanCard({ plan, onRefresh }: PlanCardProps) {
    if (!plan.events || plan.events.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>
                    📅 Today's Plan · {plan.events.length} events
                </Text>
                {onRefresh && (
                    <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
                        <Text style={styles.refreshIcon}>🔄</Text>
                    </TouchableOpacity>
                )}
            </View>

            {plan.weather_summary ? (
                <View style={styles.weatherBar}>
                    <Text style={styles.weatherText}>{plan.weather_summary}</Text>
                </View>
            ) : null}

            <View style={styles.eventsList}>
                {plan.events.map((event, idx) => (
                    <EventTile key={`${event.time}-${idx}`} event={event} />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surfaceLight,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.surfaceElevated,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
    },
    refreshButton: {
        padding: 4,
    },
    refreshIcon: {
        fontSize: 18,
    },
    weatherBar: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    weatherText: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    eventsList: {
        padding: 16,
    },
});
