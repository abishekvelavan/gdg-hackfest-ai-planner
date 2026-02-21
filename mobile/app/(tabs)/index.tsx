import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import Colors from '../../constants/Colors';
import { api } from '../../services/api';
import { DayEvent } from '../../types';

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

function parseEventsFromResponse(response: string): DayEvent[] {
  const events: DayEvent[] = [];
  const lines = response.split('\n');

  for (const line of lines) {
    // Match patterns like "⏰ 9:00 AM - Meeting" or "9:00 AM - Meeting" or "**9:00 AM** - Meeting"
    const timeMatch = line.match(/(?:⏰\s*)?(?:\*\*)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)(?:\*\*)?\s*[-–—:]\s*(.+)/);
    if (timeMatch) {
      const time = timeMatch[1].trim();
      let rest = timeMatch[2].trim();

      // Try to extract location (📍)
      let location: string | undefined;
      const locMatch = rest.match(/📍\s*([^🚗🚲🚶🚌]*)/);
      if (locMatch) {
        location = locMatch[1].trim();
        rest = rest.replace(/📍\s*[^🚗🚲🚶🚌]*/, '').trim();
      }

      // Try to extract travel mode
      let travelMode: string | undefined;
      if (rest.includes('🚗')) travelMode = 'car';
      else if (rest.includes('🚲')) travelMode = 'bike';
      else if (rest.includes('🚶')) travelMode = 'walk';
      else if (rest.includes('🚌')) travelMode = 'transit';

      // Try to extract weather
      let weather: string | undefined;
      const weatherMatch = rest.match(/(☀️|🌤️|⛅|🌧️|⛈️|❄️)\s*\d+°[CF]?/);
      if (weatherMatch) weather = weatherMatch[0];

      // Guess category from keywords
      const titleLower = rest.toLowerCase();
      let category = 'work';
      if (titleLower.match(/gym|exercise|walk|run|health|yoga|stretch/)) category = 'health';
      else if (titleLower.match(/grocery|errand|shop|buy|pick/)) category = 'errand';
      else if (titleLower.match(/break|lunch|coffee|rest|free/)) category = 'break';
      else if (titleLower.match(/focus|study|deep work|concentrate|read/)) category = 'focus';

      // Clean up title
      const title = rest
        .replace(/📍[^🚗🚲🚶🚌]*/g, '')
        .replace(/[🚗🚲🚶🚌]\s*\d*\s*min/g, '')
        .replace(/(☀️|🌤️|⛅|🌧️|⛈️|❄️)\s*\d+°[CF]?/g, '')
        .replace(/\*\*/g, '')
        .trim()
        .replace(/^[-–—]\s*/, '');

      if (title) {
        events.push({ time, title, location, travelMode, weather, category });
      }
    }
  }
  return events;
}

function EventCard({ event }: { event: DayEvent }) {
  const categoryColor = CATEGORY_COLORS[event.category] || Colors.work;
  const categoryIcon = CATEGORY_ICONS[event.category] || '📌';

  return (
    <View style={[styles.eventCard, { borderLeftColor: categoryColor }]}>
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

export default function DayPlanScreen() {
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [rawPlan, setRawPlan] = useState('');
  const [weatherSummary, setWeatherSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hasFetched, setHasFetched] = useState(false);

  const fetchDayPlan = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError('');

    try {
      // Ask the agent to plan the day — this goes through the real agent pipeline
      const response = await api.chat(
        'Plan my day. Give me a time-blocked schedule with weather and travel info. Use ⏰ emoji before each time slot and 📍 for locations.',
        'default_user',
        ''
      );

      setRawPlan(response.response);
      const parsed = parseEventsFromResponse(response.response);
      setEvents(parsed);

      // Extract weather summary from first line or general weather mention
      const weatherLine = response.response.split('\n').find(l =>
        l.match(/(weather|forecast|temperature|☀️|🌤️|⛅|🌧️|°)/i)
      );
      setWeatherSummary(weatherLine?.replace(/\*\*/g, '').trim() || '');
      setHasFetched(true);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch day plan');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>📋</Text>
      <Text style={styles.emptyTitle}>No plan yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap the button below or go to Chat and say "Plan my day"
      </Text>
      <TouchableOpacity style={styles.generateButton} onPress={() => fetchDayPlan()}>
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.generateButtonText}>✨ Generate Day Plan</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={events.length === 0 && !hasFetched ? styles.containerEmpty : undefined}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchDayPlan(true)}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
          progressBackgroundColor={Colors.surface}
        />
      }
    >
      {/* Weather Header */}
      {weatherSummary ? (
        <View style={styles.weatherBar}>
          <Text style={styles.weatherText}>{weatherSummary}</Text>
        </View>
      ) : null}

      {/* Loading State */}
      {isLoading && !isRefreshing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            Agent is planning your day...{'\n'}This may take a moment.
          </Text>
        </View>
      )}

      {/* Error State */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchDayPlan()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Events */}
      {events.length > 0 && (
        <View style={styles.eventsContainer}>
          <Text style={styles.sectionTitle}>
            📅 Today's Plan · {events.length} events
          </Text>
          {events.map((event, idx) => (
            <EventCard key={`${event.time}-${idx}`} event={event} />
          ))}
        </View>
      )}

      {/* Raw plan text as fallback when we couldn't parse events */}
      {hasFetched && events.length === 0 && rawPlan && !isLoading && (
        <View style={styles.rawPlanContainer}>
          <Text style={styles.sectionTitle}>📋 Your Day Plan</Text>
          <View style={styles.rawPlanCard}>
            <Text style={styles.rawPlanText}>{rawPlan}</Text>
          </View>
        </View>
      )}

      {/* Empty */}
      {!hasFetched && !isLoading && events.length === 0 && renderEmptyState()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  containerEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  weatherBar: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  weatherText: {
    color: Colors.text,
    fontSize: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: Colors.error + '15',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    alignItems: 'center',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: Colors.error,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  eventsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
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
  rawPlanContainer: {
    padding: 16,
  },
  rawPlanCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rawPlanText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  generateButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
