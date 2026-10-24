// Offline inspection model and pure helpers (no React Native imports, so the
// same code runs in the app and in Node tests).
//
// Life of a draft:  DRAFT (being filled in)  ->  READY (finished, waiting for
// a connection)  ->  SYNCED (server has it)  |  NEEDS_ATTENTION (server refused
// part of it; see `error`). Every record carries a client-generated UUID, so
// pushing the same draft twice is harmless (the server answers DUPLICATE).

export type Decision = 'PASS' | 'FAIL';
export type DraftState = 'DRAFT' | 'READY' | 'SYNCED' | 'NEEDS_ATTENTION';

export type Observation = {
  clientId: string;
  observationType: string;
  observedValue?: string;
  remarks?: string;
};

export type Reading = {
  clientId: string;
  readingType: string;
  expectedValue?: number;
  observedValue: number;
  unit: string;
  tolerance?: number;
  remarks?: string;
};

export type Draft = {
  clientId: string;
  applicationId: string;
  assignmentId: string;
  scheduleId?: string;
  applicationNumber?: string;
  instrumentName?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  startedAt: string;
  remarks?: string;
  observations: Observation[];
  readings: Reading[];
  result?: { decision: Decision; remarks?: string };
  state: DraftState;
  error?: string;
  serverId?: string;
  updatedAt: string;
};

// Row returned by GET /api/sync/pull (snake_case, as sent by the server).
export type AssignedJob = {
  assignment_id: string;
  assignment_status: string;
  application_id: string;
  application_number: string;
  application_type: string;
  application_status: string;
  instrument_name: string;
  serial_number?: string;
  capacity?: string | number;
  capacity_unit?: string;
  instrument_type?: string;
  schedule_id?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  verification_location?: string | null;
};

export type OfflineState = {
  cursor: string | null;
  lastSyncAt: string | null;
  jobs: Record<string, AssignedJob>;
  drafts: Record<string, Draft>;
};

export const emptyState = (): OfflineState => ({ cursor: null, lastSyncAt: null, jobs: {}, drafts: {} });

const EPSILON = 1e-9;

// Same rule as the server (api/src/utils/measurement.js); the server stays the
// authority, this is only a live preview for the officer.
export function previewReadingResult(r: Pick<Reading, 'expectedValue' | 'observedValue' | 'tolerance'>): Decision | null {
  if (r.expectedValue === undefined || r.tolerance === undefined) return null;
  if (![r.expectedValue, r.observedValue, r.tolerance].every(Number.isFinite)) return null;
  return Math.abs(r.observedValue - r.expectedValue) <= r.tolerance + EPSILON ? 'PASS' : 'FAIL';
}

export function newDraft(job: AssignedJob, uuid: () => string, now: () => string): Draft {
  return {
    clientId: uuid(),
    applicationId: job.application_id,
    assignmentId: job.assignment_id,
    scheduleId: job.schedule_id || undefined,
    applicationNumber: job.application_number,
    instrumentName: job.instrument_name,
    location: job.verification_location || undefined,
    startedAt: now(),
    observations: [],
    readings: [],
    state: 'DRAFT',
    updatedAt: now(),
  };
}

const touch = (d: Draft, now: string, patch: Partial<Draft>): Draft => ({ ...d, ...patch, updatedAt: now });

export function addObservation(d: Draft, o: Observation, now: string): Draft {
  return touch(d, now, { observations: [...d.observations, o] });
}

export function addReading(d: Draft, r: Reading, now: string): Draft {
  return touch(d, now, { readings: [...d.readings, r] });
}

export function removeItem(d: Draft, kind: 'observations' | 'readings', clientId: string, now: string): Draft {
  return touch(d, now, { [kind]: (d[kind] as Array<{ clientId: string }>).filter((x) => x.clientId !== clientId) } as Partial<Draft>);
}

// Problems that would make the server refuse the draft; shown before saving.
export function validateForSubmit(d: Draft, decision: Decision): string[] {
  const problems: string[] = [];
  if (d.readings.length === 0) problems.push('Record at least one reading.');
  const failed = d.readings.filter((r) => previewReadingResult(r) === 'FAIL');
  if (decision === 'PASS' && failed.length > 0) {
    problems.push(`${failed.length} reading(s) are outside tolerance, so the result cannot be PASS.`);
  }
  return problems;
}

export function markReady(d: Draft, decision: Decision, remarks: string | undefined, now: string): Draft {
  return touch(d, now, { result: { decision, remarks: remarks || undefined }, state: 'READY', error: undefined });
}

export function retry(d: Draft, now: string): Draft {
  return touch(d, now, { state: d.result ? 'READY' : 'DRAFT', error: undefined });
}

export const pendingDrafts = (s: OfflineState): Draft[] => Object.values(s.drafts).filter((d) => d.state === 'READY');

// ---- wire format -----------------------------------------------------------

export function toPushItem(d: Draft) {
  return {
    clientId: d.clientId,
    applicationId: d.applicationId,
    assignmentId: d.assignmentId,
    scheduleId: d.scheduleId,
    location: d.location,
    latitude: d.latitude,
    longitude: d.longitude,
    startedAt: d.startedAt,
    remarks: d.remarks,
    observations: d.observations,
    readings: d.readings,
    result: d.result,
  };
}

type ChildResult = { clientId?: string; status: string; error?: string };
export type PushItemResult = {
  clientId: string;
  serverId: string | null;
  status: string;
  error?: string;
  observations: ChildResult[];
  readings: ChildResult[];
  result: { status: string; error?: string } | null;
};

// Folds the server's per-item answers back into the local drafts.
export function applyPushResults(state: OfflineState, results: PushItemResult[], now: string): OfflineState {
  const drafts = { ...state.drafts };
  for (const r of results) {
    const d = drafts[r.clientId];
    if (!d) continue;
    const problem =
      r.status === 'REJECTED'
        ? r.error || 'Rejected by the server'
        : [...r.observations, ...r.readings, ...(r.result ? [r.result] : [])].find((c) => c.status === 'REJECTED')?.error;
    if (problem) {
      drafts[r.clientId] = touch(d, now, { state: 'NEEDS_ATTENTION', error: problem, serverId: r.serverId || d.serverId });
    } else {
      drafts[r.clientId] = touch(d, now, { state: 'SYNCED', error: undefined, serverId: r.serverId || d.serverId });
    }
  }
  return { ...state, drafts };
}

// Merges a pull response: jobs are upserted (and dropped when they are no
// longer the officer's active work), inspections already on the server mark
// matching local drafts as synced.
export function applyPull(
  state: OfflineState,
  pull: { serverTime: string; assignments: AssignedJob[]; inspections: Array<{ id: string; client_id: string | null; status: string }> },
  now: string
): OfflineState {
  const jobs = { ...state.jobs };
  for (const a of pull.assignments) {
    if (a.assignment_status === 'ASSIGNED' || a.assignment_status === 'ACCEPTED') jobs[a.assignment_id] = a;
    else delete jobs[a.assignment_id];
  }
  const drafts = { ...state.drafts };
  for (const i of pull.inspections) {
    const d = i.client_id ? drafts[i.client_id] : undefined;
    if (d && i.status !== 'IN_PROGRESS' && d.state !== 'SYNCED') {
      drafts[d.clientId] = touch(d, now, { state: 'SYNCED', serverId: i.id, error: undefined });
    }
  }
  return { ...state, jobs, drafts, cursor: pull.serverTime, lastSyncAt: now };
}
