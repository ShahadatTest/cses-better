import {
  CsesCredentials,
  CsesSubmitPayload,
  CsesSubmitResponse,
  CsesVerdictResult,
} from './types';

const CSES_CRED_KEY = 'cses_user_credentials';

export function getStoredCsesCredentials(): CsesCredentials | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CSES_CRED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredCsesCredentials(creds: CsesCredentials): void {
  if (typeof window === 'undefined') return;
  try {
    if (creds.remember) {
      localStorage.setItem(CSES_CRED_KEY, JSON.stringify(creds));
    } else {
      localStorage.removeItem(CSES_CRED_KEY);
    }
  } catch {
    // ignore
  }
}

export function clearStoredCsesCredentials(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CSES_CRED_KEY);
  } catch {
    // ignore
  }
}

/**
 * Validate CSES credentials against CSES.fi
 */
export async function testCsesAuth(
  nick: string,
  pass: string
): Promise<{ success: boolean; error?: string }> {
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
  intervalMs = 1500
): Promise<CsesVerdictResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(`/api/cses/result/${submissionId}`);
      if (res.ok) {
        const result: CsesVerdictResult = await res.json();
        if (onUpdate) onUpdate(result);

        // Check if finished
        if (result.status !== 'PENDING' && result.status !== 'TESTING') {
          return result;
        }
      }
    } catch (e) {
      console.warn(`[CSES Poller] Attempt ${attempt} failed:`, e);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // Fallback timeout result
  return {
    submissionId,
    status: 'UNKNOWN',
    rawStatusText: 'Timed out waiting for CSES judge',
    tests: [],
    resultUrl: `https://cses.fi/problemset/result/${submissionId}/`,
  };
}
