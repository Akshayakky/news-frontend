import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList,
  TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, TextInput,
  Animated, Dimensions, ScrollView,
  StatusBar, Platform, KeyboardAvoidingView,
} from 'react-native';
import * as Notifications from 'expo-notifications';

const SERVER_URL = "https://news-backend-production-042b.up.railway.app";
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── COLORS ──────────────────────────────────────────────────────────────────
const C = {
  red:        '#E63946',
  redDark:    '#C1121F',
  ink:        '#1A1A1A',
  inkSoft:    '#444444',
  inkMuted:   '#888888',
  inkFaint:   '#BBBBBB',
  surface:    '#F7F5F2',
  white:      '#FFFFFF',
  border:     'rgba(0,0,0,0.07)',
  borderMed:  'rgba(0,0,0,0.12)',
};

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'All',      label: 'All',      emoji: '🌐' },
  { id: 'India',    label: 'India',    emoji: '🇮🇳' },
  { id: 'World',    label: 'World',    emoji: '🌍' },
  { id: 'Tech',     label: 'Tech',     emoji: '💻' },
  { id: 'Business', label: 'Business', emoji: '💼' },
  { id: 'Trading',  label: 'Trading',  emoji: '📈' },
  { id: 'Science',  label: 'Science',  emoji: '🔬' },
  { id: 'Sports',   label: 'Sports',   emoji: '⚽' },
  { id: 'Politics', label: 'Politics', emoji: '🏛️' },
  { id: 'Local',    label: 'Local',    emoji: '📍' },
];

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── STORY CARD ───────────────────────────────────────────────────────────────
function StoryCard({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0, duration: 300,
        delay: index * 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const categoryColor = {
    India: '#FF9933', World: '#457B9D', Tech: '#2A9D8F',
    Business: '#E9C46A', Trading: '#F4A261', Science: '#9B5DE5',
    Sports: '#43AA8B', Politics: '#E76F51', Local: '#6D6875',
  }[item.category] || '#888';

return (
    <Animated.View style={[
      styles.card,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
    ]}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.97}
      >
        {/* Category + Source row */}
        <View style={styles.cardMeta}>
          <View style={[styles.categoryPill, { backgroundColor: categoryColor + '18' }]}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={[styles.categoryText, { color: categoryColor }]}>
              {item.category}
            </Text>
          </View>
          <Text style={styles.sourceText}>{item.source?.replace('Google:', '') || ''}</Text>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>{item.headline}</Text>

        {/* Expanded summary */}
        {expanded && (
          <Text style={styles.summary}>{item.summary}</Text>
        )}

        {/* Bottom row */}
        <View style={styles.cardBottom}>
          <Text style={styles.timeAgo}>{timeAgo(item.publishedAt)}</Text>
          <Text style={styles.tapHint}>
            {expanded ? 'Show less ↑' : 'Read more ↓'}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── PREFERENCES SCREEN ───────────────────────────────────────────────────────
function PreferencesScreen({ token, onSave, onBack }) {
  const [selected, setSelected]     = useState([]);
  const [city, setCity]             = useState('');
  const [state, setState]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(true);

  // Load existing prefs
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${SERVER_URL}/preferences?token=${encodeURIComponent(token)}`);
        if (res.ok) {
          const data = await res.json();
          setSelected(data.interests || []);
          setCity(data.location?.city || '');
          setState(data.location?.state || '');
        }
      } catch (e) {}
      setLoading(false);
    })();
  }, []);

  function toggleCategory(id) {
    if (id === 'All') {
      // All is mutually exclusive
      setSelected(selected.includes('All') ? [] : ['All']);
      return;
    }
    // Deselect All if selecting specific
    let next = selected.filter(s => s !== 'All');
    if (next.includes(id)) {
      next = next.filter(s => s !== id);
    } else {
      if (next.length >= 4) {
        Alert.alert('Max 4 categories', 'Deselect one before adding another.');
        return;
      }
      next = [...next, id];
    }
    setSelected(next);
  }

  async function handleSave() {
    // Validate local news
    if (selected.includes('Local') && (!city.trim() || !state.trim())) {
      Alert.alert('Missing location', 'Please enter your city and state for local news.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${SERVER_URL}/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          interests: selected,
          location: { city: city.trim(), state: state.trim() }
        })
      });
      if (!res.ok) throw new Error('Save failed');
      onSave(selected, { city: city.trim(), state: state.trim() });
    } catch (e) {
      Alert.alert('Error', 'Could not save preferences. Try again.');
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.red} />
      </View>
    );
  }

  const localSelected = selected.includes('Local');

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.prefHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.prefTitle}>Your Interests</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.prefContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.prefSubtitle}>
          Pick up to 4 topics. We'll personalise your feed and notifications.
        </Text>

        {/* Category Grid */}
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(cat => {
            const isSelected = selected.includes(cat.id);
            const isDisabled = !isSelected && !selected.includes('All') &&
              selected.filter(s => s !== 'All').length >= 4 && cat.id !== 'All';

            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryBox,
                  isSelected && styles.categoryBoxSelected,
                  isDisabled && styles.categoryBoxDisabled,
                ]}
                onPress={() => !isDisabled && toggleCategory(cat.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.categoryBoxEmoji}>{cat.emoji}</Text>
                <Text style={[
                  styles.categoryBoxLabel,
                  isSelected && styles.categoryBoxLabelSelected,
                ]}>{cat.label}</Text>
                {isSelected && (
                  <View style={styles.categoryCheckmark}>
                    <Text style={styles.categoryCheckmarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Local news city/state inputs */}
        {localSelected && (
          <View style={styles.localInputWrap}>
            <Text style={styles.localInputLabel}>📍 Your location for local news</Text>
            <TextInput
              style={styles.localInput}
              placeholder="City (e.g. Mumbai)"
              placeholderTextColor={C.inkFaint}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
            />
            <TextInput
              style={[styles.localInput, { marginTop: 10 }]}
              placeholder="State (e.g. Maharashtra)"
              placeholderTextColor={C.inkFaint}
              value={state}
              onChangeText={setState}
              autoCapitalize="words"
            />
          </View>
        )}

        <Text style={styles.prefNote}>
          {selected.includes('All')
            ? 'You\'ll receive all news categories.'
            : selected.length === 0
            ? 'No preferences set — you\'ll see all news until you pick topics.'
            : `${4 - selected.filter(s => s !== 'All').length} more topic${4 - selected.filter(s => s !== 'All').length === 1 ? '' : 's'} available.`
          }
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]           = useState('home'); // 'home' | 'preferences'
  const [stories, setStories]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [token, setToken]             = useState(null);
  const [status, setStatus]           = useState('Starting...');
  const [activeCategory, setCategory] = useState('All');
  const [userInterests, setInterests] = useState([]);
  const [userLocation, setLocation]   = useState({});
  const [hasPrefs, setHasPrefs]       = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const notificationListener = useRef();
  const responseListener     = useRef();

  // ── PUSH TOKEN ──────────────────────────────────────────────────────────────
  async function registerForPushNotifications() {
    try {
      setStatus('Getting permission...');
      const { status: existing } = await Notifications.getPermissionsAsync();
      let finalStatus = existing;
      if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') { setStatus('Permission denied'); return null; }
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '6e4c8220-cc85-4785-8d04-eb67ad882c58'
      });
      return tokenData.data;
    } catch (e) {
      setStatus(`Token error: ${e.message}`);
      return null;
    }
  }

  // ── REGISTER DEVICE ─────────────────────────────────────────────────────────
  async function registerDevice(pushToken) {
    try {
      setStatus('Registering...');
      const res = await fetch(`${SERVER_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pushToken, device: 'Android' })
      });
      if (!res.ok) throw new Error(`${res.status}`);
    } catch (e) {
      setStatus(`Register error: ${e.message}`);
    }
  }

  // ── LOAD PREFERENCES ────────────────────────────────────────────────────────
  async function loadPreferences(pushToken) {
    try {
      const res = await fetch(`${SERVER_URL}/preferences/${encodeURIComponent(pushToken)}`);
      if (res.ok) {
        const data = await res.json();
        setInterests(data.interests || []);
        setLocation(data.location || {});
        setHasPrefs((data.interests || []).length > 0);
      }
    } catch (e) {}
  }

  // ── FETCH NEWS ──────────────────────────────────────────────────────────────
  async function fetchNews(category = activeCategory) {
    try {
      setStatus('Fetching news...');
      let url = `${SERVER_URL}/news`;
      const params = new URLSearchParams();
      if (token) params.append('token', token);
      if (category && category !== 'All') params.append('category', category);
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setStories(data.stories || []);
      setStatus(`${data.count} stories`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      Alert.alert('Connection Error', `Could not connect to server.\n${e.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // ── INIT ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const pushToken = await registerForPushNotifications();
      if (pushToken) {
        setToken(pushToken);
        await registerDevice(pushToken);
        await loadPreferences(pushToken);
      }
      await fetchNews('All');
    })();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  // ── CATEGORY CHANGE ─────────────────────────────────────────────────────────
  async function handleCategoryChange(cat) {
    setCategory(cat);
    setLoading(true);
    await fetchNews(cat);
  }

  // ── SAVE PREFERENCES ────────────────────────────────────────────────────────
  function handlePrefsSaved(interests, location) {
    setInterests(interests);
    setLocation(location);
    setHasPrefs(interests.length > 0);
    setScreen('home');
    setLoading(true);
    fetchNews(activeCategory);
  }

  // ── BUILD VISIBLE TABS ──────────────────────────────────────────────────────
  function getVisibleTabs() {
    if (!hasPrefs || userInterests.includes('All') || userInterests.length === 0) {
      return [{ id: 'All', label: 'All', emoji: '🌐' }];
    }
    const tabs = [{ id: 'All', label: 'All', emoji: '🌐' }];
    for (const interest of userInterests) {
      const cat = CATEGORIES.find(c => c.id === interest);
      if (cat) {
        // For local, show city name instead
        if (cat.id === 'Local' && userLocation?.city) {
          tabs.push({ id: 'Local', label: userLocation.city, emoji: '📍' });
        } else {
          tabs.push(cat);
        }
      }
    }
    return tabs;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  if (screen === 'preferences') {
    return (
      <PreferencesScreen
        token={token}
        onSave={handlePrefsSaved}
        onBack={() => setScreen('home')}
      />
    );
  }

  const visibleTabs = getVisibleTabs();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.red} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {/* Logo */}
          <View style={styles.logo}>
<Text style={styles.logoText}>N</Text>
          </View>
<Text style={styles.appName}>Newsbyte</Text>
        </View>
        <TouchableOpacity
          style={styles.menuBtn}
onPress={() => setMenuOpen(!menuOpen)}
          activeOpacity={0.7}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

{menuOpen && (
  <TouchableOpacity
    style={styles.menuOverlay}
    activeOpacity={1}
    onPress={() => setMenuOpen(false)}
  >
    <View style={styles.menuDropdown}>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => { setMenuOpen(false); setScreen('preferences'); }}
      >
        <Text style={styles.menuItemEmoji}>⚙️</Text>
        <Text style={styles.menuItemText}>Preferences</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => { setMenuOpen(false); setRefreshing(true); fetchNews(activeCategory); }}
      >
        <Text style={styles.menuItemEmoji}>🔄</Text>
        <Text style={styles.menuItemText}>Refresh Feed</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
)}

      {/* ── PERSONALISE BANNER (shown if no prefs set) ── */}
      {!hasPrefs && !loading && (
        <TouchableOpacity
          style={styles.personaliseBanner}
          onPress={() => setScreen('preferences')}
          activeOpacity={0.9}
        >
          <Text style={styles.personaliseText}>
            ✨ Personalise your feed — pick your topics
          </Text>
          <Text style={styles.personaliseArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* ── CATEGORY TABS ── */}
      {visibleTabs.length > 1 && (
        <View style={styles.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {visibleTabs.map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeCategory === tab.id && styles.tabActive
                ]}
                onPress={() => handleCategoryChange(tab.id)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.tabText,
                  activeCategory === tab.id && styles.tabTextActive
                ]}>
                  {tab.emoji} {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── NEWS LIST ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.red} />
          <Text style={styles.loadingText}>Loading stories...</Text>
        </View>
      ) : (
        <FlatList
          data={stories}
          keyExtractor={item => item.id || Math.random().toString()}
          renderItem={({ item, index }) => <StoryCard item={item} index={index} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchNews(activeCategory); }}
              tintColor={C.red}
              colors={[C.red]}
            />
          }
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyTitle}>No stories yet</Text>
              <Text style={styles.emptySubtitle}>
                Pull down to refresh or check back shortly.
              </Text>
            </View>
          }
        />
      )}

      {/* ── STATUS BAR ── */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
      </View>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.surface },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  // Header
  header: {
    backgroundColor: C.red,
    paddingTop: Platform.OS === 'android' ? 44 : 54,
    paddingBottom: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 32, height: 32,
    backgroundColor: C.white,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText:     { fontSize: 18, fontWeight: '800', color: C.red, letterSpacing: -0.5 },
  appName:      { fontSize: 20, fontWeight: '700', color: C.white, letterSpacing: -0.3 },
  menuBtn:      { padding: 6 },
  menuIcon:     { fontSize: 20, color: C.white },

  // Personalise banner
  personaliseBanner: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 11,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  personaliseText:  { fontSize: 13, color: C.inkSoft, fontWeight: '400', flex: 1 },
  personaliseArrow: { fontSize: 14, color: C.red, fontWeight: '600', marginLeft: 8 },

  // Tabs
  tabsWrap: {
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tabs:         { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabActive: {
    backgroundColor: C.red,
    borderColor: C.red,
  },
  tabText:      { fontSize: 13, color: C.inkMuted, fontWeight: '500' },
  tabTextActive:{ color: C.white },

  // List
  list:         { padding: 14, paddingBottom: 24 },

  // Card
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  categoryDot:  { width: 5, height: 5, borderRadius: 100 },
  categoryText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
  sourceText:   { fontSize: 11, color: C.inkFaint },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    color: C.ink,
    lineHeight: 23,
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  summary: {
    fontSize: 14,
    color: C.inkSoft,
    lineHeight: 22,
    marginBottom: 10,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  timeAgo:      { fontSize: 11, color: C.inkFaint },
  tapHint:      { fontSize: 11, color: C.inkFaint },

  // Loading / Empty
  loadingText:  { marginTop: 12, fontSize: 14, color: C.inkMuted },
  emptyWrap:    { alignItems: 'center', paddingTop: 60 },
  emptyEmoji:   { fontSize: 40, marginBottom: 14 },
  emptyTitle:   { fontSize: 17, fontWeight: '600', color: C.ink, marginBottom: 6 },
  emptySubtitle:{ fontSize: 14, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },

  // Status bar
  statusBar: {
    backgroundColor: C.ink,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  statusText:   { fontSize: 10, color: '#666' },

  // Preferences screen
  prefHeader: {
    backgroundColor: C.white,
    paddingTop: Platform.OS === 'android' ? 44 : 54,
    paddingBottom: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn:      { padding: 4 },
  backBtnText:  { fontSize: 14, color: C.red, fontWeight: '500' },
  prefTitle:    { fontSize: 17, fontWeight: '700', color: C.ink },
  saveBtn: {
    backgroundColor: C.red,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 100,
  },
  saveBtnText:  { fontSize: 13, color: C.white, fontWeight: '600' },
  prefContent:  { padding: 20, paddingBottom: 40 },
  prefSubtitle: { fontSize: 14, color: C.inkMuted, lineHeight: 21, marginBottom: 24 },

  // Category grid
categoryGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
  marginBottom: 24,
  justifyContent: 'flex-start',
},
categoryBox: {
  width: (SCREEN_WIDTH - 60) / 3,
  minWidth: 90,
  maxWidth: 140,
  backgroundColor: C.white,
  borderRadius: 14,
  padding: 12,
  alignItems: 'center',
  borderWidth: 1.5,
  borderColor: C.border,
  position: 'relative',
},
  categoryBoxSelected: {
    borderColor: C.red,
    backgroundColor: '#FFF5F5',
  },
  categoryBoxDisabled: {
    opacity: 0.35,
  },
  categoryBoxEmoji:  { fontSize: 24, marginBottom: 7 },
  categoryBoxLabel:  { fontSize: 12, fontWeight: '500', color: C.inkSoft, textAlign: 'center' },
  categoryBoxLabelSelected: { color: C.red, fontWeight: '600' },
  categoryCheckmark: {
    position: 'absolute',
    top: 6, right: 6,
    width: 16, height: 16,
    borderRadius: 100,
    backgroundColor: C.red,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCheckmarkText: { fontSize: 9, color: C.white, fontWeight: '800' },

  // Local inputs
  localInputWrap: {
    backgroundColor: C.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  localInputLabel: { fontSize: 13, fontWeight: '600', color: C.inkSoft, marginBottom: 12 },
  localInput: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
    borderWidth: 1,
    borderColor: C.border,
  },

  // Pref note
  prefNote: {
    fontSize: 12,
    color: C.inkFaint,
    textAlign: 'center',
    lineHeight: 18,
  },

  menuOverlay: {
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  zIndex: 100,
},
menuDropdown: {
  position: 'absolute',
  top: Platform.OS === 'android' ? 90 : 100,
  right: 14,
  backgroundColor: C.white,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: C.border,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 12,
  elevation: 8,
  minWidth: 180,
  zIndex: 101,
},
menuItem: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 14,
  paddingHorizontal: 16,
  gap: 10,
  borderBottomWidth: 1,
  borderBottomColor: C.border,
},
menuItemEmoji: { fontSize: 16 },
menuItemText: { fontSize: 15, color: C.ink, fontWeight: '500' },
});