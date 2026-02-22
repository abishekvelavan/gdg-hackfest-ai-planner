import React, { useState, useCallback, useLayoutEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '../../constants/Colors';
import { api, normalizeChatResponse } from '../../services/api';
import { DayEvent } from '../../types';
import { EventTile } from '../../components/EventTile';
import { PlanCard } from '../../components/PlanCard';
import { AffirmationCard } from '../../components/AffirmationCard';
import { AnimatedEntry } from '../../components/AnimatedScreen';
import { DayPlanLoader } from '../../components/DayPlanLoader';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, useNavigation } from 'expo-router';

function parseEventsFromResponse(response: string): DayEvent[] {
  const events: DayEvent[] = [];
  const lines = response.split('\n');

  const parsePriority = (s: string): 'High' | 'Medium' | 'Low' | undefined => {
    const upper = s.trim();
    if (/^High$/i.test(upper)) return 'High';
    if (/^Medium$/i.test(upper)) return 'Medium';
    if (/^Low$/i.test(upper)) return 'Low';
    if (upper === 'P1') return 'High';
    if (upper === 'P2') return 'Medium';
    if (upper === 'P3') return 'Low';
    return undefined;
  };
  for (const line of lines) {
    // Match [High], [Medium], [Low] or legacy [P1], [P2], [P3]
    let priority: 'High' | 'Medium' | 'Low' | undefined;
    let workLine = line;
    const priAtStart = line.match(/^\s*\[(High|Medium|Low|P[123])\]\s*/i);
    if (priAtStart) {
      priority = parsePriority(priAtStart[1]);
      workLine = line.slice(priAtStart[0].length);
    } else {
      const priAnywhere = line.match(/\[(High|Medium|Low|P[123])\]/i);
      if (priAnywhere) priority = parsePriority(priAnywhere[1]);
    }
    const timeMatch = workLine.match(/(?:⏰\s*)?(?:\*\*)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)(?:\*\*)?\s*[-–—:]\s*(.+)/);
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

      // Clean up title (remove priority tags, leading time duplicate, trailing " 9am" etc.)
      let title = rest
        .replace(/\s*\[(?:High|Medium|Low|P[123])\]\s*/gi, ' ')
        .replace(/📍[^🚗🚲🚶🚌]*/g, '')
        .replace(/[🚗🚲🚶🚌]\s*\d*\s*min/g, '')
        .replace(/(☀️|🌤️|⛅|🌧️|⛈️|❄️)\s*\d+°[CF]?/g, '')
        .replace(/\*\*/g, '')
        .trim()
        .replace(/^[-–—]\s*/, '');
      // Strip leading time so we don't show it twice (badge already shows event.time)
      title = title.replace(/^\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*[-–—:]\s*/i, '').trim();
      title = title.replace(/\s*,?\s*\d{1,2}\s*(?:AM|PM|am|pm)\s*$/i, '').trim();

      if (title) {
        events.push({ time, title, location, travelMode, weather, category, priority });
      }
    }
  }
  return events;
}

/** Match a line that looks like a time-block: ⏰ 9:00 AM - ... or 9:00 AM - ... */
const SCHEDULE_LINE = /^(?:⏰\s*)?(?:\*\*)?\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/;

function getPlanSections(planText: string): { intro: string; scheduleLines: string[] } {
  const lines = planText.split('\n').map((l) => l.trim()).filter(Boolean);
  const scheduleLines: string[] = [];
  let intro = '';
  let seenFirstSchedule = false;
  for (const line of lines) {
    if (SCHEDULE_LINE.test(line)) {
      seenFirstSchedule = true;
      scheduleLines.push(line);
    } else if (!seenFirstSchedule) {
      intro = intro ? `${intro}\n${line}` : line;
    }
  }
  return { intro, scheduleLines };
}

