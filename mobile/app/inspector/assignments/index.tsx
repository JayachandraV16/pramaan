import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { getAssignments } from '../../../services/assignmentService';

type Assignment = {
  id: string;
  application_id: string;
  application_number?: string;
  application_type?: string;
  application_status?: string;
  assignment_date?: string;
  status: string;
  remarks?: string | null;
};

export default function AssignmentsScreen() {
  const [assignments, setAssignments] =
    useState<Assignment[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAssignments = async () => {
    try {
      setError('');

      const response = await getAssignments();

      console.log('ASSIGNMENTS:', response);

      setAssignments(response || []);
    } catch (err: any) {
      console.log('ASSIGNMENTS ERROR:', err);

      setError(
        err.message || 'Failed to load assignments'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAssignments();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadAssignments();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />

        <Text style={styles.message}>
          Loading assignments...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={loadAssignments}
        >
          <Text style={styles.retryText}>
            Try Again
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          My Assignments
        </Text>

        <Text style={styles.subtitle}>
          Verification requests assigned to you
        </Text>
      </View>

      <FlatList
        data={assignments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        }
        contentContainerStyle={
          assignments.length === 0
            ? styles.emptyContainer
            : styles.list
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              No Assignments
            </Text>

            <Text style={styles.emptyText}>
              You do not have any verification assignments yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              router.push(
                `/inspector/assignments/${item.id}`
              )
            }
          >
            <View style={styles.cardHeader}>
              <Text style={styles.applicationNumber}>
                {item.application_number ||
                  'Application'}
              </Text>

              <View style={styles.status}>
                <Text style={styles.statusText}>
                  {item.status}
                </Text>
              </View>
            </View>

            {item.application_type && (
              <Text style={styles.detail}>
                Type: {item.application_type}
              </Text>
            )}

            {item.application_status && (
              <Text style={styles.detail}>
                Application: {item.application_status}
              </Text>
            )}

            {item.assignment_date && (
              <Text style={styles.detail}>
                Assigned:{' '}
                {new Date(
                  item.assignment_date
                ).toLocaleDateString()}
              </Text>
            )}

            {item.remarks && (
              <Text style={styles.remarks}>
                {item.remarks}
              </Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
  },

  subtitle: {
    marginTop: 5,
    fontSize: 14,
    opacity: 0.6,
  },

  list: {
    padding: 20,
  },

  card: {
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  applicationNumber: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 10,
  },

  status: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#E8F0FE',
  },

  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  detail: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.7,
  },

  remarks: {
    marginTop: 10,
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.7,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },

  message: {
    marginTop: 12,
  },

  error: {
    color: '#DC2626',
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563EB',
  },

  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  empty: {
    alignItems: 'center',
    padding: 30,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },

  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.6,
  },
});