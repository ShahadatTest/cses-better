import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestNotificationPermission,
  sendDesktopNotification,
  playVerdictChime,
} from '../src/core/notifications';

describe('Notification Utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requests notification permission if available and default', async () => {
    const mockRequest = vi.fn().mockResolvedValue('granted');
    (global as any).window = {
      Notification: {
        permission: 'default',
        requestPermission: mockRequest,
      },
    };
    (global as any).Notification = (global as any).window.Notification;

    const res = await requestNotificationPermission();
    expect(res).toBe('granted');
    expect(mockRequest).toHaveBeenCalled();
  });

  it('returns granted without prompting if permission already granted', async () => {
    const mockRequest = vi.fn();
    (global as any).window = {
      Notification: {
        permission: 'granted',
        requestPermission: mockRequest,
      },
    };
    (global as any).Notification = (global as any).window.Notification;

    const res = await requestNotificationPermission();
    expect(res).toBe('granted');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('instantiates Notification when permission is granted', () => {
    const NotificationMock = vi.fn();
    (NotificationMock as any).permission = 'granted';
    (global as any).window = { Notification: NotificationMock };
    (global as any).Notification = NotificationMock;

    sendDesktopNotification('Test Title', { body: 'Test Body' });
    expect(NotificationMock).toHaveBeenCalledWith('Test Title', expect.objectContaining({ body: 'Test Body' }));
  });

  it('safely handles playVerdictChime without throwing in any environment', () => {
    expect(() => playVerdictChime('AC')).not.toThrow();
    expect(() => playVerdictChime('WA')).not.toThrow();
    expect(() => playVerdictChime('CE')).not.toThrow();
  });
});
