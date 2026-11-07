import {
  CsesCredentials,
  StoredCsesAccount,
  CsesSubmitPayload,
  CsesSubmitResponse,
  CsesVerdictResult,
} from './types';

const CSES_CRED_KEY = 'cses_user_credentials';
const CSES_CRED_VERSION = 2;
let transientAccount: StoredCsesAccount | null = null;

export function getStoredCsesCredentials(): StoredCsesAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CSES_CRED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.version !== CSES_CRED_VERSION) {
        const safe = sanitizeStoredAccount(parsed);
        if (safe) localStorage.setItem(CSES_CRED_KEY, JSON.stringify({ ...safe, version: CSES_CRED_VERSION }));
        else localStorage.removeItem(CSES_CRED_KEY);
        return safe;
      }
      return sanitizeStoredAccount(parsed);
    }
    return transientAccount;
  } catch {
    return null;
  }
}

function sanitizeStoredAccount(value: any): StoredCsesAccount | null {
  if (!value || typeof value.nick !== 'string' || !value.nick.trim()) return null;
  return {
    nick: value.nick.trim(), userId: typeof value.userId === 'string' ? value.userId : undefined,
    lastSyncedAt: typeof value.lastSyncedAt === 'number' ? value.lastSyncedAt : undefined,
    solvedCount: typeof value.solvedCount === 'number' ? value.solvedCount : undefined,
    sessionCookie: value.version === CSES_CRED_VERSION && value.remember === true && typeof value.sessionCookie === 'string' ? value.sessionCookie : undefined,
    remember: value.version === CSES_CRED_VERSION && value.remember === true,
  };
}

export function saveStoredCsesCredentials(creds: Partial<StoredCsesAccount> & { nick: string }): void {
  if (typeof window === 'undefined') return;
  try {
    if (creds.remember === true) {
      const previous = getStoredCsesCredentials();
      const existing = previous?.nick.toLocaleLowerCase() === creds.nick.trim().toLocaleLowerCase()
        ? previous : ({} as StoredCsesAccount);
      const updated: StoredCsesAccount = {
        nick: creds.nick.trim(),
        userId: creds.userId || existing.userId,
        sessionCookie: creds.sessionCookie || existing.sessionCookie,
        lastSyncedAt: creds.lastSyncedAt || existing.lastSyncedAt,
        solvedCount: creds.solvedCount !== undefined ? creds.solvedCount : existing.solvedCount,
        remember: true,
      };
      transientAccount = updated;
      localStorage.setItem(CSES_CRED_KEY, JSON.stringify({ ...updated, version: CSES_CRED_VERSION }));
      window.dispatchEvent(new Event('cses-account-changed'));
    } else {
      transientAccount = {
        nick: creds.nick.trim(), userId: creds.userId,
        sessionCookie: creds.sessionCookie, lastSyncedAt: creds.lastSyncedAt,
        solvedCount: creds.solvedCount, remember: false,
      };
      localStorage.removeItem(CSES_CRED_KEY);
      window.dispatchEvent(new Event('cses-account-changed'));
    }
  } catch {
    // ignore
  }
}

export function clearStoredCsesCredentials(): void {
  if (typeof window === 'undefined') return;
  try {
    transientAccount = null;
    localStorage.removeItem(CSES_CRED_KEY);
    window.dispatchEvent(new Event('cses-account-changed'));
  } catch {
    // ignore
  }
}

export function getStoredCsesSessionCookie(): string | undefined {
  const creds = getStoredCsesCredentials();
  return creds?.sessionCookie;
}

/**
 * Validate CSES credentials against CSES.fi
 */
export async function testCsesAuth(
  nick: string,
  pass: string
): Promise<{ success: boolean; nick?: string; userId?: string; sessionCookie?: string; error?: string }> {
  try {
    const res = await fetch('/api/cses/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick, pass }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error verifying CSES credentials' };
  }
}

/**
 * Synchronize completed problems and session from official CSES
 */
