import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../api';
import {
  AssignedJob,
  Decision,
  Draft,
  OfflineState,
  Observation,
  Reading,
  addObservation,
  addReading,
  emptyState,
  markReady,
  newDraft,
  pendingDrafts,
  removeItem,
  retry,
} from './syncCore';
import { Http, SyncReport, syncAll } from './syncEngine';

const storageKey = (userId: string) => `pramaan.offline.v1.${userId}`;
const AUTO_SYNC_MS = 60_000;

// apiRequest returns the { success, data } envelope; the engine wants `data`.
const http: Http = {
  get: async (path) => (await apiRequest(path, { requiresAuth: true })).data,
  post: async (path, body) => (await apiRequest(path, { method: 'POST', requiresAuth: true, body: JSON.stringify(body) })).data,
};

const now = () => new Date().toISOString();
const uuid = () => Crypto.randomUUID();

type OfflineContextType = {
  ready: boolean;
  state: OfflineState;
  syncing: boolean;
  lastReport: SyncReport | null;
  pendingCount: number;
  syncNow: () => Promise<SyncReport | null>;
  startDraft: (job: AssignedJob) => Draft;
  saveDraftPatch: (clientId: string, patch: Partial<Draft>) => void;
  addObservationTo: (clientId: string, o: Omit<Observation, 'clientId'>) => void;
  addReadingTo: (clientId: string, r: Omit<Reading, 'clientId'>) => void;
  removeFrom: (clientId: string, kind: 'observations' | 'readings', itemId: string) => void;
  finish: (clientId: string, decision: Decision, remarks?: string) => void;
  retryDraft: (clientId: string) => void;
  discardDraft: (clientId: string) => void;
};

const Ctx = createContext<OfflineContextType | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<OfflineState>(emptyState());
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  // Always the latest state, so async sync results never overwrite newer edits.
  const stateRef = useRef(state);
  const syncingRef = useRef(false);

  const commit = useCallback(
    (next: OfflineState) => {
      stateRef.current = next;
      setState(next);
      if (user) AsyncStorage.setItem(storageKey(user.id), JSON.stringify(next)).catch(() => undefined);
    },
    [user]
  );

  // Load what is stored for this officer.
  useEffect(() => {
    let alive = true;
    setReady(false);
    (async () => {
      let loaded = emptyState();
      if (user) {
        try {
          const raw = await AsyncStorage.getItem(storageKey(user.id));
          if (raw) loaded = { ...emptyState(), ...JSON.parse(raw) };
        } catch {
          /* corrupt or unavailable storage: start empty rather than crash */
        }
      }
      if (!alive) return;
      stateRef.current = loaded;
      setState(loaded);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const syncNow = useCallback(async () => {
    if (!user || syncingRef.current) return null;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const report = await syncAll(stateRef.current, http, now);
      // Re-apply on top of the latest state: only take drafts/jobs the sync touched.
      const latest = stateRef.current;
      const drafts = { ...latest.drafts };
      for (const [id, d] of Object.entries(report.state.drafts)) {
        const local = latest.drafts[id];
        if (!local || local.updatedAt <= d.updatedAt || local.state === 'READY') drafts[id] = d;
      }
      commit({ ...report.state, drafts });
      setLastReport(report);
      return report;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [user, commit]);

  // Sync when the app opens / returns to the foreground, and periodically while work is waiting.
  useEffect(() => {
    if (!ready || !user) return;
    syncNow();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && syncNow());
    const timer = setInterval(() => {
      if (pendingDrafts(stateRef.current).length > 0) syncNow();
    }, AUTO_SYNC_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [ready, user?.id, syncNow]);

  const update = useCallback(
    (clientId: string, fn: (d: Draft) => Draft) => {
      const d = stateRef.current.drafts[clientId];
      if (!d) return;
      commit({ ...stateRef.current, drafts: { ...stateRef.current.drafts, [clientId]: fn(d) } });
    },
    [commit]
  );

  const value = useMemo<OfflineContextType>(
    () => ({
      ready,
      state,
      syncing,
      lastReport,
      pendingCount: pendingDrafts(state).length,
      syncNow,
      startDraft: (job) => {
        const existing = Object.values(stateRef.current.drafts).find(
          (d) => d.assignmentId === job.assignment_id && d.state !== 'SYNCED'
        );
        if (existing) return existing;
        const d = newDraft(job, uuid, now);
        commit({ ...stateRef.current, drafts: { ...stateRef.current.drafts, [d.clientId]: d } });
        return d;
      },
      saveDraftPatch: (id, patch) => update(id, (d) => ({ ...d, ...patch, updatedAt: now() })),
      addObservationTo: (id, o) => update(id, (d) => addObservation(d, { ...o, clientId: uuid() }, now())),
      addReadingTo: (id, r) => update(id, (d) => addReading(d, { ...r, clientId: uuid() }, now())),
      removeFrom: (id, kind, itemId) => update(id, (d) => removeItem(d, kind, itemId, now())),
      finish: (id, decision, remarks) => {
        update(id, (d) => markReady(d, decision, remarks, now()));
        syncNow();
      },
      retryDraft: (id) => {
        update(id, (d) => retry(d, now()));
        syncNow();
      },
      discardDraft: (id) => {
        const { [id]: removed, ...rest } = stateRef.current.drafts;
        // a draft already on the server (partially applied) is kept so it is not re-created
        if (removed && !removed.serverId) commit({ ...stateRef.current, drafts: rest });
      },
    }),
    [ready, state, syncing, lastReport, syncNow, update, commit]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOffline() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOffline must be used inside OfflineProvider');
  return ctx;
}