export default function DayPlanScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<DayEvent[]>([]);
  const [rawPlan, setRawPlan] = useState('');
  const [weatherSummary, setWeatherSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hasFetched, setHasFetched] = useState(false);
  const [affirmationVisible, setAffirmationVisible] = useState(true);
  const [homeAddress, setHomeAddress] = useState<string>('');
  const [calendarAdding, setCalendarAdding] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  React.useEffect(() => {
    if (!user?.user_id) return;
    api.getProfile(user.user_id).then((p) => {
      if (p?.home_address) setHomeAddress(String(p.home_address));
    }).catch(() => {});
  }, [user?.user_id]);

  const fetchDayPlan = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError('');
    setAffirmationVisible(true);

    const userId = user?.user_id ?? 'default_user';

    try {
      // Sync latest data from Google (Calendar, Gmail, Tasks) before generating the plan
      try {
        await api.getGoogleSync(userId);
      } catch (_) {
        // Proceed without Google data if not connected or sync fails
      }

      const response = await api.chat(
        'Plan my day. Give me a time-blocked schedule with weather and travel info. Use ⏰ emoji before each time slot and 📍 for locations.',
        userId,
        ''
      );

      const planText = normalizeChatResponse(response);
      setRawPlan(planText);
      const parsed = parseEventsFromResponse(planText);
      setEvents(parsed);

      const weatherLine = planText.split('\n').find(l =>
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
  }, [user?.user_id]);

  // Auto-fetch day plan when user lands on this page
  React.useEffect(() => {
    if (user?.user_id) fetchDayPlan();
  }, [user?.user_id, fetchDayPlan]);

  const handleSyncAndRegenerate = useCallback(async () => {
    if (!user?.user_id || isSyncing || isLoading) return;
    setIsSyncing(true);
    setError('');
    try {
      await fetchDayPlan();
    } catch (err: any) {
      setError(err.message || 'Sync or plan failed');
    } finally {
      setIsSyncing(false);
    }
  }, [user?.user_id, isSyncing, isLoading, fetchDayPlan]);

  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: user?.user_id
        ? () => (
            <TouchableOpacity
              onPress={handleSyncAndRegenerate}
              disabled={isSyncing || isLoading}
              style={styles.headerSyncButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {(isSyncing && !isLoading) ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <FontAwesome name="refresh" size={18} color={isSyncing || isLoading ? Colors.textMuted : Colors.primary} />
              )}
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, user?.user_id, handleSyncAndRegenerate, isSyncing, isLoading]);

  const addToCalendar = useCallback(async () => {
    if (!user?.user_id || events.length === 0) return;
    setCalendarAdding(true);
    setCalendarMessage(null);
    try {
      const result = await api.addPlanToCalendar(
        user.user_id,
        events.map((e) => ({ time: e.time, title: e.title, location: e.location })),
        15
      );
      if (result.error && (result.created ?? 0) === 0) {
        setCalendarMessage(result.error);
        Alert.alert('Calendar', result.error);
      } else {
        const msg = `Added ${result.created ?? 0} events to Google Calendar. You'll get a reminder 15 minutes before each.`;
        setCalendarMessage(msg);
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to add to calendar';
      setCalendarMessage(msg);
      Alert.alert('Calendar', msg);
    } finally {
      setCalendarAdding(false);
    }
  }, [user?.user_id, events]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <AnimatedEntry type="scaleIn" delay={0}>
        <Text style={styles.emptyEmoji}>📋</Text>
      </AnimatedEntry>
      <AnimatedEntry delay={150}>
        <Text style={styles.emptyTitle}>No plan yet</Text>
      </AnimatedEntry>
      <AnimatedEntry delay={300}>
        <Text style={styles.emptySubtitle}>
          Pull down to refresh and load your day plan
        </Text>
      </AnimatedEntry>
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
      {/* Morning Affirmation */}
      {events.length > 0 && affirmationVisible && (
        <AffirmationCard
          text="Good morning! Here is your personalized plan to make today great."
          onDismiss={() => setAffirmationVisible(false)}
        />
      )}

      {/* Loading State — 3D loader */}
      {isLoading && !isRefreshing && (
        <DayPlanLoader rotatingMessage />
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

      {/* Events via PlanCard + Add to Calendar */}
      {events.length > 0 && (
        <View style={styles.eventsContainer}>
          <PlanCard
            plan={{ date: new Date().toISOString().split('T')[0], events, weather_summary: weatherSummary }}
            homeAddress={homeAddress || undefined}
            onOpenMap={(url) => router.push('/map?url=' + encodeURIComponent(url))}
          />
          <TouchableOpacity
            style={styles.addToCalendarButton}
            onPress={addToCalendar}
            disabled={calendarAdding}
          >
            {calendarAdding ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.addToCalendarText}>📅 Add to Google Calendar (reminder 15 min before)</Text>
            )}
          </TouchableOpacity>
          {calendarMessage ? (
            <Text style={styles.calendarMessage}>{calendarMessage}</Text>
          ) : null}
        </View>
      )}

      {/* Plan as list when we have raw text but no parsed events (e.g. API returned array payload) */}
      {hasFetched && events.length === 0 && rawPlan && !isLoading && (
        <View style={styles.rawPlanContainer}>
          <Text style={styles.sectionTitle}>📋 Your Day Plan</Text>
          <View style={styles.planListCard}>
            {(() => {
              const { intro, scheduleLines } = getPlanSections(rawPlan);
              return (
                <>
                  {intro ? (
                    <Text style={styles.planIntro}>{intro}</Text>
                  ) : null}
                  {scheduleLines.length > 0 ? (
                    <View style={styles.planList}>
                      {scheduleLines.map((line, idx) => {
                        const timeMatch = line.match(/(?:⏰\s*)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[-–—:]\s*(.+)/);
                        const time = timeMatch ? timeMatch[1].trim() : '';
                        const rest = timeMatch ? timeMatch[2].trim() : line;
                        return (
                          <View key={`${time}-${idx}`} style={styles.planListItem}>
                            <Text style={styles.planListTime}>{time || '•'}</Text>
                            <Text style={styles.planListLabel}>{rest}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.rawPlanText}>{rawPlan}</Text>
                  )}
                </>
              );
            })()}
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
  headerSyncButton: {
    marginRight: 12,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
  addToCalendarButton: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary + '30',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  addToCalendarText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  calendarMessage: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
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
  planListCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  planIntro: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  planList: {
    gap: 12,
  },
  planListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  planListTime: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
    width: 72,
  },
  planListLabel: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
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
});
