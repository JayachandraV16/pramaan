import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  getMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  NotificationItem,
} from '../../services/notificationService';

export default function NotificationsTabScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    try {
      setError('');
      const items = await getMyNotifications();
      setNotifications(items);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNotifications();
    }, [])
  );

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      await loadNotifications();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      await loadNotifications();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSelectNotification = async (item: NotificationItem) => {
    if (item.status !== 'READ') {
      await handleMarkAsRead(item.id);
    }
    if (item.related_application_id) {
      router.push(`/applications/${item.related_application_id}`);
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isUnread = item.status !== 'READ';

    return (
      <Pressable
        style={[styles.card, isUnread && styles.unreadCard]}
        onPress={() => handleSelectNotification(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, isUnread && styles.unreadTitle]}>
            {item.title}
          </Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>

        <Text style={styles.cardMessage}>{item.message}</Text>
        <Text style={styles.cardDate}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
      </Pressable>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  const unreadCount = notifications.filter((n) => n.status !== 'READ').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All notifications read'}
          </Text>
        </View>

        {unreadCount > 0 && (
          <Pressable style={styles.markAllButton} onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        )}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNotifications();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No notifications found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  subtitle: { color: '#64748B', fontSize: 13, marginTop: 2 },
  markAllButton: { backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  markAllText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  errorBox: { padding: 12, borderRadius: 8, backgroundColor: '#FEE2E2', marginBottom: 12 },
  errorText: { color: '#991B1B' },
  listContent: { gap: 12, paddingBottom: 24 },
  card: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  unreadCard: { borderColor: '#2563EB', backgroundColor: '#F0F9FF' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  unreadTitle: { fontWeight: '700', color: '#1E40AF' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563EB' },
  cardMessage: { fontSize: 13, color: '#334155', lineHeight: 18 },
  cardDate: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  emptyCard: { padding: 24, backgroundColor: '#FFFFFF', borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  emptyText: { color: '#64748B', fontSize: 14 },
});
