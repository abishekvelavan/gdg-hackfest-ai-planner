import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import Colors from '../constants/Colors';
import { DayEvent } from '../types';

const CATEGORY_COLORS: Record<string, string> = {
    work: Colors.work,
    health: Colors.health,
    errand: Colors.errand,
    break: Colors.break,
    focus: Colors.focus,
};

const CATEGORY_ICONS: Record<string, string> = {
    work: '💼',
    health: '🏃',
    errand: '🛒',
    break: '☕',
    focus: '🎯',
};

const TRAVEL_ICONS: Record<string, string> = {
    car: '🚗',
    bike: '🚲',
    walk: '🚶',
    transit: '🚌',
};

type EventTileProps = {
    event: DayEvent;
    onPress?: () => void;
};

export function EventTile({ event, onPress }: EventTileProps) {
    const categoryColor = CATEGORY_COLORS[event.category] || Colors.work;
    const categoryIcon = CATEGORY_ICONS[event.category] || '📌';

    return (
        <View style={[styles.eventCard, { borderLeftColor: categoryColor }]} onTouchEnd={onPress}>
            <View style={styles.eventHeader}>
                <View style={[styles.timeBadge, { backgroundColor: categoryColor + '20' }]}>
                    <Text style={[styles.timeText, { color: categoryColor }]}>{event.time}</Text>
                </View>
                {event.weather && <Text style={styles.weatherBadge}>{event.weather}</Text>}
            </View>
            <View style={styles.eventBody}>
                <Text style={styles.eventIcon}>{categoryIcon}</Text>
                <View style={styles.eventDetails}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    {event.location && (
                        <Text style={styles.eventLocation}>📍 {event.location}</Text>
                    )}
                    {event.travelMode && (
                        <Text style={styles.eventTravel}>
                            {TRAVEL_ICONS[event.travelMode] || '🚗'} {event.travelTime || event.travelMode}
                        </Text>
                    )}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    eventCard: {
        backgroundColor: Colors.card,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    eventHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    timeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    timeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    weatherBadge: {
        fontSize: 12,
        color: Colors.textSecondary,
    },
    eventBody: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    eventIcon: {
        fontSize: 20,
        marginRight: 10,
        marginTop: 2,
    },
    eventDetails: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 4,
    },
    eventLocation: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    eventTravel: {
        fontSize: 12,
        color: Colors.accent,
    },
});
