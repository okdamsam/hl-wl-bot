// Every SQL statement in the bot lives here. No raw SQL anywhere else.
import { db } from './index.js';

// ── guild_config ────────────────────────────────────────────────────────────

const stmtConfigGet = db.prepare<[string], { value: string }>(
  'SELECT value FROM guild_config WHERE key = ?'
);

const stmtConfigSet = db.prepare<[string, string]>(
  `INSERT INTO guild_config (key, value) VALUES (?, ?)
   ON CONFLICT (key) DO UPDATE SET value = excluded.value`
);

export function getConfig(key: string): string | null {
  return (stmtConfigGet.get(key) as { value: string } | undefined)?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  stmtConfigSet.run(key, value);
}

// ── applications ────────────────────────────────────────────────────────────

const stmtHasActiveApplication = db.prepare<[string], { id: number }>(
  `SELECT id FROM applications
   WHERE applicant_id = ? AND status IN ('pending', 'claimed')
   LIMIT 1`
);

/** Returns true if the user already has a pending or claimed application. */
export function hasActiveApplication(applicantId: string): boolean {
  return stmtHasActiveApplication.get(applicantId) !== undefined;
}

const stmtInsertApplication = db.prepare<[string, string, number]>(
  `INSERT INTO applications (applicant_id, answers, created_at)
   VALUES (?, ?, ?)
   RETURNING id`
);

const stmtUpdateApplicationThread = db.prepare<[string, number]>(
  `UPDATE applications SET thread_id = ? WHERE id = ?`
);

const stmtDeleteApplication = db.prepare<[number]>(
  `DELETE FROM applications WHERE id = ?`
);

/** Inserts a new pending application row and returns its ID. */
export function insertApplication(applicantId: string, answers: string): number {
  const row = stmtInsertApplication.get(
    applicantId,
    answers,
    Math.floor(Date.now() / 1000),
  ) as { id: number };
  return row.id;
}

/** Stores the thread ID on the application row once the thread is created. */
export function updateApplicationThread(id: number, threadId: string): void {
  stmtUpdateApplicationThread.run(threadId, id);
}

/** Deletes an application row — only used for rollback when thread creation fails. */
export function deleteApplication(id: number): void {
  stmtDeleteApplication.run(id);
}

// ── claim / decide ───────────────────────────────────────────────────────────

const stmtClaimApplication = db.prepare<[string, number, number]>(
  `UPDATE applications SET status = 'claimed', claimed_by = ?, claimed_at = ?
   WHERE id = ? AND status = 'pending'
   RETURNING applicant_id`
);

/**
 * Conditionally transitions an application from pending → claimed.
 * Returns the applicant_id on success, null if already claimed/decided.
 */
export function claimApplication(id: number, staffId: string, now: number): string | null {
  const row = stmtClaimApplication.get(staffId, now, id) as { applicant_id: string } | undefined;
  return row?.applicant_id ?? null;
}

const stmtDecideApplication = db.prepare<[string, number]>(
  `UPDATE applications SET status = ?
   WHERE id = ? AND status = 'claimed'
   RETURNING applicant_id`
);

/**
 * Conditionally transitions an application from claimed → a terminal status.
 * Returns the applicant_id on success, null if already decided.
 */
export function decideApplication(id: number, newStatus: string): string | null {
  const row = stmtDecideApplication.get(newStatus, id) as { applicant_id: string } | undefined;
  return row?.applicant_id ?? null;
}

export interface ApplicationRow {
  id: number;
  applicant_id: string;
  thread_id: string | null;
  status: string;
  claimed_by: string | null;
}

const stmtGetApplicationById = db.prepare<[number], ApplicationRow>(
  `SELECT id, applicant_id, thread_id, status, claimed_by FROM applications WHERE id = ?`
);

/** Returns a single application row by ID, or null if not found. */
export function getApplicationById(id: number): ApplicationRow | null {
  return (stmtGetApplicationById.get(id) as ApplicationRow | undefined) ?? null;
}

const stmtUnclaimApplication = db.prepare<[number]>(
  `UPDATE applications SET status = 'pending', claimed_by = NULL, claimed_at = NULL
   WHERE id = ? AND status = 'claimed'
   RETURNING applicant_id`
);

/**
 * Conditionally transitions an application from claimed → pending and clears the claimer.
 * Returns the applicant_id on success, null if not currently claimed.
 */
export function unclaimApplication(id: number): string | null {
  const row = stmtUnclaimApplication.get(id) as { applicant_id: string } | undefined;
  return row?.applicant_id ?? null;
}

