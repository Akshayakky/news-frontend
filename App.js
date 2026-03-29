import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, FlatList,
  TouchableOpacity, ActivityIndicator,
  RefreshControl, Platform, Alert
} from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

const SERVER_URL = "https://46b1-2405-201-e-4a16-6ca5-6ef5-3232-de48.ngrok-free.app";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // This gives ExponentPushToken[...] which works with Expo Push API
  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: '6e4c8220-cc85-4785-8d04-eb67ad882c58' // your EAS project ID
  })).data;

  console.log('Expo Push Token:', token);
  return token;
}

export default function App() {
  const [stories, setStories]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken]           = useState(null);
  const notificationListener        = useRef();
  const responseListener            = useRef();

  async function fetchNews() {
    try {
      const res = await fetch(`${SERVER_URL}/news`);
      const data = await res.json();
      setStories(data.stories || []);
    } catch (e) {
      Alert.alert('Error', `Could not connect to server: ${e.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function registerDevice(pushToken) {
    try {
      await fetch(`${SERVER_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pushToken, device: 'Android' })
      });
      console.log('Device registered!');
    } catch (e) {
      console.error('Registration failed:', e.message);
    }
  }

useEffect(() => {
  fetchNews();
}, []);

  function StoryCard({ item }) {
    const [expanded, setExpanded] = useState(false);
    return (
      <TouchableOpacity style={styles.card} onPress={() => setExpanded(!expanded)} activeOpacity={0.85}>
        <View style={styles.cardHeader}>
          <View style={styles.badges}>
            <Text style={styles.category}>{item.category}</Text>
            <Text style={styles.region}>{item.region}</Text>
          </View>
          <Text style={styles.source}>{item.source}</Text>
        </View>
        <Text style={styles.headline}>{item.headline}</Text>
        {expanded && <Text style={styles.summary}>{item.summary}</Text>}
        <Text style={styles.tapHint}>{expanded ? 'Tap to collapse' : 'Tap to read more'}</Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E63946" />
        <Text style={styles.loadingText}>Loading news...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NewsApp</Text>
        <Text style={styles.headerSub}>{stories.length} stories</Text>
      </View>
      <FlatList
        data={stories}
        keyExtractor={(item, index) => item.id || String(index)}
        renderItem={({ item }) => <StoryCard item={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNews(); }} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No stories yet.</Text>
            <Text style={styles.emptyText}>Run node fetch-news.js to fetch news!</Text>
          </View>
        }
      />
      {token && (
        <View style={styles.tokenBar}>
          <Text style={styles.tokenText} numberOfLines={1}>Token: {token.slice(0, 40)}...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F4F4F4' },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText:  { marginTop: 12, fontSize: 14, color: '#888' },
  emptyText:    { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8 },
  header:       { backgroundColor: '#E63946', paddingTop: 50, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerTitle:  { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  list:         { padding: 12 },
  card:         { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badges:       { flexDirection: 'row', gap: 6 },
  category:     { backgroundColor: '#E63946', color: '#fff', fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  region:       { backgroundColor: '#457B9D', color: '#fff', fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  source:       { fontSize: 11, color: '#999' },
  headline:     { fontSize: 16, fontWeight: '700', color: '#1D1D1D', lineHeight: 22 },
  summary:      { fontSize: 14, color: '#444', lineHeight: 21, marginTop: 10 },
  tapHint:      { fontSize: 11, color: '#bbb', marginTop: 8, textAlign: 'right' },
  tokenBar:     { backgroundColor: '#1D1D1D', padding: 8, paddingHorizontal: 14 },
  tokenText:    { fontSize: 10, color: '#888' },
});