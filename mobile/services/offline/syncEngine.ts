// Talks to the Phase 4 API (POST /sync/push, GET /sync/pull) through an
// injected `Http`, so the same code is used by the app and by contract tests.

import { applyPull, applyPushResults, pendingDrafts, toPushItem } from './syncCore.ts';
import type { OfflineState, PushItemResult } from './syncCore.ts';

// Resolves with the response `data`; must throw an error with `offline: true`
// when the server could not be reached (so drafts are kept for the next try).
export interface Http {
  get(path: string): Promise<any>;
  post(path: string, body: unknown): Promise<any>;
}

export type SyncReport = {
  state: OfflineState;
  offline: boolean;
  pushed: number;
  synced: number;
  needAttention: number;
  error?: string;
};

const isOffline = (e: any) => !!(e && e.offline);
const MAX_BATCH = 50; // server limit per push

export async function pushDrafts(state: OfflineState, http: Http, now: () => string): Promise<SyncReport> {
  let current = state;
  const ready = pendingDrafts(state);
  let synced = 0;
  let needAttention = 0;

  for (let i = 0; i < ready.length; i += MAX_BATCH) {
    const batch = ready.slice(i, i + MAX_BATCH);
    try {
      const data = await http.post('/sync/push', { verifications: batch.map(toPushItem) });
      current = applyPushResults(current, data.results as PushItemResult[], now());
      for (const d of batch) {
        const s = current.drafts[d.clientId]?.state;
        if (s === 'SYNCED') synced++;
        else if (s === 'NEEDS_ATTENTION') needAttention++;
      }
    } catch (e: any) {
      return { state: current, offline: isOffline(e), pushed: ready.length, synced, needAttention, error: e?.message };
    }
  }
  return { state: current, offline: false, pushed: ready.length, synced, needAttention };
}

export async function pullChanges(state: OfflineState, http: Http, now: () => string): Promise<{ state: OfflineState; offline: boolean; error?: string }> {
  try {
    const qs = state.cursor ? `?since=${encodeURIComponent(state.cursor)}` : '';
    const data = await http.get(`/sync/pull${qs}`);
    return { state: applyPull(state, data, now()), offline: false };
  } catch (e: any) {
    return { state, offline: isOffline(e), error: e?.message };
  }
}

// Push first (so the server has our work), then pull the latest assignments.
export async function syncAll(state: OfflineState, http: Http, now: () => string): Promise<SyncReport> {
  const pushed = await pushDrafts(state, http, now);
  if (pushed.offline || pushed.error) return pushed;
  const pulled = await pullChanges(pushed.state, http, now);
  return { ...pushed, state: pulled.state, offline: pulled.offline, error: pulled.error };
}