const stmtInsertDecision = db.prepare<[number, string, string, string | null, number]>(
  `INSERT INTO decisions (application_id, staff_id, action, note, created_at)
   VALUES (?, ?, ?, ?, ?)`
);

/** Appends an audit-log entry to the decisions table. */
export function insertDecision(
  applicationId: number,
  staffId: string,
  action: string,
  now: number,
  note: string | null = null,
): void {
  stmtInsertDecision.run(applicationId, staffId, action, note, now);
}

const stmtGetClaimedBy = db.prepare<[number], { claimed_by: string | null }>(
  `SELECT claimed_by FROM applications WHERE id = ?`
);

/** Returns the staff ID who claimed an application, or null if not found / unclaimed. */
export function getClaimedBy(applicationId: number): string | null {
  const row = stmtGetClaimedBy.get(applicationId) as { claimed_by: string | null } | undefined;
  return row?.claimed_by ?? null;
}

const stmtGetActiveApplication = db.prepare<[string], { id: number; thread_id: string | null }>(
  `SELECT id, thread_id FROM applications
   WHERE applicant_id = ? AND status IN ('pending', 'claimed')
   LIMIT 1`
);

/** Returns the active (pending/claimed) application for a user, or null if none. */
export function getActiveApplication(applicantId: string): { id: number; thread_id: string | null } | null {
  return (stmtGetActiveApplication.get(applicantId) as { id: number; thread_id: string | null } | undefined) ?? null;
}

const stmtCancelApplication = db.prepare<[number]>(
  `UPDATE applications SET status = 'cancelled' WHERE id = ? AND status IN ('pending', 'claimed')`
);

/** Cancels an active application. Returns true if a row was changed. */
export function cancelApplication(id: number): boolean {
  return stmtCancelApplication.run(id).changes === 1;
}

// ── Admin panel ───────────────────────────────────────────────────────────────

export interface PendingApplicationRow {
  id: number;
  applicant_id: string;
  thread_id: string | null;
  status: string;
  created_at: number;
}

const stmtGetPendingApplications = db.prepare<[], PendingApplicationRow>(
  `SELECT id, applicant_id, thread_id, status, created_at
   FROM applications
   WHERE status IN ('pending', 'claimed')
   ORDER BY created_at ASC`
);

/** Returns all pending and claimed applications for the admin panel. */
export function getPendingApplications(): PendingApplicationRow[] {
  return stmtGetPendingApplications.all() as PendingApplicationRow[];
}

// ── Application history ───────────────────────────────────────────────────────

export interface ApplicationHistoryRow {
  id: number;
  status: string;
  created_at: number;
  thread_id: string | null;
}

const stmtGetApplicationHistory = db.prepare<[string, number], ApplicationHistoryRow>(
  `SELECT id, status, created_at, thread_id FROM applications
   WHERE applicant_id = ? AND id != ?
   ORDER BY created_at DESC`
);

/** Returns all previous applications for an applicant, excluding the given application ID. */
export function getApplicationHistory(applicantId: string, excludeId: number): ApplicationHistoryRow[] {
  return stmtGetApplicationHistory.all(applicantId, excludeId) as ApplicationHistoryRow[];
}

// ── Stats ────────────────────────────────────────────────────────────────────

export interface StaffDecisionRow {
  staff_id: string;
  approved: number;
  deny_req: number;
  deny_exp: number;
  total: number;
}

const stmtStaffStats = db.prepare<[], StaffDecisionRow>(
  `SELECT
     staff_id,
     SUM(CASE WHEN action = 'approved'  THEN 1 ELSE 0 END) AS approved,
     SUM(CASE WHEN action = 'deny-req'  THEN 1 ELSE 0 END) AS deny_req,
     SUM(CASE WHEN action = 'deny-exp'  THEN 1 ELSE 0 END) AS deny_exp,
     COUNT(*) AS total
   FROM decisions
   GROUP BY staff_id
   ORDER BY total DESC`
);

/** Returns per-staff decision counts across all time. */
export function getStaffStats(): StaffDecisionRow[] {
  return stmtStaffStats.all() as StaffDecisionRow[];
}

// ── Username search ───────────────────────────────────────────────────────────

export interface UsernameQueryRow {
  id: number;
  applicant_id: string;
  thread_id: string | null;
  status: string;
  created_at: number;
  username: string | null;
}

