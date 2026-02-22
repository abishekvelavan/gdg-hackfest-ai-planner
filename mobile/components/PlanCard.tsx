import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking } from 'react-native';
import Colors from '../constants/Colors';
import { DayPlan } from '../types';
import { EventTile } from './EventTile';
import { buildDayRouteUrl } from '../utils/mapsUrl';

type PlanCardProps = {
    plan: DayPlan;
    onRefresh?: () => void;
    /** Home address for first leg and full-day route. */
    homeAddress?: string;
    /** When set, "Map & routes" opens this URL in-app (e.g. navigate to /map?url=...). Otherwise opens in Maps/browser. */
    onOpenMap?: (url: string) => void;
};

export function PlanCard({ plan, onRefresh, homeAddress, onOpenMap }: PlanCardProps) {
    if (!plan.events || plan.events.length === 0) {
        return null;
    }

    const locationsWithAddresses = plan.events
        .map((e) => e.location?.trim())
        .filter((s): s is string => !!s);
    const dayRouteUrl = buildDayRouteUrl(locationsWithAddresses, homeAddress);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>
                    📅 Today's Plan · {plan.events.length} events
                </Text>
                <View style={styles.headerActions}>
                    {dayRouteUrl && (
                        <TouchableOpacity
                            style={styles.mapButton}
                            onPress={() => {
                                if (onOpenMap) onOpenMap(dayRouteUrl);
                                else Linking.openURL(dayRouteUrl).catch(() => {});
                            }}
                        >
                            <Text style={styles.mapButtonText}>🗺️ Map & routes</Text>
                        </TouchableOpacity>
                    )}
                    {onRefresh && (
                        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
                            <Text style={styles.refreshIcon}>🔄</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {plan.weather_summary ? (
                <View style={styles.weatherBar}>
                    <Text style={styles.weatherText}>{plan.weather_summary}</Text>
                </View>
            ) : null}

            <View style={styles.eventsList}>
                {plan.events.map((event, idx) => {
                    const origin = idx === 0
                        ? (homeAddress?.trim() || undefined)
                        : (plan.events[idx - 1].location?.trim() || undefined);
                    return (
                        <EventTile
                            key={`${event.time}-${idx}`}
                            event={event}
                            originForDirections={origin}
                            onOpenMap={onOpenMap}
                            order={idx + 1}
                        />
                    );
                })}
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
        flex: 1,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    mapButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: Colors.primary + '20',
        borderRadius: 10,
    },
    mapButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary,
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
