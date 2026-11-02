import { VerdictStatus } from './types';

/**
 * Requests browser permission for desktop notifications.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch {
    return null;
  }
}

/**
 * Sends a native browser desktop notification if permission is granted.
 */
export function sendDesktopNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  try {
    if (Notification.permission === 'granted') {
      return new Notification(title, {
        badge: '/favicon.ico',
        icon: '/favicon.ico',
        ...options,
      });
    }
  } catch {
    // Ignore notification exceptions in restricted or non-HTTPS contexts
  }
  return null;
}

/**
 * Synthesizes a subtle, pleasant audio chime using the standard Web Audio API.
 * Requires zero external audio files and works offline and in background tabs.
 */
export function playVerdictChime(status: VerdictStatus): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (status === 'AC') {
      // Pleasant two-tone chime (C6 -> G6)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(1046.5, now);
      osc2.frequency.setValueAtTime(1567.98, now + 0.12);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } else {
      // Subtle single tone (E4)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(329.63, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.28);
    }
  } catch {
    // Autoplay policy or muted context fallback
  }
}