const stmtQueryByUsername = db.prepare<[string], UsernameQueryRow>(
  `SELECT id, applicant_id, thread_id, status, created_at,
          json_extract(answers, '$.username') AS username
   FROM applications
   WHERE json_extract(answers, '$.username') LIKE ?
   ORDER BY created_at DESC
   LIMIT 25`
);

export function queryByUsername(search: string): UsernameQueryRow[] {
  return stmtQueryByUsername.all(`%${search}%`) as UsernameQueryRow[];
}

const stmtQueryByDiscordUser = db.prepare<[string], UsernameQueryRow>(
  `SELECT id, applicant_id, thread_id, status, created_at,
          json_extract(answers, '$.username') AS username
   FROM applications
   WHERE applicant_id = ?
   ORDER BY created_at DESC
   LIMIT 25`
);

export function queryByDiscordUser(userId: string): UsernameQueryRow[] {
  return stmtQueryByDiscordUser.all(userId) as UsernameQueryRow[];
}

const stmtQueryByBoth = db.prepare<[string, string], UsernameQueryRow>(
  `SELECT id, applicant_id, thread_id, status, created_at,
          json_extract(answers, '$.username') AS username
   FROM applications
   WHERE applicant_id = ?
     AND json_extract(answers, '$.username') LIKE ?
   ORDER BY created_at DESC
   LIMIT 25`
);

export function queryByBoth(userId: string, search: string): UsernameQueryRow[] {
  return stmtQueryByBoth.all(userId, `%${search}%`) as UsernameQueryRow[];
}

// ── Denial cooldown ───────────────────────────────────────────────────────────

const stmtRecentDenial = db.prepare<[string, number], { denied_at: number }>(
  `SELECT d.created_at AS denied_at
   FROM decisions d
   JOIN applications a ON a.id = d.application_id
   WHERE a.applicant_id = ?
     AND d.action IN ('deny-req', 'deny-exp')
     AND d.created_at > ?
   ORDER BY d.created_at DESC
   LIMIT 1`
);

/** Returns the timestamp of the most recent denial within the window, or null. */
export function getRecentDenial(applicantId: string, windowSeconds: number): number | null {
  const cutoff = Math.floor(Date.now() / 1000) - windowSeconds;
  const row = stmtRecentDenial.get(applicantId, cutoff) as { denied_at: number } | undefined;
  return row?.denied_at ?? null;
}

// ── Alert checks ──────────────────────────────────────────────────────────────

const stmtPendingOnlyCount = db.prepare<[], { cnt: number }>(
  `SELECT COUNT(*) AS cnt FROM applications WHERE status = 'pending'`
);

/** Returns the number of unclaimed (pending) applications. */
export function getPendingOnlyCount(): number {
  return (stmtPendingOnlyCount.get() as { cnt: number }).cnt;
}

export interface OverdueApplicationRow {
  id: number;
  applicant_id: string;
  thread_id: string | null;
  created_at: number;
}

const stmtOverdueUnalerted = db.prepare<[number], OverdueApplicationRow>(
  `SELECT id, applicant_id, thread_id, created_at
   FROM applications
   WHERE status = 'pending' AND created_at <= ? AND alerted_overdue = 0
   ORDER BY created_at ASC`
);

/** Returns pending applications older than cutoff that haven't been alerted yet. */
export function getOverdueUnalertedApplications(cutoffTs: number): OverdueApplicationRow[] {
  return stmtOverdueUnalerted.all(cutoffTs) as OverdueApplicationRow[];
}

const stmtAllOverdue = db.prepare<[number], OverdueApplicationRow>(
  `SELECT id, applicant_id, thread_id, created_at
   FROM applications
   WHERE status = 'pending' AND created_at <= ?
   ORDER BY created_at ASC`
);

/** Returns all pending applications older than cutoff regardless of alert status. */
export function getAllOverdueApplications(cutoffTs: number): OverdueApplicationRow[] {
  return stmtAllOverdue.all(cutoffTs) as OverdueApplicationRow[];
}

const stmtMarkAlertedOverdue = db.prepare<[number]>(
  `UPDATE applications SET alerted_overdue = 1 WHERE id = ?`
);

const txMarkAlertedOverdue = db.transaction((ids: number[]) => {
  for (const id of ids) stmtMarkAlertedOverdue.run(id);
});

/** Marks a batch of applications as having received the overdue alert. */
export function markApplicationsAlertedOverdue(ids: number[]): void {
  if (ids.length > 0) txMarkAlertedOverdue(ids);
}