export async function syncCsesAccount(credentials?: {
  nick?: string;
  pass?: string;
  remember?: boolean;
  sessionCookie?: string;
  userId?: string;
}): Promise<{
  success: boolean;
  nick?: string;
  userId?: string;
  sessionCookie?: string;
  solvedCount?: number;
  solvedProblemIds?: string[];
  solvedProblems?: { id: string; name: string }[];
  syncedAt?: number;
  error?: string;
}> {
  try {
    const stored = getStoredCsesCredentials();
    const payload = {
      nick: credentials?.nick || stored?.nick,
      pass: credentials?.pass,
      sessionCookie: credentials?.sessionCookie || stored?.sessionCookie,
      userId: credentials?.userId || stored?.userId,
    };

    if (!payload.nick && !payload.sessionCookie) {
      return { success: false, error: 'No CSES account credentials found. Please connect your CSES account.' };
    }

    const res = await fetch('/api/cses/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (data.success) {
      saveStoredCsesCredentials({
        nick: data.nick,
        userId: data.userId,
        sessionCookie: data.sessionCookie,
        lastSyncedAt: data.syncedAt || Date.now(),
        solvedCount: data.solvedCount,
        remember: credentials?.remember ?? (stored?.remember === true),
      });
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error syncing from CSES' };
  }
}

/**
 * Submits solution code to official CSES.fi
 */
export async function submitToCses(
  payload: CsesSubmitPayload
): Promise<CsesSubmitResponse> {
  try {
    const res = await fetch('/api/cses/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to submit to CSES' };
  }
}

/**
 * Polls the live CSES judging results
 */
export async function pollCsesVerdict(
  submissionId: string,
  onUpdate?: (result: CsesVerdictResult) => void,
  maxAttempts = 40,
  intervalMs = 1500,
  sessionCookie?: string,
  problemId?: string,
  signal?: AbortSignal
): Promise<CsesVerdictResult> {
  const headers: Record<string, string> = {};
  const activeCookie = sessionCookie || getStoredCsesSessionCookie();
  if (activeCookie) {
    headers['x-cses-session'] = activeCookie;
  }

  const queryParam = problemId ? `?problemId=${encodeURIComponent(problemId)}` : '';
  let lastTransportError: string | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) break;
    try {
      const res = await fetch(`/api/cses/result/${encodeURIComponent(submissionId)}${queryParam}`, { headers, signal });
      if (res.status === 401 || res.status === 403) {
        return {
          submissionId, status: 'UNKNOWN', lifecycleStatus: 'UNKNOWN',
          rawStatusText: `CSES result access denied (HTTP ${res.status}). Reconnect your CSES account and check again.`,
          tests: [], resultUrl: `https://cses.fi/problemset/result/${submissionId}/`,
        };
      }
      if (res.ok) {
        lastTransportError = undefined;
        const result: CsesVerdictResult = await res.json();
        if (signal?.aborted) break;
        if (onUpdate) onUpdate(result);

        const hasFinalVerdict = !['PENDING', 'TESTING', 'UNKNOWN'].includes(result.status);
        if (hasFinalVerdict && (result.lifecycleStatus === 'FINISHED' || result.lifecycleStatus === undefined)) {
          return result;
        }
      } else {
        lastTransportError = `CSES result check failed (HTTP ${res.status}).`;
      }
    } catch (e) {
      if (signal?.aborted) break;
      lastTransportError = `Could not reach the CSES result endpoint: ${e instanceof Error ? e.message : String(e)}`;
    }

    if (attempt + 1 < maxAttempts && !signal?.aborted) {
      await new Promise<void>((resolve) => {
        let timer: ReturnType<typeof setTimeout>;
        const finish = () => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', finish);
          resolve();
        };
        timer = setTimeout(finish, intervalMs);
        signal?.addEventListener('abort', finish, { once: true });
        if (signal?.aborted) finish();
      });
    }
  }

  // Fallback timeout result
  return {
    submissionId,
    status: 'UNKNOWN',
    rawStatusText: lastTransportError || 'Timed out waiting for the CSES judge; check again later.',
    tests: [],
    resultUrl: `https://cses.fi/problemset/result/${submissionId}/`,
  };
}
